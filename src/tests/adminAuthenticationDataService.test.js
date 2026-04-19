import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  assertAdminAuthenticationSecurityConfiguration,
  authenticateAdminCredentials,
} from '../../server/adminAuthenticationDataService.js'

function clearAdminEnvironmentVariables() {
  vi.stubEnv('VITE_ADMIN_USERNAME', '')
  vi.stubEnv('VITE_ADMIN_PASSWORD', '')
  vi.stubEnv('VITE_ADMIN_VERIFICATION_CODE', '')
  vi.stubEnv('VITE_ADMIN_SESSION_SECRET', '')
  vi.stubEnv('ADMIN_USERNAME', '')
  vi.stubEnv('ADMIN_PASSWORD', '')
  vi.stubEnv('ADMIN_VERIFICATION_CODE', '')
  vi.stubEnv('ADMIN_SESSION_SECRET', '')
}

describe('adminAuthenticationDataService production hardening', () => {
  beforeEach(() => {
    clearAdminEnvironmentVariables()
    vi.stubEnv('NODE_ENV', 'test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('whenProductionWithoutMandatoryCredentialsThenThrowsConfigurationError', () => {
    vi.stubEnv('NODE_ENV', 'production')

    expect(() => {
      authenticateAdminCredentials(
        { username: 'admin', password: 'admin123', verificationCode: '2026' },
        'client-100'
      )
    }).toThrow('Configuracao obrigatoria ausente em producao')
  })

  test('whenProductionWithShortSessionSecretThenThrowsConfigurationError', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITE_ADMIN_USERNAME', 'secure-admin')
    vi.stubEnv('VITE_ADMIN_PASSWORD', 'secure-password-2026')
    vi.stubEnv('VITE_ADMIN_VERIFICATION_CODE', '9090')
    vi.stubEnv('VITE_ADMIN_SESSION_SECRET', 'short-secret')

    expect(() => {
      authenticateAdminCredentials(
        { username: 'secure-admin', password: 'secure-password-2026', verificationCode: '9090' },
        'client-200'
      )
    }).toThrow('Segredo de sessao em producao deve conter ao menos')
  })

  test('whenProductionWithSafeEnvironmentThenAuthenticatesSuccessfully', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITE_ADMIN_USERNAME', 'secure-admin')
    vi.stubEnv('VITE_ADMIN_PASSWORD', 'secure-password-2026')
    vi.stubEnv('VITE_ADMIN_VERIFICATION_CODE', '9090')
    vi.stubEnv('VITE_ADMIN_SESSION_SECRET', 'secure-session-secret-2026-with-at-least-32-chars')

    const authenticationResult = authenticateAdminCredentials(
      { username: 'secure-admin', password: 'secure-password-2026', verificationCode: '9090' },
      'client-300'
    )

    expect(authenticationResult.statusCode).toBe(200)
    expect(authenticationResult.payload.sessionToken).toBeTypeOf('string')
  })

  test('whenProductionUsesAdminAliasVariablesThenStartupSecurityAssertionPasses', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ADMIN_USERNAME', 'secure-admin-alias')
    vi.stubEnv('ADMIN_PASSWORD', 'secure-password-alias-2026')
    vi.stubEnv('ADMIN_VERIFICATION_CODE', '8080')
    vi.stubEnv('ADMIN_SESSION_SECRET', 'another-secure-session-secret-with-32-plus')

    expect(() => {
      assertAdminAuthenticationSecurityConfiguration()
    }).not.toThrow()
  })
})
