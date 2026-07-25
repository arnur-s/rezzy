import type { MessageRow } from '@/entities/message'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import {
  ChatMessage,
  ChatMessageList,
  useChatLayoutContext,
} from '@astryxdesign/core/Chat'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  diffMessageLists,
  isOwnOutboundMessage,
} from '../../utils/message-changes'
import {
  buildMessageGroups,
  flattenMessageGroups,
} from '../../utils/message-groups'
import type { FlatMessageItem } from '../../utils/message-groups'
import { getEligibleReadCommitId } from '../../utils/read-cursor'
import { DateSeparator } from './date-separator'
import { MessageBubble } from './message-bubble'
import { TRANSCRIPT_MEASURE } from './transcript-measure'
import { UnreadDivider } from './unread-divider'

/** px from the transcript end within which the viewport counts as "at the end". */
const SCROLL_END_THRESHOLD = 80
/**
 * A scroll away from the end releases the bottom pin only when it happens
 * within this window after real user input (wheel, touch, scrollbar, keys).
 * Long enough to cover trackpad/touch momentum, short enough that later
 * layout churn (late-loading media re-measuring rows) cannot masquerade as
 * the user leaving the end.
 */
const USER_SCROLL_INTENT_WINDOW_MS = 2000
/**
 * A pause this long inside a run reads as a separate moment, so the run's
 * shared timestamp footer breaks and the later bubble states its own time.
 */
const RUN_TIME_BLOCK_MS = 5 * 60 * 1000

type TranscriptRow =
  | { kind: 'heading'; key: string; heading: string }
  | { kind: 'divider'; key: string }
  | { kind: 'run'; key: string; direction: string; messages: Array<MessageRow> }

/**
 * Consecutive messages in the same direction render as one ChatMessage with
 * grouped bubbles; headings and the unread divider break a run.
 */
function buildTranscriptRows(
  flatItems: Array<FlatMessageItem>,
): Array<TranscriptRow> {
  const rows: Array<TranscriptRow> = []
  for (const item of flatItems) {
    if (item.kind === 'message') {
      const last = rows.at(-1)
      if (last?.kind === 'run' && last.direction === item.message.direction) {
        last.messages.push(item.message)
        continue
      }
      rows.push({
        kind: 'run',
        key: `run:${item.message.id}`,
        direction: item.message.direction,
        messages: [item.message],
      })
      continue
    }
    rows.push(item)
  }
  return rows
}

function isNewTimeBlock(message: MessageRow, next: MessageRow): boolean {
  const from = new Date(message.created_at).getTime()
  const to = new Date(next.created_at).getTime()
  if (Number.isNaN(from) || Number.isNaN(to)) return true
  return to - from >= RUN_TIME_BLOCK_MS
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
  onLoadOlder: () => Promise<unknown>
  scrollToLatestNonce: number
}

/**
 * The message transcript on the astryx Chat family. The surrounding ChatLayout
 * owns follow-on-append and the scroll-to-bottom button; this component owns
 * the product behaviors on top: read-cursor commits when the viewport reaches
 * the end, jump-to-latest on send and on re-selecting the open conversation,
 * and loading older pages via ChatMessageList's scroll-to-top action.
 */
