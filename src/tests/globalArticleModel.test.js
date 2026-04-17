import { describe, expect, test } from 'vitest'
import { createArticleEntity, validateArticleEntity } from '../models/articles/globalArticleModel'

describe('globalArticleModel', () => {
  test('whenRawArticleContainsMarkupThenCreateArticleEntityReturnsSanitizedFields', () => {
    const articleEntity = createArticleEntity({
      title: '<script>Novo artigo</script>',
      subtitle: '<b>Subtitulo seguro</b>',
      description: '<img src=x onerror=1>Descricao limpa',
      imageUrl: 'https://example.com/image.png',
      imageAlternativeText: '<span>Alt seguro</span>',
      galleryImageUrls: ['<b>https://example.com/a.png</b>'],
      likeCount: 3,
      isPublished: true,
    }, 0, () => 1_700_000_000_000)

    expect(articleEntity.title).toBe('Novo artigo')
    expect(articleEntity.subtitle).toBe('Subtitulo seguro')
    expect(articleEntity.description).toBe('Descricao limpa')
    expect(articleEntity.imageAlternativeText).toBe('Alt seguro')
    expect(articleEntity.galleryImageUrls[0]).toBe('https://example.com/a.png')
  })

  test('whenRequiredFieldsAreMissingThenValidateArticleEntityReturnsInvalidState', () => {
    const validationResult = validateArticleEntity({
      title: '',
      subtitle: '',
      description: '',
      imageUrl: '',
    })

    expect(validationResult.isValid).toBe(false)
    expect(validationResult.validationErrorCatalog.length).toBeGreaterThan(0)
  })
})
