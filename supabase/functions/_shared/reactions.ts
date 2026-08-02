// Pure per-provider reaction normalization. Each provider reports reactions
// differently; these helpers translate callbacks into uniform ReactionOp lists
// that the persistence layer upserts idempotently.
//
// Every emoji leaving this module is canonical (see reaction-emoji.ts), so a
// heart from WhatsApp and a heart from Telegram are the same reaction identity.

import { normalizeReactionEmoji } from './reaction-emoji.ts'
import type { ReactionOp } from './types.ts'

/**
 * Telegram `message_reaction` sends the reactor's full old and new reaction
 * sets. Diff them: emojis only in `new` are added, emojis only in `old` are
 * removed. Custom emoji reactions are represented by their custom_emoji_id.
 */
export function diffTelegramReactionSets(args: {
  reactorExternalId: string
  isFromContact: boolean
  oldEmojis: string[]
  newEmojis: string[]
  providerTimestamp: string | null
}): ReactionOp[] {
  // Canonicalize before diffing: a provider that switches variation-selector
  // form between two callbacks otherwise looks like "removed ❤, added ❤".
  const oldSet = new Set(args.oldEmojis.map(normalizeReactionEmoji))
  const newSet = new Set(args.newEmojis.map(normalizeReactionEmoji))
  const ops: ReactionOp[] = []
  for (const emoji of newSet) {
    if (!oldSet.has(emoji)) {
      ops.push({
        reactorExternalId: args.reactorExternalId,
        isFromContact: args.isFromContact,
        emoji,
        action: 'added',
        providerTimestamp: args.providerTimestamp,
      })
    }
  }
  for (const emoji of oldSet) {
    if (!newSet.has(emoji)) {
      ops.push({
        reactorExternalId: args.reactorExternalId,
        isFromContact: args.isFromContact,
        emoji,
        action: 'removed',
        providerTimestamp: args.providerTimestamp,
      })
    }
  }
  return ops
}

/**
 * WhatsApp reaction messages replace the reactor's previous reaction; an empty
 * emoji means "removed". The persistence layer first flips the reactor's other
 * added rows to removed (see applyReactionOps replaceOthers), so this helper
 * only emits the direct op.
 */
export function whatsappReactionOp(args: {
  reactorExternalId: string
  emoji: string | null | undefined
  providerTimestamp: string | null
}): ReactionOp | null {
  const emoji = normalizeReactionEmoji(args.emoji?.trim() ?? '')
  if (!emoji) return null
  return {
    reactorExternalId: args.reactorExternalId,
    isFromContact: true,
    emoji,
    action: 'added',
    providerTimestamp: args.providerTimestamp,
  }
}

/** Instagram sends explicit react / unreact events. */
export function instagramReactionOp(args: {
  reactorExternalId: string
  action: 'react' | 'unreact'
  emoji: string | null | undefined
  reactionName: string | null | undefined
  providerTimestamp: string | null
}): ReactionOp | null {
  const emoji = normalizeReactionEmoji(
    args.emoji?.trim() || args.reactionName?.trim() || '',
  )
  if (!emoji) return null
  return {
    reactorExternalId: args.reactorExternalId,
    isFromContact: true,
    emoji,
    action: args.action === 'react' ? 'added' : 'removed',
    providerTimestamp: args.providerTimestamp,
  }
}
