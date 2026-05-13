import type { ChannelType } from '@/features/inbox/types'
import {
  CHANNEL_TYPES,
  isChannelType,
  isConversationStatus,
} from '@/features/inbox/types'
import { supabase } from '@/utils/supabase'

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
): Promise<DashboardStats> {
  if (workspaceIds.length === 0) {
    return {
      aggregate: { unread: 0, open: 0, channels: 0, contacts: 0 },
      perWorkspace: [],
    }
  }

  const [conversationsResult, channelsResult, contactsResult] =
    await Promise.all([
      supabase
        .from('conversations')
        .select('workspace_id, status, unread_count, last_message_at')
        .in('workspace_id', workspaceIds),
      supabase
        .from('channels')
        .select('workspace_id, type')
        .in('workspace_id', workspaceIds),
      supabase
        .from('contacts')
        .select('workspace_id')
        .in('workspace_id', workspaceIds),
    ])

  if (conversationsResult.error) throw conversationsResult.error
  if (channelsResult.error) throw channelsResult.error
  if (contactsResult.error) throw contactsResult.error

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

  for (const row of conversationsResult.data) {
    const entry = perWorkspace.get(row.workspace_id)
    if (!entry) continue
    entry.unread += row.unread_count
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

  for (const row of channelsResult.data) {
    const entry = perWorkspace.get(row.workspace_id)
    if (!entry) continue
    entry.channels += 1
    if (isChannelType(row.type)) {
      channelTypesByWorkspace.get(row.workspace_id)?.add(row.type)
    }
  }

  for (const row of contactsResult.data) {
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
