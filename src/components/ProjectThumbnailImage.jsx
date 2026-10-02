const globalProjectThumbnailIntrinsicWidth = 640
const globalProjectThumbnailIntrinsicHeight = 480

export function ProjectThumbnailImage({
  imageUrl,
  imageAlternativeText,
  isAboveTheFold,
  className,
  width = globalProjectThumbnailIntrinsicWidth,
  height = globalProjectThumbnailIntrinsicHeight,
}) {
  return (
    <img
      src={imageUrl}
      alt={imageAlternativeText}
      className={className}
      width={width}
      height={height}
      loading={isAboveTheFold ? 'eager' : 'lazy'}
      fetchPriority={isAboveTheFold ? 'high' : 'auto'}
      decoding={isAboveTheFold ? 'sync' : 'async'}
    />
  )
}
