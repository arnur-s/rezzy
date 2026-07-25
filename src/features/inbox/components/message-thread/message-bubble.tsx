import type {
  MessageRowWithAttachments,
  MessageStatus,
  MessageType,
} from '@/entities/message'
import {
  MESSAGE_STATUS_META,
  getMediaPlaceholder,
  isMessageStatus,
  isMessageType,
} from '@/entities/message'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import {
  ChatMessageBubble,
  ChatMessageMetadata,
} from '@astryxdesign/core/Chat'
import { IconButton } from '@astryxdesign/core/IconButton'
import { useToast } from '@astryxdesign/core/Toast'
import { ReplyIcon, TriangleAlertIcon } from 'lucide-react'
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
import { formatTime } from '../../utils/relative-time'
import { MessageCollapsibleText } from './message-collapsible-text'
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
  /** Position within a same-sender run, for grouped corner radii. */
  group?: 'first' | 'middle' | 'last'
  /**
   * Whether this bubble closes a run (or opens a new time block). A run shows
   * one timestamp footer, not one per bubble; a message carrying state of its
   * own (edited, failed, reactions) overrides this and always shows its footer.
   */
  closesRun?: boolean
  /**
   * The single sequential tab stop in the transcript. Every other reply
   * control is reachable with the arrow keys instead, so tabbing through a
   * long thread costs one stop rather than one per message.
   */
  isTabStop?: boolean
}

export const MessageBubble = memo(function MessageBubbleComponent({
  message,
  group,
  closesRun = true,
  isTabStop = false,
}: Props) {
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
  const showToast = useToast()

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
  const hasFailed =
    isOutbound && message.status === 'failed' && thread != null && !isDeleted

  const handleRetry = () => {
    if (!thread) return
    retryMessage.mutate(
      { messageId: message.id, channelType: thread.channelType },
      {
        onError: (error) => {
          showToast({
            body:
              error instanceof Error ? error.message : m.common_unknown_error(),
            type: 'error',
          })
        },
      },
    )
  }

  // Media-only messages render without a visible bubble boundary.
  const isGhost = showRichAttachment && !showReplyPreview && !hasContent

  // Text reads from its first line, so the rail marks that line. A media or
  // structured bubble is one object with no first line — on a 500px video,
  // top-anchoring strands the control in empty space beside the frame's
  // corner — so the rail marks its middle instead.
  const railAnchor: RailAnchor =
    showRichAttachment || isStructured ? 'block' : 'first-line'

  const showEdited = !!message.edited_at && !isDeleted
  // A failed send states its status in words below, so the tick row stays a
  // record of successful delivery only.
  const showDelivery =
    isOutbound && !hasFailed && hasDeliveryIndicator(message.status)
  const hasTrailingMeta = showEdited || showDelivery || reactions.length > 0
  // Runs carry one footer, but a message with state of its own always shows it.
  const showFooter = closesRun || showEdited || hasFailed || reactions.length > 0

  return (
    <ChatMessageBubble
      id={`message-${message.id}`}
      data-message-id={message.id}
      variant={isGhost ? 'ghost' : 'filled'}
      group={group}
      className={cn(
        // Positioning context and hover scope for the action rail: the astryx
        // ChatMessage root wraps a whole same-sender run, so grouping on it
        // would reveal every message's rail at once.
        'group/msg relative',
        hasFailed && 'ring-error/40 ring-1',
      )}
      metadata={
        showFooter ? (
          // Timestamp lives inside our own footer (not astryx's `timestamp`
          // slot) so we own the separator and only draw it before real content.
          <ChatMessageMetadata
            footer={
              <span
                className={cn(
                  'flex flex-col gap-0.5',
                  isOutbound ? 'items-end' : 'items-start',
                )}
              >
                <span className="flex items-center gap-1">
                  <span>{formatTime(message.created_at)}</span>
                  {hasTrailingMeta ? (
                    <span aria-hidden className="text-primary/30">
                      ·
                    </span>
                  ) : null}
                  {showEdited ? (
                    <span className="italic">{m.inbox_message_edited()}</span>
                  ) : null}
                  {showDelivery ? (
                    <DeliveryIndicator status={message.status} />
                  ) : null}
                  <MessageReactionsRow
                    reactions={reactions}
                    isOutbound={isOutbound}
                  />
                </span>
                {hasFailed ? (
                  <span className="text-error flex items-center gap-1">
                    <TriangleAlertIcon className="size-3 shrink-0" aria-hidden />
                    <span>{m.inbox_message_status_failed()}</span>
                    <Button
                      label={m.inbox_message_retry()}
                      size="sm"
                      variant="ghost"
                      onClick={handleRetry}
                      isDisabled={retryMessage.isPending}
                      isLoading={retryMessage.isPending}
                    />
                  </span>
                ) : null}
              </span>
            }
          />
        ) : undefined
      }
    >
      {showReplyPreview ? (
        <MessageReplyPreview
          quote={quote}
          replyToMessageId={message.reply_to_message_id}
        />
      ) : null}

      {isDeleted ? (
        <p className="text-xs italic opacity-70">{m.inbox_message_deleted()}</p>
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
            <p key={attachment.id} className="mt-1 text-xs opacity-70">
              {m.inbox_attachment_failed()}
            </p>
          ),
        )}
      {showStickerPlaceholder ? (
        <p className={cn('text-xs opacity-80', hasContent && 'mb-1')}>
          {getMediaPlaceholder(type)}
        </p>
      ) : null}
      {hasContent && !isStructuredContentDuplicate(type, message.content) ? (
        <MessageCollapsibleText
          content={message.content ?? ''}
          className={cn(
            'whitespace-pre-wrap wrap-break-word leading-relaxed',
            (showRichAttachment || isStructured) && 'mt-1',
          )}
        />
      ) : null}

      {/* Last child so assistive tech reads the message before its actions,
          even though the rail is painted beside the bubble's first line. */}
      {onReply ? (
        <MessageActionRail
          isOutbound={isOutbound}
          messageId={message.id}
          isTabStop={isTabStop}
          anchor={railAnchor}
          onReply={() => onReply(message)}
        />
      ) : null}
    </ChatMessageBubble>
  )
})

