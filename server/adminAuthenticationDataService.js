import crypto from 'node:crypto'
import { globalAdminAccessConfig } from '../src/constants/globalAdminAccessConfig.js'

const globalMaxLoginAttempts = 5
const globalLockoutDurationInMs = 15 * 60 * 1000
const globalAdminSessionCookieName = 'dimi3d_admin_session'

const globalLoginAttemptStateByClientIdentifier = new Map()

function sanitizeCredentialValue(rawValue) {
  return String(rawValue || '').replace(/[<>]/g, '').trim()
}

function resolveExpectedAdminCredentials() {
  return {
    username: process.env.VITE_ADMIN_USERNAME || globalAdminAccessConfig.defaultAdminUsername,
    password: process.env.VITE_ADMIN_PASSWORD || globalAdminAccessConfig.defaultAdminPassword,
    verificationCode: process.env.VITE_ADMIN_VERIFICATION_CODE || globalAdminAccessConfig.defaultAdminVerificationCode,
  }
}

function resolveSessionSecret() {
  return process.env.VITE_ADMIN_SESSION_SECRET || 'local-admin-signature-secret-2026'
}

function resolveIsSecureCookieEnabled() {
  return process.env.NODE_ENV === 'production'
}

function encodeToBase64Url(rawValue) {
  return Buffer.from(rawValue, 'utf-8').toString('base64url')
}

function createHmacSha256Base64Url(unsignedTokenValue, secret) {
  return crypto.createHmac('sha256', secret).update(unsignedTokenValue).digest('base64url')
}

function compareSignatureSafely(receivedSignature, expectedSignature) {
  const receivedSignatureBuffer = Buffer.from(String(receivedSignature || ''), 'utf-8')
  const expectedSignatureBuffer = Buffer.from(String(expectedSignature || ''), 'utf-8')

  if (receivedSignatureBuffer.length !== expectedSignatureBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer)
}

function decodeBase64UrlJson(encodedSegment) {
  const segmentText = Buffer.from(String(encodedSegment || ''), 'base64url').toString('utf-8')
  return JSON.parse(segmentText)
}

function resolveBearerTokenFromHeader(authorizationHeaderValue) {
  const rawHeaderValue = String(authorizationHeaderValue || '').trim()
  if (!rawHeaderValue.toLowerCase().startsWith('bearer ')) {
    return null
  }

  const tokenValue = rawHeaderValue.slice(7).trim()
  return tokenValue || null
}

