import type { MessageRowWithAttachments, MessageType } from '@/entities/message'
import {
  MESSAGE_STATUS_META,
  getMediaPlaceholder,
  isMessageStatus,
  isMessageType,
} from '@/entities/message'
import { getUserInitials } from '@/entities/user'
import { m } from '@/paraglide/messages'
import { Avatar, Button, toast  } from '@heroui/react'
import { cn } from '@heroui/styles'
import { ReplyIcon, RotateCcwIcon } from 'lucide-react'
import { memo } from 'react'
import { useRetryMessage } from '../../hooks/use-messages'
import {
  effectiveRichMediaType,
  parseContactsMetadata,
  parseInteractiveMetadata,
  parseLocationMetadata,
  parseMessageMediaMetadata,
  parseQuoteMetadata,
  parseShareMetadata,
  parseStoryMetadata,
  parseUnsupportedMetadata,
} from '../../schemas/message-metadata'
import { FormattedMessageText } from '../formatted-message-text'
import { formatTime } from '../../utils/relative-time'
import { MessageContactCard } from './message-contact-card'
import { MessageInteractive } from './message-interactive'
import { MessageLocation } from './message-location'
import { MessageMediaAttachment } from './message-media'
import { MessageReactionsRow } from './message-reactions-row'
import { MessageReplyPreview } from './message-reply-preview'
import { MessageShare } from './message-share'
import { useMessageThreadContext } from './message-thread-context'
import { MessageUnsupported } from './message-unsupported'

const RICH_MEDIA_TYPES = new Set<MessageType>([
  'image',
  'video',
  'audio',
  'voice',
  'document',
  'sticker',
])

const STRUCTURED_TYPES = new Set<MessageType>([
  'location',
  'contact',
  'interactive',
  'share',
  'story_reply',
  'story_mention',
  'system',
  'unsupported',
])

type Props = {
  message: MessageRowWithAttachments
  contactName: string
}

