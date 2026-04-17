import { describe, expect, test } from 'vitest'
import {
  applyGlobalBackgroundHexColor,
  loadPersistedGlobalBackgroundHexColor,
  persistGlobalBackgroundHexColor,
} from '../services/globalBackgroundPreferencesService'

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

describe('globalBackgroundPreferencesService', () => {
  test('whenValidHexColorIsPersistedThenReturnsSameHexColor', () => {
    const storageClient = createInMemoryStorageClient()

    const persistedHexColor = persistGlobalBackgroundHexColor('#112233', storageClient)

    expect(persistedHexColor).toBe('#112233')
    expect(loadPersistedGlobalBackgroundHexColor(storageClient)).toBe('#112233')
  })

  test('whenInvalidHexColorIsPersistedThenUsesFallbackColor', () => {
    const storageClient = createInMemoryStorageClient()

    const persistedHexColor = persistGlobalBackgroundHexColor('invalid-color', storageClient)

    expect(persistedHexColor).toBe('#ffffff')
    expect(loadPersistedGlobalBackgroundHexColor(storageClient)).toBe('#ffffff')
  })

  test('whenBackgroundColorIsAppliedThenDocumentBodyReceivesSafeColor', () => {
    const fakeDocument = { body: { style: { backgroundColor: '' } } }

    const appliedHexColor = applyGlobalBackgroundHexColor('#445566', fakeDocument)

    expect(appliedHexColor).toBe('#445566')
    expect(fakeDocument.body.style.backgroundColor).toBe('#445566')
  })
})
