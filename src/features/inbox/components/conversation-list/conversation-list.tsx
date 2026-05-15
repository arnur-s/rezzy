import { isChannelType } from '@/entities/channel'
import type { Channel } from '@/entities/channel'
import type { ConversationWithRelations } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { ScrollShadow } from '@heroui/react'
import { useMemo } from 'react'
import type { PlatformFilter } from './channel-nav'
import { ChannelNav } from './channel-nav'
import { ConversationListItem } from './conversation-list-item'
import { ConversationListSkeleton } from './conversation-list-skeleton'
import { ConversationSearch } from './conversation-search'

type Props = {
  conversations: Array<ConversationWithRelations> | undefined
  isLoading: boolean
  isError: boolean
  selectedConversationId: string | null
  onSelect: (conversationId: string) => void
  filter: PlatformFilter
  onFilterChange: (filter: PlatformFilter) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  channels: Array<Channel>
  channelIdFilter: string | null
  onChannelIdFilterChange: (id: string | null) => void
}

export function ConversationList({
  conversations,
  isLoading,
  isError,
  selectedConversationId,
  onSelect,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  channels,
  channelIdFilter,
  onChannelIdFilterChange,
}: Props) {
  const unreadCounts = useMemo(() => {
    const counts: Record<PlatformFilter, number> = {
      all: 0,
      telegram: 0,
      whatsapp: 0,
      instagram: 0,
      email: 0,
    }
    for (const row of conversations ?? []) {
      const count = row.unread_count || 0
      counts.all += count
      if (isChannelType(row.channel.type)) {
        counts[row.channel.type] += count
      }
    }
    return counts
  }, [conversations])

  const channelUnreadCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const row of conversations ?? []) {
      const count = row.unread_count || 0
      if (count > 0) counts[row.channel.id] = (counts[row.channel.id] ?? 0) + count
    }
    return counts
  }, [conversations])

  const filtered = useMemo(() => {
    const rows = conversations ?? []
    const needle = searchQuery.trim().toLowerCase()
    return rows.filter((row) => {
      if (filter !== 'all' && row.channel.type !== filter) return false
      if (channelIdFilter && row.channel.id !== channelIdFilter) return false
      if (!needle) return true
      const name = row.contact.name?.toLowerCase() ?? ''
      const preview = row.last_message_preview?.toLowerCase() ?? ''
      return name.includes(needle) || preview.includes(needle)
    })
  }, [conversations, filter, channelIdFilter, searchQuery])

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border/60">
      <div className="border-b border-border/60">
        <ConversationSearch value={searchQuery} onChange={onSearchChange} />
      </div>
      <div className="border-b border-border/60">
        <ChannelNav
          filter={filter}
          onFilterChange={onFilterChange}
          channels={channels}
          channelIdFilter={channelIdFilter}
          onChannelIdFilterChange={onChannelIdFilterChange}
          unreadCounts={unreadCounts}
          channelUnreadCounts={channelUnreadCounts}
        />
      </div>

      <ScrollShadow className="min-h-0 flex-1">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : isError ? (
          <p className="px-6 py-8 text-sm text-danger">
            {m.inbox_list_load_error()}
          </p>
        ) : filtered.length === 0 ? (
          <EmptyState
            hasQuery={
              searchQuery.trim().length > 0 ||
              filter !== 'all' ||
              channelIdFilter !== null
            }
          />
        ) : (
          <ul className="flex flex-col gap-0.5 px-2 py-2">
            {filtered.map((conversation) => (
              <li key={conversation.id}>
                <ConversationListItem
                  conversation={conversation}
                  isActive={conversation.id === selectedConversationId}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        )}
      </ScrollShadow>
    </div>
  )
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  if (hasQuery) {
    return (
      <p className="px-6 py-12 text-center text-sm text-foreground/60">
        {m.inbox_list_search_empty()}
      </p>
    )
  }
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">
        {m.inbox_list_empty_title()}
      </p>
      <p className="mt-1 text-xs text-foreground/60">
        {m.inbox_list_empty_description()}
      </p>
    </div>
  )
}

export type { PlatformFilter }
