import { globalAdminAccessConfig } from '../../constants/globalAdminAccessConfig'
import { globalPortfolioProjectCatalog } from '../../constants/globalPortfolioCatalog'
import { createArticleEntity } from '../../models/articles/globalArticleModel'
import { internalRuntimeStorage } from '../../services/internalRuntimeStorageService'

function resolveBrowserLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  try {
    const testStorageKey = '__dimi3d-storage-check__'
    window.localStorage.setItem(testStorageKey, 'ok')
    window.localStorage.removeItem(testStorageKey)
    return window.localStorage
  } catch {
    return null
  }
}

function resolveStorageClient(storageClient) {
  if (storageClient) {
    return storageClient
  }

  const browserLocalStorage = resolveBrowserLocalStorage()
  if (browserLocalStorage) {
    return browserLocalStorage
  }

  return internalRuntimeStorage
}

function sortArticleCatalogByOrder(articleCatalog) {
  return [...articleCatalog].sort((leftArticle, rightArticle) => leftArticle.orderIndex - rightArticle.orderIndex)
}

function normalizeSeedArticleCatalog(seedArticleCatalog, nowTimestampProvider = Date.now) {
  return seedArticleCatalog.map((articleData, articleIndex) => {
    return createArticleEntity({ ...articleData, isPublished: true }, articleIndex, nowTimestampProvider)
  })
}

export function loadPersistedArticleCatalog(storageClient, nowTimestampProvider = Date.now) {
  const safeStorageClient = resolveStorageClient(storageClient)
  const persistedArticleCatalogText = safeStorageClient.getItem(globalAdminAccessConfig.adminArticleCatalogStorageKey)

  if (!persistedArticleCatalogText) {
    return normalizeSeedArticleCatalog(globalPortfolioProjectCatalog, nowTimestampProvider)
  }

  try {
    const parsedPersistedArticleCatalog = JSON.parse(persistedArticleCatalogText)

    if (!Array.isArray(parsedPersistedArticleCatalog) || parsedPersistedArticleCatalog.length === 0) {
      return normalizeSeedArticleCatalog(globalPortfolioProjectCatalog, nowTimestampProvider)
    }

    const normalizedArticleCatalog = parsedPersistedArticleCatalog.map((articleData, articleIndex) => {
      return createArticleEntity(articleData, articleData.orderIndex ?? articleIndex, nowTimestampProvider)
    })

    return sortArticleCatalogByOrder(normalizedArticleCatalog)
  } catch {
    return normalizeSeedArticleCatalog(globalPortfolioProjectCatalog, nowTimestampProvider)
  }
}

export function persistArticleCatalog(articleCatalog, storageClient) {
  const safeStorageClient = resolveStorageClient(storageClient)
  safeStorageClient.setItem(
    globalAdminAccessConfig.adminArticleCatalogStorageKey,
    JSON.stringify(sortArticleCatalogByOrder(articleCatalog))
  )
}
