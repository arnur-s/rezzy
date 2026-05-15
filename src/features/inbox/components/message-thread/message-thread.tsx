import {
  PLATFORM_META,
  isChannelType,
} from '@/entities/channel'
import type { ChannelType } from '@/entities/channel'
import type { ConversationWithRelations } from '@/entities/conversation'
import { useCallback, useMemo } from 'react'
import { getConversationInitialScrollTarget } from '../../api/read-cursors'
import {
  useConversationReadCursor,
  useMarkConversationReadToMessage,
  useMessages,
} from '../../hooks/use-messages'
import { useMessagesRealtime } from '../../hooks/use-messages-realtime'
import type { InitialScrollTarget } from '../../utils/read-cursor'
import { MessageComposer } from './message-composer'
import { MessageList } from './message-list'
import { MessageThreadEmpty } from './message-thread-empty'
import { MessageThreadHeader } from './message-thread-header'

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
    () =>
      getConversationInitialScrollTarget({
        messages,
        readCursor: readCursorQuery.data ?? null,
        unreadCount,
      }),
    [messages, readCursorQuery.data, unreadCount],
  )
  const latestMessageId = messages.at(-1)?.id ?? null
  const unreadDividerMessageId =
    initialScrollTarget.reason === 'first-unread'
      ? initialScrollTarget.messageId
      : null
  const readAnchorMessageId =
    unreadCount > 0 ? initialScrollTarget.messageId : null
  const markReadMessageId =
    unreadCount > 0 ? latestMessageId : null

  const handleReadAnchorVisible = useCallback(
    (lastReadMessageId: string) => {
      if (!senderId || !conversationId) return
      markRead.mutate({
        conversationId,
        lastReadMessageId,
      })
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
        initialScrollTarget={initialScrollTarget}
        unreadDividerMessageId={unreadDividerMessageId}
        readAnchorMessageId={readAnchorMessageId}
        markReadMessageId={markReadMessageId}
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
