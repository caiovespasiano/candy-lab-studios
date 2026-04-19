import { globalAdminAccessConfig } from '../constants/globalAdminAccessConfig'
import { internalRuntimeStorage } from './internalRuntimeStorageService'

const globalHexColorPattern = /^#[0-9a-fA-F]{6}$/
const globalFallbackBackgroundColor = '#ffffff'
const globalFallbackBackgroundImageUrl = ''
const globalFallbackYellowThemeColor = '#ffdf85'
const globalAllowedAbsoluteBackgroundImageProtocolCatalog = ['http:', 'https:']

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

function sanitizeBackgroundImageUrl(rawBackgroundImageUrl) {
  const normalizedBackgroundImageUrl = String(rawBackgroundImageUrl || '').trim()

  if (!normalizedBackgroundImageUrl) {
    return globalFallbackBackgroundImageUrl
  }

  if (normalizedBackgroundImageUrl.startsWith('/')) {
    return normalizedBackgroundImageUrl
  }

  try {
    const resolvedAbsoluteUrl = new URL(normalizedBackgroundImageUrl)
    if (!globalAllowedAbsoluteBackgroundImageProtocolCatalog.includes(resolvedAbsoluteUrl.protocol)) {
      return globalFallbackBackgroundImageUrl
    }

    return normalizedBackgroundImageUrl
  } catch {
    return globalFallbackBackgroundImageUrl
  }
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

export function loadPersistedGlobalBackgroundImageUrl(storageClient) {
  const storage = resolveStorage(storageClient)
  const persistedBackgroundImageUrl = storage.getItem(globalAdminAccessConfig.adminBackgroundImageStorageKey)

  return sanitizeBackgroundImageUrl(persistedBackgroundImageUrl)
}

export function persistGlobalBackgroundImageUrl(backgroundImageUrlValue, storageClient) {
  const storage = resolveStorage(storageClient)
  const safeBackgroundImageUrl = sanitizeBackgroundImageUrl(backgroundImageUrlValue)

  storage.setItem(globalAdminAccessConfig.adminBackgroundImageStorageKey, safeBackgroundImageUrl)
  return safeBackgroundImageUrl
}

export function applyGlobalBackgroundImageUrl(backgroundImageUrlValue, documentReference = document) {
  const safeBackgroundImageUrl = sanitizeBackgroundImageUrl(backgroundImageUrlValue)

  if (!safeBackgroundImageUrl) {
    documentReference.body.style.backgroundImage = 'none'
    documentReference.body.style.backgroundRepeat = ''
    documentReference.body.style.backgroundSize = ''
    documentReference.body.style.backgroundPosition = ''
    documentReference.body.style.backgroundAttachment = ''
    return safeBackgroundImageUrl
  }

  const escapedBackgroundImageUrl = safeBackgroundImageUrl.replaceAll('"', '%22')
  documentReference.body.style.backgroundImage = `url("${escapedBackgroundImageUrl}")`
  documentReference.body.style.backgroundRepeat = 'no-repeat'
  documentReference.body.style.backgroundSize = 'cover'
  documentReference.body.style.backgroundPosition = 'center center'
  documentReference.body.style.backgroundAttachment = 'fixed'
  return safeBackgroundImageUrl
}

export function loadPersistedGlobalYellowThemeHexColor(storageClient) {
  const storage = resolveStorage(storageClient)
  const persistedYellowThemeHexColor = storage.getItem(globalAdminAccessConfig.adminGlobalYellowColorStorageKey)

  if (!isValidHexColor(persistedYellowThemeHexColor)) {
    return globalFallbackYellowThemeColor
  }

  return persistedYellowThemeHexColor
}

export function persistGlobalYellowThemeHexColor(yellowThemeHexColorValue, storageClient) {
  const storage = resolveStorage(storageClient)
  const safeYellowThemeHexColor = isValidHexColor(yellowThemeHexColorValue)
    ? yellowThemeHexColorValue
    : globalFallbackYellowThemeColor

  storage.setItem(globalAdminAccessConfig.adminGlobalYellowColorStorageKey, safeYellowThemeHexColor)
  return safeYellowThemeHexColor
}

export function applyGlobalYellowThemeHexColor(yellowThemeHexColorValue, documentReference = document) {
  const safeYellowThemeHexColor = isValidHexColor(yellowThemeHexColorValue)
    ? yellowThemeHexColorValue
    : globalFallbackYellowThemeColor

  documentReference.documentElement.style.setProperty('--color-pastelYellow', safeYellowThemeHexColor)
  return safeYellowThemeHexColor
}