import { supabase } from '@/utils/supabase'

const CONTACT_CONVERSATION_SELECT = `
  id,
  workspace_id,
  channel_id,
  status,
  last_message_at,
  last_message_preview,
  created_at,
  channel:channels!inner(id, type, name, is_active)
` as const

export type ContactConversation = {
  id: string
  workspace_id: string
  channel_id: string
  status: string
  last_message_at: string | null
  last_message_preview: string | null
  created_at: string
  channel: {
    id: string
    type: string
    name: string | null
    is_active: boolean
  }
}

/**
 * A contact's recent conversations.
 *
 * Deliberately does NOT filter `channel.is_active`, unlike every other
 * conversation query in the app. The inbox is a work queue — you cannot reply
 * through a disconnected channel, so listing those rows there would offer an
 * action that fails. This page is a history. Hiding every conversation that
 * happened on a channel the workspace later disconnected silently rewrites the
 * contact's past and shows "no conversations yet" for someone who only ever
 * talked over a WhatsApp number that was since replaced.
 *
 * The inner join still keeps a conversation whose channel row is missing from
 * rendering nameless, and `is_active` comes back in the payload so the UI can
 * mark the channel disconnected rather than pretending the history is empty.
 */
export async function listContactConversations({
  workspaceId,
  contactId,
  limit = 5,
}: {
  workspaceId: string
  contactId: string
  limit?: number
}): Promise<Array<ContactConversation>> {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONTACT_CONVERSATION_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}
