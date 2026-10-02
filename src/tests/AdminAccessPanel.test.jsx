import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { AdminAccessPanel } from '../components/AdminAccessPanel'

const globalArticleControllerStub = {
  listAllArticleCatalog: () => ({ statusCode: 200, articleCatalog: [] }),
  listPublishedArticleCatalog: () => ({ statusCode: 200, articleCatalog: [] }),
  createArticle: () => ({ statusCode: 200, articleCatalog: [] }),
  updateArticle: () => ({ statusCode: 200, articleCatalog: [] }),
  toggleArticlePublication: () => ({ statusCode: 200, articleCatalog: [] }),
  deleteArticle: () => ({ statusCode: 200, articleCatalog: [] }),
  applyArticleCatalogReorder: () => ({ statusCode: 200, articleCatalog: [] }),
}

function renderAdminPanel() {
  return render(
    <AdminAccessPanel
      articlePublicationController={globalArticleControllerStub}
      onArticleCatalogChange={() => {}}
      onNavigateBackToLanding={() => {}}
    />,
  )
}

function authenticateIntoDashboard() {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ statusCode: 200, username: 'admin', sessionExpiresAtInSeconds: 1_800_000_000 }),
  }))

  fireEvent.change(screen.getByLabelText(/^usuário$/i), { target: { value: 'admin' } })
  fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: 'admin123' } })
  fireEvent.change(screen.getByLabelText(/código de verificação/i), { target: { value: '2026' } })
  fireEvent.click(screen.getByRole('button', { name: /entrar no painel/i }))

  return waitFor(() => screen.getByRole('navigation', { name: /seções do painel/i }))
}

describe('AdminAccessPanel', () => {
  test('whenNotAuthenticatedThenShowsSingleRestrictedLoginForm', () => {
    renderAdminPanel()

    expect(screen.getByRole('heading', { level: 1, name: /área restrita/i })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /seções do painel/i })).not.toBeInTheDocument()
  })

  test('whenAuthenticatedThenShowsDashboardShellWithNavigationAndMetrics', async () => {
    renderAdminPanel()
    await authenticateIntoDashboard()

    expect(screen.getByRole('heading', { level: 1, name: /painel de administração/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /seções do painel/i })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByText('Publicados')).toBeInTheDocument()
    expect(screen.getByText('Rascunhos')).toBeInTheDocument()
  })

  test('whenDashboardRendersThenEachPanelIsASectionLabelledByItsOwnHeading', async () => {
    renderAdminPanel()
    await authenticateIntoDashboard()

    expect(screen.getByRole('region', { name: /aparência do site/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^artigos$/i })).toBeInTheDocument()
  })

  test('whenArticleModalIsOpenedThenFormIsGroupedIntoNamedSections', async () => {
    renderAdminPanel()
    await authenticateIntoDashboard()

    fireEvent.click(screen.getByRole('button', { name: /novo artigo/i }))

    expect(screen.getByRole('dialog', { name: /novo artigo/i })).toBeInTheDocument()

    for (const sectionTitle of ['Identificação', 'Preço e compra', 'Mídia', 'Descrição completa', 'Ficha técnica', 'Tags']) {
      expect(screen.getByText(sectionTitle, { selector: 'legend' })).toBeInTheDocument()
    }
  })

  test('whenArticleModalIsOpenedThenNewEcommerceFieldsArePresent', async () => {
    renderAdminPanel()
    await authenticateIntoDashboard()

    fireEvent.click(screen.getByRole('button', { name: /novo artigo/i }))

    expect(screen.getByLabelText(/resumo curto/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/link da loja/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^tags$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/modelado em/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/formatos dos arquivos/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/gerado com inteligência artificial/i)).toBeInTheDocument()
  })

  test('whenTagsAreTypedThenEnteredValuesArePreviewedAsChipsSeparateFromSuggestions', async () => {
    renderAdminPanel()
    await authenticateIntoDashboard()

    fireEvent.click(screen.getByRole('button', { name: /novo artigo/i }))

    const tagsInput = screen.getByLabelText(/^tags$/i)
    const tagsSection = tagsInput.closest('fieldset')
    const enteredChipList = tagsSection.querySelector('ul')

    expect(enteredChipList).toBeNull()

    fireEvent.change(tagsInput, { target: { value: 'Mochila, UGC' } })

    const renderedChipList = tagsSection.querySelector('ul')
    expect(within(renderedChipList).getByText('Mochila')).toBeInTheDocument()
    expect(within(renderedChipList).getByText('UGC')).toBeInTheDocument()
  })
})
