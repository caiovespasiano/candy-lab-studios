import { Gallery, Item } from 'react-photoswipe-gallery'
import 'photoswipe/dist/photoswipe.css'

export function ProjectGalleryLightbox({
  galleryImageUrls,
  activeGalleryImageIndex,
  imageAlternativeText,
  zoomImageLabel,
  resolveDimensionsByUrl,
  onBeforeOpen,
}) {
  return (
    <Gallery onBeforeOpen={onBeforeOpen}>
      {galleryImageUrls.map((galleryImageUrl, galleryImageIndex) => {
        const imageDimensions = resolveDimensionsByUrl(galleryImageUrl)

        return (
          <Item
            key={`${galleryImageUrl}-${galleryImageIndex}`}
            original={galleryImageUrl}
            thumbnail={galleryImageUrl}
            width={imageDimensions.width}
            height={imageDimensions.height}
            cropped
          >
            {({ ref, open }) => {
              if (galleryImageIndex === activeGalleryImageIndex) {
                return (
                  <img
                    ref={ref}
                    src={galleryImageUrl}
                    alt={imageAlternativeText}
                    className="h-full w-full cursor-zoom-in object-cover transition-all duration-300"
                    loading="lazy"
                    role="button"
                    tabIndex={0}
                    aria-label={zoomImageLabel}
                    onClick={(event) => {
                      event.stopPropagation()
                      open(event)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        open(event)
                      }
                    }}
                  />
                )
              }

              return <button ref={ref} type="button" className="hidden" aria-hidden="true" tabIndex={-1} />
            }}
          </Item>
        )
      })}
    </Gallery>
  )
}
