import { m } from '@/paraglide/messages'
import { Button, Skeleton, Surface } from '@heroui/react'
import { cn } from '@heroui/styles'
import { FileTextIcon, ImageOffIcon, SparklesIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useMessageMediaUrl } from '../../hooks/use-message-media-url'
import type { MessageMediaMetadata } from '../../schemas/message-metadata'
import type { MessageType } from '../../types'
import { formatFileSize } from '../../utils/format-file-size'
import { getMediaPlaceholder } from '../../utils/message-meta'
import { MessageSticker } from './message-sticker'

type Props = {
  messageType: MessageType
  metadata: MessageMediaMetadata | null
  isOutbound: boolean
}

export function MessageMediaAttachment({ messageType, metadata, isOutbound }: Props) {
  const uploadFailed = metadata?.upload_failed === true
  const storagePath = metadata?.storage_path?.trim() ?? null

  const signed = useMessageMediaUrl(storagePath)
  const [mediaBroken, setMediaBroken] = useState(false)

  useEffect(() => {
    setMediaBroken(false)
  }, [signed.data, storagePath, messageType])

  const displayName =
    metadata?.file_name?.trim() ||
    (messageType === 'document' ? m.inbox_media_document_fallback_name() : null) ||
    getMediaPlaceholder(messageType)

  const sizeLabel = formatFileSize(metadata?.size ?? null)
  const mimeLabel = metadata?.mime_type?.trim() || null

  if (uploadFailed || !storagePath) {
    return (
      <Surface
        variant="secondary"
        className={cn(
          'mt-1 max-w-full rounded-xl px-3 py-2 text-xs',
          isOutbound ? 'bg-accent-soft text-accent-foreground/90' : 'text-foreground/80',
        )}
      >
        <div className="flex items-start gap-2">
          <FileTextIcon className="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-medium wrap-break-word">{displayName}</p>
            <p className="text-foreground/55">{m.inbox_media_unavailable()}</p>
          </div>
        </div>
      </Surface>
    )
  }

  if (signed.isPending) {
    return (
      <div className="mt-1 w-full max-w-xs">
        <Skeleton className="h-36 w-full max-w-xs rounded-xl" />
      </div>
    )
  }

  if (signed.isError || !signed.data) {
    return (
      <Surface variant="secondary" className="mt-1 max-w-full rounded-xl px-3 py-2 text-xs">
        <p className="text-danger">{m.inbox_media_signed_url_error()}</p>
        <Button size="sm" variant="secondary" className="mt-2" onPress={() => void signed.refetch()}>
          {m.common_retry()}
        </Button>
      </Surface>
    )
  }

  const url = signed.data
  const openInNewTab = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (messageType === 'image') {
    return (
      <div className="relative mt-1 max-w-xs">
        {mediaBroken ? (
          <Surface
            variant="secondary"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-foreground/70"
          >
            <ImageOffIcon className="size-4 shrink-0" aria-hidden />
            <span>{m.inbox_media_image_error()}</span>
          </Surface>
        ) : (
          <button
            type="button"
            onClick={openInNewTab}
            className="group block w-full overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <img
              src={url}
              alt=""
              loading="lazy"
              decoding="async"
              className="max-h-72 w-full cursor-zoom-in object-cover transition-opacity group-hover:opacity-95"
              onError={() => setMediaBroken(true)}
            />
          </button>
        )}
        <p className="mt-1 text-[10px] text-foreground/45">
          <button type="button" className="underline-offset-2 hover:underline" onClick={openInNewTab}>
            {m.inbox_media_open_full()}
          </button>
        </p>
      </div>
    )
  }

  if (messageType === 'video') {
    return (
      <div className="mt-1 w-full max-w-md min-w-0">
        {!mediaBroken ? (
          <MessageInlineVideo
            key={url}
            url={url}
            onError={() => setMediaBroken(true)}
            openInNewTab={openInNewTab}
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
      <div className="mt-1 w-full max-w-md">
        <audio controls preload="metadata" className="w-full min-w-[220px]" src={url}>
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

type VideoWithWebkit = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
}

async function enterVideoFullscreen(video: HTMLVideoElement | null) {
  if (!video) return
  const extended = video as VideoWithWebkit
  try {
    if (typeof video.requestFullscreen === 'function') {
      await video.requestFullscreen()
      return
    }
  } catch {
    /* user dismissed or unsupported */
  }
  try {
    extended.webkitEnterFullscreen?.()
  } catch {
    /* iOS / legacy Safari only */
  }
}

function MessageInlineVideo({
  url,
  onError,
  openInNewTab,
}: {
  url: string
  onError: () => void
  openInNewTab: () => void
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
        className="max-h-96 min-h-40 w-full rounded-xl bg-black/50 object-contain"
        onError={onError}
      >
        {m.inbox_media_video_unsupported()}
      </video>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          aria-label={m.inbox_media_fullscreen()}
          onPress={() => void enterVideoFullscreen(videoRef.current)}
        >
          {m.inbox_media_fullscreen()}
        </Button>
        <button
          type="button"
          className="text-[10px] text-foreground/45 underline-offset-2 hover:underline"
          onClick={openInNewTab}
        >
          {m.inbox_media_open_new_tab()}
        </button>
      </div>
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
    <Surface
      variant="secondary"
      className={cn(
        'mt-1 flex max-w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs',
        isOutbound ? 'bg-accent-soft' : '',
      )}
    >
      <Icon className="size-8 shrink-0 opacity-70" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" title={displayName}>
          {displayName}
        </p>
        {meta ? <p className="truncate text-foreground/55">{meta}</p> : null}
      </div>
      <a
        href={downloadUrl}
        download
        rel="noopener noreferrer"
        className="text-accent shrink-0 text-xs font-medium underline-offset-2 hover:underline"
      >
        {m.inbox_media_download()}
      </a>
    </Surface>
  )
}
