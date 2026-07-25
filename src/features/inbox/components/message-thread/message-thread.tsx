import type { ChannelType } from '@/entities/channel'
import { PLATFORM_META, isChannelType } from '@/entities/channel'
import type { ConversationWithRelations } from '@/entities/conversation'
import type { MessageRow } from '@/entities/message'
import { m } from '@/paraglide/messages'
import { ChatLayout } from '@astryxdesign/core/Chat'
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
import { getFirstUnreadInboundMessageId } from '../../utils/read-cursor'
import { MessageComposer } from './message-composer'
import { MessageList } from './message-list'
import { MessageThreadProvider } from './message-thread-context'
import { MessageThreadHeader } from './message-thread-header'
import { ThreadScrollButton } from './thread-scroll-button'

const MARK_READ_DEBOUNCE_MS = 280
const MAX_UNREAD_PREFETCH_PAGES = 5

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

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden">
      <MessageThreadHeader
        conversation={conversation}
        workspaceId={workspaceId}
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
          threads resets scroll state. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <MessageThreadProvider
          value={{
            channelType: channelTypeResolved,
            reactionsByMessageId,
            onReplyToMessage: setReplyTo,
          }}
        >
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
