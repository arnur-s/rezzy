import type { MessageRow } from '@/entities/message'
import { m } from '@/paraglide/messages'
import {
  ChatLayoutScrollButton,
  useChatLayoutContext,
} from '@astryxdesign/core/Chat'
import { useEffect, useRef, useState } from 'react'
import {
  diffMessageLists,
  isInterruptingMessage,
  mergePendingMessageIds,
} from '../../utils/message-changes'

/** px from the end beyond which the scroll button becomes visible. */
const BUTTON_THRESHOLD = 100
/** Must match SCROLL_END_THRESHOLD in chat-transcript.tsx. */
const SCROLL_END_THRESHOLD = 80

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

type Props = {
  messages: Array<MessageRow>
  currentUserId: string | null
}

/**
 * Replaces ChatLayout's default scroll button: same placement and chrome
 * (ChatLayoutScrollButton), but the new-messages state counts interrupting
 * appends that arrive while the user reads history, and clears itself when
 * the viewport reaches the end by any means — not only via the button click.
 */
export function ThreadScrollButton({ messages, currentUserId }: Props) {
  const layout = useChatLayoutContext()
  const scrollContainerRef = layout?.scrollContainerRef
  const [isScrolledUp, setIsScrolledUp] = useState(false)
  const [pendingMessageIds, setPendingMessageIds] = useState<Array<string>>([])

  useEffect(() => {
    const el = scrollContainerRef?.current
    if (!el) return
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight
      setIsScrolledUp(dist > BUTTON_THRESHOLD)
      if (dist <= SCROLL_END_THRESHOLD) {
        setPendingMessageIds((current) => (current.length > 0 ? [] : current))
      }
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollContainerRef])

  const prevMessagesRef = useRef(messages)
  useEffect(() => {
    const previous = prevMessagesRef.current
    prevMessagesRef.current = messages
    if (previous === messages) return

    const el = scrollContainerRef?.current
    const isAtEnd =
      !el ||
      el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_END_THRESHOLD
    if (isAtEnd) return

    const { appended } = diffMessageLists(previous, messages)
    const interruptingIds = appended
      .filter((row) => isInterruptingMessage(row, currentUserId))
      .map((row) => row.id)
    if (interruptingIds.length > 0) {
      setPendingMessageIds((current) =>
        mergePendingMessageIds(current, interruptingIds),
      )
    }
  }, [messages, currentUserId, scrollContainerRef])

  const count = pendingMessageIds.length
  // Plural selection belongs to the message catalogue, not to a ternary here:
  // Russian needs three forms (1 / 2-4 / 5-20) and no two-branch conditional
  // can produce them.
  const label = count > 0 ? m.inbox_new_messages_button({ count }) : undefined

  const handleClick = () => {
    const el = scrollContainerRef?.current
    if (!el) return
    el.scrollTo({
      top: el.scrollHeight - el.clientHeight,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
    // Pending state clears in the scroll listener once the end is reached.
  }

  return (
    <ChatLayoutScrollButton
      isVisible={isScrolledUp || count > 0}
      label={label}
      onClick={handleClick}
    />
  )
}
