import { describe, expect, test } from 'vitest'
import { sanitizeTextContent } from '../security/sanitizeTextContent'

describe('sanitizeTextContent', () => {
  test('whenTextContainsHtmlTagsThenReturnsTextWithoutTags', () => {
    const sanitizedText = sanitizeTextContent('<strong>Portfolio</strong> pronto')

    expect(sanitizedText).toBe('Portfolio pronto')
  })

  test('whenTextContainsSpecialCharactersThenEscapesEachCharacter', () => {
    const sanitizedText = sanitizeTextContent('" \' & < > `')

    expect(sanitizedText).toBe('&quot; &#39; &amp;  &#96;')
  })

  test('whenInputValueIsNotAStringThenReturnsEmptyString', () => {
    const sanitizedText = sanitizeTextContent(null)

    expect(sanitizedText).toBe('')
  })
})
