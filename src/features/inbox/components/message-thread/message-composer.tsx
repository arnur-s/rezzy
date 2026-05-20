import type { ChannelType } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { Typography, toast } from '@heroui/react'

import { useSendMessage } from '../../hooks/use-messages'
import { ChatInput } from './chat-input'

type Props = {
  workspaceId: string
  conversationId: string
  channelType: ChannelType
  channelLabel: string
  senderId: string | null
  isDisabled?: boolean
}

export function MessageComposer({
  workspaceId,
  conversationId,
  channelType,
  channelLabel,
  senderId,
  isDisabled = false,
}: Props) {
  const sendMessage = useSendMessage({ workspaceId })

  function handleSend(text: string, file: File | null) {
    if (sendMessage.isPending) return
    sendMessage.mutate(
      { conversationId, content: text, file, senderId, channelType },
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
    <div className="border-t border-border/60 px-4 py-3 sm:px-6">
      <Typography.Paragraph size="xs" className="mb-2 text-muted-foreground">
        {m.inbox_composer_reply_via({ channel: channelLabel })}
      </Typography.Paragraph>
      <ChatInput
        onSend={handleSend}
        disabled={isDisabled || sendMessage.isPending}
        placeholder={m.inbox_composer_placeholder()}
      />
    </div>
  )
}
