import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  FaArrowLeft,
  FaArrowRight,
  FaDiscord,
  FaHeart,
  FaInstagram,
  FaRegHeart,
  FaShareAlt,
  FaTimes,
} from 'react-icons/fa'
import { AnimatePresence, motion as _motion } from 'framer-motion'
import { SiRoblox } from 'react-icons/si'
import flagBrPng from './assets/flags/br.png'
import flagEnPng from './assets/flags/en.png'
import flagEsPng from './assets/flags/es.png'
import { ProjectThumbnailImage } from './components/ProjectThumbnailImage'
import { globalAdminAccessConfig } from './constants/globalAdminAccessConfig'
import { globalArticlePublicationController } from './controllers/articles/globalArticlePublicationController'
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
} from './services/globalBackgroundPreferencesService'
import { internalRuntimeStorage } from './services/internalRuntimeStorageService'
import { loadPersistedArticleCatalogFromProject, loadProjectPreferencesFromProject } from './services/projectPersistenceGatewayService'
import { submitContactMessageUsingGateway } from './services/contactSubmissionService'
import { globalDefaultLanguageCode, resolveTranslationText } from './services/translationResolverService'
import globalTranslationsByLanguageCode from './constants/i18n/translations.json'

const LazyAdminAccessPanel = lazy(() => import('./components/AdminAccessPanel').then((adminAccessPanelModule) => ({
  default: adminAccessPanelModule.AdminAccessPanel,
})))

const LazyProjectGalleryLightbox = lazy(() => import('./components/ProjectGalleryLightbox').then((lightboxModule) => ({
  default: lightboxModule.ProjectGalleryLightbox,
})))

function ProjectGalleryLightboxLoadingFallback({ activeGalleryImageUrl, imageAlternativeText }) {
  return (
    <img
      src={activeGalleryImageUrl}
      alt={imageAlternativeText}
      className="h-full w-full object-cover"
      aria-hidden="true"
    />
  )
}

function AdminAccessPanelLoadingFallback() {
  return (
    <div
      className="flex min-h-[50vh] w-full items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Carregando painel administrativo"
    >
      <span className="text-sm font-black uppercase tracking-widest text-inkBlack/70">Carregando...</span>
    </div>
  )
}

const globalProjectContactGatewayClient = {
  async sendContactMessage(sanitizedContactPayload) {
    const contactApiResponse = await fetch('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(sanitizedContactPayload),
    })

    const contactApiPayload = await contactApiResponse.json().catch(() => ({}))

    return {
      statusCode: Number(contactApiPayload.statusCode || contactApiResponse.status || 500),
      payload: {
        message: String(contactApiPayload.message || 'Falha ao registrar mensagem de contato.'),
      },
    }
  },
}

const globalCuratedSocialLinks = [
  {
    id: 'discord',
    channelName: 'Discord',
    url: 'https://discord.com',
    iconComponent: FaDiscord,
  },
  {
    id: 'instagram',
    channelName: 'Instagram',
    url: 'https://www.instagram.com',
    iconComponent: FaInstagram,
  },
  {
    id: 'robloxStore',
    channelName: 'Roblox Store',
    url: 'https://www.roblox.com/catalog',
    iconComponent: SiRoblox,
  },
]

const globalFallbackPhotoSwipeImageDimensions = {
  width: 1600,
  height: 1200,
}

const globalAboveTheFoldProjectImageCount = 3
const globalFloatingCandyEmojiCatalog = ['🍭', '🍬']
const globalFloatingCandySizeScaleMultiplier = 1.15
const globalFloatingCandyMaximumRotationInDegrees = 45
const globalSessionLikeCountByIdentifierStorageKey = 'dimi3d.likeCountByIdentifier'
const globalSessionLikedProjectIdentifierCatalogStorageKey = 'dimi3d.likedProjectIdentifierCatalog'
const globalCurrentLanguageCodeStorageKey = 'dimi3d.currentLanguageCode'
const globalLanguageOptionCatalog = [
  { code: 'ptBR', label: 'PT-BR' },
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
]

function resolveInitialLanguageCode() {
  const persistedLanguageCode = resolvePersistedLanguageCode()
  const isSupportedLanguageCode = globalLanguageOptionCatalog.some((languageOption) => {
    return languageOption.code === persistedLanguageCode
  })

  return isSupportedLanguageCode ? persistedLanguageCode : globalDefaultLanguageCode
}

function resolveLanguageStorageClient() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }

  return internalRuntimeStorage
}

function resolvePersistedLanguageCode() {
  try {
    const storageClient = resolveLanguageStorageClient()
    return storageClient.getItem(globalCurrentLanguageCodeStorageKey)
  } catch {
    return internalRuntimeStorage.getItem(globalCurrentLanguageCodeStorageKey)
  }
}

function persistCurrentLanguageCode(languageCode) {
  try {
    resolveLanguageStorageClient().setItem(globalCurrentLanguageCodeStorageKey, languageCode)
  } catch {
    internalRuntimeStorage.setItem(globalCurrentLanguageCodeStorageKey, languageCode)
  }
}

function LanguageFlagIcon({ languageCode }) {
  const flagClassName = 'h-8 w-8 object-contain'
  const flagImageByLanguageCode = {
    ptBR: flagBrPng,
    es: flagEsPng,
    en: flagEnPng,
  }

  const selectedFlagImageUrl = flagImageByLanguageCode[languageCode] || flagEnPng

  return <img src={selectedFlagImageUrl} alt="" className={flagClassName} loading="lazy" aria-hidden="true" />
}

function resolveDefaultProjectLikeCountByIdentifier(articleCatalog) {
  return Object.fromEntries(articleCatalog.map((projectData) => [projectData.id, projectData.likeCount]))
}

function resolveSessionProjectLikeCountByIdentifier(articleCatalog) {
  const defaultProjectLikeCountByIdentifier = resolveDefaultProjectLikeCountByIdentifier(articleCatalog)

  try {
    const sessionLikeCountByIdentifierRaw = internalRuntimeStorage.getItem(globalSessionLikeCountByIdentifierStorageKey)

    if (!sessionLikeCountByIdentifierRaw) {
      return defaultProjectLikeCountByIdentifier
    }

    const parsedSessionLikeCountByIdentifier = JSON.parse(sessionLikeCountByIdentifierRaw)

    if (
      !parsedSessionLikeCountByIdentifier
      || typeof parsedSessionLikeCountByIdentifier !== 'object'
      || Array.isArray(parsedSessionLikeCountByIdentifier)
    ) {
      return defaultProjectLikeCountByIdentifier
    }

    const nextProjectLikeCountByIdentifier = { ...defaultProjectLikeCountByIdentifier }

    Object.entries(parsedSessionLikeCountByIdentifier).forEach(([projectIdentifier, likeCount]) => {
      const isKnownProjectIdentifier = Object.prototype.hasOwnProperty.call(nextProjectLikeCountByIdentifier, projectIdentifier)
      const isLikeCountValid = Number.isFinite(likeCount) && likeCount >= 0

      if (isKnownProjectIdentifier && isLikeCountValid) {
        nextProjectLikeCountByIdentifier[projectIdentifier] = Math.floor(likeCount)
      }
    })

    return nextProjectLikeCountByIdentifier
  } catch {
    return defaultProjectLikeCountByIdentifier
  }
}

