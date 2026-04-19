import { sanitizeTextContent } from '../../security/sanitizeTextContent'

const globalFallbackImageUrl =
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80'

const globalAllowedAbsoluteImageProtocolCatalog = ['http:', 'https:']

function decodeCommonHtmlEntities(rawTextValue) {
  return String(rawTextValue || '')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#96;', '`')
}

function sanitizeArticleUrlValue(rawUrlValue) {
  const sanitizedTextValue = sanitizeTextContent(String(rawUrlValue || ''))
  const decodedUrlValue = decodeCommonHtmlEntities(sanitizedTextValue)

  if (!decodedUrlValue) {
    return ''
  }

  if (decodedUrlValue.startsWith('/')) {
    return decodedUrlValue
  }

  if (decodedUrlValue.startsWith('blob:')) {
    return decodedUrlValue
  }

  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(decodedUrlValue)) {
    return decodedUrlValue
  }

  try {
    const resolvedUrl = new URL(decodedUrlValue)

    if (!globalAllowedAbsoluteImageProtocolCatalog.includes(resolvedUrl.protocol)) {
      return ''
    }

    return decodedUrlValue
  } catch {
    return ''
  }
}

function normalizeGalleryImageUrlCatalog(rawGalleryImageUrlCatalog, fallbackImageUrl) {
  if (!Array.isArray(rawGalleryImageUrlCatalog) || rawGalleryImageUrlCatalog.length === 0) {
    return [fallbackImageUrl]
  }

  const sanitizedGalleryImageUrlCatalog = rawGalleryImageUrlCatalog
    .map((galleryImageUrl) => sanitizeArticleUrlValue(galleryImageUrl))
    .filter((galleryImageUrl) => galleryImageUrl.length > 0)

  if (sanitizedGalleryImageUrlCatalog.length === 0) {
    return [fallbackImageUrl]
  }

  return sanitizedGalleryImageUrlCatalog
}

function createDeterministicArticleIdentifier(rawTitleText, nowTimestampProvider) {
  const normalizedTitleText = sanitizeTextContent(rawTitleText).toLowerCase().replace(/\s+/g, '-')
  const timestampSegment = String(nowTimestampProvider())
  return `article-${normalizedTitleText || 'novo'}-${timestampSegment}`
}

function normalizeArticleLikeCount(rawLikeCount) {
  const normalizedLikeCount = Number(rawLikeCount)
  return Number.isInteger(normalizedLikeCount) && normalizedLikeCount >= 0 ? normalizedLikeCount : 0
}

function normalizeArticleRobuxPrice(rawRobuxPrice) {
  const normalizedRobuxPrice = Number(rawRobuxPrice)
  return Number.isInteger(normalizedRobuxPrice) && normalizedRobuxPrice >= 0 ? normalizedRobuxPrice : 0
}

export function createArticleEntity(rawArticleInput, indexPosition, nowTimestampProvider = Date.now) {
  const safeImageUrl = sanitizeArticleUrlValue(rawArticleInput.imageUrl) || globalFallbackImageUrl
  const safeTitle = sanitizeTextContent(rawArticleInput.title)
  const safeSubtitle = sanitizeTextContent(rawArticleInput.subtitle)
  const safeDescription = sanitizeTextContent(rawArticleInput.description)
  const safeAlternativeText = sanitizeTextContent(rawArticleInput.imageAlternativeText) || safeTitle
  const safeIdentifier =
    sanitizeTextContent(rawArticleInput.id) || createDeterministicArticleIdentifier(safeTitle, nowTimestampProvider)

  return {
    id: safeIdentifier,
    title: safeTitle,
    subtitle: safeSubtitle,
    description: safeDescription,
    imageUrl: safeImageUrl,
    imageAlternativeText: safeAlternativeText,
    galleryImageUrls: normalizeGalleryImageUrlCatalog(rawArticleInput.galleryImageUrls, safeImageUrl),
    likeCount: normalizeArticleLikeCount(rawArticleInput.likeCount),
    robuxPrice: normalizeArticleRobuxPrice(rawArticleInput.robuxPrice),
    isPublished: Boolean(rawArticleInput.isPublished ?? true),
    orderIndex: Number.isInteger(indexPosition) ? indexPosition : 0,
    publishedAtIso: new Date(nowTimestampProvider()).toISOString(),
  }
}

export function validateArticleEntity(articleEntity) {
  const validationErrorCatalog = []

  if (!articleEntity.title) {
    validationErrorCatalog.push('O título do artigo é obrigatório.')
  }

  if (!articleEntity.subtitle) {
    validationErrorCatalog.push('O subtítulo do artigo é obrigatório.')
  }

  if (!articleEntity.description) {
    validationErrorCatalog.push('A descrição do artigo é obrigatória.')
  }

  if (!articleEntity.imageUrl) {
    validationErrorCatalog.push('A URL principal da imagem é obrigatória.')
  }

  return {
    isValid: validationErrorCatalog.length === 0,
    validationErrorCatalog,
  }
}
