import { useRecordWorkspaceVisit } from '@/features/dashboard/hooks/use-record-recent-visit'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { useAuth } from '@/providers/auth-provider'
import { cn } from '@heroui/styles'
import { useMemo, useState } from 'react'
import { useConversations } from '../hooks/use-conversations'
import { useConversationsRealtime } from '../hooks/use-conversations-realtime'
import { ContactPanel } from './contact-panel/contact-panel'
import type { InboxPrimaryFilter } from './conversation-list/conversation-list'
import { ConversationList } from './conversation-list/conversation-list'
import { MessageThread } from './message-thread/message-thread'

type MobilePane = 'list' | 'thread' | 'contact'

type Props = {
  workspaceId: string
  selectedConversationId: string | null
  onSelectConversation: (id: string) => void
  onBackToList: () => void
}

export function InboxPage({
  workspaceId,
  selectedConversationId,
  onSelectConversation,
  onBackToList,
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

  function handleToggleContactPanel() {
    if (!selectedConversation) return
    setIsContactPanelOpen((open) => !open)
  }

  function handleCloseContactPanel() {
    setIsContactPanelOpen(false)
  }

  const showContact = isContactPanelOpen && selectedConversation !== null

  // Grid template:
  // - mobile (<md): single column; we hide the inactive panes via classes
  // - md (≥768): list 20rem | thread fills rest
  // - lg (≥1024) with contact open: list 20rem | thread fills rest | contact 20rem
  const gridClass = showContact
    ? 'md:grid-cols-[20rem_minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)_20rem]'
    : 'md:grid-cols-[20rem_minmax(0,1fr)]'

  return (
    <div
      className={cn(
        'grid h-full min-h-0 w-full grid-cols-1 grid-rows-1',
        gridClass,
      )}
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
        />
      </div>

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
        <MessageThread
          workspaceId={workspaceId}
          conversation={selectedConversation}
          senderId={senderId}
          onToggleContactPanel={handleToggleContactPanel}
          onBack={onBackToList}
        />
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
