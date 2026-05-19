import { Image } from '@/components/image'
import type { MessageType } from '@/entities/message'
import { formatFileSize, getMediaPlaceholder } from '@/entities/message'
import { m } from '@/paraglide/messages'
import { Button, Skeleton, Surface } from '@heroui/react'
import { cn } from '@heroui/styles'
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
      <Surface
        variant="secondary"
        className={cn(
          'mt-1 max-w-full rounded-xl px-3 py-2 text-xs',
          isOutbound
            ? 'bg-accent-soft text-accent-foreground/90'
            : 'text-foreground/80',
        )}
      >
        <div className="flex items-start gap-2">
          <FileTextIcon
            className="mt-0.5 size-4 shrink-0 opacity-70"
            aria-hidden
          />
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
      <Surface
        variant="secondary"
        className="mt-1 max-w-full rounded-xl px-3 py-2 text-xs"
      >
        <p className="text-danger">{m.inbox_media_signed_url_error()}</p>
        <Button
          size="sm"
          variant="secondary"
          className="mt-2"
          onPress={() => void signed.refetch()}
        >
          {m.common_retry()}
        </Button>
      </Surface>
    )
  }

  const url = signed.data

  if (messageType === 'image') {
    return (
      <Image
        src={url}
        alt={displayName}
        className="mt-1 max-w-xs w-full rounded-xl"
        imageClassName="max-h-96 object-contain rounded-xl"
        downloadable
      />
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
      <div className="mt-1 flex flex-1 md:min-w-[400px]">
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
  onError,
}: {
  url: string
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
        className="max-h-96 min-h-40 w-full rounded-xl bg-black/50 object-contain"
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
