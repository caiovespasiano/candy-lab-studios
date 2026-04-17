import { describe, expect, test, vi } from 'vitest'
import { submitContactMessageUsingGateway } from '../services/contactSubmissionService'

describe('submitContactMessageUsingGateway', () => {
  test('whenGatewayRespondsSuccessfullyThenReturnsSuccessAndSanitizedPayload', async () => {
    const sendContactMessageSpy = vi.fn().mockResolvedValue({
      statusCode: 201,
      payload: { message: 'Contato enviado com sucesso.' },
    })
    const mockedGatewayClient = { sendContactMessage: sendContactMessageSpy }

    const contactResponse = await submitContactMessageUsingGateway(
      {
        fullName: '<script>Ana</script>',
        emailAddress: 'ana@example.com',
        messageBody: '<img src=x onerror=alert(1)>Preciso de orçamento',
      },
      mockedGatewayClient,
      'trace-100'
    )

    expect(contactResponse.statusCode).toBe(201)
    expect(contactResponse.publicMessage).toBe('Contato enviado com sucesso.')
    expect(sendContactMessageSpy).toHaveBeenCalledWith({
      fullName: 'Ana',
      emailAddress: 'ana@example.com',
      messageBody: 'Preciso de orçamento',
    })
  })

  test('whenGatewayReturnsFailureThenMapsToSanitizedErrorResponse', async () => {
    const mockedGatewayClient = {
      sendContactMessage: vi.fn().mockResolvedValue({ statusCode: 429, payload: {} }),
    }

    const contactResponse = await submitContactMessageUsingGateway(
      { fullName: 'Ana', emailAddress: 'ana@example.com', messageBody: 'Oi' },
      mockedGatewayClient,
      'trace-200'
    )

    expect(contactResponse.statusCode).toBe(429)
    expect(contactResponse.publicMessage).toBe('Limite de requisições atingido. Aguarde e tente novamente.')
  })
})
