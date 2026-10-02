import { lazy, Suspense } from 'react'
import { FaArrowLeft, FaArrowRight, FaHeart, FaRegHeart, FaShareAlt, FaTag, FaTimes } from 'react-icons/fa'
import { SiBlender } from 'react-icons/si'

const LazyProjectGalleryLightbox = lazy(() => import('./ProjectGalleryLightbox').then((lightboxModule) => ({
  default: lightboxModule.ProjectGalleryLightbox,
})))

const globalAuthoringSoftwareIconByKey = {
  blender: { label: 'Blender', IconComponent: SiBlender },
}

const globalCurrentCopyrightYear = new Date().getFullYear()

function resolveAuthoringSoftwarePresentation(authoringSoftware) {
  const softwareIconEntry = globalAuthoringSoftwareIconByKey[authoringSoftware?.iconKey]

  if (softwareIconEntry) {
    return softwareIconEntry
  }

  return { label: authoringSoftware?.name || '', IconComponent: null }
}

function GalleryLightboxLoadingFallback({ activeGalleryImageUrl, imageAlternativeText }) {
  return (
    <img
      src={activeGalleryImageUrl}
      alt={imageAlternativeText}
      className="h-full w-full object-cover"
      aria-hidden="true"
    />
  )
}

function ProductGalleryColumn({
  projectData,
  currentGalleryImageIndex,
  galleryImageCount,
  translate,
  resolveDimensionsByUrl,
  onBeforeOpen,
  onSelectImage,
  onNavigatePrevious,
  onNavigateNext,
}) {
  const activeGalleryImageUrl = projectData.galleryImageUrls[currentGalleryImageIndex] || projectData.imageUrl

  return (
    <div className="flex w-full flex-col gap-3 self-start lg:w-[46%]">
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border-2 border-inkBlack bg-paperWhite">
        <Suspense
          fallback={(
            <GalleryLightboxLoadingFallback
              activeGalleryImageUrl={activeGalleryImageUrl}
              imageAlternativeText={projectData.imageAlternativeText}
            />
          )}
        >
          <LazyProjectGalleryLightbox
            galleryImageUrls={projectData.galleryImageUrls}
            activeGalleryImageIndex={currentGalleryImageIndex}
            imageAlternativeText={projectData.imageAlternativeText}
            zoomImageLabel={translate('modal.zoomImage')}
            resolveDimensionsByUrl={resolveDimensionsByUrl}
            onBeforeOpen={onBeforeOpen}
          />
        </Suspense>

        {galleryImageCount > 1 && (
          <>
            <button
              type="button"
              onClick={onNavigatePrevious}
              className="cute-control-button absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center sm:h-12 sm:w-12"
              aria-label={translate('modal.previousImage')}
            >
              <FaArrowLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onNavigateNext}
              className="cute-control-button absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center sm:h-12 sm:w-12"
              aria-label={translate('modal.nextImage')}
            >
              <FaArrowRight aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {galleryImageCount > 1 && (
        <div className="flex justify-center gap-2">
          {projectData.galleryImageUrls.map((galleryImageUrl, galleryImageIndex) => (
            <button
              key={`${galleryImageUrl}-${galleryImageIndex}`}
              type="button"
              onClick={() => onSelectImage(galleryImageIndex)}
              className={`carousel-dot ${galleryImageIndex === currentGalleryImageIndex ? 'scale-125 bg-pastelPink' : 'bg-white'}`}
              aria-label={translate('modal.goToImage', { index: galleryImageIndex + 1 })}
              aria-current={galleryImageIndex === currentGalleryImageIndex ? 'true' : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProductPriceBlock({ projectData, translate }) {
  const hasPurchaseUrl = Boolean(projectData.purchaseUrl)

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-inkBlack bg-paperWhite p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-widest text-inkBlack/70">
          {translate('product.priceLabel')}
        </span>

        <div className="flex items-center gap-2">
          <img
            src="/svg/robux_logo_black.svg"
            alt="Robux"
            className="h-7 w-7 shrink-0 object-contain"
            loading="lazy"
            decoding="async"
          />
          <span className="text-2xl font-black leading-none text-inkBlack sm:text-3xl">
            {Number(projectData.robuxPrice ?? 0)}
          </span>
        </div>
      </div>

      {hasPurchaseUrl ? (
        <a
          href={projectData.purchaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="cute-button cute-button-share flex h-12 w-full items-center justify-center gap-2 font-black text-inkBlack"
        >
          {translate('product.buyNow')}
        </a>
      ) : (
        <>
          <span
            className="flex h-12 w-full cursor-not-allowed items-center justify-center rounded-lg border-2 border-inkBlack/25 bg-paperWhite text-center text-sm font-black text-inkBlack/50"
            title={translate('product.unavailableHint')}
          >
            {translate('product.unavailable')}
          </span>
          <p className="text-[11px] font-bold leading-snug text-inkBlack/70">
            {translate('product.unavailableHint')}
          </p>
        </>
      )}
    </div>
  )
}

function ProductTechnicalDetails({ projectData, translate }) {
  const authoringSoftwarePresentation = resolveAuthoringSoftwarePresentation(projectData.authoringSoftware)
  const AuthoringSoftwareIcon = authoringSoftwarePresentation.IconComponent
  const hasFileFormats = projectData.fileFormats.length > 0
  const hasTags = projectData.tags.length > 0
  const copyrightText = projectData.copyrightNotice || translate('product.copyrightDefault', {
    year: globalCurrentCopyrightYear,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border border-inkBlack/15 bg-paperWhite p-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-inkBlack/60">
            {translate('product.softwareLabel')}
          </span>
          <span className="flex items-center gap-2 text-sm font-black text-inkBlack">
            {AuthoringSoftwareIcon && <AuthoringSoftwareIcon className="h-5 w-5 shrink-0" aria-hidden="true" />}
            {authoringSoftwarePresentation.label || translate('product.noSoftware')}
          </span>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border border-inkBlack/15 bg-paperWhite p-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-inkBlack/60">
            {translate('product.formatsLabel')}
          </span>
          <span className="text-sm font-black text-inkBlack">
            {hasFileFormats ? projectData.fileFormats.join(' · ') : translate('product.noFormats')}
          </span>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border border-inkBlack/15 bg-paperWhite p-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-inkBlack/60">
            {translate('product.licenseLabel')}
          </span>
          <span className="text-sm font-black text-inkBlack">{translate('product.viewOnStore')}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-inkBlack/15 bg-paperWhite p-4">
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-inkBlack/70">
          <FaTag aria-hidden="true" />
          {translate('product.tagsHeading')}
        </span>
        {hasTags ? (
          <ul className="flex flex-wrap gap-2">
            {projectData.tags.map((tagValue) => (
              <li
                key={tagValue}
                className="rounded-full border border-inkBlack/25 bg-paperWhite px-3 py-1 text-[11px] font-black uppercase tracking-wide text-inkBlack"
              >
                {tagValue}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs font-bold text-inkBlack/60">{translate('product.noTags')}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-inkBlack/15 bg-paperWhite p-4">
        <span className="text-xs font-black uppercase tracking-widest text-inkBlack/70">
          {translate('product.aiDisclaimerHeading')}
        </span>
        <p className="text-sm font-bold leading-relaxed text-inkBlack/85">
          {projectData.isGeneratedWithArtificialIntelligence
            ? translate('product.aiDisclaimerTrue')
            : translate('product.aiDisclaimerFalse')}
        </p>
        <p className="text-[11px] font-bold leading-relaxed text-inkBlack/60">{copyrightText}</p>
      </div>
    </div>
  )
}

export function ProductDetailsPanel({
  projectData,
  currentGalleryImageIndex,
  isLikedByCurrentVisitor,
  likeCount,
  translate,
  resolveDimensionsByUrl,
  onBeforeGalleryOpen,
  onSelectGalleryImage,
  onNavigateGalleryPrevious,
  onNavigateGalleryNext,
  onToggleLike,
  onShare,
  onClose,
}) {
  return (
    <article
      className="cute-box no-lift relative flex max-h-[92dvh] w-full max-w-[calc(100vw-0.75rem)] flex-col overflow-auto overscroll-contain border-[6px] border-inkBlack bg-paperWhite p-4 sm:max-w-6xl sm:p-6"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="cute-control-button cute-control-button-close absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center text-base font-black sm:right-4 sm:top-4 sm:h-10 sm:w-10 sm:text-xl"
        onClick={onClose}
        aria-label={translate('modal.close')}
      >
        <FaTimes aria-hidden="true" />
      </button>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <ProductGalleryColumn
          projectData={projectData}
          currentGalleryImageIndex={currentGalleryImageIndex}
          galleryImageCount={projectData.galleryImageUrls.length}
          translate={translate}
          resolveDimensionsByUrl={resolveDimensionsByUrl}
          onBeforeOpen={onBeforeGalleryOpen}
          onSelectImage={onSelectGalleryImage}
          onNavigatePrevious={onNavigateGalleryPrevious}
          onNavigateNext={onNavigateGalleryNext}
        />

        <div className="flex w-full flex-col gap-4 lg:w-[54%]">
          <span className="text-[10px] font-black uppercase tracking-widest text-inkBlack/60">
            {translate('product.eyebrow')}
          </span>

          <h2 className="font-display text-3xl leading-tight text-inkBlack drop-shadow-[2px_2px_0px_#ffffff] sm:text-4xl">
            {projectData.title}
          </h2>

          <p className="text-sm font-black uppercase tracking-wide text-inkBlack/70">
            {projectData.subtitle}
          </p>

          <p className="border-l-4 border-inkBlack pl-3 text-sm font-bold leading-relaxed text-inkBlack/80">
            {projectData.summary}
          </p>

          <ProductPriceBlock projectData={projectData} translate={translate} />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleLike}
              className={`cute-control-button flex h-11 w-11 shrink-0 items-center justify-center text-xl ${
                isLikedByCurrentVisitor ? 'bg-pastelPink' : 'bg-paperWhite'
              }`}
              aria-label={isLikedByCurrentVisitor ? translate('modal.removeLike') : translate('modal.like')}
              aria-pressed={isLikedByCurrentVisitor}
            >
              {isLikedByCurrentVisitor
                ? <FaHeart className="text-red-600" aria-hidden="true" />
                : <FaRegHeart className="text-inkBlack" aria-hidden="true" />}
            </button>

            <span className="shrink-0 text-xs font-black uppercase tracking-wider text-inkBlack/70">
              {translate('modal.likes', { count: likeCount })}
            </span>

            <button
              type="button"
              onClick={onShare}
              className="cute-button cute-button-share ml-auto flex h-11 items-center justify-center gap-2 px-6 font-black text-inkBlack"
            >
              <FaShareAlt aria-hidden="true" />
              <span>{translate('product.share')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-5 border-t border-inkBlack/15 pt-6 sm:mt-8">
        <section aria-labelledby="productDescriptionHeading" className="flex flex-col gap-2">
          <h3
            id="productDescriptionHeading"
            className="text-xs font-black uppercase tracking-widest text-inkBlack/60"
          >
            {translate('product.descriptionHeading')}
          </h3>
          <p className="whitespace-pre-line text-sm font-bold leading-relaxed text-inkBlack/85">
            {projectData.description}
          </p>
        </section>

        <section aria-labelledby="productDetailsHeading" className="flex flex-col gap-3">
          <h3
            id="productDetailsHeading"
            className="text-xs font-black uppercase tracking-widest text-inkBlack/60"
          >
            {translate('product.detailsHeading')}
          </h3>
          <ProductTechnicalDetails projectData={projectData} translate={translate} />
        </section>
      </div>
    </article>
  )
}
