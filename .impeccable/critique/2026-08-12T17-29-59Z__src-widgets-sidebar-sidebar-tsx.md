---
target: workspace switcher in the sidebar
total_score: 21
max_score: 36
na_heuristics: 10
p0_count: 2
p1_count: 2
timestamp: 2026-08-12T17-29-59Z
slug: src-widgets-sidebar-sidebar-tsx
---
Method: dual-agent (A: design review, isolated · B: detector + measured geometry, isolated)

Target: the workspace switcher in the app rail — `src/widgets/sidebar/sidebar.tsx` (`WorkspaceSwitcher`, `WorkspaceMark`, `WorkspacesMark`, `WorkspaceItemGroup`). Mode: **Operate** — persistent chrome, read all day.

## Design Health Score

Scored against the code as reviewed, before this session's fixes.

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | `aria-expanded` is set on the trigger, but there is no *visual* open state — the row looks identical whether the popover is open or shut. It is the only rail row that can be open. |
| 2 | Match System / Real World | 3 | The accent plate reads "brand/primary", not "workspace". The glyph means whatever the user picked. |
| 3 | User Control and Freedom | 3 | Escape and outside-dismiss are correct; `onCreateWorkspace` is commented out, so a user with zero workspaces has no exit. |
| 4 | Consistency and Standards | 1 | The complaint, and it is one root cause with many faces: 24px icon box against the rail's 16px, a 14px glyph inside it, accent tone against `secondary`, label column 8px off the rail's text axis, alignment inverting on collapse, skeleton radius 12px against the row's 8px. |
| 5 | Error Prevention | 3 | Switching is reversible and non-destructive; the popover closes on select. |
| 6 | Recognition Rather Than Recall | 3 | Name plus glyph expanded; collapsed it is glyph-only, drawn from a 16-icon set that contains the Contacts row's own icon. |
| 7 | Flexibility and Efficiency | 2 | No shortcut, no type-ahead, no recency order, no cap. Linear hunt past ~5 workspaces. |
| 8 | Aesthetic and Minimalist Design | 2 | The plate was the loudest object in the rail and encoded nothing — `isActive` was a hardcoded literal. |
| 9 | Error Recovery | 2 | The load error is a bare `<p>` with `bg-error/5` and **no retry**, against DESIGN.md's own "inline query errors … ghost retry button". The invitations query has no error state at all. |
| 10 | Help and Documentation | n/a | Single-purpose control in persistent chrome, labelled expanded and tooltipped collapsed. Scoring it would penalise correct minimalism. |
| **Total** | | **21/36** | **Acceptable (58%) — significant improvements needed** |

## Design Specificity Verdict

**LLM assessment.** Category-interchangeable. A gradient-filled rounded square, a name, and a `chevrons-up-down` is the Slack/Linear/Notion workspace chip, unchanged. What makes that expensive here is that the rail around it *does* have a vocabulary of its own — a bracket descending from an icon axis, gutter-not-hairline separation, an achromatic spine with hue reserved for meaning — and the switcher was the single element opting out of all three. The one genuinely Rezzy-specific decision in the component (making it a real `SideNavItem` rather than a `Button` in costume) was undone by the icon slot, which threw away everything that decision bought.

**Deterministic scan.** `detect.mjs` returns **0 findings** on `sidebar.tsx`, on `src/widgets/sidebar/`, and on the sibling notifications row. Confirmed not a silent no-op: the same binary against `src/` returns populated findings (`design-system-font`, `src/assets/fonts/fonts.css:54,:65`). The detector contributes nothing here and could not — it is a pattern matcher over source text, and this defect is emergent layout arithmetic across two centring rules in a third-party package. No token-level rule can see it.

**Visual overlays.** None. `http://localhost:3000` serves the login screen; no authenticated session exists and neither agent may enter credentials. Fallback signal: **browser evidence unavailable — authenticated surface behind a login the agent may not complete.** The geometry below does not depend on it: every input is a literal in a checked-in or installed file.

## Overall Impression

The user's report is not a matter of taste and not approximate. It is arithmetic, and it reproduces at exactly 4px.

```
expanded icon centre  = 8 + w/2      (row left-aligns at a fixed 8px inset)
collapsed icon centre = 32/2 = 16    (row centres in a fixed 32px box)
shift                 = (w - 16) / 2
```

Any icon slot whose width is not 16px desynchronises across the collapse. At `w = 24` the shift is 4px, leftward. Every other rail icon is 16px and holds perfectly still.

| | expanded centre | collapsed centre | Δ |
|---|---|---|---|
| Sibling row (16px Lucide) | 16px | 16px | **0** |
| Switcher (24px plate) | 20px | 16px | **4px** |

