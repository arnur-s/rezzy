import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import type { ReactNode } from 'react'
import { MessageThread } from './message-thread/message-thread'
import { useInboxThreadRouteContext } from './inbox-route-context'

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
    return <InboxConversationThreadSkeleton />
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

function InboxConversationThreadSkeleton() {
  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden">
      <div className="border-border/60 flex h-16 shrink-0 items-center gap-3 border-b px-3 py-3 sm:px-6">
        <Skeleton width={40} height={40} radius="rounded" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton width={160} height={16} radius={2} />
          <Skeleton width={112} height={12} radius={2} />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 px-4 py-5">
        <Skeleton width="60%" height={64} radius={4} />
        <div className="ml-auto">
          <Skeleton width="66%" height={80} radius={4} />
        </div>
        <Skeleton width="50%" height={48} radius={4} />
        <Skeleton width="100%" height={56} radius={4} />
      </div>
    </div>
  )
}

function ThreadStateShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6">
      {children}
    </div>
  )
}
