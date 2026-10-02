import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { ProjectThumbnailImage } from '../components/ProjectThumbnailImage'

const globalDefaultIntrinsicWidth = 640
const globalDefaultIntrinsicHeight = 480

function renderProjectThumbnailImage(componentProps) {
  return render(
    <ProjectThumbnailImage
      imageUrl="/uploads/neon-street-pack.webp"
      imageAlternativeText="Pacote de texturas neon"
      className="h-full w-full object-cover"
      {...componentProps}
    />,
  )
}

describe('ProjectThumbnailImage', () => {
  test('whenImageIsAboveTheFoldThenItLoadsEagerlyWithHighPriority', () => {
    renderProjectThumbnailImage({ isAboveTheFold: true })

    const thumbnailImage = screen.getByRole('img', { name: 'Pacote de texturas neon' })

    expect(thumbnailImage).toHaveAttribute('loading', 'eager')
    expect(thumbnailImage).toHaveAttribute('fetchpriority', 'high')
    expect(thumbnailImage).toHaveAttribute('decoding', 'sync')
  })

  test('whenImageIsBelowTheFoldThenItLoadsLazilyWithAsyncDecoding', () => {
    renderProjectThumbnailImage({ isAboveTheFold: false })

    const thumbnailImage = screen.getByRole('img', { name: 'Pacote de texturas neon' })

    expect(thumbnailImage).toHaveAttribute('loading', 'lazy')
    expect(thumbnailImage).toHaveAttribute('fetchpriority', 'auto')
    expect(thumbnailImage).toHaveAttribute('decoding', 'async')
  })

  test('whenNoIntrinsicSizeIsProvidedThenDefaultsPreventLayoutShift', () => {
    renderProjectThumbnailImage({})

    const thumbnailImage = screen.getByRole('img', { name: 'Pacote de texturas neon' })

    expect(thumbnailImage).toHaveAttribute('width', String(globalDefaultIntrinsicWidth))
    expect(thumbnailImage).toHaveAttribute('height', String(globalDefaultIntrinsicHeight))
  })
})
