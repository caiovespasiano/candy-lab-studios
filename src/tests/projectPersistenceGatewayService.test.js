import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  loadPersistedArticleCatalogFromProject,
  persistArticleCatalogToProject,
  uploadArticleImageToProject,
} from '../services/projectPersistenceGatewayService'

describe('projectPersistenceGatewayService', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  test('whenLoadingCatalogThenCallsProjectArticlesEndpointWithGet', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ statusCode: 200, articleCatalog: [{ id: 'article-1' }] }),
    })

    const responsePayload = await loadPersistedArticleCatalogFromProject()

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/articles', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
    expect(responsePayload.articleCatalog[0].id).toBe('article-1')
  })

  test('whenPersistingCatalogThenSendsCatalogPayloadToProjectEndpoint', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ statusCode: 200, articleCatalog: [{ id: 'article-2' }] }),
    })

    const responsePayload = await persistArticleCatalogToProject([{ id: 'article-2' }])

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ articleCatalog: [{ id: 'article-2' }] }),
    })
    expect(responsePayload.statusCode).toBe(200)
  })

  test('whenPersistingCatalogThenIncludesCookieCredentialsForProtectedRoute', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ statusCode: 200, articleCatalog: [{ id: 'article-2' }] }),
    })

    await persistArticleCatalogToProject([{ id: 'article-2' }])

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ articleCatalog: [{ id: 'article-2' }] }),
    })
  })

  test('whenUploadingImageThenCallsUploadEndpointAndReturnsImageUrl', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ statusCode: 200, imageUrl: '/uploads/test.webp' }),
    })

    const responsePayload = await uploadArticleImageToProject({
      imageDataUrl: 'data:image/webp;base64,AAAA',
      sourceLabel: 'cover',
    })

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ imageDataUrl: 'data:image/webp;base64,AAAA', sourceLabel: 'cover' }),
    })
    expect(responsePayload.imageUrl).toBe('/uploads/test.webp')
  })

  test('whenApiReturnsFailureThenThrowsSanitizedErrorMessage', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Falha de persistencia.' }),
    })

    await expect(loadPersistedArticleCatalogFromProject()).rejects.toThrow('Falha de persistencia.')
  })
})
