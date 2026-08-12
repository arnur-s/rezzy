---
name: Rezzy
description: Inbox-first AI-powered customer engagement platform for customer-facing teams
colors:
  # The stone theme is the source of truth: src/themes/stone/stoneTheme.ts,
  # applied at runtime by `<Theme theme={stoneTheme}>` in src/main.tsx. If this
  # block and that file disagree, the theme wins and this is stale.
  #
  # Values below are the LIGHT slot; the dark partner is named in the Colors
  # prose where it matters. Every token in stone is a genuine light/dark pair.
  #
  # Neutral spine: one tonal ramp at OKLCH H=291, C=3. Not chroma 0 — a faint
  # violet cast that is invisible in isolation and visible when a true gray
  # sits beside it. Tone stops are named T0–T100 in 5s by `stonePalettes`.
  stone-100: '#ffffff' # T100 — light pane, card, popover; on-dark label
  stone-96: '#f3f3f5' # T96 — light canvas
  stone-90: '#e2e2e8' # T90 — light muted well, light hairline, gray plate
  stone-85: '#d4d4da' # T85 — light skeleton, gray plate border
  stone-86: '#d7d7da' # light disabled text and icon
  stone-55: '#83838a' # T55 — light secondary text; emphasized border
  stone-65: '#9d9da3' # T65 — dark secondary text
  stone-40: '#5e5e61' # T40 — dark disabled; dark emphasized border
  stone-35: '#525257' # T35 — dark gray plate
  stone-30: '#46464b' # T30 — gray plate text
  stone-25: '#3b3b3f' # T25 — dark muted well, dark gray plate border
  stone-15: '#25252a' # T15 — primary text, interaction tint, dark popover
  stone-14: '#242325' # dark card
  stone-10: '#1b1b1f' # T10 — dark pane
  stone-5: '#111015' # T5 — dark canvas
  stone-shadow: '#28282a' # the shadow and overlay color
  # Brand accent — the one hue that means the product rather than a state.
  accent-gradient: 'linear-gradient(135deg, #8365a6 0%, #715b96 40%, #534c7e 100%)'
  accent: '#534c7e' # the ramp's dark stop; the flat form of the accent
  accent-dark: '#b4a3ca' # the dark-mode flat tone — same hue, lighter stop
  # Categorical plates — light T90 surface carrying T30 same-hue text.
  # Dark inverts to a solid T35 surface carrying T90 text.
  blue-plate: '#d7e4f5' # H=265 C=10
  blue-vivid: '#3c4856'
  cyan-plate: '#cce8e5' # H=190 C=10
  cyan-vivid: '#334b49'
  gray-plate: '#e2e2e8' # the neutral ramp, doing categorical duty
  gray-vivid: '#46464b'
  green-plate: '#d0e9ce' # H=142 C=17
  green-vivid: '#374c36'
  orange-plate: '#ffdcbb' # H=70 C=22
  orange-vivid: '#5b4227'
  pink-plate: '#f0dde8' # H=340 C=9
  pink-vivid: '#52424c'
  purple-plate: '#e8dff3' # H=307 C=11
  purple-vivid: '#4b4454'
  red-plate: '#f9dcd7' # H=33 C=11
  red-vivid: '#58413e'
  teal-plate: '#d4e7dc' # H=158 C=9
  teal-vivid: '#3b4a41'
  yellow-plate: '#f4e1b7' # H=90 C=23
  yellow-vivid: '#524622'
  # Status tones — the same three hues as the green/red/yellow categoricals,
  # and byte-identical to them. There is no second, saturated status language.
  status-success: '#374c36' # --color-success, light (dark #b4cdb2)
  status-error: '#58413e' # --color-error, light (dark #dcc0bc)
  status-warning: '#524622' # --color-warning, light (dark #d7c59c)
typography:
  # Three families are named and NONE of them is declared anywhere in the
  # repo. See The Cyrillic Coverage Rule and Known drift 1.
  display:
    fontFamily: "Montserrat, 'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '3.3125rem'
    fontWeight: 400
    lineHeight: 1.283
  heading:
    fontFamily: "Montserrat, 'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '1.6875rem'
    fontWeight: 600
    lineHeight: 1.3333
  title:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 600
    lineHeight: 1.4286
  body:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.4286
  label:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '0.6875rem'
    fontWeight: 500
    lineHeight: 1.4545
  code:
    fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, Consolas, monospace"
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.4286
rounded:
  none: '0.125rem'
  inner: '0.25rem'
  element: '0.5rem'
  container: '0.75rem'
  page: '1.5rem'
  full: '9999px'
spacing:
  '0-5': '2px'
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '6': '24px'
  '8': '32px'
  '12': '48px'
components:
  button-primary:
    backgroundColor: '{colors.stone-15}'
    textColor: '{colors.stone-100}'
    rounded: '{rounded.full}'
    padding: '8px 12px'
  button-secondary:
    backgroundColor: 'transparent'
    borderColor: '{colors.stone-55}'
    borderWidth: '1.5px'
    textColor: '{colors.stone-15}'
    rounded: '{rounded.full}'
    padding: '8px 12px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.stone-15}'
    rounded: '{rounded.full}'
    padding: '8px 12px'
  button-ghost-hover:
    backgroundColor: 'color-mix(in srgb, {colors.stone-15} 5%, transparent)'
    textColor: '{colors.stone-15}'
    rounded: '{rounded.full}'
    padding: '8px 12px'
  button-destructive:
    backgroundColor: '{colors.red-plate}'
    textColor: '{colors.red-vivid}'
    rounded: '{rounded.full}'
    padding: '8px 12px'
  list-row:
    backgroundColor: 'transparent'
    textColor: '{colors.stone-15}'
    rounded: '{rounded.container}'
    padding: '10px 12px'
  list-row-hover:
    backgroundColor: 'color-mix(in srgb, {colors.stone-15} 4%, transparent)'
    textColor: '{colors.stone-15}'
    rounded: '{rounded.container}'
    padding: '10px 12px'
  list-row-selected:
    backgroundColor: 'color-mix(in srgb, {colors.stone-15} 10%, transparent)'
    textColor: '{colors.stone-15}'
    rounded: '{rounded.container}'
    padding: '10px 12px'
  badge-info:
    backgroundColor: '{colors.blue-plate}'
    textColor: '{colors.blue-vivid}'
    rounded: '{rounded.element}'
    padding: '2px 6px'
  badge-neutral:
    backgroundColor: '{colors.gray-plate}'
    textColor: '{colors.gray-vivid}'
    rounded: '{rounded.element}'
    padding: '2px 6px'
  badge-blue:
    backgroundColor: '{colors.blue-plate}'
    textColor: '{colors.blue-vivid}'
    rounded: '{rounded.element}'
    padding: '2px 6px'
  input-default:
    backgroundColor: 'transparent'
    textColor: '{colors.stone-15}'
    rounded: '{rounded.element}'
    padding: '6px 8px'
  card-default:
    backgroundColor: '{colors.stone-100}'
    textColor: '{colors.stone-15}'
    rounded: '{rounded.container}'
    padding: '12px'
  message-bubble:
    backgroundColor: 'color-mix(in srgb, {colors.stone-15} 6%, transparent)'
    textColor: '{colors.stone-15}'
    rounded: '{rounded.container}'
    padding: '12px'
  pane-header:
    backgroundColor: 'transparent'
    textColor: '{colors.stone-15}'
    height: '56px'
    padding: '0 12px'
---

# Design System: Rezzy

## Mission

Produce implementation-ready, token-driven UI guidance for Rezzy that is
optimized for consistency, accessibility, and fast delivery across an
inbox-first product shell.

Every rule below must be actionable from a component file without a second
document open. Where a rule cannot be verified by a command — and in this
repository most cannot — it must at least be verifiable by reading one named
file.

## Brand

- **Product:** Rezzy — inbox-first, AI-powered customer engagement for customer-facing teams
- **Audience:** support, sales, and success operators working a shared inbox for hours at a time
- **Product surface:** authenticated web application (not a marketing site)
- **Primary locale:** Russian (`baseLocale: ru`), with English second
- **Visual style:** quiet, functional, implementation-oriented; a near-neutral structure with muted chromatic meaning

The audience distinction is load-bearing. A marketing site is read once and
optimizes for impression; this shell is read all day and optimizes for
sustained legibility, scan speed, and the absence of surprise. That is why the
type floor, the achromatic spine, and the single pane elevation are constraints
rather than preferences.

## Style Foundations

The canonical values. `src/themes/stone/stoneTheme.ts` is the source of truth;
if it and this list disagree, the theme wins and this list is stale.

- **Font family:** `font.family.body=Figtree`, `font.family.heading=Montserrat`, `font.family.code=JetBrains Mono`, `font.size.base=14px`, `font.weight.base=400`, `font.lineHeight.base=1.4286`
- **Typography scale** (base 14, ratio 1.25, `Math.round`ed to whole px by `expandTypeScale`, **not clamped**): `font.size.2xs=7px`, `font.size.xs=9px`, `font.size.sm=11px`, `font.size.base=14px`, `font.size.lg=18px`, `font.size.xl=22px`, `font.size.2xl=27px`, `font.size.3xl=34px`, `font.size.4xl=43px`, `font.size.5xl=53px`. One size is pinned by hand: `--text-supporting-size=12px`.
- **Color — accent:** `color.accent=#534c7e` (light) / `#b4a3ca` (dark) — the brand violet's dark stop, and a lighter stop of the same hue in dark. `color.accent.muted=#534c7e14` (light) / `#b4a3ca20` (dark). `color.neutral=#25252a0f` / `#f3f3f51a` stays achromatic — it is the interaction tint, not the accent. The gradient form, `--gradient-accent`, is declared in `src/styles.css` rather than the theme: `defineTheme`'s token map is typed to Astryx's own token names and has no gradient slot.
- **Color — text:** `color.text.primary=#25252a` / `#f3f3f5`, `color.text.secondary=#83838a` / `#9d9da3`, `color.text.disabled=#d7d7da` / `#5e5e61`, `color.text.on-accent=#ffffff` (light) / `#25252a` (dark)
- **Color — surface:** `color.surface.pane=#ffffff` / `#1b1b1f`, `color.surface.card=#ffffff` / `#242325`, `color.surface.popover=#ffffff` / `#25252a`, `color.surface.canvas=#f3f3f5` / `#111015`, `color.surface.muted=#e2e2e8` / `#3b3b3f`
- **Color — border:** `color.border=#e2e2e8` / `#f3f3f51a`, `color.border.emphasized=#83838a` / `#5e5e61`
- **Spacing scale** (4px grid, unchanged): `space.0-5=2px`, `space.1=4px`, `space.2=8px`, `space.3=12px`, `space.4=16px`, `space.6=24px`, `space.8=32px`, `space.12=48px`
- **Radius:** `radius.none=2px`, `radius.inner=4px`, `radius.element=8px`, `radius.container=12px`, `radius.page=24px`, `radius.full=9999px`
- **Shadow:** `shadow.low=0 2px 4px #28282A0D, 0 4px 8px #28282A1A`, `shadow.med=0 2px 4px #28282A0D, 0 4px 12px #28282A1A`, `shadow.high=0 4px 6px #28282A1A, 0 12px 24px #28282A26` — two soft layers, no negative spread, **no mode switch and no dark-mode inset rim**
- **Motion:** `motion.duration.fast-min=95ms`, `fast=125ms`, `fast-max=165ms`, `medium-min=225ms`, `medium=300ms`, `medium-max=400ms`, `slow=700ms` (from `{fast: 125, medium: 300, slow: 700, ratio: 0.75}`; companions are `base × ratio` and `base ÷ ratio`, rounded to 5ms)

Every value in this list is a semantic token in the theme. Component guidance
must name the token, never the hex, the px, or the ms.

### How the stone palette is built

Stone is a **tonal-ramp theme**. `stonePalettes` at the bottom of
`stoneTheme.ts` exports eleven ramps — one near-neutral plus ten hues — each at
every tone stop from T0 to T100 in fives, and **every token in the theme is a
named stop on one of those ramps**. That is the property to preserve: a new
token is chosen by picking a stop, not by picking a color.

