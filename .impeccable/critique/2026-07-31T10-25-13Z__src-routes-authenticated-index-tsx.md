---
target: home dashboard
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-07-31T10-25-13Z
slug: src-routes-authenticated-index-tsx
---
Method: dual-assessment (A: independent design review, isolated sub-agent · B: deterministic detector CLI)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Every section owns honest pending/error/retry with `isRetrying`; but `UnassignedList` returns `null` while pending, so it materializes late and shoves the workspace section down |
| 2 | Match System / Real World | 3 | Russian is fluent and human («Всё разобрано», «Пора вернуться»); «Без исполнителя» is HR-speak, and the 2-day stale threshold lives only in a hover `title` |
| 3 | User Control and Freedom | 2 | Everything is navigation. Zero row actions: no claim, snooze, or mark-read from home. The only control is leaving |
| 4 | Consistency and Standards | 2 | Three skeleton implementations; greeting `text-lg` breaks the two-size rule; cards lift on hover while rows tint — two hover grammars on one page |
| 5 | Error Prevention | 3 | Confident-zero traps explicitly avoided (`stats: null` omits numbers); `ROW_LIMIT = 1001` makes truncation observable. Gap: disjoint queries can show all-clear beside a populated list |
| 6 | Recognition Rather Than Recall | 2 | Chips are labeled, but what «Без ответа» and «Без исполнителя» actually mean exists only in `title=` |
| 7 | Flexibility and Efficiency | 1 | No shortcuts, no bulk actions, no "assign to me". One rigid path per item: click, navigate, come back |
| 8 | Aesthetic and Minimalist Design | 4 | Earned. Zero segments don't render, the attention section goes silent when the summary already spoke, unassigned renders only when it has something to say |
| 9 | Error Recovery | 3 | `SectionError` names the failed section in plain Russian and retries inline without nuking siblings; never names a cause |
| 10 | Help and Documentation | 2 | `title` tooltips are the only help. Nothing explains the attention ranking anywhere |
| **Total** | | **25/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment: not slop.** Every shared absolute ban passes. No side-stripe accents (`ReasonChip` uses a full 1px border), no gradient text, no glassmorphism, no hero-metric template (counts are inline prose, not big-number cards), no modal-as-first-thought. The one near-miss is `WorkspaceGrid`: same-size cards with icon + heading + text, repeated. It escapes on intent, since the cards are navigation targets differentiated by live data, but at 2+ similar workspaces the screenshot impression is exactly the banned pattern. What a Front/Linear-fluent user would pause at is not strangeness but absence: in the multi-workspace state nothing on the page says "start here."

The code comments argue with themselves ("a dot between each turned the row into punctuation soup"; the elevation-direction reasoning on the dashed create tile). That is the opposite of slop.

**Deterministic scan: 0 findings** across `src/widgets/dashboard` and all 10 `src/features/dashboard/components`. Verified genuine by re-running across `src/widgets`, `src/features`, and `src/components`, which surfaced exactly one unrelated warning (`broken-image` in `src/components/image/image.tsx:111`, outside this target). Token discipline holds and no banned pattern is mechanically detectable. Everything dragging the score is invisible to a static scan: missing accelerators, meaning trapped in tooltips, and a state branch that changes the page's grammar.

**Supporting checks:** `pnpm i18n:audit` passes for parity and placeholders, and independently confirms `dashboard_page_kicker` / `dashboard_page_title` / `dashboard_page_description` are defined but never referenced — dead keys from a header design that no longer exists.

**Visual overlays:** none. No dev server was running and the browser bridge was not responding, so no `[Human]` overlay tab exists. Both assessments worked from source plus `home-page.png`; no browser findings are claimed.

## Overall Impression

The information architecture is real product thinking, and the restraint is the best thing on the page: this dashboard is built out of things it refuses to render. What holds it at 25 is that it is a triage surface you cannot triage from. Every element is a link to somewhere else, and in the state that most needs help — several workspaces, a busy morning — the page has no primary action at all. The single biggest opportunity: give the multi-workspace user one door and let a row be acted on without leaving.

## What's Working

