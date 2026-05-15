import {
  PLATFORM_META,
  isChannelType,
} from '@/entities/channel'
import type { ChannelType } from '@/entities/channel'
import type { ConversationWithRelations } from '@/entities/conversation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getConversationInitialScrollTarget } from '../../api/read-cursors'
import {
  useConversationReadCursor,
  useMarkConversationReadToMessage,
  useMessages,
} from '../../hooks/use-messages'
import { useMessagesRealtime } from '../../hooks/use-messages-realtime'
import type { InitialScrollTarget } from '../../utils/read-cursor'
import { getFirstUnreadInboundMessageId } from '../../utils/read-cursor'
import { MessageComposer } from './message-composer'
import { MessageList } from './message-list'
import { MessageThreadEmpty } from './message-thread-empty'
import { MessageThreadHeader } from './message-thread-header'

const MARK_READ_DEBOUNCE_MS = 280

type Props = {
  workspaceId: string
  conversation: ConversationWithRelations | null
  senderId: string | null
  onToggleContactPanel: () => void
  onBack?: () => void
}

export function MessageThread({
  workspaceId,
  conversation,
  senderId,
  onToggleContactPanel,
  onBack,
}: Props) {
  const conversationId = conversation?.id ?? null
  const unreadCount = conversation?.unread_count ?? 0
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
  const messages = messagesQuery.data ?? []
  const isReadCursorLoading = !!senderId && readCursorQuery.isPending
  const initialScrollTarget = useMemo<InitialScrollTarget>(
    () => getConversationInitialScrollTarget({ messages }),
    [messages],
  )
  const readCursor = readCursorQuery.data ?? null
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
      !messages.some((m) => m.id === sessionUnreadDividerMessageId)
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

  if (!conversation) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <MessageThreadEmpty />
      </div>
    )
  }

  const channelTypeResolved: ChannelType = isChannelType(
    conversation.channel.type,
  )
    ? conversation.channel.type
    : 'email'
  const channelLabel = isChannelType(conversation.channel.type)
    ? PLATFORM_META[conversation.channel.type].labelKey()
    : conversation.channel.name?.trim() || ''
  const contactName = conversation.contact.name?.trim() || '—'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessageThreadHeader
        conversation={conversation}
        onToggleContactPanel={onToggleContactPanel}
        onBack={onBack}
      />
      <MessageList
        conversationId={conversation.id}
        messages={messagesQuery.data}
        isLoading={messagesQuery.isPending || isReadCursorLoading}
        isError={messagesQuery.isError || readCursorQuery.isError}
        contactName={contactName}
        currentUserId={senderId}
        initialScrollTarget={initialScrollTarget}
        unreadDividerMessageId={unreadDividerMessageId}
        hasUnreadInboundMessages={hasUnreadInboundMessages}
        onReadAnchorVisible={handleReadAnchorVisible}
      />
      <MessageComposer
        workspaceId={workspaceId}
        conversationId={conversation.id}
        channelType={channelTypeResolved}
        channelLabel={channelLabel}
        senderId={senderId}
      />
    </div>
  )
}