The stops in use, and what each means:

| stop        | role                                              |
| ----------- | ------------------------------------------------- |
| T90 / T85   | light categorical plate / its border              |
| T35 / T25   | dark categorical plate / its border               |
| T30         | light plate text and icon; light status tone      |
| T90 (again) | dark plate text — the same hex as the light plate |
| T60 / T70   | softened input status borders                     |
| T80         | dark status tone                                  |
| T40 / T45   | syntax-highlighting light stops                   |

The symmetry is deliberate: a dark plate's text is byte-identical to the light
plate's surface, which is why every categorical pair lands within 0.1 of the
same contrast ratio in each mode (~7.2:1 light, ~6.0:1 dark, computed). Do not
hand-pick a value between stops — it will drift from that guarantee silently.

The neutral ramp is **H=291, C=3**, not chroma 0. The file calls the theme
"warm, earthy"; at OKLCH hue 291 it is not — it is a faint violet cast. The
cast is invisible on its own and visible the moment a true `#808080` or a
platform brand color sits beside it, which is the reason to take every gray
from the ramp rather than from Tailwind.

## Context and Goals

**Creative North Star: "The Inset Panel"**

Rezzy's shell is a canvas with elevated panes inset into it: the conversation
list, the thread, the contact panel, a settings page. What separates two regions
is the canvas showing between them, not a line drawn across them. This is the
product's structural claim, it has now survived two full changes of palette, and
almost every rule below still follows from it. Treat it as the durable identity.

What changed underneath is the material, and it changed in the direction of
quiet. The previous theme was a chroma-0 spine with a bright lime accent and
saturated signal fills — an achromatic field with a few loud objects in it.
Stone removed both loud halves, and the accent has since come back as a **brand
violet** — `--gradient-accent` on solid fills, `#534c7e` / `#b4a3ca` as the flat
tone everywhere else. A primary button is a violet pill, not a green one and no
longer a near-black one. The saturated status fills stayed gone: every _status_
object in the product is still a **muted pastel plate carrying same-hue text**,
at chroma low enough that a badge reads as a tinted gray until you look at it.
So the interface now has exactly one loud hue, and it means the product rather
than a state.

That is a real trade and it should be made knowingly: the system gained
uniformity — every plate is one construction, every contrast figure is the same
figure — and lost volume. Nothing on screen can shout any more. When something
genuinely must, the only levers left are placement, weight, and copy.

Depth changed too, and inverted by mode. **Light mode has no tonal ladder at
all**: pane, card, and popover are all `#ffffff`, and the only thing separating
a raised surface from what is under it is a soft two-layer shadow. **Dark mode
is the opposite** — a real five-step tonal ladder (canvas `#111015`, pane
`#1b1b1f`, card `#242325`, popover `#25252a`, muted `#3b3b3f`) with shadows that
do nothing, because they are near-black at 5–10% over a near-black surface and
there is no inset rim any more. Each mode carries elevation by exactly the
mechanism the other one lacks.

**Key Characteristics:**

- Canvas and panes: the shell is a canvas, each region is an inset pane with a fill, a radius, a gap, and a lift
- Gutter separation: the canvas showing between panes divides regions; hairlines rule only _within_ a pane
- Near-neutral spine: one H=291 C=3 ramp carries every surface, rule, and running-text tone
- One brand hue: a violet accent — a `135deg` ramp on solid fills, its dark stop `#534c7e` (light) / `#b4a3ca` (dark) everywhere else
- One color language: muted pastel plate plus same-hue text, for categories and for status alike
- Light lifts by shadow, dark lifts by tone — and neither mode has both
- Two type tiers: 14px body, 11px metadata — the second of which is below this document's own floor (see Known drift)
- Pill buttons, and a radius scale that dropped at every step: 2 / 4 / 8 / 12 / 24px
- Snappier motion: 125 / 300 / 700ms

### Known drift

The theme was swapped from `neutralTheme` to `stoneTheme` (`src/themes/stone/`,
applied in `src/main.tsx`) without a follow-up pass over the surfaces built
against the previous values. Nothing here is a style preference — each is a
place where the code and this document deliberately disagree, with this document
describing the target. Each is stated again in the section that owns it.

1. **No font in the stack exists.** The theme names **Figtree** (body),
   **Montserrat** (heading), and **JetBrains Mono** (code). None of the three
   has an `@font-face` anywhere in the repo, so every glyph resolves to
   `-apple-system` / the system UI stack. The self-hosted **Golos Text** subsets
   in `src/fonts` are still declared and are now referenced by nothing. This is
   the third time a theme has named a family it does not load, and it is the
   worst instance: Figtree ships Latin and Latin-ext only, so even if it were
   self-hosted `baseLocale: ru` would fall through it. Montserrat does ship
   Cyrillic; Figtree does not. Fixing it means self-hosting the families the
   theme names with their Cyrillic subsets, or putting `'Golos Text'` back
   immediately behind the body family. See The Cyrillic Coverage Rule.
2. **The 12px floor is broken at the token level.** Base 14 at ratio 1.25
   generates `sm=11px` and `xs=9px`, and — unlike the theme it replaced — stone
   **clamps nothing**. `--text-supporting-size` is pinned to 12px by hand, which
   covers Astryx's own `supporting` text type (`Badge`, `Banner`,
   `ChatMessageMetadata`, breadcrumbs, calendar), but the Tailwind `text-sm`
   utility reads `--font-size-sm` and bypasses that pin entirely. Every
   `text-sm` in `src/` renders at **11px**. See The 12px Floor Rule.
3. **The metadata tier was swept onto that broken step.** All ~117 `text-xs`
   usages in `src/` were replaced with `text-sm` in the same change as the theme
   swap; `text-xs` no longer appears in the codebase at all. Under the previous
   theme that was the correct fix (13px vs 12px); under stone it moves the
   entire metadata tier from 9px to 11px — better, and still below the floor.
   The right resolution is at the theme, not in the components: clamp
   `--font-size-sm` (and everything below it) to `0.75rem` in `stoneTheme.ts`,
   exactly as the previous theme did.
4. **`text-secondary` fails AA in light mode.** `#83838a` computes **3.76:1**
   on the white pane and **3.40:1** on the canvas, against a 4.5:1 requirement.
   This is a regression of the single largest accessibility gain the previous
   theme made (7.0:1), and it hits the most-used receding tone in the product:
   timestamps, previews, descriptions, every supporting caption. T50 (`#77777c`)
   was listed here as reaching ~4.5:1; measured in a browser it is **4.45:1** on
   the pane and does not clear, and on the transcript's pane wash it drops to
   4.01:1. **T45 (`#6a6a6f`) is the only candidate that clears both**, at 5.38:1
   and 4.85:1. Dark mode is fine on the pane (6.36:1) but also fails on the muted
   well (4.13:1). The transcript wash deepens the light-mode failure slightly —
   3.48:1 at the worst real text position; see Pane wash under Message Bubbles.
5. **Light mode has no raised tone.** `bg-card` and `bg-popover` are both
   `#ffffff`, identical to `bg-surface`. A card on a pane, and a popover over a
   card, are separated by `--shadow-low` / `--shadow-high` alone. The shadows
   are soft (5–10% at 4–24px), so this works but has no margin; anything that
   drops its shadow becomes invisible. See The Rim Is Gone Rule.
6. **Dark mode's shadows do nothing.** All three shadow tokens are a fixed
   `#28282A` at 5–15% with no `light-dark()` switch, so in dark mode they paint
   near-black on near-black. The 1px white inset rim the previous theme carried
   is gone. Dark elevation is entirely tonal, and the popover/card step is
   `#25252a` over `#242325` — **1.03:1**, effectively no step at all. A popover
   opened over a card in dark mode has no edge by any mechanism.
7. **`border-border-emphasized` is below 3:1 in dark mode.** `#5e5e61` on the
   `#1b1b1f` pane computes **2.66:1**, and it is the secondary Button's entire
   visible form — that button is `transparent` with a 1.5px border and nothing
   else. In light mode the same token is 3.76:1 and clears.
8. **The status inset rings lost their status.** `--shadow-inset-success`,
   `-warning`, and `-error` are all `inset 0 0 0 2px #83838a30` — the same
   neutral gray. A success ring and an error ring are now indistinguishable.
   `--shadow-inset-hover` / `-selected` moved from signal blue to neutral
   `#28282A` at 30% / 50%, which is intentional and fine; the three status ones
   are not.
9. **Plates went round again, and now at both sizes.** `--radius-page` moved
   18px → 24px. It is exactly half of 48px, so a `size-12` plate is now exactly
   circular, and it exceeds half of 36px, so a `size-9` plate clamps to a circle
   too. Every avatar and platform plate in the product is a circle. See The
   Plate Went Round.
10. **Buttons are pill-shaped and still 32px tall.** `components.button.base`
    sets `borderRadius: var(--radius-full)`, so every button in the product is a
    stadium. The height is still Astryx's declared `height: 32px`, still below
    the 44px touch-target criterion in the Accessibility section.
11. **`--color-*-muted` equals `--color-*` in dark mode.** `--color-success` and
    `--color-success-muted` are both `#b4cdb2` in dark; error and warning do the
    same. Status text drawn on its own well would be invisible. In practice the
    theme's `banner` and `field-status` overrides redirect those surfaces to the
    categorical plates, and product code uses `bg-error/10` alpha rather than the
    `-muted` token, so nothing currently hits it — but any new use of a
    `-muted` well with its matching tone on top will render blank in dark mode.
12. **`border-border/60` is close to invisible in light mode.** 30 usages
    remain. The border token is an opaque `#e2e2e8`; at `/60` it composites to
    roughly `#eeeef1` on a white pane. See The Hairline Is Already Thin Rule.
13. **Fixed-width controls were sized against a 16px body.** Body type moved
    16px → 14px, so every control with a hard width now holds roughly 14% _more_
    characters than when its budget was set — the safe direction, for once. The
    budgets in `src/lib/message-lengths.test.ts` are character counts and cannot
    see either direction. Russian still runs 15–30% longer than English; verify
    in a browser at phone width.
14. **No command verifies anything in this document.** Contrast, font size,
    overflow, and shell elevation have no automated check, so every rule here is
    held by review alone. Contrast figures below are computed from the token
    values rather than measured in a browser, and are marked as such.

## Colors

A near-neutral structure and a muted chromatic vocabulary, kept strictly apart.
The neutrals carry every surface, every rule, and every piece of running text;
hue appears only where something needs to be _told_ to the user.

### Primary

**The accent is a violet brand hue with two forms — a ramp and a flat tone.**

The ramp is the fill:

```css
--gradient-accent: linear-gradient(
  135deg,
  #8365a6 0%,
  #715b96 40%,
  #534c7e 100%
);
```

The flat tone is its dark stop, `#534c7e` in light and a lighter stop of the
same hue, `#b4a3ca`, in dark. `--color-accent`, `--color-text-accent`, and
`--color-icon-accent` are all that one value — a gradient cannot be a color
token, so every accent _line_ (text, icon, ring) and every low-alpha plate
takes the flat tone, and only fills large enough to show a ramp take the
gradient.

- A primary Button is a violet ramp with a white label — **7.8:1** against the label at the ramp's lightest stop, computed. The gradient is applied in the theme's `button` / `variant:primary` override, which also has to restack Astryx's hover and pressed tints (they are painted into `background-image`, so a plain override would drop the ramp on hover).
- `ring-accent` is `#534c7e` in light (7.8:1 on the pane) and `#b4a3ca` in dark (7.4:1). Both clear every fill in the system.
- `bg-accent-bg/10`, the pale plate behind accent text, composites to a faint violet tint on a white pane rather than the soft gray it used to be.
- `--color-accent-muted` is the flat tone at 8% (light) / 12.5% (dark), the quiet accent surface.
- `bg-accent-gradient` (`src/styles.css`) is the utility for app-side solid accent plates. The sidebar's active `WorkspaceMark` is the one current user.

