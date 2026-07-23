import { useRecordWorkspaceVisit } from '@/features/dashboard/hooks/use-record-recent-visit'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { useDebounce } from '@/hooks/use-debounce'
import { useIsLg } from '@/hooks/use-is-lg'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { useAuth } from '@/providers/auth-provider'
import { cn } from '@heroui/styles'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ConversationWithRelations } from '@/entities/conversation'
import { useConversations, useConversationsSearch } from '../hooks/use-conversations'
import { useResizablePanel } from '../hooks/use-resizable-panel'
import { useWorkspaceUnreadCounts } from '../hooks/use-unread-counts'
import { ContactPanel } from './contact-panel/contact-panel'
import type { InboxPrimaryFilter } from './conversation-list/conversation-list'
import { ConversationList } from './conversation-list/conversation-list'
import { InboxThreadRouteContextProvider } from './inbox-route-context'
import type { InboxThreadRouteContextValue } from './inbox-route-context'
import { ResizeHandle } from './resize-handle'

type MobilePane = 'list' | 'thread' | 'contact'

type Props = {
  workspaceId: string
  selectedConversationId: string | null
  onSelectConversation: (id: string) => void
  onBackToList: () => void
  threadSlot: ReactNode
}

export function InboxPage({
  workspaceId,
  selectedConversationId,
  onSelectConversation,
  onBackToList,
  threadSlot,
}: Props) {
  const { session } = useAuth()
  const senderId = session?.user.id ?? null

  const conversationsQuery = useConversations(workspaceId)
  const unreadCountsQuery = useWorkspaceUnreadCounts(workspaceId, senderId)

  const workspacesQuery = useWorkspaces(senderId ?? undefined)
  const workspace = workspacesQuery.data?.find((w) => w.id === workspaceId)
  useRecordWorkspaceVisit(workspaceId, workspace?.name, workspace?.icon)

  const [primaryFilter, setPrimaryFilter] = useState<InboxPrimaryFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false)
  const [scrollToLatestNonce, setScrollToLatestNonce] = useState(0)

  // Clicking the already-open conversation navigates nowhere (same URL), so the
  // thread would silently stay wherever the user scrolled. Treat re-selecting
  // it as "jump back to the latest message" instead.
  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      if (conversationId === selectedConversationId) {
        setScrollToLatestNonce((nonce) => nonce + 1)
        return
      }
      onSelectConversation(conversationId)
    },
    [selectedConversationId, onSelectConversation],
  )

  const debouncedSearch = useDebounce(searchQuery, 300)
  const isSearchActive = debouncedSearch.trim().length > 0
  const searchResults = useConversationsSearch(workspaceId, debouncedSearch)

  useEffect(() => {
    setIsContactPanelOpen(false)
  }, [selectedConversationId])

  // Overlay per-agent unread counts (from the read cursor) onto conversation
  // rows so unread reflects this agent's state, not a shared workspace counter.
  const unreadCounts = unreadCountsQuery.data
  const withUnreadCounts = useCallback(
    (list: Array<ConversationWithRelations> | undefined) =>
      list?.map((row) => ({
        ...row,
        unread_count: unreadCounts?.[row.id] ?? 0,
      })),
    [unreadCounts],
  )
  const conversationsWithUnread = useMemo(
    () => withUnreadCounts(conversationsQuery.data),
    [withUnreadCounts, conversationsQuery.data],
  )
  // Sourced from the overlaid list so the thread's unread divider sees this
  // agent's per-agent count, not the zeroed placeholder from the API.
  const selectedConversation = useMemo(
    () =>
      conversationsWithUnread?.find(
        (row) => row.id === selectedConversationId,
      ) ?? null,
    [conversationsWithUnread, selectedConversationId],
  )
  const searchResultsWithUnread = useMemo(
    () => withUnreadCounts(searchResults.data),
    [withUnreadCounts, searchResults.data],
  )

  const mobilePane: MobilePane =
    isContactPanelOpen && selectedConversation !== null
      ? 'contact'
      : selectedConversationId !== null
        ? 'thread'
        : 'list'

  const handleToggleContactPanel = useCallback(() => {
    setIsContactPanelOpen((open) => {
      if (!selectedConversation && !open) return open
      return !open
    })
  }, [selectedConversation])

  const handleCloseContactPanel = useCallback(() => {
    setIsContactPanelOpen(false)
  }, [])

  const handleRetryConversations = useCallback(() => {
    if (isSearchActive) {
      void searchResults.refetch()
    } else {
      void conversationsQuery.refetch()
    }
  }, [isSearchActive, searchResults.refetch, conversationsQuery.refetch])

  const isMobile = useIsMobile()
  const isLg = useIsLg()
  const { width: listWidth, handleMouseDown: handleListResize } = useResizablePanel({
    storageKey: 'inbox:list-width',
    defaultWidth: 320,
    min: 200,
    max: 480,
  })

  const showContact = isContactPanelOpen && selectedConversation !== null
  const threadContext = useMemo<InboxThreadRouteContextValue>(
    () => ({
      workspaceId,
      senderId,
      selectedConversation,
      selectedConversationId,
      isConversationsPending: conversationsQuery.isPending,
      isConversationsError: conversationsQuery.isError,
      onBackToList,
      onToggleContactPanel: handleToggleContactPanel,
      scrollToLatestNonce,
    }),
    [
      workspaceId,
      senderId,
      selectedConversation,
      selectedConversationId,
      conversationsQuery.isPending,
      conversationsQuery.isError,
      onBackToList,
      handleToggleContactPanel,
      scrollToLatestNonce,
    ],
  )

  const gridTemplateColumns = useMemo(() => {
    if (isMobile) return undefined
    if (showContact && isLg) return `${listWidth}px 4px minmax(0, 1fr) 20rem`
    return `${listWidth}px 4px minmax(0, 1fr)`
  }, [isMobile, isLg, showContact, listWidth])

  return (
    <div
      className="grid h-full min-h-0 w-full grid-cols-1 grid-rows-1"
      style={gridTemplateColumns ? { gridTemplateColumns } : undefined}
    >
      {/* List pane */}
      <div
        className={cn(
          'h-full min-h-0 min-w-0 overflow-hidden',
          mobilePane === 'list' ? 'block' : 'hidden',
          'md:block',
        )}
      >
        <ConversationList
          conversations={
            isSearchActive ? searchResultsWithUnread : conversationsWithUnread
          }
          isLoading={isSearchActive ? searchResults.isPending : conversationsQuery.isPending}
          isError={isSearchActive ? searchResults.isError : conversationsQuery.isError}
          selectedConversationId={selectedConversationId}
          onSelect={handleSelectConversation}
          primaryFilter={primaryFilter}
          onPrimaryFilterChange={setPrimaryFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          userId={senderId}
          onRetry={handleRetryConversations}
          isRetrying={isSearchActive ? searchResults.isRefetching : conversationsQuery.isRefetching}
        />
      </div>

      <ResizeHandle onMouseDown={handleListResize} />

      {/* Thread pane.
          On md without contact panel: visible.
          On md with contact panel open: hidden (panel takes its slot).
          On lg+: always visible. */}
      <div
        className={cn(
          'h-full min-h-0 min-w-0 overflow-hidden',
          mobilePane === 'thread' ? 'block' : 'hidden',
          showContact ? 'md:hidden lg:block' : 'md:block',
        )}
      >
        <InboxThreadRouteContextProvider value={threadContext}>
          {threadSlot}
        </InboxThreadRouteContextProvider>
      </div>

      {/* Contact panel pane. */}
      {isContactPanelOpen && selectedConversation ? (
        <div
          className={cn(
            'h-full min-h-0 min-w-0 overflow-hidden',
            mobilePane === 'contact' ? 'block' : 'hidden',
            // On md it slots into column 2 (replacing the thread).
            // On lg+ it slots into column 3.
            'md:block',
          )}
        >
          <ContactPanel
            workspaceId={workspaceId}
            conversation={selectedConversation}
            onClose={handleCloseContactPanel}
          />
        </div>
      ) : null}
    </div>
  )
}
