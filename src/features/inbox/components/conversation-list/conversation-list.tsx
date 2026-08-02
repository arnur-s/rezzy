import { listItemStyle } from '@/components/list'
import type { ConversationWithRelations } from '@/entities/conversation'
import { useWorkspaceMemberLookup } from '@/features/workspaces/hooks/use-workspaces'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { cn } from '@/lib/cn'
import { useMemo } from 'react'
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
  workspaceId: string
  onRetry?: () => void
  isRetrying?: boolean
}

/**
 * Row states for the most-read surface in the product.
 *
 * The list is flat on the shell's content surface and shares the side nav's
 * selection grammar: selection is a quiet fill, hover sits a step below it so
 * the two never compete, and focus is an inset ring so it survives on top of
 * either.
 */
const conversationRowStyle = {
  hover: listItemStyle.data.hover,
  selected: cn(
    listItemStyle.data.selected,
    'data-[selected=true]:text-primary',
  ),
  focus:
    'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
} as const

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
  workspaceId,
  onRetry,
  isRetrying = false,
}: Props) {
  // One roster fetch behind the whole list. Rows resolve their own assignee
  // from it rather than each carrying an embedded profile — see
  // ConversationWithRelations on why an embedded one could only name yourself.
  const { lookup: memberLookup, isLoaded: isRosterLoaded } =
    useWorkspaceMemberLookup(workspaceId)

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

  const hasActiveFilter =
    searchQuery.trim().length > 0 || primaryFilter !== 'all'

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex h-16 shrink-0 items-center justify-center px-1">
        <ConversationSearch value={searchQuery} onChange={onSearchChange} />
      </div>
      <div className="border-border/60 shrink-0 border-b">
        <PrimaryInboxFilters
          primaryFilter={primaryFilter}
          onPrimaryFilterChange={onPrimaryFilterChange}
          unreadCounts={primaryUnreadCounts}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : isError ? (
          <div className="px-3 py-4">
            <div className="bg-error/10 flex items-center justify-between gap-2 rounded-lg px-3 py-2">
              <span className="text-error text-sm">
                {m.inbox_list_load_error()}
              </span>
              {onRetry ? (
                <Button
                  label={m.common_retry()}
                  size="sm"
                  variant="ghost"
                  onClick={onRetry}
                  isLoading={isRetrying}
                />
              ) : null}
            </div>
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
          <div
            role="listbox"
            aria-label={m.inbox_conversation_list_aria_label()}
            className="flex flex-col gap-0.5 px-2 py-2 outline-none"
          >
            {filtered.map((conversation) => {
              const isActive = conversation.id === selectedConversationId
              const contactName = conversation.contact.name?.trim() || '—'
              const assignee = conversation.assigned_to
                ? (memberLookup.get(conversation.assigned_to) ?? null)
                : null
              // The face is pointer-only, so the owner has to reach the
              // accessible name too — otherwise the row announces less than it
              // shows.
              const rowLabel = assignee
                ? m.inbox_row_aria_with_assignee({
                    contact: contactName,
                    name: assignee.fullName,
                  })
                : contactName
              return (
                <button
                  key={conversation.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  aria-label={rowLabel}
                  data-selected={isActive ? 'true' : 'false'}
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
                    assignee={assignee}
                    isAssigneeUnresolved={
                      isRosterLoaded &&
                      conversation.assigned_to !== null &&
                      assignee === null
                    }
                  />
                </button>
              )
            })}
          </div>
        )}
      </div>
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
        <p className="text-secondary text-sm text-balance">
          {m.inbox_list_search_empty()}
        </p>
        <div className="mt-4">
          <Button
            label={m.inbox_list_clear_filters()}
            size="sm"
            variant="ghost"
            onClick={onClearFilters}
          />
        </div>
      </div>
    )
  }
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-sm font-medium text-balance">
        {m.inbox_list_empty_title()}
      </p>
      <p className="text-secondary mt-1.5 text-xs text-balance">
        {m.inbox_list_empty_description()}
      </p>
    </div>
  )
}

export type { InboxPrimaryFilter }
