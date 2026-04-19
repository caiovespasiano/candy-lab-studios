import { describe, expect, test } from 'vitest'
import { resolveApiRateLimitResult } from '../../server/apiRateLimitService'

describe('resolveApiRateLimitResult', () => {
  test('whenRequestUsesDefaultRouteThenReturnsDefaultRemainingRequests', () => {
    const result = resolveApiRateLimitResult({
      clientIdentifier: 'test-client-default-route',
      requestMethod: 'GET',
      requestPathName: '/api/health',
      nowTimestampProvider: () => 1_000,
    })

    expect(result.isRateLimited).toBe(false)
    expect(result.remainingRequests).toBe(599)
  })

  test('whenCatalogRequestCountIsWithinDedicatedLimitThenReturnsNotRateLimited', () => {
    const result = resolveApiRateLimitResult({
      clientIdentifier: 'test-client-within-catalog-limit',
      requestMethod: 'GET',
      requestPathName: '/api/admin/articles',
      nowTimestampProvider: () => 5_000,
    })

    expect(result.isRateLimited).toBe(false)
    expect(result.remainingRequests).toBe(5_999)
  })

  test('whenCatalogRequestCountExceedsDedicatedLimitThenReturnsRateLimited', () => {
    let lastResult = null

    for (let requestIndex = 0; requestIndex < 6_001; requestIndex += 1) {
      lastResult = resolveApiRateLimitResult({
        clientIdentifier: 'test-client-catalog-over-limit',
        requestMethod: 'GET',
        requestPathName: '/api/admin/articles',
        nowTimestampProvider: () => 5_000,
      })
    }

    expect(lastResult.isRateLimited).toBe(true)
    expect(lastResult.retryAfterSeconds).toBeGreaterThan(0)
  })

  test('whenClockMovesBackwardsThenResetsWindowAndAvoidsPermanent429', () => {
    for (let requestIndex = 0; requestIndex < 6_001; requestIndex += 1) {
      resolveApiRateLimitResult({
        clientIdentifier: 'test-client-backward-clock',
        requestMethod: 'GET',
        requestPathName: '/api/admin/articles',
        nowTimestampProvider: () => 20_000,
      })
    }

    const resultAfterClockRollback = resolveApiRateLimitResult({
      clientIdentifier: 'test-client-backward-clock',
      requestMethod: 'GET',
      requestPathName: '/api/admin/articles',
      nowTimestampProvider: () => 10_000,
    })

    expect(resultAfterClockRollback.isRateLimited).toBe(false)
    expect(resultAfterClockRollback.remainingRequests).toBe(5_999)
  })
})
