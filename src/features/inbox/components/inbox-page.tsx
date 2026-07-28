import { useDebounce } from '@/hooks/use-debounce'
import { useIsLg } from '@/hooks/use-is-lg'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ConversationWithRelations } from '@/entities/conversation'
import { AppPane } from '@/components/app-pane'
import { ResizeHandle, useResizable } from '@astryxdesign/core/Resizable'
import { useConversations, useConversationsSearch } from '../hooks/use-conversations'
import { useWorkspaceUnreadCounts } from '../hooks/use-unread-counts'
import { ContactPanel } from './contact-panel/contact-panel'
import type { InboxPrimaryFilter } from './conversation-list/conversation-list'
import { ConversationList } from './conversation-list/conversation-list'
import { InboxThreadRouteContextProvider } from './inbox-route-context'
import type { InboxThreadRouteContextValue } from './inbox-route-context'

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
  const listResize = useResizable({
    defaultSize: 320,
    minSizePx: 200,
    maxSizePx: 480,
    autoSaveId: 'inbox:list-width',
  })

  const showContact = isContactPanelOpen && selectedConversation !== null
  // Only once the list has actually resolved: mid-load, "nothing here" would
  // be a claim the app cannot yet make.
  const hasNoConversations =
    !conversationsQuery.isPending &&
    !conversationsQuery.isError &&
    conversationsQuery.data.length === 0

  const threadContext = useMemo<InboxThreadRouteContextValue>(
    () => ({
      workspaceId,
      senderId,
      selectedConversation,
      selectedConversationId,
      isConversationsPending: conversationsQuery.isPending,
      isConversationsError: conversationsQuery.isError,
      hasNoConversations,
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
      hasNoConversations,
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

  const conversationListNode = (
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
  )

  const threadNode = (
    <InboxThreadRouteContextProvider value={threadContext}>
      {threadSlot}
    </InboxThreadRouteContextProvider>
  )

  // Mobile shows exactly one pane at a time; panes never share the viewport.
  // The shell's `AppPaneGroup` drops its gutter below `md`, so that single
  // pane is full-bleed and the canvas is not visible at all at this width.
  if (isMobile) {
    return (
      <>
        {mobilePane === 'list' ? (
          <AppPane label={m.inbox_conversation_list_aria_label()}>
            {conversationListNode}
          </AppPane>
        ) : null}
        {mobilePane === 'thread' ? <AppPane>{threadNode}</AppPane> : null}
        {mobilePane === 'contact' && selectedConversation ? (
          <AppPane label={m.inbox_contact_panel_title()}>
            <ContactPanel
              workspaceId={workspaceId}
              conversation={selectedConversation}
              onClose={handleCloseContactPanel}
            />
          </AppPane>
        ) : null}
      </>
    )
  }

  return (
    <>
      <AppPane
        label={m.inbox_conversation_list_aria_label()}
        width={listResize.size}
      >
        {conversationListNode}
      </AppPane>

      {/* The handle lives in the seam rather than on a pane edge: with no
          divider it takes zero width and contributes only a hit area, so what
          the user grabs is the gutter itself. `-mx-1` absorbs the second gap
          the pane group would otherwise put around it, keeping this seam the
          same width as every other one. */}
      <ResizeHandle
        className="-mx-1"
        direction="horizontal"
        resizable={listResize.props}
        pillPlacement="center"
        isAlwaysVisible={false}
        label={m.inbox_conversation_list_resize_label()}
      />

      <AppPane>{threadNode}</AppPane>

      {selectedConversation && showContactAsPane ? (
        <AppPane label={m.inbox_contact_panel_title()} width={320}>
          <ContactPanel
            workspaceId={workspaceId}
            conversation={selectedConversation}
            onClose={handleCloseContactPanel}
          />
        </AppPane>
      ) : null}

      {/* Details overlay for tablet widths: a right-side sheet over the thread,
          matching the mobile sidebar pattern. Inset from the viewport by the
          same gutter the docked panes use, so the sheet reads as the same kind
          of object arriving from the edge rather than as a full-height slab. */}
      {selectedConversation && showContactAsOverlay ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label={m.inbox_contact_panel_title()}
            className="absolute inset-0 bg-black/50"
            onClick={handleCloseContactPanel}
          />
          <div
            role="dialog"
            aria-label={m.inbox_contact_panel_title()}
            className="absolute inset-y-0 right-0 flex h-full w-80 max-w-[85vw] md:p-2"
          >
            <AppPane>
              <ContactPanel
                workspaceId={workspaceId}
                conversation={selectedConversation}
                onClose={handleCloseContactPanel}
              />
            </AppPane>
          </div>
        </div>
      ) : null}
    </>
  )
}
