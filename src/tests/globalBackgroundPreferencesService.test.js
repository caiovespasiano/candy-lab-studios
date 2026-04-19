import { describe, expect, test } from 'vitest'
import {
  applyGlobalBackgroundImageUrl,
  applyGlobalBackgroundHexColor,
  loadPersistedGlobalBackgroundImageUrl,
  loadPersistedGlobalBackgroundHexColor,
  persistGlobalBackgroundImageUrl,
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

  test('whenValidBackgroundImageUrlIsPersistedThenReturnsSameUrl', () => {
    const storageClient = createInMemoryStorageClient()

    const persistedImageUrl = persistGlobalBackgroundImageUrl('/background/background.jpg', storageClient)

    expect(persistedImageUrl).toBe('/background/background.jpg')
    expect(loadPersistedGlobalBackgroundImageUrl(storageClient)).toBe('/background/background.jpg')
  })

  test('whenInvalidBackgroundImageUrlIsPersistedThenUsesEmptyFallback', () => {
    const storageClient = createInMemoryStorageClient()

    const persistedImageUrl = persistGlobalBackgroundImageUrl('javascript:alert(1)', storageClient)

    expect(persistedImageUrl).toBe('')
    expect(loadPersistedGlobalBackgroundImageUrl(storageClient)).toBe('')
  })

  test('whenBackgroundImageIsAppliedThenDocumentBodyReceivesCoverImageStyles', () => {
    const fakeDocument = {
      body: {
        style: {
          backgroundImage: '',
          backgroundRepeat: '',
          backgroundSize: '',
          backgroundPosition: '',
          backgroundAttachment: '',
        },
      },
    }

    const appliedImageUrl = applyGlobalBackgroundImageUrl('/background/background.jpg', fakeDocument)

    expect(appliedImageUrl).toBe('/background/background.jpg')
    expect(fakeDocument.body.style.backgroundImage).toBe('url("/background/background.jpg")')
    expect(fakeDocument.body.style.backgroundRepeat).toBe('no-repeat')
    expect(fakeDocument.body.style.backgroundSize).toBe('cover')
    expect(fakeDocument.body.style.backgroundPosition).toBe('center center')
    expect(fakeDocument.body.style.backgroundAttachment).toBe('fixed')
  })
})
