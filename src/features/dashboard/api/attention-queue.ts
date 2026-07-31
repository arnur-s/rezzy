import { isChannelType } from '@/entities/channel'
import type { ChannelType } from '@/entities/channel'
import {
  isSnoozeElapsed,
  isStale,
} from '@/features/dashboard/lib/attention-rules'
import { m } from '@/paraglide/messages'
import { supabase } from '@/utils/supabase'
import { getUnreadCountsForWorkspaces } from './unread-counts'

const MAX_ITEMS = 10

/**
 * Supabase truncates at `max_rows` (1000) silently, so an unbounded select
 * returns a wrong answer rather than a slow one. The status filter below keeps
 * the live set far under this in practice; the ceiling is the backstop.
 */
const ROW_LIMIT = 1001

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
  /** Latest message preview, when the channel recorded one. */
  preview: string | null
}

export type AttentionQueue = {
  /** The MAX_ITEMS most urgent items, ranked snoozed > unread > stale. */
  items: Array<AttentionItem>
  /** Total qualifying items before the cap, so the UI can say "showing N of M". */
  total: number
}

export type UnassignedQueue = {
  /** The most recent items, capped for display. */
  items: Array<UnassignedItem>
  /** Every qualifying conversation, so the UI can be honest about the cap. */
  total: number
}

export type UnassignedItem = {
  conversationId: string
  workspaceId: string
  contactName: string
  channelType: ChannelType | null
  /** ISO timestamp of the latest message. */
  timestamp: string
  /** Latest message preview, when the channel recorded one. */
  preview: string | null
}

export const attentionQueueQueryKeys = {
  all: ['dashboard', 'attention'] as const,
  forUser: (userId: string, workspaceIds: Array<string>) =>
    ['dashboard', 'attention', userId, [...workspaceIds].sort()] as const,
  unassigned: (workspaceIds: Array<string>) =>
    ['dashboard', 'attention', 'unassigned', [...workspaceIds].sort()] as const,
}

const ATTENTION_SELECT = `
  id,
  workspace_id,
  contact_id,
  status,
  last_message_at,
  last_message_preview,
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
  last_message_preview: string | null
  snoozed_until: string | null
  channel: { id: string; type: string; name: string } | null
  contact: { id: string; name: string | null; avatar_url: string | null } | null
}

export async function getAttentionQueue(
  userId: string,
  workspaceIds: Array<string>,
  unreadCounts?: Promise<Map<string, number>>,
): Promise<AttentionQueue> {
  if (workspaceIds.length === 0) return { items: [], total: 0 }

  // Only open and snoozed conversations can qualify for any attention reason,
  // so the closed backlog stays in the database. Ordering by recency means that
  // if the ceiling below is ever reached, what survives is the live edge of the
  // queue rather than an arbitrary slice.
  const [conversationsResult, unreadByConversation] = await Promise.all([
    supabase
      .from('conversations')
      .select(ATTENTION_SELECT)
      .eq('assigned_to', userId)
      .in('workspace_id', workspaceIds)
      .in('status', ['open', 'snoozed'])
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(ROW_LIMIT),
    unreadCounts ?? getUnreadCountsForWorkspaces(workspaceIds),
  ])

  if (conversationsResult.error) throw conversationsResult.error

  const { data } = conversationsResult
  const now = Date.now()

  const items: Array<AttentionItem> = []

  for (const raw of data as Array<Row>) {
    if (!raw.contact || !raw.channel) continue

    const base = {
      conversationId: raw.id,
      workspaceId: raw.workspace_id,
      contactId: raw.contact_id,
      // Channels do not always send a display name; the row still has to be
      // openable, so it gets a localized stand-in rather than an English
      // literal baked into the data layer.
      contactName: raw.contact.name?.trim() || m.contact_unnamed(),
      contactAvatarUrl: raw.contact.avatar_url,
      channelType: isChannelType(raw.channel.type) ? raw.channel.type : null,
      channelName: raw.channel.name,
      preview: raw.last_message_preview?.trim() || null,
    }

    if (isSnoozeElapsed(raw, now)) {
      // The guard narrowed snoozed_until to non-null.
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

    if (isStale(raw, now)) {
      // The guard narrowed last_message_at to non-null.
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

const UNASSIGNED_LIMIT = 5

/**
 * Unassigned open conversations with the most recent inbound activity —
 * "what just arrived that nobody picked up" as opposed to "what's aging on my
 * plate".
 *
 * Returns the true total alongside the capped page. The count is quoted as a
 * fact in the summary line ("nothing is waiting on you, but N are unclaimed"),
 * so returning the page length would state `UNASSIGNED_LIMIT` with false
 * precision whenever the real number exceeded it — the honesty mechanism
 * lying, in the one sentence built to be trusted.
 */
export async function getUnassignedQueue(
  workspaceIds: Array<string>,
): Promise<UnassignedQueue> {
  if (workspaceIds.length === 0) return { items: [], total: 0 }

  // `count: exact` applies the same filters as the page, so the total the
  // cap hides costs no extra round trip.
  const { data, error, count } = await supabase
    .from('conversations')
    .select(ATTENTION_SELECT, { count: 'exact' })
    .is('assigned_to', null)
    .eq('status', 'open')
    .in('workspace_id', workspaceIds)
    .not('last_message_at', 'is', null)
    .order('last_message_at', { ascending: false })
    .limit(UNASSIGNED_LIMIT)

  if (error) throw error

  const items: Array<UnassignedItem> = []
  for (const raw of data as Array<Row>) {
    if (!raw.contact || !raw.channel || !raw.last_message_at) continue
    items.push({
      conversationId: raw.id,
      workspaceId: raw.workspace_id,
      contactName: raw.contact.name?.trim() || m.contact_unnamed(),
      channelType: isChannelType(raw.channel.type) ? raw.channel.type : null,
      timestamp: raw.last_message_at,
      preview: raw.last_message_preview?.trim() || null,
    })
  }
  // `count` is null only if the server omits the header, in which case the
  // page length is the best available answer and never an overstatement.
  return { items, total: count ?? items.length }
}
