import type { ChannelType } from '@/entities/channel'
import {
  PLATFORM_META,
  getReactionCapabilities,
  isChannelType,
} from '@/entities/channel'
import type { ConversationWithRelations } from '@/entities/conversation'
import type { MessageRow } from '@/entities/message'
import { m } from '@/paraglide/messages'
import { ChatLayout } from '@astryxdesign/core/Chat'
import { useToast } from '@astryxdesign/core/Toast'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useConversationReadCursor,
  useMarkConversationReadToMessage,
  useMessages,
} from '../../hooks/use-messages'
import { useMessagesRealtime } from '../../hooks/use-messages-realtime'
import {
  useConversationReactions,
  useReactionsRealtime,
} from '../../hooks/use-reactions'
import { useSendReaction } from '../../hooks/use-send-reaction'
import { isPresentableError } from '../../utils/presentable-error'
import { getFirstUnreadInboundMessageId } from '../../utils/read-cursor'
import { MessageComposer } from './message-composer'
import { MessageList } from './message-list'
import type { MessageThreadContextValue } from './message-thread-context'
import { MessageThreadProvider } from './message-thread-context'
import { MessageThreadHeader } from './message-thread-header'
import { ThreadScrollButton } from './thread-scroll-button'

const MARK_READ_DEBOUNCE_MS = 280
const MAX_UNREAD_PREFETCH_PAGES = 5

/**
 * A static tonal wash behind the transcript, replacing the WebGL ray canvas
 * this pane used to carry.
 *
 * `--color-accent` is the far end of the neutral ramp and inverts by mode
 * (`#25252a` light / `#f3f3f5` dark), so one declaration reads as the pane
 * deepening toward the corner in light and as light entering the corner in
 * dark. No hue, no `dark:` variant, no `light-dark()`.
 *
 * The peak is 5.5%, chosen so the hottest point lands on a tone the system
 * already owns: measured `#f3f3f3` on the white pane, which is the body canvas
 * (T96 `#f3f3f5`) the shell floats its panes on. The pane's corner meets the
 * app's own canvas tone and goes no further. In dark it measures `#272729`,
 * one step up the ramp from the `#1b1b1f` pane.
 *
 * It does not need to stay under `--color-neutral` (the 6% / 10% bubble fill),
 * which was the obvious worry and is not real: that token is an *alpha* fill,
 * so a bubble composites over the wash rather than over the bare pane and the
 * wash darkens figure and ground together. Measured in the browser, the bubble
 * edge is 1.12:1 over the wash's peak and 1.12:1 over a bare pane — unchanged.
 * The ceiling here is legibility of the transcript, not the bubble edge.
 *
 * A wide, shallow ellipse anchored off-canvas at the corner (120% × 85%) rather
 * than a circle: it rakes across the pane the way the fan did at this width,
 * instead of reading as a centered blob. Written as an inline style rather than
 * an arbitrary Tailwind value because the `color-mix()` and the stop geometry
 * are unreadable once escaped, and deliberately not in `src/styles.css` — see
 * the standing rule against adding a background there.
 */
const THREAD_WASH =
  'radial-gradient(120% 85% at 100% 0%, color-mix(in oklab, var(--color-accent) 5.5%, transparent) 0%, transparent 62%)'

type Props = {
  workspaceId: string
  conversation: ConversationWithRelations
  senderId: string | null
  onToggleContactPanel: () => void
  onBack?: () => void
  scrollToLatestNonce?: number
}