function resolveSessionLikedProjectIdentifierSet(articleCatalog) {
  const availableProjectIdentifierSet = new Set(articleCatalog.map((projectData) => projectData.id))

  try {
    const sessionLikedProjectIdentifierCatalogRaw = internalRuntimeStorage.getItem(
      globalSessionLikedProjectIdentifierCatalogStorageKey
    )

    if (!sessionLikedProjectIdentifierCatalogRaw) {
      return new Set()
    }

    const parsedSessionLikedProjectIdentifierCatalog = JSON.parse(sessionLikedProjectIdentifierCatalogRaw)

    if (!Array.isArray(parsedSessionLikedProjectIdentifierCatalog)) {
      return new Set()
    }

    return new Set(
      parsedSessionLikedProjectIdentifierCatalog.filter((projectIdentifier) => {
        return typeof projectIdentifier === 'string' && availableProjectIdentifierSet.has(projectIdentifier)
      })
    )
  } catch {
    return new Set()
  }
}

function resolveRandomNumberBetween(minimumValue, maximumValue) {
  return Math.random() * (maximumValue - minimumValue) + minimumValue
}

function resolveFloatingCandyParticleConfig() {
  return {
    startXRatio: 0.5,
    vDirection: Math.random() > 0.5 ? 1 : -1,
    vSpreadRatio: resolveRandomNumberBetween(0.12, 0.24),
    startYOffset: resolveRandomNumberBetween(0, 26),
    velocityX: resolveRandomNumberBetween(-0.55, 0.55),
    velocityY: resolveRandomNumberBetween(-2.2, -1.5),
    driftIntensity: resolveRandomNumberBetween(0.0012, 0.0034),
    driftAngle: resolveRandomNumberBetween(0, Math.PI * 2),
    directionBiasX: resolveRandomNumberBetween(-0.016, 0.016),
    directionBiasY: resolveRandomNumberBetween(-0.008, -0.001),
    buoyancyForce: resolveRandomNumberBetween(-0.02, -0.008),
    gustSpeed: resolveRandomNumberBetween(0.0014, 0.0032),
    gustAmplitudeX: resolveRandomNumberBetween(0.006, 0.02),
    gustAmplitudeY: resolveRandomNumberBetween(0.001, 0.004),
    rotationBase: resolveRandomNumberBetween(-12, 12),
    rotationAmplitude: resolveRandomNumberBetween(6, 18),
    rotationFrequency: resolveRandomNumberBetween(0.7, 1.4),
    scale: resolveRandomNumberBetween(0.9, 1.1),
    sizePixels: resolveRandomNumberBetween(40, 72),
    opacity: resolveRandomNumberBetween(0.86, 1),
  }
}

function resolveImageDimensionsFromUrl(imageUrl) {
  return new Promise((resolve) => {
    const imageElement = new Image()
    imageElement.onload = () => {
      resolve({
        imageUrl,
        width: imageElement.naturalWidth || globalFallbackPhotoSwipeImageDimensions.width,
        height: imageElement.naturalHeight || globalFallbackPhotoSwipeImageDimensions.height,
      })
    }
    imageElement.onerror = () => {
      resolve({
        imageUrl,
        ...globalFallbackPhotoSwipeImageDimensions,
      })
    }
    imageElement.src = imageUrl
  })
}

