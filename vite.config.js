import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {
  authenticateAdminCredentials,
  authorizeAdminSessionFromRequest,
  createAdminSessionCookieClearValue,
  createAdminSessionCookieValue,
  resolveClientIdentifier,
} from './server/adminAuthenticationDataService.js'
import { resolveApiRateLimitResult } from './server/apiRateLimitService.js'
import {
  deleteUploadedImageByUrl,
  listUploadedImageUrlCatalog,
  loadProjectArticleCatalogFromDisk,
  loadProjectPreferencesFromDisk,
  persistContactSubmissionOnDisk,
  persistProjectPreferencesOnDisk,
  persistProjectArticleCatalogOnDisk,
  persistUploadedImageDataUrl,
  readRequestBodyAsJson,
  writeJsonResponse,
} from './server/projectPersistenceDataService.js'

// https://vite.dev/config/

const globalSecurityResponseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

const globalPreviewSecurityResponseHeaders = {
  ...globalSecurityResponseHeaders,
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://images.unsplash.com; " +
    "connect-src 'self'; base-uri 'self'; form-action 'self';",
}

const globalDevServerWatchIgnoredPathCatalog = [
  '**/data/articles.json',
  '**/data/contactSubmissions.json',
  '**/data/projectPreferences.json',
  '**/public/uploads/**',
]

const globalCurrentFilePath = fileURLToPath(import.meta.url)
const globalCurrentDirectoryPath = path.dirname(globalCurrentFilePath)
const globalPublicUploadsDirectoryPath = path.resolve(globalCurrentDirectoryPath, 'public', 'uploads')

const globalMimeTypeByExtension = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

function resolveMimeTypeByFilePath(filePath) {
  const fileExtension = path.extname(filePath).toLowerCase()
  return globalMimeTypeByExtension[fileExtension] || 'application/octet-stream'
}

