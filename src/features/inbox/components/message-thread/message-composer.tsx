import { m } from '@/paraglide/messages'
import { Button, TextArea, toast } from '@heroui/react'
import { cn } from '@heroui/styles'
import { SendIcon } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useState } from 'react'

import { useSendMessage } from '../../hooks/use-messages'
import type { ChannelType } from '../../types'

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
  const [value, setValue] = useState('')
  const sendMessage = useSendMessage({ workspaceId })

  const trimmed = value.trim()
  const canSubmit = trimmed.length > 0 && !sendMessage.isPending && !isDisabled

  function handleSubmit() {
    if (!canSubmit) return
    sendMessage.mutate(
      { conversationId, content: trimmed, senderId, channelType },
      {
        onSuccess: () => setValue(''),
        onError: (error) => {
          toast.danger(m.inbox_composer_send_error(), {
            description:
              error instanceof Error ? error.message : m.common_unknown_error(),
          })
        },
      },
    )
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-border/60 px-4 py-3 sm:px-6">
      <p className="mb-2 text-[11px] text-foreground/55">
        {m.inbox_composer_reply_via({ channel: channelLabel })}
      </p>
      <div
        className={cn(
          'flex items-end gap-2 rounded-2xl border border-border/60 p-2 transition-colors',
          'focus-within:border-ring',
        )}
      >
        <TextArea
          aria-label={m.inbox_composer_placeholder()}
          placeholder={m.inbox_composer_placeholder()}
          className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent px-2 py-1 text-sm shadow-none focus:ring-0"
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
        />
        <Button
          size="sm"
          variant="primary"
          isIconOnly
          isDisabled={!canSubmit}
          isPending={sendMessage.isPending}
          onPress={handleSubmit}
          aria-label={m.inbox_composer_send_button()}
        >
          <SendIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
