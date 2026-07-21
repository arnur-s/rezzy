import { supabase } from '@/utils/supabase'

/**
 * Per-agent unread counts for a workspace, keyed by conversation id. Derived
 * from the current user's read cursor (public.get_workspace_unread_counts), so
 * one agent reading a conversation never affects another agent's unread state.
 */
export async function getWorkspaceUnreadCounts(
  workspaceId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('get_workspace_unread_counts', {
    p_workspace_id: workspaceId,
  })

  if (error) throw error

  const counts: Record<string, number> = {}
  for (const row of data) {
    counts[row.conversation_id] = row.unread_count
  }
  return counts
}
