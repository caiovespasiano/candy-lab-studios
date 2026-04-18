import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Reorder } from 'framer-motion'
import { FaArrowLeft, FaEdit, FaGripVertical, FaLock, FaPlus, FaSignOutAlt, FaTrash, FaUpload } from 'react-icons/fa'
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
import {
  loadPersistedArticleCatalogFromProject,
  persistArticleCatalogToProject,
  uploadArticleImageToProject,
} from '../services/projectPersistenceGatewayService'

const globalDefaultAdminAuthenticationGatewayClient = {
  async requestAdminAuthentication(sanitizedAdminCredentials) {
    const authenticationResponse = await fetch('/api/admin/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(sanitizedAdminCredentials),
    })

    const authenticationPayload = await authenticationResponse.json().catch(() => ({}))

    return {
      statusCode: Number(authenticationPayload.statusCode || authenticationResponse.status || 500),
      payload: {
        message: String(authenticationPayload.message || 'Falha na autenticação administrativa.'),
        sessionToken: authenticationPayload.sessionToken,
        sessionExpiresAtInSeconds: authenticationPayload.sessionExpiresAtInSeconds,
        username: authenticationPayload.username,
      },
    }
  },
}

function resolveEmptyAdminSessionState() {
  return {
    isAuthenticated: false,
    username: '',
    sessionExpiresAtInSeconds: null,
  }
}

const globalEmptyArticleFormState = {
  title: '',
  subtitle: '',
  description: '',
  imageUrl: '',
  imageAlternativeText: '',
}

const globalAllowedImageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
const globalMaxUploadFileSizeInBytes = 10 * 1024 * 1024
const globalProjectPersistenceFallbackMessage =
  'API local indisponível: alterações salvas apenas no armazenamento do navegador.'

function convertImageFileToWebpDataUrl(imageFile) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(imageFile)
    const imageElement = new Image()

    imageElement.onload = () => {
      const canvasElement = document.createElement('canvas')
      canvasElement.width = imageElement.naturalWidth
      canvasElement.height = imageElement.naturalHeight
      const canvasContext = canvasElement.getContext('2d')
      canvasContext.drawImage(imageElement, 0, 0)
      URL.revokeObjectURL(objectUrl)
      canvasElement.toBlob(
        (blobResult) => {
          if (!blobResult) {
            reject(new Error('Conversão para WebP falhou.'))
            return
          }
          const fileReader = new FileReader()
          fileReader.onload = () => resolve(fileReader.result)
          fileReader.onerror = () => reject(new Error('Leitura do arquivo falhou.'))
          fileReader.readAsDataURL(blobResult)
        },
        'image/webp',
        0.92
      )
    }

    imageElement.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Carregamento da imagem falhou.'))
    }

    imageElement.src = objectUrl
  })
}

