import { globalAdminAccessConfig } from '../constants/globalAdminAccessConfig'
import { internalRuntimeStorage } from './internalRuntimeStorageService'

const globalHexColorPattern = /^#[0-9a-fA-F]{6}$/
const globalFallbackBackgroundColor = '#ffffff'

function resolveBrowserLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  try {
    const testStorageKey = '__dimi3d-background-storage-check__'
    window.localStorage.setItem(testStorageKey, 'ok')
    window.localStorage.removeItem(testStorageKey)
    return window.localStorage
  } catch {
    return null
  }
}

function resolveStorage(storageClient) {
  if (storageClient) {
    return storageClient
  }

  const browserLocalStorage = resolveBrowserLocalStorage()
  if (browserLocalStorage) {
    return browserLocalStorage
  }

  return internalRuntimeStorage
}

function isValidHexColor(hexColorValue) {
  return globalHexColorPattern.test(String(hexColorValue || ''))
}

export function loadPersistedGlobalBackgroundHexColor(storageClient) {
  const storage = resolveStorage(storageClient)
  const persistedHexColor = storage.getItem(globalAdminAccessConfig.adminBackgroundStorageKey)

  if (!isValidHexColor(persistedHexColor)) {
    return globalFallbackBackgroundColor
  }

  return persistedHexColor
}

export function persistGlobalBackgroundHexColor(backgroundHexColorValue, storageClient) {
  const storage = resolveStorage(storageClient)
  const safeHexColorValue = isValidHexColor(backgroundHexColorValue)
    ? backgroundHexColorValue
    : globalFallbackBackgroundColor

  storage.setItem(globalAdminAccessConfig.adminBackgroundStorageKey, safeHexColorValue)
  return safeHexColorValue
}

export function applyGlobalBackgroundHexColor(backgroundHexColorValue, documentReference = document) {
  const safeHexColorValue = isValidHexColor(backgroundHexColorValue)
    ? backgroundHexColorValue
    : globalFallbackBackgroundColor

  documentReference.body.style.backgroundColor = safeHexColorValue
  return safeHexColorValue
}