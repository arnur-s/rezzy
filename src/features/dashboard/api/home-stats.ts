import {
  isSnoozeDueSoon,
  isStale,
} from '@/features/dashboard/lib/attention-rules'
import { supabase } from '@/utils/supabase'
import { getUnreadCountsForWorkspaces } from './unread-counts'

/**
 * Supabase caps a response at `max_rows` (1000 in supabase/config.toml) and
 * truncates silently rather than erroring, so an unbounded select does not slow
 * down past the cap — it quietly returns wrong numbers. Asking for one row more
 * than the cap makes the truncation observable instead.
 */
const ROW_LIMIT = 1001

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
  unreadCounts?: Promise<Map<string, number>>,
): Promise<HomeStats> {
  if (workspaceIds.length === 0) {
    return { unreadAssigned: 0, openAssigned: 0, snoozedWaking: 0, staleAssigned: 0 }
  }

  // Only conversations that are open or snoozed can contribute to any of these
  // numbers, so the closed backlog — which grows without bound and is the bulk
  // of a mature workspace — never has to cross the wire. What remains is the
  // agent's own live plate, which is inherently small.
  const [conversationsResult, unreadByConversation] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, status, snoozed_until, last_message_at')
      .eq('assigned_to', userId)
      .in('workspace_id', workspaceIds)
      .in('status', ['open', 'snoozed'])
      .limit(ROW_LIMIT),
    unreadCounts ?? getUnreadCountsForWorkspaces(workspaceIds),
  ])

  if (conversationsResult.error) throw conversationsResult.error

  const { data } = conversationsResult
  warnIfTruncated(data.length, 'home stats')
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

/**
 * Home's numbers are only correct while every qualifying row fits in one
 * response. Past the cap they are silently low, which is worse than an error
 * because the page still looks fine. Nothing user-facing can be said here — the
 * counts are still the best available answer — so this leaves a trail for the
 * next person instead of failing the page.
 */
function warnIfTruncated(rowCount: number, label: string) {
  if (rowCount >= ROW_LIMIT) {
    console.warn(
      `[dashboard] ${label} hit the ${ROW_LIMIT}-row ceiling; counts are undercounted. Move this aggregate into an RPC.`,
    )
  }
}
