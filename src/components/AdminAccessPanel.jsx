import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Reorder } from 'framer-motion'
import { FaArrowLeft, FaEdit, FaGripVertical, FaImages, FaLock, FaPlus, FaSignOutAlt, FaTrash, FaUpload } from 'react-icons/fa'
import { requestAdminAuthenticationUsingGateway } from '../services/adminAuthenticationService'
import {
  clearPersistedAdminSessionToken,
  persistAdminSessionToken,
  restoreValidAdminSessionData,
} from '../services/adminAccessSessionService'
import {
  applyGlobalBackgroundImageUrl,
  applyGlobalBackgroundHexColor,
  applyGlobalYellowThemeHexColor,
  loadPersistedGlobalBackgroundImageUrl,
  loadPersistedGlobalBackgroundHexColor,
  loadPersistedGlobalYellowThemeHexColor,
  persistGlobalBackgroundImageUrl,
  persistGlobalBackgroundHexColor,
  persistGlobalYellowThemeHexColor,
} from '../services/globalBackgroundPreferencesService'
import {
  deleteUploadedImageFromProject,
  loadProjectPreferencesFromProject,
  loadPersistedArticleCatalogFromProject,
  loadUploadedImageCatalogFromProject,
  persistArticleCatalogToProject,
  persistProjectPreferencesToProject,
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
  robuxPrice: '0',
  description: '',
  imageUrl: '',
  imageAlternativeText: '',
}

const globalAllowedImageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
const globalMaxUploadFileSizeInBytes = 10 * 1024 * 1024
const globalProjectPersistenceFallbackMessage =
  'API local indisponível: alterações não foram salvas no projeto.'

function resolveProjectPersistenceErrorMessage(caughtError) {
  const statusCode = Number(caughtError?.statusCode || 0)

  if (statusCode === 401) {
    return 'Sessão administrativa expirada. Faça login novamente para salvar no projeto.'
  }

  if (statusCode === 429) {
    return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente salvar novamente.'
  }

  const receivedErrorMessage = String(caughtError?.message || '').trim()
  return receivedErrorMessage || globalProjectPersistenceFallbackMessage
}

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

function readImageFileAsDataUrl(imageFile) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader()
    fileReader.onload = () => resolve(fileReader.result)
    fileReader.onerror = () => reject(new Error('Leitura do arquivo falhou.'))
    fileReader.readAsDataURL(imageFile)
  })
}

async function resolvePreferredUploadDataUrl(imageFile) {
  try {
    return await convertImageFileToWebpDataUrl(imageFile)
  } catch {
    return readImageFileAsDataUrl(imageFile)
  }
}

function resolveCoverImageUrlFromGallery(galleryImageUrlCatalog) {
  if (!Array.isArray(galleryImageUrlCatalog) || galleryImageUrlCatalog.length === 0) {
    return ''
  }

  return String(galleryImageUrlCatalog[0] || '').trim()
}

