import type { ConversationWithRelations } from '../types'

/** Matches getWorkspaceConversations: last_message_at DESC, nulls last. */
export function sortConversationsByActivity(
  rows: Array<ConversationWithRelations>,
): Array<ConversationWithRelations> {
  return [...rows].sort((a, b) => {
    const ta = a.last_message_at
    const tb = b.last_message_at
    if (ta === tb) return 0
    if (!ta) return 1
    if (!tb) return -1
    return tb.localeCompare(ta)
  })
}
