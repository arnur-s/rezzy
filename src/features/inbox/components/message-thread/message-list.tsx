import type { MessageRow } from '@/entities/message'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { Spinner } from '@astryxdesign/core/Spinner'
import { ChatTranscript } from './chat-transcript'
import { MessageThreadEmptyConversation } from './message-thread-empty-conversation'

type Props = {
  conversationId: string
  messages: Array<MessageRow> | undefined
  isLoading: boolean
  isError: boolean
  contactName: string
  contactAvatarUrl?: string
  currentUserId: string | null
  unreadDividerMessageId: string | null
  hasUnreadInboundMessages: boolean
  onReadAnchorVisible: (lastReadMessageId: string) => void
  hasMoreOlder?: boolean
  isFetchingOlder?: boolean
  onLoadOlder?: () => Promise<unknown>
  onRetry?: () => void
  isRetrying?: boolean
  /** Bumped when the user re-selects the open conversation: jump to latest. */
  scrollToLatestNonce?: number
}

/**
 * Loading / error / empty wrapper around the one chat transcript.
 * Keyed by conversation so switching conversations resets all scroll state.
 */
export function MessageList({
  conversationId,
  messages,
  isLoading,
  isError,
  contactName,
  contactAvatarUrl,
  currentUserId,
  unreadDividerMessageId,
  hasUnreadInboundMessages,
  onReadAnchorVisible,
  hasMoreOlder = false,
  isFetchingOlder = false,
  onLoadOlder = () => Promise.resolve(),
  onRetry,
  isRetrying = false,
  scrollToLatestNonce = 0,
}: Props) {
  if (isLoading) {
    // items-end: the transcript opens pinned to its latest message, so the
    // placeholder rests against the composer where content will land.
    return (
      <div className="flex min-h-0 w-full flex-1 items-end justify-center overflow-hidden">
        <span role="status" className="sr-only">
          {m.inbox_thread_loading()}
        </span>
        {/* <MessageThreadSkeleton /> */}
        <Spinner />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-8">
        <div className="bg-error/10 flex w-full max-w-md items-center justify-between gap-2 rounded-lg px-3 py-2">
          <span className="text-error text-sm">
            {m.inbox_messages_load_error()}
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
    )
  }

  const resolvedMessages = messages ?? []

  // Empty thread: only render after initial load completes AND we are not
  // currently fetching older pages — guards against flashing the empty state
  // mid-pagination with a transiently empty cache.
  if (resolvedMessages.length === 0 && !isFetchingOlder) {
    return <MessageThreadEmptyConversation contactName={contactName} />
  }

  return (
    <ChatTranscript
      key={conversationId}
      messages={resolvedMessages}
      contactName={contactName}
      contactAvatarUrl={contactAvatarUrl}
      currentUserId={currentUserId}
      unreadDividerMessageId={unreadDividerMessageId}
      hasUnreadInboundMessages={hasUnreadInboundMessages}
      onReadAnchorVisible={onReadAnchorVisible}
      hasMoreOlder={hasMoreOlder}
      isFetchingOlder={isFetchingOlder}
      onLoadOlder={onLoadOlder}
      scrollToLatestNonce={scrollToLatestNonce}
    />
  )
}
