import { mapHttpStatusToSanitizedErrorResponse } from '../network/httpStatusErrorMapper'
import { sanitizeTextContent } from '../security/sanitizeTextContent'

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
    const sanitizedAdminCredentials = sanitizeAdminCredentials(rawAdminCredentials)

    if (!hasRequiredAdminCredentials(sanitizedAdminCredentials)) {
      return mapHttpStatusToSanitizedErrorResponse(422, correlationIdentifier)
    }

    const gatewayResponse = await adminAuthenticationGatewayClient.requestAdminAuthentication(sanitizedAdminCredentials)
    const normalizedStatusCode = Number(gatewayResponse.statusCode)

    if (normalizedStatusCode >= 400) {
      const baseErrorResponse = mapHttpStatusToSanitizedErrorResponse(normalizedStatusCode, correlationIdentifier)

      return {
        ...baseErrorResponse,
        publicMessage: gatewayResponse.payload?.message || baseErrorResponse.publicMessage,
      }
    }

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