1. **Silence as a design material.** `HomeSummaryLine` drops zero-count segments; `AttentionList` returns `null` when `isSummaryAllClear`, so the page never says "all clear" twice within 100px; `UnassignedList` renders nothing when nothing waits. Most dashboards would ship four permanent sections full of zeros. This is the Front-style calm PRODUCT.md asks for, achieved by subtraction.
2. **Honest numbers over confident zeros.** `WorkspaceCard` accepts `stats: null` on failure and omits the count row while staying a navigation target. `ROW_LIMIT = 1001` exists specifically so a silently truncated Supabase response cannot produce a wrong total, with a console warning when the ceiling is hit. The data layer respects the user's trust the same way the copy does.
3. **The queue is ranked, not just filtered.** `snoozed > unread > stale`, with per-reason time direction: overdue longest-first, unread newest-first. That is an opinion about how a sales day sequences, encoded in `attention-queue.ts`. «Показан самый срочный из N» tells the truth about the cap, with correct Russian singular handling.

## Priority Issues

- **[P1] The multi-workspace state has no primary action.** `DashboardHeader` renders «Открыть входящие» only when `inboxWorkspaceId !== null`, meaning exactly one workspace. At 2+ the page's only primary button disappears, and the «Показаны N из M» overflow line loses its inbox link too. Worse, `WorkspaceCard` links to `/workspaces/$id`, the workspace root rather than its inbox, so "the workspace cards are the doors" is only half true: they are doors to a hallway.
  **Why it matters:** PRODUCT.md principle 1 is "every screen has one primary action." The user who most needs triage help gets a page of equally weighted navigation, and "what do I do first" stops being answerable in two seconds.
  **Fix:** Point `WorkspaceCard` at `/workspaces/$id/inbox`, and give the header a real door for multi-workspace users (the workspace with the most unread, or a cross-workspace inbox). The attention queue already ranks across workspaces, so the top row can be styled as the answer to "start here."
  → **`/impeccable shape`**

- **[P1] Meaning is trapped in `title=` attributes.** The stale threshold («Ждут вашего ответа больше 2 дней»), snooze semantics, the unread definition, and the entire definition of «Без исполнителя» exist only as `title` hints on `HomeSummaryLine` segments, `ReasonChip`, and the `UnassignedList` `<h2>`.
  **Why it matters:** `title` is invisible on touch, unreachable by keyboard, unreliably announced by screen readers, and needs a hover dwell nobody performs. A first-week user cannot learn what «Без ответа» means, or how it differs from «Без исполнителя» one section below — two near-homophonic Russian phrases for different facts.
  **Fix:** Promote the definitions into visible microcopy. `home_unassigned_hint` already exists as a string; render it as a `text-secondary text-xs` line under the heading. Put the threshold in the chip label itself, or use a real accessible tooltip.
  → **`/impeccable clarify`**

- **[P2] Summary and attention list restate each other on busy mornings.** The dedup logic only covers the zero case. At 3 unread the user reads «3 непрочитанных», then reads three rows chipped «Непрочитано» directly beneath. The summary segments are inert text, not links into filtered views.
  **Why it matters:** In the state that matters, the summary is a table of contents for content already fully visible one `space-y-8` below. It costs a reading pass and vertical space for information the list gives with more fidelity.
  **Fix:** Make each segment a link that filters the inbox, earning its place as an accelerator, or collapse the summary in the busy state and keep it as the all-clear line, which is where it already shines.
  → **`/impeccable shape`**

- **[P2] Typography and pattern drift against the system's own rules.** `GreetingHeader` uses `text-lg` where DESIGN.md sets 16px as the ceiling and says hierarchy is carried by weight, never scale. The same workspace entity renders `text-base` in `WorkspaceCard` and `text-sm font-semibold` in `SingleWorkspaceSummary`, so its size depends on how many you own. Three skeleton systems coexist: Astryx `Skeleton`, hand-rolled `bg-primary/5 animate-pulse` lists, and an inline pulse span. Two hover grammars: translate-lift on cards, background tint on rows. Section headings are all identical `text-sm font-semibold`, so the urgent personal queue and the ambient workspace inventory carry equal visual weight.
  **Why it matters:** "Confidence through restraint" is a claim about predictability. Each drift is invisible alone; together they are the "pause at every subtly-off component" failure.
  **Fix:** Clamp the greeting to 16px/600 (position and weight still win it the page), pick one skeleton primitive, pick one hover behavior per element class, and give the attention heading more weight than the workspace heading.
  → **`/impeccable typeset`**, then **`/impeccable polish`**

