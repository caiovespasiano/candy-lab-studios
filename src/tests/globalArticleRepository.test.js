import { describe, expect, test } from 'vitest'
import {
  loadPersistedArticleCatalog,
  persistArticleCatalog,
} from '../repositories/articles/globalArticleRepository'

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

describe('globalArticleRepository', () => {
  test('whenNoPersistedCatalogExistsThenLoadReturnsSeedCatalog', () => {
    const storageClient = createInMemoryStorageClient()

    const articleCatalog = loadPersistedArticleCatalog(storageClient)

    expect(Array.isArray(articleCatalog)).toBe(true)
    expect(articleCatalog.length).toBeGreaterThan(0)
  })

  test('whenCatalogIsPersistedThenLoadReturnsPersistedCatalog', () => {
    const storageClient = createInMemoryStorageClient()
    const persistedCatalog = [
      {
        id: 'article-1',
        title: 'Artigo 1',
        subtitle: 'Sub 1',
        description: 'Descricao 1',
        imageUrl: 'https://example.com/1.png',
        imageAlternativeText: 'Imagem 1',
        galleryImageUrls: ['https://example.com/1.png'],
        likeCount: 0,
        isPublished: true,
        orderIndex: 0,
      },
    ]

    persistArticleCatalog(persistedCatalog, storageClient)
    const loadedCatalog = loadPersistedArticleCatalog(storageClient)

    expect(loadedCatalog[0].title).toBe('Artigo 1')
    expect(loadedCatalog[0].isPublished).toBe(true)
  })
})