**The label does not follow `--color-on-accent` on a gradient fill.** The ramp
is dark in both modes while `--color-on-accent` inverts, so anything painted
with `--gradient-accent` fixes its label to `--color-on-dark` (`text-on-dark`).
Flat accent fills — the small controls: checkbox, switch, radio, tab indicator
— keep `text-on-accent` and the inversion, which is what lets the dark-mode
accent be a light stop.

**The accent is now identity, not just emphasis.** A violet plate reads as the
product's own color. It still does not encode a category or a state: anything
that must _mean_ something reaches for a `Badge`, `Banner`, or `Card` variant.

**Interactive state is the primary text tone at low alpha**, and stays
achromatic — it did not follow the accent to violet: `bg-primary/4` (hover),
`bg-primary/10` (selected), `bg-primary/5`
(quiet plate), where `bg-primary` bridges to `--color-text-primary`. On the
light pane those compute to `#f6f6f6` and `#e9e9ea`. Those three percentages are
the whole state vocabulary.

### Neutral

One ramp, H=291 C=3, read from both ends. Light and dark are genuine pairs, so
read each role as a pair.

- **T100 `#ffffff`** / **T10 `#1b1b1f`**: the pane — `bg-surface`. The one background token that is reliably a step away from the canvas in both modes, which is why the shell is built on it.
- **T96 `#f3f3f5`** / **T5 `#111015`**: the canvas — `bg-body`. Computed 1.11:1 light and 1.10:1 dark against the pane: a real but very quiet step in both modes.
- **T100 `#ffffff`** / **`#242325`**: `bg-card`. In light this is **identical to the pane** — cards no longer have a tonal edge; see Elevation.
- **T100 `#ffffff`** / **T15 `#25252a`**: `bg-popover`. Same story, and in dark it is 1.03:1 against the card beneath it.
- **T90 `#e2e2e8`** / **T25 `#3b3b3f`**: `bg-muted`. In light it is a genuine step _down_ from both the pane (1.29:1) and the canvas (1.16:1) — an improvement, since it used to be byte-identical to the canvas. In dark it is a step _up_ from the pane (1.54:1). One token, opposite directions by mode; see The Recess Is Pane-Relative Rule.
- **T15 `#25252a`** / **T96 `#f3f3f5`**: `text-primary`. Computed **15.25:1** light and **15.49:1** dark against the pane. This used to be the same value as the accent; since the accent became a brand hue, running text and the primary fill are two separate tones and `text-primary` is purely the neutral ramp's endpoint.
- **T55 `#83838a`** / **T65 `#9d9da3`**: `text-secondary`. Computed **3.76:1** light and 6.36:1 dark against the pane. **The light slot fails AA** — see Known drift 4. Until it moves, treat `text-secondary` in light mode as a known defect rather than as the safe default it used to be.
- **`#d7d7da`** / **T40 `#5e5e61`**: `text-disabled`. 1.44:1 light — disabled text is exempt from the contrast requirement, and this is the value that makes that exemption load-bearing.
- **T90 `#e2e2e8`** / **T96 at 10%**: `border-border`. Light is an opaque tone, dark is an alpha wash. The light hairline is byte-identical to the light muted well, so a rule and a recessed surface are the same tone.
- **T55 `#83838a`** / **T40 `#5e5e61`**: `border-border-emphasized`. The secondary Button's outline. 3.76:1 light, **2.66:1 dark** — see Known drift 7.
- **T85 `#d4d4da`** / **`#5e5e64`**: `--color-skeleton`. Also the ProgressBar track and the Switch off-track, both redirected there by component overrides because `--color-background-muted` reads too close to the body tone to be a visible channel.

### Secondary (Categorical)

Ten hues, each a full OKLCH ramp in `stonePalettes`: blue H=265 C=10, cyan
H=190 C=10, green H=142 C=17, teal H=158 C=9, yellow H=90 C=23, orange H=70
C=22, red H=33 C=11, pink H=340 C=9, purple H=307 C=11, plus the neutral ramp
doing gray duty. Each ships four tokens, bridged to Tailwind as `*-subtle`
(plate), `*-ring` (border), and `*-vivid` (text); the icon slot uses the vivid
color.

**Both modes are solid, and that is a change.** Light is a T90 plate carrying
T30 text; dark is a T35 plate carrying T90 text. The previous theme made the
dark plate a hue-tinted alpha overlay so it could composite onto whatever sat
behind it; stone does not. A dark chip is now an opaque panel, so it reads
identically on the canvas, on a pane, and in a popover only because those three
are close in tone — not because it is compositing.

Every pair lands in the same narrow band, by construction:

| hue    | light plate / text    | computed | dark plate / text     | computed |
| ------ | --------------------- | -------- | --------------------- | -------- |
| blue   | `#d7e4f5` / `#3c4856` | 7.24:1   | `#485362` / `#d7e4f5` | 6.06:1   |
| green  | `#d0e9ce` / `#374c36` | 7.21:1   | `#425841` / `#d0e9ce` | 6.00:1   |
| red    | `#f9dcd7` / `#58413e` | 7.25:1   | `#644d49` / `#f9dcd7` | 6.02:1   |
| yellow | `#f4e1b7` / `#524622` | 7.22:1   | `#5e512d` / `#f4e1b7` | 6.06:1   |
| gray   | `#e2e2e8` / `#46464b` | 7.27:1   | `#525257` / `#e2e2e8` | 6.02:1   |

Orange, teal, cyan, purple, and pink land in the same band and are unused by any
product surface. They are capacity for a future categorization, not current
vocabulary.

The plates are **low chroma by design**. A stone red plate is a warm gray with a
hint of clay; a stone blue is a cool gray with a hint of slate. Two adjacent
chips of different hue are distinguishable, but they are not distinguishable at a
glance across a scrolling list, and they are not distinguishable at all to a
significant fraction of color-blind users. **Nothing may rely on plate hue
alone** — that was already a rule and it now has teeth.

### Tertiary (Status)

**There is one status language, and it is the categorical one.** The previous
theme's second language — saturated opaque signal fills for badges, dots, and
progress — does not exist in stone. No signal tokens are defined.

`--color-success` / `-error` / `-warning` are drawn as **text and icon**, and
they are byte-identical to the green, red, and yellow categorical `*-vivid`
values in light mode:

- **Success** `#374c36` (green T30) / `#b4cdb2` (T80)
- **Error** `#58413e` (red T30) / `#dcc0bc` (T80)
- **Warning** `#524622` (yellow T30) / `#d7c59c` (T80)

Computed against the pane: 9.34:1, 9.37:1, and 9.30:1 in light; 10.07:1,
10.06:1, and 10.10:1 in dark. All clear AAA.

Their `-muted` partners are the T90 plates in light — the same value as the
matching categorical chip, so a green chip and a success banner are one tone on
purpose. **In dark mode `-muted` is byte-identical to the tone itself**, which
is a defect rather than a decision; see Known drift 11.

Three component overrides shape how status reaches the screen, and they are
worth knowing before styling anything with a state:

- **`banner`** redefines `--color-{success,warning,error}-muted` and the text tokens _inside the banner's scope_, so the surface, the icon, the title, the description, and the `endContent` all arrive in one hue. It does this by redefining variables rather than by setting `backgroundColor`, because StyleX paints the banner surface from a layer above `astryx-theme` and a direct override would lose the cascade. Copy that technique, do not fight it.
- **`field-status`** points the three status surfaces at the categorical plates.
- **All nine input components** share `INPUT_STATUS_VARS`, which softens `--color-{success,warning,error}` to T60 (light) / T70 (dark) inside a field's status scope, so the border and the status icon read as a gentle hue rim rather than as a saturated line. Those softened borders compute ~3.17:1 against the white pane — clearing the 3:1 non-text requirement with almost nothing spare.

### Named Rules

**The Near-Neutral Spine Rule.** Every structural surface, rule, and
running-text tone comes from the H=291 C=3 ramp. Nothing that is merely
_structure_ takes a hue. The corollary is the valuable half: because the field
is (almost) achromatic, a single chip is legible without being large, and adding
a decorative hue costs more here than it would in a tinted system.

The accent is not an exception to this rule — it is the ramp's own endpoint.
**Stone has no sanctioned hue at all.** If a surface needs to mean something, it
takes a categorical plate through a component variant; if it needs to be
emphatic, it takes the accent, which is a tone.

**The Accent Cannot Be Split By Token Rule.** Stone does not currently trip this
trap, and the rule exists so that a future theme does not.

The Tailwind bridge in `@astryxdesign/core/src/tailwind-theme.css` looks like it
separates the accent's two jobs:

```css
--color-accent: var(--color-text-accent); /* text-accent, ring-accent */
--color-accent-bg: var(--color-accent); /* bg-accent-bg */
```

It does not. A theme that assigns `--color-accent` lands **later in the cascade
than the alias**, so the alias is overwritten and `text-accent`, `ring-accent`,
and `bg-accent-bg` all resolve to that one value. The consequence: **you cannot
give the accent a bright fill and a dark text tone through tokens.** An attempt
to do so silently ships `text-accent` and `ring-accent` at the fill value across
all 37 accent usages in `src/`, and nothing typechecks, lints, or tests
differently.

So `--color-accent` and `--color-text-accent` **must** stay byte-identical — as
they are in stone — and a color too bright to be text belongs on a **component
override** instead.

**The Accent Label Inverts Rule.** `--color-on-accent` is `#ffffff` in light and
`#25252a` in dark, tracking the accent's own inversion. Put `text-on-accent` on
any accent fill and the label follows the mode; hardcode `text-white` and it
disappears the moment the theme flips.

**The Chip Carries Its Own Text Rule.** A categorical plate is never combined
with `text-primary`. Each hue's `*-vivid` token is the only correct foreground on
its `*-subtle` plate, and the theme's `badge`, `card`, and `banner` variants
rebind the text tokens locally so nested `Text` children inherit them. Use the
variant; do not hand-assemble a plate.

**The Chip Is Not A Field Rule.** A plate is calibrated for chip area. A pastel
that is right behind 11px text at 60px wide is a slab at 700px. A status surface
that runs the full measure fills with the `-muted` well and spends its hue on the
icon, the copy, and the action — the field goes quiet, the meaning does not.

**The Plate Is Solid In Both Modes Rule.** A dark categorical background is now
an opaque T35 tone, not an alpha overlay. It therefore does _not_ adapt to what
sits behind it. Placing a chip on a surface far from the pane tone — inside a
muted well at `#3b3b3f`, say — is a composition decision that has to be looked
at, not one the token absorbs.

**The One Language Rule.** There is no loud status variant left. A `Badge
variant="error"` is a muted clay plate, not a red fill. Do not reintroduce a
saturated fill for a single component to "make it stand out" — that puts one
object in the product outside the system and it will be the only one, forever.
If a state needs more weight, give it position, size, weight, or copy.

**The Brand-Hex Exception.** Platform brand colors — Telegram `#26A5E4`,
WhatsApp `#25D366`, Instagram `#E1306C`, in
`src/entities/channel/lib/platform.ts` — are the only raw hex values permitted in
component code, because they are other companies' identities and must not drift
with the theme. They are also, in stone, the most saturated objects that will
ever appear on screen: the palette around them has nothing at that chroma.

## Typography

