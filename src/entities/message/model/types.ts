import type { Tables } from '@/api/types'

export type MessageDirection = 'inbound' | 'outbound'

export const MESSAGE_TYPES = [
  'text',
  'image',
  'video',
  'audio',
  'voice',
  'document',
  'sticker',
  'location',
  'contact',
  'interactive',
  'share',
  'story_reply',
  'story_mention',
  'system',
  'unsupported',
] as const

export type MessageType = (typeof MESSAGE_TYPES)[number]

export const MESSAGE_STATUSES = [
  'sent',
  'delivered',
  'read',
  'played',
  'failed',
] as const

export type MessageStatus = (typeof MESSAGE_STATUSES)[number]

export type MessageRow = Tables<'messages'>

export type MessageAttachmentRow = Tables<'message_attachments'>

export type MessageReactionRow = Tables<'message_reactions'>

/** Message row with the structured attachments embed, when selected. */
export type MessageRowWithAttachments = MessageRow & {
  message_attachments?: Array<MessageAttachmentRow>
}

export function isMessageDirection(value: string): value is MessageDirection {
  return value === 'inbound' || value === 'outbound'
}

export function isMessageType(value: string): value is MessageType {
  return (MESSAGE_TYPES as ReadonlyArray<string>).includes(value)
}

export function isMessageStatus(value: string): value is MessageStatus {
  return (MESSAGE_STATUSES as ReadonlyArray<string>).includes(value)
}
