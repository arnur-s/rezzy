import { Chip } from '@heroui/react'
import { cn } from '@heroui/styles'

type Props = {
  count: number
  'aria-label': string
  /** When the parent row or filter is active, use compact text styling. */
  flat?: boolean
  tone?: 'accent' | 'primary'
  /** When true, display `99+` for counts over 99. */
  capAt99?: boolean
}

export function NumericUnreadChip({
  count,
  'aria-label': ariaLabel,
  flat = false,
  tone = 'accent',
  capAt99 = false,
}: Props) {
  if (count <= 0) return null
  const text = capAt99 && count > 99 ? '99+' : String(count)

  if (flat) {
    return (
      <Chip
        size="sm"
        color="default"
        variant="tertiary"
        className="min-w-4 shrink-0 border-0 bg-transparent px-1 shadow-none ring-0"
        aria-label={ariaLabel}
      >
        <Chip.Label className="text-[10px] font-semibold leading-4 text-foreground tabular-nums">
          {text}
        </Chip.Label>
      </Chip>
    )
  }

  return (
    <Chip
      size="sm"
      color={tone === 'primary' ? 'default' : tone}
      variant="primary"
      className={cn('min-w-4 shrink-0 px-1', tone === 'primary' && 'min-h-6')}
      aria-label={ariaLabel}
    >
      <Chip.Label
        className={cn(
          'text-[10px] font-semibold leading-4 tabular-nums',
          tone === 'primary' && 'text-xs',
        )}
      >
        {text}
      </Chip.Label>
    </Chip>
  )
}
