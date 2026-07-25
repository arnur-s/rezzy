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

export type AttentionQueue = {
  /** The MAX_ITEMS most urgent items, ranked snoozed > unread > stale. */
  items: Array<AttentionItem>
  /** Total qualifying items before the cap, so the UI can say "showing N of M". */
  total: number
}

export type TeamNewItem = {
  conversationId: string
  workspaceId: string
  contactName: string
  channelType: ChannelType | null
  /** ISO timestamp of the latest message. */
  timestamp: string
}

export const attentionQueueQueryKeys = {
  all: ['dashboard', 'attention'] as const,
  forUser: (userId: string, workspaceIds: Array<string>) =>
    ['dashboard', 'attention', userId, [...workspaceIds].sort()] as const,
  teamNew: (workspaceIds: Array<string>) =>
    ['dashboard', 'attention', 'team-new', [...workspaceIds].sort()] as const,
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
): Promise<AttentionQueue> {
  if (workspaceIds.length === 0) return { items: [], total: 0 }

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

  // Within a reason, urgency direction differs: overdue snoozes and stale
  // threads surface the LONGEST-waiting first; unread surfaces the newest.
  const timeDirection: Record<AttentionReason, 1 | -1> = {
    snoozed: 1,
    unread: -1,
    stale: 1,
  }

  items.sort((a, b) => {
    const r = reasonOrder[a.reason] - reasonOrder[b.reason]
    if (r !== 0) return r
    return (
      (Date.parse(a.timestamp) - Date.parse(b.timestamp)) *
      timeDirection[a.reason]
    )
  })

  return { items: items.slice(0, MAX_ITEMS), total: items.length }
}

const TEAM_NEW_LIMIT = 5

/**
 * Unassigned open conversations with the most recent inbound activity —
 * "what just arrived for the team" as opposed to "what's aging on my plate".
 */
export async function getTeamNewQueue(
  workspaceIds: Array<string>,
): Promise<Array<TeamNewItem>> {
  if (workspaceIds.length === 0) return []

  const { data, error } = await supabase
    .from('conversations')
    .select(ATTENTION_SELECT)
    .is('assigned_to', null)
    .eq('status', 'open')
    .in('workspace_id', workspaceIds)
    .not('last_message_at', 'is', null)
    .order('last_message_at', { ascending: false })
    .limit(TEAM_NEW_LIMIT)

  if (error) throw error

  const items: Array<TeamNewItem> = []
  for (const raw of data as Array<Row>) {
    if (!raw.contact || !raw.channel || !raw.last_message_at) continue
    items.push({
      conversationId: raw.id,
      workspaceId: raw.workspace_id,
      contactName: raw.contact.name?.trim() || 'Untitled contact',
      channelType: isChannelType(raw.channel.type) ? raw.channel.type : null,
      timestamp: raw.last_message_at,
    })
  }
  return items
}
