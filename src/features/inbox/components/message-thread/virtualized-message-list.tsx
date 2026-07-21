import type { MessageRow } from '@/entities/message'
import { Chip, ScrollShadow } from '@heroui/react'
import type { Range } from '@tanstack/react-virtual'
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLoadOlderMessagesSentinel } from '../../hooks/use-load-older-messages-sentinel'
import {
  buildMessageGroups,
  flattenMessageGroups,
} from '../../utils/message-groups'
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

const ESTIMATED_MESSAGE_ITEM_SIZE = 72
const ESTIMATED_HEADING_ITEM_SIZE = 64
const ESTIMATED_DIVIDER_ITEM_SIZE = 44

function scrollToBottom(node: HTMLDivElement) {
  try {
    node.scrollTop = node.scrollHeight
  } catch {
    /* JSDOM: tests may define read-only scrollTop */
  }
}

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
  scrollToLatestNonce: number
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
  scrollToLatestNonce,
}: Props) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const loadOlderSentinelRef = useLoadOlderMessagesSentinel({
    rootRef: parentRef,
    hasMoreOlder,
    isFetchingOlder,
    onLoadOlder,
  })
  const stickToBottomRef = useRef(true)
  // Bottom-anchor intent for the media re-pin observer. Released ONLY by a real
  // upward user scroll (see onScroll), never by the async scroll events a
  // programmatic pin fires mid-cascade — see the non-virtualized list.
  const atBottomRef = useRef(true)
  const lastScrollTopRef = useRef(0)
  const lastScrollHeightRef = useRef(0)
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

  const headingIndexes = useMemo(
    () =>
      flatItems.reduce<Array<number>>((indexes, item, index) => {
        if (item.kind === 'heading') indexes.push(index)
        return indexes
      }, []),
    [flatItems],
  )

  const reversedHeadingIndexes = useMemo(
    () => [...headingIndexes].reverse(),
    [headingIndexes],
  )

  const activeStickyIndexRef = useRef(0)

  const stickyRangeExtractor = useCallback(
    (range: Range) => {
      activeStickyIndexRef.current =
        reversedHeadingIndexes.find((index) => range.startIndex >= index) ?? 0

      return [
        ...new Set([
          activeStickyIndexRef.current,
          ...defaultRangeExtractor(range),
        ]),
      ].sort((a, b) => a - b)
    },
    [reversedHeadingIndexes],
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
    paddingStart: 0,
    paddingEnd: 0,
    rangeExtractor: stickyRangeExtractor,
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

  // Re-selecting the open conversation in the list jumps back to the latest
  // message. Exact pin (scrollTop = scrollHeight), not estimate-based index
  // scrolling. Initialized to the mount-time value so only later bumps trigger.
  const lastHandledScrollNonceRef = useRef(scrollToLatestNonce)
  useEffect(() => {
    if (scrollToLatestNonce === lastHandledScrollNonceRef.current) return
    lastHandledScrollNonceRef.current = scrollToLatestNonce
    const node = parentRef.current
    if (!node) return
    atBottomRef.current = true
    runAfterScrollLayout(
      () => scrollToBottom(node),
      () => {
        scrollToBottom(node)
        const atBottom = isNearBottom(node)
        syncBottomUi(atBottom)
        commitReadIfEligibleRef.current()
      },
    )
  }, [scrollToLatestNonce, syncBottomUi])

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

  // Initial open: always land at the bottom (latest message); the unread divider
  // stays as a visual marker only. Then gated mark-read.
  useEffect(() => {
    if (
      initialScrollDoneRef.current ||
      initialScrollScheduledRef.current ||
      flatItems.length === 0
    )
      return

    initialScrollScheduledRef.current = true

    if (!initialScrollTarget.messageId) {
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

    // Pin via scrollTop = scrollHeight, not scrollToIndex: index scrolling
    // computes the offset from estimated item sizes and lands mid-thread when
    // real bubble heights differ. scrollHeight is always the current true
    // bottom; as items measure, the ResizeObserver below re-pins until stable.
    const scrollToInitialTarget = () => {
      const node = parentRef.current
      if (node) scrollToBottom(node)
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
  }, [flatItems.length, initialScrollTarget.messageId])

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
      const scrollTop = node.scrollTop
      const scrollHeight = node.scrollHeight
      const atBottom = isNearBottom(node)
      // Only a genuine upward user scroll releases the pin — see non-virtualized list.
      const scrolledUp = scrollTop < lastScrollTopRef.current - 1
      const contentShrank = scrollHeight < lastScrollHeightRef.current - 1
      lastScrollTopRef.current = scrollTop
      lastScrollHeightRef.current = scrollHeight

      stickToBottomRef.current = atBottom
      if (atBottom) {
        atBottomRef.current = true
        setShowNewMessagesButton(false)
        setNewMessageCount(0)
        commitReadIfEligibleRef.current()
      } else if (scrolledUp && !contentShrank) {
        atBottomRef.current = false
      }
    }

    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [])

  // Late-loading media grows measured items after the initial scroll; the
  // virtualizer re-measures but does not keep the viewport pinned to the bottom.
  // Re-pin on any content-size change while anchored there (see non-virtualized
  // list for the atBottomRef rationale).
  useEffect(() => {
    const node = parentRef.current
    const content = contentRef.current
    if (!node || !content || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) scrollToBottom(node)
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="relative min-h-0 flex-1 w-full">
      <ScrollShadow
        ref={parentRef}
        className="flex flex-col items-center h-full w-full overflow-y-auto overscroll-contain [overflow-anchor:none] [-webkit-overflow-scrolling:touch]"
      >
        <div
          ref={contentRef}
          className="container flex w-full flex-col px-4 py-6 sm:px-6"
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
              const isHeading = item.kind === 'heading'
              const isActiveSticky =
                isHeading && activeStickyIndexRef.current === virtualItem.index

              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    ...(isHeading ? { zIndex: 1 } : {}),
                    ...(isActiveSticky
                      ? { position: 'sticky', top: 8 }
                      : {
                          position: 'absolute',
                          transform: `translateY(${virtualItem.start}px)`,
                        }),
                    left: 0,
                    width: '100%',
                  }}
                >
                  {isHeading ? (
                    <div className="flex justify-center py-3">
                      <Chip>{item.heading}</Chip>
                    </div>
                  ) : item.kind === 'divider' ? (
                    <UnreadDivider />
                  ) : (
                    <div className="pb-3">
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
