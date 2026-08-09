import { getConversationById } from '@/features/inbox/api/conversations'
import { supabase } from '@/utils/supabase'
import type {
  MessageNotificationDetails,
  MessageNotificationRow,
  NotificationMessage,
} from '../model/types'

const NOTIFICATION_MESSAGE_SELECT =
  'id, type, content, metadata, media_filename, media_mime_type, created_at, direction' as const

export type NotificationSource = Pick<
  MessageNotificationRow,
  'id' | 'workspace_id' | 'conversation_id' | 'message_id' | 'created_at'
>

/**
 * Hydrate a notification row into everything the in-app toast needs. Returns
 * null when the source data is no longer accessible (conversation or contact
 * deleted, or the user was removed from the workspace) so callers can skip it
 * gracefully instead of rendering a broken notification.
 */
export async function getMessageNotificationDetails(
  notification: NotificationSource,
): Promise<MessageNotificationDetails | null> {
  const [conversation, message] = await Promise.all([
    getConversationById(notification.conversation_id),
    getNotificationMessage(notification.message_id),
  ])

  if (!conversation || !message) return null

  return {
    id: notification.id,
    workspaceId: notification.workspace_id,
    conversationId: notification.conversation_id,
    messageId: notification.message_id,
    createdAt: notification.created_at,
    message,
    conversation,
  }
}

async function getNotificationMessage(
  messageId: string,
): Promise<NotificationMessage | null> {
  const { data, error } = await supabase
    .from('messages')
    .select(NOTIFICATION_MESSAGE_SELECT)
    .eq('id', messageId)
    .maybeSingle()

  if (error || !data) return null
  return data
}
