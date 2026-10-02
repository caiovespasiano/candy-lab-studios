import { render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import App from '../App'

function buildArticle(articleIndex, titleText) {
  return {
    id: `article-${articleIndex}`,
    title: titleText,
    subtitle: `Subtitulo ${articleIndex}`,
    summary: `Resumo ${articleIndex}`,
    description: `Descricao ${articleIndex}`,
    imageUrl: `/uploads/imagem-${articleIndex}.webp`,
    imageAlternativeText: `Imagem ${articleIndex}`,
    galleryImageUrls: [`/uploads/imagem-${articleIndex}.webp`],
    tags: [],
    authoringSoftware: { name: '', iconKey: '' },
    fileFormats: [],
    purchaseUrl: '',
    copyrightNotice: '',
    isGeneratedWithArtificialIntelligence: false,
    likeCount: 0,
    robuxPrice: 50,
    isPublished: true,
    orderIndex: articleIndex,
    publishedAtIso: '2026-01-01T00:00:00.000Z',
  }
}

const globalTitleCatalog = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']

async function renderLandingWithArticles(articleCatalog) {
  globalThis.fetch = vi.fn(async (requestedUrl) => {
    const isArticlesRequest = String(requestedUrl).includes('/api/admin/articles')

    return {
      ok: true,
      status: 200,
      json: async () => (isArticlesRequest ? { statusCode: 200, articleCatalog } : {}),
    }
  })

  globalThis.localStorage.clear()

  render(<App />)

  await screen.findByRole('button', { name: /abrir detalhes do projeto alpha/i })
}

function readRenderedCardTitles() {
  const portfolioSection = document.getElementById('portfolio')

  return within(portfolioSection)
    .getAllByRole('heading', { level: 3 })
    .map((headingNode) => headingNode.textContent)
}

describe('portfolio grid order', () => {
  test('whenCatalogHasFiveArticlesThenCardsRenderInCatalogOrderWithoutPlacementHack', async () => {
    await renderLandingWithArticles(globalTitleCatalog.map((titleText, articleIndex) => buildArticle(articleIndex, titleText)))

    expect(readRenderedCardTitles()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'])
  })

  test('whenCatalogHasFourArticlesThenCardsRenderInCatalogOrder', async () => {
    await renderLandingWithArticles(
      globalTitleCatalog.slice(0, 4).map((titleText, articleIndex) => buildArticle(articleIndex, titleText)),
    )

    expect(readRenderedCardTitles()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta'])
  })

  test('whenCatalogHasTwoArticlesThenCardsRenderInCatalogOrder', async () => {
    await renderLandingWithArticles(
      globalTitleCatalog.slice(0, 2).map((titleText, articleIndex) => buildArticle(articleIndex, titleText)),
    )

    expect(readRenderedCardTitles()).toEqual(['Alpha', 'Bravo'])
  })

  test('whenCatalogIsRenderedThenNoCardUsesAColumnStartOverrideClass', async () => {
    await renderLandingWithArticles(globalTitleCatalog.map((titleText, articleIndex) => buildArticle(articleIndex, titleText)))

    const renderedArticleNodes = within(document.getElementById('portfolio')).getAllByRole('article')

    for (const articleNode of renderedArticleNodes) {
      expect(articleNode.className).not.toMatch(/col-start-/)
      expect(articleNode.className).not.toMatch(/col-span-2/)
    }
  })
})
