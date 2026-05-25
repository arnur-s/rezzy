import { Button } from '@/components/button'
import { listItemStyle } from '@/components/list'
import type { ConversationWithRelations } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import type { Selection } from '@heroui/react'
import { Alert, ListBox, ScrollShadow, Typography } from '@heroui/react'
import { cn } from '@heroui/styles'
import { useCallback, useMemo } from 'react'
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
  searchQuery: string
  onSearchChange: (value: string) => void
  userId: string | null
  onRetry?: () => void
  isRetrying?: boolean
}

function selectionToConversationId(keys: Selection): string | undefined {
  for (const id of keys) {
    return String(id)
  }
  return undefined
}

export function ConversationList({
  conversations,
  isLoading,
  isError,
  selectedConversationId,
  onSelect,
  primaryFilter,
  onPrimaryFilterChange,
  onSearchChange,
  searchQuery,
  userId,
  onRetry,
  isRetrying = false,
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

  const filtered = useMemo(() => {
    const rows = conversations ?? []
    return rows.filter((row) => {
      if (primaryFilter === 'mine') {
        if (userId === null || row.assigned_to !== userId) return false
      }
      if (primaryFilter === 'unassigned' && row.assigned_to !== null)
        return false
      return true
    })
  }, [conversations, primaryFilter, userId])

  const selectedKeys = useMemo(
    () =>
      selectedConversationId
        ? new Set([selectedConversationId])
        : new Set<string>(),
    [selectedConversationId],
  )

  const handleSelectionChange = useCallback(
    (keys: Selection) => {
      const id = selectionToConversationId(keys)
      if (id) onSelect(id)
    },
    [onSelect],
  )

  const hasActiveFilter =
    searchQuery.trim().length > 0 || primaryFilter !== 'all'

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border/60">
      <div className="h-[64px] shrink-0 flex items-center justify-center">
        <ConversationSearch value={searchQuery} onChange={onSearchChange} />
      </div>
      <div className="shrink-0">
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
          <div className="px-4 py-6">
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{m.inbox_list_load_error()}</Alert.Title>
              </Alert.Content>
              {onRetry ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={onRetry}
                  isLoading={isRetrying}
                >
                  {m.common_retry()}
                </Button>
              ) : null}
            </Alert>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            hasActiveFilter={hasActiveFilter}
            onClearFilters={() => {
              onPrimaryFilterChange('all')
              onSearchChange('')
            }}
          />
        ) : (
          <ListBox
            aria-label={m.inbox_conversation_list_aria_label()}
            selectionMode="single"
            selectedKeys={selectedKeys}
            onSelectionChange={handleSelectionChange}
            className="flex flex-col gap-0.5 px-2 py-2 outline-none"
          >
            {filtered.map((conversation) => {
              const isActive = conversation.id === selectedConversationId
              const contactName = conversation.contact.name?.trim() || '—'
              return (
                <ListBox.Item
                  key={conversation.id}
                  id={conversation.id}
                  textValue={contactName}
                  className={cn(
                    'cursor-pointer flex w-full items-start text-left outline-none',
                    listItemStyle.md,
                    'px-3 py-2.5',
                    listItemStyle.transition,
                    listItemStyle.data.hover,
                    listItemStyle.data.selected,
                    listItemStyle.data.focus,
                  )}
                >
                  <ConversationListItem
                    conversation={conversation}
                    isActive={isActive}
                  />
                </ListBox.Item>
              )
            })}
          </ListBox>
        )}
      </ScrollShadow>

    </div>
  )
}

function EmptyState({
  hasActiveFilter,
  onClearFilters,
}: {
  hasActiveFilter: boolean
  onClearFilters: () => void
}) {
  if (hasActiveFilter) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <Typography.Paragraph className="text-sm text-muted-foreground">
          {m.inbox_list_search_empty()}
        </Typography.Paragraph>
        <Button
          size="sm"
          variant="ghost"
          className="mt-3"
          onPress={onClearFilters}
        >
          {m.inbox_list_clear_filters()}
        </Button>
      </div>
    )
  }
  return (
    <div className="px-6 py-12 text-center">
      <Typography.Paragraph className="text-sm font-medium">
        {m.inbox_list_empty_title()}
      </Typography.Paragraph>
      <Typography.Paragraph className="mt-1 text-xs text-muted-foreground">
        {m.inbox_list_empty_description()}
      </Typography.Paragraph>
    </div>
  )
}

export type { InboxPrimaryFilter }
