import type { MessageRow } from '@/entities/message'
import { m } from '@/paraglide/messages'
import { Chip, ScrollShadow, Spinner } from '@heroui/react'
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLoadOlderMessagesSentinel } from '../../hooks/use-load-older-messages-sentinel'
import { buildMessageGroups } from '../../utils/message-groups'
import {
  isNearBottom,
  preserveScrollTopAfterContentGrowth,
  runAfterScrollLayout,
} from '../../utils/message-scroll'
import type { InitialScrollTarget } from '../../utils/read-cursor'
import { LoadOlderMessagesRegion } from './load-older-messages-region'
import { MessageBubble } from './message-bubble'
import { NewMessagesButton } from './new-messages-button'
import { UnreadDivider } from './unread-divider'
import { VirtualizedMessageList } from './virtualized-message-list'

const MESSAGE_VIRTUALIZATION_THRESHOLD = 80

function scrollToBottom(node: HTMLDivElement) {
  try {
    node.scrollTop = node.scrollHeight
  } catch {
    /* JSDOM: tests may define read-only scrollTop */
  }
}

/** Outbound from the current user; when user id unknown, any outbound counts as own. */
function isOwnOutbound(msg: MessageRow, currentUserId: string | null): boolean {
  if (msg.direction !== 'outbound') return false
  if (currentUserId == null) return true
  return msg.sender_id == null || msg.sender_id === currentUserId
}

/**
 * Inbound or outbound from someone else — should not steal scroll when user is
 * reading history (same as inbound for "new messages" UX).
 */
function isInterruptingMessage(
  msg: MessageRow,
  currentUserId: string | null,
): boolean {
  if (msg.direction === 'inbound') return true
  return msg.direction === 'outbound' && !isOwnOutbound(msg, currentUserId)
}

type Props = {
  conversationId: string
  messages: Array<MessageRow> | undefined
  isLoading: boolean
  isError: boolean
  contactName: string
  currentUserId: string | null
  initialScrollTarget: InitialScrollTarget
  unreadDividerMessageId: string | null
  hasUnreadInboundMessages: boolean
  onReadAnchorVisible: (lastReadMessageId: string) => void
  hasMoreOlder?: boolean
  isFetchingOlder?: boolean
  onLoadOlder?: () => void
}

export function MessageList({
  conversationId,
  messages,
  isLoading,
  isError,
  contactName,
  currentUserId,
  initialScrollTarget,
  unreadDividerMessageId,
  hasUnreadInboundMessages,
  onReadAnchorVisible,
  hasMoreOlder = false,
  isFetchingOlder = false,
  onLoadOlder = () => {},
}: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <p className="text-sm text-danger">{m.inbox_messages_load_error()}</p>
      </div>
    )
  }

  const resolvedMessages = messages ?? []

  return (
    <StableMessageList
      key={conversationId}
      messages={resolvedMessages}
      contactName={contactName}
      currentUserId={currentUserId}
      initialScrollTarget={initialScrollTarget}
      unreadDividerMessageId={unreadDividerMessageId}
      hasUnreadInboundMessages={hasUnreadInboundMessages}
      onReadAnchorVisible={onReadAnchorVisible}
      hasMoreOlder={hasMoreOlder}
      isFetchingOlder={isFetchingOlder}
      onLoadOlder={onLoadOlder}
    />
  )
}

// Captures the virtualization decision once at mount so the component type never
// switches mid-session. Without this, loading older messages can push the count
// past the threshold, causing a remount of VirtualizedMessageList that scrolls to bottom.
function StableMessageList(props: ViewProps) {
  const [isVirtualized] = useState(
    () => props.messages.length > MESSAGE_VIRTUALIZATION_THRESHOLD,
  )
  if (isVirtualized) {
    return <VirtualizedMessageList {...props} />
  }
  return <MessageListView {...props} />
}

type ViewProps = {
  messages: Array<MessageRow>
  contactName: string
  currentUserId: string | null
  initialScrollTarget: InitialScrollTarget
  unreadDividerMessageId: string | null
  hasUnreadInboundMessages: boolean
  onReadAnchorVisible: (lastReadMessageId: string) => void
  hasMoreOlder: boolean
  isFetchingOlder: boolean
  onLoadOlder: () => void
}

