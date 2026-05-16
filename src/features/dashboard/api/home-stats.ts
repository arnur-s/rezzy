import { supabase } from '@/utils/supabase'

const SNOOZE_HORIZON_HOURS = 24
const STALE_THRESHOLD_HOURS = 48

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

  const { data, error } = await supabase
    .from('conversations')
    .select('status, unread_count, snoozed_until, last_message_at')
    .eq('assigned_to', userId)
    .in('workspace_id', workspaceIds)

  if (error) throw error

  const now = Date.now()
  const snoozeHorizon = now + SNOOZE_HORIZON_HOURS * 60 * 60 * 1000
  const staleThreshold = now - STALE_THRESHOLD_HOURS * 60 * 60 * 1000

  let unreadAssigned = 0
  let openAssigned = 0
  let snoozedWaking = 0
  let staleAssigned = 0

  for (const row of data) {
    if (row.status === 'open') {
      openAssigned += 1
      if (row.unread_count > 0) unreadAssigned += 1
      if (row.last_message_at && Date.parse(row.last_message_at) < staleThreshold) {
        staleAssigned += 1
      }
      continue
    }

    if (row.status === 'snoozed') {
      if (!row.snoozed_until || Date.parse(row.snoozed_until) <= snoozeHorizon) {
        snoozedWaking += 1
      }
    }
  }

  return { unreadAssigned, openAssigned, snoozedWaking, staleAssigned }
}
