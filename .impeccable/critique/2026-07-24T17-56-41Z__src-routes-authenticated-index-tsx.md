---
target: home page items
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-07-24T17-56-41Z
slug: src-routes-authenticated-index-tsx
---
Method: dual-agent (A: a559947769756faba · B: aafcc423ae90f0720)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Stat tiles render fake zeros while loading — `homeStatsQuery` is outside the loading gate, so every visit flashes "0 unread" before truth arrives |
| 2 | Match System / Real World | 2 | "Snoozed waking" is broken English; "Good night" reads as a farewell; "70d ago" has no week/month tier |
| 3 | User Control and Freedom | 3 | Nothing traps, but attention items can't be acted on or dismissed from home; Quick access tab choice resets every visit |
| 4 | Consistency and Standards | 2 | Section headers are h2, a `<p>` in a card, or absent; "Open assigned 5" vs "7 open" on the same screen with the scope difference carried by one word |
| 5 | Error Prevention | 3 | Read-only surface, little to break — but the zero-flash plants false beliefs |
| 6 | Recognition Rather Than Recall | 3 | Labeled icons and recents help; assignment scope of tiles must be inferred |
| 7 | Flexibility and Efficiency | 1 | Stat tiles are non-interactive dead ends; no shortcuts; attention list silently caps at 10 |
| 8 | Aesthetic and Minimalist Design | 3 | Calm and uncluttered; but zero-value tiles occupy prime real estate at full weight and the Stale chip floats ~700px from its row content |
| 9 | Error Recovery | 1 | A failed attention query renders the celebration state ("Good job! Nothing waiting on you"); page-level error has no retry |
| 10 | Help and Documentation | 1 | "Stale" (48h) and "waking" (24h) thresholds exist only in code; nothing explains what earns a chip |
| **Total** | | **21/40** | **Acceptable (low end)** |

## Design Specificity Verdict

**LLM assessment:** Authored skeleton, category-interchangeable skin. The IA is genuinely built for this product — a personal triage model (unread/open/snoozed/stale assigned to you) and a reason-ranked attention queue no template has. But the composition (4-KPI card strip + right rail + gray cards) is exactly the "generic SaaS admin dashboard" PRODUCT.md lists as anti-reference #1. In the common state the only saturated color on the page belongs to other companies (WhatsApp green, Telegram blue, Instagram pink); Rezzy's own accent appears only when `unreadAssigned > 0`.

**Deterministic scan:** 0 findings across `src/routes/_authenticated/index.tsx` and all 7 dashboard components — verified genuine (multi-target rerun, per-file rerun, `--no-config` rerun; no ignore config present). The mechanical layer is clean: token discipline holds, no banned patterns. Everything that drags the score is invisible to a static scan: dead-end tiles, error-masking, a missed deep link, and rendered-contrast failures measured from pixels.

**Visual overlays:** The browser run was headless — no user-visible overlay tab exists. Injection itself succeeded (33 detector overlay elements confirmed in the page DOM), but the detector's console summary could not be captured: its synchronous scan blocked the SPA main thread, then the browser target crashed on a second evaluate. No browser findings count is claimed.

## Overall Impression

The bones are a real rep-triage tool; the surface undercuts it on the two axes that matter most in Operate mode: trust (loading and error states lie) and action (the biggest visual elements do nothing). The single biggest opportunity: make the attention queue the page's protagonist and make every number a door.

## What's Working

1. **The triage data model is real product thinking.** Assigned-to-me stats plus a queue ranked snoozed > unread > stale mirrors how a rep sequences a shift — not tutorial CRUD.
2. **Channel plates carry the brand promise.** WhatsApp/Telegram/Instagram plates on rows and cards make "omnichannel" legible in half a second, Front-style.
3. **Craft where interaction exists:** attention skeleton, visible focus rings, full-row link targets, `motion-reduce` handling, `tabular-nums` on counts.

## Priority Issues

