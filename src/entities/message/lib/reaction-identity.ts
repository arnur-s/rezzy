import { normalizeReactionEmoji } from '@/lib/reaction-emoji'
import type { MessageReactionRow } from '../model/types'

/**
 * Canonical form of a reaction row as it enters the client cache.
 *
 * The webhook pipeline and the database both store canonical emoji now, so this
 * is a read-side guard: rows written before the normalizing migration, or by a
 * future integration that skips the shared helpers, would otherwise render the
 * same visible reaction as two chips.
 */
export function canonicalizeReaction(
  row: MessageReactionRow,
): MessageReactionRow {
  const emoji = normalizeReactionEmoji(row.emoji)
  return emoji === row.emoji ? row : { ...row, emoji }
}

/**
 * Client-side mirror of the database reaction key: one reactor holds one emoji
 * on one provider message, per channel. Row ids are not enough on their own —
 * an optimistic entry carries a client-side id until its realtime row arrives,
 * and a provider that respells the emoji produces a second row for what the
 * reactor did once.
 *
 * Keyed on `provider_message_id` rather than `message_id` because a reaction
 * can arrive before its message and have `message_id` backfilled later; the
 * pending row and its backfilled self are the same reaction.
 */
export function reactionIdentity(row: MessageReactionRow): string {
  return [
    row.channel_id,
    row.provider_message_id,
    row.reactor_external_id,
    normalizeReactionEmoji(row.emoji),
  ].join('\t')
}

/**
 * The reactor id recorded for a reaction the workspace sent.
 *
 * Providers attribute an outbound reaction to the connected business account,
 * not to the agent who clicked, and none of them hand back a reactor id for it:
 * Telegram's `setMessageReaction` answers `true`, and WhatsApp answers with a
 * wamid for the reaction message rather than for the reactor. So our side needs
 * a stable id of its own, or the same agent reacting twice would write two rows
 * and count twice.
 *
 * Namespaced with a colon so it cannot collide with a real provider identity —
 * those are numeric (Telegram user id, IGSID) or an E.164 phone (`wa_id`), and
 * none of them contain one. `is_from_contact` stays the semantic flag; this is
 * only the key.
 *
 * Mirrored in `supabase/functions/send-reaction/index.ts`, which cannot import
 * from the Vite app, and pinned by `reaction-identity.test.ts`.
 */
export const OUTBOUND_REACTOR_ID = 'rezzy:business'

/** Whether a row is this workspace's own reaction rather than the contact's. */
export function isOutboundReaction(row: MessageReactionRow): boolean {
  return !row.is_from_contact
}
