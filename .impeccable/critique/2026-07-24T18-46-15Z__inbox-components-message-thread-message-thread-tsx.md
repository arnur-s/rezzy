---
target: src/features/inbox/components/message-thread/message-thread.tsx
total_score: 23
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 3
timestamp: 2026-07-24T18-46-15Z
slug: inbox-components-message-thread-message-thread-tsx
---
Method: dual-agent (A: a3479e085fd69bf90 · B: aae3c4f396c260a51)
Target: src/features/inbox/components/message-thread/message-thread.tsx (Operate surface)
Date: 2026-07-24 · Branch: migrate/heroui-to-astryx (mid HeroUI→astryx migration)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Delivery ticks, "Sending…", optimistic sends solid; initial load silent to screen readers (skeleton aria-hidden), mark-read invisible, no offline state |
| 2 | Match System / Real World | 3 | Chat metaphor natural; emoji-prefixed type placeholders (📷 Image) the one false note in a monochrome system |
| 3 | User Control and Freedom | 2 | Escape silently destroys draft + attachment; thread switch destroys draft; no undo |
| 4 | Consistency and Standards | 3 | Enter/Shift+Enter standard; reply affordance in metadata footer instead of hover toolbar is nonstandard |
| 5 | Error Prevention | 2 | Two unguarded draft-destruction paths; channel-inactive discovered only after failed send |
| 6 | Recognition Rather Than Recall | 3 | Reply bar quotes author + preview; session-persistent unread divider keeps your place |
| 7 | Flexibility and Efficiency | 1 | Zero keyboard shortcuts, canned replies, templates, or in-thread search — weakest axis for "busy, context-switching" reps |
| 8 | Aesthetic and Minimalist Design | 4 | Monochrome discipline genuinely held; grouped runs, ghost media bubbles, 820px shared measure |
| 9 | Error Recovery | 2 | Raw backend error.message shown verbatim in send-failure toast; curated inbox_composer_send_error key exists unused |
| 10 | Help and Documentation | n/a | A thread view is not where docs live; hold-to-record hint exists inline |
| **Total** | | **23/36** | **Acceptable (64%)** |

## Design Specificity Verdict

**LLM assessment:** Authored engineering on an interchangeable visual body (~60/40). The unread machinery is genuinely designed for triage: WhatsApp-style session-persistent divider (message-thread.tsx:131–160), viewport-gated read cursor with 280ms debounce, capped unread prefetch, interrupting-messages-only scroll button. Channel identity threads through composer placeholder, mime gating, header. But strip the header and the thread body is any consumer messenger — no internal notes, canned replies, status actions, or teammate presence; the CRM lives entirely behind an InfoIcon toggle. Front/Intercom (the stated references) put those *in* the thread.

