import type { Channel, ChannelType } from '@/entities/channel'
import type { ConversationWithRelations } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { ScrollShadow } from '@heroui/react'
import { useMemo } from 'react'
import { ChannelFilters } from './channel-filters'
import { ConversationListItem } from './conversation-list-item'
import { ConversationListSkeleton } from './conversation-list-skeleton'
import { ConversationSearch } from './conversation-search'
import type { InboxPrimaryFilter } from './primary-inbox-filters'
import { PrimaryInboxFilters } from './primary-inbox-filters'

type Props = {
  conversations: Array<ConversationWithRelations> | undefined
  isLoading: boolean
  isError: boolean
  selectedConversationId: string | null
  onSelect: (conversationId: string) => void
  primaryFilter: InboxPrimaryFilter
  onPrimaryFilterChange: (filter: InboxPrimaryFilter) => void
  channelTypeFilter: ChannelType | null
  onChannelTypeFilterChange: (type: ChannelType | null) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  channels: Array<Channel>
  channelIdFilter: string | null
  onChannelIdFilterChange: (id: string | null) => void
  userId: string | null
}

export function ConversationList({
  conversations,
  isLoading,
  isError,
  selectedConversationId,
  onSelect,
  primaryFilter,
  onPrimaryFilterChange,
  channelTypeFilter,
  onChannelTypeFilterChange,
  searchQuery,
  onSearchChange,
  channels,
  channelIdFilter,
  onChannelIdFilterChange,
  userId,
}: Props) {
  const primaryUnreadCounts = useMemo(() => {
    const counts: Record<InboxPrimaryFilter, number> = {
      all: 0,
      mine: 0,
      unassigned: 0,
    }
    for (const row of conversations ?? []) {
      const count =
        row.id === selectedConversationId ? 0 : row.unread_count || 0
      counts.all += count
      if (userId !== null && row.assigned_to === userId) counts.mine += count
      if (row.assigned_to === null) counts.unassigned += count
    }
    return counts
  }, [conversations, selectedConversationId, userId])

  const channelUnreadCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const row of conversations ?? []) {
      const count =
        row.id === selectedConversationId ? 0 : row.unread_count || 0
      if (count > 0)
        counts[row.channel.id] = (counts[row.channel.id] ?? 0) + count
    }
    return counts
  }, [conversations, selectedConversationId])

  const filtered = useMemo(() => {
    const rows = conversations ?? []
    const needle = searchQuery.trim().toLowerCase()
    return rows.filter((row) => {
      if (primaryFilter === 'mine') {
        if (userId === null || row.assigned_to !== userId) return false
      }
      if (primaryFilter === 'unassigned' && row.assigned_to !== null)
        return false
      if (channelTypeFilter !== null && row.channel.type !== channelTypeFilter)
        return false
      if (channelIdFilter && row.channel.id !== channelIdFilter) return false
      if (!needle) return true
      const name = row.contact.name?.toLowerCase() ?? ''
      const preview = row.last_message_preview?.toLowerCase() ?? ''
      return name.includes(needle) || preview.includes(needle)
    })
  }, [
    conversations,
    primaryFilter,
    channelTypeFilter,
    channelIdFilter,
    searchQuery,
    userId,
  ])

  const hasActiveFilter =
    searchQuery.trim().length > 0 ||
    primaryFilter !== 'all' ||
    channelTypeFilter !== null ||
    channelIdFilter !== null

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border/60">
      <div className="shrink-0 border-b border-border/60">
        <ConversationSearch value={searchQuery} onChange={onSearchChange} />
      </div>
      <div className="shrink-0 border-b border-border/60">
        <PrimaryInboxFilters
          primaryFilter={primaryFilter}
          onPrimaryFilterChange={onPrimaryFilterChange}
          unreadCounts={primaryUnreadCounts}
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
          <EmptyState hasQuery={hasActiveFilter} />
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

      <div className="shrink-0 border-t border-border/60">
        <ChannelFilters
          channelTypeFilter={channelTypeFilter}
          channelIdFilter={channelIdFilter}
          channels={channels}
          channelUnreadCounts={channelUnreadCounts}
          onChannelTypeFilterChange={onChannelTypeFilterChange}
          onChannelIdFilterChange={onChannelIdFilterChange}
        />
      </div>
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

export type { InboxPrimaryFilter }
