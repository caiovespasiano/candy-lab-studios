import { mapHttpStatusToSanitizedErrorResponse } from '../network/httpStatusErrorMapper'
import { sanitizeTextContent } from '../security/sanitizeTextContent'

export async function submitContactMessageUsingGateway(rawContactPayload, contactGatewayClient, correlationIdentifier) {
  try {
    const sanitizedContactPayload = {
      fullName: sanitizeTextContent(rawContactPayload.fullName),
      emailAddress: sanitizeTextContent(rawContactPayload.emailAddress),
      messageBody: sanitizeTextContent(rawContactPayload.messageBody),
    }

    const gatewayResponse = await contactGatewayClient.sendContactMessage(sanitizedContactPayload)
    const normalizedGatewayStatusCode = Number(gatewayResponse.statusCode)

    if (normalizedGatewayStatusCode >= 400) {
      return mapHttpStatusToSanitizedErrorResponse(normalizedGatewayStatusCode, correlationIdentifier)
    }

    return {
      statusCode: normalizedGatewayStatusCode,
      publicMessage: gatewayResponse.payload.message,
      correlationIdentifier,
    }
  } catch (unknownError) {
    const fallbackStatusCode = Number(unknownError?.statusCode) || 500
    return mapHttpStatusToSanitizedErrorResponse(fallbackStatusCode, correlationIdentifier)
  }
}