The second consequence nobody had named: expanded, the workspace name started at x=40 while every other row's label starts at x=32. The row was off-axis in *two* dimensions, and only one of them moved.

The single biggest opportunity is that all of it — the 4px shift, the 8px label offset, the "remove the background" request — falls out of one decision. The icon slot was passed a `ReactNode`, so `renderIconSlot` returned it untouched and the row's `size:'sm'` / `color:'secondary'` contract never applied. Fix the box and every symptom resolves at once.

## What's Working

1. **It is a real `SideNavItem`, not a Button in costume.** Height, inset, radius, hover, pressed, disabled and collapsed behaviour all descend from `navItemStyles`, so the divergences were *only* the ones the icon slot introduced. The footer account row, by contrast, buys its row-ness with three local overrides that will drift.
2. **The trailing chevron is byte-identical to the account row's.** The rail has exactly one "this opens a menu" glyph, at both ends of the column. That is authored consistency, and it is the part of the row not being complained about.
3. **The i18n is better than the visual design.** The counted invitation phrase is composed in the catalogue via `m.workspace_invitations_indicator_aria({workspace, count})` rather than joined with a literal in TypeScript, and both catalogues put `{workspace}` first — so WCAG 2.5.3 Label in Name holds in `ru` and `en` alike. Most codebases ship the ternary and break it.

## Priority Issues

### [P0] The icon slot diverged three ways at once, which is what made alignment impossible — FIXED

**What.** A 24px plate (siblings: 16px) holding a 14px glyph *smaller* than the siblings' 16px, painted `text-on-dark` on `bg-accent-gradient` (siblings: `secondary`).

**Why it matters.** One root cause, not three symptoms. The collapse shift, the label offset and the background all fell out of the box being 24px. It also meant the row was permanently opted out of the icon system: had it ever needed `isDisabled` or `isSelected`, the mark would not have followed.

**Fix applied.** Plate deleted. `WorkspaceIcon` now renders at `size-4` (16px) at `text-secondary` — `--color-icon-secondary` and `--color-text-secondary` are the same value in both modes, so this is the exact tone `renderIconSlot` gives every unselected sibling. Icon centre is now 16px in both states, Δ = 0. Label starts at x=32, on the rail's text axis.

**Suggested command:** `$impeccable polish`

### [P0] The bracket's stated invariant would have silently become false — FIXED

**What.** `WorkspaceItemGroup` used `ml-5` (20px), documented as landing "on the workspace mark's own centre axis". 20px was exactly the 24px plate's centre (8 + 12). Shrinking the icon without moving the bracket leaves a rule whose comment describes a plate that no longer exists.

**Fix applied.** `ml-5` → `ml-4` (16px), and the comment rewritten. The rule now descends from the icon axis *every* row in the rail shares, rather than from one special plate — a better line, but it had to be moved deliberately.

**Suggested command:** `$impeccable polish`

### [P1] Removing the plate exposes a glyph collision inside the same rail — OPEN

**What.** `WORKSPACE_ICON_COMPONENTS` includes `users-round: UsersRoundIcon` — the exact component the Contacts row uses (`sidebar.tsx:177`). `layers`, `boxes` and `gauge` sit close to `LayoutDashboard`. The accent plate was masking this. Stripped, a collapsed rail can show two identical 16px secondary glyphs, 32px apart, meaning entirely different things.

**Why it matters.** This is the one real regression the requested change creates, and it lands hardest exactly where identity is already weakest: collapsed, with no name.

**Fix (not applied — needs a decision).** Either drop `users-round` from `WORKSPACE_CURATED_ICONS` and `WORKSPACE_ICON_COMPONENTS` (the `satisfies` makes the removal a type error until both sides agree, which is the safe way), or raise the workspace glyph one tone to `text-primary` while destinations stay `secondary`. The second deviates slightly from "make it like other icons", which is why it was not done unasked.

**Suggested command:** `$impeccable harden`

### [P1] The popover shows the same string at half the size, and one tier of it fails contrast — OPEN

**What.** `List`'s `getItemClass` hardcodes `text-sm` (`src/components/list.tsx:40`), which under stone is **11px** (Known drift 2). A workspace name is 14px in the rail and 11px in the popover that unfolds directly beneath it. Non-current rows take `listItemStyle.unselected` = `text-primary/60`, ~4.16:1, where DESIGN.md's own acceptance criterion requires `/70` or higher. In Russian, at 11px, at phone width.

**Why it matters.** The popover is the only place a user reads more than one workspace name, and it is the least legible surface in the flow — sitting directly under the row whose type it fails to match.

**Fix (not applied — shared component).** `text-primary/60` → `/70` in `src/components/list.tsx:29`, and either `text-base` on these rows or a size prop on `List`. Both touch every list in the app, so this is its own change with its own regression surface.