- **[P1] Errors masquerade as success.** Failed attention query → "Good job! Nothing waiting on you"; failed/loading stats → four confident zeros (zero-flash on every visit). A triage tool that can report false all-clear will cost a rep a lead. Fix: per-section `isError` branches with inline retry; include `homeStatsQuery.isPending` in the gate or give tiles skeletons. (`index.tsx:47-49`, `attention-list.tsx:36`) → **/impeccable harden**
- **[P1] Attention rows dump you at the wrong destination.** Rows know their `conversationId` but link to the inbox root; the `$conversationId` route exists unused (`attention-list.tsx:69-70`). The row promises "this needs you," then makes the user re-find it. One-line fix, biggest workflow win. → **/impeccable polish**
- **[P1] Inverted hierarchy: dead-end numbers outrank the live queue.** Non-interactive stat tiles get the heaviest treatment; the queue — the page's stated purpose — is its lightest element. Fix: tiles become links to filtered inbox views; promote the queue (stronger header with count, reason chip adjacent to content). → **/impeccable shape**
- **[P2] Light-mode 12px muted text fails WCAG AA — measured.** Stat labels/timestamps 3.95:1, "Last message 9m ago" 3.41:1 (dark mode passes). PRODUCT.md commits to contrast for sustained reading. Fix: raise muted tier to ~/70 or use `text-secondary` (4.74:1 measured). → **/impeccable audit**, then polish
- **[P2] Home never surfaces what's actually new.** Workspace card says "Last message 9m ago" while the queue shows only aging assigned items; unassigned inbound (new leads) is invisible. The canonical session is "open Rezzy to see what's new." → **/impeccable shape**

## Persona Red Flags

**Alex (power user):** clicks "5 open assigned" — nothing happens; reaching those 5 takes sidebar → workspace → inbox → manual filter. Every queue item is a full navigation round-trip (no inline snooze/close). Queue caps at 10 silently — with 14 items, 4 are unknowable. ~13 tab stops to the first content link; no accelerators.

**Sam (accessibility):** the stat tiles' carefully written aria-labels sit on generic `<div>`s, which screen readers drop. Attention row `aria-label` replaces inner text — Sam loses workspace name and timestamp. Quick access tabs are plain buttons misusing `aria-current="page"`, no tablist semantics, doubled text ("WorkspacesWorkspaces"). No h1; only two of four sections have headings. Light-mode contrast failures hit low-vision users hardest. Positives: skip link, genuinely visible focus rings.

**Dana (juggling account manager, from PRODUCT.md):** must reconcile "5 open" vs "7 open" between calls; the 9-minute-old message she came for is absent from the queue (not assigned to her); clicking a follow-up drops her at the top of an inbox to hunt again; the product greets her by her login string. She'll bookmark the inbox and stop visiting home — at which point this page has no job.

## Minor Observations

- Zeros render at the same 30px semibold as real signal; an all-clear tile could mute itself.
- Stale items sort newest-first — the 70-day, most-overdue item lists last.
- `formatRelativeTime` lacks week/month tiers ("70d ago").
- Two hidden icon-picker dialogs keep 236 invisible buttons mounted; the page-level `CreateWorkspaceModal` can't even be opened from the populated state (no trigger).
- Static document title ("Rezzy"); no per-route title.
- Motion vocabulary splits: cards lift on hover, rows shrink on press, stat tiles do nothing.
- User avatar appears twice in the same viewport band (greeting + TopNav).
- Quick access "Workspaces" tab duplicates two existing navigation paths; recent conversations would serve triage better.

## Questions to Consider

1. What if home led with the queue as a sentence — "You have 2 follow-ups waiting and 5 open threads" — and the numbers became adjectives on the work instead of furniture above it?
2. If a tile reads 0, why is it on screen at full weight? What would the all-clear morning look like if the page celebrated it in one line and got out of the way?
3. Home answers "what's aging on my plate" but not "what just arrived" — which question actually triggers Dana to open the app, and shouldn't that one own the top of the page?
