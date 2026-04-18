import { mapHttpStatusToSanitizedErrorResponse } from '../network/httpStatusErrorMapper'
import { sanitizeTextContent } from '../security/sanitizeTextContent'

const globalMaxLoginAttempts = 5
const globalLockoutDurationInMs = 15 * 60 * 1000

const loginAttemptState = {
  failureCount: 0,
  lockedUntilTimestamp: null,
}

function recordLoginFailure() {
  loginAttemptState.failureCount += 1

  if (loginAttemptState.failureCount >= globalMaxLoginAttempts) {
    loginAttemptState.lockedUntilTimestamp = Date.now() + globalLockoutDurationInMs
  }
}

function resetLoginAttemptState() {
  loginAttemptState.failureCount = 0
  loginAttemptState.lockedUntilTimestamp = null
}

function resolveLoginRateLimitStatus() {
  if (!loginAttemptState.lockedUntilTimestamp) {
    return { isLocked: false, remainingAttempts: globalMaxLoginAttempts - loginAttemptState.failureCount }
  }

  const isStillLocked = Date.now() < loginAttemptState.lockedUntilTimestamp

  if (!isStillLocked) {
    resetLoginAttemptState()
    return { isLocked: false, remainingAttempts: globalMaxLoginAttempts }
  }

  const remainingLockoutSeconds = Math.ceil((loginAttemptState.lockedUntilTimestamp - Date.now()) / 1000)
  return { isLocked: true, remainingLockoutSeconds }
}

function sanitizeAdminCredentials(rawAdminCredentials) {
  return {
    username: sanitizeTextContent(rawAdminCredentials.username),
    password: sanitizeTextContent(rawAdminCredentials.password),
    verificationCode: sanitizeTextContent(rawAdminCredentials.verificationCode),
  }
}

function hasRequiredAdminCredentials(adminCredentials) {
  return Boolean(adminCredentials.username && adminCredentials.password && adminCredentials.verificationCode)
}

export async function requestAdminAuthenticationUsingGateway(
  rawAdminCredentials,
  adminAuthenticationGatewayClient,
  correlationIdentifier
) {
  try {
    const rateLimitStatus = resolveLoginRateLimitStatus()

    if (rateLimitStatus.isLocked) {
      return {
        ...mapHttpStatusToSanitizedErrorResponse(429, correlationIdentifier),
        publicMessage: `Acesso bloqueado por excesso de tentativas. Tente novamente em ${rateLimitStatus.remainingLockoutSeconds}s.`,
      }
    }

    const sanitizedAdminCredentials = sanitizeAdminCredentials(rawAdminCredentials)

    if (!hasRequiredAdminCredentials(sanitizedAdminCredentials)) {
      return mapHttpStatusToSanitizedErrorResponse(422, correlationIdentifier)
    }

    const gatewayResponse = await adminAuthenticationGatewayClient.requestAdminAuthentication(sanitizedAdminCredentials)
    const normalizedStatusCode = Number(gatewayResponse.statusCode)

    if (normalizedStatusCode >= 400) {
      recordLoginFailure()
      const updatedRateLimitStatus = resolveLoginRateLimitStatus()
      const baseErrorResponse = mapHttpStatusToSanitizedErrorResponse(normalizedStatusCode, correlationIdentifier)

      if (updatedRateLimitStatus.isLocked) {
        return {
          ...baseErrorResponse,
          publicMessage: `Acesso bloqueado após ${globalMaxLoginAttempts} tentativas. Aguarde ${updatedRateLimitStatus.remainingLockoutSeconds}s.`,
        }
      }

      return {
        ...baseErrorResponse,
        publicMessage: `${baseErrorResponse.publicMessage} Tentativas restantes: ${updatedRateLimitStatus.remainingAttempts}.`,
      }
    }

    resetLoginAttemptState()

    return {
      statusCode: normalizedStatusCode,
      publicMessage: gatewayResponse.payload.message,
      correlationIdentifier,
      sessionToken: gatewayResponse.payload.sessionToken,
      sessionExpiresAtInSeconds: gatewayResponse.payload.sessionExpiresAtInSeconds,
      username: gatewayResponse.payload.username,
    }
  } catch (unknownError) {
    const fallbackStatusCode = Number(unknownError?.statusCode) || 500
    return mapHttpStatusToSanitizedErrorResponse(fallbackStatusCode, correlationIdentifier)
  }
}