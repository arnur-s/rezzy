import { supabase } from '@/utils/supabase'
import type {
  AssignedProfile,
  ConversationStatus,
  ConversationWithRelations,
} from '../types'

const CONVERSATION_SELECT = `
  id,
  workspace_id,
  channel_id,
  contact_id,
  assigned_to,
  status,
  unread_count,
  last_message_at,
  last_message_preview,
  snoozed_until,
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

  const profilesById = await fetchProfilesByIds(assignedIds)

  return conversations.map((row) => ({
    ...row,
    assigned_profile: row.assigned_to ? profilesById.get(row.assigned_to) ?? null : null,
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

export async function markConversationRead(
  conversationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId)

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
