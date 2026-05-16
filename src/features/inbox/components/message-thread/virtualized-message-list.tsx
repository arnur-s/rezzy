import type { MessageRow } from '@/entities/message'
import { Chip } from '@heroui/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  buildMessageGroups,
  flattenMessageGroups,
} from '../../utils/message-groups'
import {
  isNearBottom,
  preserveScrollTopAfterContentGrowth,
  runAfterScrollLayout,
} from '../../utils/message-scroll'
import { useLoadOlderMessagesSentinel } from '../../hooks/use-load-older-messages-sentinel'
import type { InitialScrollTarget } from '../../utils/read-cursor'
import { LoadOlderMessagesRegion } from './load-older-messages-region'
import { MessageBubble } from './message-bubble'
import { NewMessagesButton } from './new-messages-button'
import { UnreadDivider } from './unread-divider'

const ESTIMATED_MESSAGE_ITEM_SIZE = 72
const ESTIMATED_HEADING_ITEM_SIZE = 64
const ESTIMATED_DIVIDER_ITEM_SIZE = 44

function isOwnOutbound(msg: MessageRow, currentUserId: string | null): boolean {
  if (msg.direction !== 'outbound') return false
  if (currentUserId == null) return true
  return msg.sender_id == null || msg.sender_id === currentUserId
}

function isInterruptingMessage(
  msg: MessageRow,
  currentUserId: string | null,
): boolean {
  if (msg.direction === 'inbound') return true
  return msg.direction === 'outbound' && !isOwnOutbound(msg, currentUserId)
}

