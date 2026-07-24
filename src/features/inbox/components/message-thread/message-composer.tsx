import type { ChannelType } from '@/entities/channel'
import type { MessageRow } from '@/entities/message'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { m } from '@/paraglide/messages'
import { paneStyle } from '@/components/pane'
import { Button, Typography, toast } from '@heroui/react'
import { cn } from '@heroui/styles'
import { XIcon } from 'lucide-react'

import { TRANSCRIPT_MEASURE } from './transcript-measure'

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
    <div className={cn(TRANSCRIPT_MEASURE, 'shrink-0 px-4 pt-3 pb-4 sm:px-6')}>
      {/* A deliberate work surface, not a strip on the pane edge. It owns the
          focus indication for the textarea inside it. */}
      <div
        className={cn(
          paneStyle.raised,
          'focus-within:ring-focus/40 p-2 transition-shadow focus-within:ring-2 motion-reduce:transition-none',
        )}
      >
        {replyTo ? (
          <div className="border-border/60 bg-foreground/5 mb-2 flex items-center gap-2 rounded-lg border px-3 py-1.5">
            <div className="flex min-w-0 flex-1 flex-col text-xs">
              <span className="text-foreground/80 font-medium">
                {m.inbox_reply_to({ name: replyAuthor ?? '' })}
              </span>
              {replyPreview ? (
                <span className="text-foreground/60 truncate">
                  {replyPreview}
                </span>
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
      </div>

      <Typography.Paragraph
        size="xs"
        className="text-muted mt-2 px-1 text-center"
      >
        {m.inbox_composer_reply_via({ channel: channelLabel })}
      </Typography.Paragraph>
    </div>
  )
}