export const MessageBubble = memo(function MessageBubbleComponent({ message, contactName }: Props) {
  const thread = useMessageThreadContext()
  const retryMessage = useRetryMessage()
  const isOutbound = message.direction === 'outbound'
  const type: MessageType = isMessageType(message.type) ? message.type : 'text'
  const isDeleted = !!message.deleted_at
  const mediaMetadata = parseMessageMediaMetadata(message.metadata)
  const richType = effectiveRichMediaType(
    type,
    mediaMetadata,
    message.media_mime_type,
    message.media_filename,
  )
  const isStructured = STRUCTURED_TYPES.has(type)
  const isMedia =
    !isStructured &&
    (type !== 'text' || !!message.media_url || !!mediaMetadata?.storage_path)
  const showRichAttachment = !isDeleted && RICH_MEDIA_TYPES.has(richType) && isMedia
  const showStickerPlaceholder = !isDeleted && isMedia && !showRichAttachment
  const hasContent = !isDeleted && !!message.content?.trim()
  const initials = getUserInitials(contactName)

  const quote = parseQuoteMetadata(message.metadata)
  const showReplyPreview =
    !isDeleted && (quote !== null || message.reply_to_message_id !== null)

  // Structured attachments beyond the first (legacy media_* covers position 0).
  const extraAttachments = (message.message_attachments ?? [])
    .filter((attachment) => attachment.position > 0)
    .sort((a, b) => a.position - b.position)

  const reactions = thread?.reactionsByMessageId.get(message.id) ?? []
  // Held as a local so TypeScript narrows it inside the JSX callback below.
  const onReply = isDeleted ? null : (thread?.onReplyToMessage ?? null)
  const showRetry =
    isOutbound && message.status === 'failed' && thread != null && !isDeleted

  const handleRetry = () => {
    if (!thread) return
    retryMessage.mutate(
      { messageId: message.id, channelType: thread.channelType },
      {
        onError: (error) => {
          toast.danger(m.inbox_composer_send_error(), {
            description:
              error instanceof Error ? error.message : m.common_unknown_error(),
          })
        },
      },
    )
  }

  return (
    <div
      id={`message-${message.id}`}
      data-message-id={message.id}
      className={cn(
        'group flex w-full items-end gap-2',
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
          className={
            showRichAttachment && !showReplyPreview
              ? undefined
              : cn(
                  'min-w-fit rounded-2xl px-3.5 py-2 text-sm shadow-xs',
                  isOutbound
                    ? 'rounded-br-sm bg-accent text-accent-foreground'
                    : 'rounded-bl-sm bg-foreground/5 text-foreground',
                )
          }
        >
          {showReplyPreview ? (
            <MessageReplyPreview
              quote={quote}
              replyToMessageId={message.reply_to_message_id}
              isOutbound={isOutbound}
            />
          ) : null}

          {isDeleted ? (
            <p
              className={cn(
                'text-xs italic',
                isOutbound ? 'text-accent-foreground/70' : 'text-foreground/55',
              )}
            >
              {m.inbox_message_deleted()}
            </p>
          ) : null}

          {!isDeleted && type === 'location' ? (
            <LocationOrFallback message={message} isOutbound={isOutbound} />
          ) : null}
          {!isDeleted && type === 'contact' ? (
            <ContactsOrFallback message={message} isOutbound={isOutbound} />
          ) : null}
          {!isDeleted && type === 'interactive' ? (
            <InteractiveOrFallback message={message} isOutbound={isOutbound} />
          ) : null}
          {!isDeleted &&
          (type === 'share' || type === 'story_reply' || type === 'story_mention') ? (
            <MessageShare
              share={parseShareMetadata(message.metadata)}
              story={parseStoryMetadata(message.metadata)}
              messageType={type}
              isOutbound={isOutbound}
            />
          ) : null}
          {!isDeleted && (type === 'unsupported' || type === 'system') ? (
            <MessageUnsupported
              unsupported={parseUnsupportedMetadata(message.metadata)}
              messageType={type}
              isOutbound={isOutbound}
            />
          ) : null}

          {showRichAttachment && (
            <MessageMediaAttachment
              messageType={richType}
              metadata={mediaMetadata}
              isOutbound={isOutbound}
              mediaUrl={message.media_url}
              mediaFilename={message.media_filename}
              mediaMimeType={message.media_mime_type}
              mediaSize={message.media_size}
              workspaceId={message.workspace_id}
            />
          )}
          {!isDeleted &&
            extraAttachments.map((attachment) =>
              attachment.storage_path && attachment.download_status === 'stored' ? (
                <MessageMediaAttachment
                  key={attachment.id}
                  messageType={
                    isMessageType(attachment.kind) ? attachment.kind : 'document'
                  }
                  metadata={null}
                  isOutbound={isOutbound}
                  mediaUrl={attachment.storage_path}
                  mediaFilename={attachment.filename}
                  mediaMimeType={attachment.mime_type}
                  mediaSize={
                    attachment.size_bytes !== null
                      ? Number(attachment.size_bytes)
                      : null
                  }
                  workspaceId={message.workspace_id}
                />
              ) : (
                <p
                  key={attachment.id}
                  className={cn(
                    'mt-1 text-xs',
                    isOutbound
                      ? 'text-accent-foreground/70'
                      : 'text-foreground/55',
                  )}
                >
                  {m.inbox_attachment_failed()}
                </p>
              ),
            )}
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
          {hasContent && !isStructuredContentDuplicate(type, message.content) ? (
            <FormattedMessageText
              content={message.content ?? ''}
              variant="bubble"
              className={cn(
                'whitespace-pre-wrap wrap-break-word leading-relaxed',
                (showRichAttachment || isStructured) && 'mt-1',
              )}
            />
          ) : null}
        </div>

        <MessageReactionsRow reactions={reactions} isOutbound={isOutbound} />

        <div
          className={cn(
            'flex items-center gap-1 px-1 text-[10px] text-foreground/45',
            isOutbound ? 'flex-row-reverse' : 'flex-row',
          )}
        >
          <span>{formatTime(message.created_at)}</span>
          {message.edited_at && !isDeleted ? (
            <span className="italic">{m.inbox_message_edited()}</span>
          ) : null}
          {isOutbound ? <DeliveryIndicator status={message.status} /> : null}
          {showRetry ? (
            <Button
              size="sm"
              variant="ghost"
              onPress={handleRetry}
              isDisabled={retryMessage.isPending}
              className="h-5 min-w-0 gap-1 px-1.5 text-[10px] text-danger"
            >
              <RotateCcwIcon className="size-3" aria-hidden />
              {m.inbox_message_retry()}
            </Button>
          ) : null}
          {onReply ? (
            <Button
              size="sm"
              variant="ghost"
              aria-label={m.inbox_reply_action()}
              onPress={() => onReply(message)}
              className="h-5 min-w-0 px-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            >
              <ReplyIcon className="size-3" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
})

/**
 * Interactive/button titles are stored both as content and metadata; avoid
 * rendering the same title twice inside one bubble.
 */
function isStructuredContentDuplicate(
  type: MessageType,
  content: string | null,
): boolean {
  return type === 'interactive' && !!content?.trim()
}

function LocationOrFallback({
  message,
  isOutbound,
}: {
  message: MessageRowWithAttachments
  isOutbound: boolean
}) {
  const location = parseLocationMetadata(message.metadata)
  if (!location) {
    return <TypeFallback type="location" isOutbound={isOutbound} />
  }
  return <MessageLocation location={location} isOutbound={isOutbound} />
}

function ContactsOrFallback({
  message,
  isOutbound,
}: {
  message: MessageRowWithAttachments
  isOutbound: boolean
}) {
  const contacts = parseContactsMetadata(message.metadata)
  if (contacts.length === 0) {
    return <TypeFallback type="contact" isOutbound={isOutbound} />
  }
  return <MessageContactCard contacts={contacts} isOutbound={isOutbound} />
}

function InteractiveOrFallback({
  message,
  isOutbound,
}: {
  message: MessageRowWithAttachments
  isOutbound: boolean
}) {
  const interactive = parseInteractiveMetadata(message.metadata)
  if (!interactive) {
    return <TypeFallback type="interactive" isOutbound={isOutbound} />
  }
  return <MessageInteractive interactive={interactive} isOutbound={isOutbound} />
}

function TypeFallback({
  type,
  isOutbound,
}: {
  type: MessageType
  isOutbound: boolean
}) {
  return (
    <p
      className={cn(
        'text-xs',
        isOutbound ? 'text-accent-foreground/80' : 'text-foreground/70',
      )}
    >
      {getMediaPlaceholder(type)}
    </p>
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