type Props = {
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

export function VirtualizedMessageList({
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
}: Props) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const loadOlderSentinelRef = useLoadOlderMessagesSentinel({
    rootRef: parentRef,
    hasMoreOlder,
    isFetchingOlder,
    onLoadOlder,
  })
  const stickToBottomRef = useRef(true)
  const initialScrollDoneRef = useRef(false)
  const initialScrollScheduledRef = useRef(false)
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
      const node = parentRef.current
      if (!node || !isNearBottom(node) || !hasUnreadInboundRef.current) return
      const id = latestMessageIdRef.current
      if (!id || markedReadMessageIdRef.current === id) return
      markedReadMessageIdRef.current = id
      onReadAnchorVisibleRef.current(id)
    }
  })

  const groups = useMemo(() => buildMessageGroups(messages), [messages])
  const flatItems = useMemo(
    () => flattenMessageGroups(groups, unreadDividerMessageId),
    [groups, unreadDividerMessageId],
  )

  const lastFlatIndex = flatItems.length > 0 ? flatItems.length - 1 : -1

  const dividerFlatIndex = useMemo(
    () => flatItems.findIndex((item) => item.kind === 'divider'),
    [flatItems],
  )

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const kind = flatItems[index]?.kind
      if (kind === 'divider') return ESTIMATED_DIVIDER_ITEM_SIZE
      if (kind === 'heading') return ESTIMATED_HEADING_ITEM_SIZE
      return ESTIMATED_MESSAGE_ITEM_SIZE
    },
    getItemKey: (index) => flatItems[index]?.key ?? index,
    initialOffset: 0,
    overscan: 8,
    paddingStart: 12,
    paddingEnd: 12,
  })
  const virtualItems = virtualizer.getVirtualItems()

  const syncBottomUi = useCallback((atBottom: boolean) => {
    stickToBottomRef.current = atBottom
    if (atBottom) {
      setShowNewMessagesButton(false)
      setNewMessageCount(0)
    }
  }, [])

  const handleNewMessagesPress = useCallback(() => {
    const node = parentRef.current
    if (!node || flatItems.length === 0) return
    const lastIndex = flatItems.length - 1
    runAfterScrollLayout(
      () =>
        virtualizer.scrollToIndex(lastIndex, {
          align: 'end',
          behavior: 'smooth',
        }),
      () => {
        virtualizer.scrollToIndex(lastIndex, {
          align: 'end',
          behavior: 'smooth',
        })
        const atBottom = isNearBottom(node)
        syncBottomUi(atBottom)
        commitReadIfEligibleRef.current()
      },
    )
  }, [virtualizer, flatItems.length, syncBottomUi])

  useLayoutEffect(() => {
    const node = parentRef.current
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
        previousScrollTop: prev.scrollTop,
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
    if (
      initialScrollDoneRef.current ||
      initialScrollScheduledRef.current ||
      flatItems.length === 0
    )
      return

    initialScrollScheduledRef.current = true

    if (!initialScrollTarget.messageId && dividerFlatIndex < 0) {
      initialScrollDoneRef.current = true
      const node = parentRef.current
      if (node) {
        const atBottom = isNearBottom(node)
        stickToBottomRef.current = atBottom
        if (atBottom) {
          setShowNewMessagesButton(false)
          setNewMessageCount(0)
        }
        commitReadIfEligibleRef.current()
      }
      return
    }

    const scrollToInitialTarget = () => {
      if (dividerFlatIndex >= 0) {
        virtualizer.scrollToIndex(dividerFlatIndex, { align: 'center' })
      } else if (initialScrollTarget.messageId && lastFlatIndex >= 0) {
        virtualizer.scrollToIndex(lastFlatIndex, { align: 'end' })
      }
    }

    runAfterScrollLayout(scrollToInitialTarget, () => {
      scrollToInitialTarget()
      initialScrollDoneRef.current = true
      const node = parentRef.current
      if (node) {
        const atBottom = isNearBottom(node)
        stickToBottomRef.current = atBottom
        if (atBottom) {
          setShowNewMessagesButton(false)
          setNewMessageCount(0)
        }
        commitReadIfEligibleRef.current()
      }
    })
  }, [
    dividerFlatIndex,
    flatItems.length,
    initialScrollTarget.messageId,
    lastFlatIndex,
    virtualizer,
  ])

  useEffect(() => {
    const count = len

    if (!initialScrollDoneRef.current) {
      lastLenRef.current = count
      lastFirstIdRef.current = firstId
      lastLastIdRef.current = lastId
      return
    }

    const prevLen = lastLenRef.current
    const prevFirst = lastFirstIdRef.current
    const prevLast = lastLastIdRef.current

    const isAppend =
      count > prevLen &&
      prevLen > 0 &&
      firstId === prevFirst &&
      lastId !== prevLast
    const isPrepend =
      count > prevLen &&
      prevLen > 0 &&
      firstId !== prevFirst &&
      lastId === prevLast

    if (isPrepend) {
      lastLenRef.current = count
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
        const node = parentRef.current
        const lastIndex = flatItems.length > 0 ? flatItems.length - 1 : -1
        if (node && lastIndex >= 0) {
          runAfterScrollLayout(
            () => virtualizer.scrollToIndex(lastIndex, { align: 'end' }),
            () => {
              virtualizer.scrollToIndex(lastIndex, { align: 'end' })
              const atBottom = isNearBottom(node)
              syncBottomUi(atBottom)
              commitReadIfEligibleRef.current()
            },
          )
        }
      } else if (interruptingCount > 0) {
        setShowNewMessagesButton(true)
        setNewMessageCount((prev) => prev + interruptingCount)
      }
    }

    lastLenRef.current = count
    lastFirstIdRef.current = firstId
    lastLastIdRef.current = lastId
  }, [
    len,
    firstId,
    lastId,
    messages,
    flatItems.length,
    virtualizer,
    syncBottomUi,
  ])

  useEffect(() => {
    const node = parentRef.current
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
    <div className="relative min-h-0 flex-1">
      <div
        ref={parentRef}
        className="h-full overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
      >
        <LoadOlderMessagesRegion
          sentinelRef={loadOlderSentinelRef}
          isFetchingOlder={isFetchingOlder}
          hasMoreOlder={hasMoreOlder}
        />
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const item = flatItems[virtualItem.index]

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {item.kind === 'heading' ? (
                  <div className="flex justify-center px-4 py-3 sm:px-6">
                    <Chip>{item.heading}</Chip>
                  </div>
                ) : item.kind === 'divider' ? (
                  <UnreadDivider className="px-4 sm:px-6" />
                ) : (
                  <div className="px-4 pb-3 sm:px-6">
                    <MessageBubble
                      message={item.message}
                      contactName={contactName}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {showNewMessagesButton && (
        <NewMessagesButton
          count={newMessageCount}
          onPress={handleNewMessagesPress}
        />
      )}
    </div>
  )
}
