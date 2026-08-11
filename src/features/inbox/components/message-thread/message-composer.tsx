import type { ChannelType } from '@/entities/channel'
import type { MessageRow } from '@/entities/message'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { m } from '@/paraglide/messages'
import { IconButton } from '@astryxdesign/core/IconButton'
import { useToast } from '@astryxdesign/core/Toast'
import { WifiOffIcon, XIcon } from 'lucide-react'

import { TRANSCRIPT_MEASURE } from './transcript-measure'

import { cn } from '@/lib/cn'
import { useSendMessage } from '../../hooks/use-messages'
import { listPreviewFromMessage } from '../../schemas/message-metadata'
import { CHANNEL_CAPABILITIES } from '../../utils/channel-capabilities'
import { isPresentableError } from '../../utils/presentable-error'
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
  const showToast = useToast()
  const isMobile = useIsMobile()
  const isOnline = useOnlineStatus()

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
          // Only show errors that were phrased for a person; anything else
          // (raw Postgres, network noise) gets curated copy, logged raw.
          if (!isPresentableError(error)) {
            console.error('Failed to send message', error)
          }
          showToast({
            body: isPresentableError(error)
              ? error.message
              : m.inbox_composer_send_error(),
            type: 'error',
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
    <div className={cn(TRANSCRIPT_MEASURE, 'shrink-0')}>
      <ChatInput
        onSend={handleSend}
        disabled={isDisabled || sendMessage.isPending}
        blockSend={!isOnline}
        draftKey={conversationId}
        onCancelReply={onCancelReply}
        placeholder={m.inbox_composer_placeholder({ channel: channelLabel })}
        autoFocusKey={isMobile ? undefined : conversationId}
        acceptedMimeTypes={acceptedMimeTypes}
        drawer={
          !isOnline || replyTo ? (
            <>
              {!isOnline ? (
                <span
                  role="status"
                  className="text-secondary flex items-center gap-2 text-sm"
                >
                  <WifiOffIcon className="size-3.5 shrink-0" aria-hidden />
                  <span>{m.inbox_composer_offline_notice()}</span>
                </span>
              ) : null}
              {replyTo ? (
                // Same quote grammar as the sent bubble — a rule, not a plate.
                // The drawer already sits inside the composer surface, so a
                // bordered box here is a box inside a box.
                <span className="border-primary/30 flex items-center gap-2 border-l-2 py-px pl-2">
                  <span className="flex min-w-0 flex-1 flex-col gap-px text-sm">
                    <span className="text-primary/90 font-semibold">
                      {m.inbox_reply_to({ name: replyAuthor ?? '' })}
                    </span>
                    {replyPreview ? (
                      <span className="text-primary/60 truncate">
                        {replyPreview}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0">
                    <IconButton
                      size="sm"
                      variant="ghost"
                      label={m.inbox_reply_cancel()}
                      onClick={() => onCancelReply?.()}
                      icon={<XIcon className="size-3.5" aria-hidden />}
                    />
                  </span>
                </span>
              ) : null}
            </>
          ) : undefined
        }
      />
    </div>
  )
}
