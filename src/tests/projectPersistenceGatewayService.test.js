import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  loadProjectPreferencesFromProject,
  loadUploadedImageCatalogFromProject,
  loadPersistedArticleCatalogFromProject,
  persistProjectPreferencesToProject,
  persistArticleCatalogToProject,
  uploadArticleImageToProject,
} from '../services/projectPersistenceGatewayService'

describe('projectPersistenceGatewayService', () => {
  const originalFetch = globalThis.fetch
  const originalDateNow = Date.now

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    Date.now = originalDateNow
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

  test('whenLoadingUploadedGalleryThenCallsUploadEndpointWithGet', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ statusCode: 200, imageUrlCatalog: ['/uploads/a.webp'] }),
    })

    const responsePayload = await loadUploadedImageCatalogFromProject()

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/upload-image', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
    expect(responsePayload.imageUrlCatalog).toEqual(['/uploads/a.webp'])
  })

  test('whenLoadingProjectPreferencesThenCallsPublicPreferencesEndpointWithGet', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        statusCode: 200,
        projectPreferences: {
          backgroundHexColor: '#101010',
          backgroundImageUrl: '/background/background.jpg',
          yellowThemeHexColor: '#ffdf85',
        },
      }),
    })

    const responsePayload = await loadProjectPreferencesFromProject()

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/project/preferences', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
    expect(responsePayload.projectPreferences.backgroundHexColor).toBe('#101010')
  })

  test('whenPersistingProjectPreferencesThenCallsAdminPreferencesEndpointWithPost', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        statusCode: 200,
        projectPreferences: {
          backgroundHexColor: '#202020',
          backgroundImageUrl: '',
          yellowThemeHexColor: '#ffe199',
        },
      }),
    })

    const preferencesPayload = {
      backgroundHexColor: '#202020',
      backgroundImageUrl: '',
      yellowThemeHexColor: '#ffe199',
    }

    const responsePayload = await persistProjectPreferencesToProject(preferencesPayload)

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/project/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ projectPreferences: preferencesPayload }),
    })
    expect(responsePayload.projectPreferences.yellowThemeHexColor).toBe('#ffe199')
  })

  test('whenApiReturnsFailureThenThrowsSanitizedErrorMessage', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Falha de persistencia.' }),
    })

    await expect(loadPersistedArticleCatalogFromProject()).rejects.toThrow('Falha de persistencia.')
  })

  test('whenCatalogGetIsRateLimitedThenAppliesCooldownAndAvoidsImmediateRepeatedFetch', async () => {
    Date.now = vi.fn()
    Date.now.mockReturnValue(10_000)

    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: () => '45' },
      json: async () => ({ message: 'Limite de requisicoes atingido.' }),
    })

    await expect(loadPersistedArticleCatalogFromProject()).rejects.toThrow('Limite de requisicoes atingido.')

    Date.now.mockReturnValue(10_001)
    await expect(loadPersistedArticleCatalogFromProject()).rejects.toThrow(
      'API temporariamente limitada para leitura do catalogo. Tente novamente em instantes.'
    )

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})
