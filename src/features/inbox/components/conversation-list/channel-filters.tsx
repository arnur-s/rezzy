import {
  CHANNEL_TYPES,
  PlatformIcon,
  isChannelType,
} from '@/entities/channel'
import type { Channel, ChannelType } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { cn } from '@heroui/styles'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

type Props = {
  channelTypeFilter: ChannelType | null
  channelIdFilter: string | null
  channels: Array<Channel>
  channelUnreadCounts: Record<string, number>
  onChannelTypeFilterChange: (type: ChannelType | null) => void
  onChannelIdFilterChange: (id: string | null) => void
}

export function ChannelFilters({
  channelTypeFilter,
  channelIdFilter,
  channels,
  channelUnreadCounts,
  onChannelTypeFilterChange,
  onChannelIdFilterChange,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false)

  const channelsByType = useMemo(() => {
    const map = new Map<ChannelType, Array<Channel>>()
    for (const ch of channels) {
      if (ch.is_active && isChannelType(ch.type)) {
        const list = map.get(ch.type) ?? []
        list.push(ch)
        map.set(ch.type, list)
      }
    }
    return map
  }, [channels])

  const activeTypes = CHANNEL_TYPES.filter((t) => channelsByType.has(t))

  const typeUnreadCounts = useMemo(() => {
    const counts: Partial<Record<ChannelType, number>> = {}
    for (const ch of channels) {
      if (!ch.is_active || !isChannelType(ch.type)) continue
      const count = channelUnreadCounts[ch.id] ?? 0
      if (count > 0) counts[ch.type] = (counts[ch.type] ?? 0) + count
    }
    return counts
  }, [channels, channelUnreadCounts])

  if (activeTypes.length === 0) return null

  function handleTypeClick(type: ChannelType) {
    if (channelTypeFilter === type) {
      onChannelTypeFilterChange(null)
      onChannelIdFilterChange(null)
    } else {
      onChannelTypeFilterChange(type)
      onChannelIdFilterChange(null)
    }
  }

  function handleChannelClick(ch: Channel) {
    if (channelIdFilter === ch.id) {
      onChannelIdFilterChange(null)
    } else {
      if (isChannelType(ch.type)) onChannelTypeFilterChange(ch.type)
      onChannelIdFilterChange(ch.id)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
        className={cn(
          'flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider outline-none transition-colors',
          'text-foreground/40 hover:text-foreground/70',
          'focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <span className="flex-1 text-left">
          {m.inbox_channels_section_label()}
        </span>
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>

      {isExpanded && (
        <ul className="mb-2 flex flex-col gap-0.5 px-2">
          {activeTypes.map((type) => {
            const typeChannels = channelsByType.get(type) ?? []
            const isTypeActive =
              channelTypeFilter === type && channelIdFilter === null
            const isTypeExpanded = channelTypeFilter === type
            const count = typeUnreadCounts[type] ?? 0

            return (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => handleTypeClick(type)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-ring',
                    isTypeActive
                      ? 'bg-foreground/10 text-foreground'
                      : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground',
                  )}
                >
                  <PlatformIcon type={type} size="sm" />
                  <span className="flex-1 truncate text-left">
                    {m[`inbox_filter_${type}`]()}
                  </span>
                  {count > 0 && (
                    <span
                      aria-label={m.inbox_unread_aria_label({ count })}
                      className={cn(
                        'inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4',
                        isTypeActive
                          ? 'text-foreground'
                          : 'bg-accent text-accent-foreground',
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>

                {isTypeExpanded && typeChannels.length >= 2 && (
                  <ul className="mt-0.5 flex flex-col gap-0.5">
                    {typeChannels.map((ch) => {
                      const chCount = channelUnreadCounts[ch.id] ?? 0
                      const isChActive = channelIdFilter === ch.id
                      return (
                        <li key={ch.id}>
                          <button
                            type="button"
                            onClick={() => handleChannelClick(ch)}
                            className={cn(
                              'flex w-full items-center gap-1.5 rounded-md py-1 pl-7 pr-3 text-xs font-medium outline-none transition-colors',
                              'focus-visible:ring-2 focus-visible:ring-ring',
                              isChActive
                                ? 'bg-foreground/10 text-foreground'
                                : 'text-foreground/50 hover:bg-foreground/5 hover:text-foreground',
                            )}
                          >
                            <span className="flex-1 truncate text-left">
                              {ch.name ?? ch.id.slice(0, 8)}
                            </span>
                            {chCount > 0 && (
                              <span
                                aria-label={m.inbox_unread_aria_label({
                                  count: chCount,
                                })}
                                className={cn(
                                  'inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4',
                                  isChActive
                                    ? 'text-foreground'
                                    : 'bg-accent text-accent-foreground',
                                )}
                              >
                                {chCount}
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
