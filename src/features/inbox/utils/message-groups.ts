import type { MessageRow } from '@/entities/message'
import { dayKey, formatDayHeading } from './relative-time'

export type MessageGroup = {
  key: string
  heading: string
  items: Array<MessageRow>
}

export type HeadingItem = { kind: 'heading'; key: string; heading: string }
export type DividerItem = { kind: 'divider'; key: string }
export type MessageItem = { kind: 'message'; key: string; message: MessageRow }
export type FlatMessageItem = HeadingItem | DividerItem | MessageItem

export function buildMessageGroups(
  messages: Array<MessageRow>,
): Array<MessageGroup> {
  const acc: Array<MessageGroup> = []
  for (const message of messages) {
    const key = dayKey(message.created_at)
    const last = acc.length > 0 ? acc[acc.length - 1] : null
    if (last && last.key === key) {
      last.items.push(message)
    } else {
      acc.push({
        key,
        heading: formatDayHeading(message.created_at),
        items: [message],
      })
    }
  }
  return acc
}

export function flattenMessageGroups(
  groups: Array<MessageGroup>,
  unreadDividerMessageId: string | null,
): Array<FlatMessageItem> {
  const flat: Array<FlatMessageItem> = []
  for (const group of groups) {
    flat.push({
      kind: 'heading',
      key: `heading:${group.key}`,
      heading: group.heading,
    })
    for (const message of group.items) {
      if (message.id === unreadDividerMessageId) {
        flat.push({ kind: 'divider', key: `divider:${message.id}` })
      }
      flat.push({ kind: 'message', key: message.id, message })
    }
  }
  return flat
}