function App() {
  const floatingCandyLayerReference = useRef(null)
  const languageMenuReference = useRef(null)
  const syncManagedArticleCatalogReference = useRef(null)
  const [currentLanguageCode, setCurrentLanguageCode] = useState(resolveInitialLanguageCode)
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [modalOpenAnimationOffset, setModalOpenAnimationOffset] = useState({ x: 0, y: 12 })
  const [currentRouteHash, setCurrentRouteHash] = useState(() => window.location.hash || globalAdminAccessConfig.landingRouteHash)
  const [managedArticleCatalog, setManagedArticleCatalog] = useState(() => {
    return globalArticlePublicationController.listAllArticleCatalog().articleCatalog
  })
  const [selectedProjectIdentifier, setSelectedProjectIdentifier] = useState(null)
  const [currentGalleryImageIndex, setCurrentGalleryImageIndex] = useState(0)
  const [galleryImageDimensionsByUrl, setGalleryImageDimensionsByUrl] = useState({})
  const [likedProjectIdentifierSet, setLikedProjectIdentifierSet] = useState(() => {
    const initialArticleCatalog = globalArticlePublicationController.listAllArticleCatalog().articleCatalog
    return resolveSessionLikedProjectIdentifierSet(initialArticleCatalog)
  })
  const [projectLikeCountByIdentifier, setProjectLikeCountByIdentifier] = useState(() => {
    const initialArticleCatalog = globalArticlePublicationController.listAllArticleCatalog().articleCatalog
    return resolveSessionProjectLikeCountByIdentifier(initialArticleCatalog)
  })
  const [contactFormState, setContactFormState] = useState({
    fullName: '',
    emailAddress: '',
    messageBody: '',
  })
  const [contactSubmissionFeedbackMessage, setContactSubmissionFeedbackMessage] = useState('')

  const publishedArticleCatalog = useMemo(() => {
    return managedArticleCatalog.filter((articleData) => articleData.isPublished)
  }, [managedArticleCatalog])

  const selectedProjectData = useMemo(() => {
    return publishedArticleCatalog.find((projectData) => projectData.id === selectedProjectIdentifier)
  }, [publishedArticleCatalog, selectedProjectIdentifier])
  const selectedProjectGalleryImageCount = selectedProjectData?.galleryImageUrls.length ?? 0
  const hasSelectedProjectBeenLiked = selectedProjectData ? likedProjectIdentifierSet.has(selectedProjectData.id) : false
  const isAdminRouteActive = currentRouteHash === globalAdminAccessConfig.adminRouteHash

  const syncManagedArticleCatalog = useCallback((nextArticleCatalog) => {
    setManagedArticleCatalog(nextArticleCatalog)

    setProjectLikeCountByIdentifier((currentProjectLikeCountByIdentifier) => {
      const nextProjectLikeCountByIdentifier = { ...currentProjectLikeCountByIdentifier }

      nextArticleCatalog.forEach((projectData) => {
        if (typeof nextProjectLikeCountByIdentifier[projectData.id] !== 'number') {
          nextProjectLikeCountByIdentifier[projectData.id] = projectData.likeCount
        }
      })

      return nextProjectLikeCountByIdentifier
    })

    setLikedProjectIdentifierSet((currentLikedProjectIdentifierSet) => {
      const availableProjectIdentifierSet = new Set(nextArticleCatalog.map((projectData) => projectData.id))

      return new Set(
        [...currentLikedProjectIdentifierSet].filter((projectIdentifier) => availableProjectIdentifierSet.has(projectIdentifier))
      )
    })
  }, [])

  useEffect(() => {
    syncManagedArticleCatalogReference.current = syncManagedArticleCatalog
  }, [syncManagedArticleCatalog])

  function t(translationPath, replacementByKey) {
    return resolveTranslationText(globalTranslationsByLanguageCode, currentLanguageCode, translationPath, replacementByKey)
  }

  useEffect(() => {
    function handleHashRouteChange() {
      setCurrentRouteHash(window.location.hash || globalAdminAccessConfig.landingRouteHash)
    }

    window.addEventListener('hashchange', handleHashRouteChange)

    return () => {
      window.removeEventListener('hashchange', handleHashRouteChange)
    }
  }, [])

  useLayoutEffect(() => {
    const persistedBackgroundHexColor = loadPersistedGlobalBackgroundHexColor()
    const persistedBackgroundImageUrl = loadPersistedGlobalBackgroundImageUrl()
    const persistedYellowThemeHexColor = loadPersistedGlobalYellowThemeHexColor()

    applyGlobalBackgroundHexColor(persistedBackgroundHexColor)
    applyGlobalBackgroundImageUrl(persistedBackgroundImageUrl)
    applyGlobalYellowThemeHexColor(persistedYellowThemeHexColor)
  }, [])

  useEffect(() => {
    let isSubscriptionActive = true

    async function restoreVisualPreferences() {
      try {
        const projectPreferencesResponse = await loadProjectPreferencesFromProject()

        if (!isSubscriptionActive) {
          return
        }

        const projectPreferences = projectPreferencesResponse.projectPreferences || {}
        const persistedBackgroundHexColor = persistGlobalBackgroundHexColor(projectPreferences.backgroundHexColor)
        const persistedBackgroundImageUrl = persistGlobalBackgroundImageUrl(projectPreferences.backgroundImageUrl)
        const persistedYellowThemeHexColor = persistGlobalYellowThemeHexColor(projectPreferences.yellowThemeHexColor)

        applyGlobalBackgroundHexColor(persistedBackgroundHexColor)
        applyGlobalBackgroundImageUrl(persistedBackgroundImageUrl)
        applyGlobalYellowThemeHexColor(persistedYellowThemeHexColor)
      } catch {
        // Local preferences were already applied in useLayoutEffect.
      }
    }

    restoreVisualPreferences()

    return () => {
      isSubscriptionActive = false
    }
  }, [])

  useEffect(() => {
    let isSubscriptionActive = true

    async function restoreArticleCatalogFromProject() {
      try {
        const persistedCatalogResponse = await loadPersistedArticleCatalogFromProject()
        if (!Array.isArray(persistedCatalogResponse.articleCatalog)) {
          return
        }

        const syncResult = globalArticlePublicationController.applyArticleCatalogReorder(
          persistedCatalogResponse.articleCatalog,
          'landing-project-catalog-bootstrap-flow'
        )

        if (isSubscriptionActive) {
          syncManagedArticleCatalogReference.current?.(syncResult.articleCatalog)
        }
      } catch {
        // Local API may be unavailable in some environments.
      }
    }

    restoreArticleCatalogFromProject()

    return () => {
      isSubscriptionActive = false
    }
  }, [])

  useEffect(() => {
    persistCurrentLanguageCode(currentLanguageCode)
  }, [currentLanguageCode])

  useEffect(() => {
    function handleDocumentMouseDown(event) {
      if (!languageMenuReference.current?.contains(event.target)) {
        setIsLanguageMenuOpen(false)
      }
    }

    function handleEscapeKeyDown(event) {
      if (event.key === 'Escape') {
        setIsLanguageMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    window.addEventListener('keydown', handleEscapeKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
      window.removeEventListener('keydown', handleEscapeKeyDown)
    }
  }, [])

  useEffect(() => {
    const floatingLayerElement = floatingCandyLayerReference.current
    if (!floatingLayerElement) {
      return undefined
    }

    let isFloatingSimulationActive = true
    let animationFrameIdentifier = null
    let spawnTimeoutIdentifier = null
    let activeFloatingParticleState = null
    let previousFrameTimestamp = 0
    let nextFloatingEmojiIndex = 0

    function removeActiveFloatingParticle() {
      if (!activeFloatingParticleState) {
        return
      }

      if (activeFloatingParticleState.element.isConnected) {
        activeFloatingParticleState.element.remove()
      }

      activeFloatingParticleState = null
    }

    function scheduleNextFloatingParticleSpawn() {
      if (!isFloatingSimulationActive) {
        return
      }

      const nextSpawnDelay = resolveRandomNumberBetween(3000, 5000)
      spawnTimeoutIdentifier = window.setTimeout(() => {
        spawnFloatingCandyParticle()
      }, nextSpawnDelay)
    }

    function spawnFloatingCandyParticle() {
      if (!isFloatingSimulationActive || activeFloatingParticleState) {
        return
      }

      const floatingLayerRect = floatingLayerElement.getBoundingClientRect()
      const floatingLayerHeight = Math.max(1, floatingLayerRect.height)
      const particleConfig = resolveFloatingCandyParticleConfig()

      const particleElement = document.createElement('span')
      const renderedSizePixels = particleConfig.sizePixels * globalFloatingCandySizeScaleMultiplier
      particleElement.textContent = globalFloatingCandyEmojiCatalog[nextFloatingEmojiIndex]
      nextFloatingEmojiIndex = (nextFloatingEmojiIndex + 1) % globalFloatingCandyEmojiCatalog.length
      particleElement.className = 'header-candy-particle'
      particleElement.style.left = `${particleConfig.startXRatio * 100}%`
      particleElement.style.top = '0'
      particleElement.style.fontSize = `${renderedSizePixels}px`

      floatingLayerElement.appendChild(particleElement)

      activeFloatingParticleState = {
        element: particleElement,
        x: 0,
        y: floatingLayerHeight + particleConfig.startYOffset,
        initialY: floatingLayerHeight + particleConfig.startYOffset,
        spawnedAtTimestamp: performance.now(),
        maxLifetimeMilliseconds: resolveRandomNumberBetween(12000, 18000),
        vDirection: particleConfig.vDirection,
        vSpreadRatio: particleConfig.vSpreadRatio,
        velocityX: particleConfig.velocityX,
        velocityY: particleConfig.velocityY,
        driftIntensity: particleConfig.driftIntensity,
        driftAngle: particleConfig.driftAngle,
        directionBiasX: particleConfig.directionBiasX,
        directionBiasY: particleConfig.directionBiasY,
        buoyancyForce: particleConfig.buoyancyForce,
        gustSpeed: particleConfig.gustSpeed,
        gustAmplitudeX: particleConfig.gustAmplitudeX,
        gustAmplitudeY: particleConfig.gustAmplitudeY,
        rotationBase: particleConfig.rotationBase,
        rotationAmplitude: particleConfig.rotationAmplitude,
        rotationFrequency: particleConfig.rotationFrequency,
        scale: particleConfig.scale,
        sizePixels: renderedSizePixels,
        opacity: particleConfig.opacity,
      }
    }

    function updateFloatingParticleFrame(currentTimestamp) {
      if (!isFloatingSimulationActive) {
        return
      }

      const hasPreviousTimestamp = previousFrameTimestamp > 0
      const frameDelta = hasPreviousTimestamp ? Math.min(40, currentTimestamp - previousFrameTimestamp) : 16.67
      previousFrameTimestamp = currentTimestamp
      const frameMultiplier = frameDelta / 16.67

      if (activeFloatingParticleState) {
        const floatingLayerRect = floatingLayerElement.getBoundingClientRect()
        const floatingLayerWidth = Math.max(1, floatingLayerRect.width)
        const floatingLayerHeight = Math.max(1, floatingLayerRect.height)
        const topExitBoundary = -activeFloatingParticleState.sizePixels * 1.3
        const bottomExitBoundary = floatingLayerHeight + (activeFloatingParticleState.sizePixels * 1.4)
        const sideExitBoundary = activeFloatingParticleState.sizePixels * 1.3

        activeFloatingParticleState.driftAngle += activeFloatingParticleState.driftIntensity * frameDelta
        const gustOscillation = Math.sin(
          (activeFloatingParticleState.driftAngle * 0.7)
          + (currentTimestamp * activeFloatingParticleState.gustSpeed)
        )

        const lateralNoise = (
          (Math.cos(activeFloatingParticleState.driftAngle * 1.2) * 0.02)
          + (gustOscillation * activeFloatingParticleState.gustAmplitudeX)
          + activeFloatingParticleState.directionBiasX
        )

        const verticalNoise = (
          (Math.sin(activeFloatingParticleState.driftAngle * 0.95) * 0.004)
          + (
            Math.cos(
              (activeFloatingParticleState.driftAngle * 0.6)
              + (currentTimestamp * activeFloatingParticleState.gustSpeed)
            ) * activeFloatingParticleState.gustAmplitudeY
          )
          + activeFloatingParticleState.directionBiasY
        )

        const liftForce = activeFloatingParticleState.buoyancyForce + (gustOscillation * 0.005)
        activeFloatingParticleState.velocityX += lateralNoise * frameMultiplier
        activeFloatingParticleState.velocityY += (verticalNoise + liftForce) * frameMultiplier

        const dampingFactor = Math.pow(0.996, frameMultiplier)
        activeFloatingParticleState.velocityX *= dampingFactor
        activeFloatingParticleState.velocityY *= dampingFactor

        const baseOffsetLeft = activeFloatingParticleState.element.offsetLeft
        const verticalProgress = Math.max(
          0,
          Math.min(
            1,
            (activeFloatingParticleState.initialY - activeFloatingParticleState.y)
              / (activeFloatingParticleState.initialY - topExitBoundary)
          )
        )
        const maxSpreadPixels = floatingLayerWidth * activeFloatingParticleState.vSpreadRatio
        const desiredOffsetX = activeFloatingParticleState.vDirection
          * maxSpreadPixels
          * Math.pow(verticalProgress, 1.25)
        const horizontalSteeringError = desiredOffsetX - activeFloatingParticleState.x
        const steeringStrength = 0.0025 + (verticalProgress * 0.0045)
        activeFloatingParticleState.velocityX += horizontalSteeringError * steeringStrength * frameMultiplier

        activeFloatingParticleState.velocityX = Math.max(-0.65, Math.min(0.65, activeFloatingParticleState.velocityX))
        activeFloatingParticleState.velocityY = Math.max(-2.7, Math.min(-0.45, activeFloatingParticleState.velocityY))

        activeFloatingParticleState.x += activeFloatingParticleState.velocityX * frameMultiplier
        activeFloatingParticleState.y += activeFloatingParticleState.velocityY * frameMultiplier

        const dynamicRotation = activeFloatingParticleState.rotationBase
          + (
          Math.sin(activeFloatingParticleState.driftAngle * activeFloatingParticleState.rotationFrequency)
          * activeFloatingParticleState.rotationAmplitude
          )
        const clampedRotation = Math.max(
          -globalFloatingCandyMaximumRotationInDegrees,
          Math.min(globalFloatingCandyMaximumRotationInDegrees, dynamicRotation)
        )

        const verticalOpacity = activeFloatingParticleState.y > floatingLayerHeight * 0.88
          ? Math.max(0.2, 1 - ((activeFloatingParticleState.y - (floatingLayerHeight * 0.88)) / (floatingLayerHeight * 0.35)))
          : activeFloatingParticleState.y < floatingLayerHeight * 0.16
            ? Math.max(0.2, activeFloatingParticleState.y / (floatingLayerHeight * 0.16))
            : 1

        const absoluteX = baseOffsetLeft + activeFloatingParticleState.x
        const sideOpacity = absoluteX < 24
          ? Math.max(0.2, absoluteX / 24)
          : absoluteX > floatingLayerWidth - 24
            ? Math.max(0.2, (floatingLayerWidth - absoluteX) / 24)
            : 1

        const dynamicScale = activeFloatingParticleState.scale
          + (Math.sin(activeFloatingParticleState.driftAngle * 2.2) * 0.03)

        activeFloatingParticleState.element.style.opacity = String(
          Math.max(0.12, Math.min(1, activeFloatingParticleState.opacity * verticalOpacity * sideOpacity))
        )

        activeFloatingParticleState.element.style.transform = (
          `translate3d(${activeFloatingParticleState.x}px, ${activeFloatingParticleState.y}px, 0) `
          + `rotate(${clampedRotation}deg) scale(${dynamicScale})`
        )

        const hasExitedTop = activeFloatingParticleState.y < topExitBoundary
        const hasExitedBottom = activeFloatingParticleState.y > bottomExitBoundary
        const hasExitedLeft = absoluteX < -sideExitBoundary
        const hasExitedRight = absoluteX > floatingLayerWidth + sideExitBoundary
        const hasExceededMaximumLifetime =
          (currentTimestamp - activeFloatingParticleState.spawnedAtTimestamp)
          > activeFloatingParticleState.maxLifetimeMilliseconds

        if (hasExitedTop || hasExitedBottom || hasExitedLeft || hasExitedRight || hasExceededMaximumLifetime) {
          removeActiveFloatingParticle()
          scheduleNextFloatingParticleSpawn()
        }
      }

      animationFrameIdentifier = window.requestAnimationFrame(updateFloatingParticleFrame)
    }

    spawnFloatingCandyParticle()
    animationFrameIdentifier = window.requestAnimationFrame(updateFloatingParticleFrame)

    return () => {
      isFloatingSimulationActive = false

      if (spawnTimeoutIdentifier !== null) {
        window.clearTimeout(spawnTimeoutIdentifier)
      }

      if (animationFrameIdentifier !== null) {
        window.cancelAnimationFrame(animationFrameIdentifier)
      }

      removeActiveFloatingParticle()
    }
  }, [])

  useEffect(() => {
    try {
      internalRuntimeStorage.setItem(
        globalSessionLikeCountByIdentifierStorageKey,
        JSON.stringify(projectLikeCountByIdentifier)
      )

      internalRuntimeStorage.setItem(
        globalSessionLikedProjectIdentifierCatalogStorageKey,
        JSON.stringify([...likedProjectIdentifierSet])
      )
    } catch {
      // Browser storage might be unavailable or blocked.
    }
  }, [likedProjectIdentifierSet, projectLikeCountByIdentifier])

  useEffect(() => {
    if (!selectedProjectData) {
      return undefined
    }

    function handleEscapeKeyDown(event) {
      if (event.key === 'Escape') {
        const isPhotoSwipeOpen = Boolean(document.querySelector('.pswp--open'))
        if (isPhotoSwipeOpen) {
          return
        }
        setSelectedProjectIdentifier(null)
      }
    }

    window.addEventListener('keydown', handleEscapeKeyDown)

    return () => {
      window.removeEventListener('keydown', handleEscapeKeyDown)
    }
  }, [selectedProjectData])

  useEffect(() => {
    if (!selectedProjectData) {
      return undefined
    }

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior
    const previousHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    document.documentElement.style.overscrollBehavior = 'none'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior
      document.documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior
    }
  }, [selectedProjectData])

  useEffect(() => {
    if (!selectedProjectData?.galleryImageUrls?.length) {
      return
    }

    let isCancelled = false
    const uniqueGalleryImageUrlCatalog = [...new Set(selectedProjectData.galleryImageUrls)]

    Promise.all(uniqueGalleryImageUrlCatalog.map(resolveImageDimensionsFromUrl)).then((resolvedImageDimensionsCatalog) => {
      if (isCancelled) {
        return
      }

      const nextGalleryImageDimensionsByUrl = resolvedImageDimensionsCatalog.reduce((accumulator, imageDimensionsData) => {
        accumulator[imageDimensionsData.imageUrl] = {
          width: imageDimensionsData.width,
          height: imageDimensionsData.height,
        }
        return accumulator
      }, {})

      setGalleryImageDimensionsByUrl(nextGalleryImageDimensionsByUrl)
    })

    return () => {
      isCancelled = true
    }
  }, [selectedProjectData])

  function resolvePhotoSwipeDimensionsByUrl(imageUrl) {
    return galleryImageDimensionsByUrl[imageUrl] || globalFallbackPhotoSwipeImageDimensions
  }

  function handlePhotoSwipeBeforeOpen(photoSwipeInstance) {
    photoSwipeInstance.on('close', () => {
      const currentSlideIndex = Number(photoSwipeInstance.currIndex)
      if (!Number.isNaN(currentSlideIndex)) {
        setCurrentGalleryImageIndex(currentSlideIndex)
      }
    })
  }

  function handleProjectLikeClick(projectIdentifier) {
    const hasProjectAlreadyBeenLikedInCurrentSession = likedProjectIdentifierSet.has(projectIdentifier)

    setProjectLikeCountByIdentifier((currentProjectLikeCountByIdentifier) => {
      const currentCount = currentProjectLikeCountByIdentifier[projectIdentifier] ?? 0
      const nextCount = hasProjectAlreadyBeenLikedInCurrentSession
        ? Math.max(0, currentCount - 1)
        : currentCount + 1
      return { ...currentProjectLikeCountByIdentifier, [projectIdentifier]: nextCount }
    })

    setLikedProjectIdentifierSet((currentLikedProjectIdentifierSet) => {
      const nextLikedProjectIdentifierSet = new Set(currentLikedProjectIdentifierSet)
      if (hasProjectAlreadyBeenLikedInCurrentSession) {
        nextLikedProjectIdentifierSet.delete(projectIdentifier)
      } else {
        nextLikedProjectIdentifierSet.add(projectIdentifier)
      }
      return nextLikedProjectIdentifierSet
    })
  }

  function handleContactInputChange(event) {
    const changedInputName = event.target.name
    const changedInputValue = event.target.value
    setContactFormState((currentContactFormState) => ({
      ...currentContactFormState,
      [changedInputName]: changedInputValue,
    }))
  }

  async function handleContactFormSubmission(event) {
    event.preventDefault()

    const contactServiceResponse = await submitContactMessageUsingGateway(
      contactFormState,
      globalProjectContactGatewayClient,
      'landing-contact-flow'
    )

    if (contactServiceResponse.statusCode === 201) {
      setContactSubmissionFeedbackMessage(t('contact.successMessage', { fullName: contactFormState.fullName }))
      setContactFormState({ fullName: '', emailAddress: '', messageBody: '' })
      return
    }

    setContactSubmissionFeedbackMessage(contactServiceResponse.publicMessage || t('contact.errorMessage'))
  }

  function handleOpenProjectModal(projectIdentifier, sourceElement) {
    const hasValidSourceElement = sourceElement && typeof sourceElement.getBoundingClientRect === 'function'

    if (hasValidSourceElement) {
      const sourceElementRect = sourceElement.getBoundingClientRect()
      const sourceCenterX = sourceElementRect.left + (sourceElementRect.width / 2)
      const sourceCenterY = sourceElementRect.top + (sourceElementRect.height / 2)
      const viewportCenterX = window.innerWidth / 2
      const viewportCenterY = window.innerHeight / 2

      setModalOpenAnimationOffset({
        x: sourceCenterX - viewportCenterX,
        y: sourceCenterY - viewportCenterY,
      })
    } else {
      setModalOpenAnimationOffset({ x: 0, y: 12 })
    }

    setSelectedProjectIdentifier(projectIdentifier)
    setCurrentGalleryImageIndex(0)
  }

  function handleCloseProjectModal() {
    setSelectedProjectIdentifier(null)
  }

  function handleNavigateGalleryLeft() {
    if (!selectedProjectData || selectedProjectGalleryImageCount === 0) return

    setCurrentGalleryImageIndex((currentIndex) => {
      const hasPreviousImage = currentIndex > 0
      return hasPreviousImage ? currentIndex - 1 : selectedProjectGalleryImageCount - 1
    })
  }

  function handleNavigateGalleryRight() {
    if (!selectedProjectData || selectedProjectGalleryImageCount === 0) return

    setCurrentGalleryImageIndex((currentIndex) => {
      const isLastImage = currentIndex >= selectedProjectGalleryImageCount - 1
      return isLastImage ? 0 : currentIndex + 1
    })
  }

  function handleShareProjectClick() {
    alert(t('modal.copied'))
  }

  function handleModalOverlayClick(event) {
    if (event.target === event.currentTarget) {
      handleCloseProjectModal()
    }
  }

  function resolvePortfolioGridPlacementClass(articleIndex, totalArticles) {
    const remainingItemsInLgRow = totalArticles % 3
    const startIndexOfLastLgRow = totalArticles - remainingItemsInLgRow
    const isLastLgRow = remainingItemsInLgRow > 0 && articleIndex >= startIndexOfLastLgRow

    if (!isLastLgRow) {
      return ''
    }

    if (remainingItemsInLgRow === 1 && articleIndex === totalArticles - 1) {
      return 'sm:col-span-2 sm:w-full sm:max-w-[28rem] sm:justify-self-center lg:col-span-1 lg:max-w-none lg:col-start-2'
    }

    if (remainingItemsInLgRow === 2 && articleIndex === totalArticles - 1) {
      return 'lg:col-start-3'
    }

    return ''
  }

  const featuredProjectData = publishedArticleCatalog[0]

  if (isAdminRouteActive) {
    return (
      <Suspense fallback={<AdminAccessPanelLoadingFallback />}>
        <LazyAdminAccessPanel
          articlePublicationController={globalArticlePublicationController}
          onArticleCatalogChange={syncManagedArticleCatalog}
          onNavigateBackToLanding={() => {
            window.location.hash = globalAdminAccessConfig.landingRouteHash
          }}
        />
      </Suspense>
    )
  }

  return (
    <div className="w-full">
      <header id="home" className="cute-box no-lift relative mx-auto w-full max-w-7xl overflow-hidden bg-pastelPink px-4 py-5 sm:px-8 sm:py-8 lg:px-12 lg:py-12 mb-10 sm:mb-16">
        <div ref={floatingCandyLayerReference} aria-hidden="true" className="header-candy-float-layer z-0" />

        <nav className="relative z-20 flex w-full flex-wrap items-center justify-center gap-6">
          <ul className="flex items-center gap-4 text-sm font-bold uppercase text-inkBlack sm:gap-6">
            <li><a href="#home" className="transition-transform duration-300 ease-out hover:-translate-y-1 hover:text-pastelPink">{t('nav.home')}</a></li>
            <li><a href="#assetsHeading" className="transition-transform duration-300 ease-out hover:-translate-y-1 hover:text-pastelPink">{t('nav.assets')}</a></li>
            <li><a href="#contatoHeading" className="transition-transform duration-300 ease-out hover:-translate-y-1 hover:text-pastelPink">{t('nav.contact')}</a></li>
          </ul>

          <div
            ref={languageMenuReference}
            className="absolute right-0 top-1/2 -translate-y-1/2"
            aria-label={t('language.switcherLabel')}
          >
            <button
              type="button"
              onClick={() => setIsLanguageMenuOpen((currentIsOpen) => !currentIsOpen)}
              className="flex h-9 w-9 items-center justify-center border-0 bg-transparent p-0 shadow-none transition-transform duration-150 hover:scale-105"
              aria-label={t('language.switcherLabel')}
              aria-expanded={isLanguageMenuOpen}
              aria-haspopup="menu"
              title={t('language.switcherLabel')}
            >
              <LanguageFlagIcon languageCode={currentLanguageCode} />
            </button>

            <AnimatePresence>
              {isLanguageMenuOpen ? (
                <_motion.div
                  className="absolute right-0 mt-3 flex w-9 flex-col gap-2"
                  initial={{ opacity: 0, y: -8, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                {globalLanguageOptionCatalog.map((languageOption) => {
                  const isSelectedLanguage = languageOption.code === currentLanguageCode

                  return (
                    <button
                      key={languageOption.code}
                      type="button"
                      onClick={() => {
                        setCurrentLanguageCode(languageOption.code)
                        setIsLanguageMenuOpen(false)
                      }}
                      className={`flex h-9 w-9 items-center justify-center border-0 bg-transparent p-0 transition-transform duration-150 ${
                        isSelectedLanguage ? 'scale-105' : 'opacity-85 hover:scale-105 hover:opacity-100'
                      }`}
                      aria-label={`${t('language.switcherLabel')}: ${languageOption.label}`}
                      title={languageOption.label}
                    >
                      <LanguageFlagIcon languageCode={languageOption.code} />
                    </button>
                  )
                })}
                </_motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </nav>

        <section className="relative z-10 mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-8 lg:px-12 lg:py-16 flex flex-col items-center text-center">
          <article className="relative z-10 mt-5 space-y-10 sm:mt-0 sm:space-y-16">         
            <div className="mx-auto flex items-center justify-center gap-4 text-sm font-bold uppercase text-inkBlack sm:gap-6">
              <h1 className="text-4xl font-display text-inkBlack drop-shadow-[2px_2px_0px_#ffffff] sm:text-6xl lg:text-7xl">
                <span className="block">Candy Lab</span>
                <span className="block">Studios</span>
              </h1>
            </div>

            <div className="cute-box mx-auto inline-block bg-pastelYellow px-6 py-2 text-xs font-black uppercase text-inkBlack">
              {t('hero.badge')}
            </div>

            <p className="mx-auto max-w-2xl text-base font-bold text-inkBlack/80 px-4  border-b-4 border-inkBlack py-4">
              {t('hero.description')}
            </p>
          </article>

          <article className="relative z-10 mx-auto mt-10 mb-5 sm:mt-16 sm:mb-8 w-full max-w-2xl px-4 sm:px-6">
            {featuredProjectData ? (
             <div
                className="cute-box relative mx-auto w-full max-w-150 bg-pastelBlue p-3 sm:p-0 border-4 border-white shadow-xl cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={(event) => handleOpenProjectModal(featuredProjectData.id, event.currentTarget)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleOpenProjectModal(featuredProjectData.id, event.currentTarget)
                  }
                }}
                 aria-label={t('featured.openModal', { title: featuredProjectData.title })}
             >
                <div className="relative w-full aspect-4/3 overflow-hidden rounded-lg sm:rounded-none">
                  <ProjectThumbnailImage
                    imageUrl={featuredProjectData.imageUrl}
                    imageAlternativeText={featuredProjectData.imageAlternativeText}
                    isAboveTheFold
                    className="h-full w-full object-cover transition-transform duration-400 ease-out hover:scale-105"
                  />
                </div>

                <div className="cute-box mx-auto mt-3 w-fit bg-paperWhite px-4 py-2 text-center sm:absolute sm:bottom-5 sm:left-5 sm:mt-0 sm:px-5 sm:py-3 sm:text-left">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="text-xl font-display text-inkBlack drop-shadow-[1px_1px_0px_#ffffff]">{featuredProjectData.title}</h3>
                      <p className="text-xs font-bold uppercase text-inkBlack/70">{t('featured.category')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <img
                        src="/svg/robux_logo_black.svg"
                        alt="Robux"
                        className="h-6 w-6 shrink-0 object-contain"
                        loading="lazy"
                      />
                      <span className="text-lg font-black leading-none text-inkBlack">
                        {Number(featuredProjectData.robuxPrice ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
             </div>
            ) : (
              <div className="cute-box mx-auto bg-paperWhite p-8 text-center">
                <p className="text-sm font-black uppercase tracking-wider text-inkBlack/70">
                  {t('featured.empty')}
                </p>
              </div>
            )}
          </article>
        </section>
      </header>

      <main className="mt-10 space-y-10 sm:mt-12 sm:space-y-16">
        <section id="portfolio" aria-labelledby="portfolioSectionHeading" className="cute-box no-lift mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-8 lg:px-12 lg:py-12 bg-pastelBlue mb-10 sm:mb-16 border-4 border-white">
          <div id="assetsHeading" className="scroll-mt-5.5 mb-8 text-center bg-paperWhite cute-box w-full px-6 py-4 sm:mb-12 sm:px-10 sm:py-6">
            <h2 id="portfolioSectionHeading" className="text-3xl sm:text-5xl font-display text-inkBlack drop-shadow-[2px_2px_0px_#ffffff]">{t('assets.title')}</h2>
            <p className="mt-3 text-sm font-black tracking-widest uppercase text-inkBlack/80">{t('assets.subtitle')}</p>
          </div>

          <div className="grid gap-6 sm:gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {publishedArticleCatalog.map((projectData, projectIndex) => (
              <article
                key={projectData.id}
                className={`group flex flex-col items-center ${resolvePortfolioGridPlacementClass(
                  projectIndex,
                  publishedArticleCatalog.length
                )}`}
              >
                <button
                  type="button"
                  className="cute-box relative flex w-full flex-col items-center overflow-hidden bg-paperWhite p-4 text-center border-2 transition-colors duration-300 ease-out hover:border-pastelPink"
                  onClick={(event) => handleOpenProjectModal(projectData.id, event.currentTarget)}
                  aria-label={t('assets.openDetails', { title: projectData.title })}
                >
                  <div className="cute-box relative w-full aspect-4/3 overflow-hidden bg-pastelPink shadow-none p-0!">
                    <ProjectThumbnailImage
                      imageUrl={projectData.imageUrl}
                      imageAlternativeText={projectData.imageAlternativeText}
                      isAboveTheFold={projectIndex < globalAboveTheFoldProjectImageCount}
                      className="h-full w-full object-cover filter saturate-150 transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="cute-box absolute -right-2 top-4 flex h-14 w-14 items-center justify-center rounded-full bg-pastelYellow shadow-none text-sm font-black uppercase text-inkBlack -rotate-12 border-2 border-white p-0!">
                      <span className="flex items-center gap-1">
                        {projectLikeCountByIdentifier[projectData.id]}
                        <FaHeart aria-hidden="true" />
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-6 mb-2 space-y-2">
                    <h3 className="text-xl sm:text-xl font-display text-inkBlack drop-shadow-[1px_1px_0px_#ffffff]">{projectData.title}</h3>
                    <p className="mx-auto text-xs font-bold uppercase tracking-wider text-inkBlack/70">
                      {projectData.subtitle}
                    </p>
                    <div className="mx-auto mt-3 flex items-center justify-center gap-2">
                      <img
                        src="/svg/robux_logo_black.svg"
                        alt="Robux"
                        className="h-6 w-6 shrink-0 object-contain"
                        loading="lazy"
                      />
                      <span className="text-lg font-black leading-none text-inkBlack">
                        {Number(projectData.robuxPrice ?? 0)}
                      </span>
                    </div>
                    <span className="cute-box mt-3 inline-flex items-center bg-paperWhite px-6 py-2 text-xs font-black uppercase tracking-wider text-inkBlack transition-colors duration-300 ease-out hover:bg-pastelPink hover:text-inkBlack">
                      {t('assets.viewDetails')}
                    </span>
                  </div>
                </button>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="socialSectionHeading" className="cute-box no-lift mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-8 lg:px-12 lg:py-12 bg-pastelYellow">
          <div id="contatoHeading" className="scroll-mt-5.5 mb-8 text-center bg-paperWhite cute-box w-full px-6 py-4 sm:mb-12 sm:px-10 sm:py-6">
            <h2 className="text-3xl sm:text-5xl font-display text-inkBlack drop-shadow-[2px_2px_0px_#ffffff]">{t('contact.sectionTitle')}</h2>
          </div>

          <div className="grid gap-6 sm:gap-10 lg:grid-cols-2">
          <article className="flex flex-col justify-center space-y-5 sm:space-y-8">
            <div>
              <h2 id="socialSectionHeading" className="text-3xl sm:text-4xl font-display text-inkBlack drop-shadow-[2px_2px_0px_#ffffff]">{t('contact.socialHeading')}</h2>
            </div>
            <p className="text-base font-bold leading-relaxed text-inkBlack/80">
              {t('contact.socialDescription')}
            </p>

            <ul className="flex flex-wrap gap-4">
              {globalCuratedSocialLinks.map((socialChannelData) => (
                <li key={socialChannelData.id}>
                  <a
                    href={socialChannelData.url}
                    target="_blank"
                    rel="noreferrer"
                    className="cute-box flex items-center gap-3 bg-paperWhite px-6 py-3 font-bold text-inkBlack transition-colors duration-300 ease-out hover:bg-pastelPink hover:text-inkBlack"
                  >
                    <span aria-hidden="true">
                      <socialChannelData.iconComponent size={18} />
                    </span>
                    <span>{socialChannelData.channelName}</span>
                  </a>
                </li>
              ))}
            </ul>
          </article>

          <article className="cute-box bg-pastelPink p-4 sm:p-8 shadow-none border-[6px] border-white">
            <h3 className="text-2xl sm:text-3xl font-display text-inkBlack drop-shadow-[2px_2px_0px_#ffffff]">{t('contact.formTitle')}</h3>
            <form className="mt-5 sm:mt-8 flex flex-col space-y-4 sm:space-y-5" onSubmit={handleContactFormSubmission}>
              <label className="block text-xs font-black uppercase tracking-wider text-inkBlack">
                {t('contact.fullNameLabel')}
                <input
                  name="fullName"
                  type="text"
                  value={contactFormState.fullName}
                  onChange={handleContactInputChange}
                  required
                  className="cute-input mt-2 w-full border-2 border-dashed"
                  placeholder={t('contact.fullNamePlaceholder')}
                />
              </label>
              <label className="block text-xs font-black uppercase tracking-wider text-inkBlack">
                {t('contact.emailLabel')}
                <input
                  name="emailAddress"
                  type="email"
                  value={contactFormState.emailAddress}
                  onChange={handleContactInputChange}
                  required
                  className="cute-input mt-2 w-full border-2 border-dashed"
                  placeholder={t('contact.emailPlaceholder')}
                />
              </label>
              <label className="block text-xs font-black uppercase tracking-wider text-inkBlack">
                {t('contact.detailsLabel')}
                <textarea
                  name="messageBody"
                  rows="3"
                  value={contactFormState.messageBody}
                  onChange={handleContactInputChange}
                  required
                  className="cute-input mt-2 w-full resize-none border-2 border-dashed"
                  placeholder={t('contact.detailsPlaceholder')}
                />
              </label>
              <button type="submit" className="cute-button mt-4 flex w-full items-center justify-center gap-2 bg-pastelYellow">
                <FaShareAlt aria-hidden="true" />
                <span>{t('contact.submit')}</span>
              </button>
              {contactSubmissionFeedbackMessage ? (
                <p className="cute-box mt-4 bg-paperWhite py-3 text-center text-sm font-black shadow-none" role="status">
                  {contactSubmissionFeedbackMessage}
                </p>
              ) : null}
            </form>
          </article>
          </div>
        </section>
      </main>

      <footer className="mt-10 sm:mt-16 mb-0 flex flex-col items-center gap-1 sm:gap-4 pb-0 sm:pb-10">
        <span className="cute-box mx-auto block w-full max-w-7xl px-4 py-2 text-center text-xs font-black uppercase tracking-wider shadow-none sm:px-8 lg:px-12">© 2026 Candy Lab Studios</span>
        <a
          href={globalAdminAccessConfig.adminRouteHash}
          className="mb-0 text-[10px] leading-none font-bold uppercase tracking-widest text-inkBlack/60 transition-colors duration-300 ease-out hover:text-inkBlack"
          aria-label={t('footer.privateAccessAria')}
        >
          {t('footer.privateAccess')}
        </a>
      </footer>

      <AnimatePresence>
        {selectedProjectData ? (
          <_motion.section
            aria-label={t('modal.sectionLabel')}
            className="fixed inset-0 z-50 flex items-end justify-center overscroll-none bg-inkBlack/80 px-2 py-2 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6"
            onClick={handleModalOverlayClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <_motion.article
              className="cute-box no-lift relative flex max-h-[86dvh] w-full max-w-[calc(100vw-0.75rem)] flex-col overflow-auto overscroll-contain bg-pastelMint p-4 border-[6px] border-white sm:max-h-[92vh] sm:max-w-6xl sm:p-6"
              onClick={(event) => event.stopPropagation()}
              initial={{ opacity: 0, scale: 0.82, x: modalOpenAnimationOffset.x, y: modalOpenAnimationOffset.y }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
            <button
              type="button"
              className="cute-control-button cute-control-button-close absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center text-base font-black sm:right-4 sm:top-4 sm:h-10 sm:w-10 sm:text-xl"
              onClick={handleCloseProjectModal}
              aria-label={t('modal.close')}
            >
              <FaTimes aria-hidden="true" />
            </button>

            <div className="relative flex w-full flex-col items-center justify-center gap-4 bg-white cute-box no-lift p-3 sm:p-6">
              <div className="relative aspect-4/3 w-full max-w-86 overflow-hidden bg-pastelBlue cute-box no-lift p-0! sm:max-w-200">
                <Suspense
                  fallback={(
                    <ProjectGalleryLightboxLoadingFallback
                      activeGalleryImageUrl={selectedProjectData.galleryImageUrls[currentGalleryImageIndex]}
                      imageAlternativeText={selectedProjectData.imageAlternativeText}
                    />
                  )}
                >
                  <LazyProjectGalleryLightbox
                    galleryImageUrls={selectedProjectData.galleryImageUrls}
                    activeGalleryImageIndex={currentGalleryImageIndex}
                    imageAlternativeText={selectedProjectData.imageAlternativeText}
                    zoomImageLabel={t('modal.zoomImage')}
                    resolveDimensionsByUrl={resolvePhotoSwipeDimensionsByUrl}
                    onBeforeOpen={handlePhotoSwipeBeforeOpen}
                  />
                </Suspense>
                  {selectedProjectGalleryImageCount > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={handleNavigateGalleryLeft}
                        className="cute-control-button absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center border-2 border-white bg-pastelYellow hover:bg-[#f5d060] sm:h-12 sm:w-12"
                        aria-label={t('modal.previousImage')}
                      >
                        <FaArrowLeft aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNavigateGalleryRight}
                        className="cute-control-button absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center border-2 border-white bg-pastelYellow hover:bg-[#f5d060] sm:h-12 sm:w-12"
                        aria-label={t('modal.nextImage')}
                      >
                        <FaArrowRight aria-hidden="true" />
                      </button>
                    </>
                  )}
              </div>
              <div className="flex gap-2 justify-center mt-2">
                 {selectedProjectData.galleryImageUrls.map((url, index) => (
                    <button
                     type="button"
                      key={url}
                      onClick={() => setCurrentGalleryImageIndex(index)}
                     className={`carousel-dot ${index === currentGalleryImageIndex ? 'bg-pastelPink scale-125' : 'bg-white'}`}
                       aria-label={t('modal.goToImage', { index: index + 1 })}
                    />
                 ))}
              </div>
            </div>

            <div className="mt-5 sm:mt-8 flex w-full flex-col justify-center space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl sm:text-5xl font-display text-inkBlack drop-shadow-[2px_2px_0px_#ffffff] mb-2">
                    {selectedProjectData.title}
                  </h2>
                  <span className="cute-box mt-2 inline-block bg-paperWhite px-3 py-1 text-xs font-black uppercase shadow-none border-2 border-inkBlack">
                    {selectedProjectData.subtitle}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-1 py-1">
                  <img
                    src="/svg/robux_logo_black.svg"
                    alt="Robux"
                    className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
                    loading="lazy"
                  />
                  <span className="text-2xl font-black leading-none text-inkBlack sm:text-3xl">
                    {Number(selectedProjectData.robuxPrice ?? 0)}
                  </span>
                </div>
              </div>
              <p className="text-base font-bold leading-relaxed text-inkBlack/80 bg-pastelYellow p-4 sm:p-6 cute-box shadow-none border-4 border-white">
                {selectedProjectData.description}
              </p>
              <div className="flex flex-row items-center gap-4 sm:gap-5 mt-4 sm:mt-6">
                <button
                  type="button"
                  onClick={() => handleProjectLikeClick(selectedProjectData.id)}
                  className={`cute-control-button flex h-10 w-10 items-center justify-center border-2 border-inkBlack text-xl sm:h-12 sm:w-12 sm:text-2xl ${
                    hasSelectedProjectBeenLiked
                      ? 'bg-pastelPink hover:bg-[#f09490]'
                      : 'bg-paperWhite! hover:bg-pastelBlue!'
                  }`}
                  aria-label={hasSelectedProjectBeenLiked ? t('modal.removeLike') : t('modal.like')}
                >
                  {hasSelectedProjectBeenLiked ? <FaHeart className="text-red-600" aria-hidden="true" /> : <FaRegHeart className="text-inkBlack" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={handleShareProjectClick}
                  className="cute-button cute-button-share flex h-10 flex-1 items-center justify-center gap-2 border-2 border-inkBlack text-inkBlack sm:h-12"
                >
                  <FaShareAlt aria-hidden="true" />
                  <span>{t('modal.share')}</span>
                </button>
              </div>
              <p className="text-xs font-black uppercase tracking-wider text-inkBlack/70">
                {t('modal.likes', { count: projectLikeCountByIdentifier[selectedProjectData.id] })}
              </p>
            </div>
            </_motion.article>
          </_motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default App