import type { Tables } from '@/api/types'
import type { Channel } from '@/entities/channel'
import type { ContactRow } from '@/entities/contact'

export const CONVERSATION_STATUSES = ['open', 'closed', 'snoozed'] as const

export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]

export type ConversationRow = Tables<'conversations'>
export type ProfileRow = Tables<'profiles'>

export type ConversationWithRelations = ConversationRow & {
  channel: Pick<Channel, 'id' | 'type' | 'name'>
  contact: Pick<ContactRow, 'id' | 'name' | 'phone' | 'avatar_url' | 'status'>
  /**
   * There is deliberately no `assigned_profile` here. `public.profiles` has
   * own-row RLS, so a join or a hand-join from the browser resolves to null for
   * every colleague — a conversation carrying an embedded profile could only
   * ever name you. `assigned_to` is the id; resolve it against the workspace
   * roster (`useWorkspaceMemberLookup`), which is the one query allowed to see
   * past that policy.
   */
  /**
   * Per-agent unread count for the current user, overlaid from the read-cursor
   * RPC (get_workspace_unread_counts). This is a client-side field, not a DB
   * column: the shared conversations.unread_count counter was removed in favor
   * of per-agent unread. Defaults to 0 until the overlay is applied.
   */
  unread_count: number
}

export function isConversationStatus(
  value: string,
): value is ConversationStatus {
  return (CONVERSATION_STATUSES as ReadonlyArray<string>).includes(value)
}
