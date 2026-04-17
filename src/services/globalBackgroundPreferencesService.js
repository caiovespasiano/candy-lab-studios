import { globalAdminAccessConfig } from '../constants/globalAdminAccessConfig'

const globalHexColorPattern = /^#[0-9a-fA-F]{6}$/
const globalFallbackBackgroundColor = '#ffffff'

function resolveStorage(storageClient) {
  return storageClient ?? window.localStorage
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