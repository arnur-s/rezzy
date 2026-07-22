import type { MessageRow } from '@/entities/message'
import { Chip, ScrollShadow } from '@heroui/react'
import type { Range } from '@tanstack/react-virtual'
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLoadOlderMessagesSentinel } from '../../hooks/use-load-older-messages-sentinel'
import {
  diffMessageLists,
  isInterruptingMessage,
  isOwnOutboundMessage,
  mergePendingMessageIds,
} from '../../utils/message-changes'
import {
  buildMessageGroups,
  flattenMessageGroups,
} from '../../utils/message-groups'
import { getEligibleReadCommitId } from '../../utils/read-cursor'
import { LoadOlderMessagesRegion } from './load-older-messages-region'
import { MessageBubble } from './message-bubble'
import { NewMessagesButton } from './new-messages-button'
import { UnreadDivider } from './unread-divider'

const ESTIMATED_MESSAGE_ITEM_SIZE = 72
/**
 * A scroll away from the end releases the bottom pin only when it happens
 * within this window after real user input (wheel, touch, scrollbar, keys).
 * Long enough to cover trackpad/touch momentum, short enough that later
 * layout churn cannot masquerade as the user leaving the end.
 */
const USER_SCROLL_INTENT_WINDOW_MS = 2000
const ESTIMATED_HEADING_ITEM_SIZE = 64
const ESTIMATED_DIVIDER_ITEM_SIZE = 44
/** px from the transcript end within which the viewport counts as "at the end". */
const SCROLL_END_THRESHOLD = 80
/**
 * Breathing room above the first item, owned by the virtualizer (not CSS
 * padding) so virtual offsets match DOM scroll offsets exactly. There is
 * deliberately no `paddingEnd`: end-anchored growth corrections clamp against
 * the last row's real overflow, so trailing virtualizer padding would leave
 * the viewport short of the true bottom by exactly that padding. Bottom
 * spacing comes from each row's own padding instead.
 */
const TRANSCRIPT_PADDING_START = 24

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

type Props = {
  messages: Array<MessageRow>
  contactName: string
  currentUserId: string | null
  unreadDividerMessageId: string | null
  hasUnreadInboundMessages: boolean
  onReadAnchorVisible: (lastReadMessageId: string) => void
  hasMoreOlder: boolean
  isFetchingOlder: boolean
  onLoadOlder: () => void
  scrollToLatestNonce: number
}

/**
 * The single message transcript. TanStack Virtual's chat APIs own the scroll
 * behavior: `anchorTo: 'end'` keeps prepends and mid-list growth anchored,
 * `followOnAppend` keeps a pinned viewport on new tail messages, and
 * `scrollToEnd()` / `isAtEnd()` are the only positioning primitives used.
 */
