import { globalAdminAccessConfig } from '../constants/globalAdminAccessConfig'
import { parseAndValidateAdminSessionToken } from './adminSessionTokenService'

function resolveStorage(storageClient) {
  return storageClient ?? window.localStorage
}

export function persistAdminSessionToken(sessionToken, storageClient) {
  const storage = resolveStorage(storageClient)
  storage.setItem(globalAdminAccessConfig.adminSessionStorageKey, String(sessionToken || ''))
}

export function clearPersistedAdminSessionToken(storageClient) {
  const storage = resolveStorage(storageClient)
  storage.removeItem(globalAdminAccessConfig.adminSessionStorageKey)
}

export async function restoreValidAdminSessionData(storageClient, nowTimestampProvider = Date.now) {
  const storage = resolveStorage(storageClient)
  const persistedToken = storage.getItem(globalAdminAccessConfig.adminSessionStorageKey)

  if (!persistedToken) {
    return { isAuthenticated: false }
  }

  const tokenValidationResult = await parseAndValidateAdminSessionToken(persistedToken, nowTimestampProvider)

  if (!tokenValidationResult.isValid) {
    clearPersistedAdminSessionToken(storage)
    return { isAuthenticated: false }
  }

  return {
    isAuthenticated: true,
    sessionToken: persistedToken,
    sessionData: tokenValidationResult.sessionData,
  }
}