import type { MessageRow } from '@/entities/message'
import { Chip } from '@heroui/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildMessageGroups,
  flattenMessageGroups,
} from '../../utils/message-groups'
import { isNearBottom } from '../../utils/message-scroll'
import type { InitialScrollTarget } from '../../utils/read-cursor'
import { MessageBubble } from './message-bubble'
import { NewMessagesButton } from './new-messages-button'
import { UnreadDivider } from './unread-divider'

type Props = {
  messages: Array<MessageRow>
  contactName: string
  initialScrollTarget: InitialScrollTarget
  unreadDividerMessageId: string | null
  readAnchorMessageId: string | null
  markReadMessageId: string | null
  onReadAnchorVisible: (lastReadMessageId: string) => void
}

export function VirtualizedMessageList({
  messages,
  contactName,
  initialScrollTarget,
  unreadDividerMessageId,
  readAnchorMessageId,
  markReadMessageId,
  onReadAnchorVisible,
}: Props) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const initialScrollDoneRef = useRef(false)
  const lastCountRef = useRef(messages.length)
  const markedReadMessageIdRef = useRef<string | null>(null)
  const [frozenDividerMessageId] = useState(() => unreadDividerMessageId)
  const [showNewMessagesButton, setShowNewMessagesButton] = useState(false)
  const [newMessageCount, setNewMessageCount] = useState(0)

  // Stable refs kept current so the once-registered scroll handler can read them.
  const latestMessageIdRef = useRef<string | null>(null)
  const onReadAnchorVisibleRef = useRef(onReadAnchorVisible)
  const tryMarkReadRef = useRef(() => {})

  useEffect(() => {
    latestMessageIdRef.current = messages.at(-1)?.id ?? null
  })
  useEffect(() => {
    onReadAnchorVisibleRef.current = onReadAnchorVisible
  })
  useEffect(() => {
    tryMarkReadRef.current = () => {
      const id = latestMessageIdRef.current
      if (!id || markedReadMessageIdRef.current === id) return
      markedReadMessageIdRef.current = id
      onReadAnchorVisibleRef.current(id)
    }
  })

  const groups = useMemo(() => buildMessageGroups(messages), [messages])
  const flatItems = useMemo(
    () => flattenMessageGroups(groups, frozenDividerMessageId),
    [groups, frozenDividerMessageId],
  )

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    getItemKey: (index) => flatItems[index]?.key ?? index,
    overscan: 8,
    paddingStart: 12,
    paddingEnd: 12,
  })
  const virtualItems = virtualizer.getVirtualItems()

  const handleNewMessagesPress = useCallback(() => {
    setShowNewMessagesButton(false)
    setNewMessageCount(0)
    virtualizer.scrollToIndex(flatItems.length - 1, { align: 'end' })
    tryMarkReadRef.current()
  }, [virtualizer, flatItems.length])

  // Initial scroll: prefer divider item index, then fall back to message item index.
  useEffect(() => {
    if (initialScrollDoneRef.current || flatItems.length === 0) return

    if (!initialScrollTarget.messageId) {
      initialScrollDoneRef.current = true
      stickToBottomRef.current = true
      tryMarkReadRef.current()
      return
    }

    const dividerIndex = flatItems.findIndex((item) => item.kind === 'divider')
    const messageIndex = flatItems.findIndex(
      (item) =>
        item.kind === 'message' &&
        item.message.id === initialScrollTarget.messageId,
    )
    const targetIndex =
      initialScrollTarget.reason === 'first-unread' && dividerIndex !== -1
        ? dividerIndex
        : messageIndex

    if (targetIndex === -1) return

    initialScrollDoneRef.current = true
    // `last-read` means all messages are read → treat as sticky, no button.
    stickToBottomRef.current = initialScrollTarget.reason !== 'first-unread'

    if (initialScrollTarget.reason === 'first-unread') {
      setShowNewMessagesButton(true)
    } else {
      tryMarkReadRef.current()
    }

    virtualizer.scrollToIndex(targetIndex, { align: 'center' })
  }, [flatItems, initialScrollTarget, virtualizer])

  // New-message arrival: outbound always scrolls to bottom; inbound increments count.
  useEffect(() => {
    const count = messages.length

    if (!initialScrollDoneRef.current) {
      lastCountRef.current = count
      return
    }

    if (count > lastCountRef.current) {
      const addedMessages = messages.slice(lastCountRef.current)
      const hasOutbound = addedMessages.some((m) => m.direction === 'outbound')
      const inboundCount = addedMessages.filter(
        (m) => m.direction === 'inbound',
      ).length

      if (stickToBottomRef.current || hasOutbound) {
        stickToBottomRef.current = true
        setShowNewMessagesButton(false)
        setNewMessageCount(0)
        if (flatItems.length > 0) {
          virtualizer.scrollToIndex(flatItems.length - 1, { align: 'end' })
        }
        tryMarkReadRef.current()
      } else if (inboundCount > 0) {
        setShowNewMessagesButton(true)
        setNewMessageCount((prev) => prev + inboundCount)
      }
    }

    lastCountRef.current = count
  }, [messages, flatItems, virtualizer])

  // Geometry-based read visibility check for the initial unread batch.
  const checkReadVisibility = useCallback(() => {
    const node = parentRef.current
    if (
      !node ||
      !markReadMessageId ||
      markedReadMessageIdRef.current === markReadMessageId
    )
      return

    const anchorId = readAnchorMessageId ?? markReadMessageId
    const anchorIndex = flatItems.findIndex(
      (item) => item.kind === 'message' && item.message.id === anchorId,
    )
    if (anchorIndex === -1) return

    const anchorItem = virtualizer
      .getVirtualItems()
      .find((vi) => vi.index === anchorIndex)
    if (!anchorItem) return

    const { scrollTop, clientHeight } = node
    const isVisible =
      anchorItem.start < scrollTop + clientHeight &&
      anchorItem.start + anchorItem.size > scrollTop
    if (!isVisible) return

    markedReadMessageIdRef.current = markReadMessageId
    onReadAnchorVisible(markReadMessageId)
  }, [
    flatItems,
    markReadMessageId,
    onReadAnchorVisible,
    readAnchorMessageId,
    virtualizer,
  ])

  // Keep a ref to the latest checkReadVisibility so the scroll handler
  // (registered once) can call it without re-subscribing on every change.
  const checkReadVisibilityRef = useRef(checkReadVisibility)
  useEffect(() => {
    checkReadVisibilityRef.current = checkReadVisibility
  })

  useEffect(() => {
    const frame = requestAnimationFrame(checkReadVisibility)
    return () => cancelAnimationFrame(frame)
  }, [checkReadVisibility, virtualItems])

  // Scroll event: update sticky ref, mark read when reaching bottom.
  useEffect(() => {
    const node = parentRef.current
    if (!node) return

    const onScroll = () => {
      const isAtBottom = isNearBottom(node)
      stickToBottomRef.current = isAtBottom
      if (isAtBottom) {
        setShowNewMessagesButton(false)
        setNewMessageCount(0)
        tryMarkReadRef.current()
      }
      checkReadVisibilityRef.current()
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

      {showNewMessagesButton ? (
        <NewMessagesButton
          count={newMessageCount}
          onPress={handleNewMessagesPress}
        />
      ) : null}
    </div>
  )
}
