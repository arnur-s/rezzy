import type { ChannelType } from '@/entities/channel'
import type { MessageRow } from '@/entities/message'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { m } from '@/paraglide/messages'
import { Button, Typography, toast } from '@heroui/react'
import { XIcon } from 'lucide-react'

import { useSendMessage } from '../../hooks/use-messages'
import { listPreviewFromMessage } from '../../schemas/message-metadata'
import { CHANNEL_CAPABILITIES } from '../../utils/channel-capabilities'
import { ChatInput } from './chat-input'

type Props = {
  workspaceId: string
  conversationId: string
  channelType: ChannelType
  channelLabel: string
  senderId: string | null
  isDisabled?: boolean
  replyTo?: MessageRow | null
  contactName?: string
  onCancelReply?: () => void
}

export function MessageComposer({
  workspaceId,
  conversationId,
  channelType,
  channelLabel,
  senderId,
  isDisabled = false,
  replyTo = null,
  contactName = '',
  onCancelReply,
}: Props) {
  const sendMessage = useSendMessage({ workspaceId })
  const isMobile = useIsMobile()

  function handleSend(text: string, file: File | null) {
    if (sendMessage.isPending) return
    sendMessage.mutate(
      {
        conversationId,
        content: text,
        file,
        senderId,
        channelType,
        replyToMessageId: replyTo?.id ?? null,
      },
      {
        onError: (error) => {
          toast.danger(m.inbox_composer_send_error(), {
            description:
              error instanceof Error ? error.message : m.common_unknown_error(),
          })
        },
        onSuccess: () => {
          onCancelReply?.()
        },
      },
    )
  }

  const { acceptedMimeTypes } = CHANNEL_CAPABILITIES[channelType]
  const replyAuthor = replyTo
    ? replyTo.direction === 'outbound'
      ? m.inbox_reply_to_you()
      : contactName || m.inbox_reply_quoted_message()
    : null
  const replyPreview = replyTo ? listPreviewFromMessage(replyTo) : null

  return (
    <div className="container p-4 pb-0">
      {replyTo ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-accent bg-foreground/5 px-3 py-1.5">
          <div className="flex min-w-0 flex-1 flex-col text-xs">
            <span className="font-medium text-foreground/80">
              {m.inbox_reply_to({ name: replyAuthor ?? '' })}
            </span>
            {replyPreview ? (
              <span className="truncate text-foreground/60">{replyPreview}</span>
            ) : null}
          </div>
          <Button
            size="sm"
            variant="ghost"
            aria-label={m.inbox_reply_cancel()}
            onPress={() => onCancelReply?.()}
            className="h-6 min-w-0 shrink-0 px-1"
          >
            <XIcon className="size-3.5" aria-hidden />
          </Button>
        </div>
      ) : null}

      <ChatInput
        onSend={handleSend}
        disabled={isDisabled || sendMessage.isPending}
        placeholder={m.inbox_composer_placeholder()}
        autoFocusKey={isMobile ? undefined : conversationId}
        acceptedMimeTypes={acceptedMimeTypes}
      />

      <Typography.Paragraph size="xs" className="mb-2 text-muted">
        {m.inbox_composer_reply_via({ channel: channelLabel })}
      </Typography.Paragraph>
    </div>
  )
}
