import { getReactionCapabilities } from '@/entities/channel'
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
  parseSharedContacts,
} from '@/entities/message'
import { useLongPress } from '@/hooks/use-long-press'
import { cn } from '@/lib/cn'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { ChatMessageBubble, ChatMessageMetadata } from '@astryxdesign/core/Chat'
import type { DropdownMenuOption } from '@astryxdesign/core/DropdownMenu'
import { useToast } from '@astryxdesign/core/Toast'
import { CopyIcon, ReplyIcon, TriangleAlertIcon } from 'lucide-react'
import { memo, useState } from 'react'
import { useRetryMessage } from '../../hooks/use-messages'
import { currentOutboundReaction } from '../../hooks/use-send-reaction'
import {
  effectiveRichMediaType,
  parseInteractiveMetadata,
  parseLocationMetadata,
  parseMessageMediaMetadata,
  parseQuoteMetadata,
  parseShareMetadata,
  parseStoryMetadata,
  parseUnsupportedMetadata,
} from '../../schemas/message-metadata'
import type { ReactionBlockedReason } from '../../utils/reaction-eligibility'
import { getReactionAvailability } from '../../utils/reaction-eligibility'
import { formatTime } from '../../utils/relative-time'
import type { MessageActionAnchor } from './message-action-menu'
import { MessageActionMenu } from './message-action-menu'
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
import { ReactionPicker } from './reaction-picker'

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
  const showRichAttachment =
    !isDeleted && RICH_MEDIA_TYPES.has(richType) && isMedia
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

  const actionItems: Array<DropdownMenuOption> = []
  if (onReply) {
    actionItems.push({
      label: m.inbox_reply_action(),
      icon: <ReplyIcon className="size-4" aria-hidden />,
      onClick: () => onReply(message),
    })
  }
  if (hasContent) {
    const text = message.content ?? ''
    actionItems.push({
      label: m.inbox_message_copy(),
      icon: <CopyIcon className="size-4" aria-hidden />,
      onClick: () => {
        void copyToClipboard(text).then((ok) =>
          showToast({
            body: ok ? m.inbox_message_copied() : m.inbox_message_copy_failed(),
            type: ok ? 'info' : 'error',
          }),
        )
      },
    })
  }

  const [isPickerOpen, setIsPickerOpen] = useState(false)

  // Reactions are a channel capability before they are a message action: an
  // unsupported provider draws nothing, rather than a disabled control that
  // explains a limitation the agent cannot lift.
  const onReact = thread?.onReactToMessage ?? null
  const reactionAvailability = thread
    ? getReactionAvailability({
        channelType: thread.channelType,
        message,
        isChannelActive: thread.isChannelActive,
      })
    : ({ status: 'hidden' } as const)
  const showReactionPicker =
    onReact !== null && reactionAvailability.status !== 'hidden'
  const isReactionPending = thread?.isReactionPending(message.id) ?? false
  const supportedReactionEmoji = thread
    ? getReactionCapabilities(thread.channelType).supportedEmoji
    : []

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  // A menu raised by press-and-hold dims and blurs the rest of the thread, the
  // way a messenger does; the same menu opened from the trigger does not.
  const [isPressMenu, setIsPressMenu] = useState(false)
  const handleMenuOpenChange = (open: boolean) => {
    setIsMenuOpen(open)
    if (!open) setIsPressMenu(false)
  }
  const longPress = useLongPress({
    isEnabled: actionItems.length > 0,
    onLongPress: () => {
      setIsPressMenu(true)
      setIsMenuOpen(true)
    },
  })

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

  // Text reads from its first line, so the trigger marks that line. A media or
  // structured bubble is one object with no first line — on a 500px video,
  // top-anchoring strands the control in empty space beside the frame's
  // corner — so the trigger marks its middle instead.
  const actionAnchor: MessageActionAnchor =
    showRichAttachment || isStructured ? 'block' : 'first-line'

  const showEdited = !!message.edited_at && !isDeleted
  // A failed send states its status in words below, so the tick row stays a
  // record of successful delivery only.
  const showDelivery =
    isOutbound && !hasFailed && hasDeliveryIndicator(message.status)
  const hasTrailingMeta =
    showEdited || showDelivery || hasFailed || reactions.length > 0
  // Runs carry one footer, but a message with state of its own always shows it.
  const showFooter =
    closesRun || showEdited || hasFailed || reactions.length > 0

  return (
    // The hover scope is the whole row, not the bubble: a two-word message is a
    // small target, and reaching for its menu should not mean reaching for the
    // words. It has to be a per-message box — the astryx ChatMessage root wraps
    // a whole same-sender run, so grouping on that would reveal every message's
    // trigger at once. Column + gap-1 + the direction alignment reproduce
    // exactly what ChatMessage's own children wrapper gave the bubble and its
    // metadata as siblings, so inserting it changes no spacing.
    <div
      className={cn(
        'group/row relative flex w-full min-w-0 flex-col gap-1',
        isOutbound ? 'items-end' : 'items-start',
        // Above the neighbouring rows so the scrim below covers them.
        isPressMenu && 'z-40',
      )}
    >
      {isPressMenu ? (
        // Behind everything in this row (negative z-index inside the row's own
        // stacking context) and over everything outside it, so the held message
        // and its footer stay sharp while the thread recedes.
        // Lighter than the dialog scrim it derives from: the blur is already
        // doing most of the separating, and the thread behind should still
        // read as the place you are, not as a dismissed layer.
        <span
          aria-hidden
          className="bg-overlay/60 fixed inset-0 -z-10 backdrop-blur-md"
        />
      ) : null}
      <ChatMessageBubble
        id={`message-${message.id}`}
        data-message-id={message.id}
        variant={isGhost ? 'ghost' : 'filled'}
        group={group}
        {...longPress}
        className={cn(
          // Positioning context for the action trigger.
          'relative',
          // Press-and-hold is the touch path into the menu, and it cannot
          // survive the platform's own text-selection gesture on the same
          // press — so on touch the bubble is not selectable and the menu
          // carries Copy instead.
          '[@media(hover:none)]:[-webkit-touch-callout:none] [@media(hover:none)]:select-none',
          // A failed send is stated on the bubble itself, not only in the caption
          // below it: the caption sits between two messages and a 1px ring on a
          // 10%-alpha plate is not a signal anyone reads at a glance.
          hasFailed && 'bg-error/12 ring-error/70 ring-1',
        )}
        metadata={
          showFooter ? (
            // Timestamp lives inside our own footer (not astryx's `timestamp`
            // slot) so we own the separator and only draw it before real content.
            <ChatMessageMetadata
              footer={
                // One caption row, never two. A second line pushed the failure
                // notice closer to the next message than to its own bubble.
                <span
                  className={cn(
                    'flex flex-wrap items-center gap-x-1 gap-y-0.5',
                    isOutbound ? 'justify-end' : 'justify-start',
                  )}
                >
                  <span>{formatTime(message.created_at)}</span>
                  {/* Inherits the footer colour instead of dimming to
                    `text-primary/30`, which composited to 1.96:1 on the light
                    page: a separator you cannot see does not separate. */}
                  {hasTrailingMeta ? <span aria-hidden>·</span> : null}
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
                  {hasFailed ? (
                    <>
                      <span
                        role="status"
                        className="text-error flex items-center gap-1"
                      >
                        <TriangleAlertIcon
                          className="size-3 shrink-0"
                          aria-hidden
                        />
                        <span>{m.inbox_message_status_failed()}</span>
                      </span>
                      <Button
                        label={m.inbox_message_retry()}
                        size="sm"
                        variant="ghost"
                        onClick={handleRetry}
                        isDisabled={retryMessage.isPending}
                        isLoading={retryMessage.isPending}
                        // Caption scale so the remedy sits beside the problem
                        // rather than out-shouting it at body size — but with
                        // real padding, since 10px of text is not a hit target.
                        // The pseudo-element grows that target on touch without
                        // widening the caption row.
                        className="text-error hover:bg-error/10 relative h-auto min-h-0 rounded-sm px-1.5 py-1 text-sm font-medium underline underline-offset-2 [@media(hover:none)]:after:absolute [@media(hover:none)]:after:-inset-2 [@media(hover:none)]:after:content-['']"
                      />
                    </>
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
          <p className="text-sm italic opacity-70">
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
        (type === 'share' ||
          type === 'story_reply' ||
          type === 'story_mention') ? (
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
            attachment.storage_path &&
            attachment.download_status === 'stored' ? (
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
              <p key={attachment.id} className="mt-1 text-sm opacity-70">
                {m.inbox_attachment_failed()}
              </p>
            ),
          )}
        {showStickerPlaceholder ? (
          <p className={cn('text-sm opacity-80', hasContent && 'mb-1')}>
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

        {showReactionPicker && (
          <ReactionPicker
            isOutbound={isOutbound}
            messageId={message.id}
            currentEmoji={currentOutboundReaction(reactions)}
            supportedEmoji={supportedReactionEmoji}
            // A pending mutation disables only this message's control; the rest
            // of the transcript stays reactive.
            isDisabled={
              reactionAvailability.status === 'blocked' || isReactionPending
            }
            disabledReason={
              reactionAvailability.status === 'blocked'
                ? reactionBlockedCopy(reactionAvailability.reason)
                : null
            }
            isTabStop={isTabStop}
            anchor={actionAnchor}
            isOpen={isPickerOpen}
            onOpenChange={setIsPickerOpen}
            onSelect={(emoji) => onReact(message, emoji)}
          />
        )}

        {/* Last child so assistive tech reads the message before its actions,
          even though the trigger is painted beside the bubble's first line. */}
        {actionItems.length > 0 && (
          <MessageActionMenu
            isOutbound={isOutbound}
            messageId={message.id}
            isTabStop={isTabStop}
            anchor={actionAnchor}
            slot={showReactionPicker ? 'outer' : 'inner'}
            items={actionItems}
            isOpen={isMenuOpen}
            onOpenChange={handleMenuOpenChange}
          />
        )}
      </ChatMessageBubble>
    </div>
  )
})

/**
 * Why the reaction control is disabled, in words. A disabled control that does
 * not say why reads as a bug; each of these resolves on its own, so the
 * sentence is also the instruction.
 */
function reactionBlockedCopy(reason: ReactionBlockedReason): string {
  switch (reason) {
    case 'message_deleted':
      return m.inbox_reaction_unavailable_deleted()
    case 'missing_provider_id':
      return m.inbox_reaction_unavailable_pending()
    case 'channel_disconnected':
      return m.inbox_reaction_unavailable_channel()
  }
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
  const contacts = parseSharedContacts(message.metadata)
  if (contacts.length === 0) {
    return <TypeFallback type="contact" />
  }
  return (
    <MessageContactCard
      contacts={contacts}
      isOutbound={isOutbound}
      workspaceId={message.workspace_id}
    />
  )
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
  return (
    <MessageInteractive interactive={interactive} isOutbound={isOutbound} />
  )
}

function TypeFallback({ type }: { type: MessageType }) {
  return <p className="text-sm opacity-80">{getMediaPlaceholder(type)}</p>
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