**Deterministic scan:** CLI detector on the message-thread directory: 1 finding — `side-tab` (border-l-2) at message-reply-preview.tsx:34. Contextual near-false-positive: it's the standard messenger quoted-reply affordance, though DESIGN.md's letter bans >1px side stripes. The named target file alone scans clean (exit 0). In-page detector (headless, whole document): 4× low-contrast (4.2:1 muted text on #f1f1f1), 13× undersized 10px text (mostly conversation-list timestamps/previews; in-scope hit: the thread header's "Telegram" channel label), 1× clipped-overflow-container, 2× layout transitions (max-width, padding), 1× single-font "figtree" — notable because DESIGN.md declares no loaded typeface (migration drift, report-only). False positives: gradient-text, marquee, theater-slop-phrase — zero source hits; detector-context artifacts.

**Visual evidence:** headless screenshot only; no user-visible overlay exists. Screenshot confirms: raised composer with transparent field (correct per DESIGN.md), bottom-anchored transcript, but timestamps render with a dangling "·" separator (nothing after it on inbound messages), and the "Today" divider renders as a full-width rule rather than the chip DESIGN.md specifies.

## Overall Impression

The invisible engineering is the best part of this surface: read-cursor gating, optimistic sends, failure recovery on the bubble, monochrome fidelity. What's missing is the CRM in the chat — the thread behaves like a consumer messenger a sales rep happens to be using, and it silently destroys drafts, which is the single most trust-destroying behavior a shared-inbox tool can have.

## What's Working

1. **Read/unread machinery respects real triage** — read commits only when the user genuinely reaches the end; layout churn can't fake it; the divider survives until you leave. Invisible-when-right design.
2. **Visual system fidelity** — transparent textarea inside raised composer, shared 820px measure across skeleton/transcript/composer, prefers-reduced-motion honored in scroll button and mic ping.
3. **Message lifecycle state completeness** — deleted, edited, failed, unsupported, metadata-fallback, transient-empty-cache guard all handled.

## Priority Issues

1. **[P1] Silent draft loss (two paths)** — ChatLayout key remount on thread switch (message-thread.tsx:220) + Escape wipes text/attachment (chat-input.tsx:205–209). Why: a rep juggling 20 conversations loses careful replies with no warning or undo. Fix: per-conversation draft map (context or sessionStorage); Escape cancels reply/attachment first, never clears non-empty text on first press. → /impeccable harden
2. **[P1] Raw error strings at the highest-stakes moment** — message-composer.tsx:57–60 surfaces backend error.message verbatim; curated inbox_composer_send_error sits unused; also un-localized. Fix: map known errors, default to curated key, log raw. → /impeccable clarify
3. **[P1] Screen-reader/keyboard failures cluster** — mic button focusable but keyboard-dead (chat-input.tsx:337–360); textarea's accessible name is its placeholder, which mutates to "Listening…" mid-recording; initial load and unread position silent to SR. Fix: keydown/keyup handlers or remove from tab order; aria-label the textarea; sr-only load/unread announcements. → /impeccable audit
4. **[P2] The Operate surface is missing its operating tools** — close/snooze/reopen buried behind InfoIcon in contact panel; no canned replies. "Reply or route them" requires leaving the thread. Fix: status actions in thread header; canned-replies trigger in composer headerActions. → /impeccable shape
5. **[P2] Detector-backed legibility** — 10px "Telegram" channel label in thread header; 4.2:1 muted-text contrast (needs 4.5:1). Fix: 11px/label tokens per DESIGN.md scale; nudge slate-muted a step darker on quiet-step surfaces. → /impeccable polish

## Persona Red Flags

**Alex (power user):** Escape — the universal "get me out" key — destroys the draft (chat-input.tsx:201–210). No j/k thread nav, no close/snooze shortcut, no templates; the only keydown handling in the whole inbox feature is Enter/Escape in the composer. Reply-to-message requires mouse hover.

**Sam (screen reader/keyboard):** Passes: role="log" aria-live="polite" on message list (new inbound messages announced), reply button reveals on focus, loading-older live region. Fails: keyboard-dead mic button that advertises aria-pressed; field renamed under them mid-recording; no unread-count orientation on thread open; delivery-status SVGs with aria-label but no role="img".

## Minor Observations

- contactName fallback "—" leaks into empty-state copy: "Send the first message to — to start the conversation" (message-thread.tsx:199).
- Plural branching in code (inbox_new_messages_button_one/_many) instead of ICU plurals — will not survive Russian's 3-form plurals.
- Emoji-prefixed type placeholders (📷/🎬/🎤) inject chroma into the monochrome thesis.
- text-info hue on read/played ticks (message-meta.ts:39,45) — not among the three sanctioned status colors.
- No offline detection; a dropped connection routes into the raw-error toast.
- No collapse/clamp for very long messages; a pasted 500-line log owns the viewport.
- Dangling "·" after timestamps on inbound bubbles (visible in screenshot).
- Figtree is the loaded font per detector, but DESIGN.md declares system-font-only — migration drift between astryx theme and DESIGN.md (report-only, not repaired).

## Questions to Consider

1. Why does the composer have voice dictation and an emoji picker before it has canned replies? The persona answers the same five questions all day.
2. Is silent mark-as-read correct for a *shared* inbox? Any rep's glance destroys the unread signal a teammate may have needed.
3. Where is the team in this thread? No presence, no typing, no "Sam replied 30s ago" — the thread behaves as if the user is alone in a multi-workspace team product.