export function ChatTranscript({
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
  const layout = useChatLayoutContext()
  const scrollContainerRef = layout?.scrollContainerRef

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

  const isAtEnd = useCallback(() => {
    const el = scrollContainerRef?.current
    if (!el) return true
    return (
      el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_END_THRESHOLD
    )
  }, [scrollContainerRef])

  const scrollToEnd = useCallback(() => {
    const el = scrollContainerRef?.current
    if (!el) return
    el.scrollTop = el.scrollHeight - el.clientHeight
  }, [scrollContainerRef])

  const commitReadIfEligible = useCallback(() => {
    const id = getEligibleReadCommitId({
      hasUnreadInboundMessages: hasUnreadInboundRef.current,
      isAtEnd: isAtEnd(),
      latestMessageId: latestMessageIdRef.current,
      lastCommittedMessageId: markedReadMessageIdRef.current,
    })
    if (!id) return
    markedReadMessageIdRef.current = id
    onReadAnchorVisibleRef.current(id)
  }, [isAtEnd])

  // Initial open: position at the end before first paint, and only then allow
  // the scroll-to-top loader. Without this gate the top sentinel is visible on
  // mount and pages in older history while ChatLayout's spring is still flying
  // toward the bottom.
  const [isPositioned, setIsPositioned] = useState(false)
  // Both callbacks only close over stable refs, so this effectively runs once
  // per mount — and the transcript is keyed by conversation.
  useLayoutEffect(() => {
    scrollToEnd()
    setIsPositioned(true)
    // Short threads never scroll, so the read cursor commits here.
    commitReadIfEligible()
  }, [scrollToEnd, commitReadIfEligible])

  // Single scroll listener with the pin corrector. ChatLayout's own lock
  // releases on any upward scroll, including the synthetic ones Chrome emits
  // when late-loading media re-measures rows above the viewport — so the pin
  // is re-asserted here unless the departure follows recent *user* input.
  // Reaching the end commits the read cursor and re-arms the pin.
  const wasAtEndRef = useRef(true)
  const lastUserScrollInputAtRef = useRef(0)
  useEffect(() => {
    const el = scrollContainerRef?.current
    if (!el) return

    const markUserScrollInput = () => {
      lastUserScrollInputAtRef.current = Date.now()
    }

    const onScroll = () => {
      if (isAtEnd()) {
        wasAtEndRef.current = true
        commitReadIfEligible()
      } else if (
        Date.now() - lastUserScrollInputAtRef.current <
        USER_SCROLL_INTENT_WINDOW_MS
      ) {
        wasAtEndRef.current = false
      } else if (wasAtEndRef.current) {
        // Layout churn moved the viewport off the end without user intent:
        // restore the pin.
        scrollToEnd()
      }
    }

    const inputEvents = [
      'wheel',
      'touchstart',
      'touchmove',
      'mousedown',
      'keydown',
    ] as const
    for (const event of inputEvents) {
      el.addEventListener(event, markUserScrollInput, { passive: true })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      for (const event of inputEvents) {
        el.removeEventListener(event, markUserScrollInput)
      }
      el.removeEventListener('scroll', onScroll)
    }
  }, [scrollContainerRef, isAtEnd, commitReadIfEligible, scrollToEnd])

  // Data changes: own outbound sends jump back to the live conversation; a
  // pinned viewport commits reads as appends arrive (short threads never
  // scroll, so commit directly).
  const prevMessagesRef = useRef<Array<MessageRow> | null>(null)
  useEffect(() => {
    const previous = prevMessagesRef.current
    prevMessagesRef.current = messages
    if (previous === messages) return

    if (previous === null) {
      commitReadIfEligible()
      return
    }

    const { appended } = diffMessageLists(previous, messages)
    if (appended.length === 0) return

    if (appended.some((row) => isOwnOutboundMessage(row, currentUserIdRef.current))) {
      // Sending is explicit intent to return to the live conversation.
      wasAtEndRef.current = true
      scrollToEnd()
      commitReadIfEligible()
      return
    }

    if (wasAtEndRef.current) {
      // ChatLayout's lock keeps the viewport pinned on appends; short
      // (non-scrolling) threads commit here.
      commitReadIfEligible()
    }
  }, [messages, scrollToEnd, commitReadIfEligible])

  // Size changes that fire no scroll event still move the fold: the composer
  // dock growing, the pane narrowing, the mobile keyboard. Observe the scroll
  // container and its direct children (message area + dock) and re-pin when
  // the user was at the end.
  useEffect(() => {
    const el = scrollContainerRef?.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (wasAtEndRef.current) scrollToEnd()
    })
    observer.observe(el)
    for (const child of el.children) observer.observe(child)
    return () => observer.disconnect()
  }, [scrollContainerRef, scrollToEnd])

  // Re-selecting the open conversation jumps back to the latest message.
  const lastHandledNonceRef = useRef(scrollToLatestNonce)
  useEffect(() => {
    if (scrollToLatestNonce === lastHandledNonceRef.current) return
    lastHandledNonceRef.current = scrollToLatestNonce
    wasAtEndRef.current = true
    scrollToEnd()
    commitReadIfEligible()
  }, [scrollToLatestNonce, scrollToEnd, commitReadIfEligible])

  const loadingOlderRef = useRef(false)
  const handleLoadOlder = useCallback(async () => {
    if (loadingOlderRef.current) return
    loadingOlderRef.current = true
    try {
      await onLoadOlder()
    } finally {
      loadingOlderRef.current = false
    }
  }, [onLoadOlder])

  const flatItems = useMemo(
    () =>
      flattenMessageGroups(
        buildMessageGroups(messages),
        unreadDividerMessageId,
      ),
    [messages, unreadDividerMessageId],
  )
  const rows = useMemo(() => buildTranscriptRows(flatItems), [flatItems])
  const lastMessageId = messages.at(-1)?.id ?? null

  // Roving focus across the reply rails. Only the newest message is a Tab
  // stop, so reaching the composer from the transcript costs one stop instead
  // of one per message; the arrows walk the thread from there.
  const handleRailKeys = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.hasAttribute('data-reply-for')) {
      return
    }
    const { key } = event
    if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'Home' && key !== 'End') {
      return
    }
    const rails = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[data-reply-for]'),
    )
    const index = rails.indexOf(target)
    if (index === -1) return
    const next =
      key === 'Home'
        ? 0
        : key === 'End'
          ? rails.length - 1
          : key === 'ArrowUp'
            ? Math.max(0, index - 1)
            : Math.min(rails.length - 1, index + 1)
    if (next === index) return
    // Owning the arrows here also stops them from scrolling the transcript out
    // from under the control that has focus.
    event.preventDefault()
    rails[next].focus()
  }, [])

  return (
    <div
      data-testid="message-transcript"
      // Part of ChatLayout's flex chain: grows so ChatMessageList's spacer can
      // push a short transcript down to rest against the composer.
      className={cn(TRANSCRIPT_MEASURE, 'flex min-h-0 flex-1 flex-col')}
      onKeyDown={handleRailKeys}
    >
      <ChatMessageList
        scrollToTopAction={
          isPositioned && hasMoreOlder && !isFetchingOlder
            ? handleLoadOlder
            : undefined
        }
      >
        {rows.map((row) => {
          if (row.kind === 'heading') {
            return <DateSeparator key={row.key} label={row.heading} />
          }
          if (row.kind === 'divider') {
            return <UnreadDivider key={row.key} />
          }
          const isOutbound = row.direction === 'outbound'
          return (
            <ChatMessage
              key={row.key}
              sender={isOutbound ? 'user' : 'assistant'}
              avatar={
                isOutbound ? undefined : <Avatar size="sm" name={contactName} />
              }
            >
              {row.messages.map((message, index) => {
                const isLastOfRun = index === row.messages.length - 1
                const next = isLastOfRun ? null : row.messages[index + 1]
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    group={
                      row.messages.length === 1
                        ? undefined
                        : index === 0
                          ? 'first'
                          : isLastOfRun
                            ? 'last'
                            : 'middle'
                    }
                    closesRun={next === null || isNewTimeBlock(message, next)}
                    isTabStop={message.id === lastMessageId}
                  />
                )
              })}
            </ChatMessage>
          )
        })}
      </ChatMessageList>
      <span className="sr-only" aria-live="polite">
        {isFetchingOlder ? m.inbox_messages_loading_older() : null}
      </span>
    </div>
  )
}
