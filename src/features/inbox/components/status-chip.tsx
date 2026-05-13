import { Chip } from '@heroui/react'
import type { ConversationStatus } from '../types'
import { STATUS_META } from '../utils/status-meta'

type Props = {
  status: ConversationStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function StatusChip({ status, size = 'sm', className }: Props) {
  const meta = STATUS_META[status]

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
