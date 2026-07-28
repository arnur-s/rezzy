import { Image } from '@/components/image'
import type { MessageType } from '@/entities/message'
import { formatFileSize, getMediaPlaceholder } from '@/entities/message'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { cn } from '@/lib/cn'
import { FileTextIcon, SparklesIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useMessageMediaUrl } from '../../hooks/use-message-media-url'
import type { MessageMediaMetadata } from '../../schemas/message-metadata'
import { getChatMediaStoragePath } from '../../schemas/message-metadata'
import { MessageSticker } from './message-sticker'

type Props = {
  messageType: MessageType
  metadata: MessageMediaMetadata | null
  isOutbound: boolean
  mediaUrl: string | null
  mediaFilename: string | null
  mediaMimeType: string | null
  mediaSize: number | null
  workspaceId: string
}

/**
 * Inline media is bounded by a box and then sized to its own aspect ratio —
 * never stretched to the box. A portrait clip forced to the full column width
 * and capped in height gets letterboxed, spending a 416×388 slot on a 216px
 * video and pushing the rest of the thread off screen.
 *
 * Width caps at 360px and height at 280px: enough to recognize the content at
 * a glance in a working inbox, small enough that two media messages in a row
 * still read as one conversation rather than filling the fold. Full size lives
 * in the preview.
 */
const MEDIA_MAX_WIDTH = 360
const MEDIA_MAX_HEIGHT = 280

type MediaFit = { width: number; height: number; aspectRatio: string }

/**
 * The rendered box for media whose intrinsic size the provider reported.
 * Only Telegram sends dimensions today; returns null for everyone else so the
 * caller falls back to the browser's own replaced-element sizing.
 */
function fitMedia(metadata: MessageMediaMetadata | null): MediaFit | null {
  const width = metadata?.telegram?.width
  const height = metadata?.telegram?.height
  if (!width || !height) return null
  const scale = Math.min(
    MEDIA_MAX_WIDTH / width,
    MEDIA_MAX_HEIGHT / height,
    1,
  )
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    // Carried alongside the width so a narrow pane clamping `max-w-full`
    // recomputes the height instead of distorting the frame.
    aspectRatio: `${width} / ${height}`,
  }
}

