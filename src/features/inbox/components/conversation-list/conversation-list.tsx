import { Button } from '@/components/button'
import { listItemStyle } from '@/components/list'
import { paneStyle } from '@/components/pane'
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

/**
 * Row states for the most-read surface in the product.
 *
 * The list body is recessed and rows are transparent, so the selected row can
 * be *lifted to a surface* rather than tinted. With a monochrome accent, an
 * accent tint is by definition grey — the exact "generic grey block" this
 * screen must avoid. Elevation reads as "you are here" without spending a
 * colour the system does not have.
 *
 * Hover sits deliberately below selection so the two never compete, and focus
 * is an inset ring so it survives on top of either.
 */
const conversationRowStyle = {
  hover: 'data-[selected=false]:hover:bg-foreground/5',
  selected:
    'data-[selected=true]:bg-surface data-[selected=true]:shadow-surface data-[selected=true]:text-foreground',
  focus:
    'data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-focus data-[focus-visible=true]:ring-inset',
} as const

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
    <div className={cn(paneStyle.surface, 'h-full w-full')}>
      <div className="flex h-[64px] shrink-0 items-center justify-center px-1">
        <ConversationSearch value={searchQuery} onChange={onSearchChange} />
      </div>
      <div className={cn('shrink-0 border-b', paneStyle.separator)}>
        <PrimaryInboxFilters
          primaryFilter={primaryFilter}
          onPrimaryFilterChange={onPrimaryFilterChange}
          unreadCounts={primaryUnreadCounts}
        />
      </div>

      {/* Recessed body: rows are transparent against it, so the selected row
          can lift to a surface instead of being tinted grey. */}
      <ScrollShadow className={cn('min-h-0 flex-1', paneStyle.recessed)}>
        {isLoading ? (
          <ConversationListSkeleton />
        ) : isError ? (
          <div className="px-3 py-4">
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
            disallowEmptySelection
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
                  // Plain DOM click, not onAction: with selection enabled,
                  // react-aria never fires onAction for a single click on the
                  // already-selected row, but this must re-trigger onSelect so
                  // the open thread can jump back to the latest message.
                  onClick={() => onSelect(conversation.id)}
                  className={cn(
                    'flex w-full cursor-pointer items-start text-left outline-none',
                    listItemStyle.md,
                    'px-3 py-2.5',
                    listItemStyle.transition,
                    conversationRowStyle.hover,
                    conversationRowStyle.selected,
                    conversationRowStyle.focus,
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
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <Typography.Paragraph className="text-muted text-sm text-balance">
          {m.inbox_list_search_empty()}
        </Typography.Paragraph>
        <Button
          size="sm"
          variant="ghost"
          className="mt-4"
          onPress={onClearFilters}
        >
          {m.inbox_list_clear_filters()}
        </Button>
      </div>
    )
  }
  return (
    <div className="px-6 py-16 text-center">
      <Typography.Paragraph className="text-sm font-medium text-balance">
        {m.inbox_list_empty_title()}
      </Typography.Paragraph>
      <Typography.Paragraph className="text-muted mt-1.5 text-xs text-balance">
        {m.inbox_list_empty_description()}
      </Typography.Paragraph>
    </div>
  )
}

export type { InboxPrimaryFilter }
