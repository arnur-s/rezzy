import { Chip } from '@heroui/react'
import { CONVERSATION_STATUS_META } from '../lib/conversation-status-meta'
import type { ConversationStatus } from '../model/types'

type Props = {
  status: ConversationStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ConversationStatusChip({
  status,
  size = 'sm',
  className,
}: Props) {
  const meta = CONVERSATION_STATUS_META[status]

  return (
    <Chip
      className={className}
      color={meta.color}
      size={size}
      variant="soft"
    >
      <Chip.Label>{meta.labelKey()}</Chip.Label>
    </Chip>
  )
}
