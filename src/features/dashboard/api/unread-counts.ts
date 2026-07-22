import { supabase } from '@/utils/supabase'

/**
 * Per-agent unread message counts across the given workspaces, keyed by
 * conversation id. Derived from the caller's read cursor
 * (public.get_unread_counts_for_workspaces), so one agent reading a conversation
 * never affects another agent's unread state. Only conversations with unread
 * messages are present in the map; absent conversations have zero unread.
 */
export async function getUnreadCountsForWorkspaces(
  workspaceIds: Array<string>,
): Promise<Map<string, number>> {
  if (workspaceIds.length === 0) return new Map()

  const { data, error } = await supabase.rpc(
    'get_unread_counts_for_workspaces',
    { p_workspace_ids: workspaceIds },
  )

  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of data) {
    counts.set(row.conversation_id, row.unread_count)
  }
  return counts
}
