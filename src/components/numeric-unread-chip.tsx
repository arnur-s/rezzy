import { Badge } from '@astryxdesign/core/Badge'

type Props = {
  count: number
  'aria-label': string
  tone?: 'accent' | 'primary'
  /** When true, display `99+` for counts over 99. */
  capAt99?: boolean
}

export function NumericUnreadChip({
  count,
  'aria-label': ariaLabel,
  tone = 'accent',
  capAt99 = false,
}: Props) {
  if (count <= 0) return null
  const text = capAt99 && count > 99 ? '99+' : String(count)

  return (
    <span role="status" aria-label={ariaLabel}>
      <Badge variant={tone === 'accent' ? 'info' : 'neutral'} label={text} />
    </span>
  )
}
