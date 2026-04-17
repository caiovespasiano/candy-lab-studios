import { globalAdminAccessConfig } from '../../constants/globalAdminAccessConfig'
import { globalPortfolioProjectCatalog } from '../../constants/globalPortfolioCatalog'
import { createArticleEntity } from '../../models/articles/globalArticleModel'

function resolveStorageClient(storageClient) {
  return storageClient ?? window.localStorage
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
  } catch (unknownError) {
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
