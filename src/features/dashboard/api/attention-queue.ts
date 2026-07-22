import { isChannelType } from '@/entities/channel'
import type { ChannelType } from '@/entities/channel'
import { supabase } from '@/utils/supabase'
import { getUnreadCountsForWorkspaces } from './unread-counts'

const STALE_THRESHOLD_HOURS = 48
const MAX_ITEMS = 10

export type AttentionReason = 'snoozed' | 'unread' | 'stale'

export type AttentionItem = {
  conversationId: string
  workspaceId: string
  contactId: string
  contactName: string
  contactAvatarUrl: string | null
  channelType: ChannelType | null
  channelName: string
  reason: AttentionReason
  /** ISO timestamp relevant to the reason (snoozed_until for snoozed, last_message_at otherwise). */
  timestamp: string
}

export const attentionQueueQueryKeys = {
  all: ['dashboard', 'attention'] as const,
  forUser: (userId: string, workspaceIds: Array<string>) =>
    ['dashboard', 'attention', userId, [...workspaceIds].sort()] as const,
}

const ATTENTION_SELECT = `
  id,
  workspace_id,
  contact_id,
  status,
  last_message_at,
  snoozed_until,
  channel:channels!inner(id, type, name),
  contact:contacts!inner(id, name, avatar_url)
` as const

type Row = {
  id: string
  workspace_id: string
  contact_id: string
  status: string
  last_message_at: string | null
  snoozed_until: string | null
  channel: { id: string; type: string; name: string } | null
  contact: { id: string; name: string | null; avatar_url: string | null } | null
}

export async function getAttentionQueue(
  userId: string,
  workspaceIds: Array<string>,
): Promise<Array<AttentionItem>> {
  if (workspaceIds.length === 0) return []

  const [conversationsResult, unreadByConversation] = await Promise.all([
    supabase
      .from('conversations')
      .select(ATTENTION_SELECT)
      .eq('assigned_to', userId)
      .in('workspace_id', workspaceIds),
    getUnreadCountsForWorkspaces(workspaceIds),
  ])

  if (conversationsResult.error) throw conversationsResult.error

  const { data } = conversationsResult
  const now = Date.now()
  const staleThreshold = now - STALE_THRESHOLD_HOURS * 60 * 60 * 1000

  const items: Array<AttentionItem> = []

  for (const raw of data as Array<Row>) {
    if (!raw.contact || !raw.channel) continue

    const base = {
      conversationId: raw.id,
      workspaceId: raw.workspace_id,
      contactId: raw.contact_id,
      contactName: raw.contact.name?.trim() || 'Untitled contact',
      contactAvatarUrl: raw.contact.avatar_url,
      channelType: isChannelType(raw.channel.type) ? raw.channel.type : null,
      channelName: raw.channel.name,
    }

    if (
      raw.status === 'snoozed' &&
      raw.snoozed_until &&
      Date.parse(raw.snoozed_until) <= now
    ) {
      items.push({ ...base, reason: 'snoozed', timestamp: raw.snoozed_until })
      continue
    }

    if (raw.status === 'open' && (unreadByConversation.get(raw.id) ?? 0) > 0) {
      items.push({
        ...base,
        reason: 'unread',
        timestamp: raw.last_message_at ?? new Date(now).toISOString(),
      })
      continue
    }

    if (
      raw.status === 'open' &&
      raw.last_message_at &&
      Date.parse(raw.last_message_at) < staleThreshold
    ) {
      items.push({ ...base, reason: 'stale', timestamp: raw.last_message_at })
    }
  }

  const reasonOrder: Record<AttentionReason, number> = {
    snoozed: 0,
    unread: 1,
    stale: 2,
  }

  items.sort((a, b) => {
    const r = reasonOrder[a.reason] - reasonOrder[b.reason]
    if (r !== 0) return r
    return Date.parse(b.timestamp) - Date.parse(a.timestamp)
  })

  return items.slice(0, MAX_ITEMS)
}
