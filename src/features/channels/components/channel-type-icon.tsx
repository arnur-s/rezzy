import { cn } from '@heroui/styles'
import { CHANNEL_META } from '../utils/channel-meta'
import type { ChannelType } from '../types'

type Props = {
  type: ChannelType
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASSES: Record<NonNullable<Props['size']>, string> = {
  sm: 'size-8 [&>svg]:size-4',
  md: 'size-10 [&>svg]:size-5',
  lg: 'size-12 [&>svg]:size-6',
}

export function ChannelTypeIcon({ type, size = 'md', className }: Props) {
  const meta = CHANNEL_META[type]
  const Icon = meta.icon

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl',
        meta.iconBackgroundClassName,
        SIZE_CLASSES[size],
        className,
      )}
    >
      <Icon className={meta.iconClassName} />
    </span>
  )
}
