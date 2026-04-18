import { defineConfig } from 'vite'
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
  loadProjectArticleCatalogFromDisk,
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
      server.middlewares.use('/api', (request, response, next) => {
        const requestPathName = request.url ? String(request.url).split('?')[0] : '/api'
        const clientIdentifier = resolveClientIdentifier(request)
        const rateLimitResult = resolveApiRateLimitResult({
          clientIdentifier,
          requestMethod: request.method,
          requestPathName,
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

      server.middlewares.use('/api/admin/upload-image', async (request, response) => {
        try {
          if (request.method !== 'POST') {
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

          const requestPayload = await readRequestBodyAsJson(request, {
            maxBodySizeInBytes: 15 * 1024 * 1024,
            requireJsonContentType: true,
          })
          const imageUrl = await persistUploadedImageDataUrl(requestPayload.imageDataUrl, requestPayload.sourceLabel)

          writeJsonResponse(response, 200, {
            statusCode: 200,
            imageUrl,
          })
        } catch (caughtError) {
          writeSafeApiErrorResponse(response, caughtError, 'Falha ao persistir imagem no projeto.')
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
      },
    }),
  }
})
