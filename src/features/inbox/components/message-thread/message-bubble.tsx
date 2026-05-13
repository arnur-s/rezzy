import { getUserInitials } from '@/features/users/utils/user-display'
import { Avatar } from '@heroui/react'
import { cn } from '@heroui/styles'
import {
  effectiveRichMediaType,
  parseMessageMediaMetadata,
} from '../../schemas/message-metadata'
import type { MessageRow, MessageType } from '../../types'
import { isMessageStatus, isMessageType } from '../../types'
import {
  MESSAGE_STATUS_META,
  getMediaPlaceholder,
} from '../../utils/message-meta'
import { formatTime } from '../../utils/relative-time'
import { MessageMediaAttachment } from './message-media'

const RICH_MEDIA_TYPES = new Set<MessageType>([
  'image',
  'video',
  'audio',
  'voice',
  'document',
  'sticker',
])

type Props = {
  message: MessageRow
  contactName: string
}

export function MessageBubble({ message, contactName }: Props) {
  const isOutbound = message.direction === 'outbound'
  const type: MessageType = isMessageType(message.type) ? message.type : 'text'
  const mediaMetadata = parseMessageMediaMetadata(message.metadata)
  const richType = effectiveRichMediaType(type, mediaMetadata)
  const isMedia = type !== 'text' || !!message.media_url
  const showRichAttachment = RICH_MEDIA_TYPES.has(richType)
  const showStickerPlaceholder = isMedia && !showRichAttachment
  const hasContent = !!message.content?.trim()
  const initials = getUserInitials(contactName)

  return (
    <div
      className={cn(
        'flex w-full items-end gap-2',
        isOutbound ? 'justify-end' : 'justify-start',
      )}
    >
      {!isOutbound ? (
        <Avatar size="sm" className="shrink-0">
          <Avatar.Fallback>{initials}</Avatar.Fallback>
        </Avatar>
      ) : null}

      <div
        className={cn(
          'flex max-w-[78%] flex-col gap-1',
          isOutbound ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2 text-sm shadow-xs',
            isOutbound
              ? 'rounded-br-sm bg-accent text-accent-foreground'
              : 'rounded-bl-sm bg-foreground/5 text-foreground',
          )}
        >
          {showRichAttachment ? (
            <MessageMediaAttachment
              messageType={richType}
              metadata={mediaMetadata}
              isOutbound={isOutbound}
            />
          ) : null}
          {showStickerPlaceholder ? (
            <p
              className={cn(
                'text-xs',
                isOutbound ? 'text-accent-foreground/80' : 'text-foreground/70',
                hasContent && 'mb-1',
              )}
            >
              {getMediaPlaceholder(type)}
            </p>
          ) : null}
          {hasContent ? (
            <p
              className={cn(
                'whitespace-pre-wrap wrap-break-word leading-relaxed',
                showRichAttachment && 'mt-1',
              )}
            >
              {message.content}
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            'flex items-center gap-1 px-1 text-[10px] text-foreground/45',
            isOutbound ? 'flex-row-reverse' : 'flex-row',
          )}
        >
          <span>{formatTime(message.created_at)}</span>
          {isOutbound ? <DeliveryIndicator status={message.status} /> : null}
        </div>
      </div>
    </div>
  )
}

function DeliveryIndicator({ status }: { status: string | null }) {
  const key =
    status && isMessageStatus(status)
      ? status
      : status === 'sent' || status === null
        ? 'sent'
        : null

  if (!key) return null

  const meta = MESSAGE_STATUS_META[key]
  return (
    <meta.Icon
      aria-label={meta.labelKey()}
      className={cn('size-3', meta.className)}
    />
  )
}
