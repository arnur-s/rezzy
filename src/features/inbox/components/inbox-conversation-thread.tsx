import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import type { ReactNode } from 'react'
import { useInboxThreadRouteContext } from './inbox-route-context'
import { MessageThread } from './message-thread/message-thread'

type Props = {
  conversationId: string
}

export function InboxConversationThread({ conversationId }: Props) {
  const {
    workspaceId,
    senderId,
    selectedConversation,
    isConversationsPending,
    isConversationsError,
    onBackToList,
    onToggleContactPanel,
    scrollToLatestNonce,
  } = useInboxThreadRouteContext()

  if (isConversationsPending) {
    return null
  }

  if (isConversationsError) {
    return (
      <ThreadStateShell>
        <div className="bg-error/10 text-error rounded-lg px-4 py-3 text-sm">
          {m.inbox_list_load_error()}
        </div>
      </ThreadStateShell>
    )
  }

  if (!selectedConversation || selectedConversation.id !== conversationId) {
    return <InboxConversationUnavailable onBackToList={onBackToList} />
  }

  return (
    <MessageThread
      workspaceId={workspaceId}
      conversation={selectedConversation}
      senderId={senderId}
      onToggleContactPanel={onToggleContactPanel}
      onBack={onBackToList}
      scrollToLatestNonce={scrollToLatestNonce}
    />
  )
}

function InboxConversationUnavailable({
  onBackToList,
}: {
  onBackToList: () => void
}) {
  return (
    <ThreadStateShell>
      <div className="max-w-sm text-center">
        <h2 className="text-base font-semibold text-primary">
          {m.inbox_thread_unavailable_title()}
        </h2>
        <p className="text-primary/60 mt-2 text-sm">
          {m.inbox_thread_unavailable_description()}
        </p>
        <div className="mt-5">
          <Button
            label={m.inbox_thread_back_to_list()}
            variant="secondary"
            onClick={onBackToList}
          />
        </div>
      </div>
    </ThreadStateShell>
  )
}

function ThreadStateShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6">
      {children}
    </div>
  )
}