function isPathInsideParent(parentPath, targetPath) {
  const relativePath = path.relative(parentPath, targetPath)
  return relativePath.length > 0 && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

async function streamUploadFileFromDisk(response, filePath) {
  const fileStats = await fs.promises.stat(filePath)

  if (!fileStats.isFile()) {
    response.statusCode = 404
    response.end('Not Found')
    return
  }

  response.statusCode = 200
  response.setHeader('Content-Type', resolveMimeTypeByFilePath(filePath))

  const readStream = fs.createReadStream(filePath)
  readStream.on('error', () => {
    response.statusCode = 500
    response.end('Internal Server Error')
  })

  readStream.pipe(response)
}

function writeSafeApiErrorResponse(response, caughtError, fallbackMessage) {
  const statusCode = Number(caughtError?.statusCode)
  const isValidStatusCode = statusCode >= 400 && statusCode <= 599

  if (isValidStatusCode) {
    writeJsonResponse(response, statusCode, {
      statusCode,
      message: 'Requisicao rejeitada por politica de seguranca.',
    })
    return
  }

  writeJsonResponse(response, 500, {
    statusCode: 500,
    message: fallbackMessage,
  })
}

function createProjectPersistenceApiPlugin() {
  return {
    name: 'project-persistence-api',
    configureServer(server) {
      server.middlewares.use('/uploads', async (request, response, next) => {
        if (!['GET', 'HEAD'].includes(String(request.method || 'GET').toUpperCase())) {
          next()
          return
        }

        try {
          const uploadPathName = decodeURIComponent(String(request.url || '/').split('?')[0] || '/')
          const uploadRelativePath = uploadPathName.replace(/^\//, '')
          const uploadFilePath = path.resolve(globalPublicUploadsDirectoryPath, uploadRelativePath)

          const isAllowedUploadPath = isPathInsideParent(globalPublicUploadsDirectoryPath, uploadFilePath)
            || uploadFilePath === globalPublicUploadsDirectoryPath

          if (!isAllowedUploadPath) {
            response.statusCode = 403
            response.end('Forbidden')
            return
          }

          const fileExists = fs.existsSync(uploadFilePath)
          if (!fileExists) {
            response.statusCode = 404
            response.end('Not Found')
            return
          }

          await streamUploadFileFromDisk(response, uploadFilePath)
        } catch {
          next()
        }
      })

      server.middlewares.use('/api', (request, response, next) => {
        const requestPathName = request.url ? String(request.url).split('?')[0] : '/api'
        const normalizedApiPathName = requestPathName.startsWith('/api/')
          ? requestPathName
          : `/api${requestPathName}`
        const clientIdentifier = resolveClientIdentifier(request)
        const rateLimitResult = resolveApiRateLimitResult({
          clientIdentifier,
          requestMethod: request.method,
          requestPathName: normalizedApiPathName,
        })

        if (rateLimitResult.isRateLimited) {
          response.setHeader('Retry-After', String(rateLimitResult.retryAfterSeconds))
          writeJsonResponse(response, 429, {
            statusCode: 429,
            message: 'Limite de requisicoes atingido. Aguarde e tente novamente.',
          })
          return
        }

        next()
      })

      server.middlewares.use('/api/admin/authenticate', async (request, response) => {
        try {
          if (request.method !== 'POST') {
            writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
            return
          }

          const requestPayload = await readRequestBodyAsJson(request, {
            maxBodySizeInBytes: 32 * 1024,
            requireJsonContentType: true,
          })
          const clientIdentifier = resolveClientIdentifier(request)
          const authenticationResult = authenticateAdminCredentials(requestPayload, clientIdentifier)

          if (authenticationResult.statusCode === 200 && authenticationResult.payload.sessionToken) {
            response.setHeader('Set-Cookie', createAdminSessionCookieValue(authenticationResult.payload.sessionToken))
          }

          writeJsonResponse(response, authenticationResult.statusCode, {
            statusCode: authenticationResult.statusCode,
            message: authenticationResult.payload.message,
            sessionExpiresAtInSeconds: authenticationResult.payload.sessionExpiresAtInSeconds,
            username: authenticationResult.payload.username,
          })
        } catch (caughtError) {
          writeSafeApiErrorResponse(response, caughtError, 'Falha no processamento de autenticacao administrativa.')
        }
      })

      server.middlewares.use('/api/admin/session', async (request, response) => {
        try {
          if (request.method !== 'GET') {
            writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
            return
          }

          const authorizationResult = authorizeAdminSessionFromRequest(request)
          if (!authorizationResult.isAuthorized) {
            writeJsonResponse(response, authorizationResult.statusCode, {
              statusCode: authorizationResult.statusCode,
              message: authorizationResult.message,
            })
            return
          }

          writeJsonResponse(response, 200, {
            statusCode: 200,
            username: authorizationResult.sessionData.username,
            sessionExpiresAtInSeconds: authorizationResult.sessionData.expiresAtInSeconds,
          })
        } catch (caughtError) {
          writeSafeApiErrorResponse(response, caughtError, 'Falha ao validar sessao administrativa.')
        }
      })

      server.middlewares.use('/api/admin/logout', async (request, response) => {
        try {
          if (request.method !== 'POST') {
            writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
            return
          }

          response.setHeader('Set-Cookie', createAdminSessionCookieClearValue())
          writeJsonResponse(response, 200, {
            statusCode: 200,
            message: 'Sessao administrativa encerrada com seguranca.',
          })
        } catch (caughtError) {
          writeSafeApiErrorResponse(response, caughtError, 'Falha ao encerrar sessao administrativa.')
        }
      })

      server.middlewares.use('/api/admin/articles', async (request, response) => {
        try {
          if (request.method === 'GET') {
            const articleCatalog = await loadProjectArticleCatalogFromDisk()
            writeJsonResponse(response, 200, { statusCode: 200, articleCatalog })
            return
          }

          if (request.method === 'POST') {
            const authorizationResult = authorizeAdminSessionFromRequest(request)
            if (!authorizationResult.isAuthorized) {
              writeJsonResponse(response, authorizationResult.statusCode, {
                statusCode: authorizationResult.statusCode,
                message: authorizationResult.message,
              })
              return
            }

            const requestPayload = await readRequestBodyAsJson(request, {
              maxBodySizeInBytes: 512 * 1024,
              requireJsonContentType: true,
            })
            const normalizedArticleCatalog = await persistProjectArticleCatalogOnDisk(requestPayload.articleCatalog)
            writeJsonResponse(response, 200, { statusCode: 200, articleCatalog: normalizedArticleCatalog })
            return
          }

          writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
        } catch (caughtError) {
          writeSafeApiErrorResponse(response, caughtError, 'Falha ao persistir catalogo de artigos no projeto.')
        }
      })

      server.middlewares.use('/api/project/preferences', async (request, response) => {
        try {
          if (request.method !== 'GET') {
            writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
            return
          }

          const projectPreferences = await loadProjectPreferencesFromDisk()
          writeJsonResponse(response, 200, { statusCode: 200, projectPreferences })
        } catch (caughtError) {
          writeSafeApiErrorResponse(response, caughtError, 'Falha ao carregar preferencias globais do projeto.')
        }
      })

      server.middlewares.use('/api/admin/project/preferences', async (request, response) => {
        try {
          if (!['GET', 'POST'].includes(String(request.method || '').toUpperCase())) {
            writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
            return
          }

          const authorizationResult = authorizeAdminSessionFromRequest(request)
          if (!authorizationResult.isAuthorized) {
            writeJsonResponse(response, authorizationResult.statusCode, {
              statusCode: authorizationResult.statusCode,
              message: authorizationResult.message,
            })
            return
          }

          if (request.method === 'GET') {
            const projectPreferences = await loadProjectPreferencesFromDisk()
            writeJsonResponse(response, 200, { statusCode: 200, projectPreferences })
            return
          }

          const requestPayload = await readRequestBodyAsJson(request, {
            maxBodySizeInBytes: 32 * 1024,
            requireJsonContentType: true,
          })

          const projectPreferences = await persistProjectPreferencesOnDisk(requestPayload.projectPreferences)
          writeJsonResponse(response, 200, { statusCode: 200, projectPreferences })
        } catch (caughtError) {
          writeSafeApiErrorResponse(response, caughtError, 'Falha ao persistir preferencias globais do projeto.')
        }
      })

      server.middlewares.use('/api/admin/upload-image', async (request, response) => {
        try {
          if (!['GET', 'POST', 'DELETE'].includes(String(request.method || '').toUpperCase())) {
            writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
            return
          }

          const authorizationResult = authorizeAdminSessionFromRequest(request)
          if (!authorizationResult.isAuthorized) {
            writeJsonResponse(response, authorizationResult.statusCode, {
              statusCode: authorizationResult.statusCode,
              message: authorizationResult.message,
            })
            return
          }

          if (request.method === 'GET') {
            const imageUrlCatalog = await listUploadedImageUrlCatalog()

            writeJsonResponse(response, 200, {
              statusCode: 200,
              imageUrlCatalog,
            })
            return
          }

          if (request.method === 'POST') {
            const requestPayload = await readRequestBodyAsJson(request, {
              maxBodySizeInBytes: 15 * 1024 * 1024,
              requireJsonContentType: true,
            })
            const imageUrl = await persistUploadedImageDataUrl(requestPayload.imageDataUrl, requestPayload.sourceLabel)

            writeJsonResponse(response, 200, {
              statusCode: 200,
              imageUrl,
            })
            return
          }

          const requestPayload = await readRequestBodyAsJson(request, {
            maxBodySizeInBytes: 32 * 1024,
            requireJsonContentType: true,
          })
          const deletionResult = await deleteUploadedImageByUrl(requestPayload.imageUrl)

          writeJsonResponse(response, 200, {
            statusCode: 200,
            isDeleted: deletionResult.isDeleted,
          })
        } catch (caughtError) {
          writeSafeApiErrorResponse(response, caughtError, 'Falha ao persistir imagem no projeto.')
        }
      })

      server.middlewares.use('/api/contact', async (request, response) => {
        try {
          if (request.method !== 'POST') {
            writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
            return
          }

          const requestPayload = await readRequestBodyAsJson(request, {
            maxBodySizeInBytes: 64 * 1024,
            requireJsonContentType: true,
          })

          const persistedContactSubmission = await persistContactSubmissionOnDisk(requestPayload)
          writeJsonResponse(response, 201, {
            statusCode: 201,
            message: `Mensagem recebida com sucesso de ${persistedContactSubmission.fullName}.`,
          })
        } catch (caughtError) {
          writeSafeApiErrorResponse(response, caughtError, 'Falha ao registrar mensagem de contato.')
        }
      })

      server.middlewares.use('/api', (request, response) => {
        writeJsonResponse(response, 404, {
          statusCode: 404,
          message: 'Rota de API nao encontrada.',
        })
      })
    },
  }
}

export default defineConfig(({ command }) => {
  const isDevelopmentServer = command === 'serve'

  return {
    plugins: [react(), tailwindcss(), createProjectPersistenceApiPlugin()],
    server: {
      headers: globalSecurityResponseHeaders,
      watch: {
        ignored: globalDevServerWatchIgnoredPathCatalog,
      },
    },
    preview: { headers: globalPreviewSecurityResponseHeaders },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/tests/setupTests.js',
      coverage: {
        reporter: ['text', 'html'],
      },
    },
    // In dev, Vite HMR and module graph can be blocked by strict CSP.
    // Keep strict CSP only in preview/build-serving environments.
    ...(isDevelopmentServer && {
      server: {
        headers: globalSecurityResponseHeaders,
        watch: {
          ignored: globalDevServerWatchIgnoredPathCatalog,
        },
      },
    }),
  }
})
