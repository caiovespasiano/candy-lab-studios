const globalProjectArticlesApiPath = '/api/admin/articles'
const globalProjectImageUploadApiPath = '/api/admin/upload-image'
const globalProjectPreferencesApiPath = '/api/project/preferences'
const globalAdminProjectPreferencesApiPath = '/api/admin/project/preferences'
const globalCatalogFetchRateLimitFallbackCooldownMs = 60_000
const globalCatalogFetchCooldownMessage = 'API temporariamente limitada para leitura do catalogo. Tente novamente em instantes.'

let globalInflightCatalogFetchPromise = null
let globalCatalogFetchBlockedUntilTimestampMs = 0

async function parseApiResponse(apiResponse) {
  const responsePayload = await apiResponse.json().catch(() => ({}))

  if (!apiResponse.ok) {
    const fallbackMessage = 'Falha ao comunicar com a persistencia do projeto.'
    const errorMessage = responsePayload.publicMessage || responsePayload.message || fallbackMessage
    const apiError = new Error(errorMessage)
    apiError.statusCode = Number(responsePayload.statusCode || apiResponse.status || 500)

    if (apiError.statusCode === 429) {
      const retryAfterHeaderValue = Number(apiResponse.headers?.get('Retry-After') || 0)
      const retryAfterSeconds = Number.isFinite(retryAfterHeaderValue) && retryAfterHeaderValue > 0
        ? retryAfterHeaderValue
        : Math.ceil(globalCatalogFetchRateLimitFallbackCooldownMs / 1000)
      apiError.retryAfterMilliseconds = Math.max(1_000, retryAfterSeconds * 1_000)
    }

    throw apiError
  }

  return responsePayload
}

export async function loadPersistedArticleCatalogFromProject() {
  if (typeof fetch !== 'function') {
    throw new Error('API fetch indisponivel neste ambiente.')
  }

  if (globalInflightCatalogFetchPromise) {
    return globalInflightCatalogFetchPromise
  }

  const nowTimestamp = Date.now()
  if (nowTimestamp < globalCatalogFetchBlockedUntilTimestampMs) {
    throw new Error(globalCatalogFetchCooldownMessage)
  }

  globalInflightCatalogFetchPromise = (async () => {
    const apiResponse = await fetch(globalProjectArticlesApiPath, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })

    return parseApiResponse(apiResponse)
  })()

  try {
    const responsePayload = await globalInflightCatalogFetchPromise
    globalCatalogFetchBlockedUntilTimestampMs = 0
    return responsePayload
  } catch (caughtError) {
    const isRateLimitedError = Number(caughtError?.statusCode) === 429
    if (isRateLimitedError) {
      const retryAfterMilliseconds = Number(caughtError?.retryAfterMilliseconds)
      const safeRetryAfterMilliseconds = Number.isFinite(retryAfterMilliseconds) && retryAfterMilliseconds > 0
        ? retryAfterMilliseconds
        : globalCatalogFetchRateLimitFallbackCooldownMs
      globalCatalogFetchBlockedUntilTimestampMs = Date.now() + safeRetryAfterMilliseconds
    }
    throw caughtError
  } finally {
    globalInflightCatalogFetchPromise = null
  }
}

export async function persistArticleCatalogToProject(articleCatalog) {
  if (typeof fetch !== 'function') {
    throw new Error('API fetch indisponivel neste ambiente.')
  }

  const apiResponse = await fetch(globalProjectArticlesApiPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ articleCatalog }),
  })

  return parseApiResponse(apiResponse)
}

export async function uploadArticleImageToProject({ imageDataUrl, sourceLabel = 'image' }) {
  if (typeof fetch !== 'function') {
    throw new Error('API fetch indisponivel neste ambiente.')
  }

  const apiResponse = await fetch(globalProjectImageUploadApiPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ imageDataUrl, sourceLabel }),
  })

  return parseApiResponse(apiResponse)
}

export async function loadUploadedImageCatalogFromProject() {
  if (typeof fetch !== 'function') {
    throw new Error('API fetch indisponivel neste ambiente.')
  }

  const apiResponse = await fetch(globalProjectImageUploadApiPath, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  })

  return parseApiResponse(apiResponse)
}

export async function deleteUploadedImageFromProject(imageUrl) {
  if (typeof fetch !== 'function') {
    throw new Error('API fetch indisponivel neste ambiente.')
  }

  const apiResponse = await fetch(globalProjectImageUploadApiPath, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ imageUrl }),
  })

  return parseApiResponse(apiResponse)
}

export async function loadProjectPreferencesFromProject() {
  if (typeof fetch !== 'function') {
    throw new Error('API fetch indisponivel neste ambiente.')
  }

  const apiResponse = await fetch(globalProjectPreferencesApiPath, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  })

  return parseApiResponse(apiResponse)
}

export async function persistProjectPreferencesToProject(projectPreferences) {
  if (typeof fetch !== 'function') {
    throw new Error('API fetch indisponivel neste ambiente.')
  }

  const apiResponse = await fetch(globalAdminProjectPreferencesApiPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ projectPreferences }),
  })

  return parseApiResponse(apiResponse)
}
