import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  clearPersistedAdminSessionToken,
  persistAdminSessionToken,
  restoreValidAdminSessionData,
} from '../services/adminAccessSessionService'

describe('adminAccessSessionService', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  test('whenSessionEndpointReturnsValidSessionThenRestoreReturnsAuthenticatedSession', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        statusCode: 200,
        username: 'admin',
        sessionExpiresAtInSeconds: 1_700_000_100,
      }),
    })

    const restoredSessionData = await restoreValidAdminSessionData()

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/session', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
    expect(restoredSessionData.isAuthenticated).toBe(true)
    expect(restoredSessionData.sessionData.username).toBe('admin')
  })

  test('whenSessionEndpointReturnsUnauthorizedThenRestoreReturnsUnauthenticatedState', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ statusCode: 401 }),
    })

    const restoredSessionData = await restoreValidAdminSessionData()

    expect(restoredSessionData.isAuthenticated).toBe(false)
  })

  test('whenSessionIsClearedThenLogoutEndpointIsCalledWithCookieCredentials', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ statusCode: 200 }),
    })

    await clearPersistedAdminSessionToken()

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/logout', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
  })

  test('whenPersistingSessionThenReturnsNoOpSuccess', async () => {
    const persistResult = await persistAdminSessionToken('token-ignored')
    expect(persistResult.isPersisted).toBe(true)
  })
})
