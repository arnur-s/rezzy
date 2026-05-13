import { useMessages } from '../../hooks/use-messages'
import { useMessagesRealtime } from '../../hooks/use-messages-realtime'
import type { ChannelType, ConversationWithRelations } from '../../types'
import { isChannelType } from '../../types'
import { PLATFORM_META } from '../../utils/platform'
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
  const messagesQuery = useMessages(conversation?.id ?? null)
  useMessagesRealtime({
    conversationId: conversation?.id ?? null,
    workspaceId,
  })

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
        messages={messagesQuery.data}
        isLoading={messagesQuery.isPending}
        isError={messagesQuery.isError}
        contactName={contactName}
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
