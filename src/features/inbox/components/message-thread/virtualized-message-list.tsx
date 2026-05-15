import type { MessageRow } from '@/entities/message'
import { m } from '@/paraglide/messages'
import { Button, Chip } from '@heroui/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isNearBottom } from '../../utils/message-scroll'
import type { InitialScrollTarget } from '../../utils/read-cursor'
import { dayKey, formatDayHeading } from '../../utils/relative-time'
import { MessageBubble } from './message-bubble'

type HeadingItem = { kind: 'heading'; key: string; heading: string }
type DividerItem = { kind: 'divider'; key: string }
type MessageItem = { kind: 'message'; key: string; message: MessageRow }
type FlatItem = HeadingItem | DividerItem | MessageItem

type Group = { key: string; heading: string; items: Array<MessageRow> }

function buildGroups(messages: Array<MessageRow>): Array<Group> {
  const acc: Array<Group> = []
  for (const message of messages) {
    const key = dayKey(message.created_at)
    const last = acc.length > 0 ? acc[acc.length - 1] : null
    if (last && last.key === key) {
      last.items.push(message)
    } else {
      acc.push({ key, heading: formatDayHeading(message.created_at), items: [message] })
    }
  }
  return acc
}

function buildFlatItems(
  groups: Array<Group>,
  unreadDividerMessageId: string | null,
): Array<FlatItem> {
  const flat: Array<FlatItem> = []
  for (const group of groups) {
    flat.push({ kind: 'heading', key: `heading:${group.key}`, heading: group.heading })
    for (const message of group.items) {
      if (message.id === unreadDividerMessageId) {
        flat.push({ kind: 'divider', key: `divider:${message.id}` })
      }
      flat.push({ kind: 'message', key: message.id, message })
    }
  }
  return flat
}

type Props = {
  conversationId: string
  messages: Array<MessageRow>
  contactName: string
  initialScrollTarget: InitialScrollTarget
  unreadDividerMessageId: string | null
  readAnchorMessageId: string | null
  markReadMessageId: string | null
  onReadAnchorVisible: (lastReadMessageId: string) => void
}

export function VirtualizedMessageList({
  conversationId,
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
  const lastCountRef = useRef(0)
  const markedReadMessageIdRef = useRef<string | null>(null)
  const [showNewMessagesButton, setShowNewMessagesButton] = useState(false)

  const groups = useMemo(() => buildGroups(messages), [messages])
  const flatItems = useMemo(
    () => buildFlatItems(groups, unreadDividerMessageId),
    [groups, unreadDividerMessageId],
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

  const handleNewMessagesPress = useCallback(() => {
    setShowNewMessagesButton(false)
    virtualizer.scrollToIndex(flatItems.length - 1, { align: 'end' })
  }, [virtualizer, flatItems.length])

  // Reset all state on conversation change.
  useEffect(() => {
    initialScrollDoneRef.current = false
    lastCountRef.current = 0
    markedReadMessageIdRef.current = null
    stickToBottomRef.current = true
    setShowNewMessagesButton(false)
  }, [conversationId])

  // Scroll to the initial target message (or bottom) on first load.
  useEffect(() => {
    if (initialScrollDoneRef.current || flatItems.length === 0) return

    if (!initialScrollTarget.messageId) {
      initialScrollDoneRef.current = true
      return
    }

    const targetIndex = flatItems.findIndex(
      (item) => item.kind === 'message' && item.message.id === initialScrollTarget.messageId,
    )
    if (targetIndex === -1) return

    initialScrollDoneRef.current = true
    stickToBottomRef.current = initialScrollTarget.reason === 'latest'
    virtualizer.scrollToIndex(targetIndex, { align: 'center' })
  }, [conversationId, flatItems, initialScrollTarget, virtualizer])

  // Auto-scroll on new messages: to bottom if near bottom, or show "new messages" button.
  useEffect(() => {
    const count = messages.length
    if (count <= lastCountRef.current) {
      lastCountRef.current = count
      return
    }

    const addedMessages = messages.slice(lastCountRef.current)
    const hasIncomingMessage = addedMessages.some((msg) => msg.direction === 'inbound')

    if (initialScrollDoneRef.current) {
      if (stickToBottomRef.current && flatItems.length > 0) {
        setShowNewMessagesButton(false)
        virtualizer.scrollToIndex(flatItems.length - 1, { align: 'end' })
      } else if (hasIncomingMessage) {
        setShowNewMessagesButton(true)
      }
    }

    lastCountRef.current = count
  }, [messages, flatItems, virtualizer])

  // Check if the read-anchor message is visible and fire onReadAnchorVisible.
  // Uses a ref to keep the scroll handler stable across re-renders.
  const checkReadVisibilityRef = useRef<() => void>(() => {})
  checkReadVisibilityRef.current = useCallback(() => {
    const node = parentRef.current
    if (!node || !markReadMessageId || markedReadMessageIdRef.current === markReadMessageId) return

    const anchorId = readAnchorMessageId ?? markReadMessageId
    const anchorIndex = flatItems.findIndex(
      (item) => item.kind === 'message' && item.message.id === anchorId,
    )
    if (anchorIndex === -1) return

    const anchorItem = virtualizer.getVirtualItems().find((vi) => vi.index === anchorIndex)
    if (!anchorItem) return

    const { scrollTop, clientHeight } = node
    const isVisible =
      anchorItem.start < scrollTop + clientHeight && anchorItem.start + anchorItem.size > scrollTop
    if (!isVisible) return

    markedReadMessageIdRef.current = markReadMessageId
    onReadAnchorVisible(markReadMessageId)
  }, [flatItems, markReadMessageId, onReadAnchorVisible, readAnchorMessageId, virtualizer])

  // Check read visibility whenever relevant dependencies change (e.g. after scrollToIndex).
  useEffect(() => {
    checkReadVisibilityRef.current()
  }, [flatItems, markReadMessageId])

  // Scroll event handler: updates stickToBottom and hides/shows new-message button.
  useEffect(() => {
    const node = parentRef.current
    if (!node) return

    const onScroll = () => {
      const isAtBottom = isNearBottom(node)
      stickToBottomRef.current = isAtBottom
      if (isAtBottom) setShowNewMessagesButton(false)
      checkReadVisibilityRef.current()
    }

    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={parentRef} className="h-full overflow-y-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
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
                  <UnreadDivider />
                ) : (
                  <div className="px-4 pb-3 sm:px-6">
                    <MessageBubble message={item.message} contactName={contactName} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {showNewMessagesButton ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
          <Button
            size="sm"
            variant="primary"
            className="pointer-events-auto shadow-lg"
            onPress={handleNewMessagesPress}
          >
            {m.inbox_new_messages_button()}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function UnreadDivider() {
  return (
    <div className="flex items-center gap-3 px-4 py-1 sm:px-6">
      <div className="h-px flex-1 bg-border/70" />
      <Chip color="accent" size="sm" variant="soft">
        {m.inbox_unread_messages_divider()}
      </Chip>
      <div className="h-px flex-1 bg-border/70" />
    </div>
  )
}
