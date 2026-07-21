import { m } from '@/paraglide/messages'
import { Button, Skeleton } from '@heroui/react'
import { cn } from '@heroui/styles'
import { ImageOff, ZoomIn } from 'lucide-react'
import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { ImageGroupContext } from './image-group'
import { ImagePreview } from './image-preview'

export type ImageProps = {
  src: string
  alt: string
  width?: number | string
  height?: number | string
  className?: string
  imageClassName?: string
  preview?: boolean
  fallbackSrc?: string
  downloadable?: boolean
}

export function Image({
  src,
  alt,
  width,
  height,
  className,
  imageClassName,
  preview = true,
  fallbackSrc,
  downloadable = true,
}: ImageProps) {
  const id = useId()
  const groupCtx = useContext(ImageGroupContext)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(true)
  const [effectiveSrc, setEffectiveSrc] = useState(src)
  const [standaloneOpen, setStandaloneOpen] = useState(false)

  // Sync src changes
  useEffect(() => {
    setEffectiveSrc(src)
    setIsLoading(true)
    setHasError(false)
    setShowSkeleton(true)
  }, [src])

  // Cache-hit images are complete before onLoad attaches; reveal them
  // instantly instead of replaying the fade on every remount.
  useLayoutEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) {
      setIsLoading(false)
      setShowSkeleton(false)
    }
  }, [effectiveSrc])

  // Keep the skeleton behind the image while it fades in, then release it
  useEffect(() => {
    if (isLoading || hasError || !showSkeleton) return
    const t = setTimeout(() => setShowSkeleton(false), 400)
    return () => clearTimeout(t)
  }, [isLoading, hasError, showSkeleton])

  // Register with group context
  useEffect(() => {
    if (!groupCtx || !preview) return
    groupCtx.register(id, { src, alt, downloadable })
    return () => groupCtx.unregister(id)
  }, [id, src, alt, downloadable, groupCtx, preview])

  const handleError = () => {
    if (fallbackSrc && effectiveSrc !== fallbackSrc) {
      setEffectiveSrc(fallbackSrc)
    } else {
      setHasError(true)
      setIsLoading(false)
    }
  }

  const handleOpen = () => {
    if (!preview) return
    if (groupCtx) {
      groupCtx.openPreview(id, triggerRef)
    } else {
      setStandaloneOpen(true)
    }
  }

  const handleStandaloneClose = () => {
    setStandaloneOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <div
        className={cn('group relative inline-block overflow-hidden', className)}
        style={{ width, height }}
      >
        {/* Loading skeleton */}
        {showSkeleton && !hasError && (
          <Skeleton className="absolute inset-0 rounded-none" />
        )}

        {/* Error placeholder */}
        {hasError && (
          <div className="bg-default text-muted absolute inset-0 flex items-center justify-center motion-safe:animate-in motion-safe:fade-in">
            <ImageOff className="size-5" aria-hidden />
          </div>
        )}

        {/* Image */}
        {!hasError && (
          <img
            ref={imgRef}
            src={effectiveSrc}
            alt={alt}
            loading="lazy"
            decoding="async"
            className={cn(
              'block object-cover',
              // fill explicit container; natural size when no dimensions given
              width !== undefined || height !== undefined
                ? 'h-full w-full'
                : 'max-w-full',
              'transition duration-300 ease-out-quart motion-reduce:transition-none',
              isLoading ? 'scale-[1.03] opacity-0' : 'opacity-100',
              preview && !isLoading && 'motion-safe:group-hover:scale-[1.03]',
              imageClassName,
            )}
            onLoad={() => setIsLoading(false)}
            onError={handleError}
          />
        )}

        {/* Preview trigger overlay */}
        {preview && !hasError && (
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            aria-label={m.image_open_preview()}
            onPress={handleOpen}
            className={cn(
              'absolute inset-0 size-auto min-h-0 rounded-none',
              'flex items-center justify-center',
              'bg-black/0 hover:bg-black/30',
              'transition-colors duration-200 motion-reduce:transition-none',
              'cursor-zoom-in focus-visible:ring-2 focus-visible:ring-white/50',
              isLoading && 'pointer-events-none',
            )}
          >
            <ZoomIn
              aria-hidden
              className={cn(
                'size-6 text-white drop-shadow-md',
                'opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none',
              )}
            />
          </Button>
        )}
      </div>

      {/* Standalone preview (when not inside a PreviewGroup) */}
      {!groupCtx && (
        <ImagePreview
          images={[{ src, alt, downloadable }]}
          activeIndex={0}
          isOpen={standaloneOpen}
          onClose={handleStandaloneClose}
          onNavigate={() => {}}
          downloadable={downloadable}
          triggerRef={triggerRef}
        />
      )}
    </>
  )
}
