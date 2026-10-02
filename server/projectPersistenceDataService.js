import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { globalPortfolioProjectCatalog } from '../src/constants/globalPortfolioCatalog.js'

const globalMaxArticlesPerCatalog = 200
const globalMaxTextLength = 500
const globalMaxDescriptionLength = 4000
const globalMaxTagLength = 40
const globalMaxTagsPerArticle = 12
const globalMaxFileFormatsPerArticle = 8
const globalMaxUrlLength = 2048
const globalMaxGalleryImagesPerArticle = 20
const globalMaxArticleCatalogPayloadBytes = 512 * 1024
const globalMaxImageUploadPayloadBytes = 15 * 1024 * 1024
const globalAllowedUploadMimeTypeSet = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
])

const globalFileExtensionByUploadMimeType = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

const globalCurrentFilePath = fileURLToPath(import.meta.url)
const globalServerDirectoryPath = path.dirname(globalCurrentFilePath)
const globalProjectRootDirectoryPath = path.resolve(globalServerDirectoryPath, '..')

const globalProjectDataDirectoryPath = path.resolve(globalProjectRootDirectoryPath, 'data')
const globalProjectArticlesFilePath = path.resolve(globalProjectDataDirectoryPath, 'articles.json')
const globalProjectPreferencesFilePath = path.resolve(globalProjectDataDirectoryPath, 'projectPreferences.json')
const globalProjectContactSubmissionsFilePath = path.resolve(globalProjectDataDirectoryPath, 'contactSubmissions.json')
const globalPublicUploadsDirectoryPath = path.resolve(globalProjectRootDirectoryPath, 'public', 'uploads')
const globalDistributionDirectoryPath = path.resolve(globalProjectRootDirectoryPath, 'dist')
const globalAllowedUploadFileExtensionCatalog = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']
const globalHexColorPattern = /^#[0-9a-fA-F]{6}$/
const globalFallbackBackgroundColor = '#ffffff'
const globalFallbackBackgroundImageUrl = ''
const globalFallbackYellowThemeColor = '#ffdf85'
const globalMaxEmailLength = 320
const globalMaxContactMessageLength = 4000
const globalMaxContactSubmissionsStored = 2000
const globalEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isPathInsideParent(parentPath, targetPath) {
  const relativePath = path.relative(parentPath, targetPath)
  return relativePath.length > 0 && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

function sanitizeTextValue(rawValue, maxLength = globalMaxTextLength) {
  return String(rawValue || '').replace(/[<>]/g, '').trim().slice(0, maxLength)
}

function decodeCommonHtmlEntities(rawTextValue) {
  return String(rawTextValue || '')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#96;', '`')
}

function sanitizeUrlValue(rawValue) {
  return decodeCommonHtmlEntities(String(rawValue || '').trim()).slice(0, globalMaxUrlLength)
}

function sanitizeBackgroundImageUrl(rawValue) {
  const normalizedUrlValue = sanitizeUrlValue(rawValue)

  if (!normalizedUrlValue) {
    return globalFallbackBackgroundImageUrl
  }

  if (normalizedUrlValue.startsWith('/')) {
    return normalizedUrlValue
  }

  try {
    const absoluteUrl = new URL(normalizedUrlValue)
    const isSupportedProtocol = ['http:', 'https:'].includes(absoluteUrl.protocol)
    return isSupportedProtocol ? normalizedUrlValue : globalFallbackBackgroundImageUrl
  } catch {
    return globalFallbackBackgroundImageUrl
  }
}

function sanitizeHexColor(rawHexColor, fallbackHexColor) {
  const normalizedHexColor = String(rawHexColor || '').trim()
  return globalHexColorPattern.test(normalizedHexColor) ? normalizedHexColor : fallbackHexColor
}

function createDefaultProjectPreferencesForPersistence() {
  return {
    backgroundHexColor: globalFallbackBackgroundColor,
    backgroundImageUrl: globalFallbackBackgroundImageUrl,
    yellowThemeHexColor: globalFallbackYellowThemeColor,
  }
}

function normalizeProjectPreferencesForPersistence(projectPreferences) {
  const normalizedProjectPreferences = projectPreferences && typeof projectPreferences === 'object'
    ? projectPreferences
    : {}

  return {
    backgroundHexColor: sanitizeHexColor(
      normalizedProjectPreferences.backgroundHexColor,
      globalFallbackBackgroundColor
    ),
    backgroundImageUrl: sanitizeBackgroundImageUrl(normalizedProjectPreferences.backgroundImageUrl),
    yellowThemeHexColor: sanitizeHexColor(
      normalizedProjectPreferences.yellowThemeHexColor,
      globalFallbackYellowThemeColor
    ),
  }
}

function sanitizeGalleryUrlCatalog(galleryUrlCatalog) {
  if (!Array.isArray(galleryUrlCatalog)) {
    return []
  }

  return galleryUrlCatalog
    .slice(0, globalMaxGalleryImagesPerArticle)
    .map((urlValue) => sanitizeUrlValue(urlValue))
    .filter((urlValue) => urlValue.length > 0)
}

function normalizeRobuxPrice(rawRobuxPrice) {
  const normalizedRobuxPrice = Number(rawRobuxPrice)
  return Number.isInteger(normalizedRobuxPrice) && normalizedRobuxPrice >= 0 ? normalizedRobuxPrice : 0
}

function sanitizeShortTextCatalog(rawCatalog, maxEntryCount) {
  if (!Array.isArray(rawCatalog)) {
    return []
  }

  return rawCatalog
    .slice(0, maxEntryCount)
    .map((rawEntryValue) => sanitizeTextValue(rawEntryValue, globalMaxTagLength))
    .filter((sanitizedEntryValue) => sanitizedEntryValue.length > 0)
}

function sanitizeTagCatalog(rawTagCatalog) {
  const seenTagSet = new Set()

  return sanitizeShortTextCatalog(rawTagCatalog, globalMaxTagsPerArticle).filter((sanitizedTagValue) => {
    const tagLookupKey = sanitizedTagValue.toLowerCase()

    if (seenTagSet.has(tagLookupKey)) {
      return false
    }

    seenTagSet.add(tagLookupKey)
    return true
  })
}

function sanitizeFileFormatCatalog(rawFileFormatCatalog) {
  return sanitizeShortTextCatalog(rawFileFormatCatalog, globalMaxFileFormatsPerArticle)
}

function sanitizeAuthoringSoftware(rawAuthoringSoftware) {
  return {
    name: sanitizeTextValue(rawAuthoringSoftware?.name, globalMaxTagLength),
    iconKey: sanitizeTextValue(rawAuthoringSoftware?.iconKey, globalMaxTagLength).toLowerCase(),
  }
}

function validateArticleCatalogPayload(articleCatalog) {
  if (!Array.isArray(articleCatalog)) {
    return
  }

  if (articleCatalog.length > globalMaxArticlesPerCatalog) {
    const validationError = new Error('Catalogo de artigos excede limite permitido.')
    validationError.statusCode = 422
    throw validationError
  }
}

function createSeedArticleCatalogForPersistence() {
  return globalPortfolioProjectCatalog.map((articleData, articleIndex) => {
    const normalizedIdentifier = sanitizeTextValue(articleData.id || `article-${articleIndex + 1}`)

    return {
      id: normalizedIdentifier,
      title: sanitizeTextValue(articleData.title),
      subtitle: sanitizeTextValue(articleData.subtitle),
      summary: sanitizeTextValue(articleData.summary || articleData.subtitle),
      description: sanitizeTextValue(articleData.description, globalMaxDescriptionLength),
      imageUrl: sanitizeUrlValue(articleData.imageUrl),
      imageAlternativeText: sanitizeTextValue(articleData.imageAlternativeText || articleData.title),
      galleryImageUrls: sanitizeGalleryUrlCatalog(articleData.galleryImageUrls),
      tags: sanitizeTagCatalog(articleData.tags),
      authoringSoftware: sanitizeAuthoringSoftware(articleData.authoringSoftware),
      fileFormats: sanitizeFileFormatCatalog(articleData.fileFormats),
      purchaseUrl: sanitizeUrlValue(articleData.purchaseUrl),
      copyrightNotice: sanitizeTextValue(articleData.copyrightNotice, globalMaxDescriptionLength),
      isGeneratedWithArtificialIntelligence: Boolean(articleData.isGeneratedWithArtificialIntelligence),
      likeCount: Number.isInteger(articleData.likeCount) ? articleData.likeCount : 0,
      robuxPrice: normalizeRobuxPrice(articleData.robuxPrice),
      isPublished: true,
      orderIndex: articleIndex,
      publishedAtIso: new Date().toISOString(),
    }
  })
}

function normalizeArticleCatalogForPersistence(articleCatalog) {
  validateArticleCatalogPayload(articleCatalog)

  if (!Array.isArray(articleCatalog)) {
    return createSeedArticleCatalogForPersistence()
  }

  return articleCatalog.map((articleData, articleIndex) => {
    return {
      id: sanitizeTextValue(articleData.id || `article-${articleIndex + 1}`),
      title: sanitizeTextValue(articleData.title),
      subtitle: sanitizeTextValue(articleData.subtitle),
      summary: sanitizeTextValue(articleData.summary || articleData.subtitle),
      description: sanitizeTextValue(articleData.description, globalMaxDescriptionLength),
      imageUrl: sanitizeUrlValue(articleData.imageUrl),
      imageAlternativeText: sanitizeTextValue(articleData.imageAlternativeText || articleData.title),
      galleryImageUrls: sanitizeGalleryUrlCatalog(articleData.galleryImageUrls),
      tags: sanitizeTagCatalog(articleData.tags),
      authoringSoftware: sanitizeAuthoringSoftware(articleData.authoringSoftware),
      fileFormats: sanitizeFileFormatCatalog(articleData.fileFormats),
      purchaseUrl: sanitizeUrlValue(articleData.purchaseUrl),
      copyrightNotice: sanitizeTextValue(articleData.copyrightNotice, globalMaxDescriptionLength),
      isGeneratedWithArtificialIntelligence: Boolean(articleData.isGeneratedWithArtificialIntelligence),
      likeCount: Number.isInteger(articleData.likeCount) && articleData.likeCount >= 0 ? articleData.likeCount : 0,
      robuxPrice: normalizeRobuxPrice(articleData.robuxPrice),
      isPublished: Boolean(articleData.isPublished),
      orderIndex: articleIndex,
      publishedAtIso: String(articleData.publishedAtIso || new Date().toISOString()),
    }
  })
}

async function ensureDirectoryExists(directoryPath) {
  await fs.promises.mkdir(directoryPath, { recursive: true })
}

async function ensureArticlesFileExists() {
  await ensureDirectoryExists(globalProjectDataDirectoryPath)

  if (!fs.existsSync(globalProjectArticlesFilePath)) {
    const seedArticleCatalog = createSeedArticleCatalogForPersistence()
    await fs.promises.writeFile(globalProjectArticlesFilePath, JSON.stringify(seedArticleCatalog, null, 2), 'utf-8')
  }
}

async function ensureProjectPreferencesFileExists() {
  await ensureDirectoryExists(globalProjectDataDirectoryPath)

  if (!fs.existsSync(globalProjectPreferencesFilePath)) {
    const defaultProjectPreferences = createDefaultProjectPreferencesForPersistence()
    await fs.promises.writeFile(globalProjectPreferencesFilePath, JSON.stringify(defaultProjectPreferences, null, 2), 'utf-8')
  }
}

async function ensureContactSubmissionsFileExists() {
  await ensureDirectoryExists(globalProjectDataDirectoryPath)

  if (!fs.existsSync(globalProjectContactSubmissionsFilePath)) {
    await fs.promises.writeFile(globalProjectContactSubmissionsFilePath, JSON.stringify([], null, 2), 'utf-8')
  }
}

function normalizeContactSubmissionForPersistence(contactSubmission) {
  const normalizedContactSubmission = contactSubmission && typeof contactSubmission === 'object'
    ? contactSubmission
    : {}

  return {
    id: `contact-${Date.now()}-${randomUUID().slice(0, 8)}`,
    fullName: sanitizeTextValue(normalizedContactSubmission.fullName),
    emailAddress: sanitizeTextValue(normalizedContactSubmission.emailAddress, globalMaxEmailLength),
    messageBody: sanitizeTextValue(normalizedContactSubmission.messageBody, globalMaxContactMessageLength),
    submittedAtIso: new Date().toISOString(),
  }
}

function validateContactSubmissionPayload(contactSubmission) {
  const normalizedContactSubmission = contactSubmission && typeof contactSubmission === 'object'
    ? contactSubmission
    : {}

  const sanitizedFullName = sanitizeTextValue(normalizedContactSubmission.fullName)
  const sanitizedEmailAddress = sanitizeTextValue(normalizedContactSubmission.emailAddress, globalMaxEmailLength)
  const sanitizedMessageBody = sanitizeTextValue(normalizedContactSubmission.messageBody, globalMaxContactMessageLength)

  if (sanitizedFullName.length < 2) {
    const validationError = new Error('Nome invalido para envio de contato.')
    validationError.statusCode = 422
    throw validationError
  }

  if (!globalEmailPattern.test(sanitizedEmailAddress)) {
    const validationError = new Error('Email invalido para envio de contato.')
    validationError.statusCode = 422
    throw validationError
  }

  if (sanitizedMessageBody.length < 5) {
    const validationError = new Error('Mensagem invalida para envio de contato.')
    validationError.statusCode = 422
    throw validationError
  }
}

function normalizeContactSubmissionCatalogForPersistence(contactSubmissionCatalog) {
  if (!Array.isArray(contactSubmissionCatalog)) {
    return []
  }

  return contactSubmissionCatalog
    .map((contactSubmission) => normalizeContactSubmissionForPersistence(contactSubmission))
    .slice(-globalMaxContactSubmissionsStored)
}

export async function loadProjectArticleCatalogFromDisk() {
  await ensureArticlesFileExists()

  try {
    const articleCatalogText = await fs.promises.readFile(globalProjectArticlesFilePath, 'utf-8')
    const parsedCatalog = JSON.parse(articleCatalogText)
    return normalizeArticleCatalogForPersistence(parsedCatalog)
  } catch {
    const seedArticleCatalog = createSeedArticleCatalogForPersistence()
    await fs.promises.writeFile(globalProjectArticlesFilePath, JSON.stringify(seedArticleCatalog, null, 2), 'utf-8')
    return seedArticleCatalog
  }
}

export async function persistProjectArticleCatalogOnDisk(articleCatalog) {
  await ensureArticlesFileExists()
  const normalizedArticleCatalog = normalizeArticleCatalogForPersistence(articleCatalog)
  await fs.promises.writeFile(globalProjectArticlesFilePath, JSON.stringify(normalizedArticleCatalog, null, 2), 'utf-8')
  return normalizedArticleCatalog
}

export async function loadProjectPreferencesFromDisk() {
  await ensureProjectPreferencesFileExists()

  try {
    const projectPreferencesText = await fs.promises.readFile(globalProjectPreferencesFilePath, 'utf-8')
    const parsedProjectPreferences = JSON.parse(projectPreferencesText)
    return normalizeProjectPreferencesForPersistence(parsedProjectPreferences)
  } catch {
    const defaultProjectPreferences = createDefaultProjectPreferencesForPersistence()
    await fs.promises.writeFile(globalProjectPreferencesFilePath, JSON.stringify(defaultProjectPreferences, null, 2), 'utf-8')
    return defaultProjectPreferences
  }
}

export async function persistProjectPreferencesOnDisk(projectPreferences) {
  await ensureProjectPreferencesFileExists()
  const normalizedProjectPreferences = normalizeProjectPreferencesForPersistence(projectPreferences)
  await fs.promises.writeFile(globalProjectPreferencesFilePath, JSON.stringify(normalizedProjectPreferences, null, 2), 'utf-8')
  return normalizedProjectPreferences
}

export async function persistContactSubmissionOnDisk(contactSubmission) {
  await ensureContactSubmissionsFileExists()
  validateContactSubmissionPayload(contactSubmission)

  let currentContactSubmissionCatalog = []

  try {
    const persistedCatalogText = await fs.promises.readFile(globalProjectContactSubmissionsFilePath, 'utf-8')
    const parsedCatalog = JSON.parse(persistedCatalogText)
    currentContactSubmissionCatalog = normalizeContactSubmissionCatalogForPersistence(parsedCatalog)
  } catch {
    currentContactSubmissionCatalog = []
  }

  const normalizedContactSubmission = normalizeContactSubmissionForPersistence(contactSubmission)
  const nextContactSubmissionCatalog = [
    ...currentContactSubmissionCatalog,
    normalizedContactSubmission,
  ].slice(-globalMaxContactSubmissionsStored)

  await fs.promises.writeFile(
    globalProjectContactSubmissionsFilePath,
    JSON.stringify(nextContactSubmissionCatalog, null, 2),
    'utf-8'
  )

  return normalizedContactSubmission
}

function resolveJsonContentType(contentTypeHeader) {
  return String(contentTypeHeader || '').toLowerCase().includes('application/json')
}

export async function readRequestBodyAsJson(request, options = {}) {
  const {
    requireJsonContentType = true,
    maxBodySizeInBytes = globalMaxArticleCatalogPayloadBytes,
  } = options

  if (requireJsonContentType && !resolveJsonContentType(request.headers['content-type'])) {
    const contentTypeError = new Error('Content-Type invalido para requisicao JSON.')
    contentTypeError.statusCode = 415
    throw contentTypeError
  }

  return new Promise((resolve, reject) => {
    let rawBody = ''
    let accumulatedBodySize = 0

    request.on('data', (bodyChunk) => {
      accumulatedBodySize += bodyChunk.length

      if (accumulatedBodySize > maxBodySizeInBytes) {
        const payloadTooLargeError = new Error('Payload excede limite permitido.')
        payloadTooLargeError.statusCode = 413
        reject(payloadTooLargeError)
        request.destroy()
        return
      }

      rawBody += bodyChunk
    })

    request.on('end', () => {
      if (!rawBody) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(rawBody))
      } catch {
        const invalidJsonError = new Error('JSON invalido na requisicao.')
        invalidJsonError.statusCode = 400
        reject(invalidJsonError)
      }
    })

    request.on('error', () => {
      const readBodyError = new Error('Falha ao ler corpo da requisicao.')
      readBodyError.statusCode = 400
      reject(readBodyError)
    })
  })
}

