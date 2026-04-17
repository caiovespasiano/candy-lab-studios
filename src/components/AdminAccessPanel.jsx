import { useEffect, useRef, useState } from 'react'
import { FaArrowLeft, FaEdit, FaGripVertical, FaLock, FaPlus, FaSignOutAlt, FaTrash } from 'react-icons/fa'
import { globalAdminAccessConfig } from '../constants/globalAdminAccessConfig'
import { requestAdminAuthenticationUsingGateway } from '../services/adminAuthenticationService'
import {
  clearPersistedAdminSessionToken,
  persistAdminSessionToken,
  restoreValidAdminSessionData,
} from '../services/adminAccessSessionService'
import {
  applyGlobalBackgroundHexColor,
  loadPersistedGlobalBackgroundHexColor,
  persistGlobalBackgroundHexColor,
} from '../services/globalBackgroundPreferencesService'

const globalDefaultAdminAuthenticationGatewayClient = {
  async requestAdminAuthentication(sanitizedAdminCredentials) {
    const expectedUsername = import.meta.env.VITE_ADMIN_USERNAME || globalAdminAccessConfig.defaultAdminUsername
    const expectedPassword = import.meta.env.VITE_ADMIN_PASSWORD || globalAdminAccessConfig.defaultAdminPassword
    const expectedVerificationCode =
      import.meta.env.VITE_ADMIN_VERIFICATION_CODE || globalAdminAccessConfig.defaultAdminVerificationCode
    const hasInvalidCredentials =
      sanitizedAdminCredentials.username !== expectedUsername ||
      sanitizedAdminCredentials.password !== expectedPassword ||
      sanitizedAdminCredentials.verificationCode !== expectedVerificationCode

    if (hasInvalidCredentials) {
      return {
        statusCode: 401,
        payload: { message: 'Falha na autenticação administrativa.' },
      }
    }

    const { createAdminSessionToken, parseAndValidateAdminSessionToken } = await import('../services/adminSessionTokenService')
    const sessionToken = createAdminSessionToken({ username: sanitizedAdminCredentials.username })
    const sessionValidationResult = parseAndValidateAdminSessionToken(sessionToken)

    return {
      statusCode: 200,
      payload: {
        message: 'Acesso administrativo autorizado.',
        sessionToken,
        sessionExpiresAtInSeconds: sessionValidationResult.sessionData.expiresAtInSeconds,
        username: sanitizedAdminCredentials.username,
      },
    }
  },
}

function resolveInitialAdminSessionState() {
  const restoredAdminSession = restoreValidAdminSessionData()

  if (!restoredAdminSession.isAuthenticated) {
    return {
      isAuthenticated: false,
      username: '',
      sessionExpiresAtInSeconds: null,
    }
  }

  return {
    isAuthenticated: true,
    username: restoredAdminSession.sessionData.username,
    sessionExpiresAtInSeconds: restoredAdminSession.sessionData.expiresAtInSeconds,
  }
}

const globalEmptyArticleFormState = {
  title: '',
  subtitle: '',
  description: '',
  imageUrl: '',
  imageAlternativeText: '',
}

