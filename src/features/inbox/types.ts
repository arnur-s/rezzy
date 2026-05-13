import type { Tables } from '@/api/types'

export const CHANNEL_TYPES = [
  'telegram',
  'whatsapp',
  'instagram',
  'email',
] as const

export type ChannelType = (typeof CHANNEL_TYPES)[number]

export const CONVERSATION_STATUSES = ['open', 'closed', 'snoozed'] as const

export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]

export type MessageDirection = 'inbound' | 'outbound'

export const MESSAGE_TYPES = [
  'text',
  'image',
  'video',
  'audio',
  'voice',
  'document',
  'sticker',
] as const

export type MessageType = (typeof MESSAGE_TYPES)[number]

export const MESSAGE_STATUSES = ['sent', 'delivered', 'read', 'failed'] as const

export type MessageStatus = (typeof MESSAGE_STATUSES)[number]

export type ChannelRow = Tables<'channels'>
export type ContactRow = Tables<'contacts'>
export type MessageRow = Tables<'messages'>
export type ConversationRow = Tables<'conversations'>
export type ProfileRow = Tables<'profiles'>

export type AssignedProfile = Pick<
  ProfileRow,
  'id' | 'full_name' | 'avatar_url'
>

export type ConversationWithRelations = ConversationRow & {
  channel: Pick<ChannelRow, 'id' | 'type' | 'name'>
  contact: Pick<ContactRow, 'id' | 'name' | 'phone' | 'avatar_url' | 'status'>
  /** Joined from profiles when assigned_to is set. */
  assigned_profile: AssignedProfile | null
}

export type ContactWithChannels = ContactRow & {
  contact_channels: Array<{
    id: string
    channel_type: string
    external_name: string | null
  }>
}

export function isChannelType(value: string): value is ChannelType {
  return (CHANNEL_TYPES as ReadonlyArray<string>).includes(value)
}

export function isConversationStatus(
  value: string,
): value is ConversationStatus {
  return (CONVERSATION_STATUSES as ReadonlyArray<string>).includes(value)
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
