import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { Spinner } from '@astryxdesign/core/Spinner'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImageOff,
  Maximize2,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RegisteredImage } from './image-group'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 4
const ZOOM_STEP = 0.25

const clampScale = (s: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s))

type Props = {
  images: Array<RegisteredImage>
  activeIndex: number
  isOpen: boolean
  onClose: () => void
  onNavigate: (index: number) => void
  downloadable: boolean
  triggerRef?: React.RefObject<HTMLButtonElement | null>
}

type Position = { x: number; y: number }

export function ImagePreview({
  images,
  activeIndex,
  isOpen,
  onClose,
  onNavigate,
  downloadable,
  triggerRef,
}: Props) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(scale)
  const pinchStartScaleRef = useRef(1)

  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  // Mount/unmount with fade animation
  useEffect(() => {
    if (isOpen) {
      setIsMounted(true)
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
      const t = setTimeout(() => setIsMounted(false), 200)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // Focus close button on open, restore on close
  useEffect(() => {
    if (isVisible) {
      closeButtonRef.current?.focus()
    } else if (!isOpen && triggerRef?.current) {
      triggerRef.current.focus()
    }
  }, [isVisible, isOpen, triggerRef])

  // Reset view state when active image changes
  useEffect(() => {
    setScale(1)
    setRotation(0)
    setPosition({ x: 0, y: 0 })
    setIsLoading(true)
    setHasError(false)
  }, [activeIndex])

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.top = `-${scrollY}px`
    return () => {
      document.body.style.overflow = ''
      document.body.style.top = ''
      window.scrollTo(0, scrollY)
    }
  }, [isOpen])

  const zoom = useCallback(
    (delta: number) => setScale((s) => clampScale(s + delta)),
    [],
  )
  const reset = useCallback(() => {
    setScale(1)
    setRotation(0)
    setPosition({ x: 0, y: 0 })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      // Don't interfere with inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case '+':
        case '=':
          zoom(ZOOM_STEP)
          break
        case '-':
          zoom(-ZOOM_STEP)
          break
        case '0':
          reset()
          break
        case 'ArrowLeft':
          if (activeIndex > 0) onNavigate(activeIndex - 1)
          break
        case 'ArrowRight':
          if (activeIndex < images.length - 1) onNavigate(activeIndex + 1)
          break
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, activeIndex, images.length, onClose, onNavigate, zoom, reset])

  // Wheel + trackpad-pinch zoom. Trackpad pinch arrives as ctrl+wheel (Chrome/
  // Firefox) or gesture* events (Safari); both default to zooming the whole
  // page. React's onWheel can't stop that here: the portal mounts on
  // document.body, where browsers force wheel listeners to be passive and
  // ignore preventDefault — so attach native non-passive listeners, and on the
  // whole overlay so the toolbar and close button are covered too.
  useEffect(() => {
    const el = overlayRef.current
    if (!el || !isMounted) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoom(-e.deltaY * (e.ctrlKey ? 0.01 : 0.001))
    }
    const onGestureStart = (e: Event) => {
      e.preventDefault()
      pinchStartScaleRef.current = scaleRef.current
    }
    const onGestureChange = (e: Event) => {
      e.preventDefault()
      const gestureScale = (e as Event & { scale?: number }).scale
      if (typeof gestureScale === 'number') {
        setScale(clampScale(pinchStartScaleRef.current * gestureScale))
      }
    }
    const onGestureEnd = (e: Event) => e.preventDefault()

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('gesturestart', onGestureStart)
    el.addEventListener('gesturechange', onGestureChange)
    el.addEventListener('gestureend', onGestureEnd)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturestart', onGestureStart)
      el.removeEventListener('gesturechange', onGestureChange)
      el.removeEventListener('gestureend', onGestureEnd)
    }
  }, [isMounted, zoom])

  // Drag / pan
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    },
    [position],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    },
    [isDragging, dragStart],
  )

  const handlePointerUp = useCallback(() => setIsDragging(false), [])

  const handleDownload = useCallback(() => {
    const image = images[activeIndex]
    const a = document.createElement('a')
    a.href = image.src
    a.download = image.alt || 'image'
    a.target = '_blank'
    a.click()
  }, [images, activeIndex])

  if (!isMounted || images.length === 0) return null

  const currentImage = images[activeIndex]
  const transform = `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`
  const showNav = images.length > 1

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={m.image_preview_label()}
      className={cn(
        'fixed inset-0 z-50 transition-opacity duration-200 ease-out-quart motion-reduce:transition-none',
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

      {/* Image stage */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center overflow-hidden',
          'transition duration-200 ease-out-quart motion-reduce:transition-none',
          isVisible ? 'scale-100' : 'scale-[0.97]',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {isLoading && !hasError && (
          <span className="absolute">
            <Spinner shade="onMedia" />
          </span>
        )}

        {hasError && (
          <div className="absolute flex flex-col items-center gap-2 text-white/50 select-none">
            <ImageOff className="size-10" />
            <span className="text-sm">{m.image_preview_load_error()}</span>
          </div>
        )}

        <img
          key={currentImage.src}
          src={currentImage.src}
          alt={currentImage.alt}
          draggable={false}
          className={cn(
            'max-w-[90vw] max-h-[90vh] object-contain select-none will-change-transform',
            // pan must track the pointer 1:1; zoom/rotate steps ease into place
            isDragging
              ? 'transition-opacity duration-150'
              : 'transition-[opacity,transform] duration-150 ease-out-quart',
            'motion-reduce:transition-none',
            isLoading || hasError ? 'opacity-0' : 'opacity-100',
          )}
          style={{ transform }}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false)
            setHasError(true)
          }}
        />
      </div>

      {/* Close button — top right */}
      <div className="absolute top-3 right-3 z-10">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          title={m.image_preview_close()}
          aria-label={m.image_preview_close()}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Image counter — top center */}
      {showNav && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-white/60 text-sm select-none tabular-nums pointer-events-none">
          {activeIndex + 1} / {images.length}
        </div>
      )}

      {/* Nav — previous */}
      {showNav && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
          <button
            type="button"
            aria-label={m.image_preview_prev()}
            title={m.image_preview_prev()}
            aria-disabled={activeIndex === 0}
            onClick={() => activeIndex > 0 && onNavigate(activeIndex - 1)}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white aria-disabled:opacity-30"
          >
            <ChevronLeft className="size-5" />
          </button>
        </div>
      )}

      {/* Nav — next */}
      {showNav && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
          <button
            type="button"
            aria-label={m.image_preview_next()}
            title={m.image_preview_next()}
            aria-disabled={activeIndex === images.length - 1}
            onClick={() =>
              activeIndex < images.length - 1 && onNavigate(activeIndex + 1)
            }
            className="inline-flex items-center justify-center rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white aria-disabled:opacity-30"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}

      {/* Bottom pill toolbar */}
      <div
        className={cn(
          'absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 px-2 py-1.5',
          'transition duration-200 ease-out-quart motion-reduce:transition-none',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        )}
      >
        <ToolbarButton
          icon={RotateCcw}
          label={m.image_preview_rotate_left()}
          onPress={() => setRotation((r) => r - 90)}
        />
        <ToolbarButton
          icon={RotateCw}
          label={m.image_preview_rotate_right()}
          onPress={() => setRotation((r) => r + 90)}
        />

        <Divider />

        <ToolbarButton
          icon={ZoomOut}
          label={m.image_preview_zoom_out()}
          onPress={() => zoom(-ZOOM_STEP)}
          isDisabled={scale <= ZOOM_MIN}
        />
        <span className="text-white/60 text-sm tabular-nums w-10 text-center select-none pointer-events-none">
          {Math.round(scale * 100)}%
        </span>
        <ToolbarButton
          icon={ZoomIn}
          label={m.image_preview_zoom_in()}
          onPress={() => zoom(ZOOM_STEP)}
          isDisabled={scale >= ZOOM_MAX}
        />

        <Divider />

        <ToolbarButton
          icon={Maximize2}
          label={m.image_preview_reset()}
          onPress={reset}
        />

        {downloadable && (
          <ToolbarButton
            icon={Download}
            label={m.image_preview_download()}
            onPress={handleDownload}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}

type ToolbarButtonProps = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onPress: () => void
  isDisabled?: boolean
}

function ToolbarButton({
  icon: Icon,
  label,
  onPress,
  isDisabled,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={isDisabled}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
    >
      <Icon className="size-4" />
    </button>
  )
}

function Divider() {
  return (
    <span className="w-px h-4 bg-white/15 mx-1 shrink-0" aria-hidden="true" />
  )
}
