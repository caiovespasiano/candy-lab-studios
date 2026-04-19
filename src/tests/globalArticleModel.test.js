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

  test('whenImageUrlContainsQueryStringThenCreateArticleEntityPreservesAmpersands', () => {
    const articleEntity = createArticleEntity({
      title: 'Artigo com URL',
      subtitle: 'Subtitulo',
      description: 'Descricao',
      imageUrl: 'https://images.example.com/image.webp?auto=format&fit=crop&w=1200&q=80',
      galleryImageUrls: ['https://images.example.com/gallery.webp?auto=format&fit=crop&w=1200&q=80'],
    }, 0, () => 1_700_000_000_000)

    expect(articleEntity.imageUrl.includes('&amp;')).toBe(false)
    expect(articleEntity.imageUrl.includes('&fit=crop')).toBe(true)
    expect(articleEntity.galleryImageUrls[0].includes('&amp;')).toBe(false)
  })

  test('whenImageUrlUsesUnsafeSchemeThenCreateArticleEntityFallsBackToSafeImageUrl', () => {
    const articleEntity = createArticleEntity({
      title: 'Artigo com URL insegura',
      subtitle: 'Subtitulo',
      description: 'Descricao',
      imageUrl: 'javascript:alert(1)',
      galleryImageUrls: ['javascript:alert(1)'],
    }, 0, () => 1_700_000_000_000)

    expect(articleEntity.imageUrl.startsWith('https://images.unsplash.com/')).toBe(true)
    expect(articleEntity.galleryImageUrls[0].startsWith('https://images.unsplash.com/')).toBe(true)
  })

  test('whenRobuxPriceIsInvalidThenCreateArticleEntityNormalizesToZero', () => {
    const articleEntity = createArticleEntity({
      title: 'Artigo com preco invalido',
      subtitle: 'Subtitulo',
      description: 'Descricao',
      imageUrl: 'https://example.com/image.webp',
      robuxPrice: -120,
    }, 0, () => 1_700_000_000_000)

    expect(articleEntity.robuxPrice).toBe(0)
  })
})