- **[P2] The three-way branch changes the page's grammar, and unassigned pops in.** One workspace renders as a quiet list row with a ghost create button; two renders the same concept as lifting cards with a dashed create tile. Different affordances, sizes, and actions for one idea. Meanwhile `UnassignedList` returns `null` while pending, so sections below shift down on arrival, and because `attentionQuery`, `homeStatsQuery`, and `unassignedQuery` are disjoint, a realtime change can briefly show «Всё разобрано» above a populated unassigned list. Technically consistent, since the summary scopes to "assigned to you", but it reads as a contradiction.
  **Why it matters:** A user who grows from one workspace to two gets a page redesign they did not ask for, and the load shift undermines an otherwise careful loading story.
  **Fix:** Reserve the section's vertical slot with a skeleton while unassigned is pending, and align the single-workspace row's visual language with the card.
  → **`/impeccable harden`**

- **[P3] Russian copy nits.** «Доброй ночи» is a farewell, not a greeting; English keeps the wink with "Working late" and the base locale lost it. «1 открытый на вас» is elliptical to the point of ambiguity: open *what*. «Без исполнителя» is corporate taskese in an otherwise human register; the component's own hint copy («никто пока не взял») is closer to the brand.
  → **`/impeccable clarify`**

## Persona Red Flags

**Alex (impatient power user):** No keyboard accelerators anywhere. Nothing opens the top attention item, no `j`/`k` over rows; the core loop is mouse targeting a row every single time. No inline actions: an unassigned row cannot be claimed from home, a stale row cannot be snoozed, so every triage verb is a navigate-away-and-back round trip. With three workspaces his muscle-memory primary button is simply gone.

**Sam (accessibility-dependent):** Every explanatory string is a `title` attribute, so NVDA announces the chip «Без ответа» with no route to its definition. `ReasonChip` sits inside the row link, so the accessible name concatenates to «Иван Петров Непрочитано 5 мин назад» — noisy but survivable. `preview ?? '\u00A0'` holds the row height honestly but is announced as nothing. Positives are real: proper `<h1>`/`<h2>` structure, `aria-labelledby` on every section, `focus-visible:ring-2` throughout, chevrons and platform icons correctly `aria-hidden`. Sam can navigate the page. Sam cannot learn what its words mean.

**Jordan (first-timer):** After creating their first workspace, the header offers «Открыть входящие», but the attention section shows nothing and the all-clear suppresses even its empty state, so the page is a greeting, a green check, and one row. Nothing says "now connect a channel," which is the actual next step, and the one door leads to an empty inbox.

## Minor Observations

- `dashboard_page_kicker` / `dashboard_page_title` / `dashboard_page_description` are defined and never referenced. Confirmed by `pnpm i18n:audit`. Dead keys from a removed header.
- `preview ?? '\u00A0'` is an honest way to hold row height, but a localized "no preview" in `text-secondary/60` would serve screen readers better than a character they skip silently.
- The all-clear appears twice in different clothing: the summary's green check line and `AttentionList`'s own `EmptyState`, deduped by a boolean prop threaded through the page. That the dedup needs a prop is a hint the two components are one component.
- Static document title; no per-route title, so browser tabs and history are indistinguishable across the app.
- `formatRelativeTime` correctly covers minutes through years. The week and month tiers flagged in the previous critique are fixed.
- `NumericUnreadChip` `capAt99` is good restraint, and `motion-reduce` is respected everywhere `hover:-translate-y-0.5` appears.
- Screenshot at 1440×900: the column sits comfortably, whitespace rhythm is calm, and the dark primary button is the only saturated element besides channel plates. The "one neutral hue, chroma is categorical" rule visibly holds.

## Questions to Consider

1. If the attention queue is the whole reason to open this page, what does "home" do that a cross-workspace inbox with a header summary could not? If the answer is workspace navigation, does that belong above or below the fold?
2. The all-clear state is currently a greeting, a summary line, and a green check: three elements saying "nothing to do." Would the strongest version of it be the page getting *shorter*, the way the busy state already collapses zeros?
3. The queue already ranks conversations across workspaces, so the product does have an opinion about global priority. Why does that opinion stop one level up, at the button?
4. «Без исполнителя» is visible to every member and actionable by none from here. Is a section you can see but not act on informing the team, or manufacturing ambient guilt?