function parseCookieHeader(cookieHeaderValue) {
  return String(cookieHeaderValue || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .reduce((cookieAccumulator, cookieEntry) => {
      const [rawCookieKey, ...rawCookieValueParts] = cookieEntry.split('=')
      const cookieKey = String(rawCookieKey || '').trim()

      if (!cookieKey) {
        return cookieAccumulator
      }

      cookieAccumulator[cookieKey] = rawCookieValueParts.join('=').trim()
      return cookieAccumulator
    }, {})
}

function resolveAdminSessionTokenFromRequest(request) {
  const bearerTokenValue = resolveBearerTokenFromHeader(request.headers.authorization)
  if (bearerTokenValue) {
    return bearerTokenValue
  }

  const parsedCookies = parseCookieHeader(request.headers.cookie)
  return parsedCookies[globalAdminSessionCookieName] || null
}

function createAdminSessionToken(username, nowTimestampProvider = Date.now) {
  const issuedAtInSeconds = Math.floor(nowTimestampProvider() / 1000)
  const expiresInSeconds = globalAdminAccessConfig.adminSessionDurationInMinutes * 60
  const expiresAtInSeconds = issuedAtInSeconds + expiresInSeconds

  const tokenHeader = {
    alg: 'HS256',
    typ: 'JWT',
  }

  const tokenPayload = {
    sub: username,
    scope: 'admin',
    iat: issuedAtInSeconds,
    exp: expiresAtInSeconds,
  }

  const encodedHeader = encodeToBase64Url(JSON.stringify(tokenHeader))
  const encodedPayload = encodeToBase64Url(JSON.stringify(tokenPayload))
  const unsignedTokenValue = `${encodedHeader}.${encodedPayload}`
  const tokenSignature = createHmacSha256Base64Url(unsignedTokenValue, resolveSessionSecret())

  return {
    sessionToken: `${unsignedTokenValue}.${tokenSignature}`,
    sessionExpiresAtInSeconds: expiresAtInSeconds,
  }
}

function hasRequiredCredentials(adminCredentials) {
  return Boolean(adminCredentials.username && adminCredentials.password && adminCredentials.verificationCode)
}

function resolveCurrentLoginAttemptState(clientIdentifier) {
  if (!globalLoginAttemptStateByClientIdentifier.has(clientIdentifier)) {
    globalLoginAttemptStateByClientIdentifier.set(clientIdentifier, {
      failureCount: 0,
      lockedUntilTimestamp: null,
    })
  }

  return globalLoginAttemptStateByClientIdentifier.get(clientIdentifier)
}

function resetLoginAttemptState(clientIdentifier) {
  globalLoginAttemptStateByClientIdentifier.set(clientIdentifier, {
    failureCount: 0,
    lockedUntilTimestamp: null,
  })
}

function resolveRateLimitStatus(clientIdentifier, nowTimestampProvider = Date.now) {
  const state = resolveCurrentLoginAttemptState(clientIdentifier)

  if (!state.lockedUntilTimestamp) {
    return {
      isLocked: false,
      remainingAttempts: globalMaxLoginAttempts - state.failureCount,
    }
  }

  const nowTimestamp = nowTimestampProvider()
  const isStillLocked = nowTimestamp < state.lockedUntilTimestamp

  if (!isStillLocked) {
    resetLoginAttemptState(clientIdentifier)
    return {
      isLocked: false,
      remainingAttempts: globalMaxLoginAttempts,
    }
  }

  const remainingLockoutSeconds = Math.ceil((state.lockedUntilTimestamp - nowTimestamp) / 1000)
  return {
    isLocked: true,
    remainingLockoutSeconds,
  }
}

function recordLoginFailure(clientIdentifier, nowTimestampProvider = Date.now) {
  const state = resolveCurrentLoginAttemptState(clientIdentifier)
  state.failureCount += 1

  if (state.failureCount >= globalMaxLoginAttempts) {
    state.lockedUntilTimestamp = nowTimestampProvider() + globalLockoutDurationInMs
  }
}

function areCredentialsValid(sanitizedAdminCredentials) {
  const expectedCredentials = resolveExpectedAdminCredentials()

  return (
    sanitizedAdminCredentials.username === expectedCredentials.username
    && sanitizedAdminCredentials.password === expectedCredentials.password
    && sanitizedAdminCredentials.verificationCode === expectedCredentials.verificationCode
  )
}

export function resolveClientIdentifier(request) {
  const forwardedHeader = String(request.headers['x-forwarded-for'] || '').trim()
  const forwardedClientIdentifier = forwardedHeader.split(',')[0]?.trim()

  if (forwardedClientIdentifier) {
    return forwardedClientIdentifier
  }

  return request.socket?.remoteAddress || 'unknown-client'
}

export function authenticateAdminCredentials(rawAdminCredentials, clientIdentifier) {
  const sanitizedAdminCredentials = {
    username: sanitizeCredentialValue(rawAdminCredentials.username),
    password: sanitizeCredentialValue(rawAdminCredentials.password),
    verificationCode: sanitizeCredentialValue(rawAdminCredentials.verificationCode),
  }

  const rateLimitStatus = resolveRateLimitStatus(clientIdentifier)
  if (rateLimitStatus.isLocked) {
    return {
      statusCode: 429,
      payload: {
        message: `Acesso bloqueado por excesso de tentativas. Tente novamente em ${rateLimitStatus.remainingLockoutSeconds}s.`,
      },
    }
  }

  if (!hasRequiredCredentials(sanitizedAdminCredentials)) {
    return {
      statusCode: 422,
      payload: {
        message: 'Credenciais administrativas incompletas.',
      },
    }
  }

  if (!areCredentialsValid(sanitizedAdminCredentials)) {
    recordLoginFailure(clientIdentifier)
    const updatedRateLimitStatus = resolveRateLimitStatus(clientIdentifier)

    if (updatedRateLimitStatus.isLocked) {
      return {
        statusCode: 429,
        payload: {
          message:
            `Acesso bloqueado após ${globalMaxLoginAttempts} tentativas. `
            + `Aguarde ${updatedRateLimitStatus.remainingLockoutSeconds}s.`,
        },
      }
    }

    return {
      statusCode: 401,
      payload: {
        message: `Falha na autenticação administrativa. Tentativas restantes: ${updatedRateLimitStatus.remainingAttempts}.`,
      },
    }
  }

  resetLoginAttemptState(clientIdentifier)

  const sessionData = createAdminSessionToken(sanitizedAdminCredentials.username)

  return {
    statusCode: 200,
    payload: {
      message: 'Acesso administrativo autorizado.',
      sessionToken: sessionData.sessionToken,
      sessionExpiresAtInSeconds: sessionData.sessionExpiresAtInSeconds,
      username: sanitizedAdminCredentials.username,
    },
  }
}

export function validateAdminSessionToken(rawSessionToken, nowTimestampProvider = Date.now) {
  try {
    const tokenParts = String(rawSessionToken || '').split('.')
    if (tokenParts.length !== 3) {
      return { isValid: false, reason: 'token-malformado' }
    }

    const [encodedHeader, encodedPayload, signatureValue] = tokenParts
    const unsignedTokenValue = `${encodedHeader}.${encodedPayload}`
    const expectedSignatureValue = createHmacSha256Base64Url(unsignedTokenValue, resolveSessionSecret())

    if (!compareSignatureSafely(signatureValue, expectedSignatureValue)) {
      return { isValid: false, reason: 'assinatura-invalida' }
    }

    const payloadObject = decodeBase64UrlJson(encodedPayload)
    const currentTimestampInSeconds = Math.floor(nowTimestampProvider() / 1000)

    if (typeof payloadObject.exp !== 'number' || payloadObject.exp <= currentTimestampInSeconds) {
      return { isValid: false, reason: 'token-expirado' }
    }

    if (payloadObject.scope !== 'admin') {
      return { isValid: false, reason: 'escopo-invalido' }
    }

    return {
      isValid: true,
      sessionData: {
        username: payloadObject.sub,
        expiresAtInSeconds: payloadObject.exp,
      },
    }
  } catch {
    return { isValid: false, reason: 'falha-decodificacao' }
  }
}

export function authorizeAdminSessionFromRequest(request) {
  const tokenValue = resolveAdminSessionTokenFromRequest(request)
  if (!tokenValue) {
    return { isAuthorized: false, statusCode: 401, message: 'Sessao administrativa ausente.' }
  }

  const tokenValidationResult = validateAdminSessionToken(tokenValue)

  if (!tokenValidationResult.isValid) {
    return { isAuthorized: false, statusCode: 401, message: 'Sessao administrativa invalida ou expirada.' }
  }

  return {
    isAuthorized: true,
    statusCode: 200,
    sessionData: tokenValidationResult.sessionData,
  }
}

export function createAdminSessionCookieValue(sessionToken) {
  const expiresInSeconds = globalAdminAccessConfig.adminSessionDurationInMinutes * 60
  const secureCookieSuffix = resolveIsSecureCookieEnabled() ? '; Secure' : ''

  return (
    `${globalAdminSessionCookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; `
    + `Max-Age=${expiresInSeconds}${secureCookieSuffix}`
  )
}

export function createAdminSessionCookieClearValue() {
  const secureCookieSuffix = resolveIsSecureCookieEnabled() ? '; Secure' : ''
  return `${globalAdminSessionCookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookieSuffix}`
}
