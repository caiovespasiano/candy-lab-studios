import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ProjectGalleryLightbox } from '../components/ProjectGalleryLightbox'

vi.mock('react-photoswipe-gallery', () => ({
  Gallery: ({ children, onBeforeOpen }) => (
    <div data-testid="gallery" onClick={onBeforeOpen}>
      {children}
    </div>
  ),
  Item: ({ children, original, width, height }) => (
    <div data-testid="gallery-item" data-original={original} data-dimensions={`${width}x${height}`}>
      {children({ ref: () => {}, open: () => {} })}
    </div>
  ),
}))

const globalFallbackImageDimensions = { width: 1600, height: 1200 }
const globalGalleryImageUrlCatalog = [
  '/uploads/first.webp',
  '/uploads/second.webp',
]

describe('ProjectGalleryLightbox', () => {
  test('whenGalleryRendersThenEveryImageBecomesAGalleryItem', () => {
    render(
      <ProjectGalleryLightbox
        galleryImageUrls={globalGalleryImageUrlCatalog}
        activeGalleryImageIndex={0}
        imageAlternativeText="Pacote de texturas neon"
        zoomImageLabel="Ampliar imagem"
        resolveDimensionsByUrl={() => ({ width: 800, height: 600 })}
        onBeforeOpen={() => {}}
      />,
    )

    expect(screen.getAllByTestId('gallery-item')).toHaveLength(2)
  })

  test('whenImageIsNotActiveThenOnlyActiveImageExposesTheZoomControl', () => {
    render(
      <ProjectGalleryLightbox
        galleryImageUrls={globalGalleryImageUrlCatalog}
        activeGalleryImageIndex={1}
        imageAlternativeText="Pacote de texturas neon"
        zoomImageLabel="Ampliar imagem"
        resolveDimensionsByUrl={() => globalFallbackImageDimensions}
        onBeforeOpen={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Ampliar imagem' })).toHaveAttribute('src', globalGalleryImageUrlCatalog[1])
  })

  test('whenActiveImageIndexIsResolvedThenFallbackDimensionsAreUsedWhenUnknown', () => {
    render(
      <ProjectGalleryLightbox
        galleryImageUrls={['/uploads/unknown.webp']}
        activeGalleryImageIndex={0}
        imageAlternativeText="Pacote de texturas neon"
        zoomImageLabel="Ampliar imagem"
        resolveDimensionsByUrl={() => globalFallbackImageDimensions}
        onBeforeOpen={() => {}}
      />,
    )

    expect(screen.getByTestId('gallery-item')).toHaveAttribute(
      'data-dimensions',
      `${globalFallbackImageDimensions.width}x${globalFallbackImageDimensions.height}`,
    )
  })
})
