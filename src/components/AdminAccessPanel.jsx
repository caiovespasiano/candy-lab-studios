import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Reorder } from 'framer-motion'
import { FaArrowLeft, FaEdit, FaGripVertical, FaImages, FaLock, FaPlus, FaSignOutAlt, FaTimes, FaTrash, FaUpload } from 'react-icons/fa'
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
  summary: '',
  robuxPrice: '0',
  description: '',
  imageUrl: '',
  imageAlternativeText: '',
  tagsDraftText: '',
  authoringSoftware: '',
  fileFormatsDraftText: '',
  purchaseUrl: '',
  copyrightNotice: '',
  isGeneratedWithArtificialIntelligence: false,
}

const globalAuthoringSoftwareOptionCatalog = [
  { value: '', label: 'Não informado' },
  { value: 'blender', label: 'Blender' },
  { value: 'outro', label: 'Outra ferramenta' },
]

const globalSuggestedTagCatalog = [
  'Mochila',
  'Acessório',
  'Ugc',
  'Roblox',
  'Pastel',
  'Kawaii',
  'Props',
  'Coleção',
]

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

function resolveFormAuthoringSoftwareKey(articleAuthoringSoftware) {
  const storedIconKey = String(articleAuthoringSoftware?.iconKey || '')

  if (storedIconKey && globalAuthoringSoftwareOptionCatalog.some((option) => option.value === storedIconKey)) {
    return storedIconKey
  }

  return articleAuthoringSoftware?.name ? 'outro' : ''
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
          className="cute-input-soft flex-1 text-sm"
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

function AdminFormSection({ title, description, children }) {
  return (
    <fieldset className="grid min-w-0 gap-3 rounded-xl border border-inkBlack/15 p-4">
      <legend className="px-2 text-xs font-black uppercase tracking-widest text-inkBlack">
        {title}
      </legend>
      {description && <p className="text-[11px] font-bold leading-snug text-inkBlack/60">{description}</p>}
      <div className="grid min-w-0 gap-3">{children}</div>
    </fieldset>
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
  const enteredTagCatalog = formState.tagsDraftText
    .split(',')
    .map((tagValue) => tagValue.trim())
    .filter(Boolean)

  return (
    <div className="grid min-w-0 gap-4">
      <AdminFormSection title="Identificação" description="Aparecem no card do portfolio e no topo da página do produto.">
        <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
          Título
          <input
            className="cute-input-soft mt-2 w-full"
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
            className="cute-input-soft mt-2 w-full"
            name="subtitle"
            type="text"
            value={formState.subtitle}
            onChange={onInputChange}
            required
          />
        </label>

        <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
          Resumo curto
          <textarea
            className="cute-input-soft mt-2 w-full resize-none"
            name="summary"
            rows="2"
            placeholder="Uma ou duas frases. Vem logo abaixo do preço, na coluna direita."
            value={formState.summary}
            onChange={onInputChange}
          />
        </label>
        <p className="text-[11px] font-bold text-inkBlack/60">
          Se deixar vazio, o subtítulo é usado como resumo.
        </p>
      </AdminFormSection>

      <AdminFormSection title="Preço e compra">
        <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
          Preço em Robux
          <input
            className="cute-input-soft mt-2 w-full"
            name="robuxPrice"
            type="number"
            min="0"
            step="1"
            value={formState.robuxPrice}
            onChange={onInputChange}
            required
          />
        </label>

        <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
          Link da loja
          <input
            className="cute-input-soft mt-2 w-full"
            name="purchaseUrl"
            type="url"
            placeholder="https://www.roblox.com/catalog/..."
            value={formState.purchaseUrl}
            onChange={onInputChange}
          />
        </label>
        <p className="rounded-lg border border-inkBlack/15 bg-paperWhite px-3 py-2 text-[11px] font-bold text-inkBlack">
          Sem link, o botão aparece como &quot;Indisponível&quot;. Ele nunca abre a loja errada.
        </p>
      </AdminFormSection>

      <AdminFormSection
        title="Mídia"
        description="A primeira imagem da galeria vira a capa do card automaticamente."
      >
        <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
          Texto alternativo da imagem
          <input
            className="cute-input-soft mt-2 w-full"
            name="imageAlternativeText"
            type="text"
            placeholder="Descreva o asset para quem usa leitor de tela"
            value={formState.imageAlternativeText}
            onChange={onInputChange}
          />
        </label>

        <GalleryUrlEditor
          galleryImageUrlDraftCatalog={galleryUrlDraftCatalog}
          onGalleryUrlDraftCatalogChange={onGalleryUrlDraftCatalogChange}
          onImageUpload={onImageUpload}
          onImageDelete={onImageDelete}
          reusableUploadedImageUrlCatalog={reusableUploadedImageUrlCatalog}
        />
      </AdminFormSection>

      <AdminFormSection title="Descrição completa" description="Aparece abaixo da galeria, com quebra de linha preservada.">
        <textarea
          className="cute-input-soft w-full resize-y"
          name="description"
          rows="8"
          value={formState.description}
          onChange={onInputChange}
          required
        />
      </AdminFormSection>

      <AdminFormSection title="Ficha técnica" description="Aparece em três cartões abaixo da descrição.">
        <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
          Modelado em
          <select
            className="cute-input-soft mt-2 w-full"
            name="authoringSoftware"
            value={formState.authoringSoftware}
            onChange={onInputChange}
          >
            {globalAuthoringSoftwareOptionCatalog.map((softwareOption) => (
              <option key={softwareOption.value} value={softwareOption.value}>
                {softwareOption.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
          Formatos dos arquivos
          <input
            className="cute-input-soft mt-2 w-full"
            name="fileFormatsDraftText"
            type="text"
            placeholder="FBX, OBJ, PNG, BLEND"
            value={formState.fileFormatsDraftText}
            onChange={onInputChange}
          />
        </label>
        <p className="text-[11px] font-bold text-inkBlack/60">Separe por vírgula.</p>

        <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
          Aviso de copyright
          <textarea
            className="cute-input-soft mt-2 w-full resize-none"
            name="copyrightNotice"
            rows="2"
            placeholder="Deixe vazio para usar o aviso padrão do site."
            value={formState.copyrightNotice}
            onChange={onInputChange}
          />
        </label>
      </AdminFormSection>

      <AdminFormSection title="Tags">
        <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
          Tags
          <input
            className="cute-input-soft mt-2 w-full"
            name="tagsDraftText"
            type="text"
            placeholder="mochila, ugc, pastel"
            value={formState.tagsDraftText}
            onChange={onInputChange}
          />
        </label>
        <p className="text-[11px] font-bold text-inkBlack/60">
          Separe por vírgula. Duplicadas são removidas ao salvar.
        </p>
        {enteredTagCatalog.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {enteredTagCatalog.map((tagValue) => (
              <li
                key={tagValue}
                className="rounded-full border border-inkBlack/25 bg-paperWhite px-2.5 py-0.5 text-[11px] font-black text-inkBlack"
              >
                {tagValue}
              </li>
            ))}
          </ul>
        )}
        <p className="flex flex-wrap gap-1.5">
          {globalSuggestedTagCatalog.map((suggestedTag) => (
            <span
              key={suggestedTag}
              className="inline-block w-auto rounded-full border border-inkBlack/20 bg-paperWhite px-2.5 py-0.5 text-[11px] font-bold text-inkBlack/60"
            >
              {suggestedTag}
            </span>
          ))}
        </p>
      </AdminFormSection>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-inkBlack/20 p-3">
        <input
          className="mt-0.5 h-4 w-4 shrink-0"
          name="isGeneratedWithArtificialIntelligence"
          type="checkbox"
          checked={formState.isGeneratedWithArtificialIntelligence}
          onChange={onInputChange}
        />
        <span className="text-xs font-bold leading-snug text-inkBlack">
          Este asset foi gerado com inteligência artificial.
          <span className="block font-black uppercase tracking-wide text-inkBlack/60">
            Deixe desmarcado para exibir &quot;modelado manualmente&quot;.
          </span>
        </span>
      </label>

      <div className="flex min-w-0 gap-3 pt-1">
        <button type="submit" className="cute-button flex flex-1 items-center justify-center gap-2">
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
      className="relative list-none rounded-xl border border-inkBlack/15 bg-paperWhite p-4 transition-colors hover:border-inkBlack/40"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            className="mt-0.5 cursor-grab text-inkBlack/40 transition-colors hover:text-inkBlack active:cursor-grabbing"
            aria-label={`Arrastar para reordenar ${articleData.title}`}
          >
            <FaGripVertical className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-black text-inkBlack">{articleData.title}</h3>
              <span className="shrink-0 rounded-full bg-inkBlack/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-inkBlack/70">
                {articleData.isPublished ? 'Publicado' : 'Rascunho'}
              </span>
            </div>
            <p className="truncate text-xs font-bold text-inkBlack/60">{articleData.subtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 text-xs font-black text-inkBlack/70">
          <span className="flex items-center gap-1 tabular-nums">
            {Number(articleData.robuxPrice ?? 0)}
            <span className="font-bold uppercase text-inkBlack/50">rbx</span>
          </span>
          <span className="tabular-nums">
            {articleData.galleryImageUrls?.length ?? 0} img
          </span>
        </div>
      </header>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-inkBlack/25 bg-paperWhite px-3 text-xs font-black text-inkBlack transition-colors hover:border-inkBlack hover:bg-inkBlack/5"
          onClick={() => onEdit(articleData)}
        >
          <FaEdit aria-hidden="true" />
          <span>Editar</span>
        </button>
        <button
          type="button"
          className="h-8 rounded-lg border border-inkBlack/25 bg-paperWhite px-3 text-xs font-black text-inkBlack transition-colors hover:border-inkBlack hover:bg-inkBlack/5"
          onClick={() => onToggleVisibility(articleData.id)}
        >
          {articleData.isPublished ? 'Despublicar' : 'Publicar'}
        </button>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-inkBlack/25 bg-paperWhite px-3 text-xs font-black text-inkBlack transition-colors hover:border-inkBlack hover:bg-inkBlack/5"
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
    const { name, type, checked, value } = event.target
    const nextValue = type === 'checkbox' ? checked : value
    setArticleCreationFormState((currentState) => ({ ...currentState, [name]: nextValue }))
  }

  function buildArticleInputFromFormState(formState, coverImageUrl, galleryImageUrlCatalog) {
    const authoringSoftwareKey = String(formState.authoringSoftware || '').trim()
    const matchedAuthoringSoftwareOption = globalAuthoringSoftwareOptionCatalog.find(
      (softwareOption) => softwareOption.value === authoringSoftwareKey
    )

    return {
      title: formState.title,
      subtitle: formState.subtitle,
      summary: formState.summary,
      description: formState.description,
      robuxPrice: formState.robuxPrice,
      imageAlternativeText: formState.imageAlternativeText,
      imageUrl: coverImageUrl,
      galleryImageUrls: galleryImageUrlCatalog,
      tags: String(formState.tagsDraftText || '')
        .split(',')
        .map((tagValue) => tagValue.trim())
        .filter(Boolean),
      authoringSoftware: {
        name: authoringSoftwareKey && authoringSoftwareKey !== 'outro'
          ? matchedAuthoringSoftwareOption?.label || ''
          : formState.authoringSoftwareDetail || '',
        iconKey: authoringSoftwareKey === 'outro' ? '' : authoringSoftwareKey,
      },
      fileFormats: String(formState.fileFormatsDraftText || '')
        .split(',')
        .map((fileFormatValue) => fileFormatValue.trim())
        .filter(Boolean),
      purchaseUrl: formState.purchaseUrl,
      copyrightNotice: formState.copyrightNotice,
      isGeneratedWithArtificialIntelligence: formState.isGeneratedWithArtificialIntelligence,
    }
  }

  async function handleArticleCreationSubmission(event) {
    event.preventDefault()

    const previousArticleCatalog = [...currentSortOrderRef.current]
    const coverImageUrl = resolveCoverImageUrlFromGallery(creationGalleryUrlDraftCatalog)

    const articleCreationResult = articlePublicationController.createArticle(
      buildArticleInputFromFormState(articleCreationFormState, coverImageUrl, creationGalleryUrlDraftCatalog),
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
      ...globalEmptyArticleFormState,
      title: articleData.title,
      subtitle: articleData.subtitle,
      summary: articleData.summary,
      robuxPrice: String(articleData.robuxPrice ?? 0),
      description: articleData.description,
      imageUrl: articleData.imageUrl,
      imageAlternativeText: articleData.imageAlternativeText,
      tagsDraftText: (articleData.tags ?? []).join(', '),
      authoringSoftware: resolveFormAuthoringSoftwareKey(articleData.authoringSoftware),
      fileFormatsDraftText: (articleData.fileFormats ?? []).join(', '),
      purchaseUrl: articleData.purchaseUrl ?? '',
      copyrightNotice: articleData.copyrightNotice ?? '',
      isGeneratedWithArtificialIntelligence: Boolean(articleData.isGeneratedWithArtificialIntelligence),
    })
    setEditGalleryUrlDraftCatalog([...(articleData.galleryImageUrls ?? [])])
    setArticleFeedbackMessage('')
    setIsArticleModalOpen(true)
  }

  function handleCancelEditClick() {
    handleCloseArticleModal()
  }

  function handleEditFormInputChange(event) {
    const { name, type, checked, value } = event.target
    const nextValue = type === 'checkbox' ? checked : value
    setArticleEditFormState((currentState) => ({ ...currentState, [name]: nextValue }))
  }

  async function handleArticleEditSubmission(event) {
    event.preventDefault()

    const previousArticleCatalog = [...currentSortOrderRef.current]
    const coverImageUrl = resolveCoverImageUrlFromGallery(editGalleryUrlDraftCatalog)

    const articleUpdateResult = articlePublicationController.updateArticle(
      editingArticleIdentifier,
      buildArticleInputFromFormState(articleEditFormState, coverImageUrl, editGalleryUrlDraftCatalog),
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

  const [activeAdminSectionId, setActiveAdminSectionId] = useState('admin-overview')

  function handleAdminSectionNavigation(targetSectionId) {
    setActiveAdminSectionId(targetSectionId)
    document.getElementById(targetSectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const publishedArticleCount = currentSortOrderRef.current.filter((article) => article.isPublished).length
  const draftArticleCount = currentSortOrderRef.current.length - publishedArticleCount
  const totalGalleryImageCount = currentSortOrderRef.current.reduce(
    (runningTotal, article) => runningTotal + (article.galleryImageUrls?.length ?? 0),
    0
  )

  if (!adminSessionState.isAuthenticated) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-inkBlack/[0.04] px-4 py-12">
        <section
          className="cute-box no-lift w-full max-w-md p-6 sm:p-8"
          aria-labelledby="adminAccessHeading"
        >
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <FaLock className="h-7 w-7 text-inkBlack" aria-hidden="true" />
            <h1
              id="adminAccessHeading"
              className="font-display text-2xl uppercase tracking-wide text-inkBlack"
            >
              Área restrita
            </h1>
            <p className="mt-1 text-sm font-bold text-inkBlack/70">
              Login, senha e código de verificação em duas etapas.
            </p>
          </div>

          <form className="grid gap-4" onSubmit={handleAdminAuthenticationSubmission}>
            <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
              Usuário
              <input
                className="cute-input-soft mt-2 w-full"
                name="username"
                type="text"
                value={adminCredentialsFormState.username}
                onChange={handleAdminCredentialsInputChange}
                autoComplete="username"
                required
              />
            </label>

            <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
              Senha
              <input
                className="cute-input-soft mt-2 w-full"
                name="password"
                type="password"
                value={adminCredentialsFormState.password}
                onChange={handleAdminCredentialsInputChange}
                autoComplete="current-password"
                required
              />
            </label>

            <label className="text-xs font-black uppercase tracking-wider text-inkBlack">
              Código de verificação
              <input
                className="cute-input-soft mt-2 w-full"
                name="verificationCode"
                type="password"
                value={adminCredentialsFormState.verificationCode}
                onChange={handleAdminCredentialsInputChange}
                autoComplete="one-time-code"
                required
              />
            </label>

            <button type="submit" className="cute-button mt-1 flex h-11 items-center justify-center gap-2 bg-pastelMint">
              <FaLock aria-hidden="true" />
              <span>Entrar no painel</span>
            </button>
          </form>

          {adminFeedbackMessage ? (
            <p className="mt-4 rounded-lg border border-inkBlack/20 px-4 py-3 text-sm font-black text-inkBlack" role="status">
              {adminFeedbackMessage}
            </p>
          ) : null}

          <button
            type="button"
            className="mt-6 flex w-full items-center justify-center gap-2 text-xs font-bold text-inkBlack/60 transition-colors hover:text-inkBlack"
            onClick={onNavigateBackToLanding}
          >
            <FaArrowLeft aria-hidden="true" />
            <span>Voltar para o site</span>
          </button>
        </section>
      </main>
    )
  }

  return (
    <div className="min-h-screen w-full bg-paperWhite">
      <header className="sticky top-0 z-30 border-b-4 border-inkBlack bg-paperWhite">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <FaLock className="h-5 w-5 shrink-0 text-inkBlack" aria-hidden="true" />
            <div className="leading-tight">
              <h1 className="font-display text-base uppercase tracking-wide text-inkBlack">Painel de Administração</h1>
              <p className="mt-0.5 text-xs font-bold text-inkBlack/60">
                {adminSessionState.username} · expira {adminSessionExpiresAtLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="cute-button h-10 gap-1.5 px-5 text-sm sm:px-5 sm:py-2 sm:text-sm"
              onClick={onNavigateBackToLanding}
            >
              <FaArrowLeft aria-hidden="true" />
              <span>Ver site</span>
            </button>
            <button
              type="button"
              className="cute-control-button h-10 w-10 shrink-0 px-0"
              onClick={handleAdminLogoutClick}
              aria-label="Encerrar sessão"
              title="Encerrar sessão"
            >
              <FaSignOutAlt aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <nav aria-label="Seções do painel" className="hidden w-52 shrink-0 lg:block">
          <ul className="sticky top-24 flex flex-col gap-3">
            {[
              { label: 'Visão geral', targetId: 'admin-overview', IconComponent: FaGripVertical },
              { label: 'Artigos', targetId: 'admin-articles', IconComponent: FaEdit },
              { label: 'Aparência', targetId: 'admin-appearance', IconComponent: FaImages },
            ].map((sectionLink) => {
              const SectionLinkIcon = sectionLink.IconComponent
              const isCurrentSection = activeAdminSectionId === sectionLink.targetId

              return (
                <li key={sectionLink.targetId}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-lg border-2 border-inkBlack px-3 py-2 text-left transition-colors hover:bg-pastelBlue hover:text-inkBlack ${
                      isCurrentSection
                        ? 'bg-inkBlack font-black text-paperWhite shadow-[4px_4px_0px_0px_#111111]'
                        : 'bg-paperWhite text-sm font-bold text-inkBlack/70 shadow-[4px_4px_0px_0px_#111111]'
                    }`}
                    onClick={() => handleAdminSectionNavigation(sectionLink.targetId)}
                    aria-current={isCurrentSection ? 'true' : undefined}
                  >
                    <SectionLinkIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{sectionLink.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <main id="admin-overview" className="min-w-0 flex-1">
          <section aria-labelledby="adminMetricsHeading" className="mb-6">
            <h2 id="adminMetricsHeading" className="sr-only">Métricas do catálogo</h2>

            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: 'Publicados', value: publishedArticleCount },
                { label: 'Rascunhos', value: draftArticleCount },
                { label: 'Imagens', value: totalGalleryImageCount },
                { label: 'Total', value: currentSortOrderRef.current.length },
              ].map((metric) => (
                <div key={metric.label} className="cute-box no-lift px-4 py-3">
                  <dt className="text-[10px] font-black uppercase tracking-widest text-inkBlack/70">
                    {metric.label}
                  </dt>
                  <dd className="mt-1 text-3xl font-black tabular-nums leading-none text-inkBlack">
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="grid gap-6">
          <section id="admin-appearance" className="cute-box no-lift scroll-mt-24 p-6 sm:p-8" aria-labelledby="adminAppearanceHeading">
            <h2 id="adminAppearanceHeading" className="text-2xl font-display text-inkBlack">Aparência do site</h2>
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
              <span className="cute-input-soft inline-block w-auto px-3 py-1 text-sm font-black normal-case tracking-normal">
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
              <span className="cute-input-soft inline-block w-auto px-3 py-1 text-sm font-black normal-case tracking-normal">
                {globalYellowThemeHexColor}
              </span>
            </label>

            <label className="mt-5 grid gap-2 text-xs font-black uppercase tracking-wider text-inkBlack">
              Imagem de fundo da landing
              <input
                className="cute-input-soft w-full"
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
                            + `${isSelectedBackgroundImage ? 'border-inkBlack' : 'border-inkBlack/20'}`
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
                className="cute-button px-4 py-2 text-xs"
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
          </section>

          <section
            id="admin-articles"
            className="cute-box no-lift scroll-mt-24 p-6 sm:p-8"
            aria-labelledby="adminArticlesHeading"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 id="adminArticlesHeading" className="text-2xl font-display text-inkBlack">Artigos</h2>
                <p className="mt-1 text-sm font-bold text-inkBlack/70">
                  Arraste pela alça para reordenar. A ordem define a sequência na landing page.
                </p>
              </div>
              <button
                type="button"
                className="cute-button flex h-10 items-center justify-center gap-2 px-4 text-sm"
                onClick={handleOpenArticleCreationModal}
              >
                <FaPlus aria-hidden="true" />
                <span>Novo artigo</span>
              </button>
            </div>

            {articleFeedbackMessage ? (
              <p
                className="mt-4 rounded-lg border border-inkBlack/20 px-4 py-3 text-sm font-black text-inkBlack"
                role="status"
              >
                {articleFeedbackMessage}
              </p>
            ) : null}

            {sortableArticleCatalog.length === 0 ? (
              <p className="mt-6 rounded-lg border border-dashed border-inkBlack/25 px-4 py-10 text-center text-sm font-bold text-inkBlack/60">
                Nenhum artigo ainda. Use &quot;Novo artigo&quot; para criar o primeiro.
              </p>
            ) : (
              <Reorder.Group
                as="ul"
                axis="y"
                values={sortableArticleCatalog}
                onReorder={handleSortableReorder}
                className="mt-6 flex flex-col gap-2"
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
            )}
          </section>
          </div>
        </main>
      </div>

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
              className="cute-control-button cute-control-button-close absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center text-xl"
              onClick={handleCloseArticleModal}
              aria-label="Fechar modal"
            >
              <FaTimes aria-hidden="true" />
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
              <p className="mt-4 rounded-lg border border-inkBlack/20 px-4 py-3 text-sm font-black text-inkBlack" role="status">
                {articleFeedbackMessage}
              </p>
            ) : null}
          </article>
        </div>
      )}
    </div>
  )
}
