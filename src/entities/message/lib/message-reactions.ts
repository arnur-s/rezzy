import { normalizeReactionEmoji } from '@/lib/reaction-emoji'
import type { MessageReactionRow } from '../model/types'
import { reactionIdentity } from './reaction-identity'

/**
 * Reaction state derivation: how a list of reaction rows becomes the counters
 * rendered under a bubble. Canonical emoji form lives in
 * `@/lib/reaction-emoji` and row identity in `./reaction-identity`; this
 * module owns folding events into that state and grouping it for display.
 *
 * Reactions are lightweight activity: nothing here notifies, and nothing here
 * feeds an unread-message count.
 */

const CUSTOM_EMOJI_PREFIX = 'custom:'
const CUSTOM_EMOJI_FALLBACK = '💠'

/**
 * A single code point that is pictographic but does not default to emoji
 * presentation (`❤`, `☺`, `✌`) renders as monochrome text without U+FE0F, so
 * the selector stripped for identity has to come back for display. Code points
 * that already default to emoji presentation are left alone — appending a
 * redundant selector produces a non-RGI sequence — and multi-code-point
 * sequences (flags, keycaps, ZWJ) carry their own presentation.
 */
function needsEmojiPresentation(value: string): boolean {
  return (
    [...value].length === 1 &&
    /\p{Extended_Pictographic}/u.test(value) &&
    !/\p{Emoji_Presentation}/u.test(value)
  )
}

/** Custom-emoji reactions arrive as opaque provider ids; render a fallback. */
export function displayReactionEmoji(emoji: string): string {
  const normalized = normalizeReactionEmoji(emoji)
  if (normalized.startsWith(CUSTOM_EMOJI_PREFIX)) return CUSTOM_EMOJI_FALLBACK
  return needsEmojiPresentation(normalized) ? `${normalized}\uFE0F` : normalized
}

/**
 * Folds one reaction row into a list, idempotently: a row matching an existing
 * entry by id or by identity replaces it in place rather than adding a second
 * one, and a `removed` row drops every entry it matches. Applying the same
 * event twice therefore leaves the list — and the counter derived from it —
 * unchanged.
 */
export function applyReactionRow(
  reactions: ReadonlyArray<MessageReactionRow>,
  row: MessageReactionRow,
): Array<MessageReactionRow> {
  const identity = reactionIdentity(row)
  const matches = (item: MessageReactionRow) =>
    item.id === row.id || reactionIdentity(item) === identity

  if (row.action !== 'added') {
    return reactions.filter((item) => !matches(item))
  }

  // Replacing in place keeps the chips in the order the reactions arrived, so a
  // re-delivered event does not shuffle the row under the bubble.
  const next: Array<MessageReactionRow> = []
  let replaced = false
  for (const item of reactions) {
    if (matches(item)) {
      if (!replaced) {
        next.push(row)
        replaced = true
      }
      continue
    }
    next.push(item)
  }
  if (!replaced) next.push(row)
  return next
}

/** Collapses duplicates that a fetched page or a replayed event may contain. */
export function dedupeReactions(
  reactions: ReadonlyArray<MessageReactionRow>,
): Array<MessageReactionRow> {
  return reactions.reduce<Array<MessageReactionRow>>(
    (list, row) => applyReactionRow(list, row),
    [],
  )
}

export type MessageReactionGroup = {
  /** Normalized emoji: the group's identity, not its rendering. */
  emoji: string
  /** Always `reactions.length` — the records are the only source of truth. */
  count: number
  /**
   * Whether our side reacted. Providers attribute a reaction to the connected
   * business account rather than to an individual agent, so this is "the
   * workspace reacted", not "this signed-in user reacted".
   */
  reactedByCurrentUser: boolean
  reactions: Array<MessageReactionRow>
}

/**
 * Groups a message's reactions into rendered chips. A group exists only while
 * it holds records, so a counter can neither go negative nor linger at zero:
 * removing the last reaction removes the group.
 */
export function groupMessageReactions(
  reactions: ReadonlyArray<MessageReactionRow>,
): Array<MessageReactionGroup> {
  const groups = new Map<string, MessageReactionGroup>()

  for (const reaction of dedupeReactions(reactions)) {
    if (reaction.action !== 'added') continue
    const emoji = normalizeReactionEmoji(reaction.emoji)
    if (!emoji) continue

    const group = groups.get(emoji)
    if (group) {
      group.reactions.push(reaction)
      group.count = group.reactions.length
      group.reactedByCurrentUser =
        group.reactedByCurrentUser || !reaction.is_from_contact
      continue
    }
    groups.set(emoji, {
      emoji,
      count: 1,
      reactedByCurrentUser: !reaction.is_from_contact,
      reactions: [reaction],
    })
  }

  return [...groups.values()]
}
