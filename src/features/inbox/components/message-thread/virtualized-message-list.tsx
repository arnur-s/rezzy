import type { MessageRow } from '@/entities/message'
import { Chip } from '@heroui/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useRef } from 'react'
import { isNearBottom } from '../../utils/message-scroll'
import { dayKey, formatDayHeading } from '../../utils/relative-time'
import { MessageBubble } from './message-bubble'

const NEAR_BOTTOM_THRESHOLD = 80

type HeadingItem = { kind: 'heading'; key: string; heading: string }
type MessageItem = { kind: 'message'; key: string; message: MessageRow }
type FlatItem = HeadingItem | MessageItem

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

function buildFlatItems(groups: Array<Group>): Array<FlatItem> {
  const flat: Array<FlatItem> = []
  for (const group of groups) {
    flat.push({ kind: 'heading', key: `heading:${group.key}`, heading: group.heading })
    for (const message of group.items) {
      flat.push({ kind: 'message', key: message.id, message })
    }
  }
  return flat
}

type Props = {
  messages: Array<MessageRow>
  contactName: string
}

export function VirtualizedMessageList({ messages, contactName }: Props) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const lastCountRef = useRef(0)
  const lastThreadKeyRef = useRef('')

  const groups = useMemo(() => buildGroups(messages), [messages])
  const flatItems = useMemo(() => buildFlatItems(groups), [groups])

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    getItemKey: (index) => flatItems[index]?.key ?? index,
    overscan: 8,
    paddingStart: 12,
    paddingEnd: 12,
  })

  // Scroll to latest on new messages or thread switch.
  // On thread switch: always scroll regardless of stickToBottom.
  // On new message: scroll only if already near the bottom.
  useEffect(() => {
    const count = messages.length
    if (count === 0) {
      lastCountRef.current = 0
      lastThreadKeyRef.current = ''
      return
    }

    const first = messages[0]!
    const last = messages[count - 1]!
    const threadKey = `${first.id}:${last.id}`
    const isNewThread = threadKey !== lastThreadKeyRef.current
    const isNewMessage = count > lastCountRef.current

    if (isNewThread) {
      stickToBottomRef.current = true
    }

    if ((isNewThread || isNewMessage) && stickToBottomRef.current && flatItems.length > 0) {
      virtualizer.scrollToIndex(flatItems.length - 1, { align: 'end' })
    }

    lastCountRef.current = count
    lastThreadKeyRef.current = threadKey
  }, [messages, flatItems, virtualizer])

  // Track whether user is near the bottom to decide whether to auto-scroll.
  useEffect(() => {
    const node = parentRef.current
    if (!node) return

    const onScroll = () => {
      stickToBottomRef.current = isNearBottom(node, NEAR_BOTTOM_THRESHOLD)
    }

    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = flatItems[virtualItem.index]
          if (!item) return null

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
  )
}
