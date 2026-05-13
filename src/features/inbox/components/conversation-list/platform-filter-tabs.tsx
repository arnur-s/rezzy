import { m } from '@/paraglide/messages'
import { cn } from '@heroui/styles'
import { useMemo } from 'react'
import type { ChannelType } from '../../types'
import { CHANNEL_TYPES } from '../../types'
import { PlatformIcon } from '../platform-icon'

export type PlatformFilter = ChannelType | 'all'

type Props = {
  value: PlatformFilter
  onChange: (filter: PlatformFilter) => void
  /** Map of channel type -> unread count. 'all' key holds the workspace total. */
  unreadCounts: Record<PlatformFilter, number>
}

export function PlatformFilterTabs({ value, onChange, unreadCounts }: Props) {
  const items = useMemo<
    Array<{ id: PlatformFilter; label: string; icon: ChannelType | null }>
  >(
    () => [
      { id: 'all', label: m.inbox_filter_all(), icon: null },
      ...CHANNEL_TYPES.map((type) => ({
        id: type,
        label: m[`inbox_filter_${type}`](),
        icon: type,
      })),
    ],
    [],
  )

  return (
    <div
      role="tablist"
      aria-label={m.inbox_filter_aria_label()}
      className="flex gap-1 overflow-x-auto px-3 pb-2 pt-3"
    >
      {items.map((item) => {
        const isActive = value === item.id
        const count = unreadCounts[item.id]
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors outline-none',
              'focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-foreground text-background'
                : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground',
            )}
          >
            {item.icon ? <PlatformIcon type={item.icon} size="sm" /> : null}
            <span>{item.label}</span>
            {count > 0 ? (
              <span
                aria-label={m.inbox_unread_aria_label({ count })}
                className={cn(
                  'inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4',
                  isActive
                    ? 'text-background'
                    : 'bg-accent text-accent-foreground',
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
