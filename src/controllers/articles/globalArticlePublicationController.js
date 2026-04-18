import { mapHttpStatusToSanitizedErrorResponse } from '../../network/httpStatusErrorMapper'
import { createArticleEntity, validateArticleEntity } from '../../models/articles/globalArticleModel'
import { loadPersistedArticleCatalog, persistArticleCatalog } from '../../repositories/articles/globalArticleRepository'

function normalizeCatalogOrderIndex(articleCatalog) {
  return articleCatalog.map((articleData, articleIndex) => {
    return { ...articleData, orderIndex: articleIndex }
  })
}

function resolveSuccessResponse(publicMessage, articleCatalog) {
  return {
    statusCode: 200,
    publicMessage,
    articleCatalog,
  }
}

function findArticleIndexByIdentifier(articleCatalog, articleIdentifier) {
  return articleCatalog.findIndex((articleData) => articleData.id === articleIdentifier)
}

class GlobalArticlePublicationController {
  constructor({ storageClient, nowTimestampProvider = Date.now } = {}) {
    this.storageClient = storageClient
    this.nowTimestampProvider = nowTimestampProvider
  }

  listAllArticleCatalog() {
    const articleCatalog = loadPersistedArticleCatalog(this.storageClient, this.nowTimestampProvider)
    return resolveSuccessResponse('Catálogo carregado com sucesso.', articleCatalog)
  }

  listPublishedArticleCatalog() {
    const allArticleCatalog = this.listAllArticleCatalog().articleCatalog
    const publishedArticleCatalog = allArticleCatalog.filter((articleData) => articleData.isPublished)

    return resolveSuccessResponse('Artigos publicados carregados com sucesso.', publishedArticleCatalog)
  }

  createArticle(rawArticleInput, correlationIdentifier) {
    try {
      const currentArticleCatalog = loadPersistedArticleCatalog(this.storageClient, this.nowTimestampProvider)
      const createdArticleEntity = createArticleEntity(rawArticleInput, currentArticleCatalog.length, this.nowTimestampProvider)
      const articleValidation = validateArticleEntity(createdArticleEntity)

      if (!articleValidation.isValid) {
        return {
          ...mapHttpStatusToSanitizedErrorResponse(422, correlationIdentifier),
          publicMessage: articleValidation.validationErrorCatalog[0],
          articleCatalog: currentArticleCatalog,
        }
      }

      const nextArticleCatalog = normalizeCatalogOrderIndex([...currentArticleCatalog, createdArticleEntity])
      persistArticleCatalog(nextArticleCatalog, this.storageClient)

      return resolveSuccessResponse('Artigo publicado com sucesso.', nextArticleCatalog)
    } catch (unknownError) {
      return mapHttpStatusToSanitizedErrorResponse(500, correlationIdentifier)
    }
  }

  toggleArticlePublication(articleIdentifier, correlationIdentifier) {
    try {
      const currentArticleCatalog = loadPersistedArticleCatalog(this.storageClient, this.nowTimestampProvider)
      const targetArticleIndex = findArticleIndexByIdentifier(currentArticleCatalog, articleIdentifier)

      if (targetArticleIndex < 0) {
        return mapHttpStatusToSanitizedErrorResponse(404, correlationIdentifier)
      }

      const targetArticleData = currentArticleCatalog[targetArticleIndex]
      const nextArticleCatalog = [...currentArticleCatalog]
      nextArticleCatalog[targetArticleIndex] = {
        ...targetArticleData,
        isPublished: !targetArticleData.isPublished,
      }

      persistArticleCatalog(nextArticleCatalog, this.storageClient)
      return resolveSuccessResponse('Visibilidade do artigo atualizada com sucesso.', nextArticleCatalog)
    } catch (unknownError) {
      return mapHttpStatusToSanitizedErrorResponse(500, correlationIdentifier)
    }
  }

  deleteArticle(articleIdentifier, correlationIdentifier) {
    try {
      const currentArticleCatalog = loadPersistedArticleCatalog(this.storageClient, this.nowTimestampProvider)
      const targetArticleIndex = findArticleIndexByIdentifier(currentArticleCatalog, articleIdentifier)

      if (targetArticleIndex < 0) {
        return mapHttpStatusToSanitizedErrorResponse(404, correlationIdentifier)
      }

      const nextArticleCatalog = currentArticleCatalog.filter((articleData) => articleData.id !== articleIdentifier)
      const normalizedArticleCatalog = normalizeCatalogOrderIndex(nextArticleCatalog)
      persistArticleCatalog(normalizedArticleCatalog, this.storageClient)

      return resolveSuccessResponse('Artigo removido com sucesso.', normalizedArticleCatalog)
    } catch (unknownError) {
      return mapHttpStatusToSanitizedErrorResponse(500, correlationIdentifier)
    }
  }

