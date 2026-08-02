/**
 * Providers disagree on emoji presentation: WhatsApp sends "❤️" (U+2764 U+FE0F)
 * where Telegram sends "❤" (U+2764). Both are the same visible reaction, so
 * every place that decides reaction *identity* — the database unique key, cache
 * grouping, and removal matching — has to compare one canonical form.
 *
 * Canonical form is NFC with the presentation selectors dropped. Everything
 * that carries meaning survives: skin-tone modifiers, zero-width joiner
 * sequences, regional indicators, combining keycaps, and ordinary text pass
 * through unchanged, because stripping any of them would merge reactions that
 * are genuinely different.
 *
 * Canonical is not renderable: a bare U+2764 shows as a monochrome glyph on
 * most platforms, so display re-qualifies it — see `displayReactionEmoji` in
 * `@/entities/message`.
 *
 * Two more copies exist, in runtimes that cannot import this module:
 * `supabase/functions/_shared/reaction-emoji.ts` (Deno) and
 * `public.normalize_reaction_emoji` (Postgres). The Deno copy is pinned to this
 * one by `supabase/functions/_shared/reaction-emoji.test.ts`.
 */
export function normalizeReactionEmoji(emoji: string): string {
  return emoji.trim().normalize('NFC').replace(/[\uFE0E\uFE0F]/gu, '')
}
