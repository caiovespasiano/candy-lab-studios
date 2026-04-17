import { describe, expect, test } from 'vitest'
import {
  createAdminSessionToken,
  parseAndValidateAdminSessionToken,
} from '../services/adminSessionTokenService'

describe('adminSessionTokenService', () => {
  test('whenTokenIsGeneratedThenValidationReturnsAuthenticatedSessionData', () => {
    const nowTimestampValue = 1_700_000_000_000
    const sessionToken = createAdminSessionToken({ username: 'admin' }, () => nowTimestampValue)

    const validationResult = parseAndValidateAdminSessionToken(sessionToken, () => nowTimestampValue)

    expect(validationResult.isValid).toBe(true)
    expect(validationResult.sessionData.username).toBe('admin')
    expect(validationResult.sessionData.expiresAtInSeconds).toBeGreaterThan(0)
  })

  test('whenTokenIsExpiredThenValidationReturnsInvalidState', () => {
    const nowTimestampValue = 1_700_000_000_000
    const sessionToken = createAdminSessionToken({ username: 'admin' }, () => nowTimestampValue)
    const futureTimestampValue = nowTimestampValue + 3_600_000

    const validationResult = parseAndValidateAdminSessionToken(sessionToken, () => futureTimestampValue)

    expect(validationResult.isValid).toBe(false)
    expect(validationResult.reason).toBe('token-expirado')
  })

  test('whenTokenHasInvalidSignatureThenValidationRejectsSession', () => {
    const sessionToken = createAdminSessionToken({ username: 'admin' }, () => 1_700_000_000_000)
    const [headerPart, payloadPart] = sessionToken.split('.')
    const tamperedToken = `${headerPart}.${payloadPart}.assinatura-invalida`

    const validationResult = parseAndValidateAdminSessionToken(tamperedToken)

    expect(validationResult.isValid).toBe(false)
    expect(validationResult.reason).toBe('assinatura-invalida')
  })
})