  reorderArticle(articleIdentifier, movementDirection, correlationIdentifier) {
    try {
      const currentArticleCatalog = loadPersistedArticleCatalog(this.storageClient, this.nowTimestampProvider)
      const targetArticleIndex = findArticleIndexByIdentifier(currentArticleCatalog, articleIdentifier)

      if (targetArticleIndex < 0) {
        return mapHttpStatusToSanitizedErrorResponse(404, correlationIdentifier)
      }

      const movementOffset = movementDirection === 'up' ? -1 : 1
      const destinationIndex = targetArticleIndex + movementOffset

      if (destinationIndex < 0 || destinationIndex >= currentArticleCatalog.length) {
        return resolveSuccessResponse('Nenhuma alteração de ordem foi necessária.', currentArticleCatalog)
      }

      const nextArticleCatalog = [...currentArticleCatalog]
      const [movedArticleData] = nextArticleCatalog.splice(targetArticleIndex, 1)
      nextArticleCatalog.splice(destinationIndex, 0, movedArticleData)

      const normalizedArticleCatalog = normalizeCatalogOrderIndex(nextArticleCatalog)
      persistArticleCatalog(normalizedArticleCatalog, this.storageClient)

      return resolveSuccessResponse('Ordem de exibição atualizada com sucesso.', normalizedArticleCatalog)
    } catch (unknownError) {
      return mapHttpStatusToSanitizedErrorResponse(500, correlationIdentifier)
    }
  }

  reorderArticleByDragAndDrop(sourceArticleIndex, destinationArticleIndex, correlationIdentifier) {
    try {
      const currentArticleCatalog = loadPersistedArticleCatalog(this.storageClient, this.nowTimestampProvider)
      const hasInvalidBounds =
        sourceArticleIndex < 0 ||
        sourceArticleIndex >= currentArticleCatalog.length ||
        destinationArticleIndex < 0 ||
        destinationArticleIndex >= currentArticleCatalog.length

      if (hasInvalidBounds || sourceArticleIndex === destinationArticleIndex) {
        return resolveSuccessResponse('Nenhuma alteração de ordem foi necessária.', currentArticleCatalog)
      }

      const nextArticleCatalog = [...currentArticleCatalog]
      const [movedArticleData] = nextArticleCatalog.splice(sourceArticleIndex, 1)
      nextArticleCatalog.splice(destinationArticleIndex, 0, movedArticleData)

      const normalizedArticleCatalog = normalizeCatalogOrderIndex(nextArticleCatalog)
      persistArticleCatalog(normalizedArticleCatalog, this.storageClient)

      return resolveSuccessResponse('Ordem de exibição atualizada com sucesso.', normalizedArticleCatalog)
    } catch (unknownError) {
      return mapHttpStatusToSanitizedErrorResponse(500, correlationIdentifier)
    }
  }

  applyArticleCatalogReorder(sortedArticleCatalog, correlationIdentifier) {
    try {
      const normalizedCatalog = normalizeCatalogOrderIndex(sortedArticleCatalog)
      persistArticleCatalog(normalizedCatalog, this.storageClient)
      return resolveSuccessResponse('Ordem de exibição atualizada com sucesso.', normalizedCatalog)
    } catch (unknownError) {
      return mapHttpStatusToSanitizedErrorResponse(500, correlationIdentifier)
    }
  }

  updateArticle(articleIdentifier, rawArticleInput, correlationIdentifier) {
    try {
      const currentArticleCatalog = loadPersistedArticleCatalog(this.storageClient, this.nowTimestampProvider)
      const targetArticleIndex = findArticleIndexByIdentifier(currentArticleCatalog, articleIdentifier)

      if (targetArticleIndex < 0) {
        return mapHttpStatusToSanitizedErrorResponse(404, correlationIdentifier)
      }

      const existingArticleData = currentArticleCatalog[targetArticleIndex]
      const updatedArticleEntity = createArticleEntity(
        {
          ...rawArticleInput,
          id: existingArticleData.id,
          likeCount: existingArticleData.likeCount,
          isPublished: existingArticleData.isPublished,
        },
        existingArticleData.orderIndex,
        this.nowTimestampProvider
      )

      const articleValidation = validateArticleEntity(updatedArticleEntity)

      if (!articleValidation.isValid) {
        return {
          ...mapHttpStatusToSanitizedErrorResponse(422, correlationIdentifier),
          publicMessage: articleValidation.validationErrorCatalog[0],
          articleCatalog: currentArticleCatalog,
        }
      }

      const nextArticleCatalog = [...currentArticleCatalog]
      nextArticleCatalog[targetArticleIndex] = updatedArticleEntity
      persistArticleCatalog(nextArticleCatalog, this.storageClient)

      return resolveSuccessResponse('Artigo atualizado com sucesso.', nextArticleCatalog)
    } catch (unknownError) {
      return mapHttpStatusToSanitizedErrorResponse(500, correlationIdentifier)
    }
  }
}

const globalArticlePublicationController = new GlobalArticlePublicationController()

export { GlobalArticlePublicationController, globalArticlePublicationController }