**Body / Interface Font:** Figtree, falling back to `-apple-system,
BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
**Heading Font:** Montserrat, falling back to Figtree and then the same stack
**Display Font:** Montserrat — `display-1..3` use the heading family
**Code Font:** JetBrains Mono, falling back to `"SF Mono", Monaco, Consolas, monospace`

**None of the three is loaded.** There is no `@font-face` for Figtree,
Montserrat, or JetBrains Mono anywhere in the repo, so the browser falls through
every named family to `-apple-system` and the entire interface renders in the
system UI stack. The self-hosted Golos Text woff2 subsets in `src/fonts` are
still declared in `src/fonts/fonts.css` and imported by `src/styles.css`, but
nothing names Golos Text any more, so nothing downloads them. See Known drift 1.

**The Cyrillic problem is worse than the loading problem.** `baseLocale` is
`ru`. Figtree ships Latin and Latin-ext only — self-hosting it as written would
put the primary locale in the system stack and style only the Latin strings
beside it, which reads as two typefaces on one screen. This is the exact failure
Figtree already caused once in this repository. Montserrat does ship Cyrillic
and is safe as the heading family. Either self-host Figtree _and_ put a
Cyrillic-covering face directly behind it, or make the body family one that
ships Cyrillic itself.

**Character:** Figtree is a geometric sans with a tall x-height and fairly
closed apertures; Montserrat is a wider geometric with a much larger cap height,
so a Montserrat heading over Figtree body is a deliberate two-voice register
rather than one family at two sizes — the first time this product has had one.
Whether that register is right for a shell read all day is a live question and
not one this document can settle; what it can say is that the two families must
both be loaded before the question is even askable.

### Hierarchy

The scale is **base 14, ratio 1.25**, `Math.round`ed to whole px by
`expandTypeScale`, producing 7 / 9 / 11 / 14 / 18 / 22 / 27 / 34 / 43 / 53px.
Line heights are 4px-grid-snapped with a `fontSize + 4` minimum, so 14px body
sets on a 20px line (1.4286) and 11px metadata on a 16px line (1.4545).

- **Display** (400, 3.3125rem / 53px, 1.283 lh): `Text type="display-1"`, plus `display-2` (43px) and `display-3` (34px). No product surface uses these.
- **Heading** (600, 1.6875rem / 27px, 1.3333 lh): Astryx `heading-1`. Theme capacity; the shell has nothing at this scale. `h3` and `h4` are bold (700) rather than semibold, set by `typography.heading.weights`.
- **Title** (600, 0.875rem / 14px): `text-base font-semibold`. Page titles — the workspace settings `h1`, empty-state headings.
- **Body** (400–500, 0.875rem / 14px, 1.4286 lh): `text-base`. The workhorse: message text, contact names, previews, form content, descriptions. Prose runs inside a `max-w-3xl` measure.
- **Metadata** (500, 0.6875rem / 11px, 1.4545 lh): `text-sm`. Timestamps, chip text, filter labels, supporting captions. Sentence case, always. **This is below the 12px floor** — see Known drift 2 and 3.
- **Supporting** (400, 12px): `Text type="supporting"` and the Astryx components that read `--text-supporting-size` — `Badge`, `Banner`, `ChatMessageMetadata`, breadcrumbs, calendar. The one size the theme pins by hand, and currently the only thing in the product holding the floor.

### Named Rules

**The Remapped Scale Rule.** Tailwind's size names do not mean their Tailwind
values here. `@astryxdesign/core/tailwind-theme.css` rebinds `--text-*` to the
theme scale, so **`text-base` is 14px, `text-sm` is 11px, `text-lg` is 18px, and
`text-xl` is 22px**. Not one of them matches Tailwind's default. Never convert a
design spec's px value by assuming Tailwind's scale. The same bridge rebinds
`--spacing` to `--spacing-1` (4px), so `p-4` is 16px as expected — spacing is
safe, type is not.

**The 12px Floor Rule.** Nothing in this product should render below 12px. 12px
is the bottom of the legible range for interface text, and `baseLocale` is `ru`,
whose diacritics and soft signs are the first things to go as size drops.

_The theme does not currently hold this._ The previous theme clamped
`--font-size-xs` and every step below it to `0.75rem`; stone clamps nothing, so
`text-sm` ships at 11px and `text-xs` at 9px. The fix belongs in
`stoneTheme.ts` — clamp `--font-size-sm` and below to `0.75rem`, which leaves
the base and every size above it untouched — not in a sweep across components.

Two sizes are outside a token's reach either way and are floored in
`src/generated/astryx-font-floor.css`: Astryx's `Avatar` computes its initials
from the avatar's pixel size (`size * 0.4`) and writes an inline
`--x-fontSize`, and `Table`'s sort indicator carries a literal `font-size: 10px`.
Both are raised with `max()`, so larger avatars keep their proportional initials.
The selectors are StyleX atomic hashes read out of the installed package rather
than written by hand — **and there is no generator**, so the file cannot be
regenerated after an `@astryxdesign/core` upgrade without re-deriving the hashes.
Treat it as pinned to 0.1.8.

**The Two-Tier Rule.** The interface has two tiers: **body at `text-base`** and
**metadata at `text-sm`**. `text-lg` and above are theme capacity, not shell
vocabulary. Escalate through weight (400 → 500 → 600) and opacity, not through
size. Introducing a third size into a shell means the hierarchy failed at weight
first.

`text-xs` no longer appears anywhere in `src/` and should not come back: at 9px
it is unusable, and the tier it used to serve is `text-sm`'s job.

**The Opacity Step Is Mode-Asymmetric Rule.** `text-primary/55` computes to
3.58:1 in light and 5.53:1 in dark, so an opacity step tuned in one mode can be
under AA in the other. `/70` (5.72:1 light, 8.12:1 dark) remains the lowest rung
that clears both; `/60` (4.16:1 light) does not. Under stone an opacity step is
also **safer than `text-secondary` in light mode**, which is the inverse of the
previous theme and the inverse of the advice this document used to give — until
Known drift 4 is fixed, prefer `text-primary/70` where a designed tone would
have been the obvious choice.

**The Cyrillic Coverage Rule.** Cyrillic must be covered by a font the repo
declares, and it must be covered _before_ the system fallback. `baseLocale` is
`ru` (`project.inlang/settings.json`), so Russian is the default experience, not
a translation bolted on.

This rule has now caught four faces: **Fustat**, the gothic theme's choice,
which ships Arabic and Latin; **Figtree**, which arrived with the neutral theme,
was removed for exactly this reason, and is back as stone's body family;
**Albert Sans**, which was survivable only because self-hosted Golos Text sat
directly behind it; and **JetBrains Mono**, which does ship Cyrillic but is
declared nowhere.

Judge a candidate body face by its `unicode-range` coverage before its shapes.
If it does not ship Cyrillic, it may only be the primary of a stack whose next
entry does — and that entry must come **before any generic fallback**. Confirm
the `@font-face` exists either way: naming a family in the theme does not load
it.

## Layout

**The shell.** `AppShell` with `variant="wash"`, `height="fill"`, and
`contentPadding={0}` (`src/routes/_authenticated.tsx`). The rail and the content
area both take the canvas tone; the panes lift off it. `section` is wrong here
because it draws a hairline down the rail's edge, which reads as a stray line
once the seam is a gutter, and `elevated` is wrong because it owns the corner
treatment itself and rounds only the content area's top-start corner. The nav
rail is the only persistent chrome; there is no top bar. Below the mobile
breakpoint AppShell turns the rail horizontal with a drawer toggle — that strip
is generated, not authored.

**Panes.** `AppPaneGroup` and `AppPane` (`src/components/app-pane.tsx`). The
group is the canvas and owns the gutter (`md:gap-2 md:p-2 pl-0!`, an 8px seam
with the leading edge collapsed against the rail); the pane carries the fill
(`bg-surface`), the radius (`md:rounded-lg`, now 12px), the lift
(`md:shadow-sm` → `--shadow-low`), and the scroll containment. The group is
mounted once, in the shell root, so a route contributes panes and can never
forget the inset. The inbox contributes three sibling panes; a single-pane route
contributes one. `contentPadding={0}` on AppShell is what keeps the two from
doubling the seam.

A pane has no padding of its own. Its children — a 56px header, a scroll region,
a composer — each own their insets, and a pane-level pad would double them.
`overflow-hidden` on the pane is structural rather than cosmetic: it is what
clips a child's square corners to the pane's radius, so a header rule or a
selected row stops at the curve instead of poking through it.

Below `md` the frame is dropped entirely. A phone has no room to spend on a
gutter, so panes go full-bleed and the canvas stops being visible — which is why
the radius, the shadow, and the inset are all `md:`-prefixed.

**The pane header contract.** 56px (`h-14`) plus a bottom rule, attached to the
pane's top edge. That rule is intra-pane: it separates the fixed title from the
region that scrolls under it, not one pane from the next. The conversation list,
the thread, the contact panel, and workspace settings all honor those two
numbers, which is what makes the inbox columns line up across the gutters between
them. Horizontal padding is the pane's own business and varies with what the
header holds — the thread runs `px-3 sm:px-6`, the contact panel `px-4`, the
settings column `px-4 sm:px-8`. Height and the rule are the contract; padding is
not.

**Scroll ownership.** Every pane owns its own scroll (`min-h-0 flex-1
overflow-y-auto`). The shell content area never scrolls. The scroll container
spans the pane edge to edge and the reading measure goes on a child, so the
scrollbar rides the pane rather than the text.

**The reading measure.** `mx-auto w-full max-w-3xl` (768px), exported as
`TRANSCRIPT_MEASURE` from
`src/features/inbox/components/message-thread/transcript-measure.ts` and shared
by the transcript, its loading skeleton, and the composer so all three align on
one axis. Settings pages use the same `max-w-3xl` column with `px-4 sm:px-8`.

**Density.** Spacing is a 4px scale (2 / 4 / 8 / 12 / 16 / 24 / 32 / 48px at the
named steps) and is the one foundation stone did not touch. Conversation rows
are `px-3 py-2.5` with `gap-3` and `gap-0.5` between rows; nav rows are `px-2
py-2`; settings rows are `py-4`. The inbox list is user-resizable via
`useResizable` (default 320px, min 200, max 480, persisted as
`inbox:list-width`) with a `ResizeHandle` in the seam. The handle runs without
`hasDivider`, so it takes zero width and contributes only a hit area: what the
user grabs is the gutter itself. `-mx-1` absorbs the second gap the group would
otherwise put around it, keeping that seam the same width as every other one.

Note that the body type shrank 16px → 14px while the spacing scale held, so
every row in the product is now proportionally airier than it was designed to
be. That is a look, not a defect — but it is a change nobody chose, and it is
the reason a density pass may be worth doing before adding anything new to a
dense list.

**Responsive behavior.** Three tiers, and they are pane-count decisions, not
reflow:

- **Mobile:** exactly one pane at a time — list, or thread, or contact. Panes never share the viewport; navigation swaps them.
- **Tablet (below `lg`):** list plus thread. The contact panel becomes a right-side overlay sheet (`w-80 max-w-[85vw]`) over a `bg-black/50` scrim, so the thread never collapses to an unusable width. The sheet is itself an `AppPane` inset by the same gutter the docked panes use, so it reads as the same kind of object arriving from the edge rather than as a full-height slab.
- **`lg` and up:** all three panes as columns, contact panel fixed at 320px.

**Toast placement.** Bottom-trailing corner at `lg` and up, top center below it.
Astryx only offers four corners (`LayerProvider`'s `toast.position`), so the
centered variant is a `@layer components` override in `src/styles.css` rather
than a prop. The corner is wrong on a phone or a tablet because that is exactly
where the composer's send button, the scroll-to-bottom button, the iOS browser
chrome, and the on-screen keyboard all live; the top edge holds nothing but the
generated AppShell strip. The override reaches the viewport by the same
`[popover="manual"][role="region"]` selector `AppLayerProvider` uses — the two
have to move together — and wins on layer order, not specificity, since StyleX
inflates its own rules past anything hand-written.

### Named Rules

**The Measure Rule.** The transcript, its skeleton, and the composer share one
exported measure constant. Tailwind's `container` is wrong here — it tracks the
breakpoint up to 1536px and lets messages sprawl across an empty page on a wide
display. Change the measure in one place or not at all.

**The Pane Owns Its Scroll Rule.** Scrolling belongs to the pane, never to the
shell or to a wrapper around several panes. A pane that does not carry `min-h-0`
in its flex chain will push its scroll up to an ancestor and take the whole shell
with it.

## Elevation & Depth

The shell's depth is arithmetic before it is styling: **`--color-background-body`
(canvas) and `--color-background-surface` (pane) must resolve to different
values.** Under stone they do — `#f3f3f5` / `#ffffff` in light, `#111015` /
`#1b1b1f` in dark — and that difference is the entire reason a pane reads as an
object rather than as more page. Both steps are quiet (1.11:1 and 1.10:1,
computed), so the gutter's geometry is doing as much work as the tone is.

