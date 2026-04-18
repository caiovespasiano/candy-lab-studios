import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { globalPortfolioProjectCatalog } from '../src/constants/globalPortfolioCatalog.js'

const globalMaxArticlesPerCatalog = 200
const globalMaxTextLength = 500
const globalMaxDescriptionLength = 4000
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

const globalCurrentFilePath = fileURLToPath(import.meta.url)
const globalServerDirectoryPath = path.dirname(globalCurrentFilePath)
const globalProjectRootDirectoryPath = path.resolve(globalServerDirectoryPath, '..')

const globalProjectDataDirectoryPath = path.resolve(globalProjectRootDirectoryPath, 'data')
const globalProjectArticlesFilePath = path.resolve(globalProjectDataDirectoryPath, 'articles.json')
const globalPublicUploadsDirectoryPath = path.resolve(globalProjectRootDirectoryPath, 'public', 'uploads')
const globalDistributionDirectoryPath = path.resolve(globalProjectRootDirectoryPath, 'dist')

function sanitizeTextValue(rawValue, maxLength = globalMaxTextLength) {
  return String(rawValue || '').replace(/[<>]/g, '').trim().slice(0, maxLength)
}

function sanitizeUrlValue(rawValue) {
  return String(rawValue || '').trim().slice(0, globalMaxUrlLength)
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
      description: sanitizeTextValue(articleData.description, globalMaxDescriptionLength),
      imageUrl: sanitizeUrlValue(articleData.imageUrl),
      imageAlternativeText: sanitizeTextValue(articleData.imageAlternativeText || articleData.title),
      galleryImageUrls: sanitizeGalleryUrlCatalog(articleData.galleryImageUrls),
      likeCount: Number.isInteger(articleData.likeCount) ? articleData.likeCount : 0,
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
      description: sanitizeTextValue(articleData.description, globalMaxDescriptionLength),
      imageUrl: sanitizeUrlValue(articleData.imageUrl),
      imageAlternativeText: sanitizeTextValue(articleData.imageAlternativeText || articleData.title),
      galleryImageUrls: sanitizeGalleryUrlCatalog(articleData.galleryImageUrls),
      likeCount: Number.isInteger(articleData.likeCount) && articleData.likeCount >= 0 ? articleData.likeCount : 0,
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
  const fileName = `${Date.now()}-${safeSourceLabel}-${randomUUID().slice(0, 8)}.webp`
  const filePath = path.resolve(globalPublicUploadsDirectoryPath, fileName)

  await fs.promises.writeFile(filePath, imageBuffer)

  return `/uploads/${fileName}`
}

export function resolveProjectPersistencePaths() {
  return {
    projectRootDirectoryPath: globalProjectRootDirectoryPath,
    distributionDirectoryPath: globalDistributionDirectoryPath,
    publicUploadsDirectoryPath: globalPublicUploadsDirectoryPath,
  }
}