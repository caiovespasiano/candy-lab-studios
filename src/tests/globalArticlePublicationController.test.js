import { describe, expect, test } from 'vitest'
import { GlobalArticlePublicationController } from '../controllers/articles/globalArticlePublicationController'

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

describe('GlobalArticlePublicationController', () => {
  test('whenCreateArticleReceivesValidPayloadThenReturnsSuccessAndCatalogWithNewArticle', () => {
    const storageClient = createInMemoryStorageClient()
    const controller = new GlobalArticlePublicationController({
      storageClient,
      nowTimestampProvider: () => 1_700_000_000_000,
    })

    const createResult = controller.createArticle(
      {
        title: 'Novo artigo',
        subtitle: 'Subtitulo novo',
        description: 'Descricao nova',
        imageUrl: 'https://example.com/new.png',
      },
      'correlation-article-create'
    )

    expect(createResult.statusCode).toBe(200)
    expect(createResult.articleCatalog.some((articleData) => articleData.title === 'Novo artigo')).toBe(true)
  })

  test('whenToggleArticlePublicationIsCalledThenPublishedStateIsInverted', () => {
    const storageClient = createInMemoryStorageClient()
    const controller = new GlobalArticlePublicationController({ storageClient })
    const initialCatalog = controller.listAllArticleCatalog().articleCatalog
    const targetArticleIdentifier = initialCatalog[0].id
    const initialPublishedState = initialCatalog[0].isPublished

    const toggleResult = controller.toggleArticlePublication(targetArticleIdentifier, 'correlation-article-toggle')
    const toggledArticle = toggleResult.articleCatalog.find((articleData) => articleData.id === targetArticleIdentifier)

    expect(toggleResult.statusCode).toBe(200)
    expect(toggledArticle.isPublished).toBe(!initialPublishedState)
  })

  test('whenReorderArticleMovesUpThenArticlePositionChanges', () => {
    const storageClient = createInMemoryStorageClient()
    const controller = new GlobalArticlePublicationController({ storageClient })
    const initialCatalog = controller.listAllArticleCatalog().articleCatalog
    const targetArticleIdentifier = initialCatalog[1].id

    const reorderResult = controller.reorderArticle(targetArticleIdentifier, 'up', 'correlation-article-reorder')

    expect(reorderResult.statusCode).toBe(200)
    expect(reorderResult.articleCatalog[0].id).toBe(targetArticleIdentifier)
  })

  test('whenReorderArticleByDragAndDropMovesCorrectlyThenOrderChanges', () => {
    const storageClient = createInMemoryStorageClient()
    const controller = new GlobalArticlePublicationController({ storageClient })
    const initialCatalog = controller.listAllArticleCatalog().articleCatalog
    const articleIdentifierAtSourceIndex = initialCatalog[1].id

    const reorderResult = controller.reorderArticleByDragAndDrop(1, 0, 'correlation-drag-reorder')

    expect(reorderResult.statusCode).toBe(200)
    expect(reorderResult.articleCatalog[0].id).toBe(articleIdentifierAtSourceIndex)
  })

  test('whenUpdateArticleReceivesValidPayloadThenReturnsUpdatedArticle', () => {
    const storageClient = createInMemoryStorageClient()
    const controller = new GlobalArticlePublicationController({ storageClient })
    const initialCatalog = controller.listAllArticleCatalog().articleCatalog
    const targetArticleIdentifier = initialCatalog[0].id

    const updateResult = controller.updateArticle(
      targetArticleIdentifier,
      {
        title: 'Titulo editado',
        subtitle: 'Subtítulo editado',
        description: 'Descrição editada',
        imageUrl: 'https://example.com/edited.png',
        imageAlternativeText: 'Imagem editada',
        galleryImageUrls: ['https://example.com/gal1.png'],
      },
      'correlation-article-update'
    )

    const updatedArticle = updateResult.articleCatalog.find((articleData) => articleData.id === targetArticleIdentifier)

    expect(updateResult.statusCode).toBe(200)
    expect(updatedArticle.title).toBe('Titulo editado')
    expect(updatedArticle.galleryImageUrls).toEqual(['https://example.com/gal1.png'])
  })
})
