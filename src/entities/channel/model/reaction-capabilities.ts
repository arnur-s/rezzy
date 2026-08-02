import { normalizeReactionEmoji } from '@/lib/reaction-emoji'
import type { ChannelType } from './types'

/**
 * What a provider lets the connected business account do with reactions.
 *
 * Kept as data on the channel rather than as `if (channelType === …)` inside
 * components: the question "can this be reacted to" is asked by the picker, the
 * trigger, the mutation, and the edge function, and four copies of a provider
 * list drift. A provider gained or lost here changes every caller at once.
 */
export type ReactionCapabilities = {
  /** Whether the business account can send a reaction at all. */
  canSend: boolean
  /** Whether an existing reaction can be withdrawn. */
  canRemove: boolean
  /** Whether one emoji can be swapped for another in a single step. */
  canReplace: boolean
  /**
   * Emoji this provider accepts, in canonical form. A provider that rejects an
   * emoji fails the whole send, so the picker only ever offers this list.
   */
  supportedEmoji: ReadonlyArray<string>
}

/**
 * The product's reaction set. Deliberately small: this is a secondary
 * interaction, and every emoji added here has to be accepted by every provider
 * that claims to support it.
 *
 * Canonical form (no presentation selectors) so these compare equal to whatever
 * spelling a provider echoes back — see `@/lib/reaction-emoji`.
 */
export const SUPPORTED_REACTIONS = [
  '👍',
  '❤',
  '😂',
  '😮',
  '😢',
  '🙏',
].map(normalizeReactionEmoji) as ReadonlyArray<string>

const NO_REACTIONS: ReactionCapabilities = {
  canSend: false,
  canRemove: false,
  canReplace: false,
  supportedEmoji: [],
}

/**
 * Per-provider support, from each provider's own reaction contract:
 *
 * - **Telegram** — `setMessageReaction`. A bot may only use emoji from the
 *   chat's available set; all six above are in the standard private-chat set.
 *   An empty reaction list removes, and a new list replaces in one call, so a
 *   swap costs one request rather than a remove followed by an add.
 * - **WhatsApp** — a message of type `reaction` carrying the target `wamid`.
 *   An empty `emoji` removes, and a further reaction replaces the previous one
 *   implicitly, which is the same semantics the inbound pipeline already
 *   assumes (see `whatsappReactionOp`).
 * - **Instagram** — `sender_action: react` on the same `/messages` endpoint the
 *   text sender already uses, with `unreact` to withdraw. Meta documents "any
 *   emoji reaction", and repeating `react` with a different emoji edits the
 *   existing one, so all three operations are available.
 * - **Email** — no such concept.
 */
export const REACTION_CAPABILITIES: Record<ChannelType, ReactionCapabilities> =
  {
    telegram: {
      canSend: true,
      canRemove: true,
      canReplace: true,
      supportedEmoji: SUPPORTED_REACTIONS,
    },
    whatsapp: {
      canSend: true,
      canRemove: true,
      canReplace: true,
      supportedEmoji: SUPPORTED_REACTIONS,
    },
    instagram: {
      canSend: true,
      canRemove: true,
      canReplace: true,
      // Meta documents no restricted list, but the picker still offers only the
      // product's set: an emoji we cannot render back from a webhook is not
      // worth sending.
      supportedEmoji: SUPPORTED_REACTIONS,
    },
    email: NO_REACTIONS,
  }

export function getReactionCapabilities(
  channelType: ChannelType,
): ReactionCapabilities {
  return REACTION_CAPABILITIES[channelType]
}

/** Whether a provider accepts one emoji, compared canonically. */
export function supportsReactionEmoji(
  capabilities: ReactionCapabilities,
  emoji: string,
): boolean {
  const normalized = normalizeReactionEmoji(emoji)
  return capabilities.supportedEmoji.includes(normalized)
}
