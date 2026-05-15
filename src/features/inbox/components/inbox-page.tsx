import { useChannels } from '@/features/channels/hooks/use-channels'
import { useAuth } from '@/providers/auth-provider'
import { cn } from '@heroui/styles'
import { useMemo, useState } from 'react'
import {
  useConversations,
  useMarkConversationRead,
} from '../hooks/use-conversations'
import { useConversationsRealtime } from '../hooks/use-conversations-realtime'
import { ContactPanel } from './contact-panel/contact-panel'
import type { PlatformFilter } from './conversation-list/conversation-list'
import { ConversationList } from './conversation-list/conversation-list'
import { MessageThread } from './message-thread/message-thread'

type MobilePane = 'list' | 'thread' | 'contact'

type Props = {
  workspaceId: string
}

export function InboxPage({ workspaceId }: Props) {
  const { session } = useAuth()
  const senderId = session?.user.id ?? null

  const conversationsQuery = useConversations(workspaceId)
  const channelsQuery = useChannels(workspaceId)
  useConversationsRealtime(workspaceId)
  const markRead = useMarkConversationRead(workspaceId)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<PlatformFilter>('all')
  const [channelIdFilter, setChannelIdFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false)
  const [mobilePane, setMobilePane] = useState<MobilePane>('list')

  const selectedConversation = useMemo(
    () => conversationsQuery.data?.find((row) => row.id === selectedId) ?? null,
    [conversationsQuery.data, selectedId],
  )

  function handleSelect(conversationId: string) {
    setSelectedId(conversationId)
    setMobilePane('thread')
    const target = conversationsQuery.data?.find(
      (row) => row.id === conversationId,
    )
    if (target && target.unread_count > 0) {
      markRead.mutate(conversationId)
    }
  }

  function handleBackToList() {
    setMobilePane('list')
  }

  function handleToggleContactPanel() {
    if (!selectedConversation) return
    setIsContactPanelOpen((open) => {
      const next = !open
      setMobilePane(next ? 'contact' : 'thread')
      return next
    })
  }

  function handleCloseContactPanel() {
    setIsContactPanelOpen(false)
    setMobilePane('thread')
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
          selectedConversationId={selectedId}
          onSelect={handleSelect}
          filter={filter}
          onFilterChange={(next) => {
            setFilter(next)
            setChannelIdFilter(null)
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          channels={channelsQuery.data ?? []}
          channelIdFilter={channelIdFilter}
          onChannelIdFilterChange={setChannelIdFilter}
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
          onBack={handleBackToList}
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
