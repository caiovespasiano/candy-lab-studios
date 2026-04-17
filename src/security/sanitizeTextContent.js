const globalHtmlEscapeMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
}

export function sanitizeTextContent(rawTextValue) {
  if (typeof rawTextValue !== 'string') {
    return ''
  }

  const textWithoutHtmlTags = rawTextValue.replace(/<[^>]*>/g, '')

  return textWithoutHtmlTags.replace(/[&<>"'`]/g, (characterToEscape) => {
    return globalHtmlEscapeMap[characterToEscape] ?? ''
  }).trim()
}
