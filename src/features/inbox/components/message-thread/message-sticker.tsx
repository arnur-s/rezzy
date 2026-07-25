import { Skeleton } from '@astryxdesign/core/Skeleton'
import LottieDefault from 'lottie-react'
import type { LottieComponentProps, LottieRefCurrentProps } from 'lottie-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTgsAnimation } from '../../hooks/use-tgs-animation'
import type { MessageMediaMetadata } from '../../schemas/message-metadata'

// Some bundlers (Vite pre-bundling of CJS-published packages) deliver the
// default export wrapped as `{ default: Component }`. Unwrap defensively so
// `<Lottie />` is always the actual component.
type LottieComponent = (props: LottieComponentProps) => React.ReactElement
const Lottie: LottieComponent =
  (LottieDefault as unknown as { default?: LottieComponent }).default ??
  LottieDefault

const STICKER_MAX_PX = 192
const STICKER_FALLBACK_SQUARE = 160

type Props = {
  url: string
  mimeType: string | null
  metadata: MessageMediaMetadata | null
  fallback: ReactNode
}

export function MessageSticker({ url, mimeType, metadata, fallback }: Props) {
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setBroken(false)
  }, [url, mimeType])

  if (broken) return <>{fallback}</>

  const dims = computeStickerDimensions(metadata)
  const mime = mimeType?.toLowerCase().trim() ?? ''

  if (mime === 'application/x-tgsticker') {
    return (
      <div className="mt-1" style={{ width: dims.width, height: dims.height }}>
        <TgsLottieSticker url={url} onError={() => setBroken(true)} />
      </div>
    )
  }

  if (mime === 'video/webm' || mime.startsWith('video/')) {
    return (
      <div className="mt-1" style={{ width: dims.width, height: dims.height }}>
        <video
          src={url}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="size-full object-contain"
          onError={() => setBroken(true)}
        />
      </div>
    )
  }

  return (
    <div className="mt-1" style={{ width: dims.width, height: dims.height }}>
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-full object-contain"
        onError={() => setBroken(true)}
      />
    </div>
  )
}

function TgsLottieSticker({
  url,
  onError,
}: {
  url: string
  onError: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lottieRef = useRef<LottieRefCurrentProps | null>(null)
  const inView = useInView(containerRef)
  const { data, isPending, isError } = useTgsAnimation(url)

  useEffect(() => {
    if (isError) onError()
  }, [isError, onError])

  useEffect(() => {
    const lottie = lottieRef.current
    if (!lottie) return
    if (inView) lottie.play()
    else lottie.pause()
  }, [inView, data])

  if (isError) {
    return null
  }

  if (isPending) {
    return <Skeleton width="100%" height="100%" radius={2} />
  }

  return (
    <div ref={containerRef} className="size-full">
      <Lottie
        lottieRef={lottieRef}
        animationData={data}
        loop
        autoplay={inView}
      />
    </div>
  )
}

function computeStickerDimensions(metadata: MessageMediaMetadata | null) {
  const w = metadata?.telegram?.width ?? metadata?.sticker_width ?? null
  const h = metadata?.telegram?.height ?? metadata?.sticker_height ?? null
  if (!w || !h || w <= 0 || h <= 0) {
    return { width: STICKER_FALLBACK_SQUARE, height: STICKER_FALLBACK_SQUARE }
  }
  const scale = Math.min(STICKER_MAX_PX / w, STICKER_MAX_PX / h, 1)
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  }
}

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        setInView(entry.isIntersecting)
      },
      { threshold: 0.05 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return inView
}
