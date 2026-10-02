import { describe, expect, test } from 'vitest'
import { resolveTranslationText } from '../services/translationResolverService'

const globalTranslationsByLanguageCode = {
  ptBR: {
    hero: { title: 'Pacotes neon' },
    featured: { openModal: 'Abrir detalhes do projeto {title}' },
    onlyInPortuguese: 'Somente em portugues',
  },
  en: {
    hero: { title: 'Neon packs' },
    featured: { openModal: 'Open details for project {title}' },
  },
  es: {},
}

describe('resolveTranslationText', () => {
  test('whenLanguageHasThePathThenReturnsTheSelectedLanguageTemplate', () => {
    expect(resolveTranslationText(globalTranslationsByLanguageCode, 'en', 'hero.title')).toBe('Neon packs')
  })

  test('whenLanguageIsMissingThePathThenFallsBackToPortuguese', () => {
    expect(resolveTranslationText(globalTranslationsByLanguageCode, 'es', 'hero.title')).toBe('Pacotes neon')
  })

  test('whenLanguageIsEntirelyEmptyThenFallsBackToPortuguese', () => {
    expect(resolveTranslationText(globalTranslationsByLanguageCode, 'es', 'onlyInPortuguese')).toBe('Somente em portugues')
  })

  test('whenPlaceholdersAreProvidedThenEveryOccurrenceIsReplaced', () => {
    const resolvedText = resolveTranslationText(
      globalTranslationsByLanguageCode,
      'en',
      'featured.openModal',
      { title: 'Neon Street Pack' },
    )

    expect(resolvedText).toBe('Open details for project Neon Street Pack')
  })

  test('whenPathDoesNotExistAnywhereThenReturnsThePathItself', () => {
    expect(resolveTranslationText(globalTranslationsByLanguageCode, 'en', 'missing.deep.path')).toBe('missing.deep.path')
  })

  test('whenLanguageCodeIsNotRegisteredThenFallsBackToPortuguese', () => {
    expect(resolveTranslationText(globalTranslationsByLanguageCode, 'fr', 'hero.title')).toBe('Pacotes neon')
  })

  test('whenTranslationCatalogIsEmptyThenReturnsThePathItself', () => {
    expect(resolveTranslationText({}, 'en', 'hero.title')).toBe('hero.title')
  })
})
