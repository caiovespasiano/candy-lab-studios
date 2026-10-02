const globalDefaultLanguageCode = 'ptBR'

function resolveTranslationCatalogByLanguageCode(translationsByLanguageCode, languageCode) {
  return translationsByLanguageCode[languageCode] || translationsByLanguageCode[globalDefaultLanguageCode] || {}
}

function readTranslationValueAtPath(translationCatalog, translationPath) {
  return translationPath.split('.').reduce((currentNode, pathSegment) => {
    if (currentNode && typeof currentNode === 'object' && pathSegment in currentNode) {
      return currentNode[pathSegment]
    }
    return null
  }, translationCatalog)
}

function applyPlaceholderReplacements(translationTemplate, replacementByKey) {
  return Object.entries(replacementByKey).reduce((translatedText, [replacementKey, replacementValue]) => {
    return translatedText.replaceAll(`{${replacementKey}}`, String(replacementValue))
  }, translationTemplate)
}

export function resolveTranslationText(translationsByLanguageCode, languageCode, translationPath, replacementByKey = {}) {
  const selectedTranslationCatalog = resolveTranslationCatalogByLanguageCode(translationsByLanguageCode, languageCode)
  const fallbackTranslationCatalog = resolveTranslationCatalogByLanguageCode(
    translationsByLanguageCode,
    globalDefaultLanguageCode,
  )

  const selectedTranslationValue = readTranslationValueAtPath(selectedTranslationCatalog, translationPath)
  const fallbackTranslationValue = readTranslationValueAtPath(fallbackTranslationCatalog, translationPath)

  const translationTemplate = typeof selectedTranslationValue === 'string'
    ? selectedTranslationValue
    : typeof fallbackTranslationValue === 'string'
      ? fallbackTranslationValue
      : translationPath

  return applyPlaceholderReplacements(translationTemplate, replacementByKey)
}

export { globalDefaultLanguageCode }
