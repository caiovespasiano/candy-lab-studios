import { describe, expect, test, vi } from 'vitest'
import { requestAdminAuthenticationUsingGateway } from '../services/adminAuthenticationService'

describe('requestAdminAuthenticationUsingGateway', () => {
  test('whenCredentialsAreValidThenReturnsAuthorizedSessionPayload', async () => {
    const mockedGatewayClient = {
      requestAdminAuthentication: vi.fn().mockResolvedValue({
        statusCode: 200,
        payload: {
          message: 'Acesso autorizado.',
          sessionToken: 'token-abc',
          sessionExpiresAtInSeconds: 1_700_000_100,
          username: 'admin',
        },
      }),
    }

    const response = await requestAdminAuthenticationUsingGateway(
      {
        username: 'admin',
        password: 'admin123',
        verificationCode: '2026',
      },
      mockedGatewayClient,
      'admin-correlation-100'
    )

    expect(response.statusCode).toBe(200)
    expect(response.sessionToken).toBe('token-abc')
    expect(response.username).toBe('admin')
  })

  test('whenCredentialsContainMaliciousMarkupThenGatewayReceivesSanitizedPayload', async () => {
    const mockedGatewayClient = {
      requestAdminAuthentication: vi.fn().mockResolvedValue({
        statusCode: 200,
        payload: {
          message: 'Acesso autorizado.',
          sessionToken: 'token-abc',
          sessionExpiresAtInSeconds: 1_700_000_100,
          username: 'admin',
        },
      }),
    }

    await requestAdminAuthenticationUsingGateway(
      {
        username: '<script>admin</script>',
        password: '<b>admin123</b>',
        verificationCode: '<img src=x onerror=1>2026',
      },
      mockedGatewayClient,
      'admin-correlation-200'
    )

    expect(mockedGatewayClient.requestAdminAuthentication).toHaveBeenCalledWith({
      username: 'admin',
      password: 'admin123',
      verificationCode: '2026',
    })
  })

  test('whenAnyCredentialIsMissingThenReturnsValidationErrorWithoutCallingGateway', async () => {
    const mockedGatewayClient = {
      requestAdminAuthentication: vi.fn(),
    }

    const response = await requestAdminAuthenticationUsingGateway(
      {
        username: 'admin',
        password: '',
        verificationCode: '2026',
      },
      mockedGatewayClient,
      'admin-correlation-300'
    )

    expect(response.statusCode).toBe(422)
    expect(mockedGatewayClient.requestAdminAuthentication).not.toHaveBeenCalled()
  })
})
