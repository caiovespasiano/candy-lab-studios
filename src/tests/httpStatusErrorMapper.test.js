import { describe, expect, test } from 'vitest'
import { mapHttpStatusToSanitizedErrorResponse } from '../network/httpStatusErrorMapper'

describe('mapHttpStatusToSanitizedErrorResponse', () => {
  test('whenHttpStatusCodeIsKnownThenReturnsMappedPublicMessage', () => {
    const mappedErrorResponse = mapHttpStatusToSanitizedErrorResponse(404, 'trace-01')

    expect(mappedErrorResponse).toEqual({
      statusCode: 404,
      publicMessage: 'O recurso solicitado não foi encontrado.',
      correlationIdentifier: 'trace-01',
    })
  })

  test('whenHttpStatusCodeIsUnknownThenReturnsFallbackMessage', () => {
    const mappedErrorResponse = mapHttpStatusToSanitizedErrorResponse(499, 'trace-02')

    expect(mappedErrorResponse.publicMessage).toBe('Erro inesperado durante o processamento da solicitação.')
  })

  test('whenCorrelationIdentifierIsNotProvidedThenReturnsSafeDefaultIdentifier', () => {
    const mappedErrorResponse = mapHttpStatusToSanitizedErrorResponse(500)

    expect(mappedErrorResponse.correlationIdentifier).toBe('correlation-id-not-provided')
  })
})
