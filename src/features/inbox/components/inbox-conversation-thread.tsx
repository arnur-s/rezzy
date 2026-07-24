import { Button } from '@/components/button'
import { paneStyle } from '@/components/pane'
import { m } from '@/paraglide/messages'
import { Alert, Skeleton } from '@heroui/react'
import { cn } from '@heroui/styles'
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
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{m.inbox_list_load_error()}</Alert.Title>
          </Alert.Content>
        </Alert>
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
        <h2 className="text-base font-semibold text-foreground">
          {m.inbox_thread_unavailable_title()}
        </h2>
        <p className="mt-2 text-sm text-foreground/60">
          {m.inbox_thread_unavailable_description()}
        </p>
        <Button className="mt-5" variant="outline" onPress={onBackToList}>
          {m.inbox_thread_back_to_list()}
        </Button>
      </div>
    </ThreadStateShell>
  )
}

function InboxConversationThreadSkeleton() {
  return (
    <div className={cn(paneStyle.surface, 'h-full w-full')}>
      <div className="border-border/60 flex h-[64px] shrink-0 items-center gap-3 border-b px-3 py-3 sm:px-6">
        <Skeleton className="size-10 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
        </div>
      </div>
      <div
        className={cn(
          paneStyle.recessed,
          'flex min-h-0 flex-1 flex-col justify-end gap-3 px-4 py-5',
        )}
      >
        <Skeleton className="h-16 w-3/5 rounded-2xl" />
        <Skeleton className="ml-auto h-20 w-2/3 rounded-2xl" />
        <Skeleton className="h-12 w-1/2 rounded-2xl" />
        <Skeleton className="mt-2 h-14 w-full rounded-xl" />
      </div>
    </div>
  )
}

function ThreadStateShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        paneStyle.surface,
        'h-full w-full items-center justify-center px-6',
      )}
    >
      {children}
    </div>
  )
}
