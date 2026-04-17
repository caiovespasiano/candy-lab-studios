import { describe, expect, test } from 'vitest'
import {
  clearPersistedAdminSessionToken,
  persistAdminSessionToken,
  restoreValidAdminSessionData,
} from '../services/adminAccessSessionService'
import { createAdminSessionToken } from '../services/adminSessionTokenService'

function createInMemoryStorageClient() {
  const storageRecord = new Map()

  return {
    getItem(keyName) {
      return storageRecord.has(keyName) ? storageRecord.get(keyName) : null
    },
    setItem(keyName, value) {
      storageRecord.set(keyName, value)
    },
    removeItem(keyName) {
      storageRecord.delete(keyName)
    },
  }
}

describe('adminAccessSessionService', () => {
  test('whenValidTokenIsPersistedThenRestoreReturnsAuthenticatedSession', () => {
    const storageClient = createInMemoryStorageClient()
    const nowTimestampValue = 1_700_000_000_000
    const sessionToken = createAdminSessionToken({ username: 'admin' }, () => nowTimestampValue)

    persistAdminSessionToken(sessionToken, storageClient)
    const restoredSessionData = restoreValidAdminSessionData(storageClient, () => nowTimestampValue)

    expect(restoredSessionData.isAuthenticated).toBe(true)
    expect(restoredSessionData.sessionData.username).toBe('admin')
  })

  test('whenPersistedTokenIsInvalidThenRestoreReturnsUnauthenticatedState', () => {
    const storageClient = createInMemoryStorageClient()

    persistAdminSessionToken('token-invalido', storageClient)
    const restoredSessionData = restoreValidAdminSessionData(storageClient)

    expect(restoredSessionData.isAuthenticated).toBe(false)
  })

  test('whenSessionIsClearedThenRestoreReturnsUnauthenticatedState', () => {
    const storageClient = createInMemoryStorageClient()
    const sessionToken = createAdminSessionToken({ username: 'admin' })

    persistAdminSessionToken(sessionToken, storageClient)
    clearPersistedAdminSessionToken(storageClient)
    const restoredSessionData = restoreValidAdminSessionData(storageClient)

    expect(restoredSessionData.isAuthenticated).toBe(false)
  })
})
