import { Button } from '@/components/button'
import type { MessageRow } from '@/entities/message'
import { m } from '@/paraglide/messages'
import { Alert } from '@heroui/react'
import { MessageThreadEmptyConversation } from './message-thread-empty-conversation'
import { MessageThreadSkeleton } from './message-thread-skeleton'
import { VirtualizedMessageList } from './virtualized-message-list'

type Props = {
  conversationId: string
  messages: Array<MessageRow> | undefined
  isLoading: boolean
  isError: boolean
  contactName: string
  currentUserId: string | null
  unreadDividerMessageId: string | null
  hasUnreadInboundMessages: boolean
  onReadAnchorVisible: (lastReadMessageId: string) => void
  hasMoreOlder?: boolean
  isFetchingOlder?: boolean
  onLoadOlder?: () => void
  onRetry?: () => void
  isRetrying?: boolean
  /** Bumped when the user re-selects the open conversation: jump to latest. */
  scrollToLatestNonce?: number
}

/**
 * Loading / error / empty wrapper around the one virtualized transcript.
 * Keyed by conversation so switching conversations resets all scroll state.
 */
export function MessageList({
  conversationId,
  messages,
  isLoading,
  isError,
  contactName,
  currentUserId,
  unreadDividerMessageId,
  hasUnreadInboundMessages,
  onReadAnchorVisible,
  hasMoreOlder = false,
  isFetchingOlder = false,
  onLoadOlder = () => {},
  onRetry,
  isRetrying = false,
  scrollToLatestNonce = 0,
}: Props) {
  if (isLoading) {
    return (
      <div className="flex min-h-0 w-full flex-1 items-start justify-center overflow-hidden">
        <MessageThreadSkeleton />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-8">
        <Alert status="danger" className="w-full max-w-md">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{m.inbox_messages_load_error()}</Alert.Title>
          </Alert.Content>
          {onRetry ? (
            <Button
              size="sm"
              variant="ghost"
              onPress={onRetry}
              isLoading={isRetrying}
            >
              {m.common_retry()}
            </Button>
          ) : null}
        </Alert>
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
    <VirtualizedMessageList
      key={conversationId}
      messages={resolvedMessages}
      contactName={contactName}
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