export function VirtualizedMessageList({
  messages,
  contactName,
  currentUserId,
  unreadDividerMessageId,
  hasUnreadInboundMessages,
  onReadAnchorVisible,
  hasMoreOlder,
  isFetchingOlder,
  onLoadOlder,
  scrollToLatestNonce,
}: Props) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const loadOlderSentinelRef = useLoadOlderMessagesSentinel({
    rootRef: parentRef,
    hasMoreOlder,
    isFetchingOlder,
    onLoadOlder,
  })

  /** IDs of interrupting messages that arrived while the user was away from the end. */
  const [pendingMessageIds, setPendingMessageIds] = useState<Array<string>>([])

  // Pin state: was the user at the transcript end? Updated from scroll events
  // with `virtualizer.isAtEnd()` as the source of truth, but *released* only
  // when the scroll follows recent user input (wheel / touch / scrollbar /
  // keys). Late-loading media can shrink rows and clamp scrollTop past the end
  // threshold without any user action — such layout churn must never cancel
  // the pin; the onChange corrector below restores the end position instead.
  // Data effects also read this ref because they run after the virtualizer has
  // already applied follow/anchor scrolling for the same commit, so they need
  // the at-end state from before the change.
  const wasAtEndRef = useRef(true)
  const lastUserScrollInputAtRef = useRef(0)

  const markedReadMessageIdRef = useRef<string | null>(null)
  const latestMessageIdRef = useRef<string | null>(null)
  const hasUnreadInboundRef = useRef(hasUnreadInboundMessages)
  const currentUserIdRef = useRef(currentUserId)
  const onReadAnchorVisibleRef = useRef(onReadAnchorVisible)

  useEffect(() => {
    latestMessageIdRef.current = messages.at(-1)?.id ?? null
  }, [messages])
  useEffect(() => {
    hasUnreadInboundRef.current = hasUnreadInboundMessages
  }, [hasUnreadInboundMessages])
  useEffect(() => {
    currentUserIdRef.current = currentUserId
  })
  useEffect(() => {
    onReadAnchorVisibleRef.current = onReadAnchorVisible
  })

  const groups = useMemo(() => buildMessageGroups(messages), [messages])
  const flatItems = useMemo(
    () => flattenMessageGroups(groups, unreadDividerMessageId),
    [groups, unreadDividerMessageId],
  )

  const reversedHeadingIndexes = useMemo(() => {
    const indexes: Array<number> = []
    flatItems.forEach((item, index) => {
      if (item.kind === 'heading') indexes.push(index)
    })
    return indexes.reverse()
  }, [flatItems])

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
    overscan: 8,
    anchorTo: 'end',
    followOnAppend: true,
    scrollEndThreshold: SCROLL_END_THRESHOLD,
    paddingStart: TRANSCRIPT_PADDING_START,
    paddingEnd: 0,
    rangeExtractor: stickyRangeExtractor,
    // Settle-time corrector: on iOS WebKit the virtualizer defers measurement
    // corrections while its own reconcile scroll is running, and without a
    // touch to flush them the initial end position can stick short. When idle,
    // the user's last known position was the end, but the virtualizer reports
    // otherwise, re-issue scrollToEnd. Guarded by isScrolling so it can never
    // fight a user actively scrolling away.
    onChange: (instance) => {
      if (!instance.isScrolling && wasAtEndRef.current && !instance.isAtEnd()) {
        instance.scrollToEnd()
      }
    },
  })
  const virtualItems = virtualizer.getVirtualItems()

  const clearPendingMessages = useCallback(() => {
    setPendingMessageIds((current) => (current.length > 0 ? [] : current))
  }, [])

  const commitReadIfEligible = useCallback(() => {
    const id = getEligibleReadCommitId({
      hasUnreadInboundMessages: hasUnreadInboundRef.current,
      isAtEnd: virtualizer.isAtEnd(),
      latestMessageId: latestMessageIdRef.current,
      lastCommittedMessageId: markedReadMessageIdRef.current,
    })
    if (!id) return
    markedReadMessageIdRef.current = id
    onReadAnchorVisibleRef.current(id)
  }, [virtualizer])

  // Initial open: deterministic bottom positioning, once per conversation
  // (the component is keyed by conversation id, so a switch remounts it and
  // resets every scroll-related ref and state above).
  const didInitialScrollRef = useRef(false)
  useLayoutEffect(() => {
    if (didInitialScrollRef.current || flatItems.length === 0) return
    didInitialScrollRef.current = true
    virtualizer.scrollToEnd()
  }, [flatItems.length, virtualizer])

  // Data changes: classify by stable IDs. Own outbound returns to the end;
  // interrupting appends while away from the end feed the pending counter.
  // Prepends need no handling — anchorTo: 'end' keeps the viewport stable.
  const prevMessagesRef = useRef<Array<MessageRow> | null>(null)
  useEffect(() => {
    const previous = prevMessagesRef.current
    prevMessagesRef.current = messages
    if (previous === messages) return

    if (previous === null) {
      // First data for this conversation: positioning is handled by the
      // initial layout effect; a short thread never scrolls, so commit here.
      commitReadIfEligible()
      return
    }

    const { appended } = diffMessageLists(previous, messages)
    if (appended.length === 0) return

    const userId = currentUserIdRef.current

    if (appended.some((row) => isOwnOutboundMessage(row, userId))) {
      // Sending is explicit intent to return to the live conversation.
      clearPendingMessages()
      virtualizer.scrollToEnd()
      commitReadIfEligible()
      return
    }

    if (wasAtEndRef.current) {
      // followOnAppend keeps the viewport pinned; long threads commit via the
      // resulting scroll event, short (non-scrolling) threads commit here.
      commitReadIfEligible()
      return
    }

    const interruptingIds = appended
      .filter((row) => isInterruptingMessage(row, userId))
      .map((row) => row.id)
    if (interruptingIds.length > 0) {
      setPendingMessageIds((current) =>
        mergePendingMessageIds(current, interruptingIds),
      )
    }
  }, [messages, virtualizer, clearPendingMessages, commitReadIfEligible])

  // Single scroll listener: keeps the pin state fresh and resolves "reached
  // the end" consequences (clear pending, commit read). Reaching the end
  // always re-arms the pin; leaving it requires recent user input so that
  // media-load layout churn cannot silently release it. State updates bail
  // out unless something actually changes.
  useEffect(() => {
    const node = parentRef.current
    if (!node) return

    const markUserScrollInput = () => {
      lastUserScrollInputAtRef.current = Date.now()
    }

    const onScroll = () => {
      if (virtualizer.isAtEnd()) {
        wasAtEndRef.current = true
        clearPendingMessages()
        commitReadIfEligible()
      } else if (
        Date.now() - lastUserScrollInputAtRef.current <
        USER_SCROLL_INTENT_WINDOW_MS
      ) {
        wasAtEndRef.current = false
      }
    }

    const inputEvents = ['wheel', 'touchstart', 'touchmove', 'mousedown', 'keydown'] as const
    for (const event of inputEvents) {
      node.addEventListener(event, markUserScrollInput, { passive: true })
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      for (const event of inputEvents) {
        node.removeEventListener(event, markUserScrollInput)
      }
      node.removeEventListener('scroll', onScroll)
    }
  }, [virtualizer, clearPendingMessages, commitReadIfEligible])

  // The virtualizer re-pins end-anchored *item* growth on its own, but not
  // viewport resizes: height changes (composer growing, mobile keyboard) move
  // the fold, and width changes (pane resize, contact panel) rewrap every
  // message so the batch of re-measurements drifts past the end threshold.
  // Re-pin only when the user was at the end; scrollToEnd()'s reconcile loop
  // absorbs the re-measurement churn.
  useEffect(() => {
    const node = parentRef.current
    if (!node || typeof ResizeObserver === 'undefined') return

    let lastWidth = node.clientWidth
    let lastHeight = node.clientHeight
    const observer = new ResizeObserver(() => {
      const width = node.clientWidth
      const height = node.clientHeight
      if (width === lastWidth && height === lastHeight) return
      lastWidth = width
      lastHeight = height
      if (wasAtEndRef.current) virtualizer.scrollToEnd()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [virtualizer])

  // Re-selecting the open conversation jumps back to the latest message.
  // Initialized to the mount-time value so only later bumps trigger.
  const lastHandledNonceRef = useRef(scrollToLatestNonce)
  useEffect(() => {
    if (scrollToLatestNonce === lastHandledNonceRef.current) return
    lastHandledNonceRef.current = scrollToLatestNonce
    clearPendingMessages()
    virtualizer.scrollToEnd()
    commitReadIfEligible()
  }, [
    scrollToLatestNonce,
    virtualizer,
    clearPendingMessages,
    commitReadIfEligible,
  ])

  const handleNewMessagesPress = useCallback(() => {
    virtualizer.scrollToEnd({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
    // Pending state and the read commit resolve in the scroll listener once
    // the viewport actually reaches the end.
  }, [virtualizer])

  return (
    <div className="relative min-h-0 flex-1 w-full">
      <ScrollShadow
        ref={parentRef}
        className="h-full w-full overflow-y-auto overscroll-contain [overflow-anchor:none] [-webkit-overflow-scrolling:touch]"
      >
        {/* min-h-full + justify-end rests short transcripts against the
            composer; once content overflows, the wrapper grows with it and the
            virtual container's top matches the scroll content's top exactly. */}
        <div className="flex min-h-full w-full flex-col justify-end">
          <div
            data-testid="message-transcript"
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            <div
              ref={loadOlderSentinelRef}
              className="absolute inset-x-0 top-0 h-px"
              aria-hidden
            />
            <LoadOlderMessagesRegion isFetchingOlder={isFetchingOlder} />
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
                  style={
                    isActiveSticky
                      ? { position: 'sticky', top: 8, zIndex: 1, width: '100%' }
                      : {
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualItem.start}px)`,
                          ...(isHeading ? { zIndex: 1 } : {}),
                        }
                  }
                >
                  <div className="container mx-auto w-full px-4 sm:px-6">
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
                </div>
              )
            })}
          </div>
        </div>
      </ScrollShadow>

      {pendingMessageIds.length > 0 && (
        <NewMessagesButton
          count={pendingMessageIds.length}
          onPress={handleNewMessagesPress}
        />
      )}
    </div>
  )
}