function GalleryUrlEditor({ galleryImageUrlDraftCatalog, onGalleryUrlDraftCatalogChange }) {
  const [galleryUrlInputValue, setGalleryUrlInputValue] = useState('')

  function handleAddGalleryUrlClick() {
    const trimmedUrl = galleryUrlInputValue.trim()
    if (!trimmedUrl) return
    onGalleryUrlDraftCatalogChange([...galleryImageUrlDraftCatalog, trimmedUrl])
    setGalleryUrlInputValue('')
  }

  function handleRemoveGalleryUrlAtIndex(targetIndex) {
    onGalleryUrlDraftCatalogChange(galleryImageUrlDraftCatalog.filter((_, urlIndex) => urlIndex !== targetIndex))
  }

  function handleGalleryUrlInputKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleAddGalleryUrlClick()
    }
  }

  return (
    <div>
      <span className="block text-xs font-black uppercase tracking-wider text-inkBlack">Galeria de imagens</span>
      <div className="mt-2 flex gap-2">
        <input
          type="url"
          value={galleryUrlInputValue}
          onChange={(event) => setGalleryUrlInputValue(event.target.value)}
          onKeyDown={handleGalleryUrlInputKeyDown}
          placeholder="https://exemplo.com/imagem.jpg"
          className="cute-input flex-1 text-sm"
        />
        <button
          type="button"
          onClick={handleAddGalleryUrlClick}
          className="cute-button flex h-12 w-12 items-center justify-center bg-pastelMint p-0!"
          aria-label="Adicionar URL à galeria"
        >
          <FaPlus aria-hidden="true" />
        </button>
      </div>
      {galleryImageUrlDraftCatalog.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {galleryImageUrlDraftCatalog.map((galleryUrl, urlIndex) => (
            <li
              key={`${urlIndex}-${galleryUrl}`}
              className="flex items-center gap-2 rounded-xl border-2 border-inkBlack bg-paperWhite px-3 py-2"
            >
              <img
                src={galleryUrl}
                alt={`Pré-visualização ${urlIndex + 1}`}
                className="h-10 w-14 rounded-lg border border-inkBlack/20 object-cover"
                loading="lazy"
              />
              <span className="flex-1 truncate text-xs font-bold text-inkBlack/70">{galleryUrl}</span>
              <button
                type="button"
                onClick={() => handleRemoveGalleryUrlAtIndex(urlIndex)}
                className="cute-control-button h-8 w-8 text-sm cute-control-button-close"
                aria-label={`Remover imagem ${urlIndex + 1} da galeria`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ArticleFormFields({
  formState,
  onInputChange,
  galleryUrlDraftCatalog,
  onGalleryUrlDraftCatalogChange,
  submitLabel,
  onCancelClick,
}) {
  return (
    <div className="grid gap-4">
      <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
        Título
        <input
          className="cute-input mt-2 w-full"
          name="title"
          type="text"
          value={formState.title}
          onChange={onInputChange}
          required
        />
      </label>
      <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
        Subtítulo
        <input
          className="cute-input mt-2 w-full"
          name="subtitle"
          type="text"
          value={formState.subtitle}
          onChange={onInputChange}
          required
        />
      </label>
      <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
        URL da imagem principal
        <input
          className="cute-input mt-2 w-full"
          name="imageUrl"
          type="url"
          value={formState.imageUrl}
          onChange={onInputChange}
          required
        />
      </label>
      <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
        Texto alternativo da imagem
        <input
          className="cute-input mt-2 w-full"
          name="imageAlternativeText"
          type="text"
          value={formState.imageAlternativeText}
          onChange={onInputChange}
        />
      </label>
      <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
        Descrição
        <textarea
          className="cute-input mt-2 w-full resize-none"
          name="description"
          rows="4"
          value={formState.description}
          onChange={onInputChange}
          required
        />
      </label>
      <GalleryUrlEditor
        galleryImageUrlDraftCatalog={galleryUrlDraftCatalog}
        onGalleryUrlDraftCatalogChange={onGalleryUrlDraftCatalogChange}
      />
      <div className="flex gap-3 pt-1">
        <button type="submit" className="cute-button flex flex-1 items-center justify-center gap-2 bg-pastelMint">
          <FaPlus aria-hidden="true" />
          <span>{submitLabel}</span>
        </button>
        {onCancelClick && (
          <button
            type="button"
            onClick={onCancelClick}
            className="cute-button flex items-center justify-center gap-2 bg-paperWhite px-5"
          >
            <span>Cancelar</span>
          </button>
        )}
      </div>
    </div>
  )
}

export function AdminAccessPanel({ articlePublicationController, onArticleCatalogChange, onNavigateBackToLanding }) {
  const [adminCredentialsFormState, setAdminCredentialsFormState] = useState({
    username: '',
    password: '',
    verificationCode: '',
  })
  const [adminSessionState, setAdminSessionState] = useState(resolveInitialAdminSessionState)
  const [adminFeedbackMessage, setAdminFeedbackMessage] = useState('')
  const [articleFeedbackMessage, setArticleFeedbackMessage] = useState('')
  const [adminArticleCatalog, setAdminArticleCatalog] = useState(() => {
    return articlePublicationController.listAllArticleCatalog().articleCatalog
  })
  const [articleCreationFormState, setArticleCreationFormState] = useState(globalEmptyArticleFormState)
  const [creationGalleryUrlDraftCatalog, setCreationGalleryUrlDraftCatalog] = useState([])
  const [editingArticleIdentifier, setEditingArticleIdentifier] = useState(null)
  const [articleEditFormState, setArticleEditFormState] = useState(globalEmptyArticleFormState)
  const [editGalleryUrlDraftCatalog, setEditGalleryUrlDraftCatalog] = useState([])
  const [globalBackgroundHexColor, setGlobalBackgroundHexColor] = useState(() => {
    return loadPersistedGlobalBackgroundHexColor()
  })
  const dragSourceIndexRef = useRef(null)

  useEffect(() => {
    applyGlobalBackgroundHexColor(globalBackgroundHexColor)
  }, [globalBackgroundHexColor])

  useEffect(() => {
    const articleCatalogLoadResult = articlePublicationController.listAllArticleCatalog()
    setAdminArticleCatalog(articleCatalogLoadResult.articleCatalog)
  }, [articlePublicationController])

  function handleAdminCredentialsInputChange(event) {
    const changedInputName = event.target.name
    const changedInputValue = event.target.value

    setAdminCredentialsFormState((currentAdminCredentialsFormState) => {
      return {
        ...currentAdminCredentialsFormState,
        [changedInputName]: changedInputValue,
      }
    })
  }

  async function handleAdminAuthenticationSubmission(event) {
    event.preventDefault()

    const adminAuthenticationResult = await requestAdminAuthenticationUsingGateway(
      adminCredentialsFormState,
      globalDefaultAdminAuthenticationGatewayClient,
      'admin-access-flow'
    )

    setAdminFeedbackMessage(adminAuthenticationResult.publicMessage)

    if (adminAuthenticationResult.statusCode !== 200) {
      return
    }

    persistAdminSessionToken(adminAuthenticationResult.sessionToken)
    setAdminSessionState({
      isAuthenticated: true,
      username: adminAuthenticationResult.username,
      sessionExpiresAtInSeconds: adminAuthenticationResult.sessionExpiresAtInSeconds,
    })
    setAdminCredentialsFormState({ username: '', password: '', verificationCode: '' })
  }

  function handleAdminLogoutClick() {
    clearPersistedAdminSessionToken()
    setAdminSessionState({
      isAuthenticated: false,
      username: '',
      sessionExpiresAtInSeconds: null,
    })
    setAdminFeedbackMessage('Sessão administrativa encerrada com segurança.')
  }

  function handleBackgroundHexColorChange(event) {
    const changedBackgroundHexColorValue = event.target.value
    const persistedBackgroundHexColor = persistGlobalBackgroundHexColor(changedBackgroundHexColorValue)
    setGlobalBackgroundHexColor(persistedBackgroundHexColor)
  }

  function syncArticleCatalogState(nextArticleCatalog) {
    setAdminArticleCatalog(nextArticleCatalog)
    onArticleCatalogChange(nextArticleCatalog)
  }

  function handleCreationFormInputChange(event) {
    const { name, value } = event.target
    setArticleCreationFormState((currentState) => ({ ...currentState, [name]: value }))
  }

  function handleArticleCreationSubmission(event) {
    event.preventDefault()

    const articleCreationResult = articlePublicationController.createArticle(
      { ...articleCreationFormState, galleryImageUrls: creationGalleryUrlDraftCatalog },
      'admin-article-creation-flow'
    )

    setArticleFeedbackMessage(articleCreationResult.publicMessage)

    if (articleCreationResult.statusCode !== 200) {
      return
    }

    syncArticleCatalogState(articleCreationResult.articleCatalog)
    setArticleCreationFormState(globalEmptyArticleFormState)
    setCreationGalleryUrlDraftCatalog([])
  }

  function handleEditArticleClick(articleData) {
    setEditingArticleIdentifier(articleData.id)
    setArticleEditFormState({
      title: articleData.title,
      subtitle: articleData.subtitle,
      description: articleData.description,
      imageUrl: articleData.imageUrl,
      imageAlternativeText: articleData.imageAlternativeText,
    })
    setEditGalleryUrlDraftCatalog([...(articleData.galleryImageUrls ?? [])])
    setArticleFeedbackMessage('')
  }

  function handleCancelEditClick() {
    setEditingArticleIdentifier(null)
    setArticleEditFormState(globalEmptyArticleFormState)
    setEditGalleryUrlDraftCatalog([])
  }

  function handleEditFormInputChange(event) {
    const { name, value } = event.target
    setArticleEditFormState((currentState) => ({ ...currentState, [name]: value }))
  }

  function handleArticleEditSubmission(event) {
    event.preventDefault()

    const articleUpdateResult = articlePublicationController.updateArticle(
      editingArticleIdentifier,
      { ...articleEditFormState, galleryImageUrls: editGalleryUrlDraftCatalog },
      'admin-article-edit-flow'
    )

    setArticleFeedbackMessage(articleUpdateResult.publicMessage)

    if (articleUpdateResult.statusCode !== 200) {
      return
    }

    syncArticleCatalogState(articleUpdateResult.articleCatalog)
    handleCancelEditClick()
  }

  function handleArticleVisibilityToggle(articleIdentifier) {
    const articleToggleResult = articlePublicationController.toggleArticlePublication(
      articleIdentifier,
      'admin-article-toggle-flow'
    )

    setArticleFeedbackMessage(articleToggleResult.publicMessage)

    if (articleToggleResult.statusCode === 200) {
      syncArticleCatalogState(articleToggleResult.articleCatalog)
    }
  }

  function handleArticleDeletion(articleIdentifier) {
    const articleDeletionResult = articlePublicationController.deleteArticle(articleIdentifier, 'admin-article-delete-flow')

    setArticleFeedbackMessage(articleDeletionResult.publicMessage)

    if (articleDeletionResult.statusCode === 200) {
      if (editingArticleIdentifier === articleIdentifier) {
        handleCancelEditClick()
      }
      syncArticleCatalogState(articleDeletionResult.articleCatalog)
    }
  }

  function handleDragStart(event, sourceIndex) {
    dragSourceIndexRef.current = sourceIndex
    event.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(event) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(event, destinationIndex) {
    event.preventDefault()
    const sourceIndex = dragSourceIndexRef.current

    if (sourceIndex === null || sourceIndex === destinationIndex) {
      dragSourceIndexRef.current = null
      return
    }

    const articleReorderResult = articlePublicationController.reorderArticleByDragAndDrop(
      sourceIndex,
      destinationIndex,
      'admin-article-drag-reorder-flow'
    )

    setArticleFeedbackMessage(articleReorderResult.publicMessage)

    if (articleReorderResult.statusCode === 200) {
      syncArticleCatalogState(articleReorderResult.articleCatalog)
    }

    dragSourceIndexRef.current = null
  }

  const adminSessionExpiresAtLabel = adminSessionState.sessionExpiresAtInSeconds
    ? new Date(adminSessionState.sessionExpiresAtInSeconds * 1000).toLocaleString('pt-BR')
    : '-'

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">
      <header className="cute-box mb-8 flex flex-wrap items-center justify-between gap-4 bg-paperWhite px-6 py-5">
        <div>
          <h1 className="text-3xl font-display text-inkBlack">Painel Admin Privado</h1>
          <p className="text-sm font-bold text-inkBlack/80">
            Acesso protegido por login, senha e código de verificação em duas etapas.
          </p>
        </div>
        <button
          type="button"
          className="cute-button flex h-11 items-center justify-center gap-2 bg-pastelBlue px-5 py-2 text-sm"
          onClick={onNavigateBackToLanding}
        >
          <FaArrowLeft aria-hidden="true" />
          <span>Voltar para o início</span>
        </button>
      </header>

      {!adminSessionState.isAuthenticated ? (
        <section className="cute-box bg-pastelPink p-6 sm:p-8" aria-labelledby="adminAccessHeading">
          <h2 id="adminAccessHeading" className="text-2xl font-display text-inkBlack">Autenticação Administrativa</h2>
          <form className="mt-6 grid gap-5" onSubmit={handleAdminAuthenticationSubmission}>
            <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
              Usuário
              <input
                className="cute-input mt-2 w-full"
                name="username"
                type="text"
                value={adminCredentialsFormState.username}
                onChange={handleAdminCredentialsInputChange}
                placeholder="admin"
                autoComplete="username"
                required
              />
            </label>

            <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
              Senha
              <input
                className="cute-input mt-2 w-full"
                name="password"
                type="password"
                value={adminCredentialsFormState.password}
                onChange={handleAdminCredentialsInputChange}
                placeholder="********"
                autoComplete="current-password"
                required
              />
            </label>

            <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
              Código de verificação
              <input
                className="cute-input mt-2 w-full"
                name="verificationCode"
                type="password"
                value={adminCredentialsFormState.verificationCode}
                onChange={handleAdminCredentialsInputChange}
                placeholder="0000"
                autoComplete="one-time-code"
                required
              />
            </label>

            <button type="submit" className="cute-button mt-2 flex items-center justify-center gap-2 bg-pastelMint">
              <FaLock aria-hidden="true" />
              <span>Acessar painel</span>
            </button>
          </form>

          {adminFeedbackMessage ? (
            <p className="cute-box mt-5 bg-paperWhite px-4 py-3 text-sm font-black text-inkBlack" role="status">
              {adminFeedbackMessage}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="grid gap-6" aria-label="Configurações administrativas">
          <article className="cute-box bg-paperWhite p-6 sm:p-8">
            <h2 className="text-2xl font-display text-inkBlack">Sessão ativa</h2>
            <p className="mt-2 text-sm font-bold text-inkBlack/80">Administrador: {adminSessionState.username}</p>
            <p className="mt-1 text-sm font-bold text-inkBlack/80">Expira em: {adminSessionExpiresAtLabel}</p>

            <button
              type="button"
              className="cute-button mt-5 flex items-center justify-center gap-2 bg-pastelPink px-5 py-2 text-sm"
              onClick={handleAdminLogoutClick}
            >
              <FaSignOutAlt aria-hidden="true" />
              <span>Encerrar sessão</span>
            </button>
          </article>

          <article className="cute-box bg-pastelYellow p-6 sm:p-8">
            <h2 className="text-2xl font-display text-inkBlack">Personalização global</h2>
            <p className="mt-2 text-sm font-bold text-inkBlack/80">
              Defina a cor de fundo padrão da landing page. A alteração é aplicada imediatamente.
            </p>

            <label className="mt-5 block text-xs font-black uppercase tracking-wider text-inkBlack">
              Cor de fundo da landing
              <input
                className="mt-3 h-14 w-full cursor-pointer rounded-xl border-4 border-inkBlack bg-paperWhite p-2"
                type="color"
                value={globalBackgroundHexColor}
                onChange={handleBackgroundHexColorChange}
                aria-label="Cor de fundo global da landing"
              />
            </label>

            <span className="mt-4 inline-block rounded-xl border-2 border-inkBlack bg-paperWhite px-3 py-2 text-sm font-black text-inkBlack">
              Hex atual: {globalBackgroundHexColor}
            </span>
          </article>

          <article className="cute-box bg-pastelBlue p-6 sm:p-8">
            <h2 className="text-2xl font-display text-inkBlack">Publicação de artigos</h2>
            <p className="mt-2 text-sm font-bold text-inkBlack/80">
              Crie, edite, publique, oculte, reordene arrastando e remova artigos exibidos na landing.
            </p>

            <form className="mt-5" onSubmit={handleArticleCreationSubmission}>
              <ArticleFormFields
                formState={articleCreationFormState}
                onInputChange={handleCreationFormInputChange}
                galleryUrlDraftCatalog={creationGalleryUrlDraftCatalog}
                onGalleryUrlDraftCatalogChange={setCreationGalleryUrlDraftCatalog}
                submitLabel="Publicar artigo"
                onCancelClick={null}
              />
            </form>

            {articleFeedbackMessage ? (
              <p className="cute-box mt-4 bg-paperWhite px-4 py-3 text-sm font-black text-inkBlack" role="status">
                {articleFeedbackMessage}
              </p>
            ) : null}

            <ul className="mt-6 grid gap-3" aria-label="Lista de artigos">
              {adminArticleCatalog.map((articleData, articleIndex) => (
                <li
                  key={articleData.id}
                  draggable
                  onDragStart={(event) => handleDragStart(event, articleIndex)}
                  onDragOver={handleDragOver}
                  onDrop={(event) => handleDrop(event, articleIndex)}
                  className="cute-box cursor-grab bg-paperWhite p-4 active:cursor-grabbing"
                >
                  {editingArticleIdentifier === articleData.id ? (
                    <form onSubmit={handleArticleEditSubmission}>
                      <header className="mb-4">
                        <h3 className="text-base font-display text-inkBlack">Editando: {articleData.title}</h3>
                      </header>
                      <ArticleFormFields
                        formState={articleEditFormState}
                        onInputChange={handleEditFormInputChange}
                        galleryUrlDraftCatalog={editGalleryUrlDraftCatalog}
                        onGalleryUrlDraftCatalogChange={setEditGalleryUrlDraftCatalog}
                        submitLabel="Salvar alterações"
                        onCancelClick={handleCancelEditClick}
                      />
                    </form>
                  ) : (
                    <>
                      <header className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <FaGripVertical
                            className="shrink-0 text-inkBlack/30"
                            aria-hidden="true"
                            title="Arraste para reordenar"
                          />
                          <div>
                            <h3 className="text-lg font-display text-inkBlack">{articleData.title}</h3>
                            <p className="text-xs font-bold uppercase tracking-wider text-inkBlack/70">
                              {articleData.subtitle}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {articleData.galleryImageUrls?.length > 0 && (
                            <span className="rounded-lg border-2 border-inkBlack bg-pastelBlue px-2 py-1 text-xs font-black uppercase">
                              {articleData.galleryImageUrls.length} foto
                              {articleData.galleryImageUrls.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          <span className="rounded-lg border-2 border-inkBlack bg-pastelYellow px-2 py-1 text-xs font-black uppercase">
                            {articleData.isPublished ? 'Publicado' : 'Oculto'}
                          </span>
                        </div>
                      </header>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="cute-button flex h-10 items-center justify-center gap-1 bg-pastelYellow px-4 py-1 text-xs"
                          onClick={() => handleEditArticleClick(articleData)}
                        >
                          <FaEdit aria-hidden="true" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          className="cute-button h-10 bg-pastelMint px-4 py-1 text-xs"
                          onClick={() => handleArticleVisibilityToggle(articleData.id)}
                        >
                          {articleData.isPublished ? 'Ocultar' : 'Publicar'}
                        </button>
                        <button
                          type="button"
                          className="cute-button flex h-10 items-center justify-center gap-1 bg-pastelPink px-4 py-1 text-xs"
                          onClick={() => handleArticleDeletion(articleData.id)}
                        >
                          <FaTrash aria-hidden="true" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </article>
        </section>
      )}
    </main>
  )
}