export function MessageThread({
  workspaceId,
  conversation,
  senderId,
  onToggleContactPanel,
  onBack,
  scrollToLatestNonce = 0,
}: Props) {
  const conversationId = conversation.id
  const unreadCount = conversation.unread_count
  const showToast = useToast()
  const messagesQuery = useMessages(conversationId)
  const readCursorQuery = useConversationReadCursor({
    conversationId,
    userId: senderId,
  })
  const markRead = useMarkConversationReadToMessage({
    workspaceId,
    userId: senderId,
  })
  useMessagesRealtime({
    conversationId,
    workspaceId,
  })
  const { reactionsByMessageId } = useConversationReactions(conversationId)
  useReactionsRealtime(conversationId)
  const { sendReaction, isMessagePending } = useSendReaction({
    conversationId,
    workspaceId,
    channelId: conversation.channel.id,
  })
  const messages = messagesQuery.messages

  /** Reply composition target; cleared on send, cancel, or thread switch. */
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null)

  useEffect(() => {
    setReplyTo(null)
  }, [conversationId])
  const isReadCursorLoading = !!senderId && readCursorQuery.isPending
  const unreadPrefetchPagesRef = useRef(0)

  useEffect(() => {
    unreadPrefetchPagesRef.current = 0
  }, [conversationId])

  const readCursor = readCursorQuery.data ?? null

  useEffect(() => {
    if (messagesQuery.isPending || readCursorQuery.isPending) return
    if (unreadCount <= 0) return

    const readId = readCursor?.last_read_message_id
    if (!readId) return
    if (messages.some((msg) => msg.id === readId)) return
    if (!messagesQuery.hasNextPage) return
    if (messagesQuery.isFetchingNextPage) return
    if (unreadPrefetchPagesRef.current >= MAX_UNREAD_PREFETCH_PAGES) return

    unreadPrefetchPagesRef.current += 1
    void messagesQuery.fetchNextPage()
  }, [
    messages,
    messagesQuery.fetchNextPage,
    messagesQuery.hasNextPage,
    messagesQuery.isFetchingNextPage,
    messagesQuery.isPending,
    readCursor?.last_read_message_id,
    readCursorQuery.isPending,
    unreadCount,
  ])

  const handleLoadOlder = useCallback(() => {
    if (!messagesQuery.hasNextPage || messagesQuery.isFetchingNextPage) {
      return Promise.resolve()
    }
    return messagesQuery.fetchNextPage()
  }, [
    messagesQuery.fetchNextPage,
    messagesQuery.hasNextPage,
    messagesQuery.isFetchingNextPage,
  ])

  const handleRetryMessages = useCallback(() => {
    void messagesQuery.refetch()
    if (readCursorQuery.isError) {
      void readCursorQuery.refetch()
    }
  }, [messagesQuery.refetch, readCursorQuery.refetch, readCursorQuery.isError])

  const liveUnreadDividerMessageId = useMemo(
    () =>
      getFirstUnreadInboundMessageId({
        messages,
        lastReadMessageId: readCursor?.last_read_message_id ?? null,
        lastReadAt: readCursor?.last_read_at ?? null,
        unreadCount,
      }),
    [messages, readCursor, unreadCount],
  )

  /** WhatsApp-style: keep divider in transcript until leaving this conversation. */
  const [sessionUnreadDividerMessageId, setSessionUnreadDividerMessageId] =
    useState<string | null>(null)

  useEffect(() => {
    setSessionUnreadDividerMessageId(null)
  }, [conversationId])

  useEffect(() => {
    if (
      liveUnreadDividerMessageId != null &&
      sessionUnreadDividerMessageId == null
    ) {
      setSessionUnreadDividerMessageId(liveUnreadDividerMessageId)
    }
  }, [liveUnreadDividerMessageId, sessionUnreadDividerMessageId])

  useEffect(() => {
    if (
      sessionUnreadDividerMessageId != null &&
      !messages.some((msg) => msg.id === sessionUnreadDividerMessageId)
    ) {
      setSessionUnreadDividerMessageId(null)
    }
  }, [messages, sessionUnreadDividerMessageId])

  const unreadDividerMessageId =
    sessionUnreadDividerMessageId != null
      ? sessionUnreadDividerMessageId
      : liveUnreadDividerMessageId

  const hasUnreadInboundMessages = liveUnreadDividerMessageId != null

  const markReadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (markReadDebounceRef.current) {
        clearTimeout(markReadDebounceRef.current)
      }
    }
  }, [])

  const handleReadAnchorVisible = useCallback(
    (lastReadMessageId: string) => {
      if (!senderId || !conversationId) return
      if (markReadDebounceRef.current) {
        clearTimeout(markReadDebounceRef.current)
      }
      markReadDebounceRef.current = setTimeout(() => {
        markReadDebounceRef.current = null
        markRead.mutate({
          conversationId,
          lastReadMessageId,
        })
      }, MARK_READ_DEBOUNCE_MS)
    },
    [conversationId, markRead, senderId],
  )

  const channelTypeResolved: ChannelType = isChannelType(
    conversation.channel.type,
  )
    ? conversation.channel.type
    : 'email'
  const channelLabel = isChannelType(conversation.channel.type)
    ? PLATFORM_META[conversation.channel.type].labelKey()
    : conversation.channel.name?.trim() || ''
  // Empty (not an em-dash) so downstream copy can read naturally without a
  // name, and avatars fall back to their neutral icon rather than a dash.
  const contactName = conversation.contact.name?.trim() || ''

  const messagesById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  )

  // Absent means the query did not ask for it, not that the channel is down —
  // see ConversationWithRelations.
  const isChannelActive = conversation.channel.is_active !== false
  const canSendReactions = getReactionCapabilities(channelTypeResolved).canSend

  const handleReactToMessage = useCallback(
    (message: MessageRow, emoji: string) => {
      // Success is silent by design: the chip under the bubble is the whole
      // feedback. Only the failure — an action the agent took and did not
      // get — is worth a word.
      void sendReaction({ message, selectedEmoji: emoji }).catch((error) => {
        showToast({
          body: isPresentableError(error)
            ? error.message
            : m.inbox_reaction_error_generic(),
          type: 'error',
        })
      })
    },
    [sendReaction, showToast],
  )

  // Memoized: every bubble consumes this context, so an inline object would
  // re-render the whole transcript on each parent render.
  const threadContext = useMemo<MessageThreadContextValue>(
    () => ({
      channelType: channelTypeResolved,
      contactName,
      isChannelActive,
      reactionsByMessageId,
      messagesById,
      onReplyToMessage: setReplyTo,
      onReactToMessage: canSendReactions ? handleReactToMessage : null,
      isReactionPending: isMessagePending,
    }),
    [
      channelTypeResolved,
      contactName,
      isChannelActive,
      reactionsByMessageId,
      messagesById,
      canSendReactions,
      handleReactToMessage,
      isMessagePending,
    ],
  )

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden">
      <MessageThreadHeader
        conversation={conversation}
        workspaceId={workspaceId}
        currentUserId={senderId}
        onToggleContactPanel={onToggleContactPanel}
        onBack={onBack}
      />
      {hasUnreadInboundMessages ? (
        <p role="status" className="sr-only">
          {m.inbox_unread_aria_label({ count: unreadCount })}
        </p>
      ) : null}
      {/* ChatLayout owns the scroll container, follow-on-append, and the
          scroll-to-bottom button; it is keyed by conversation so switching
          threads resets scroll state.

          The wash is painted on this wrapper rather than on a sibling element,
          so it needs no stacking context: the transcript is its child and
          paints over it by document order. It also stays put while the
          transcript scroll, which is what the WebGL canvas it replaces did. */}
      <div
        className="relative flex min-h-0 flex-1 flex-col"
        style={{ backgroundImage: THREAD_WASH }}
      >
        <MessageThreadProvider value={threadContext}>
          <ChatLayout
            key={conversation.id}
            scrollButton={
              <ThreadScrollButton messages={messages} currentUserId={senderId} />
            }
            composer={
              <MessageComposer
                workspaceId={workspaceId}
                conversationId={conversation.id}
                channelType={channelTypeResolved}
                channelLabel={channelLabel}
                senderId={senderId}
                replyTo={replyTo}
                contactName={contactName}
                onCancelReply={() => setReplyTo(null)}
              />
            }
          >
            <MessageList
              conversationId={conversation.id}
              messages={messages}
              isLoading={messagesQuery.isPending || isReadCursorLoading}
              isError={messagesQuery.isError || readCursorQuery.isError}
              contactName={contactName}
              contactAvatarUrl={conversation.contact.avatar_url ?? undefined}
              currentUserId={senderId}
              unreadDividerMessageId={unreadDividerMessageId}
              hasUnreadInboundMessages={hasUnreadInboundMessages}
              onReadAnchorVisible={handleReadAnchorVisible}
              hasMoreOlder={messagesQuery.hasNextPage}
              isFetchingOlder={messagesQuery.isFetchingNextPage}
              onLoadOlder={handleLoadOlder}
              scrollToLatestNonce={scrollToLatestNonce}
              onRetry={handleRetryMessages}
              isRetrying={
                messagesQuery.isFetching && !messagesQuery.isFetchingNextPage
              }
            />
          </ChatLayout>
        </MessageThreadProvider>
      </div>
    </div>
  )
}
