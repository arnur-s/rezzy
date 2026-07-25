---
target: inbox message thread (message-list.tsx)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-07-25T18-46-43Z
slug: s-inbox-components-message-thread-message-list-tsx
---
⚠️ DEGRADED: single-context (session policy forbids spawning sub-agents unless the user asks)

Surface: inbox message thread (entered via `message-list.tsx` → `chat-transcript.tsx` → `message-bubble.tsx`). Mode: **Operate**.
Evidence: live browser run at 1440×900, signed in as the test account, real Telegram thread with 50 messages.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Delivery ticks, retry, unread divider, aria-live older-page loader all present. Failed sends signal only through an 11px ⚠ in the footer — the bubble itself looks successfully sent. |
| 2 | Match System / Real World | 3 | Natural throughout, except the quoted-reply strip rendering the literal fallback string "Quoted message" as an author name. |
| 3 | User Control and Freedom | 3 | Escape unwinds the reply target before blurring; the composer reply bar has an explicit cancel. Genuinely good. |
| 4 | Consistency and Standards | 2 | Reply lives inside the delivery-status strip. Every comparable product (Slack, Front, Intercom, WhatsApp, Telegram) puts message actions in a rail beside the bubble. The reply glyph is also the same 12px monochrome weight as the retry glyph. |
| 5 | Error Prevention | 2 | On a failed message the footer reads `11:19 AM · ⚠ ↺ ↩`. Reply (28px) sits ~4px from Retry (28px), identical size, weight and color. Retry re-sends to a customer. |
| 6 | Recognition Rather Than Recall | 2 | Reply is `opacity-0` until hover, with no persistent affordance. On touch there is no hover, so the action does not exist. |
| 7 | Flexibility and Efficiency | 2 | No `r` shortcut, no double-click, no swipe. Meanwhile 50 invisible reply buttons stay in the tab order — reaching the composer by keyboard costs 50+ stops. |
| 8 | Aesthetic and Minimalist Design | 2 | Every bubble in a run carries its own footer, so a 21-bubble run renders as 21 timestamp strips and the `group` corner-radius work is visually cancelled. Each footer also reserves a permanent 28px phantom gap for the hidden button. |
| 9 | Error Recovery | 3 | Retry mutation with a toast on failure; composer content is preserved. |
| 10 | Help and Documentation | 2 | Icon-only actions with no visible labels; discovery is entirely hover-driven. |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

## Design Specificity Verdict

**LLM assessment.** The thread is competently built and the scroll/read-cursor engineering underneath it is genuinely careful — but the message row itself is category-interchangeable. Strip the Rezzy header and this is any chat surface. The one place where product character should show — how an agent acts on a specific customer message — is exactly where the design is weakest: the action is hidden, unlabeled, positioned by accident, and sharing a strip with delivery telemetry.

The deeper issue is a category error. The metadata footer is a **status readout** — time, edited, delivery, reactions. Reply is a **user action**. Putting an action inside a readout means its position is determined by whatever telemetry happens to be present on that message. A delivered message puts reply at one x, a failed message pushes it 24px right, a message with reactions moves it again. Nothing about its location is predictable, which is precisely why it feels wrong.

**Deterministic scan.** `detect.mjs` on `src/features/inbox/components/message-thread` returned 1 finding: `side-tab` (Side-tab accent border) at `message-reply-preview.tsx:34` — `border-l-2` on the quoted-message strip. Not a false positive, but low stakes here: it is a real quote-bar convention, and at the rendered size the 2px `border-current/50` edge is invisible against `bg-current/10`, so it earns nothing. That is the only automated hit; the scanner has no rule for the positional problems below, which is why the browser pass mattered.

**Visual overlays.** Not attempted — the detector's overlay flow needs a static/live-server target, and this surface requires an authenticated SPA session. Evidence came from direct Playwright screenshots and DOM measurement instead.

## Overall Impression

The scroll behavior, read-cursor commits, and grouping logic are the hard parts and they are done well. The reply affordance is the soft part and it is undone. Your instinct is right, and the fix is not "nudge it" — reply needs to leave the footer entirely and become a hover rail in the gutter beside the bubble.

## What's Working

- **Escape/cancel on the reply target.** `chat-input.tsx` unwinds attachment → reply target → blur in that order. That is the kind of layered escape most chat UIs never bother to build, and it directly serves User Control.
- **The metadata footer's separator discipline.** `hasTrailingMeta` deliberately excludes the hover-only reply button so the `·` never renders before empty space. Someone was paying attention. That care is exactly what makes the button's *placement* the odd one out.
- **Grouped runs with corner-radius reduction.** `buildTranscriptRows` + the `group` prop is the right structure for an inbox where a customer fires off five messages in a row.

## Priority Issues

### [P1] Reply is an action living inside a status strip

**What:** `message-bubble.tsx:171-183` renders the reply IconButton as the last item of `ChatMessageMetadata`'s footer, after timestamp, edited, delivery and retry.

**Why it matters:** Its x-position is a function of unrelated telemetry, so it never lands in the same place twice. It sits below the bubble rather than beside it, so it reads as belonging to the row, not the message. And it is the only element in that strip a user is meant to click.

**Fix:** Move reply into a hover/focus action rail positioned in the gutter beside the bubble — left of outbound, right of inbound, anchored to the bubble's top edge. Fixed offset, independent of footer content. `ChatMessageBubble` has no `actions` slot (confirmed via `astryx component ChatMessageBubble`), so this needs a positioned wrapper around the bubble carrying `group/msg`. That rail is also where react / copy / forward go later; the footer stays purely a readout.

