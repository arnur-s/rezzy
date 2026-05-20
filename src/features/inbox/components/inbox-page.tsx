import { useRecordWorkspaceVisit } from '@/features/dashboard/hooks/use-record-recent-visit'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { useIsLg } from '@/hooks/use-is-lg'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { useAuth } from '@/providers/auth-provider'
import { cn } from '@heroui/styles'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useConversations } from '../hooks/use-conversations'
import { useConversationsRealtime } from '../hooks/use-conversations-realtime'
import { useResizablePanel } from '../hooks/use-resizable-panel'
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
  useConversationsRealtime(workspaceId)

  const workspacesQuery = useWorkspaces(senderId ?? undefined)
  const workspace = workspacesQuery.data?.find((w) => w.id === workspaceId)
  useRecordWorkspaceVisit(workspaceId, workspace?.name)

  const [primaryFilter, setPrimaryFilter] = useState<InboxPrimaryFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false)

  useEffect(() => {
    setIsContactPanelOpen(false)
  }, [selectedConversationId])

  const selectedConversation = useMemo(
    () =>
      conversationsQuery.data?.find((row) => row.id === selectedConversationId) ??
      null,
    [conversationsQuery.data, selectedConversationId],
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
          conversations={conversationsQuery.data}
          isLoading={conversationsQuery.isPending}
          isError={conversationsQuery.isError}
          selectedConversationId={selectedConversationId}
          onSelect={onSelectConversation}
          primaryFilter={primaryFilter}
          onPrimaryFilterChange={setPrimaryFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          userId={senderId}
          onRetry={() => {
            void conversationsQuery.refetch()
          }}
          isRetrying={conversationsQuery.isRefetching}
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