This is worth stating as a constraint rather than a description, because it is
invisible to every cheap check. A theme that collapses the two still renders,
still typechecks, still passes the unit suite; the app just quietly becomes one
flat sheet with unexplained gaps in it. An earlier theme did collapse them and
the shell was rebuilt around hairlines as a result, so this is a live failure
mode rather than a hypothetical one. **No check asserts it**, so the constraint
is enforced by reading alone.

**The surface ladder, and the fact that only one mode has one:**

| token        | light     | dark      |
| ------------ | --------- | --------- |
| `bg-body`    | `#f3f3f5` | `#111015` |
| `bg-surface` | `#ffffff` | `#1b1b1f` |
| `bg-card`    | `#ffffff` | `#242325` |
| `bg-popover` | `#ffffff` | `#25252a` |
| `bg-muted`   | `#e2e2e8` | `#3b3b3f` |

Read the two columns against each other. **Light has three identical values in
the middle** — pane, card, and popover are all pure white — so above the canvas
there is exactly one tonal step and everything else is shadow. **Dark has a full
five-step ladder**, and the two steps at the top of it are 1.10:1 (card over
pane) and 1.03:1 (popover over card): present in the token file, barely present
on screen.

Shadows do not rescue either case symmetrically. All three shadow tokens are a
fixed `#28282A` at 5–15%, with **no `light-dark()` switch and no inset rim**, so:

- In **light**, the shadow is the only separator a card or popover has, and it works — softly.
- In **dark**, the shadow paints near-black on near-black and contributes nothing. The previous theme's 1px white inset rim, which existed precisely for this, is gone.

Inside a pane, depth has **two further moves**, both tonal:

1. **Recess** — `bg-muted` (`#e2e2e8` / `#3b3b3f`). Avatar and platform plates, media wells, skeleton blocks. In light it now recesses against the pane _and_ against the canvas, which it did not under the previous theme. In dark it is a step _above_ the pane, so it raises — see The Recess Is Pane-Relative Rule.
2. **Raise** — `bg-card` (`#ffffff` / `#242325`) plus `--shadow-low` where Astryx's `Card` applies it. Auth and onboarding sheets, popovers, dialogs. Light raises by shadow only; dark raises by tone only.

Region boundaries in the authenticated shell are gutters. Hairlines remain for
boundaries _within_ a pane.

### Shadow Vocabulary

Shadows are theme tokens applied by Astryx components. Each is a **two-layer
soft drop** — a tight contact layer plus a wider ambient one — replacing the
single large-negative-spread layer the previous theme used.

- **`--shadow-low`** (`0 2px 4px #28282A0D, 0 4px 8px #28282A1A`): Cards, raised sheets, and every `AppPane` via `shadow-sm`.
- **`--shadow-med`** (`0 2px 4px #28282A0D, 0 4px 12px #28282A1A`): Hover and mid-elevation containers, via `shadow-md`. Note it differs from `low` only in the second layer's blur — the two are nearly the same shadow.
- **`--shadow-high`** (`0 4px 6px #28282A1A, 0 12px 24px #28282A26`): Popovers, dropdowns, dialogs, via `shadow-lg`.
- **`--shadow-inset-hover` / `-selected`** (`inset 0 0 0 2px #28282A30 / 50`): Ring-style emphasis where a real border would shift layout. Neutral, matching the accent.
- **`--shadow-inset-success` / `-warning` / `-error`** (`inset 0 0 0 2px #83838a30`): **all three are the same neutral gray** — see Known drift 8.

### Named Rules

**The Surface-Above-Canvas Rule.** `bg-surface` must paint something against
`bg-body`. A theme is free to choose the two tones, but not to make them equal:
the shell's entire structure rests on that gap, and collapsing it removes every
region boundary in the app at once.

**The Rim Is Gone Rule.** The previous theme separated same-tone dark surfaces
with a 1px white inset rim carried inside the shadow tokens. Stone has no rim
and no dark shadow. So: **in dark mode, a raised surface is separated from what
is under it by tone or by nothing.** Hand-rolling a popover over a card with
`bg-popover` gives a 1.03:1 step and no edge. Until a rim or a dark shadow comes
back, a dark-mode overlay that must read as separate needs a `border-border`
(the dark border token is a 10% white wash and is visible) rather than a shadow.

**The Light Mode Has No Raised Tone Rule.** `bg-card`, `bg-popover`, and
`bg-surface` are all `#ffffff`. A light-mode card is a shadow and nothing else,
so **a raised surface that drops its shadow disappears entirely**. Never
suppress a `Card`'s shadow for a "flatter" look; there is no tone underneath it
to carry the shape.

**The Recess Is Pane-Relative Rule.** `bg-muted` does not mean one thing.
In light it is a genuine step down from both the pane and the canvas. In dark it
is `#3b3b3f` against a `#1b1b1f` pane, so it _raises_ — 1.54:1 up, which is the
largest single surface step anywhere in the theme. Anything that must read as
recessed has to be checked in dark mode specifically, where the same token does
the opposite thing more strongly than it does the intended thing in light.

**The Gutter Rule.** The canvas showing between panes is what separates regions.
It is owned by `AppPaneGroup` in one place, so the seam is one value everywhere
and a route cannot hand-roll its own. A pane never carries a border: a shadow and
an outline together read as a card drawn on top of a card.

**The Hairline Rule.** A rule divides _within_ a pane — a header and the body
that scrolls under it, a filter strip and its list, one row of a dense list and
the next. It is not used between panes, where the gutter does the work, and it is
never a full outline around a large surface.

**The Hairline Is Already Thin Rule.** Use `border-border` at full strength.
`border-border/60` is a holdover from a theme whose border token was an alpha
value. The current light token is an opaque `#e2e2e8`; at `/60` it composites to
roughly `#eeeef1` on a white pane — not a rule, a rumor. 30 usages of the `/60`
form remain and should drop the modifier.

**The Shadow-Is-Theme-Only Rule.** Component code carries no ad hoc `shadow-*`
utilities beyond the bridge names. Shadows live in `--shadow-low/med/high` and
are applied by Astryx's `Card`, `Popover`, and `Dialog`, or by `AppPane`, which
maps `shadow-sm` to `--shadow-low` — one lift, applied in one file, shared by
every pane. Two small exceptions exist and both are decorative detail at small
scale: `shadow-xs` on a reaction pill, `drop-shadow-md` on an image-viewer
control. An ad hoc `shadow-md` on hover is still wrong — and under stone it is
also nearly a no-op, since `med` differs from `low` by 4px of blur.

## Shapes

The radius scale **dropped at every step**: 4 → 2, 6 → 4, 10 → 8, 13 → 12, 18 →
24 at the top. Four steps got tighter and the largest got looser, which pulls
the small details sharper and the large plates rounder at the same time.

- **`--radius-none`** `0.125rem` / 2px — not zero. Even the "square" step is curved, barely.
- **`--radius-inner`** `0.25rem` / 4px — the tightest real corner.
- **`--radius-element`** `0.5rem` / 8px — fields, badges, small chips.
- **`--radius-container`** `0.75rem` / 12px — panes, list rows, message bubbles, cards, wells.
- **`--radius-page`** `1.5rem` / 24px — avatar and platform plates, media frames, large wells.
- **`--radius-full`** `9999px` — **every button**, plus date separators, reaction pills, recording indicators.

**Buttons are pills.** `components.button.base` sets `borderRadius:
var(--radius-full)`, so the stadium shape is a theme-level decision applied to
every button in the product at once. It is the single most visible thing stone
does. Do not override it per-button.

**Borders.** One width exists for rules: `--border-width: 1px`. The secondary
Button is the exception, at 1.5px — a component override, not a new scale.

**Clipping.** `overflow-hidden` on every pane frame is mandatory, so headers and
scroll regions terminate at the pane edge instead of bleeding past it.

### Named Rules

**The Radius-Name Trap.** Tailwind's radius names are rebound to the theme scale
and the mapping is not one-to-one with Tailwind's defaults: **`rounded-sm` = 4px,
`rounded-md` = 8px, `rounded-lg` = 12px, and `rounded-xl` = 24px**. A spec that
says "12px corner" is `rounded-lg` here. The jump from `lg` to `xl` is 2× —
wider than it was — so the two are no longer easy to confuse by eye, but check
the token anyway.

**The Plate Went Round.** `--radius-page` is 24px, which is **exactly half of
48px** and **more than half of 36px**. So a `size-12` plate is exactly circular
and a `size-9` plate clamps to a circle: every avatar and platform plate in the
product is round, including the one repeated down the whole conversation list.

The decision is now binary rather than partial. Either accept circular plates
and drop the squircle language from this document entirely, or move the plates
to `rounded-lg` (12px) and reserve `rounded-xl` for wide blocks — the
channel-connect help panels, media frames — where 24px is a visible softening
rather than a clamp. Do not reach for an arbitrary value.

## Component Rules

### The State Matrix

**Every interactive component must define all seven states before it ships:**
default, hover, focus-visible, active, disabled, loading, and error. A component
that has no meaningful version of one must say so and why — "not loadable,
resolves synchronously" is a complete answer; silence is not.

The shell's shared vocabulary for the first four, so that a new component does
not invent a fifth:

| state         | expression                                                                     |
| ------------- | ------------------------------------------------------------------------------ |
| default       | the component's own fill                                                       |
| hover         | `bg-primary/4`, or `--color-overlay-hover` on a ghost surface                  |
| focus-visible | `ring-2 ring-accent ring-inset` — inset so it survives on top of any fill      |
| active        | `--color-overlay-pressed`                                                      |
| selected      | `bg-primary/10` with `text-primary`, via `data-selected="true"`                |
| disabled      | `text-disabled`, plus the form-level `disabled` flag rather than per-field CSS |
| loading       | `isLoading`, which keeps the label visible alongside the spinner               |
| error         | a `status` object (`{ type: 'error', message }`), never a bare red border      |

Three rules bind that table:

- **Hover must never override selection.** Scope hover to `data-[selected=false]`.
- **Focus-visible is never removed, never `outline: none` without a replacement, and never expressed by color alone.** It must be visible against the component's default, hover, _and_ selected fills, which is why it is inset. The ring is the accent's flat tone — `#534c7e` in light, `#b4a3ca` in dark — 7.8:1 and 7.4:1 against the pane, which clears every fill in the system.
- **Disabled is a state of the form, not of the control.** A submitting form locks uniformly; a control that greys itself out while its siblings stay live is a bug.

**Every interactive component must also define keyboard, pointer, and touch
behavior**, and long-content, overflow, and empty-state handling. Those are not
optional sections of a component's description — a component whose overflow
behavior is undefined has a bug that jsdom cannot see.

### Buttons

Resolved and unfussy. State is a tonal shift, never a scale or bounce.

- **Shape:** **a pill** — `--radius-full`, set on `components.button.base`. Every button, every variant, both modes.
- **Height:** **a fixed 32px, set by Astryx**, not derived from its padding. The label is flex-centered inside a declared `height: 32px`, which is why the body type moving 16px → 14px did not change the control height. It also means the button is **below the 44px touch-target criterion** in the Accessibility section, at every breakpoint.
- **Primary:** the brand ramp — `--gradient-accent` at `135deg`, with a `#ffffff` label in both modes. Worst case is the ramp's lightest stop, `#8365a6`, at 4.8:1 against white; the label sits over the `#534c7e` end at 7.8:1. Stone overrides `button` / `variant:primary` for this, and the override has to restack Astryx's hover and pressed tints — they are painted into `background-image`, which the ramp otherwise replaces. The label is `--color-on-dark`, not `--color-on-accent`: the ramp does not invert.
- **Secondary:** **an outline, not a fill.** `transparent` with a 1.5px `--color-border-emphasized` border, hovering to `--color-neutral`. This is a change of kind from the previous theme's gray fill. In dark mode that border computes 2.66:1 against the pane — see Known drift 7 — which makes the secondary button the weakest-defined control in the product.
- **Ghost:** transparent, hover `--color-overlay-hover` (black at 5% / white at 5%). The default for icon buttons and inline actions. Ghost and secondary are now closer to each other than they used to be: one is an invisible box, the other an outlined one.
- **Destructive:** **a pastel well, not a fill.** `--color-background-red` (`#f9dcd7` / `#644d49`) with `--color-text-red`, computed 7.25:1 light and 6.02:1 dark. A destructive action is the quietest colored object on screen. If a delete confirmation needs more weight, the weight belongs in the copy and the dialog, not in a re-fill.
- **Loading:** `isLoading` keeps the label visible alongside the spinner.

