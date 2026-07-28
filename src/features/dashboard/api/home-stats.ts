import {
  isSnoozeDueSoon,
  isStale,
} from '@/features/dashboard/lib/attention-rules'
import { supabase } from '@/utils/supabase'
import { getUnreadCountsForWorkspaces } from './unread-counts'

export type HomeStats = {
  unreadAssigned: number
  openAssigned: number
  snoozedWaking: number
  staleAssigned: number
}

export const homeStatsQueryKeys = {
  all: ['dashboard', 'home-stats'] as const,
  forUser: (userId: string, workspaceIds: Array<string>) =>
    ['dashboard', 'home-stats', userId, [...workspaceIds].sort()] as const,
}

export async function getHomeStats(
  userId: string,
  workspaceIds: Array<string>,
): Promise<HomeStats> {
  if (workspaceIds.length === 0) {
    return { unreadAssigned: 0, openAssigned: 0, snoozedWaking: 0, staleAssigned: 0 }
  }

  const [conversationsResult, unreadByConversation] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, status, snoozed_until, last_message_at')
      .eq('assigned_to', userId)
      .in('workspace_id', workspaceIds),
    getUnreadCountsForWorkspaces(workspaceIds),
  ])

  if (conversationsResult.error) throw conversationsResult.error

  const { data } = conversationsResult
  const now = Date.now()

  let unreadAssigned = 0
  let openAssigned = 0
  let snoozedWaking = 0
  let staleAssigned = 0

  // The predicates are shared with the attention list, so the number the
  // summary reports and the rows the list shows cannot describe different
  // conversations.
  for (const row of data) {
    if (row.status === 'open') {
      openAssigned += 1
      if ((unreadByConversation.get(row.id) ?? 0) > 0) unreadAssigned += 1
      if (isStale(row, now)) staleAssigned += 1
      continue
    }

    if (isSnoozeDueSoon(row, now)) snoozedWaking += 1
  }

  return { unreadAssigned, openAssigned, snoozedWaking, staleAssigned }
}
