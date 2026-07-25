import { List } from '@/components/list'
import { NumericUnreadChip } from '@/components/numeric-unread-chip'
import type { Channel, ChannelType } from '@/entities/channel'
import { CHANNEL_TYPES, PlatformIcon, isChannelType } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { cn } from '@/lib/cn'
import { ChevronRight } from 'lucide-react'
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

  const [isOpen, setIsOpen] = useState(true)

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
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className={cn(
          'flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase outline-none transition-colors',
          'text-primary/40 hover:text-primary/70',
          'focus-visible:ring-accent focus-visible:ring-2',
        )}
      >
        <span className="flex-1 text-left">
          {m.inbox_channels_section_label()}
        </span>
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform',
            isOpen && 'rotate-90',
          )}
        />
      </button>

      {isOpen ? (
        <div className="mb-2 px-2 pt-0 pb-0">
          <List size="sm">
            {activeTypes.map((type) => {
              const typeChannels = channelsByType.get(type) ?? []
              const isTypeActive =
                channelTypeFilter === type && channelIdFilter === null
              const isTypeExpanded = channelTypeFilter === type
              const count = typeUnreadCounts[type] ?? 0

              return (
                <List.Item key={type} isActive={isTypeActive}>
                  <button
                    type="button"
                    onClick={() => handleTypeClick(type)}
                    className="cursor-pointer font-medium px-3"
                  >
                    <PlatformIcon type={type} size="sm" />
                    <span className="flex-1 truncate text-left">
                      {m[`inbox_filter_${type}`]()}
                    </span>
                    {count > 0 && (
                      <NumericUnreadChip
                        count={count}
                        aria-label={m.inbox_unread_aria_label({ count })}
                      />
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
                                'focus-visible:ring-2 focus-visible:ring-accent',
                                isChActive
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-primary/50 hover:bg-primary/5 hover:text-primary',
                              )}
                            >
                              <span className="flex-1 truncate text-left">
                                {ch.name ?? ch.id.slice(0, 8)}
                              </span>
                              {chCount > 0 && (
                                <NumericUnreadChip
                                  count={chCount}
                                  aria-label={m.inbox_unread_aria_label({
                                    count: chCount,
                                  })}
                                />
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </List.Item>
              )
            })}
          </List>
        </div>
      ) : null}
    </div>
  )
}