**Suggested command:** `/impeccable layout`

### [P1] Hovering one message reveals reply on every message in the run

**What:** The reveal selector is `[.astryx-chat-message:hover_&]:opacity-100`. `themeProps('chat-message')` puts `astryx-chat-message` on the `<article>` root of `ChatMessage`, which in `chat-transcript.tsx` wraps an entire same-direction **run**, not one bubble.

**Why it matters:** Measured live — hovering a 21-bubble run revealed **6 reply buttons simultaneously** in the viewport. Nothing indicates which message the pointer will act on, so the user has to aim at a 28px target and trust the mapping. In a shared inbox, replying to the wrong customer message is a visible mistake.

**Fix:** Scope the reveal to the bubble. Once the rail wrapper from the previous issue exists, `group-hover/msg:opacity-100` gives exactly one revealed target.

**Suggested command:** `/impeccable layout`

### [P1] Reply is 4px from Retry, and they look the same

**What:** On a failed outbound message the footer renders `⚠ ↺ ↩` — three 12px monochrome glyphs, two of them 28px buttons in `ghost` variant, side by side.

**Why it matters:** Reply is routine and reversible. Retry re-sends a message to a customer and is not. Adjacency plus visual identity is a misclick generator, and the misclick has an external consequence.

**Fix:** Moving reply to the gutter rail separates them by construction. Beyond that, give failure a bubble-level treatment — a coral edge or a `Failed · Retry` inline row — instead of an 11px warning glyph that competes with the delivery tick for attention.

**Suggested command:** `/impeccable harden`

### [P2] 50 invisible buttons in the tab order; zero on touch

**What:** 50 messages → 50 always-mounted reply IconButtons at `opacity-0`. `opacity: 0` removes nothing from the accessibility tree or the tab sequence. Simultaneously, hover-only means touch users never reach the action at all.

**Why it matters:** Keyboard users tab through one invisible control per message to reach the composer. Sam (screen reader / keyboard) hits a wall; Casey (phone) cannot reply to a specific message at all. The `focus-within:opacity-100` shows good intent, but it makes the tab-stop cost worse, not better.

**Fix:** Add an `r` shortcut on the focused message and a `@media (hover: none)` path (long-press, or a persistent low-contrast rail on touch). If the rail keeps a tab stop per message, add a skip affordance to the composer.

**Suggested command:** `/impeccable audit`

### [P2] Per-bubble footers cancel the grouping work

**What:** `metadata` is passed to every `MessageBubble`, not just the last in a run. Astryx's own guidance for the prop is "Use on the last bubble in a message."

**Why it matters:** A run of three "asd" messages renders as three bubbles each trailed by its own timestamp strip — three visual islands where the `group` prop was trying to build one. The footer strip is also wider than the short bubbles above it, so the transcript's silhouette is defined by timestamps rather than by messages. In a tool built for scanning, that inverts the hierarchy.

**Fix:** Show the timestamp on the last bubble of a run by default, and reveal per-bubble times on hover or for messages more than N minutes apart. Keep delivery state on the last bubble; keep failure state on the failing bubble.

**Suggested command:** `/impeccable distill`

## Persona Red Flags

**Alex (Power User):** No `r`-to-reply. No way to reply without a mouse round-trip to a 28px target that only appears after the pointer is already there. On a 21-message burst from one customer, six identical reply arrows appear at once with no active-target indication — Alex will hover-and-squint, then give up and quote manually in the composer.

**Sam (Accessibility-Dependent):** 50 `opacity-0` buttons remain focusable and announced. Reaching the composer keyboard-only means tabbing past every one. Reply and Retry are distinguished only by icon shape at 12px — no text, no color, no grouping — and both sit inside a `<span>` that also carries the timestamp, so the screen reader reads action controls interleaved with status text.

**Casey (Distracted Mobile):** Hover-only reveal means the reply action does not exist on a phone. Touch targets are 28×28 against a 44×44 minimum. The most common mobile inbox action — reply to *this* message — is unreachable.

## Minor Observations

- `message-reply-preview.tsx:34` — the `border-l-2` quote bar is invisible at rendered size against `bg-current/10`. Either commit to a real quote bar (full-height, higher contrast) or drop the border and let the tint carry it.
- The quoted strip falls back to the literal string "Quoted message" as an author name when `quote.author_name` is null (visible in the live thread). Falling back to the contact's name or omitting the author line reads better than a system label posing as a person.
- The transcript's computed background is `rgba(0,0,0,0)` up the whole ancestor chain. DESIGN.md specifies the transcript as recessed `--surface-secondary` with the composer as a raised surface above it; live, both are flat white and the composer instead carries a visible border. Expected mid-migration drift, but the pane currently reads as one flat sheet, which is the exact thing "The Three Layers" is meant to prevent.
- The reply button reserves 28px in every footer at rest, so timestamps and delivery ticks never align to the bubble's right edge. Moving the button out closes this for free.

## Questions to Consider

- If reply moves to a gutter rail, what else belongs there? React, copy text, forward, and "create task from message" are all message-scoped and all currently homeless. Designing the rail for three slots now is cheaper than retrofitting it twice.
- Should reply be hover-only at all? Front shows message actions persistently at low contrast on the focused message. In a tool where reply is the *primary* verb, hiding it until hover is a strong claim.
- What does replying to a specific message mean on a channel that has no quote semantics? The composer already handles reply targets uniformly — does the rail need to disappear per channel type?