### Navigation

The rail is the product's spine and the only persistent chrome.

- **Structure:** `SideNav` with `header`, `collapsible`, and `footer` slots. Collapse state persists to `app:sidebar-collapsed`.
- **Heading:** the wordmark alone, linking to `/`. It is the rail's only identity chrome — the workspace does not share the row, because a name you switch and a name you cannot are not the same kind of thing.
- **Workspace switcher:** the first row of the nav body rather than part of the heading. Built like the account row in the footer — a ghost `Button` inside a `DropdownMenu`, `px-2` with the label span grown so a trailing `chevrons-up-down` pins to the edge — carrying a `WorkspaceMark` (24px plate, `rounded-md`, `bg-accent-gradient text-on-dark` when active and `bg-accent-bg/10 text-accent` when not) and the workspace name at `font-medium`. The active mark is the brand ramp — the one app-side surface big enough to carry it — so it reads as identity as well as emphasis. Collapsed it becomes an icon-only trigger with a tooltip.
- **Items:** `SideNavItem` with a 16px Lucide icon. Selection is a quiet accent-tone fill; the same grammar as a conversation row.
- **Workspace group:** the selected workspace's destinations sit in a nested `SideNavSection` indented `ml-5` behind a `border-l border-border`, which lands the rule on the workspace mark's own centre axis. The indent is what says the rows belong to that workspace, so the group never repeats the name two rows below the row already showing it — the name goes to the section's hidden group label instead, where a screen reader still gets it. Dropped when collapsed. The bracket runs at full `border-border`.
- **Sections:** three regions, two rules. Identity; then the workspace and whatever it contains; then Home and notifications, which span every workspace rather than describing where you are. The rules are `Divider`s inset to `-mx-2 my-1` so they run edge-to-edge across the rail, and they disappear when collapsed, matching the footer.
- **Disabled items:** a locked route (Inbox with no active channel) is `isDisabled` and wrapped in a `Tooltip` that explains why. It only locks once readiness is known false — an unsettled or failed check leaves the item alone rather than flickering on every workspace switch.
- **Footer:** the account row — avatar, display name, trailing `chevrons-up-down`, opening Profile / Settings / Sign out. Styled to read as the last nav row rather than a button: `px-2 font-normal` with the label span grown so the chevron pins to the trailing edge. `src/styles.css` suppresses the rule Astryx draws above the footer zone.

### Conversation List Items

The most-read surface in the product.

- **Layout:** a 36px platform plate (`rounded-xl`, now a full circle) plus a text body, `gap-3`, `px-3 py-2.5`. Direct children of a scrollable `role="listbox"` with `gap-0.5` — no card wrapping.
- **Typography:** contact name at 600 (unread) or 500 (read); preview at `text-primary/80` (unread) or `text-secondary` (read); timestamp at `text-secondary`. Name and preview are `text-base` (14px); the timestamp is `text-sm` (11px, below the floor — Known drift 2). The read-state preview and the timestamp both land on `text-secondary`, which is 3.76:1 in light — the drift in Known drift 4 lands hardest right here, on the surface that is read most.
- **Unread:** name goes semibold, preview brightens, and a `NumericUnreadChip` appears in the trailing position. The chip hides on the selected row — opening a conversation resets its count visually.
- **The state line:** the row's third line is where the work stands and who owns it — `ConversationStatusChip` on the leading edge, a 24px assignee face on the trailing one, `justify-between` at `min-h-6`. 24px because that is exactly the badge's own height, so the line has one rhythm rather than two. Nothing renders there when nobody is assigned: an unassigned conversation is the common case in a shared inbox, and a column of empty placeholders down the most-read surface would spend real estate saying "no". An `assigned_to` the workspace roster cannot resolve — a colleague who has left — gets a muted `UserRound` plate instead, because that state must not read as unassigned.
- **The right rail:** timestamp, unread count and assignee face land on one vertical axis at the row's trailing edge, one per line. Three answers to "does this need me", stacked.
- **Assignee identity:** the face carries a `HoverCard` with the member's name, job title, workspace role and phone (`WorkspaceMemberAvatar`). It is pointer-only by construction — the trigger is a plain element inside the row's button, so no second tab stop is introduced — which is why the row's `aria-label` names the assignee too. A hover card is never the only copy of a fact.
- **Selected:** `bg-primary/10` with `text-primary`, via `data-selected="true"`.
- **Hover:** `bg-primary/4`, scoped to `data-[selected=false]` so hover can never override selection.
- **Focus:** `ring-2 ring-accent ring-inset` — inset so it stays legible on top of either state.

### Chips and Badges

`Badge` now carries **one color language**. The previous theme's split between
saturated semantic fills and pastel categorical plates is gone: stone's `badge`
overrides point every semantic variant at a categorical hue token, so the two
families produce the same kind of object.

- **Semantic variants** (`info`, `success`, `warning`, `error`) map to blue, green, yellow, and red — `--color-background-{hue}` with `--color-text-{hue}`. Muted plates, ~7.2:1 light and ~6.0:1 dark.
- **Categorical variants** (`blue`, `green`, `red`, `orange`, `yellow`, `teal`, `cyan`, `purple`, `pink`, `gray`) are the same construction, reached directly.
- **`neutral`** is the gray categorical: `--color-background-gray` with `--color-text-gray`.
- **Unread counts** (`NumericUnreadChip`): `variant="info"` — a muted blue plate — or `"neutral"`. Caps at `99+` when `capAt99` is set. Wrapped in `role="status"` with a count-aware label. It no longer reads as a signal, which is the main practical consequence of losing the saturated fills: an unread count and a category tag now look alike, and only position distinguishes them.
- **Conversation status** (`ConversationStatusChip`): variant mapped from the status's semantic color — accent→info, warning→warning, success→success, danger→error, default→neutral. Every one of those now resolves to a pastel plate.
- **Badge text** reads `--text-supporting-size` (12px), not `text-sm`, so a badge is currently the _largest_ small text in the product.
- **Channel status** and **inline metadata chips**: `text-sm` in a `border border-border rounded-lg px-2 py-1` outline — the one place a full border is correct, because these are small and self-contained rather than large surfaces.
- **Date separators:** `bg-muted text-secondary rounded-full px-2.5 py-0.5 text-sm font-medium`, centered between day groups. `bg-muted` is now a real step down from the pane in light, so the pill reads better than it did. Restyle with color only; the transcript measures row heights for scroll anchoring, so a border or size change perturbs the pin.

### Inputs and Fields

- **Shape:** 8px (`--radius-element`).
- **State:** Astryx `TextInput` takes a `status` object (`{ type: 'error', message }`) driven from React Hook Form's `fieldState`. Validation copy renders below the field at label size. Stone softens the status borders and icons across all nine input components — `text-input`, `textarea`, `number-input`, `date-input`, `time-input`, `selector`, `multi-selector`, `typeahead`, `tokenizer` — by redefining `--color-{success,warning,error}` to T60 (light) / T70 (dark) inside each input's status scope. Those compute ~3.17:1 against the white pane: they clear the 3:1 non-text requirement, with about 0.17 to spare. Do not soften them further.
- **Composer field:** transparent and borderless (`bg-transparent shadow-none`, `resize-none leading-6`). The composer surface _is_ the field; a filled input inside it would be a box inside a box. The floor is the height of an empty composer, so it tracks the layout: `min-h-9` on desktop, where the field owns its own row, and `min-h-8` below 768px, where it shares a row with 32px controls. Either way `resize()` grows it from there to the five-line cap and then scrolls.
- **Composer layout:** two shapes, chosen at the 768px `useIsMobile` breakpoint. Desktop uses Astryx `ChatComposer` and its three-slot column — header actions, field, send footer. Phones get a single row (attach, emoji, field, send/mic) at 48px empty, because that column stacks to ~136px before a word is typed and the transcript is what the screen is for. `ChatComposer` cannot collapse into one row: its footer always renders with a 32px floor, and its footer-actions group is content-sized, so a field placed there cannot grow. The mobile row therefore rebuilds the same surface grammar from tokens — `bg-popover`, `rounded-xl` (24px, the chat radius), `shadow-sm` lifting to `shadow-md` on hover and focus-within, `cursor-text` — rather than from Astryx's hashed StyleX classes. Keep the two in sync by token, not by copied class. Note that under stone `bg-popover` is pure white in light mode, so on a white pane the mobile composer is defined by its shadow alone.
- **Switch and ProgressBar tracks:** both redirected to `--color-skeleton` by component overrides, because `--color-background-muted` sits too close to the body tone to read as a channel. If a new control needs an off-state track, use `--color-skeleton` and not `bg-muted`.
- **Disabled:** driven by the form's `disabled` flag rather than per-field styling, so a submitting form locks uniformly.

### Message Bubbles

Built on Astryx's `Chat` family — `ChatLayout` owns the scroll container and
follow-on-append; `ChatMessage` wraps a same-sender run; `ChatMessageBubble`
draws each bubble.