function GalleryUrlEditor({ galleryImageUrlDraftCatalog, onGalleryUrlDraftCatalogChange, onImageUpload }) {
  const [galleryUrlInputValue, setGalleryUrlInputValue] = useState('')
  const [uploadConversionError, setUploadConversionError] = useState('')
  const [isConvertingUpload, setIsConvertingUpload] = useState(false)
  const fileInputRef = useRef(null)

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

  async function handleGalleryImageFileChange(event) {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''

    if (!selectedFile) return

    if (!globalAllowedImageMimeTypes.includes(selectedFile.type)) {
      setUploadConversionError('Formato não suportado. Use JPG, PNG, GIF, WebP ou AVIF.')
      return
    }

    if (selectedFile.size > globalMaxUploadFileSizeInBytes) {
      setUploadConversionError('Arquivo muito grande. Limite: 10 MB.')
      return
    }

    setUploadConversionError('')
    setIsConvertingUpload(true)

    try {
      const webpDataUrl = await convertImageFileToWebpDataUrl(selectedFile)
      const persistedImageUrl = await onImageUpload(webpDataUrl, selectedFile.name || 'gallery-image')
      onGalleryUrlDraftCatalogChange([...galleryImageUrlDraftCatalog, persistedImageUrl])
    } catch {
      setUploadConversionError('Não foi possível enviar a imagem para a pasta do projeto.')
    } finally {
      setIsConvertingUpload(false)
    }
  }

  return (
    <div className="w-full min-w-0">
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
          className="cute-button flex h-12 w-12 shrink-0 items-center justify-center bg-pastelMint p-0!"
          aria-label="Adicionar URL à galeria"
        >
          <FaPlus aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isConvertingUpload}
          className="cute-button flex h-12 w-12 shrink-0 items-center justify-center bg-pastelBlue p-0! text-base disabled:opacity-60"
          aria-label="Fazer upload de imagem"
          title="Upload (converte para WebP)"
        >
          {isConvertingUpload ? (
            <span className="text-xs font-black">...</span>
          ) : (
            <FaUpload aria-hidden="true" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleGalleryImageFileChange}
          aria-label="Selecionar imagem para upload"
        />
      </div>
      {uploadConversionError && (
        <p className="mt-1 text-xs font-black text-red-700" role="alert">{uploadConversionError}</p>
      )}
      {galleryImageUrlDraftCatalog.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {galleryImageUrlDraftCatalog.map((galleryUrl, urlIndex) => (
            <li
              key={`${urlIndex}-${galleryUrl.slice(0, 40)}`}
              className="flex min-w-0 overflow-hidden items-center gap-2 rounded-xl border-2 border-inkBlack bg-paperWhite px-3 py-2"
            >
              <img
                src={galleryUrl}
                alt={`Pré-visualização ${urlIndex + 1}`}
                className="h-10 w-14 shrink-0 rounded-lg border border-inkBlack/20 object-cover"
                loading="lazy"
              />
              <span className="flex-1 truncate text-xs font-bold text-inkBlack/70">
                {galleryUrl.startsWith('data:') ? `[upload ${urlIndex + 1}]` : galleryUrl}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveGalleryUrlAtIndex(urlIndex)}
                className="cute-control-button cute-control-button-close h-8 w-8 shrink-0 text-sm"
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
  onImageUpload,
}) {
  const [mainImageUploadConversionError, setMainImageUploadConversionError] = useState('')
  const [isMainImageUploadConverting, setIsMainImageUploadConverting] = useState(false)
  const mainImageFileInputRef = useRef(null)

  async function handleMainImageFileChange(event) {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''

    if (!selectedFile) return

    if (!globalAllowedImageMimeTypes.includes(selectedFile.type)) {
      setMainImageUploadConversionError('Formato não suportado. Use JPG, PNG, GIF, WebP ou AVIF.')
      return
    }

    if (selectedFile.size > globalMaxUploadFileSizeInBytes) {
      setMainImageUploadConversionError('Arquivo muito grande. Limite: 10 MB.')
      return
    }

    setMainImageUploadConversionError('')
    setIsMainImageUploadConverting(true)

    try {
      const webpDataUrl = await convertImageFileToWebpDataUrl(selectedFile)
      const persistedImageUrl = await onImageUpload(webpDataUrl, selectedFile.name || 'main-image')
      onInputChange({
        target: {
          name: 'imageUrl',
          value: persistedImageUrl,
        },
      })
    } catch {
      setMainImageUploadConversionError('Não foi possível enviar a imagem principal para a pasta do projeto.')
    } finally {
      setIsMainImageUploadConverting(false)
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
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
        <div className="mt-2 flex gap-2">
          <input
            className="cute-input w-full"
            name="imageUrl"
            type="url"
            value={formState.imageUrl}
            onChange={onInputChange}
            required
            placeholder="https://exemplo.com/imagem.jpg ou upload"
          />
          <button
            type="button"
            onClick={() => mainImageFileInputRef.current?.click()}
            disabled={isMainImageUploadConverting}
            className="cute-button flex h-12 w-12 shrink-0 items-center justify-center bg-pastelBlue p-0! text-base disabled:opacity-60"
            aria-label="Fazer upload da imagem principal"
            title="Upload da imagem principal (converte para WebP)"
          >
            {isMainImageUploadConverting ? (
              <span className="text-xs font-black">...</span>
            ) : (
              <FaUpload aria-hidden="true" />
            )}
          </button>
          <input
            ref={mainImageFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleMainImageFileChange}
            aria-label="Selecionar imagem principal para upload"
          />
        </div>
        {mainImageUploadConversionError && (
          <p className="mt-1 text-xs font-black text-red-700" role="alert">{mainImageUploadConversionError}</p>
        )}
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
        onImageUpload={onImageUpload}
      />
      <div className="flex min-w-0 gap-3 pt-1">
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

const ArticleReorderItem = memo(function ArticleReorderItem({ articleData, onDragStart, onDragEnd, onEdit, onToggleVisibility, onDelete }) {
  return (
    <Reorder.Item
      value={articleData}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      dragMomentum={false}
      className="relative list-none rounded-xl border-4 border-inkBlack bg-paperWhite shadow-[6px_6px_0px_0px_#111111] cursor-grab p-4 active:cursor-grabbing"
    >
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
          onClick={() => onEdit(articleData)}
        >
          <FaEdit aria-hidden="true" />
          <span>Editar</span>
        </button>
        <button
          type="button"
          className="cute-button h-10 bg-pastelMint px-4 py-1 text-xs"
          onClick={() => onToggleVisibility(articleData.id)}
        >
          {articleData.isPublished ? 'Ocultar' : 'Publicar'}
        </button>
        <button
          type="button"
          className="cute-button flex h-10 items-center justify-center gap-1 bg-pastelPink px-4 py-1 text-xs"
          onClick={() => onDelete(articleData.id)}
        >
          <FaTrash aria-hidden="true" />
          <span>Excluir</span>
        </button>
      </div>
    </Reorder.Item>
  )
})

export function AdminAccessPanel({ articlePublicationController, onArticleCatalogChange, onNavigateBackToLanding }) {
  const [adminCredentialsFormState, setAdminCredentialsFormState] = useState({
    username: '',
    password: '',
    verificationCode: '',
  })
  const [adminSessionState, setAdminSessionState] = useState(resolveEmptyAdminSessionState)
  const [adminFeedbackMessage, setAdminFeedbackMessage] = useState('')
  const [articleFeedbackMessage, setArticleFeedbackMessage] = useState('')
  const initialAdminArticleCatalog = articlePublicationController.listAllArticleCatalog().articleCatalog
  const [articleCreationFormState, setArticleCreationFormState] = useState(globalEmptyArticleFormState)
  const [creationGalleryUrlDraftCatalog, setCreationGalleryUrlDraftCatalog] = useState([])
  const [editingArticleIdentifier, setEditingArticleIdentifier] = useState(null)
  const [articleEditFormState, setArticleEditFormState] = useState(globalEmptyArticleFormState)
  const [editGalleryUrlDraftCatalog, setEditGalleryUrlDraftCatalog] = useState([])
  const [globalBackgroundHexColor, setGlobalBackgroundHexColor] = useState(() => {
    return loadPersistedGlobalBackgroundHexColor()
  })
  const [sortableArticleCatalog, setSortableArticleCatalog] = useState(initialAdminArticleCatalog)
  const currentSortOrderRef = useRef(initialAdminArticleCatalog)
  const preDragCatalogRef = useRef(null)
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false)

  const handleImageUploadToProject = useCallback(async (imageDataUrl, sourceLabel) => {
    try {
      const uploadResponse = await uploadArticleImageToProject({ imageDataUrl, sourceLabel })
      return String(uploadResponse.imageUrl || imageDataUrl)
    } catch {
      setArticleFeedbackMessage(globalProjectPersistenceFallbackMessage)
      return imageDataUrl
    }
  }, [])

  const syncArticleCatalogState = useCallback((nextArticleCatalog) => {
    setSortableArticleCatalog(nextArticleCatalog)
    currentSortOrderRef.current = nextArticleCatalog
    onArticleCatalogChange(nextArticleCatalog)
  }, [onArticleCatalogChange])

  const persistArticleCatalogToProjectAndSyncStorage = useCallback(async (articleCatalog) => {
    const persistResponse = await persistArticleCatalogToProject(articleCatalog)
    const persistedCatalog = Array.isArray(persistResponse.articleCatalog)
      ? persistResponse.articleCatalog
      : articleCatalog

    const reorderResult = articlePublicationController.applyArticleCatalogReorder(
      persistedCatalog,
      'admin-project-catalog-sync-flow'
    )

    syncArticleCatalogState(reorderResult.articleCatalog)
    return reorderResult
  }, [articlePublicationController, syncArticleCatalogState])

  useEffect(() => {
    async function restoreAdminSessionFromStorage() {
      const restoredAdminSession = await restoreValidAdminSessionData()
      if (restoredAdminSession.isAuthenticated) {
        setAdminSessionState({
          isAuthenticated: true,
          username: restoredAdminSession.sessionData.username,
          sessionExpiresAtInSeconds: restoredAdminSession.sessionData.expiresAtInSeconds,
        })
      }
    }
    restoreAdminSessionFromStorage()
  }, [])

  useEffect(() => {
    applyGlobalBackgroundHexColor(globalBackgroundHexColor)
  }, [globalBackgroundHexColor])

  useEffect(() => {
    let isSubscriptionActive = true

    async function restoreProjectCatalogFromDisk() {
      try {
        const projectCatalogResponse = await loadPersistedArticleCatalogFromProject()
        if (!Array.isArray(projectCatalogResponse.articleCatalog)) {
          return
        }

        const reorderResult = articlePublicationController.applyArticleCatalogReorder(
          projectCatalogResponse.articleCatalog,
          'admin-project-catalog-bootstrap-flow'
        )

        if (!isSubscriptionActive) {
          return
        }

        syncArticleCatalogState(reorderResult.articleCatalog)
      } catch {
        if (isSubscriptionActive) {
          const fallbackCatalog = articlePublicationController.listAllArticleCatalog().articleCatalog
          syncArticleCatalogState(fallbackCatalog)
          setArticleFeedbackMessage(globalProjectPersistenceFallbackMessage)
        }
      }
    }

    restoreProjectCatalogFromDisk()

    return () => {
      isSubscriptionActive = false
    }
  }, [articlePublicationController, syncArticleCatalogState])

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

  async function handleAdminLogoutClick() {
    await clearPersistedAdminSessionToken()
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

  function handleCreationFormInputChange(event) {
    const { name, value } = event.target
    setArticleCreationFormState((currentState) => ({ ...currentState, [name]: value }))
  }

  async function handleArticleCreationSubmission(event) {
    event.preventDefault()

    const articleCreationResult = articlePublicationController.createArticle(
      { ...articleCreationFormState, galleryImageUrls: creationGalleryUrlDraftCatalog },
      'admin-article-creation-flow'
    )

    setArticleFeedbackMessage(articleCreationResult.publicMessage)

    if (articleCreationResult.statusCode !== 200) {
      return
    }

    try {
      const persistedArticleCatalogResult = await persistArticleCatalogToProjectAndSyncStorage(articleCreationResult.articleCatalog)
      setArticleFeedbackMessage(persistedArticleCatalogResult.publicMessage)
    } catch {
      syncArticleCatalogState(articleCreationResult.articleCatalog)
      setArticleFeedbackMessage(globalProjectPersistenceFallbackMessage)
    }

    setArticleCreationFormState(globalEmptyArticleFormState)
    setCreationGalleryUrlDraftCatalog([])
    handleCloseArticleModal()
  }

  function handleOpenArticleCreationModal() {
    setArticleCreationFormState(globalEmptyArticleFormState)
    setCreationGalleryUrlDraftCatalog([])
    setIsArticleModalOpen(true)
  }

  function handleCloseArticleModal() {
    setIsArticleModalOpen(false)
    setEditingArticleIdentifier(null)
    setArticleEditFormState(globalEmptyArticleFormState)
    setEditGalleryUrlDraftCatalog([])
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
    setIsArticleModalOpen(true)
  }

  function handleCancelEditClick() {
    handleCloseArticleModal()
  }

  function handleEditFormInputChange(event) {
    const { name, value } = event.target
    setArticleEditFormState((currentState) => ({ ...currentState, [name]: value }))
  }

  async function handleArticleEditSubmission(event) {
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

    try {
      const persistedArticleCatalogResult = await persistArticleCatalogToProjectAndSyncStorage(articleUpdateResult.articleCatalog)
      setArticleFeedbackMessage(persistedArticleCatalogResult.publicMessage)
    } catch {
      syncArticleCatalogState(articleUpdateResult.articleCatalog)
      setArticleFeedbackMessage(globalProjectPersistenceFallbackMessage)
    }

    handleCancelEditClick()
  }

  async function handleArticleVisibilityToggle(articleIdentifier) {
    const articleToggleResult = articlePublicationController.toggleArticlePublication(
      articleIdentifier,
      'admin-article-toggle-flow'
    )

    setArticleFeedbackMessage(articleToggleResult.publicMessage)

    if (articleToggleResult.statusCode !== 200) {
      return
    }

    try {
      const persistedArticleCatalogResult = await persistArticleCatalogToProjectAndSyncStorage(articleToggleResult.articleCatalog)
      setArticleFeedbackMessage(persistedArticleCatalogResult.publicMessage)
    } catch {
      syncArticleCatalogState(articleToggleResult.articleCatalog)
      setArticleFeedbackMessage(globalProjectPersistenceFallbackMessage)
    }
  }

  async function handleArticleDeletion(articleIdentifier) {
    const articleDeletionResult = articlePublicationController.deleteArticle(articleIdentifier, 'admin-article-delete-flow')

    setArticleFeedbackMessage(articleDeletionResult.publicMessage)

    if (articleDeletionResult.statusCode !== 200) {
      return
    }

    try {
      const persistedArticleCatalogResult = await persistArticleCatalogToProjectAndSyncStorage(articleDeletionResult.articleCatalog)
      setArticleFeedbackMessage(persistedArticleCatalogResult.publicMessage)
      if (editingArticleIdentifier === articleIdentifier) {
        handleCancelEditClick()
      }
    } catch {
      syncArticleCatalogState(articleDeletionResult.articleCatalog)
      setArticleFeedbackMessage(globalProjectPersistenceFallbackMessage)
      if (editingArticleIdentifier === articleIdentifier) {
        handleCancelEditClick()
      }
    }
  }

  function handleSortableReorder(reorderedCatalog) {
    currentSortOrderRef.current = reorderedCatalog
    setSortableArticleCatalog(reorderedCatalog)
  }

  const handleItemDragStart = useCallback(function handleItemDragStart() {
    preDragCatalogRef.current = [...currentSortOrderRef.current]
  }, [])

  const handleItemDragEnd = useCallback(async function handleItemDragEnd() {
    const previousCatalog = preDragCatalogRef.current
    const nextCatalog = currentSortOrderRef.current

    if (!previousCatalog) return

    const hasOrderChanged = nextCatalog.some((article, index) => article.id !== previousCatalog[index].id)

    if (hasOrderChanged) {
      const reorderResult = articlePublicationController.applyArticleCatalogReorder(
        nextCatalog,
        'admin-article-drag-reorder-flow'
      )
      setArticleFeedbackMessage(reorderResult.publicMessage)
      if (reorderResult.statusCode === 200) {
        try {
          const persistedArticleCatalogResult = await persistArticleCatalogToProjectAndSyncStorage(reorderResult.articleCatalog)
          setArticleFeedbackMessage(persistedArticleCatalogResult.publicMessage)
        } catch {
          syncArticleCatalogState(reorderResult.articleCatalog)
          setArticleFeedbackMessage(globalProjectPersistenceFallbackMessage)
        }
      }
    }

    preDragCatalogRef.current = null
  }, [articlePublicationController, persistArticleCatalogToProjectAndSyncStorage, syncArticleCatalogState])

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

            <label className="mt-5 flex items-center gap-4 text-xs font-black uppercase tracking-wider text-inkBlack">
              Cor de fundo da landing
              <input
                className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border-4 border-inkBlack bg-paperWhite p-0.5"
                type="color"
                value={globalBackgroundHexColor}
                onChange={handleBackgroundHexColorChange}
                aria-label="Cor de fundo global da landing"
              />
              <span className="rounded-xl border-2 border-inkBlack bg-paperWhite px-3 py-1 text-sm font-black normal-case tracking-normal">
                {globalBackgroundHexColor}
              </span>
            </label>
          </article>

          <article className="cute-box bg-pastelBlue p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-display text-inkBlack">Publicação de artigos</h2>
                <p className="mt-1 text-sm font-bold text-inkBlack/80">
                  Crie, edite, publique, oculte, reordene arrastando e remova artigos.
                </p>
              </div>
              <button
                type="button"
                className="cute-button flex items-center justify-center gap-2 bg-pastelMint px-5 py-2 text-sm"
                onClick={handleOpenArticleCreationModal}
              >
                <FaPlus aria-hidden="true" />
                <span>Novo artigo</span>
              </button>
            </div>

            {articleFeedbackMessage ? (
              <p className="cute-box mt-4 bg-paperWhite px-4 py-3 text-sm font-black text-inkBlack" role="status">
                {articleFeedbackMessage}
              </p>
            ) : null}

            <Reorder.Group
              as="ul"
              axis="y"
              values={sortableArticleCatalog}
              onReorder={handleSortableReorder}
              className="mt-6 flex flex-col gap-3"
              aria-label="Lista de artigos"
            >
              {sortableArticleCatalog.map((articleData) => (
                <ArticleReorderItem
                  key={articleData.id}
                  articleData={articleData}
                  onDragStart={handleItemDragStart}
                  onDragEnd={handleItemDragEnd}
                  onEdit={handleEditArticleClick}
                  onToggleVisibility={handleArticleVisibilityToggle}
                  onDelete={handleArticleDeletion}
                />
              ))}
            </Reorder.Group>
          </article>
        </section>
      )}

      {isArticleModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-inkBlack/80 px-4 py-10 backdrop-blur-sm"
          onClick={handleCloseArticleModal}
          aria-modal="true"
          role="dialog"
          aria-label={editingArticleIdentifier ? 'Editar artigo' : 'Novo artigo'}
        >
          <article
            className="relative mx-auto w-full max-w-2xl rounded-xl border-4 border-inkBlack bg-paperWhite p-6 sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="cute-control-button cute-control-button-close absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center text-xl font-black"
              onClick={handleCloseArticleModal}
              aria-label="Fechar modal"
            >
              ×
            </button>

            <h2 className="mb-6 text-2xl font-display text-inkBlack">
              {editingArticleIdentifier ? 'Editar artigo' : 'Novo artigo'}
            </h2>

            {editingArticleIdentifier ? (
              <form onSubmit={handleArticleEditSubmission}>
                <ArticleFormFields
                  formState={articleEditFormState}
                  onInputChange={handleEditFormInputChange}
                  galleryUrlDraftCatalog={editGalleryUrlDraftCatalog}
                  onGalleryUrlDraftCatalogChange={setEditGalleryUrlDraftCatalog}
                  submitLabel="Salvar alterações"
                  onCancelClick={handleCancelEditClick}
                  onImageUpload={handleImageUploadToProject}
                />
              </form>
            ) : (
              <form onSubmit={handleArticleCreationSubmission}>
                <ArticleFormFields
                  formState={articleCreationFormState}
                  onInputChange={handleCreationFormInputChange}
                  galleryUrlDraftCatalog={creationGalleryUrlDraftCatalog}
                  onGalleryUrlDraftCatalogChange={setCreationGalleryUrlDraftCatalog}
                  submitLabel="Publicar artigo"
                  onCancelClick={handleCloseArticleModal}
                  onImageUpload={handleImageUploadToProject}
                />
              </form>
            )}

            {articleFeedbackMessage ? (
              <p className="cute-box mt-4 bg-paperWhite px-4 py-3 text-sm font-black text-inkBlack" role="status">
                {articleFeedbackMessage}
              </p>
            ) : null}
          </article>
        </div>
      )}
    </main>
  )
}
