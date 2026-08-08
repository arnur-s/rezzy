import type {
  ConversationStatus,
  ConversationWithRelations,
} from '@/entities/conversation'
import { supabase } from '@/utils/supabase'

const CONVERSATION_SELECT = `
  id,
  workspace_id,
  channel_id,
  contact_id,
  assigned_to,
  status,
  last_message_at,
  last_message_preview,
  snoozed_until,
  external_thread_id,
  last_inbound_at,
  created_at,
  updated_at,
  deleted_at,
  channel:channels!inner(id, type, name, is_active),
  contact:contacts!inner(id, name, phone, avatar_url, status)
` as const

export async function getWorkspaceConversations(
  workspaceId: string,
): Promise<Array<ConversationWithRelations>> {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('channel.is_active', true)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) {
    throw error
  }

  return data.map((row) => ({ ...row, unread_count: 0 }))
}

export async function getWorkspaceConversationsBySearch(
  workspaceId: string,
  searchQuery: string,
): Promise<Array<ConversationWithRelations>> {
  const q = searchQuery.trim()
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('channel.is_active', true)
    .or(
      `last_message_preview.ilike.%${q}%,contacts.name.ilike.%${q}%`,
    )
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) {
    throw error
  }

  return data.map((row) => ({ ...row, unread_count: 0 }))
}

export async function getConversationById(
  conversationId: string,
): Promise<ConversationWithRelations | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .eq('id', conversationId)
    .eq('channel.is_active', true)
    .single()

  if (error) return null

  return { ...data, unread_count: 0 }
}

export async function markConversationRead(
  conversationId: string,
): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  })

  if (error) {
    throw error
  }
}

export async function updateConversationStatus({
  conversationId,
  status,
}: {
  conversationId: string
  status: ConversationStatus
}): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ status })
    .eq('id', conversationId)

  if (error) {
    throw error
  }
}

export async function updateConversationAssignee({
  conversationId,
  assignedTo,
}: {
  conversationId: string
  assignedTo: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ assigned_to: assignedTo })
    .eq('id', conversationId)

  if (error) {
    throw error
  }
}
