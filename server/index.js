import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { URL } from 'node:url'
import {
  assertAdminAuthenticationSecurityConfiguration,
  authenticateAdminCredentials,
  authorizeAdminSessionFromRequest,
  createAdminSessionCookieClearValue,
  createAdminSessionCookieValue,
  resolveClientIdentifier,
} from './adminAuthenticationDataService.js'
import { resolveApiRateLimitResult } from './apiRateLimitService.js'
import {
  createCorrelationIdentifier,
  deleteUploadedImageByUrl,
  listUploadedImageUrlCatalog,
  loadProjectArticleCatalogFromDisk,
  loadProjectPreferencesFromDisk,
  persistContactSubmissionOnDisk,
  persistProjectPreferencesOnDisk,
  persistProjectArticleCatalogOnDisk,
  persistUploadedImageDataUrl,
  readRequestBodyAsJson,
  resolveProjectPersistencePaths,
  writeJsonResponse,
} from './projectPersistenceDataService.js'

const globalServerPort = Number(process.env.PORT || 4173)
const globalServerHost = process.env.HOST || '0.0.0.0'

assertAdminAuthenticationSecurityConfiguration()

const {
  distributionDirectoryPath: globalDistributionDirectoryPath,
  projectRootDirectoryPath: globalProjectRootDirectoryPath,
  publicUploadsDirectoryPath: globalPublicUploadsDirectoryPath,
} = resolveProjectPersistencePaths()

const globalSecurityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://images.unsplash.com; " +
    "connect-src 'self'; base-uri 'self'; form-action 'self';",
}

const globalMimeTypeByExtension = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

function applySecurityHeaders(response) {
  Object.entries(globalSecurityHeaders).forEach(([headerName, headerValue]) => {
    response.setHeader(headerName, headerValue)
  })
}

function resolveMimeTypeByFilePath(filePath) {
  const fileExtension = path.extname(filePath).toLowerCase()
  return globalMimeTypeByExtension[fileExtension] || 'application/octet-stream'
}

