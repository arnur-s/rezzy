// Canonical reaction identity for the webhook pipeline.
//
// Providers disagree on emoji presentation: WhatsApp sends "❤️" (U+2764 U+FE0F)
// while Telegram sends "❤" (U+2764). The same visible reaction must produce the
// same row, so every op is canonicalized before it reaches the unique key
// (channel, provider message, reactor, emoji) — otherwise one reaction becomes
// two rows and a removal callback matches neither of them.
//
// Canonical form is NFC with the presentation selectors dropped. Skin-tone
// modifiers, zero-width joiner sequences, regional indicators, and opaque
// provider identifiers such as `custom:<id>` are left untouched: stripping any
// of those would merge reactions that are genuinely different.
//
// Two more copies exist, in runtimes that cannot import this module:
//   - src/lib/reaction-emoji.ts (the app; display re-qualification lives beside
//     it in src/entities/message and the pipeline never needs it)
//   - public.normalize_reaction_emoji (Postgres, the storage guard added in
//     20260803100000_normalize_reaction_emoji.sql)
// `reaction-emoji.test.ts` pins this copy to the app's.

// Spelled as escapes, not as the characters themselves: these code points are
// invisible, and an invisible character is unreviewable in a diff.
const VARIATION_SELECTORS = /[\uFE0E\uFE0F]/g
const EMOJI_PRESENTATION_SELECTOR = '\uFE0F'

export function normalizeReactionEmoji(emoji: string): string {
  return emoji.trim().normalize('NFC').replace(VARIATION_SELECTORS, '')
}

/**
 * The fully-qualified spelling of a canonical emoji, for providers that expect
 * one on the way out.
 *
 * Canonical form is what we store and compare; it is not what every provider
 * accepts. A single code point that is pictographic but does not default to
 * emoji presentation (`\u2764`, `\u263A`, `\u270C`) needs U+FE0F to be the emoji rather than
 * the dingbat. Code points that already default to emoji presentation are left
 * alone \u2014 appending a redundant selector produces a non-RGI sequence \u2014 and
 * multi-code-point sequences (flags, keycaps, ZWJ) carry their own
 * presentation, so re-qualifying them would corrupt the sequence.
 *
 * Only outbound provider payloads use this. Nothing that decides identity may:
 * qualifying before a comparison would undo the normalization it depends on.
 */
export function qualifyReactionEmoji(emoji: string): string {
  const normalized = normalizeReactionEmoji(emoji)
  const isSingleCodePoint = [...normalized].length === 1
  if (
    isSingleCodePoint &&
    /\p{Extended_Pictographic}/u.test(normalized) &&
    !/\p{Emoji_Presentation}/u.test(normalized)
  ) {
    return `${normalized}${EMOJI_PRESENTATION_SELECTOR}`
  }
  return normalized
}
