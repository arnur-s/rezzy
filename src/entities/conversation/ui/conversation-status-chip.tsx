import { Badge } from '@astryxdesign/core/Badge'
import type { BadgeProps } from '@astryxdesign/core/Badge'
import { CONVERSATION_STATUS_META } from '../lib/conversation-status-meta'
import type { ConversationStatus } from '../model/types'

type Props = {
  status: ConversationStatus
  className?: string
}

/** Maps the semantic status color to an Astryx Badge variant. */
const VARIANT_BY_COLOR: Record<
  (typeof CONVERSATION_STATUS_META)[ConversationStatus]['color'],
  BadgeProps['variant']
> = {
  accent: 'info',
  warning: 'warning',
  success: 'success',
  danger: 'error',
  default: 'neutral',
}

export function ConversationStatusChip({ status, className }: Props) {
  const meta = CONVERSATION_STATUS_META[status]

  return (
    <span className={className}>
      <Badge variant={VARIANT_BY_COLOR[meta.color]} label={meta.labelKey()} />
    </span>
  )
}
