import { Badge } from '@astryxdesign/core/Badge'
import type { BadgeProps } from '@astryxdesign/core/Badge'
import { CONTACT_STATUS_META } from '../lib/contact-status-meta'
import type { ContactStatus } from '../model/types'

type Props = {
  status: ContactStatus
  className?: string
}

/** Maps the semantic status color to an Astryx Badge variant. */
const VARIANT_BY_COLOR: Record<
  (typeof CONTACT_STATUS_META)[ContactStatus]['color'],
  BadgeProps['variant']
> = {
  accent: 'info',
  warning: 'warning',
  success: 'success',
  danger: 'error',
  default: 'neutral',
}

/**
 * The status is carried by the label text, not by the plate colour alone —
 * colour is a second channel here, never the only one.
 */
export function ContactStatusChip({ status, className }: Props) {
  const meta = CONTACT_STATUS_META[status]

  return (
    <span className={className}>
      <Badge variant={VARIANT_BY_COLOR[meta.color]} label={meta.labelKey()} />
    </span>
  )
}