export function MessageMediaAttachment({
  messageType,
  metadata,
  isOutbound,
  mediaUrl,
  mediaFilename,
  mediaMimeType,
  mediaSize,
  workspaceId,
}: Props) {
  const uploadFailed = metadata?.upload_failed === true
  const storagePath = getChatMediaStoragePath(
    metadata ?? {},
    messageType,
    mediaUrl,
  )

  const signed = useMessageMediaUrl(
    uploadFailed ? null : storagePath,
    workspaceId,
  )
  const [mediaBroken, setMediaBroken] = useState(false)

  useEffect(() => {
    setMediaBroken(false)
  }, [signed.data, storagePath, messageType])

  const displayName =
    mediaFilename?.trim() ||
    metadata?.file_name?.trim() ||
    (messageType === 'document'
      ? m.inbox_media_document_fallback_name()
      : null) ||
    getMediaPlaceholder(messageType)

  const sizeLabel = formatFileSize(mediaSize ?? metadata?.size ?? null)
  const mimeLabel = mediaMimeType?.trim() || metadata?.mime_type?.trim() || null

  if (uploadFailed || !storagePath) {
    return (
      <div
        className={cn(
          'bg-muted mt-1 max-w-full rounded-xl px-3 py-2 text-xs',
          isOutbound
            ? 'bg-current/10 text-current/90'
            : 'text-primary/80',
        )}
      >
        <div className="flex items-start gap-2">
          <FileTextIcon
            className="mt-0.5 size-4 shrink-0 opacity-70"
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-medium wrap-break-word">{displayName}</p>
            <p className="text-secondary">{m.inbox_media_unavailable()}</p>
          </div>
        </div>
      </div>
    )
  }

  if (signed.isPending) {
    return (
      <div className="mt-1 w-full max-w-xs">
        <Skeleton width="100%" height={144} radius={4} />
      </div>
    )
  }

  if (signed.isError || !signed.data) {
    return (
      <div className="bg-muted mt-1 max-w-full rounded-xl px-3 py-2 text-xs">
        <p className="text-error">{m.inbox_media_signed_url_error()}</p>
        <div className="mt-2">
          <Button
            label={m.common_retry()}
            size="sm"
            variant="secondary"
            onClick={() => void signed.refetch()}
          />
        </div>
      </div>
    )
  }

  const url = signed.data

  const fit = fitMedia(metadata)

  if (messageType === 'image') {
    return (
      <Image
        src={url}
        alt={displayName}
        // Known dimensions reserve the exact box, so the transcript never
        // reflows when the image decodes.
        width={fit?.width}
        height={fit?.height}
        className={cn('mt-1 rounded-xl', !fit && 'max-w-90')}
        imageClassName={cn(
          'rounded-xl',
          fit ? 'object-cover' : 'max-h-70 max-w-full object-contain',
        )}
        downloadable
      />
    )
  }

  if (messageType === 'video') {
    return (
      <div className="mt-1 min-w-0">
        {!mediaBroken ? (
          <MessageInlineVideo
            key={url}
            url={url}
            fit={fit}
            onError={() => setMediaBroken(true)}
          />
        ) : (
          <DocumentFallbackCard
            displayName={displayName}
            mimeLabel={mimeLabel}
            sizeLabel={sizeLabel}
            downloadUrl={url}
            isOutbound={isOutbound}
          />
        )}
      </div>
    )
  }

  if (messageType === 'audio' || messageType === 'voice') {
    return (
      <div className="mt-1 flex flex-1 md:min-w-100">
        <audio controls preload="metadata" className="flex-1" src={url}>
          {m.inbox_media_audio_unsupported()}
        </audio>
      </div>
    )
  }

  if (messageType === 'sticker') {
    return (
      <MessageSticker
        url={url}
        mimeType={mimeLabel}
        metadata={metadata}
        fallback={
          <DocumentFallbackCard
            leading="sparkles"
            displayName={getMediaPlaceholder('sticker')}
            mimeLabel={m.inbox_media_sticker_tgs_hint()}
            sizeLabel={sizeLabel}
            downloadUrl={url}
            isOutbound={isOutbound}
          />
        }
      />
    )
  }

  if (messageType === 'document') {
    return (
      <DocumentFallbackCard
        displayName={displayName}
        mimeLabel={mimeLabel}
        sizeLabel={sizeLabel}
        downloadUrl={url}
        isOutbound={isOutbound}
      />
    )
  }

  return null
}

function MessageInlineVideo({
  url,
  fit,
  onError,
}: {
  url: string
  fit: MediaFit | null
  onError: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    videoRef.current?.load()
  }, [url])

  return (
    <div className="min-w-0 space-y-1">
      <video
        ref={videoRef}
        src={url}
        controls
        playsInline
        preload="auto"
        className={cn(
          'max-w-full rounded-xl bg-black/50',
          // Unknown dimensions: let the replaced element size itself from the
          // stream, bounded on both axes — which preserves the ratio too.
          !fit && 'max-h-70 min-h-40 object-contain',
        )}
        // Data-derived geometry, so it cannot be a token utility.
        style={
          fit ? { width: fit.width, aspectRatio: fit.aspectRatio } : undefined
        }
        onError={onError}
      >
        {m.inbox_media_video_unsupported()}
      </video>
    </div>
  )
}

function DocumentFallbackCard({
  displayName,
  mimeLabel,
  sizeLabel,
  downloadUrl,
  isOutbound,
  leading = 'file',
}: {
  displayName: string
  mimeLabel: string | null
  sizeLabel: string | null
  downloadUrl: string
  isOutbound: boolean
  leading?: 'file' | 'sparkles'
}) {
  const meta = [mimeLabel, sizeLabel].filter(Boolean).join(' · ')
  const Icon = leading === 'sparkles' ? SparklesIcon : FileTextIcon

  return (
    <div
      className={cn(
        'bg-muted mt-1 flex max-w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs',
        isOutbound ? 'bg-current/10' : '',
      )}
    >
      <Icon className="size-8 shrink-0 opacity-70" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" title={displayName}>
          {displayName}
        </p>
        {meta ? <p className="text-secondary truncate">{meta}</p> : null}
      </div>
      <a
        href={downloadUrl}
        download
        rel="noopener noreferrer"
        className="text-accent shrink-0 text-xs font-medium underline-offset-2 hover:underline"
      >
        {m.inbox_media_download()}
      </a>
    </div>
  )
}
