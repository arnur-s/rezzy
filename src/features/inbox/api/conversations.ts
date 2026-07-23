import type {
  AssignedProfile,
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
  channel:channels!inner(id, type, name),
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

  const conversations = data
  const assignedIds = Array.from(
    new Set(
      conversations
        .map((row) => row.assigned_to)
        .filter((id): id is string => !!id),
    ),
  )

  if (assignedIds.length === 0) {
    return conversations.map((row) => ({
      ...row,
      unread_count: 0,
      assigned_profile: null,
    }))
  }

  const profilesById = await fetchProfilesByIds(assignedIds)

  return conversations.map((row) => ({
    ...row,
    unread_count: 0,
    assigned_profile: row.assigned_to
      ? (profilesById.get(row.assigned_to) ?? null)
      : null,
  }))
}

async function fetchProfilesByIds(
  ids: Array<string>,
): Promise<Map<string, AssignedProfile>> {
  if (ids.length === 0) return new Map()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', ids)

  if (error) {
    throw error
  }

  const map = new Map<string, AssignedProfile>()
  for (const profile of data) {
    map.set(profile.id, profile)
  }
  return map
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

  const conversations = data
  const assignedIds = Array.from(
    new Set(
      conversations
        .map((row) => row.assigned_to)
        .filter((id): id is string => !!id),
    ),
  )

  if (assignedIds.length === 0) {
    return conversations.map((row) => ({
      ...row,
      unread_count: 0,
      assigned_profile: null,
    }))
  }

  const profilesById = await fetchProfilesByIds(assignedIds)

  return conversations.map((row) => ({
    ...row,
    unread_count: 0,
    assigned_profile: row.assigned_to
      ? (profilesById.get(row.assigned_to) ?? null)
      : null,
  }))
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

  const assignedId = data.assigned_to
  if (!assignedId) {
    return { ...data, unread_count: 0, assigned_profile: null }
  }

  const profilesById = await fetchProfilesByIds([assignedId])
  return {
    ...data,
    unread_count: 0,
    assigned_profile: profilesById.get(assignedId) ?? null,
  }
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