function MessageListView({
  messages,
  contactName,
  currentUserId,
  initialScrollTarget,
  unreadDividerMessageId,
  hasUnreadInboundMessages,
  onReadAnchorVisible,
  hasMoreOlder,
  isFetchingOlder,
  onLoadOlder,
}: ViewProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const loadOlderSentinelRef = useLoadOlderMessagesSentinel({
    rootRef: scrollRef,
    hasMoreOlder,
    isFetchingOlder,
    onLoadOlder,
  })
  const stickToBottomRef = useRef(true)
  const initialScrollDoneRef = useRef(false)
  const lastLenRef = useRef(0)
  const lastFirstIdRef = useRef<string | null>(null)
  const lastLastIdRef = useRef<string | null>(null)
  const markedReadMessageIdRef = useRef<string | null>(null)
  const [showNewMessagesButton, setShowNewMessagesButton] = useState(false)
  const [newMessageCount, setNewMessageCount] = useState(0)

  const prevLayoutRef = useRef({
    scrollHeight: 0,
    scrollTop: 0,
    len: 0,
    firstId: null as string | null,
    lastId: null as string | null,
  })

  const latestMessageIdRef = useRef<string | null>(null)
  const onReadAnchorVisibleRef = useRef(onReadAnchorVisible)
  const commitReadIfEligibleRef = useRef(() => {})
  const hasUnreadInboundRef = useRef(hasUnreadInboundMessages)
  const currentUserIdRef = useRef(currentUserId)

  const firstId = messages[0]?.id ?? null
  const lastId = messages.at(-1)?.id ?? null
  const len = messages.length

  useEffect(() => {
    latestMessageIdRef.current = lastId
  }, [lastId])
  useEffect(() => {
    onReadAnchorVisibleRef.current = onReadAnchorVisible
  })
  useEffect(() => {
    hasUnreadInboundRef.current = hasUnreadInboundMessages
  }, [hasUnreadInboundMessages])
  useEffect(() => {
    currentUserIdRef.current = currentUserId
  })
  useEffect(() => {
    commitReadIfEligibleRef.current = () => {
      const root = scrollRef.current
      if (!root || !isNearBottom(root) || !hasUnreadInboundRef.current) return
      const id = latestMessageIdRef.current
      if (!id || markedReadMessageIdRef.current === id) return
      markedReadMessageIdRef.current = id
      onReadAnchorVisibleRef.current(id)
    }
  })

  const groups = useMemo(() => buildMessageGroups(messages), [messages])

  const syncBottomUi = useCallback((atBottom: boolean) => {
    stickToBottomRef.current = atBottom
    if (atBottom) {
      setShowNewMessagesButton(false)
      setNewMessageCount(0)
    }
  }, [])

  const handleNewMessagesPress = useCallback(() => {
    const node = scrollRef.current
    if (!node) return
    runAfterScrollLayout(
      () => scrollToBottom(node),
      () => {
        const atBottom = isNearBottom(node)
        syncBottomUi(atBottom)
        commitReadIfEligibleRef.current()
      },
    )
  }, [syncBottomUi])

  // Restore scroll after older messages are prepended (same last id, new first id).
  useLayoutEffect(() => {
    const node = scrollRef.current
    if (!node) return

    const prev = prevLayoutRef.current
    const isPrepend =
      initialScrollDoneRef.current &&
      len > prev.len &&
      prev.len > 0 &&
      firstId !== prev.firstId &&
      lastId === prev.lastId

    if (isPrepend) {
      node.scrollTop = preserveScrollTopAfterContentGrowth({
        previousScrollHeight: prev.scrollHeight,
        previousScrollTop: node.scrollTop,
        newScrollHeight: node.scrollHeight,
      })
    }

    prevLayoutRef.current = {
      scrollHeight: node.scrollHeight,
      scrollTop: node.scrollTop,
      len,
      firstId,
      lastId,
    }
  }, [len, firstId, lastId])

  // Initial open: scroll to unread divider when present (WhatsApp-style), else bottom; then gated mark-read.
  useEffect(() => {
    if (initialScrollDoneRef.current) return
    const root = scrollRef.current
    if (!root) return

    initialScrollDoneRef.current = true

    const afterLayout = () => {
      const atBottom = isNearBottom(root)
      stickToBottomRef.current = atBottom
      if (atBottom) {
        setShowNewMessagesButton(false)
        setNewMessageCount(0)
      }
      commitReadIfEligibleRef.current()
    }

    if (unreadDividerMessageId) {
      runAfterScrollLayout(() => {
        const el = root.querySelector<HTMLElement>(
          '[data-unread-divider="true"]',
        )
        if (el) {
          try {
            el.scrollIntoView({ block: 'center' })
          } catch {
            /* JSDOM: scrollIntoView may throw */
          }
        } else if (initialScrollTarget.messageId) {
          scrollToBottom(root)
        }
      }, afterLayout)
    } else {
      if (initialScrollTarget.messageId) {
        scrollToBottom(root)
      }
      requestAnimationFrame(() => {
        if (initialScrollTarget.messageId) {
          scrollToBottom(root)
        }
        afterLayout()
      })
    }
  }, [initialScrollTarget.messageId, unreadDividerMessageId])

  // Appended messages: own outbound → bottom; inbound / other outbound when away from bottom → button.
  useEffect(() => {
    const node = scrollRef.current
    if (!node || !initialScrollDoneRef.current) {
      lastLenRef.current = len
      lastFirstIdRef.current = firstId
      lastLastIdRef.current = lastId
      return
    }

    const prevLen = lastLenRef.current
    const prevFirst = lastFirstIdRef.current
    const prevLast = lastLastIdRef.current

    const isAppend =
      len > prevLen &&
      prevLen > 0 &&
      firstId === prevFirst &&
      lastId !== prevLast
    const isPrepend =
      len > prevLen &&
      prevLen > 0 &&
      firstId !== prevFirst &&
      lastId === prevLast

    if (isPrepend) {
      lastLenRef.current = len
      lastFirstIdRef.current = firstId
      lastLastIdRef.current = lastId
      return
    }

    if (isAppend) {
      const added = messages.slice(prevLen)
      const uid = currentUserIdRef.current
      const ownOutboundAdded = added.some((msg) => isOwnOutbound(msg, uid))
      const interrupting = added.filter((msg) =>
        isInterruptingMessage(msg, uid),
      )
      const interruptingCount = interrupting.length

      if (stickToBottomRef.current || ownOutboundAdded) {
        runAfterScrollLayout(
          () => scrollToBottom(node),
          () => {
            const atBottom = isNearBottom(node)
            syncBottomUi(atBottom)
            commitReadIfEligibleRef.current()
          },
        )
      } else if (interruptingCount > 0) {
        setShowNewMessagesButton(true)
        setNewMessageCount((prev) => prev + interruptingCount)
      }
    }

    lastLenRef.current = len
    lastFirstIdRef.current = firstId
    lastLastIdRef.current = lastId
  }, [len, firstId, lastId, messages, syncBottomUi])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return

    const onScroll = () => {
      const atBottom = isNearBottom(node)
      stickToBottomRef.current = atBottom
      if (atBottom) {
        setShowNewMessagesButton(false)
        setNewMessageCount(0)
        commitReadIfEligibleRef.current()
      }
    }

    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="relative min-h-0 flex-1 w-full">
      <ScrollShadow
        ref={scrollRef}
        className="flex flex-col items-center h-full w-full overflow-y-auto overscroll-contain [overflow-anchor:none] [-webkit-overflow-scrolling:touch]"
      >
        <div className="container flex flex-col gap-6 px-4 py-6 sm:px-6">
          <LoadOlderMessagesRegion
            sentinelRef={loadOlderSentinelRef}
            isFetchingOlder={isFetchingOlder}
            hasMoreOlder={hasMoreOlder}
          />
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-3">
              <div className="flex justify-center sticky top-2">
                <Chip>{group.heading}</Chip>
              </div>
              {group.items.map((message) => (
                <Fragment key={message.id}>
                  {message.id === unreadDividerMessageId ? (
                    <UnreadDivider />
                  ) : null}
                  <MessageBubble message={message} contactName={contactName} />
                </Fragment>
              ))}
            </section>
          ))}
        </div>
      </ScrollShadow>

      {showNewMessagesButton && (
        <NewMessagesButton
          count={newMessageCount}
          onPress={handleNewMessagesPress}
        />
      )}
    </div>
  )
}