**Suggested command:** `$impeccable typeset`

### [P2] The loading and error states each break a documented rule — one fixed, one open

**What.** (a) `Skeleton radius={3}` — the prop is a *token index*, not px: `3` is `--radius-container` (12px) where the row is `--radius-element` (8px). The placeholder was a different shape from the thing it stood in for. (b) The error branch is a bare `<p>` with `bg-error/5` and no retry, where DESIGN.md specifies `bg-error/10 rounded-lg px-3 py-2` **with a ghost retry** — so a flaky network leaves a dead strip where the switcher should be. Worth knowing: `--color-error` in light is `#58413e`, a clay brown, so that strip does not read as alarming either.

**Fix.** (a) Applied: `radius={2}`. (b) Open: add a ghost retry calling `workspacesQuery.refetch()` and move to `bg-error/10`.

**Suggested command:** `$impeccable harden`

### [P2] The create-workspace path is dead code, and the popover has no empty state — OPEN

**What.** `onCreateWorkspace` is commented out in three places. `setIsCreateWorkspaceOpen` is therefore never called, and `<CreateWorkspaceModal>` is mounted with an `isOpen` that only ever moves toward `false`. Meanwhile `workspaces` can legitimately be `[]`, in which case the popover renders an empty `<ul>` inside 6px of padding — a ~12px blank sliver with no message and no action.

**Why it matters.** The no-workspace-selected state is *designed for* — it had its own neutral mark — and it terminates in a dead end.

**Fix (not applied — product decision).** Either restore the create row or delete the modal, the state and the three commented parameters outright. Add an empty state either way.

**Suggested command:** `$impeccable onboard`

## Persona Red Flags

**Alex (impatient power user).** Switching workspace is pointer-only, minimum two clicks, with a linear scan of an unordered, uncapped list at 11px. No shortcut, no type-ahead. He is also the one who noticed the 4px shift — power users read chrome as a straight edge, and one element breaking the line is a permanent irritant. Until this change, the loudest object in his rail was the control he touches three times a day, sitting above the Inbox row he touches three hundred times.

**Sam (screen reader + keyboard).** The accessible name is written imperatively via `setAttribute` in an effect — React does not own that attribute, it lands after paint, and it depends on an `isCollapsed` dependency to survive the element swap on collapse. That is now pinned by a test, but it remains load-bearing for a real signal rather than a nicety. Both catalogues put `{workspace}` first, so Label in Name holds. `navItemStyles` declares `:hover` and `:active` but no `:focus-visible` — the rail's focus ring needs a browser check (rail-wide, not switcher-specific). The 32px row is below the 44px touch-target criterion, as every button in the product is.

**Jordan (confused first-timer).** Lands with zero workspaces: opens the switcher, gets a blank sliver, and cannot create one because the action is commented out. With one workspace, the plate used to be the brightest thing on screen and read as the primary action — so his first click in the product was a switcher with one entry. Collapsed, nothing tells him the glyph is a workspace rather than a sixth destination; the tooltip requires him to already suspect there is something to hover. Removing the plate helps the first problem and sharpens the last one.

## Minor Observations

- The switcher never sets `isSelected` and has no open-state styling. It is the only row in the rail that cannot show what it is doing.
- Popover rows do not register with the trigger row they unfold from: rail icon at x=8, popover icon at x=14 (`List p-1.5` = 6, plus the button's `px-2` = 8). On a surface whose width is deliberately matched to the trigger, 6px of misregistration is visible.
- `bg-accent-gradient` in `src/styles.css` is now unused app-side. DESIGN.md names the active `WorkspaceMark` as its only user. The rail is now fully achromatic — *more* compliant with the Near-Neutral Spine rule, not less: the rail is structure, and structure takes no hue. But the product has lost its only app-side brand surface, which is a real trade and should be a conscious one.
- DESIGN.md's Navigation section is now three refactors stale. It describes a ghost `Button` in a `DropdownMenu` (code: `SideNavItem` + sibling `Popover`), the name at `font-medium` (code: 400, from `navItemStyles.item`), the 24px accent plate (removed), and `Divider`s at `-mx-2 my-1` between sections (removed in favour of section spacing).

## Questions to Consider

1. `<WorkspaceMark icon={...} isActive />` passed `isActive` as a hardcoded literal — in the rail the plate had exactly one possible appearance. What was it ever telling anyone?
2. If the answer to "which workspace am I in" is a glyph drawn from a 16-icon set that contains the Contacts row's own icon, was the plate ever doing identity work — or was it covering for an identity system that was never built?
3. DESIGN.md's Navigation section is the most detailed component description in the document, and four of its bullets no longer describe this file. If it drifts this fast on the one component it specifies most precisely, what is it still authoritative for?
