import { CHANNEL_TYPES, isChannelType } from '@/entities/channel'
import type { ChannelType } from '@/entities/channel'
import { isConversationStatus } from '@/entities/conversation'
import { supabase } from '@/utils/supabase'
import { getUnreadCountsForWorkspaces } from './unread-counts'
import { readDashboardPages } from './read-dashboard-pages'

export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  stats: (workspaceIds: Array<string>) =>
    ['dashboard', 'stats', [...workspaceIds].sort()] as const,
}

export type WorkspaceDashboardStats = {
  workspaceId: string
  unread: number
  open: number
  channels: number
  contacts: number
  channelTypes: Array<ChannelType>
  lastMessageAt: string | null
}

export type DashboardStats = {
  aggregate: {
    unread: number
    open: number
    channels: number
    contacts: number
  }
  perWorkspace: Array<WorkspaceDashboardStats>
}

export async function getDashboardStats(
  workspaceIds: Array<string>,
  unreadCounts?: Promise<Map<string, number>>,
): Promise<DashboardStats> {
  if (workspaceIds.length === 0) {
    return {
      aggregate: { unread: 0, open: 0, channels: 0, contacts: 0 },
      perWorkspace: [],
    }
  }

  const [conversations, channels, contacts, unreadByConversation] =
    await Promise.all([
      readDashboardPages((from, to) =>
        supabase
          .from('conversations')
          .select('id, workspace_id, status, last_message_at')
          .in('workspace_id', workspaceIds)
          .order('id', { ascending: true })
          .range(from, to),
      ),
      readDashboardPages((from, to) =>
        supabase
          .from('channels')
          .select('workspace_id, type')
          .in('workspace_id', workspaceIds)
          .order('id', { ascending: true })
          .range(from, to),
      ),
      readDashboardPages((from, to) =>
        supabase
          .from('contacts')
          .select('workspace_id')
          .in('workspace_id', workspaceIds)
          .order('id', { ascending: true })
          .range(from, to),
      ),
      unreadCounts ?? getUnreadCountsForWorkspaces(workspaceIds),
    ])

  const perWorkspace = new Map<string, WorkspaceDashboardStats>()
  for (const id of workspaceIds) {
    perWorkspace.set(id, {
      workspaceId: id,
      unread: 0,
      open: 0,
      channels: 0,
      contacts: 0,
      channelTypes: [],
      lastMessageAt: null,
    })
  }

  const channelTypesByWorkspace = new Map<string, Set<ChannelType>>()
  for (const id of workspaceIds) {
    channelTypesByWorkspace.set(id, new Set())
  }

  for (const row of conversations) {
    const entry = perWorkspace.get(row.workspace_id)
    if (!entry) continue
    entry.unread += unreadByConversation.get(row.id) ?? 0
    if (isConversationStatus(row.status) && row.status === 'open') {
      entry.open += 1
    }
    if (
      row.last_message_at &&
      (!entry.lastMessageAt || row.last_message_at > entry.lastMessageAt)
    ) {
      entry.lastMessageAt = row.last_message_at
    }
  }

  for (const row of channels) {
    const entry = perWorkspace.get(row.workspace_id)
    if (!entry) continue
    entry.channels += 1
    if (isChannelType(row.type)) {
      channelTypesByWorkspace.get(row.workspace_id)?.add(row.type)
    }
  }

  for (const row of contacts) {
    const entry = perWorkspace.get(row.workspace_id)
    if (!entry) continue
    entry.contacts += 1
  }

  for (const [id, types] of channelTypesByWorkspace) {
    const entry = perWorkspace.get(id)
    if (!entry) continue
    entry.channelTypes = CHANNEL_TYPES.filter((t) => types.has(t))
  }

  const perWorkspaceArray = workspaceIds
    .map((id) => perWorkspace.get(id))
    .filter((entry): entry is WorkspaceDashboardStats => entry !== undefined)

  const aggregate = perWorkspaceArray.reduce(
    (acc, entry) => ({
      unread: acc.unread + entry.unread,
      open: acc.open + entry.open,
      channels: acc.channels + entry.channels,
      contacts: acc.contacts + entry.contacts,
    }),
    { unread: 0, open: 0, channels: 0, contacts: 0 },
  )

  return { aggregate, perWorkspace: perWorkspaceArray }
}