function GalleryUrlEditor({
  galleryImageUrlDraftCatalog,
  onGalleryUrlDraftCatalogChange,
  onImageUpload,
  onImageDelete,
  reusableUploadedImageUrlCatalog,
}) {
  const [galleryUrlInputValue, setGalleryUrlInputValue] = useState('')
  const [uploadConversionError, setUploadConversionError] = useState('')
  const [isConvertingUpload, setIsConvertingUpload] = useState(false)
  const [isUploadedGalleryOpen, setIsUploadedGalleryOpen] = useState(false)
  const [deletingImageUrl, setDeletingImageUrl] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!isUploadedGalleryOpen || typeof document === 'undefined') {
      return undefined
    }

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
    }
  }, [isUploadedGalleryOpen])

  function appendImageToGallery(nextImageUrl) {
    const normalizedImageUrl = String(nextImageUrl || '').trim()

    if (!normalizedImageUrl) {
      return
    }

    const hasImageAlreadyBeenAdded = galleryImageUrlDraftCatalog.some((galleryImageUrl) => {
      return String(galleryImageUrl || '').trim() === normalizedImageUrl
    })

    if (hasImageAlreadyBeenAdded) {
      return
    }

    onGalleryUrlDraftCatalogChange([...galleryImageUrlDraftCatalog, normalizedImageUrl])
  }

  function handleSelectUploadedImageForArticle(imageUrl) {
    appendImageToGallery(imageUrl)
    setIsUploadedGalleryOpen(false)
  }

  async function handleDeleteUploadedImageFromSystem(imageUrl) {
    const normalizedImageUrl = String(imageUrl || '').trim()

    if (!normalizedImageUrl || deletingImageUrl) {
      return
    }

    setDeletingImageUrl(normalizedImageUrl)

    try {
      const hasDeleteSucceeded = await onImageDelete(normalizedImageUrl)

      if (hasDeleteSucceeded) {
        const nextGalleryImageUrlDraftCatalog = galleryImageUrlDraftCatalog.filter((galleryImageUrl) => {
          return String(galleryImageUrl || '').trim() !== normalizedImageUrl
        })

        onGalleryUrlDraftCatalogChange(nextGalleryImageUrlDraftCatalog)
      }
    } finally {
      setDeletingImageUrl('')
    }
  }

  function handleAddGalleryUrlClick() {
    const trimmedUrl = galleryUrlInputValue.trim()
    if (!trimmedUrl) {
      return
    }

    appendImageToGallery(trimmedUrl)
    setGalleryUrlInputValue('')
  }

  async function handleRemoveGalleryUrlAtIndex(targetIndex) {
    const targetGalleryImageUrl = galleryImageUrlDraftCatalog[targetIndex]
    const nextGalleryImageUrlDraftCatalog = galleryImageUrlDraftCatalog.filter((_, urlIndex) => urlIndex !== targetIndex)

    onGalleryUrlDraftCatalogChange(nextGalleryImageUrlDraftCatalog)

    if (String(targetGalleryImageUrl || '').startsWith('/uploads/')) {
      await onImageDelete(targetGalleryImageUrl)
    }
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
      const uploadDataUrl = await resolvePreferredUploadDataUrl(selectedFile)
      const persistedImageUrl = await onImageUpload(uploadDataUrl, selectedFile.name || 'gallery-image')
      appendImageToGallery(persistedImageUrl)
    } catch {
      setUploadConversionError('Não foi possível enviar a imagem para a pasta do projeto.')
    } finally {
      setIsConvertingUpload(false)
    }
  }

  const uploadedGalleryModal = isUploadedGalleryOpen && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="fixed inset-0 z-80 min-h-dvh overflow-y-auto bg-inkBlack/70 px-4 py-8 backdrop-blur-sm"
        onClick={() => setIsUploadedGalleryOpen(false)}
        role="dialog"
        aria-modal="true"
        aria-label="Galeria"
      >
        <article
          className="relative mx-auto w-full max-w-3xl rounded-xl border-4 border-inkBlack bg-paperWhite p-6 sm:p-8"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setIsUploadedGalleryOpen(false)}
            className="cute-control-button cute-control-button-close absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center text-xl font-black"
            aria-label="Fechar galeria"
          >
            ×
          </button>

          <h3 className="mb-6 text-2xl font-display text-inkBlack">Galeria</h3>

          <div className="max-h-[65vh] overflow-y-auto pr-1">
            {reusableUploadedImageUrlCatalog.length === 0 ? (
              <p className="text-xs font-bold text-inkBlack/70">Nenhuma imagem foi encontrada na galeria.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {reusableUploadedImageUrlCatalog.map((imageUrl, imageIndex) => (
                  <li
                    key={`${imageIndex}-${imageUrl}`}
                    className="relative overflow-hidden rounded-xl border-4 border-inkBlack/30 bg-paperWhite"
                  >
                    <img
                      src={imageUrl}
                      alt={`Imagem da galeria ${imageIndex + 1}`}
                      className="h-28 w-full object-cover"
                      loading="lazy"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteUploadedImageFromSystem(imageUrl)}
                      disabled={deletingImageUrl === imageUrl}
                      className="cute-control-button cute-control-button-close absolute right-2 top-2 z-10 h-8 w-8 text-lg disabled:opacity-60"
                      aria-label={`Excluir imagem ${imageIndex + 1} da galeria`}
                      title="Excluir imagem da galeria"
                    >
                      {deletingImageUrl === imageUrl ? '...' : '×'}
                    </button>
                    <div className="p-2">
                      <button
                        type="button"
                        onClick={() => handleSelectUploadedImageForArticle(imageUrl)}
                        className="cute-button h-9 w-full bg-pastelMint px-2 py-1 text-xs"
                      >
                        Usar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>,
      document.body
    )
    : null

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
          onClick={() => setIsUploadedGalleryOpen((isOpen) => !isOpen)}
          className="cute-button flex h-12 w-12 shrink-0 items-center justify-center bg-pastelYellow p-0! text-base"
          aria-label="Abrir galeria"
          title="Abrir galeria"
        >
          <FaImages aria-hidden="true" />
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
      {uploadedGalleryModal}
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
  onImageDelete,
  reusableUploadedImageUrlCatalog,
}) {
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
        Preço em Robux
        <input
          className="cute-input mt-2 w-full"
          name="robuxPrice"
          type="number"
          min="0"
          step="1"
          value={formState.robuxPrice}
          onChange={onInputChange}
          required
        />
      </label>
      <p className="rounded-xl border-2 border-inkBlack bg-pastelBlue/35 px-3 py-2 text-xs font-black text-inkBlack">
        Imagem destaque: a primeira imagem da galeria será usada automaticamente como capa do artigo.
      </p>
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
        onImageDelete={onImageDelete}
        reusableUploadedImageUrlCatalog={reusableUploadedImageUrlCatalog}
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
  const [globalBackgroundImageUrl, setGlobalBackgroundImageUrl] = useState(() => {
    return loadPersistedGlobalBackgroundImageUrl()
  })
  const [globalYellowThemeHexColor, setGlobalYellowThemeHexColor] = useState(() => {
    return loadPersistedGlobalYellowThemeHexColor()
  })
  const [uploadedImageUrlCatalog, setUploadedImageUrlCatalog] = useState([])
  const [sortableArticleCatalog, setSortableArticleCatalog] = useState(initialAdminArticleCatalog)
  const currentSortOrderRef = useRef(initialAdminArticleCatalog)
  const preDragCatalogRef = useRef(null)
  const shouldCloseArticleModalFromOverlayClickRef = useRef(false)
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false)

  const refreshUploadedImageCatalog = useCallback(async () => {
    const uploadedImageResponse = await loadUploadedImageCatalogFromProject()
    const normalizedUploadedImageUrlCatalog = Array.isArray(uploadedImageResponse.imageUrlCatalog)
      ? uploadedImageResponse.imageUrlCatalog
      : []

    setUploadedImageUrlCatalog(normalizedUploadedImageUrlCatalog)
    return normalizedUploadedImageUrlCatalog
  }, [])

  const handleImageUploadToProject = useCallback(async (imageDataUrl, sourceLabel) => {
    try {
      const uploadResponse = await uploadArticleImageToProject({ imageDataUrl, sourceLabel })
      const persistedImageUrl = String(uploadResponse.imageUrl || '').trim()

      if (persistedImageUrl) {
        setUploadedImageUrlCatalog((currentUploadedImageUrlCatalog) => {
          if (currentUploadedImageUrlCatalog.includes(persistedImageUrl)) {
            return currentUploadedImageUrlCatalog
          }

          return [persistedImageUrl, ...currentUploadedImageUrlCatalog]
        })
      }

      return persistedImageUrl || imageDataUrl
    } catch (caughtError) {
      setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
      throw caughtError
    }
  }, [])

  const handleImageDeleteFromProject = useCallback(async (imageUrl) => {
    try {
      await deleteUploadedImageFromProject(imageUrl)
      setUploadedImageUrlCatalog((currentUploadedImageUrlCatalog) => {
        return currentUploadedImageUrlCatalog.filter((currentImageUrl) => currentImageUrl !== imageUrl)
      })
      return true
    } catch (caughtError) {
      setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
      return false
    }
  }, [])

  const syncGlobalVisualPreferencesState = useCallback((projectPreferences) => {
    const persistedBackgroundHexColor = persistGlobalBackgroundHexColor(projectPreferences?.backgroundHexColor)
    const persistedBackgroundImageUrl = persistGlobalBackgroundImageUrl(projectPreferences?.backgroundImageUrl)
    const persistedYellowThemeHexColor = persistGlobalYellowThemeHexColor(projectPreferences?.yellowThemeHexColor)

    setGlobalBackgroundHexColor(persistedBackgroundHexColor)
    setGlobalBackgroundImageUrl(persistedBackgroundImageUrl)
    setGlobalYellowThemeHexColor(persistedYellowThemeHexColor)

    return {
      backgroundHexColor: persistedBackgroundHexColor,
      backgroundImageUrl: persistedBackgroundImageUrl,
      yellowThemeHexColor: persistedYellowThemeHexColor,
    }
  }, [])

  const persistGlobalVisualPreferencesToProject = useCallback(async (projectPreferencesOverride) => {
    const requestPayload = {
      backgroundHexColor: globalBackgroundHexColor,
      backgroundImageUrl: globalBackgroundImageUrl,
      yellowThemeHexColor: globalYellowThemeHexColor,
      ...projectPreferencesOverride,
    }

    const persistResponse = await persistProjectPreferencesToProject(requestPayload)
    const persistedProjectPreferences = syncGlobalVisualPreferencesState(
      persistResponse.projectPreferences || requestPayload
    )

    return persistedProjectPreferences
  }, [
    globalBackgroundHexColor,
    globalBackgroundImageUrl,
    globalYellowThemeHexColor,
    syncGlobalVisualPreferencesState,
  ])

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
        refreshUploadedImageCatalog().catch((caughtError) => {
          setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
        })

        setAdminSessionState({
          isAuthenticated: true,
          username: restoredAdminSession.sessionData.username,
          sessionExpiresAtInSeconds: restoredAdminSession.sessionData.expiresAtInSeconds,
        })
      }
    }
    restoreAdminSessionFromStorage()
  }, [refreshUploadedImageCatalog])

  useEffect(() => {
    let isSubscriptionActive = true

    async function restoreProjectVisualPreferences() {
      try {
        const projectPreferencesResponse = await loadProjectPreferencesFromProject()
        if (!isSubscriptionActive) {
          return
        }

        syncGlobalVisualPreferencesState(projectPreferencesResponse.projectPreferences)
      } catch {
        // Keep local fallback values when project API is unavailable.
      }
    }

    restoreProjectVisualPreferences()

    return () => {
      isSubscriptionActive = false
    }
  }, [syncGlobalVisualPreferencesState])

  useEffect(() => {
    applyGlobalBackgroundHexColor(globalBackgroundHexColor)
    applyGlobalBackgroundImageUrl(globalBackgroundImageUrl)
    applyGlobalYellowThemeHexColor(globalYellowThemeHexColor)
  }, [globalBackgroundHexColor, globalBackgroundImageUrl, globalYellowThemeHexColor])

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
          setArticleFeedbackMessage('Não foi possível carregar o catálogo do projeto. Verifique a API local.')
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
    refreshUploadedImageCatalog().catch((caughtError) => {
      setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
    })
    setAdminCredentialsFormState({ username: '', password: '', verificationCode: '' })
  }

  async function handleAdminLogoutClick() {
    await clearPersistedAdminSessionToken()
    setUploadedImageUrlCatalog([])
    setAdminSessionState({
      isAuthenticated: false,
      username: '',
      sessionExpiresAtInSeconds: null,
    })
    setAdminFeedbackMessage('Sessão administrativa encerrada com segurança.')
  }

  async function handleBackgroundHexColorChange(event) {
    const changedBackgroundHexColorValue = event.target.value
    const persistedBackgroundHexColor = persistGlobalBackgroundHexColor(changedBackgroundHexColorValue)
    setGlobalBackgroundHexColor(persistedBackgroundHexColor)

    try {
      await persistGlobalVisualPreferencesToProject({
        backgroundHexColor: persistedBackgroundHexColor,
      })
    } catch (caughtError) {
      setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
    }
  }

  async function handleGlobalYellowThemeHexColorChange(event) {
    const changedYellowThemeHexColorValue = event.target.value
    const persistedYellowThemeHexColor = persistGlobalYellowThemeHexColor(changedYellowThemeHexColorValue)
    setGlobalYellowThemeHexColor(persistedYellowThemeHexColor)

    try {
      await persistGlobalVisualPreferencesToProject({
        yellowThemeHexColor: persistedYellowThemeHexColor,
      })
    } catch (caughtError) {
      setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
    }
  }

  async function handleBackgroundImageUrlChange(event) {
    const changedBackgroundImageUrlValue = event.target.value
    const persistedBackgroundImageUrl = persistGlobalBackgroundImageUrl(changedBackgroundImageUrlValue)
    setGlobalBackgroundImageUrl(persistedBackgroundImageUrl)

    try {
      await persistGlobalVisualPreferencesToProject({
        backgroundImageUrl: persistedBackgroundImageUrl,
      })
    } catch (caughtError) {
      setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
    }
  }

  async function handleBackgroundImagePreviewSelection(selectedBackgroundImageUrlValue) {
    const persistedBackgroundImageUrl = persistGlobalBackgroundImageUrl(selectedBackgroundImageUrlValue)
    setGlobalBackgroundImageUrl(persistedBackgroundImageUrl)

    try {
      await persistGlobalVisualPreferencesToProject({
        backgroundImageUrl: persistedBackgroundImageUrl,
      })
    } catch (caughtError) {
      setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
    }
  }

  async function handleUseDefaultUploadedBackgroundImage() {
    const persistedBackgroundImageUrl = persistGlobalBackgroundImageUrl('/background/background.jpg')
    setGlobalBackgroundImageUrl(persistedBackgroundImageUrl)

    try {
      await persistGlobalVisualPreferencesToProject({
        backgroundImageUrl: persistedBackgroundImageUrl,
      })
    } catch (caughtError) {
      setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
    }
  }

  async function handleClearBackgroundImage() {
    const persistedBackgroundImageUrl = persistGlobalBackgroundImageUrl('')
    setGlobalBackgroundImageUrl(persistedBackgroundImageUrl)

    try {
      await persistGlobalVisualPreferencesToProject({
        backgroundImageUrl: persistedBackgroundImageUrl,
      })
    } catch (caughtError) {
      setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
    }
  }

  function handleCreationFormInputChange(event) {
    const { name, value } = event.target
    setArticleCreationFormState((currentState) => ({ ...currentState, [name]: value }))
  }

  async function handleArticleCreationSubmission(event) {
    event.preventDefault()

    const previousArticleCatalog = [...currentSortOrderRef.current]
    const coverImageUrl = resolveCoverImageUrlFromGallery(creationGalleryUrlDraftCatalog)

    const articleCreationResult = articlePublicationController.createArticle(
      {
        ...articleCreationFormState,
        imageUrl: coverImageUrl,
        galleryImageUrls: creationGalleryUrlDraftCatalog,
      },
      'admin-article-creation-flow'
    )

    setArticleFeedbackMessage(articleCreationResult.publicMessage)

    if (articleCreationResult.statusCode !== 200) {
      return
    }

    try {
      const persistedArticleCatalogResult = await persistArticleCatalogToProjectAndSyncStorage(articleCreationResult.articleCatalog)
      setArticleFeedbackMessage(persistedArticleCatalogResult.publicMessage)
    } catch (caughtError) {
      syncArticleCatalogState(previousArticleCatalog)
      setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
      return
    }

    setArticleCreationFormState(globalEmptyArticleFormState)
    setCreationGalleryUrlDraftCatalog([])
    handleCloseArticleModal()
  }

  function handleOpenArticleCreationModal() {
    setArticleCreationFormState(globalEmptyArticleFormState)
    setCreationGalleryUrlDraftCatalog([])
    refreshUploadedImageCatalog().catch((caughtError) => {
      setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
    })
    setIsArticleModalOpen(true)
  }

  function handleCloseArticleModal() {
    setIsArticleModalOpen(false)
    setEditingArticleIdentifier(null)
    setArticleEditFormState(globalEmptyArticleFormState)
    setEditGalleryUrlDraftCatalog([])
  }

  function handleArticleModalOverlayPointerDownCapture(event) {
    shouldCloseArticleModalFromOverlayClickRef.current = event.target === event.currentTarget
  }

  function handleArticleModalOverlayClick(event) {
    const hasStartedOnOverlay = shouldCloseArticleModalFromOverlayClickRef.current
    shouldCloseArticleModalFromOverlayClickRef.current = false

    if (!hasStartedOnOverlay) {
      return
    }

    if (event.target !== event.currentTarget) {
      return
    }

    handleCloseArticleModal()
  }

  function handleEditArticleClick(articleData) {
    setEditingArticleIdentifier(articleData.id)
    setArticleEditFormState({
      title: articleData.title,
      subtitle: articleData.subtitle,
      robuxPrice: String(articleData.robuxPrice ?? 0),
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

    const previousArticleCatalog = [...currentSortOrderRef.current]
    const coverImageUrl = resolveCoverImageUrlFromGallery(editGalleryUrlDraftCatalog)

    const articleUpdateResult = articlePublicationController.updateArticle(
      editingArticleIdentifier,
      {
        ...articleEditFormState,
        imageUrl: coverImageUrl,
        galleryImageUrls: editGalleryUrlDraftCatalog,
      },
      'admin-article-edit-flow'
    )

    setArticleFeedbackMessage(articleUpdateResult.publicMessage)

    if (articleUpdateResult.statusCode !== 200) {
      return
    }

    try {
      const persistedArticleCatalogResult = await persistArticleCatalogToProjectAndSyncStorage(articleUpdateResult.articleCatalog)
      setArticleFeedbackMessage(persistedArticleCatalogResult.publicMessage)
    } catch (caughtError) {
      syncArticleCatalogState(previousArticleCatalog)
      setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
      return
    }

    handleCancelEditClick()
  }

  async function handleArticleVisibilityToggle(articleIdentifier) {
    const previousArticleCatalog = [...currentSortOrderRef.current]
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
    } catch (caughtError) {
      syncArticleCatalogState(previousArticleCatalog)
      setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
    }
  }

  async function handleArticleDeletion(articleIdentifier) {
    const previousArticleCatalog = [...currentSortOrderRef.current]
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
    } catch (caughtError) {
      syncArticleCatalogState(previousArticleCatalog)
      setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
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
        syncArticleCatalogState(reorderResult.articleCatalog)

        try {
          await persistArticleCatalogToProject(reorderResult.articleCatalog)
        } catch (caughtError) {
          syncArticleCatalogState(previousCatalog)
          setArticleFeedbackMessage(resolveProjectPersistenceErrorMessage(caughtError))
        }
      }
    }

    preDragCatalogRef.current = null
  }, [articlePublicationController, syncArticleCatalogState])

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
              Defina cor e imagem de fundo padrão da landing page. A alteração é aplicada imediatamente.
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

            <label className="mt-4 flex items-center gap-4 text-xs font-black uppercase tracking-wider text-inkBlack">
              Cor global
              <input
                className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border-4 border-inkBlack bg-paperWhite p-0.5"
                type="color"
                value={globalYellowThemeHexColor}
                onChange={handleGlobalYellowThemeHexColorChange}
                aria-label="Cor global do tema"
              />
              <span className="rounded-xl border-2 border-inkBlack bg-paperWhite px-3 py-1 text-sm font-black normal-case tracking-normal">
                {globalYellowThemeHexColor}
              </span>
            </label>

            <label className="mt-5 grid gap-2 text-xs font-black uppercase tracking-wider text-inkBlack">
              Imagem de fundo da landing
              <input
                className="cute-input w-full"
                type="text"
                value={globalBackgroundImageUrl}
                onChange={handleBackgroundImageUrlChange}
                placeholder="/background/background.jpg"
                aria-label="URL da imagem de fundo global da landing"
              />
            </label>

            <div className="mt-3 grid gap-2 text-xs font-black uppercase tracking-wider text-inkBlack">
              <span>Selecionar imagem enviada por pré-visualização</span>
              {uploadedImageUrlCatalog.length === 0 ? (
                <p className="text-xs font-bold normal-case tracking-normal text-inkBlack/70">
                  Nenhuma imagem enviada disponível para seleção.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {uploadedImageUrlCatalog.map((uploadedImageUrl) => {
                    const isSelectedBackgroundImage = globalBackgroundImageUrl === uploadedImageUrl

                    return (
                      <li key={uploadedImageUrl}>
                        <button
                          type="button"
                          onClick={() => handleBackgroundImagePreviewSelection(uploadedImageUrl)}
                          className={
                            `w-full overflow-hidden rounded-xl border-4 bg-paperWhite p-0 `
                            + `${isSelectedBackgroundImage ? 'border-inkBlack' : 'border-inkBlack/30'}`
                          }
                          aria-label={`Selecionar ${uploadedImageUrl} como imagem de fundo`}
                          title={uploadedImageUrl}
                        >
                          <img
                            src={uploadedImageUrl}
                            alt="Pré-visualização da imagem de fundo"
                            className="h-24 w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleUseDefaultUploadedBackgroundImage}
                className="cute-button bg-pastelMint px-4 py-2 text-xs"
              >
                Usar Background
              </button>
              <button
                type="button"
                onClick={handleClearBackgroundImage}
                className="cute-button bg-paperWhite px-4 py-2 text-xs"
              >
                Cor Sólida
              </button>
            </div>
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
          onPointerDownCapture={handleArticleModalOverlayPointerDownCapture}
          onClick={handleArticleModalOverlayClick}
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
                  onImageDelete={handleImageDeleteFromProject}
                  reusableUploadedImageUrlCatalog={uploadedImageUrlCatalog}
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
                  onImageDelete={handleImageDeleteFromProject}
                  reusableUploadedImageUrlCatalog={uploadedImageUrlCatalog}
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