/** Where the rail sits vertically: on a line of text, or against a block. */
type RailAnchor = 'first-line' | 'block'

/**
 * Message-scoped actions, parked in the transcript gutter beside the bubble
 * rather than inside the metadata footer — the footer is a status readout, and
 * an action mixed into it lands at a different x on every message depending on
 * which telemetry happens to be present.
 *
 * The rail is a DOM child of the bubble, so hovering it keeps the bubble's
 * `:hover` alive; the inline padding (not a margin) puts the visual gap inside
 * the rail's own hit area so the pointer never crosses a dead zone on the way.
 */
function MessageActionRail({
  isOutbound,
  messageId,
  isTabStop,
  anchor,
  onReply,
}: {
  isOutbound: boolean
  messageId: string
  isTabStop: boolean
  anchor: RailAnchor
  onReply: () => void
}) {
  return (
    <span
      className={cn(
        'absolute flex items-center opacity-0 transition-opacity duration-150 ease-out motion-reduce:transition-none',
        // top-2 centers the 28px control on the first 20px line inside the
        // bubble's 12px padding-block; a block is marked at its middle.
        anchor === 'first-line' ? 'top-2' : 'top-1/2 -translate-y-1/2',
        // No hit target until the message is engaged, so the empty gutter
        // stays empty.
        'pointer-events-none',
        'group-hover/msg:pointer-events-auto group-hover/msg:opacity-100',
        'group-focus-within/msg:pointer-events-auto group-focus-within/msg:opacity-100',
        // Touch has no hover to reveal it: stay quietly present instead.
        '[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-60',
        isOutbound ? 'right-full pr-1' : 'left-full pl-1',
      )}
    >
      <IconButton
        label={m.inbox_reply_action()}
        tooltip={m.inbox_reply_action()}
        size="sm"
        variant="ghost"
        icon={<ReplyIcon className="size-3.5" aria-hidden />}
        onClick={onReply}
        data-reply-for={messageId}
        tabIndex={isTabStop ? 0 : -1}
        // The 28px control keeps its compact mark; touch gets the 44px target.
        className="[@media(hover:none)]:after:absolute [@media(hover:none)]:after:-inset-2 [@media(hover:none)]:after:content-['']"
      />
    </span>
  )
}

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
    return <TypeFallback type="location" />
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
    return <TypeFallback type="contact" />
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
    return <TypeFallback type="interactive" />
  }
  return <MessageInteractive interactive={interactive} isOutbound={isOutbound} />
}

function TypeFallback({ type }: { type: MessageType }) {
  return <p className="text-xs opacity-80">{getMediaPlaceholder(type)}</p>
}

function deliveryStatusKey(status: string | null): MessageStatus | null {
  if (status && isMessageStatus(status)) return status
  if (status === 'sent' || status === null) return 'sent'
  return null
}

function hasDeliveryIndicator(status: string | null): boolean {
  return deliveryStatusKey(status) !== null
}

function DeliveryIndicator({ status }: { status: string | null }) {
  const key = deliveryStatusKey(status)
  if (!key) return null

  const meta = MESSAGE_STATUS_META[key]
  return (
    <meta.Icon
      role="img"
      aria-label={meta.labelKey()}
      className={cn('size-3', meta.className)}
    />
  )
}