function isPathInsideParent(parentPath, targetPath) {
  const relativePath = path.relative(parentPath, targetPath)
  return relativePath.length > 0 && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

async function streamStaticFile(response, filePath) {
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

async function handleApiRoutes(request, response, requestPathName) {
  if (requestPathName === '/api/admin/authenticate') {
    if (request.method !== 'POST') {
      writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
      return true
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
    return true
  }

  if (requestPathName === '/api/admin/session') {
    if (request.method !== 'GET') {
      writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
      return true
    }

    const authorizationResult = authorizeAdminSessionFromRequest(request)
    if (!authorizationResult.isAuthorized) {
      writeJsonResponse(response, authorizationResult.statusCode, {
        statusCode: authorizationResult.statusCode,
        message: authorizationResult.message,
      })
      return true
    }

    writeJsonResponse(response, 200, {
      statusCode: 200,
      username: authorizationResult.sessionData.username,
      sessionExpiresAtInSeconds: authorizationResult.sessionData.expiresAtInSeconds,
    })
    return true
  }

  if (requestPathName === '/api/admin/logout') {
    if (request.method !== 'POST') {
      writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
      return true
    }

    response.setHeader('Set-Cookie', createAdminSessionCookieClearValue())
    writeJsonResponse(response, 200, {
      statusCode: 200,
      message: 'Sessao administrativa encerrada com seguranca.',
    })
    return true
  }

  if (requestPathName === '/api/admin/articles') {
    if (request.method === 'GET') {
      const articleCatalog = await loadProjectArticleCatalogFromDisk()
      writeJsonResponse(response, 200, { statusCode: 200, articleCatalog })
      return true
    }

    if (request.method === 'POST') {
      const authorizationResult = authorizeAdminSessionFromRequest(request)
      if (!authorizationResult.isAuthorized) {
        writeJsonResponse(response, authorizationResult.statusCode, {
          statusCode: authorizationResult.statusCode,
          message: authorizationResult.message,
        })
        return true
      }

      const requestPayload = await readRequestBodyAsJson(request, {
        maxBodySizeInBytes: 512 * 1024,
        requireJsonContentType: true,
      })
      const normalizedArticleCatalog = await persistProjectArticleCatalogOnDisk(requestPayload.articleCatalog)
      writeJsonResponse(response, 200, { statusCode: 200, articleCatalog: normalizedArticleCatalog })
      return true
    }

    writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
    return true
  }

  if (requestPathName === '/api/project/preferences') {
    if (request.method !== 'GET') {
      writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
      return true
    }

    const projectPreferences = await loadProjectPreferencesFromDisk()
    writeJsonResponse(response, 200, { statusCode: 200, projectPreferences })
    return true
  }

  if (requestPathName === '/api/admin/project/preferences') {
    if (!['GET', 'POST'].includes(String(request.method || '').toUpperCase())) {
      writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
      return true
    }

    const authorizationResult = authorizeAdminSessionFromRequest(request)
    if (!authorizationResult.isAuthorized) {
      writeJsonResponse(response, authorizationResult.statusCode, {
        statusCode: authorizationResult.statusCode,
        message: authorizationResult.message,
      })
      return true
    }

    if (request.method === 'GET') {
      const projectPreferences = await loadProjectPreferencesFromDisk()
      writeJsonResponse(response, 200, { statusCode: 200, projectPreferences })
      return true
    }

    const requestPayload = await readRequestBodyAsJson(request, {
      maxBodySizeInBytes: 32 * 1024,
      requireJsonContentType: true,
    })

    const projectPreferences = await persistProjectPreferencesOnDisk(requestPayload.projectPreferences)
    writeJsonResponse(response, 200, { statusCode: 200, projectPreferences })
    return true
  }

  if (requestPathName === '/api/admin/upload-image') {
    if (!['GET', 'POST', 'DELETE'].includes(String(request.method || '').toUpperCase())) {
      writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
      return true
    }

    const authorizationResult = authorizeAdminSessionFromRequest(request)
    if (!authorizationResult.isAuthorized) {
      writeJsonResponse(response, authorizationResult.statusCode, {
        statusCode: authorizationResult.statusCode,
        message: authorizationResult.message,
      })
      return true
    }

    if (request.method === 'GET') {
      const imageUrlCatalog = await listUploadedImageUrlCatalog()
      writeJsonResponse(response, 200, { statusCode: 200, imageUrlCatalog })
      return true
    }

    if (request.method === 'POST') {
      const requestPayload = await readRequestBodyAsJson(request, {
        maxBodySizeInBytes: 15 * 1024 * 1024,
        requireJsonContentType: true,
      })
      const imageUrl = await persistUploadedImageDataUrl(requestPayload.imageDataUrl, requestPayload.sourceLabel)
      writeJsonResponse(response, 200, { statusCode: 200, imageUrl })
      return true
    }

    const requestPayload = await readRequestBodyAsJson(request, {
      maxBodySizeInBytes: 32 * 1024,
      requireJsonContentType: true,
    })
    const deletionResult = await deleteUploadedImageByUrl(requestPayload.imageUrl)
    writeJsonResponse(response, 200, { statusCode: 200, isDeleted: deletionResult.isDeleted })
    return true
  }

  if (requestPathName === '/api/contact') {
    if (request.method !== 'POST') {
      writeJsonResponse(response, 405, { statusCode: 405, message: 'Metodo nao suportado.' })
      return true
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
    return true
  }

  if (requestPathName.startsWith('/api/')) {
    writeJsonResponse(response, 404, {
      statusCode: 404,
      message: 'Rota de API nao encontrada.',
    })
    return true
  }

  return false
}

async function handleStaticRoutes(response, requestPathName) {
  const safeRequestPathName = decodeURIComponent(requestPathName || '/')

  if (safeRequestPathName.startsWith('/uploads/')) {
    const uploadRelativePath = safeRequestPathName.replace(/^\/uploads\//, '')
    const uploadFilePath = path.resolve(globalPublicUploadsDirectoryPath, uploadRelativePath)

    if (!isPathInsideParent(globalPublicUploadsDirectoryPath, uploadFilePath) && uploadFilePath !== globalPublicUploadsDirectoryPath) {
      response.statusCode = 403
      response.end('Forbidden')
      return
    }

    await streamStaticFile(response, uploadFilePath)
    return
  }

  const normalizedRequestPathName = safeRequestPathName === '/' ? '/index.html' : safeRequestPathName
  const staticFilePath = path.resolve(globalDistributionDirectoryPath, `.${normalizedRequestPathName}`)

  if (isPathInsideParent(globalDistributionDirectoryPath, staticFilePath) || staticFilePath === globalDistributionDirectoryPath) {
    const fileExists = fs.existsSync(staticFilePath)
    if (fileExists) {
      await streamStaticFile(response, staticFilePath)
      return
    }
  }

  const indexFilePath = path.resolve(globalDistributionDirectoryPath, 'index.html')
  await streamStaticFile(response, indexFilePath)
}

const productionServer = http.createServer(async (request, response) => {
  applySecurityHeaders(response)

  if (!request.url) {
    writeJsonResponse(response, 400, { statusCode: 400, message: 'Requisicao invalida.' })
    return
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
  const requestPathName = requestUrl.pathname

  try {
    if (requestPathName.startsWith('/api/')) {
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
    }

    const isApiRequestHandled = await handleApiRoutes(request, response, requestPathName)
    if (isApiRequestHandled) {
      return
    }

    await handleStaticRoutes(response, requestPathName)
  } catch (caughtError) {
    const correlationIdentifier = createCorrelationIdentifier()
    const statusCode = Number(caughtError?.statusCode)
    const isValidStatusCode = statusCode >= 400 && statusCode <= 599

    if (isValidStatusCode) {
      writeJsonResponse(response, statusCode, {
        statusCode,
        correlationIdentifier,
        message: 'Requisicao rejeitada por politica de seguranca.',
      })
      return
    }

    writeJsonResponse(response, 500, {
      statusCode: 500,
      correlationIdentifier,
      message: 'Falha interna durante o processamento da requisicao.',
    })
  }
})

productionServer.listen(globalServerPort, globalServerHost, () => {
  const relativeBuildPath = path.relative(globalProjectRootDirectoryPath, globalDistributionDirectoryPath)
  console.log(`Servidor ativo em http://${globalServerHost}:${globalServerPort}`)
  console.log(`Assets publicados lidos de: ${relativeBuildPath || 'dist'}`)
})