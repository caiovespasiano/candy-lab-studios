const globalProjectArticlesApiPath = '/api/admin/articles'
const globalProjectImageUploadApiPath = '/api/admin/upload-image'

async function parseApiResponse(apiResponse) {
  const responsePayload = await apiResponse.json().catch(() => ({}))

  if (!apiResponse.ok) {
    const fallbackMessage = 'Falha ao comunicar com a persistencia do projeto.'
    const errorMessage = responsePayload.publicMessage || responsePayload.message || fallbackMessage
    throw new Error(errorMessage)
  }

  return responsePayload
}

export async function loadPersistedArticleCatalogFromProject() {
  if (typeof fetch !== 'function') {
    throw new Error('API fetch indisponivel neste ambiente.')
  }

  const apiResponse = await fetch(globalProjectArticlesApiPath, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  })

  return parseApiResponse(apiResponse)
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