- **Fill:** `--color-neutral` — the primary text tone at 6% in light, 10% in dark, achromatic and deliberately not the accent — for **both directions**. Inbound and outbound share one tint. On a light pane that composites to `#f2f2f2`: 1.12:1 against the pane, with `text-primary` on it at 13.63:1. Direction reads from alignment and from the delivery-tick row, not from color. Anything that wants to distinguish them by fill has to introduce a second tint, and that is a system change, not a component tweak.
- **Grouping:** consecutive same-direction messages render as one run with grouped corner radii (`group="first" | "middle" | "last"`). A run shows one timestamp footer; a message carrying state of its own (edited, failed, reactions) always shows its own.
- **Ghost variant:** media-only messages drop the bubble boundary and keep the padding, so the frame is the object.
- **Failed:** the bubble states it — `bg-error/12 ring-1 ring-error/70` — and the caption explains it. Under stone that ring is a muted clay rather than a red, so the failure reads quieter than it used to; the copy is now carrying most of the signal. The failure never gets a line of its own: `time · ⚠ Not sent · Retry` stays on the single footer row, because a second line sits closer to the next message than to the bubble it describes. The retry is caption-scale and underlined, with padding for a real hit target.
- **Quoted reply:** a 2px `border-current/30` rule with the author at `font-semibold` over the quoted text at 60%, both truncated to one line. Never a plate — the bubble is already the plate, and a fill inside it is a box in a box. The loaded parent outranks the channel's quote payload for author and text, so "Quoted message" only appears when neither is resolvable; without a loaded parent the strip is inert rather than a control that silently does nothing. The composer's reply drawer uses the same rule.
- **Action rail:** a reply control parked in the transcript gutter, absolutely positioned outside the bubble, revealed on `group-hover/msg` and `group-focus-within/msg`. Anchored to the first text line (`top-2`) for text and to the middle for media or structured blocks. Zero hit target until engaged; on touch it sits permanently at 60% opacity with an expanded 44px target.
- **Pane wash:** the transcript pane carries one static `radial-gradient` — a wide, shallow ellipse (`120% 85% at 100% 0%`) of `--color-accent` at **5.5%**, out to a `transparent` stop at 62%. It is the sole exception to the no-decorative-background rule below. It reads `--color-accent`, so it inverts by mode for free with no `dark:` variant — and since the accent became a brand hue it is now a faint violet cast rather than a neutral one. **The measurements in this bullet and the two below it predate that change and have not been re-taken in a browser.** Composited, the peak is now `#f5f5f8` on the white pane (it was `#f3f3f3`) and `#232228` in dark (it was `#27272a`) — still inside the tonal range the shell already owns, and still a soft vignette across an 844px pane rather than a visible edge, but the exact ratios below are stale. It lives as an inline style on the pane wrapper in `message-thread.tsx`, painted on the wrapper itself rather than a sibling, so it needs no `isolate` and no negative z-index, and it does not scroll with the transcript.
  - **It does not disturb the bubble edge**, which is the obvious worry and is measurably not real. `--color-neutral` is an _alpha_ fill, so a bubble composites over the wash rather than over the bare pane, and the wash darkens figure and ground together. Measured: the bubble edge is **1.114:1** over the wash's peak versus **1.119:1** over a bare pane (dark: 1.334:1 vs 1.324:1). A future opaque bubble fill would break this property and would have to re-measure.
  - **What it does cost is `text-secondary`**, and only in light mode: `#83838a` falls from 3.76:1 on the bare pane to **3.48:1** at the worst real text position (an outbound footer at the top of the view) and 3.39:1 at the peak pixel. Every other sampled footer position is unchanged at 3.76:1. This does not create a failure — Known drift 4 already records that token as failing AA at 3.76:1 — but it deepens one, and it removes an option from that drift's fix: **T50 `#77777c` no longer suffices.** Measured, T50 is 4.45:1 on the bare pane and 4.01:1 on the wash peak, so it clears neither. **T45 `#6a6a6f` clears both** at 5.38:1 and 4.85:1, and is now the only listed candidate that does.
  - It replaces a WebGL ray canvas (`ogl`, ported from React Bits' `SideRays`) that shipped here after the stone swap. That canvas was drift on two counts this document already legislates: it painted `#63fe13` / `#2e7a00`, a hue belonging to no ramp in this theme and to no brand, and it cited `neutralTheme.ts` — deleted — for the choice. A static gradient also drops a runtime dependency, a GL context per open thread, an `IntersectionObserver`, a resize listener, an `rAF` loop, and a `prefers-reduced-motion` branch. Nothing that does not move needs a reduced-motion guard.

### Cards

Cards are for auth and onboarding sheets and for overlaid forms — not for
structuring shell content.

- **Shape:** 12px (`--radius-container`), 12px internal padding via the theme's `card` base (`var(--spacing-3)`). `Section` takes the same padding.
- **Background:** `bg-card` (`#ffffff` / `#242325`) with `--shadow-low`. In light that is **the same white as the pane and the canvas-adjacent surfaces**, so the shadow is the entire card. In dark it is one tonal step above the pane and the shadow contributes nothing. Each mode has exactly one mechanism and no backup.
- **Categorical variants:** `variant="blue"`, `"green"`, and the rest rebind `--color-text-primary` and `--color-text-secondary` locally so nested `Text` children stay readable on the plate.
- **Prohibition:** no nested cards, and no card inside a shell pane. The pane is the container; content that seems to need a box needs spacing, a rule, or a recessed background.

### Ruled Row Groups

The product's answer to "a list of records that is not a conversation" —
channels, members, settings rows. Edge-to-edge rows separated by rules, with the
group closed top and bottom:

```
divide-y divide-border border-y border-border
```

Rows are `py-4` with `gap-4`. Empty and error states for the group sit inside the
same `border-y` frame so the group keeps its shape while it has nothing in it.
`SettingRow` is the same idea per-row (`border-t border-border
first:border-t-0`): label and description left, the control that changes it
right.

### Empty and Error States

- **In-pane:** Astryx `EmptyState` centered in the pane (`flex h-full items-center justify-center`), with a `title`, optional `description`, a muted Lucide icon at `size-8`, and an action button.
- **Hand-composed variant:** a 56px `rounded-2xl bg-primary/5 text-primary/40` icon plate, a semibold heading, and a `text-primary/60` description at `max-w-xs`. Note `/60` computes 4.16:1 in light — it clears AA for the description but only just, and `/40` on the icon is decorative only.
- **Inline query errors:** `bg-error/10 rounded-lg px-3 py-2` with `text-error` copy and a ghost retry button on the trailing edge. The alpha form is deliberate here and should stay: it composites over whatever surface it lands on, which the `-muted` token no longer does correctly in dark mode. Never a toast for a state the user can retry in place.
- **Blocking errors:** `Banner status="error"` with a title, a description that distinguishes the recoverable case (session expired → sign in) from the generic one, and an action in `endContent`.
- **Banner fill:** the categorical plate at 8px (`--radius-element`), no border — a status surface at full measure is a tinted field, not a plate and not an outlined box. The theme's `banner` overrides rebind `--color-text-primary`, `--color-text-secondary`, and the status token itself to the hue's `*-vivid` value, so the icon, the title, the description, and the `endContent` chip all arrive in one tone. All four statuses move together; success is not a special case.
- **Retry semantics:** a failed readiness check renders an error with a retry — it never redirects. A failed check is not the same as a workspace with no channels, and redirecting on failure is what turns a flaky network into a loop between two routes.

### Auth and Onboarding

Outside the shell entirely. `bg-surface md:bg-body` on a `min-h-dvh` centering
wrapper, holding a single `Card` at `maxWidth={448}`. On a phone the wrapper
takes the card's own tone, so the form occupies the page; from `md` up it drops
to the canvas and the card floats on it. That switch depends on surface and body
resolving to different values — the same arithmetic the shell's panes depend on,
in a place with no panes. Under stone the floating card is white on `#f3f3f5`,
a 1.11:1 step, so it is mostly the shadow that makes it a sheet.

There is **no decorative background**. No dot grid, no radial gradient, no
texture — beyond its imports, `src/styles.css` holds a cascade-layer declaration,
one footer-rule suppression, two height rules, and one keyframe animation with
its reduced-motion guard. Its imports are the Tailwind entry points, the Astryx
reset and core, the Tailwind token bridge, the generated font floor, and
`./fonts/fonts.css`. That is the entire hand-written stylesheet. Do not add a
background to it.

### Motion

The theme declares `{fast: 125, medium: 300, slow: 700, ratio: 0.75}`, which
`expandMotionScale` compiles to `--duration-*` tokens with min/max companions
(`base × ratio` and `base ÷ ratio`, rounded to 5ms): fast 95 / 125 / 165, medium
225 / 300 / 400, slow 700. The fast tier is meaningfully snappier than the
theme it replaced (160ms) and the slow tier meaningfully shorter (900ms).
Product code mostly uses Tailwind's bare `transition` on hover and selection, and
every custom animation guards `motion-reduce:transition-none` /
`motion-reduce:animate-none`.

The one authored animation is `unread-count-emphasis` in `src/styles.css`: 280ms
on `cubic-bezier(0.16, 1, 0.3, 1)`, scaling 0.92 → 1 and fading 0.55 → 1 from
`transform-origin: left center`, so a count that changes draws the eye without
moving its neighbors. It is disabled under `prefers-reduced-motion`. Its 280ms is
a hardcoded value that no longer matches any token — the nearest is
`--duration-medium-min` at 225ms.

## Accessibility

**Target: WCAG 2.2 AA.** Keyboard-first interaction is required, focus-visible
is required, and the contrast constraints below are required.

Nothing in this section is enforced by a command. `package.json` has no
contrast, font-size, or overflow check, and jsdom has no layout, so the unit
suite cannot see any of it. Each criterion below is therefore written to be
checkable by one person in a browser in under a minute — that is the standard
these have to meet to be worth writing down.

**Three criteria currently fail against the shipped theme** (2, 3, and 11
below). They are stated as targets, and the gaps are in Known drift 2–4 and 7.

### Acceptance criteria

Each is pass/fail. "Fail" means the change does not ship.

**Contrast**

1. Body and metadata text must reach 4.5:1 against every surface it lands on — pane, canvas, card, muted well, and any categorical plate. Check both modes.
2. `text-secondary` must reach 4.5:1 in both modes. **It currently does not in light** (3.76:1 on the pane, 3.40:1 on the canvas), so until the token moves, receding copy should use `text-primary/70` (5.72:1) instead.
3. An opacity step on `text-primary` must be `/70` or higher. `/60` computes to 4.16:1 and `/55` to 3.58:1 in light. Verify in light mode specifically — the two modes disagree, and dark is the forgiving one.
4. Icons, borders, and other non-text objects that carry meaning must reach 3:1 against their background. A decorative icon beside a text label that already says the same thing is exempt.
5. A categorical or semantic plate must carry its paired `*-vivid` token, never `text-primary`. Every pairing in the theme is ~7.2:1 light / ~6.0:1 dark by construction; a hand-assembled one is not.
6. Nothing may rely on color alone to convey state. Stone's plates are low-chroma and close in tone, so this is stricter than it was: a status must be accompanied by text, an `aria-label`, or both.

**Keyboard**

7. Every interactive element is reachable by Tab in the order it appears visually, and every one shows a visible focus ring when reached.
8. The focus ring is visible against that element's default, hover, and selected fills. `ring-2 ring-accent ring-inset` satisfies this; an outset ring on a selected row does not.
9. No element introduces a second tab stop for the same action. The conversation row's assignee hover-card is pointer-only by construction for exactly this reason, which is why the row's `aria-label` names the assignee too.
10. Any fact available only on hover must also be available in text or in an accessible name. A hover card is never the only copy of a fact.
11. Dialogs, popovers, and the mobile contact sheet trap focus while open, return focus to their trigger on close, and close on Escape.

**Text and layout**

12. Nothing renders below 12px. **The theme does not currently hold this** — `text-sm` is 11px and `text-xs` is 9px, and only `--text-supporting-size` and `src/generated/astryx-font-floor.css` hold the floor where they reach. Fix at the theme, not per component.
13. At 200% zoom and at 320px width, no content is clipped and nothing scrolls horizontally.
14. Every string is checked in Russian at phone width. Russian runs 15–30% longer than English.
15. Touch targets are at least 44px in their smallest dimension. Buttons are 32px and do not meet this; the message action rail expands to 44px on touch specifically to meet it.

**Motion**

16. Every transition and animation carries a `motion-reduce:` guard. `unread-count-emphasis` in `src/styles.css` is the model.
17. No animation flashes more than three times per second.

### Named Rules

**The Contrast Is Computed, Not Measured Rule.** Every ratio in this document
was computed from the token values in `stoneTheme.ts`, not read off a rendered
page. Computed figures can still be wrong for the screen when an alpha
composites over an unexpected background, when a categorical plate sits behind a
component that assumed the pane, or when a token resolves through a variant
override. Treat the figures as the reason to check, not the result of having
checked.

**The Two Modes Disagree Rule.** A value tuned in one mode is not verified in
the other, and under stone the modes are further apart than they have ever been:
light carries elevation by shadow and dark by tone, `bg-muted` recesses in one
and raises in the other, and the failing contrast values are in light while the
failing surface steps are in dark. Check both, every time, or state which one you
checked.

## Content and Tone

**Concise, confident, implementation-focused.** Say what happened and what the
user can do about it. Do not apologize, do not narrate the system's internals,
and do not soften a failure into ambiguity.

- **Sentence case everywhere.** Labels, buttons, headings, menu items, and chips. No all-caps, no title case.
- **Labels name actions, not abstractions.** "Отправить" / "Send", not "Submit". "Назначить" / "Assign", not "Update assignment".
- **Errors state the cause and the next step.** "Сессия истекла. Войдите снова." beats "Произошла ошибка." A recoverable error carries its own retry; a blocking one carries an action in `endContent`.
- **Empty states name what would be there and how to get it.** A heading, one line of description, one action. Never "Нет данных".
- **Counts are plural variants, never a formatted number plus a fixed noun.** Russian takes three forms; `{count} каналов` is wrong for 1, 2, and 21. Use the message-format variant syntax and never branch on the count in TypeScript, because no ternary yields three forms. `src/lib/message-plurals.test.ts` pins the expected form per bucket.
- **All user-facing text goes through Paraglide.** Both catalogues, `messages/en.json` and `messages/ru.json`, every time. Validation messages and API-layer fallbacks are user-facing text.
- **Zod schemas that carry messages must be factories.** Zod reads its messages at construction, so a module-level constant freezes whichever locale was active on first import. Export `createXSchema()` and call it through `useLocalizedSchema`.
- **Astryx's own strings are English-only** and a few (`isRequired` / `isOptional` on `Field`) are hardcoded past its translator. Prefer the app's catalogue — see `src/lib/field-label.ts`.
- **Any string inside a fixed-width control gets a budget** in `src/lib/message-lengths.test.ts`. That test reads character counts, not layout, so it catches a translation that doubled and not one that overflowed by 3px. The browser check is still required — and with no Cyrillic-covering font loaded, what a browser currently shows for Russian is the system fallback, not the intended face.

## Rules: Do and Don't

Every rule below is a **must**. Recommendations live in the prose above and use
**should**. If a rule here reads as advice, it is written wrong — report it
rather than working around it.

### Do:

- **Do** treat `src/themes/stone/stoneTheme.ts` as the source of truth for every token. It is applied at runtime by `<Theme theme={stoneTheme}>` in `src/main.tsx`; there is no build step and no compiled `theme.css` to regenerate.
- **Do** pick new color values as a named stop on a `stonePalettes` ramp. That is what keeps every plate in the system at the same contrast ratio.
- **Do** add a self-hosted `@font-face` in `src/fonts/fonts.css` for any family the theme names, with the `unicode-range` split intact, and confirm the family ships Cyrillic. Naming a family in the theme does not load it — this has now gone wrong four times.
- **Do** separate sibling regions with the canvas gutter — compose `AppPane`s and let `AppPaneGroup` own the space between them. Rule _within_ a pane with `border-border`.
- **Do** give a light-mode surface a shadow token when it should read as raised. Pane, card, and popover are all `#ffffff`; the shadow is the only thing that makes it a sheet.
- **Do** give a dark-mode overlay a tonal step or a `border-border`. Shadows contribute nothing in dark and there is no inset rim.
- **Do** use the Tailwind bridge names (`text-primary`, `text-secondary`, `bg-muted`, `bg-card`, `bg-surface`, `bg-accent-bg`, `text-on-accent`, `border-border`, `text-error`, `bg-blue-subtle`, `text-blue-vivid`) rather than raw `var(--color-*)` in class strings.
- **Do** express state as the primary text tone at low alpha: `bg-primary/4` hover, `bg-primary/10` selected, `bg-primary/5` quiet plate. State is achromatic; it did not follow the accent to violet.
- **Do** put `text-on-accent` on any _flat_ accent fill, so labels invert with their background.
- **Do** put `text-on-dark` on a `bg-accent-gradient` fill instead. The ramp is dark in both modes, so a label that inverts would disappear in dark.
- **Do** reach for a `Badge` / `Banner` / `Card` variant to get a hue, so the plate and its text arrive as a matched pair.
- **Do** fill a full-measure status surface with the hue's `-muted` well and spend the hue on the icon, the copy, and the action. A chip plate stretched to a region is a slab.
- **Do** put body copy on `text-base` and metadata on `text-sm`, and escalate through weight and opacity.
- **Do** use `text-primary/70` where copy needs to recede in light mode, until `text-secondary` clears 4.5:1.
- **Do** define all seven states — default, hover, focus-visible, active, disabled, loading, error — for every interactive component, and say explicitly when one does not apply.
- **Do** state keyboard, pointer, and touch behavior for every interactive component, along with its long-content, overflow, and empty-state handling.
- **Do** give every pane `overflow-hidden`, its own `overflow-y-auto` scroll region, and `min-h-0` through its flex chain.
- **Do** share `TRANSCRIPT_MEASURE` between the transcript, its skeleton, and the composer.
- **Do** guard every transition and animation with `motion-reduce:`.

### Don't:

- **Don't** assume Tailwind's default scales. `text-sm` is 11px, `text-base` is 14px, `rounded-sm` is 4px, `rounded-md` is 8px, `rounded-lg` is 12px, and `rounded-xl` is 24px in this project. Not one type step matches Tailwind's.
- **Don't** reintroduce `text-xs`, `text-2xs`, or anything below `text-sm`. They resolve to 9px and 7px; the theme clamps nothing.
- **Don't** name a font family in the theme without an `@font-face` for it in `src/fonts/fonts.css`, and don't name a Latin-only family as the body face without a Cyrillic-covering face directly behind it.
- **Don't** put a generic fallback ahead of the Cyrillic-covering face in a font stack. Russian returns to the system UI stack silently, and nothing fails.
- **Don't** ship an interactive component without a visible focus-visible state, and don't express focus with color alone.
- **Don't** write `border-border/60`. The border token is opaque in light mode and the modifier thins it past visibility. Use `border-border`.
- **Don't** rely on `bg-muted` to recess in dark mode. It is `#3b3b3f` against a `#1b1b1f` pane — the largest _upward_ surface step in the theme.
- **Don't** suppress a Card's or Popover's shadow in light mode. There is no tone under it: pane, card, and popover are all `#ffffff`.
- **Don't** rely on a shadow in dark mode. All three shadow tokens are near-black with no mode switch, and the inset rim the previous theme carried is gone.
- **Don't** hand-roll a pane. Use `AppPane`, so the fill, the radius, the lift, the scroll containment, and the phone-width full-bleed arrive together and stay in one file.
- **Don't** give a pane a border, and don't put a hairline between two panes. The gutter is the separation there.
- **Don't** let a theme collapse `background-surface` into `background-body`. Every pane in the app goes invisible at once, and there is no automated check that would tell you.
- **Don't** add ad hoc `shadow-*` in component code beyond the bridge names.
- **Don't** tint a structural surface. The spine is one near-neutral ramp, and the whole color system depends on hue meaning something.
- **Don't** give `--color-accent` and `--color-text-accent` different values. The bridge's alias is overwritten by the theme, so they collapse to one token and `ring-accent` silently ships at the fill value.
- **Don't** override a button's `border-radius`. The pill is a theme-level decision on `components.button.base`.
- **Don't** reintroduce a saturated fill for one component to make it stand out. Stone has one color language; a single loud object would be the only one in the product.
- **Don't** put `text-primary` on a categorical plate. Use the hue's `*-vivid` token, or the component variant that binds it.
- **Don't** pair a `-muted` well with its own status tone in dark mode. `--color-success` and `--color-success-muted` are the same value there, and the text vanishes.
- **Don't** hardcode a hex. The only exceptions are the three platform brand colors in `src/entities/channel/lib/platform.ts`.
- **Don't** use uppercase or all-caps labels. Labels are sentence case throughout.
- **Don't** nest a Card in a Card, or put a Card inside a shell pane.
- **Don't** card-wrap dense list rows. Conversations are transparent rows in a scrollable list; records are ruled rows in a `divide-y border-y` group.
- **Don't** change the box metrics of anything inside the transcript for cosmetic reasons — the list measures row heights for scroll anchoring, so a border or type-size change on a bubble or date separator perturbs the pin. Restyle with color.
- **Don't** add a decorative background. `src/styles.css` carries no pattern or texture; its one gradient is `--gradient-accent`, which is a component fill rather than a decoration, and the auth screens want neither. The transcript pane's wash is the one decorative exception and is specified under Message Bubbles; it earns it by reading a token rather than a literal color, by staying under the bubble fill in both modes, and by being static. A second exception needs the same three arguments.
- **Don't** add a top bar. Identity, navigation, notifications, and the account live in the rail; color mode and language live in Settings under Appearance; every page owns its own title.
- **Don't** redirect on a failed query. Render the error with a retry — a failed check is not a known-empty result.
- **Don't** cite a verification command for anything in this document. None exists; `package.json` is the complete list of what can be run.

## Quality Gates

These govern this document, not the product. A section that fails one of them
is wrong even if everything it says is true.

1. **Every non-negotiable rule must use "must".** Every recommendation should use "should". A rule that uses neither is not a rule.
2. **Every accessibility rule must be testable in implementation.** If a criterion cannot be checked by one person in a browser in under a minute, rewrite it until it can — or state plainly that it cannot be checked and why.
3. **Every component rule must name its tokens**, never a hex, a px, or a ms. A value written literally here will drift from the theme and nothing will notice.
4. **Every claim about the current code must name the file that holds it.** "The theme clamps four steps" is unverifiable; "`stoneTheme.ts` clamps nothing below `--font-size-base`" is one open-file away from checked.
5. **Every stated contrast figure must say whether it was computed or measured.** All of them here are computed.
6. **A rule the code does not follow goes in Known drift**, with the target stated here and the gap stated there. Silently describing the target as the state is how this document stops being trusted.
7. **Prefer system consistency over a local visual exception.** An exception must name what it buys and why a token could not buy it — see The Brand-Hex Exception for the shape of an acceptable one.

## QA Checklist

Before a UI change ships. None of this is automated; all of it is reading and
looking.

**Tokens**

- [ ] No raw hex, px radius, or ms duration in the diff. The only permitted hexes are the three platform brand colors in `src/entities/channel/lib/platform.ts`.
- [ ] Tailwind bridge names used (`bg-surface`, `text-secondary`, `border-border`), not `var(--color-*)` in class strings.
- [ ] No new `border-border/60`.
- [ ] No ad hoc `shadow-*` beyond `shadow-sm` / `-md` / `-lg`.
- [ ] Any new color is a named stop on a `stonePalettes` ramp.
- [ ] The cascade-layer order in `src/styles.css` is unchanged.

**Type**

- [ ] Body copy is `text-base`, metadata is `text-sm`. No `text-xs` or below.
- [ ] Hierarchy escalates by weight and opacity, not by a third size.
- [ ] Labels are sentence case.

**Color and contrast**

- [ ] Text reaches 4.5:1 on every surface it lands on, in both modes.
- [ ] Receding copy uses `text-primary/70` rather than `text-secondary` in light mode.
- [ ] Categorical and semantic plates carry their `*-vivid` text.
- [ ] No structural surface is tinted.
- [ ] Nothing conveys state by color alone — stone's plates are too close in tone for that to be readable.

**States**

- [ ] All seven states defined, or explicitly marked not-applicable.
- [ ] Focus-visible is present and legible over default, hover, and selected.
- [ ] Hover is scoped so it cannot override selection.
- [ ] Loading keeps the label; disabled comes from the form.

**Layout**

- [ ] Panes come from `AppPane`; the seam is the gutter, not a border.
- [ ] Every pane has `overflow-hidden`, its own `overflow-y-auto`, and `min-h-0` through the flex chain.
- [ ] `--color-background-surface` and `--color-background-body` still resolve to different values.
- [ ] Raised surfaces are checked in **both** modes — shadow carries light, tone carries dark, and neither carries both.
- [ ] Checked at 320px, at the `md` and `lg` breakpoints, and at 200% zoom.

**Localization**

- [ ] All new strings in both `messages/en.json` and `messages/ru.json`, with matching keys and placeholders.
- [ ] Counted strings use plural variants, not a TypeScript branch.
- [ ] Any string in a fixed-width control has a budget in `src/lib/message-lengths.test.ts`.
- [ ] **Viewed in Russian, in a real browser, at phone width.** jsdom has no layout; this step has no substitute.

**Motion**

- [ ] Every transition and animation carries a `motion-reduce:` guard.

**Commands**

- [ ] `pnpm typecheck` at minimum; `pnpm verify` for anything non-trivial.
- [ ] No claim of a check that does not exist.

## Guideline Authoring Workflow

When adding a section to this document:

1. Restate the design intent in one sentence.
2. Define the foundations and semantic tokens it rests on, by token name.
3. Define component anatomy, variants, interactions, and state behavior.
4. Add accessibility acceptance criteria with pass/fail checks.
5. Add anti-patterns, migration notes, and edge-case handling.
6. End with what to check by hand, and be explicit that nothing checks it automatically.

Run every new section through the Quality Gates above before committing it.