export function createCorrelationIdentifier() {
  return randomUUID().slice(0, 12)
}

export function writeJsonResponse(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function extractMimeTypeFromDataUrl(imageDataUrl) {
  const matchedMimeType = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/.exec(String(imageDataUrl || ''))
  return matchedMimeType?.[1] || null
}

function sanitizeFileNameSegment(rawValue) {
  return String(rawValue || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

function resolveFileExtensionByMimeType(mimeType) {
  return globalFileExtensionByUploadMimeType[mimeType] || 'webp'
}

export async function persistUploadedImageDataUrl(imageDataUrl, sourceLabel) {
  const mimeType = extractMimeTypeFromDataUrl(imageDataUrl)
  if (!mimeType || !globalAllowedUploadMimeTypeSet.has(mimeType)) {
    throw new Error('Formato de imagem invalido para upload.')
  }

  const base64Segment = String(imageDataUrl).split(',')[1] || ''

  if (base64Segment.length > globalMaxImageUploadPayloadBytes * 1.37) {
    const payloadTooLargeError = new Error('Imagem excede limite permitido para upload.')
    payloadTooLargeError.statusCode = 413
    throw payloadTooLargeError
  }

  const imageBuffer = Buffer.from(base64Segment, 'base64')

  if (imageBuffer.length > globalMaxImageUploadPayloadBytes) {
    const payloadTooLargeError = new Error('Imagem excede limite permitido para upload.')
    payloadTooLargeError.statusCode = 413
    throw payloadTooLargeError
  }

  await ensureDirectoryExists(globalPublicUploadsDirectoryPath)

  const safeSourceLabel = sanitizeFileNameSegment(sourceLabel) || 'upload'
  const fileExtension = resolveFileExtensionByMimeType(mimeType)
  const fileName = `${Date.now()}-${safeSourceLabel}-${randomUUID().slice(0, 8)}.${fileExtension}`
  const filePath = path.resolve(globalPublicUploadsDirectoryPath, fileName)

  await fs.promises.writeFile(filePath, imageBuffer)

  return `/uploads/${fileName}`
}

export async function deleteUploadedImageByUrl(imageUrl) {
  const normalizedImageUrl = String(imageUrl || '').trim()

  if (!normalizedImageUrl.startsWith('/uploads/')) {
    const validationError = new Error('URL de imagem invalida para exclusao.')
    validationError.statusCode = 422
    throw validationError
  }

  const uploadRelativePath = normalizedImageUrl.replace(/^\/uploads\//, '')
  const uploadFilePath = path.resolve(globalPublicUploadsDirectoryPath, uploadRelativePath)

  const isUploadPathInsidePublicDirectory = isPathInsideParent(globalPublicUploadsDirectoryPath, uploadFilePath)
    || uploadFilePath === globalPublicUploadsDirectoryPath

  if (!isUploadPathInsidePublicDirectory) {
    const forbiddenError = new Error('Caminho de imagem nao permitido para exclusao.')
    forbiddenError.statusCode = 403
    throw forbiddenError
  }

  if (!fs.existsSync(uploadFilePath)) {
    return { isDeleted: false }
  }

  await fs.promises.unlink(uploadFilePath)
  return { isDeleted: true }
}

export async function listUploadedImageUrlCatalog() {
  await ensureDirectoryExists(globalPublicUploadsDirectoryPath)

  const directoryEntryCatalog = await fs.promises.readdir(globalPublicUploadsDirectoryPath, { withFileTypes: true })

  const uploadImageFileNameCatalog = directoryEntryCatalog
    .filter((directoryEntry) => directoryEntry.isFile())
    .map((directoryEntry) => directoryEntry.name)
    .filter((fileName) => {
      const fileExtension = path.extname(fileName).toLowerCase()
      return globalAllowedUploadFileExtensionCatalog.includes(fileExtension)
    })

  const uploadImageDataCatalog = await Promise.all(uploadImageFileNameCatalog.map(async (fileName) => {
    const filePath = path.resolve(globalPublicUploadsDirectoryPath, fileName)
    const fileStats = await fs.promises.stat(filePath)

    return {
      imageUrl: `/uploads/${fileName}`,
      modifiedTimeInMs: Number(fileStats.mtimeMs || 0),
    }
  }))

  return uploadImageDataCatalog
    .sort((leftImageData, rightImageData) => rightImageData.modifiedTimeInMs - leftImageData.modifiedTimeInMs)
    .map((uploadImageData) => uploadImageData.imageUrl)
}

export function resolveProjectPersistencePaths() {
  return {
    projectRootDirectoryPath: globalProjectRootDirectoryPath,
    distributionDirectoryPath: globalDistributionDirectoryPath,
    publicUploadsDirectoryPath: globalPublicUploadsDirectoryPath,
  }
}