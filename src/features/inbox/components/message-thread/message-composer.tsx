import type { ChannelType } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { toast } from '@heroui/react'

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

  function handleSend(text: string) {
    if (sendMessage.isPending) return
    sendMessage.mutate(
      { conversationId, content: text, senderId, channelType },
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
      <p className="mb-2 text-[11px] text-foreground/55">
        {m.inbox_composer_reply_via({ channel: channelLabel })}
      </p>
      <ChatInput
        onSend={handleSend}
        onAttach={() => {}}
        disabled={isDisabled || sendMessage.isPending}
        placeholder={m.inbox_composer_placeholder()}
      />
    </div>
  )
}
