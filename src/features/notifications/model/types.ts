import type { Database } from '@/api/types'
import type { ConversationWithRelations } from '@/entities/conversation'
import type { MessageRow } from '@/entities/message'

export type NotificationPreferencesRow =
  Database['public']['Tables']['notification_preferences']['Row']
export type PushSubscriptionRow =
  Database['public']['Tables']['push_subscriptions']['Row']
export type MessageNotificationRow =
  Database['public']['Tables']['message_notifications']['Row']

export const MESSAGE_PREVIEW_MODES = ['full', 'sender_only', 'hidden'] as const
export type MessagePreviewMode = (typeof MESSAGE_PREVIEW_MODES)[number]

export function isMessagePreviewMode(
  value: string,
): value is MessagePreviewMode {
  return (MESSAGE_PREVIEW_MODES as ReadonlyArray<string>).includes(value)
}

export type NotificationPreferences = {
  inAppEnabled: boolean
  desktopEnabled: boolean
  soundEnabled: boolean
  previewMode: MessagePreviewMode
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  inAppEnabled: true,
  desktopEnabled: false,
  soundEnabled: false,
  previewMode: 'full',
}

export type NotificationPermissionState =
  | 'default'
  | 'granted'
  | 'denied'
  | 'unsupported'

/** Subset of the source message needed to render a notification preview. */
export type NotificationMessage = Pick<
  MessageRow,
  | 'id'
  | 'type'
  | 'content'
  | 'metadata'
  | 'media_filename'
  | 'media_mime_type'
  | 'created_at'
  | 'direction'
>

/** Everything the in-app toast needs, hydrated from a notification row. */
export type MessageNotificationDetails = {
  id: string
  workspaceId: string
  conversationId: string
  messageId: string
  createdAt: string
  message: NotificationMessage
  conversation: ConversationWithRelations
}
