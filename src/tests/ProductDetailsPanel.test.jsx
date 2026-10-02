import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ProductDetailsPanel } from '../components/ProductDetailsPanel'

vi.mock('../components/ProjectGalleryLightbox', () => ({
  ProjectGalleryLightbox: () => <div data-testid="lightbox" />,
}))

const globalBaseProjectData = {
  id: 'mochila-chama-eterna',
  title: 'Chama Eterna',
  subtitle: 'Mochila 3D em tons de brasa',
  summary: 'Resumo curto do produto.',
  description: 'Descrição longa.\nSegundo parágrafo.',
  imageUrl: '/uploads/fire.webp',
  imageAlternativeText: 'Mochila de fogo',
  galleryImageUrls: ['/uploads/fire.webp'],
  tags: ['Mochila', 'Ugc'],
  authoringSoftware: { name: 'Blender', iconKey: 'blender' },
  fileFormats: ['FBX', 'OBJ'],
  purchaseUrl: '',
  copyrightNotice: '',
  isGeneratedWithArtificialIntelligence: false,
  robuxPrice: 50,
}

const globalTranslationCatalog = {
  'product.priceLabel': 'Preço',
  'product.buyNow': 'Comprar agora',
  'product.unavailable': 'Indisponível no momento',
  'product.unavailableHint': 'Este asset ainda não está publicado na loja.',
  'product.share': 'Compartilhar',
  'product.descriptionHeading': 'Descrição completa',
  'product.detailsHeading': 'Detalhes técnicos',
  'product.tagsHeading': 'Tags',
  'product.softwareLabel': 'Modelado em',
  'product.formatsLabel': 'Formatos',
  'product.licenseLabel': 'Licença',
  'product.noTags': 'Sem tags cadastradas.',
  'product.noFormats': 'Não informado.',
  'product.noSoftware': 'Não informado.',
  'product.copyrightDefault': '© {year} Candy Lab Studios.',
  'product.aiDisclaimerHeading': 'Sobre a produção',
  'product.aiDisclaimerFalse': 'Modelado manualmente. Não foi gerado com inteligência artificial.',
  'product.aiDisclaimerTrue': 'Este asset utiliza assistência de inteligência artificial na produção.',
  'product.viewOnStore': 'Ver na loja',
  'product.eyebrow': 'Asset 3D para Roblox',
  'modal.close': 'Fechar modal',
  'modal.likes': 'Curtidas: {count}',
  'modal.like': 'Curtir',
  'modal.removeLike': 'Remover curtida',
}

function translate(translationPath, replacementByKey = {}) {
  const template = globalTranslationCatalog[translationPath] || translationPath

  return Object.entries(replacementByKey).reduce((resolvedText, [key, value]) => {
    return resolvedText.replaceAll(`{${key}}`, String(value))
  }, template)
}

function renderProductPanel(projectDataOverride = {}, handlerOverrides = {}) {
  const noop = () => {}

  return render(
    <ProductDetailsPanel
      projectData={{ ...globalBaseProjectData, ...projectDataOverride }}
      currentGalleryImageIndex={0}
      isLikedByCurrentVisitor={false}
      likeCount={7}
      translate={translate}
      resolveDimensionsByUrl={() => ({ width: 1600, height: 1200 })}
      onBeforeGalleryOpen={noop}
      onSelectGalleryImage={noop}
      onNavigateGalleryPrevious={noop}
      onNavigateGalleryNext={noop}
      onToggleLike={noop}
      onShare={noop}
      onClose={noop}
      {...handlerOverrides}
    />,
  )
}

describe('ProductDetailsPanel', () => {
  test('whenPanelRendersThenShowsTitleSummaryPriceAndTechnicalDetails', () => {
    renderProductPanel()

    expect(screen.getByRole('heading', { level: 2, name: 'Chama Eterna' })).toBeInTheDocument()
    expect(screen.getByText('Resumo curto do produto.')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('Blender')).toBeInTheDocument()
    expect(screen.getByText('FBX · OBJ')).toBeInTheDocument()
  })

  test('whenPurchaseUrlIsEmptyThenBuyButtonIsReplacedByUnavailableNotice', () => {
    renderProductPanel({ purchaseUrl: '' })

    expect(screen.queryByRole('link', { name: 'Comprar agora' })).not.toBeInTheDocument()
    expect(screen.getByText('Indisponível no momento')).toBeInTheDocument()
  })

  test('whenPurchaseUrlExistsThenBuyButtonLinksOutWithSafeRel', () => {
    renderProductPanel({ purchaseUrl: 'https://www.roblox.com/catalog/12345' })

    const buyButton = screen.getByRole('link', { name: 'Comprar agora' })

    expect(buyButton).toHaveAttribute('href', 'https://www.roblox.com/catalog/12345')
    expect(buyButton).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('whenArticleIsNotGeneratedWithAiThenPanelStatesManualProduction', () => {
    renderProductPanel({ isGeneratedWithArtificialIntelligence: false })

    expect(screen.getByText(/modelado manualmente/i)).toBeInTheDocument()
  })

  test('whenArticleIsGeneratedWithAiThenPanelDisclosesIt', () => {
    renderProductPanel({ isGeneratedWithArtificialIntelligence: true })

    expect(screen.getByText(/assistência de inteligência artificial/i)).toBeInTheDocument()
  })

  test('whenTagCatalogIsEmptyThenPanelShowsPlaceholderInsteadOfEmptyList', () => {
    renderProductPanel({ tags: [] })

    expect(screen.getByText('Sem tags cadastradas.')).toBeInTheDocument()
  })

  test('whenArticleIsNotLikedThenLikeButtonExposesUnpressedState', () => {
    renderProductPanel()

    expect(screen.getByRole('button', { name: 'Curtir' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('whenArticleIsLikedThenLikeButtonExposesPressedState', () => {
    render(
      <ProductDetailsPanel
        projectData={globalBaseProjectData}
        currentGalleryImageIndex={0}
        isLikedByCurrentVisitor
        likeCount={7}
        translate={translate}
        resolveDimensionsByUrl={() => ({ width: 1600, height: 1200 })}
        onBeforeGalleryOpen={() => {}}
        onSelectGalleryImage={() => {}}
        onNavigateGalleryPrevious={() => {}}
        onNavigateGalleryNext={() => {}}
        onToggleLike={() => {}}
        onShare={() => {}}
        onClose={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Remover curtida' })).toHaveAttribute('aria-pressed', 'true')
  })
})
