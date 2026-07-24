import { useRecordWorkspaceVisit } from '@/features/dashboard/hooks/use-record-recent-visit'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { useDebounce } from '@/hooks/use-debounce'
import { useIsLg } from '@/hooks/use-is-lg'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { Drawer } from '@heroui/react'
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

  /**
   * On lg the details pane gets its own column. Below lg it becomes an overlay
   * drawer over the thread instead of replacing it, so the conversation never
   * collapses to an unusable width.
   */
  const showContactAsPane = showContact && isLg && !isMobile
  const showContactAsOverlay = showContact && !isLg && !isMobile
  const showContactOnMobile = showContact && isMobile

  // Gutter columns are real grid tracks, so the list width the resize hook
  // stores stays the pane's own width.
  const gridTemplateColumns = useMemo(() => {
    if (isMobile) return undefined
    if (showContactAsPane)
      return `${listWidth}px 8px minmax(0, 1fr) 8px 20rem`
    return `${listWidth}px 8px minmax(0, 1fr)`
  }, [isMobile, showContactAsPane, listWidth])

  return (
    <div
      className="grid h-full min-h-0 w-full grid-cols-1 grid-rows-1"
      style={gridTemplateColumns ? { gridTemplateColumns } : undefined}
    >
      {/* List pane */}
      <div
        className={cn(
          'h-full min-h-0 min-w-0',
          mobilePane === 'list' ? 'flex' : 'hidden',
          'md:flex',
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

      {/* Thread pane. The dominant surface: always visible from md up, even
          while the details panel is open (it overlays below lg). */}
      <div
        className={cn(
          'h-full min-h-0 min-w-0',
          mobilePane === 'thread' ? 'flex' : 'hidden',
          'md:flex',
        )}
      >
        <InboxThreadRouteContextProvider value={threadContext}>
          {threadSlot}
        </InboxThreadRouteContextProvider>
      </div>

      {/* Gutter before the details pane on lg. */}
      {showContactAsPane ? <div aria-hidden /> : null}

      {/* Details pane: own column on lg, the single visible pane on mobile.
          At tablet widths it is neither — the overlay below handles it. */}
      {selectedConversation && (showContactAsPane || showContactOnMobile) ? (
        <div className="flex h-full min-h-0 min-w-0">
          <ContactPanel
            workspaceId={workspaceId}
            conversation={selectedConversation}
            onClose={handleCloseContactPanel}
          />
        </div>
      ) : null}

      {/* Details overlay for tablet widths. Drawer gives focus trap and
          escape-to-close, matching the mobile sidebar pattern. */}
      {selectedConversation ? (
        <Drawer.Backdrop
          isOpen={showContactAsOverlay}
          onOpenChange={(open) => {
            if (!open) handleCloseContactPanel()
          }}
        >
          <Drawer.Content placement="right">
            <Drawer.Dialog
              className="h-full w-80 max-w-[85vw] rounded-none p-0"
              aria-label={m.inbox_contact_panel_title()}
            >
              <Drawer.Body className="min-h-0 p-0">
                <ContactPanel
                  workspaceId={workspaceId}
                  conversation={selectedConversation}
                  onClose={handleCloseContactPanel}
                  className="rounded-none border-0 shadow-none"
                />
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      ) : null}
    </div>
  )
}
