import type { Channel } from '@/features/channels/types'
import { m } from '@/paraglide/messages'
import { cn } from '@heroui/styles'
import { useMemo } from 'react'
import type { ChannelType } from '../../types'
import { CHANNEL_TYPES, isChannelType } from '../../types'
import { PlatformIcon } from '../platform-icon'

export type PlatformFilter = ChannelType | 'all'

type Props = {
  filter: PlatformFilter
  onFilterChange: (filter: PlatformFilter) => void
  channels: Array<Channel>
  channelIdFilter: string | null
  onChannelIdFilterChange: (id: string | null) => void
  unreadCounts: Record<PlatformFilter, number>
  channelUnreadCounts: Record<string, number>
}

export function ChannelNav({
  filter,
  onFilterChange,
  channels,
  channelIdFilter,
  onChannelIdFilterChange,
  unreadCounts,
  channelUnreadCounts,
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

  function selectFilter(next: PlatformFilter) {
    onFilterChange(next)
    onChannelIdFilterChange(null)
  }

  function selectChannel(ch: Channel) {
    if (isChannelType(ch.type)) onFilterChange(ch.type)
    onChannelIdFilterChange(ch.id)
  }

  return (
    <nav aria-label={m.inbox_filter_aria_label()}>
      <ul className="flex flex-col gap-0.5 px-2 py-2">
        <NavItem
          isActive={filter === 'all'}
          icon={null}
          label={m.inbox_filter_all()}
          count={unreadCounts.all}
          onClick={() => selectFilter('all')}
        />

        {activeTypes.map((type) => {
          const typeChannels = channelsByType.get(type) ?? []
          const isTypeActive = filter === type && channelIdFilter === null
          const isExpanded = filter === type

          return (
            <li key={type}>
              <NavItemButton
                isActive={isTypeActive}
                icon={type}
                label={m[`inbox_filter_${type}`]()}
                count={unreadCounts[type]}
                onClick={() => selectFilter(type)}
              />
              {isExpanded && typeChannels.length >= 2 && (
                <ul className="mt-0.5 flex flex-col gap-0.5">
                  {typeChannels.map((ch) => (
                    <li key={ch.id}>
                      <button
                        type="button"
                        onClick={() => selectChannel(ch)}
                        className={cn(
                          'flex w-full items-center gap-1.5 rounded-md pl-7 pr-3 py-1 text-xs font-medium outline-none transition-colors',
                          'focus-visible:ring-2 focus-visible:ring-ring',
                          channelIdFilter === ch.id
                            ? 'bg-foreground/10 text-foreground'
                            : 'text-foreground/50 hover:bg-foreground/5 hover:text-foreground',
                        )}
                      >
                        <span className="flex-1 truncate text-left">
                          {ch.name ?? ch.id.slice(0, 8)}
                        </span>
                        {(channelUnreadCounts[ch.id] ?? 0) > 0 && (
                          <UnreadBadge
                            count={channelUnreadCounts[ch.id]}
                            isActive={channelIdFilter === ch.id}
                          />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function NavItem({
  isActive,
  icon,
  label,
  count,
  onClick,
}: {
  isActive: boolean
  icon: ChannelType | null
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <li>
      <NavItemButton
        isActive={isActive}
        icon={icon}
        label={label}
        count={count}
        onClick={onClick}
      />
    </li>
  )
}

function NavItemButton({
  isActive,
  icon,
  label,
  count,
  onClick,
}: {
  isActive: boolean
  icon: ChannelType | null
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'bg-foreground/10 text-foreground'
          : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground',
      )}
    >
      {icon && <PlatformIcon type={icon} size="sm" />}
      <span className="flex-1 truncate text-left">{label}</span>
      {count > 0 && <UnreadBadge count={count} isActive={isActive} />}
    </button>
  )
}

function UnreadBadge({
  count,
  isActive,
}: {
  count: number
  isActive: boolean
}) {
  return (
    <span
      aria-label={m.inbox_unread_aria_label({ count })}
      className={cn(
        'inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4',
        isActive ? 'text-foreground' : 'bg-accent text-accent-foreground',
      )}
    >
      {count}
    </span>
  )
}
