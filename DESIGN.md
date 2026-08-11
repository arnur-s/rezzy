---
name: Rezzy
description: Inbox-first AI-powered customer engagement platform for customer-facing teams
colors:
  # The neutral theme is the source of truth: src/themes/neutral/neutralTheme.ts,
  # applied at runtime by `<Theme theme={neutralTheme}>` in src/main.tsx. If this
  # block and that file disagree, the theme wins and this is stale.
  #
  # Values below are the LIGHT slot. Unlike the theme this replaced, most tokens
  # here are genuine light/dark pairs rather than one tone playing two roles;
  # the dark partner is named in the Colors prose where it matters.
  #
  # Accent: Open Design's brand green. The one hue allowed into the structure,
  # split across a fill stop and a text stop — see The Two Greens Rule.
  brand-lime: '#63fe13' # primary Button fill only in light; whole accent in dark
  deep-chartreuse: '#2e7a00' # the light-mode accent — text, ring, border, icon, bg
  pale-wash: '#edffe0' # --color-accent-muted, light
  # Neutral spine: Tailwind's `neutral` ramp, chroma 0. No hue at all.
  panel-white: '#ffffff' # light pane; on-accent label
  raised-white: '#fafafa' # light card and popover — Open Design `surface.raised`
  canvas-gray: '#f1f1f1' # light canvas — and light `muted`, which is the same value
  rule-gray: '#ebebeb' # light hairline; also the dark-mode accent
  chip-gray: '#e5e5e5' # light neutral chip, gray categorical plate
  border-strong: '#d9d9d9' # emphasized border; switch and progress tracks
  soft-gray: '#a3a3a3' # dark secondary text; light disabled
  mid-gray: '#595959' # light secondary text
  dim-gray: '#525252' # dark disabled
  panel-graphite: '#262626' # light accent AND light primary text; dark pane surface
  canvas-black: '#1b1b1b' # dark card, popover, and muted
  true-black: '#000000' # dark canvas — Open Design `surface.base`
  text-black: '#171717' # dark on-accent label
  text-white: '#fafafa' # dark primary text
  # Status tones — drawn as text and icon, never as a fill
  deep-green: '#007004' # --color-success, light
  deep-red: '#a50c25' # --color-error, light
  deep-amber: '#745b00' # --color-warning, light
  pastel-green: '#9fe59b' # --color-success, dark
  pastel-red: '#ffc6c1' # --color-error, dark
  pastel-amber: '#fdcf4f' # --color-warning, dark
  # Pastel plates — each does double duty as a status well and a categorical plate
  green-plate: '#c5e5c0' # success well AND green chip
  red-plate: '#facecb' # error well AND red chip
  amber-plate: '#f8da9d' # warning well AND yellow chip
  blue-plate: '#c4ddfb' # info banner AND blue chip
  green-vivid: '#0c5700'
  red-vivid: '#89001a'
  amber-vivid: '#584400'
  blue-vivid: '#00458c'
  # Signal fills — saturated, opaque, mode-locked. Badges, status dots, progress.
  signal-blue: '#0074e2'
  signal-green: '#198100'
  signal-amber: '#ffce2f'
  signal-red: '#e33f4a'
typography:
  # `Albert Sans` is the named primary; `Golos Text` immediately behind it is
  # the Cyrillic half of the stack, not a generic fallback. See The Cyrillic
  # Coverage Rule.
  display:
    fontFamily: "'Albert Sans', 'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '3rem'
    fontWeight: 400
    lineHeight: 1.2
  heading:
    fontFamily: "'Albert Sans', 'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '1.4375rem'
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "'Albert Sans', 'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '1rem'
    fontWeight: 600
    lineHeight: 1.55
  body:
    fontFamily: "'Albert Sans', 'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "'Albert Sans', 'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '0.8125rem'
    fontWeight: 500
    lineHeight: 1.5
  code:
    fontFamily: "ui-monospace, 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.55
rounded:
  none: '0.25rem'
  inner: '0.375rem'
  element: '0.625rem'
  container: '0.8125rem'
  page: '1.125rem'
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
    backgroundColor: '{colors.brand-lime}'
    textColor: '{colors.text-black}'
    rounded: '{rounded.inner}'
    padding: '8px 12px'
  button-secondary:
    backgroundColor: '{colors.chip-gray}'
    textColor: '{colors.panel-graphite}'
    rounded: '{rounded.inner}'
    padding: '8px 12px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.panel-graphite}'
    rounded: '{rounded.inner}'
    padding: '8px 12px'
  button-ghost-hover:
    backgroundColor: 'color-mix(in srgb, {colors.panel-graphite} 5%, transparent)'
    textColor: '{colors.panel-graphite}'
    rounded: '{rounded.inner}'
    padding: '8px 12px'
  button-destructive:
    backgroundColor: '{colors.red-plate}'
    textColor: '{colors.deep-red}'
    rounded: '{rounded.inner}'
    padding: '8px 12px'
  list-row:
    backgroundColor: 'transparent'
    textColor: '{colors.panel-graphite}'
    rounded: '{rounded.container}'
    padding: '10px 12px'
  list-row-hover:
    backgroundColor: 'color-mix(in srgb, {colors.panel-graphite} 4%, transparent)'
    textColor: '{colors.panel-graphite}'
    rounded: '{rounded.container}'
    padding: '10px 12px'
  list-row-selected:
    backgroundColor: 'color-mix(in srgb, {colors.panel-graphite} 10%, transparent)'
    textColor: '{colors.panel-graphite}'
    rounded: '{rounded.container}'
    padding: '10px 12px'
  badge-info:
    backgroundColor: '{colors.signal-blue}'
    textColor: '{colors.panel-white}'
    rounded: '{rounded.element}'
    padding: '2px 6px'
  badge-neutral:
    backgroundColor: '{colors.chip-gray}'
    textColor: '{colors.panel-graphite}'
    rounded: '{rounded.element}'
    padding: '2px 6px'
  badge-blue:
    backgroundColor: '{colors.blue-plate}'
    textColor: '{colors.blue-vivid}'
    rounded: '{rounded.element}'
    padding: '2px 6px'
  input-default:
    backgroundColor: 'transparent'
    textColor: '{colors.panel-graphite}'
    rounded: '{rounded.element}'
    padding: '6px 8px'
  card-default:
    backgroundColor: '{colors.raised-white}'
    textColor: '{colors.panel-graphite}'
    rounded: '{rounded.container}'
    padding: '12px'
  message-bubble:
    backgroundColor: 'color-mix(in srgb, #000000 6%, transparent)'
    textColor: '{colors.panel-graphite}'
    rounded: '{rounded.container}'
    padding: '12px'
  pane-header:
    backgroundColor: 'transparent'
    textColor: '{colors.panel-graphite}'
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
- **Visual style:** clean, functional, implementation-oriented; grayscale structure with chromatic meaning

The audience distinction is load-bearing. A marketing site is read once and
optimizes for impression; this shell is read all day and optimizes for
sustained legibility, scan speed, and the absence of surprise. That is why the
type floor, the achromatic spine, and the single pane elevation are constraints
rather than preferences.

## Style Foundations

The canonical values. `src/themes/neutral/neutralTheme.ts` is the source of
truth; if it and this list disagree, the theme wins and this list is stale.

- **Font family:** `font.family.primary=Albert Sans`, `font.family.stack=Albert Sans, Golos Text, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`, `font.size.base=16px`, `font.weight.base=400`, `font.lineHeight.base=1.55`
- **Typography scale** (base 16, ratio 1.2, rounded to a 1/16rem grid, clamped at a 12px floor): `font.size.xs=12px`, `font.size.sm=13px`, `font.size.base=16px`, `font.size.lg=19px`, `font.size.xl=23px`, `font.size.2xl=28px`, `font.size.3xl=33px`, `font.size.4xl=40px`, `font.size.5xl=48px`
- **Color — accent:** `color.accent=#2e7a00` (light) / `#63fe13` (dark), `color.accent.brand=#63fe13` (primary Button fill, both modes), `color.accent.muted=#edffe0` (light) / `#1b2b10` (dark)
- **Color — text:** `color.text.primary=#262626`, `color.text.secondary=#595959`, `color.text.disabled=#a3a3a3`, `color.text.on-accent=#ffffff` (light) / `#171717` (dark)
- **Color — surface:** `color.surface.pane=#ffffff`, `color.surface.raised=#fafafa`, `color.surface.canvas=#f1f1f1`, `color.surface.base=#000000` (dark canvas)
- **Color — border:** `color.border.hairline=#ebebeb`, `color.border.strong=#d9d9d9`
- **Spacing scale** (4px grid): `space.0-5=2px`, `space.1=4px`, `space.2=8px`, `space.3=12px`, `space.4=16px`, `space.6=24px`, `space.8=32px`, `space.12=48px`
- **Radius:** `radius.none=4px`, `radius.inner=6px`, `radius.element=10px`, `radius.container=13px`, `radius.page=18px`, `radius.full=999px`
- **Shadow:** `shadow.low=0 4px 12px -4px rgb(0 0 0 / 40%)`, `shadow.med=0 14px 26px -16px rgb(38 38 38 / 42%)`, `shadow.high=0 28px 60px -42px rgb(0 0 0 / 72%)` — each gaining a 1px white inset rim (8% / 12% / 15%) in dark mode only
- **Motion:** `motion.duration.instant=140ms`, `motion.duration.fast=160ms`, `motion.duration.normal=183ms`, `motion.duration.slower=262ms`, `motion.duration.medium=300ms`, `motion.duration.medium-max=343ms`, `motion.duration.slow=900ms`

Every value in this list is a semantic token in the theme. Component guidance
must name the token, never the hex, the px, or the ms.

### What the Open Design foundations did not supply

These five decisions are Rezzy's and are not derivable from the imported
foundations. They are listed so nobody re-litigates them as drift:

1. **The categorical and status palettes.** Ten OKLCH hues and two status languages, none of which the foundations describe. See Colors.
2. **The light canvas/pane pair.** The foundations give `surface.base=#000000` and `surface.raised=#fafafa` and no light canvas at all. `#f1f1f1` canvas under a `#ffffff` pane is retained, because collapsing that gap removes every region boundary in the shell at once.
3. **The 4px spacing grid.** The foundations' spacing scale (7 / 8 / 10 / 12 / 14 / 15 / 16 / 18px) is a scrape of observed paddings, not a scale — it has no consistent step and no zero. Tailwind's `--spacing` bridge maps `p-4` to 16px through `--spacing-1`; adopting a 7px base would silently change every spacing utility in the app.
4. **`radius.xl=50px`** has no slot in the six-step radius scale and is unused.
5. **`shadow.4`** is a near-duplicate of `shadow.1` and has no slot.

Two foundation values could not be read at all and were dropped:
`color.text.tertiary=#ffffff` and `color.text.inverse=#434343` are inverted
relative to their names (a "tertiary" text tone lighter than primary, an
"inverse" tone darker than secondary), which is what a scrape of a dark section
on a light page produces. `color.border.strong` held three colors — a
`border-color` shorthand — and only its block-end value (`#d9d9d9`) was taken.

## Context and Goals

**Creative North Star: "The Lit Panel"**

Rezzy's shell is a canvas with elevated panes inset into it: the conversation
list, the thread, the contact panel, a settings page. What separates two regions
is the canvas showing between them, not a line drawn across them. This is the
product's structural claim and it survived a full change of palette, so treat it
as the durable identity — almost every rule below still follows from it.

What changed underneath is the material. The palette used to be a single cool
hue worn thin, with light and dark trading roles. It is now a **pure grayscale
spine at chroma zero** — Tailwind's neutral ramp, no tint anywhere in the
structure — with a from-scratch OKLCH categorical palette bolted on for meaning.
Because the neutrals have no hue at all, chroma is not merely informative when it
appears, it is the _only_ thing on screen carrying meaning. A blue badge is the
single saturated object in a field of gray, and that is the whole point.

Depth changed with it, twice. In light mode the panes lift by tone: a white pane
on a gray canvas, with cards and popovers one shade off white. In dark mode the
canvas dropped to `#000000` and the ladder separated — canvas `#000000`, card
and popover `#1b1b1b`, pane `#262626` — but the **1px inset rim of white at
8-15%** carried inside `--shadow-low/med/high` stays, because card and popover
still share one tone and the rim is what separates a popover from the card under
it. That rim is the most distinctive thing the theme does and the reason for the
North Star: in dark mode the interface is not merely layered, it is _lit_.

**Key Characteristics:**

- Canvas and panes: the shell is a canvas, each region is an inset pane with a fill, a radius, a gap, and a lift
- Gutter separation: the canvas showing between panes divides regions; hairlines rule only _within_ a pane
- Grayscale spine: the structure is chroma 0, so any hue on screen is either the brand accent or a signal
- One brand hue: `#63fe13` on primary buttons, focus rings, links, and the workspace mark — and nowhere else
- Two color languages: pastel plates with same-hue text for categories, saturated opaque fills for status signals
- Lift by tone in both modes, reinforced by rim-light in dark
- Two type tiers: 16px body, 13px metadata; hierarchy escalates through weight and opacity, never size
- Soft, generous corners: 4 / 6 / 10 / 13 / 18px, none of them large enough to circle the plates they land on except at 36px
- Snappy motion: 160 / 300 / 900ms, with a 140ms instant step

### Known drift

The theme was swapped from a bespoke gothic theme to `neutralTheme` in commit
`341a3a2`, then carried the Open Design foundations, neither with a follow-up
pass over the surfaces built against the previous values. These are live and
load-bearing; each is stated again in the section that owns it. Nothing here is
a style preference — they are places where the code and this document
deliberately disagree, with this document describing the target.

1. **Albert Sans does not load.** `neutralTheme.ts` names it; nothing declares
   an `@font-face` for it anywhere in the repo, so every glyph currently
   resolves to Golos Text, the next family in the stack. This is the same
   failure mode Figtree caused, with one difference that makes it survivable:
   Golos Text sits immediately behind it and covers both scripts, so the
   interface degrades to one typeface rather than to two on one screen. Fixing
   it means self-hosting Albert Sans woff2 subsets in `src/fonts` alongside the
   Golos Text ones. See The Cyrillic Coverage Rule.
2. **The two type tiers are now 1px apart in the wrong places.** At base 16,
   `text-sm` is 13px and `text-xs` is 12px — genuinely different sizes for the
   first time, where under base 14 both clamped to 12px. That fixes the
   collapsed hierarchy but exposes the ~160 usages that were written when the
   two were interchangeable: a 1px difference between adjacent metadata reads
   as sloppiness rather than as hierarchy. `text-sm` is the metadata tier;
   `text-xs` should be reserved for the rare case that genuinely needs the
   floor. See The Two-Tier Rule.
3. **Fixed-width controls were sized against a 14px body.** Body type moved
   14px → 16px, so every control with a hard width holds roughly 14% fewer
   characters than when its budget was set. Russian already runs 15-30% longer
   than English, so the base locale absorbs both at once. The budgets in
   `src/lib/message-lengths.test.ts` are character counts and cannot see this;
   they still pass. Verify in a browser at phone width in Russian.
4. **Plates went round, and are half-fixed.** `--radius-page` moved 28px → 18px,
   which restores the squircle on 48px plates. A 36px plate is still exactly
   circular, because 18px is exactly half of 36px. The product's recurring
   silhouette down the conversation list is therefore still a circle. See The
   Plate Went Round.
5. **`bg-muted` recesses in light and raises in dark.** It is byte-identical to
   `bg-body` in light (`#f1f1f1`), so it reads only _inside_ a pane; in dark it
   is `#1b1b1b` against a `#000000` canvas, so it is now a step _up_ from the
   canvas rather than level with it. One token, opposite behaviors by mode. See
   The Recess Is Pane-Relative Rule.
6. **`border-border/60` is close to invisible in light mode.** The `/60` modifier
   was tuned for an alpha border token; the current one is an opaque `#ebebeb`.
   See The Hairline Is Already Thin Rule.
7. **Buttons are 32px tall, and the touch-target criterion wants 44px.**
   Astryx declares `height: 32px` on `Button`; the criterion in the
   Accessibility section is the target and the control does not meet it. This
   predates the import — the body-size change did not cause it and does not
   worsen it, since the height is fixed rather than derived. Raising it is an
   Astryx-level override, not a token change.
8. **No command verifies anything in this document.** Contrast, font size,
   overflow, and shell elevation have no automated check, so every rule here is
   held by review alone. Contrast figures below are computed from the token
   values rather than measured in a browser, and are marked as such.

## Colors

A grayscale structure and a chromatic vocabulary, kept strictly apart. The
neutrals carry every surface, every rule, and every piece of running text; hue
appears only where something needs to be _told_ to the user.

### Primary

**The accent is a hue, and it is the only one in the structure.** It is Open
Design's brand green — and the brand value itself can only appear in one place,
for a reason worth understanding before touching any of it.

- **Brand Lime** (`#63fe13`) — Open Design's actual brand color, and the **primary Button fill only**, mode-locked, with a locked `#171717` label at 13.4:1. Its luminance is 0.736, which makes it **1.34:1 against white**: as link text or as a focus ring in light mode it is not low-contrast, it is invisible. A fill carrying dark text is the one context where that luminance is an asset. In dark mode it widens to the whole accent vocabulary, where the pane behind it is `#262626`.
- **Deep Chartreuse** (`#2e7a00`) — the light-mode accent everywhere else: `text-accent`, `ring-accent`, `border-accent`, `icon-accent`, and `bg-accent-bg`. Same hue family as the lime (H≈97 vs H≈100), pulled down to **5.38:1** on the white pane and 5.16:1 on the `#fafafa` card. Measured, both modes.
- **Pale Wash** (`#edffe0` light / `#1b2b10` dark) — `--color-accent-muted`, the quiet accent surface. `text-primary` on it computes 14.4:1.

Measured accent behavior, in a browser, both modes:

|                                           | light                | dark                 |
| ----------------------------------------- | -------------------- | -------------------- |
| `text-accent` / `ring-accent` on the pane | 5.38:1               | 11.33:1              |
| solid `bg-accent-bg` + `text-on-accent`   | 5.38:1 (white label) | 13.42:1 (dark label) |
| primary Button                            | 13.42:1              | 13.42:1              |

**Interactive state stayed achromatic on purpose.** `bg-primary/4` (hover) and
`bg-primary/10` (selected) bridge to `--color-text-primary`, not to the accent,
so the ~35 hover and selection surfaces in the app are still neutral gray. The
brand lands on deliberate accent objects — a primary button, a focus ring, the
workspace mark — and not on every row the pointer crosses. That is what keeps a
green accent from becoming a green interface.

Interactive state is this accent's _text_ sibling at low alpha: `bg-primary/4`
(hover), `bg-primary/10` (selected), `bg-primary/5` (quiet plate), where
`bg-primary` bridges to `--color-text-primary`. Those three percentages are the
whole state vocabulary.

### Neutral

Tailwind's `neutral` ramp, chroma 0 throughout. Unlike the theme this replaced,
light and dark are genuine pairs rather than one ramp read backwards, so read
each role as a pair.

- **Raised White** (`#fafafa`) / **Canvas Black** (`#1b1b1b`): The raised surfaces — `bg-card`, `bg-popover`. Both slots come from Open Design `surface.raised`; the light one is now a shade off the pane rather than identical to it, so a card on a pane has a tonal edge as well as a shadow.
- **Canvas Gray** (`#f1f1f1`) / **True Black** (`#000000`): The canvas — `bg-body`. The dark slot is Open Design `surface.base`. `bg-muted` shares the light value but not the dark one; see Elevation.
- **Panel White** (`#ffffff`) / **Panel Graphite** (`#262626`): The pane — `bg-surface`. The one background token that is reliably a step away from the canvas in both modes, which is why the shell is built on it.
- **Panel Graphite** (`#262626`) / **Near White** (`#fafafa`): `text-primary`. Computed 15.1:1 light, 14.5:1 dark against the pane. The light slot is the same value as the accent — the accent is the far end of the neutral ramp, not a hue, so primary text and a primary button fill are one tone doing two jobs.
- **Mid Gray** (`#595959`) / **Soft Gray** (`#a3a3a3`): `text-secondary` — timestamps, metadata, supporting copy. Computed 7.0:1 light, 6.0:1 dark against the pane; 6.2:1 against the light canvas. The light slot moved `#737373` → `#595959`, which is the single largest accessibility gain in the import: the old value cleared AA at 4.74:1 with almost nothing spare, and this one clears AAA for body text.
- **Soft Gray** (`#a3a3a3`) / **Dim Gray** (`#525252`): `text-disabled`.
- **Rule Gray** (`#ebebeb`) / **White at 10%** (`#FFFFFF1A`): `border-border`. Light is an opaque tone; dark is an alpha wash. That asymmetry is why the `/60` modifier misbehaves — see The Hairline Is Already Thin Rule.
- **Border Strong** (`#d9d9d9`) / **Dim Gray** (`#525252`): `border-border-strong`. Also the switch and progress-bar tracks, where a wash would vanish and a defined channel is wanted.
- **Chip Gray** (`#e5e5e5`) / **White at 10%**: `--color-background-gray`. The secondary button and the neutral badge.

### Secondary (Categorical)

Ten hues placed at evenly-spaced OKLCH positions — red 22, orange 55, yellow 90,
green 144, teal 180, cyan 215, blue 255, purple 320, pink 355, plus a chroma-0
gray. Each ships four tokens, bridged to Tailwind as `*-subtle` (plate),
`*-ring` (border), and `*-vivid` (text); the icon slot uses the vivid color.

**These invert by mode, and that is new.** Light mode is an opaque pastel plate
(T87-T90) carrying deep same-hue text (T30). Dark mode is a _hue-tinted alpha
overlay_ — the T70 stop at 24% — carrying light pastel text (T80). The overlay
matters: it composites onto whatever sits behind it, so a chip reads the same on
the canvas, on a pane, and inside a popover, instead of stamping a hard colored
panel onto a dark field.

Reachable through product components via `Badge` and `Card` variants:

- **Blue** (plate `#c4ddfb`, text `#00458c`)
- **Green** (plate `#c5e5c0`, text `#0c5700`)
- **Yellow** (plate `#f8da9d`, text `#584400`)
- **Red** (plate `#facecb`, text `#89001a`)
- **Gray** (plate `#e5e5e5`, text `#262626`) — the neutral chip
- Orange, teal, cyan, purple, and pink exist with the full four-token set and are unused by any product surface. They are capacity for a future categorization, not current vocabulary.

Three of these plates do double duty as status wells: `#c5e5c0` is both the green
chip and `--color-success-muted`, `#facecb` is both red and `--color-error-muted`,
`#f8da9d` is both yellow and `--color-warning-muted`. One value, two jobs — which
is why a green chip and a success banner are the same tone, on purpose.

### Tertiary (Status)

Status is two separate languages and conflating them is the most likely mistake
in this palette.

**The tone language** — `--color-success` / `-error` / `-warning` — is drawn as
_text and icon_, on a pastel well or on the page. It never fills a large surface.

- **Deep Green** (`#007004`) / **Pastel Green** (`#9fe59b`)
- **Deep Red** (`#a50c25`) / **Pastel Red** (`#ffc6c1`)
- **Deep Amber** (`#745b00`) / **Pastel Amber** (`#fdcf4f`)

Computed against the light pane: 6.33:1, 7.84:1, and 6.48:1 respectively. Against
their own wells: deep red on `#facecb` is 5.51:1. All clear AA with room.

**The signal language** — the saturated opaque fills — is the opposite. These are
mode-locked, high-chroma, and used only where a small object has to _be_ the
status rather than describe it: filled semantic badges, `StatusDot`, and
`ProgressBar`.

- **Signal Blue** (`#0074e2` light / `#6d9cfe` dark): info, attention, unread.
- **Signal Green** (`#198100` / `#64af4c`): success.
- **Signal Amber** (`#ffce2f`, same in both modes): warning.
- **Signal Red** (`#e33f4a` / `#ff705d`): error.

Light mode puts white on all four except amber, which takes `#171717`; dark mode
puts `#171717` on all four, because the dark stops are bright enough that white
on them fails AA-large.

### Named Rules

**The Grayscale Spine Rule.** Every structural surface, rule, and running-text
tone in this system is chroma 0. Nothing that is merely _structure_ may take a
tint. The corollary is the valuable half: because the field is achromatic, a
single chip is loud without being large, and adding a decorative hue costs more
here than it would in a tinted system.

**The accent is the one sanctioned exception**, and it earns it by being the
brand rather than by being decoration. It appears on primary buttons, focus
rings, links, accent icons, and the workspace mark — a countable set of
deliberate objects. It does **not** appear on hover, on selection, on a
container, on a divider, or on a background that is merely trying to look
branded. The moment green shows up on a surface that is only structure, the
spine is gone and every status color in the system loses its volume.

**The Accent Cannot Be Split By Token Rule.** This is the trap, and it is
invisible to every check in the repo.

The Tailwind bridge in `@astryxdesign/core/src/tailwind-theme.css` looks like it
separates the accent's two jobs:

```css
--color-accent: var(--color-text-accent); /* text-accent, ring-accent */
--color-accent-bg: var(--color-accent); /* bg-accent-bg */
```

It does not. A theme that assigns `--color-accent` lands **later in the cascade
than the alias**, so the alias is overwritten and `text-accent`, `ring-accent`,
and `bg-accent-bg` all resolve to that one value. Astryx's own default theme
sets `--color-accent` and `--color-text-accent` to the same color (`#0064E0`),
which is why the collision never surfaces upstream, and why this theme kept them
identical for as long as the accent was `#262626`.

The consequence: **you cannot give the accent a bright fill and a dark text tone
through tokens.** An attempt to do so silently ships `text-accent` and
`ring-accent` at the fill value — which for `#63fe13` is 1.34:1 on white, a
failed focus ring on all 19 `ring-accent` usages and unreadable text on all 15
`text-accent` ones. Nothing typechecks, lints, or tests differently.

So `--color-accent` and `--color-text-accent` **must** stay byte-identical, and
a brand color too bright to be text belongs on a **component override** instead
— which is where `#63fe13` lives, on `components.button['variant:primary']`.

**The Accent Tint Is The Common Case Rule.** 8 of the 9 `bg-accent-bg` usages in
`src/` are `bg-accent-bg/10` carrying `text-accent` — a pale plate behind accent
text, not a saturated fill. Only the sidebar's active workspace mark is solid.
At `/10` the lime and the chartreuse produce nearly the same pale plate, but only
the chartreuse can be the text on it. That is the deciding reason the shared
token is the readable green rather than the brand one.

**The Accent Label Inverts, The Button Label Does Not.** `text-on-accent` is
white in light and `#171717` in dark, tracking the accent. The primary Button is
the exception: its fill is mode-locked lime, so it carries a locked `#171717`
label in both modes. Writing `text-white` on the primary button produces 1.34:1 —
technically rendered, entirely unreadable.

**The Accent Is Not The Success Color Rule.** The accent green and the success
green now sit within ~10° of each other in hue, and only lightness separates
them: the accent fill is a bright lime (luminance 0.736), the success signal is
a mid green (`#198100`, luminance ~0.19). That gap is real but it is narrower
than any other pair in this palette, and it is the weakest point in the color
system as it now stands. A primary button beside a success badge is fine; a
green fill used to _mean_ "done" is not, because the same family now also means
"this is the main action". Status meaning must come from a `Badge`, `Banner`, or
`StatusDot` variant, never from an accent-colored surface.

**The Two Reds Rule.** `#a50c25` and `#e33f4a` are both red and they are not
interchangeable. The deep one is a text tone, calibrated to sit on a pastel well
or on the page; the bright one is a fill, calibrated to carry white text as a
solid object. Putting the fill red on text gives you 3.1:1 on white; putting the
text red on a dot gives you a maroon smudge at 8px. Reach for the component
variant and let the theme pick.

**The Chip Carries Its Own Text Rule.** A categorical plate is never combined
with `text-primary`. Each hue's `*-vivid` token is the only correct foreground on
its `*-subtle` plate, and the theme's `Card` and `Banner` variants rebind
`--color-text-primary` locally so nested `Text` children inherit it. Use the
variant; do not hand-assemble a plate.

**The Chip Is Not A Field Rule.** A plate is calibrated for chip area. A pastel
that is right behind 13px text at 60px wide is a slab at 700px, where it
outshouts the graphite primary button beside it. A status surface that runs the
full measure fills with the `-muted` well and spends its hue on the icon, the
copy, and the action — the field goes quiet, the meaning does not.

**The Overlay Composites Rule.** In dark mode a categorical background is an
alpha overlay, not a solid tone. Do not "simplify" one to a flat hex: the overlay
is what lets the same chip sit correctly on the canvas, on a pane, and in a
popover, which in dark mode are three different tones behind one transparent
plate.

**The Brand-Hex Exception.** Platform brand colors — Telegram `#26A5E4`,
WhatsApp `#25D366`, Instagram `#E1306C`, in
`src/entities/channel/lib/platform.ts` — are the only raw hex values permitted in
component code, because they are other companies' identities and must not drift
with the theme. Every other color comes from a token.

## Typography

**Body / Interface Font:** Albert Sans, falling back to `'Golos Text',
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial,
sans-serif`
**Heading Font:** Albert Sans — headings match the body
**Display Font:** Albert Sans — display sizes are the same family, larger
**Code Font:** `ui-monospace`, the platform monospace stack. Nothing self-hosted.

**The stack is two fonts by design, not by accident.** Albert Sans ships Latin
and Latin-ext only. `baseLocale` is `ru`, so Golos Text sits immediately behind
it to carry Cyrillic, and the browser resolves per glyph: Latin from Albert
Sans, Cyrillic from Golos Text. Anything appended after those two is a genuine
last resort. Never reorder them, and never drop Golos Text on the grounds that
Albert Sans is "the" font — that would put the primary locale in the system UI
stack.

Golos Text is **self-hosted**: woff2 subsets live in `src/fonts` and are declared
in `src/fonts/fonts.css`, which `src/styles.css` imports outside every cascade
layer, so the faces are registered before the theme references them by name.
Subsets are split by `unicode-range`, so a browser downloads only what the page
contains — Latin alone is ~37 KB, Latin plus Cyrillic ~59 KB.

**Albert Sans is not self-hosted yet.** No `@font-face` for it exists in the
repo, so today the theme names a family the browser cannot resolve and every
glyph falls through to Golos Text. See Known drift 1.

**Character:** Albert Sans is a geometric sans with a tall x-height and a nearly
circular `o`, which reads as neutral and current at interface sizes and gets
crisper as it grows — the reason the display sizes are worth having even though
no product surface reaches them yet. Golos Text underneath it is a
Cyrillic-first humanist sans with open apertures and sturdy, slightly condensed
forms, which is what keeps a 13px metadata tier legible for hours. The two are
close enough in width and x-height that a mixed-script line does not visibly
step. There is no third voice: the register is carried by the grayscale and the
generous corners, not by a contrasting typeface.

### Hierarchy

The scale is **base 16, ratio 1.2**, and Astryx rounds each step to a 1/16rem
grid, producing 13 / 16 / 19 / 23 / 28 / 33 / 40 / 48px from `sm` up. Below `sm`
the generated ramp falls to 11 / 9 / 8 / 6px, and the theme clamps all four to
12px.

- **Display** (400, 3rem / 48px, 1.2 lh): `Text type="display-1"`, plus `display-2` (40px) and `display-3` (33px). No product surface uses these.
- **Heading** (600, 1.4375rem / 23px, 1.3 lh): Astryx `heading-1`. Theme capacity; the shell has nothing at this scale. `h3` and `h4` are bold (700) rather than semibold, set by `typography.heading.weights`.
- **Title** (600, 1rem / 16px, 1.55 lh): `text-base font-semibold`. Page titles — the workspace settings `h1`, empty-state headings.
- **Body** (400-500, 1rem / 16px, 1.55 lh): `text-base`. The workhorse: message text, contact names, previews, form content, descriptions. Prose runs inside a `max-w-3xl` measure.
- **Metadata** (500, 0.8125rem / 13px, 1.5 lh): `text-sm`. Timestamps, chip text, filter labels, supporting captions. Sentence case, always.
- **Floor** (500, 0.75rem / 12px): `text-xs` and every step below it, all clamped to one value. Reserved — reach for it only when 13px genuinely does not fit, and expect to justify it.

### Named Rules

**The Remapped Scale Rule.** Tailwind's size names do not mean their Tailwind
values here. `@astryxdesign/core/tailwind-theme.css` rebinds `--text-*` to the
theme scale, so **`text-base` is 16px, `text-lg` is 19px, and `text-xl` is
23px** — and critically, **`text-sm` is 13px, not 14px**. Never convert a design
spec's px value by assuming Tailwind's defaults. `text-base` happens to coincide
with Tailwind's own 16px, which makes this rule _more_ dangerous rather than
less: one name matching by luck invites the assumption that the rest do. The
same bridge rebinds `--spacing` to `--spacing-1` (4px), so `p-4` is 16px as
expected — spacing is safe, type is not.

**The 12px Floor Rule.** Nothing in this product renders below 12px. 12px is the
bottom of the legible range for interface text, and `baseLocale` is `ru`, whose
diacritics and soft signs are the first things to go as size drops. The generated
scale does not stop there — base 16 at ratio 1.2 produces 11px at `xs` and
continues to 9, 8, and 6px at `2xs`, `3xs`, and `4xs` — so the theme clamps those
four steps to `0.75rem` rather than rescaling, which would move every size in the
system including the display sizes. `sm` rounds to 13px on its own and is no
longer clamped, which is what gives the interface two real tiers again.

Two sizes are outside a token's reach and are floored in
`src/generated/astryx-font-floor.css` instead. Astryx's `Avatar` computes its
initials from the avatar's pixel size (`size * 0.4`) and writes an inline
`--x-fontSize`; `Table`'s sort indicator carries a literal `font-size: 10px`.
Both are raised with `max()`, so larger avatars keep their proportional initials.
The selectors are StyleX atomic hashes read out of the installed package rather
than written by hand — **but there is no generator**, so the file cannot be
regenerated after an `@astryxdesign/core` upgrade without re-deriving the hashes
by hand. Treat it as pinned to 0.1.8.

**The Two-Tier Rule.** The interface has two tiers: **body at `text-base`
(16px)** and **metadata at `text-sm` (13px)**. `text-lg` and above are theme
capacity, not shell vocabulary; `text-xs` and below are the floor, not a third
tier. Escalate through weight (400 → 500 → 600) and opacity, not through size.
Introducing a third size into a shell means the hierarchy failed at weight
first.

_This is the target, not the current state._ Under base 14 both `text-sm` and
`text-xs` clamped to 12px, so the ~160 usages across `src/` were written when
the two names were interchangeable. They are now 13px and 12px — different, but
by an amount too small to read as hierarchy and large enough to read as an
accident when two of them sit adjacent. Fixing it means auditing those usages
onto the correct tier — body copy to `text-base`, metadata to `text-sm`,
`text-xs` only where something genuinely does not fit — not globally
find-and-replacing one for the other.

**The Opacity Step Is Mode-Asymmetric Rule.** `text-primary/55` computes to
3.6:1 in light and 5.4:1 in dark, so an opacity step tuned in one mode can be
under AA in the other. The light figure got _worse_ with the import, because the
primary tone lightened `#171717` → `#262626` and an alpha step off a lighter
tone lands lighter still. `/70` (5.7:1 light) remains the lowest rung that
clears both. When copy needs to recede, prefer `text-secondary`, which is a
designed tone rather than an arithmetic one — and which now has AAA margin.

**The Cyrillic Coverage Rule.** Cyrillic must be covered by a font the repo
declares, and it must be covered _before_ the system fallback. `baseLocale` is
`ru` (`project.inlang/settings.json`), so Russian is the default experience, not
a translation bolted on — a Latin-only body font with nothing behind it leaves
the primary locale in the system stack and styles only the Latin strings beside
it, which reads as two typefaces on one screen.

This rule has now caught three faces: **Fustat**, the gothic theme's original
choice, which ships Arabic and Latin; **Figtree**, which the neutral theme named
on arrival and which ships Latin and Latin-ext only, with no `@font-face`
anywhere in the repo, so for a period the entire interface rendered in the
system UI stack; and **Albert Sans**, the current primary, which also ships
Latin and Latin-ext only.

Albert Sans is allowed where the other two were not, because the rule is about
_coverage of the stack_, not coverage of one family. Golos Text sits directly
behind it and is self-hosted with a Cyrillic subset, so per-glyph fallback lands
Cyrillic on a declared face rather than on the system. That arrangement has one
requirement and it is not optional: **the Cyrillic-carrying face must come
before any generic fallback in the stack.** Move it, drop it, or bury it behind
`-apple-system`, and Russian silently returns to the system UI stack.

Judge a candidate body face by its `unicode-range` coverage before its shapes.
If it does not ship Cyrillic, it may only be the primary of a stack whose next
entry does. Confirm the `@font-face` exists either way — naming a family in the
theme does not load it.

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
(`bg-surface`), the radius (`md:rounded-lg`, 13px), the lift (`md:shadow-sm` →
`--shadow-low`), and the scroll containment. The group is mounted once, in the
shell root, so a route contributes panes and can never forget the inset. The
inbox contributes three sibling panes; a single-pane route contributes one.
`contentPadding={0}` on AppShell is what keeps the two from doubling the seam.

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
named steps). Conversation rows are `px-3 py-2.5` with `gap-3` and `gap-0.5`
between rows; nav rows are `px-2 py-2`; settings rows are `py-4`. The inbox list
is user-resizable via `useResizable` (default 320px, min 200, max 480, persisted
as `inbox:list-width`) with a `ResizeHandle` in the seam. The handle runs without
`hasDivider`, so it takes zero width and contributes only a hit area: what the
user grabs is the gutter itself. `-mx-1` absorbs the second gap the group would
otherwise put around it, keeping that seam the same width as every other one.

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
values.** Under the neutral theme they do — `#f1f1f1` / `#ffffff` in light,
`#000000` / `#262626` in dark — and that difference is the entire reason a pane
reads as an object rather than as more page.

This is worth stating as a constraint rather than a description, because it is
invisible to every cheap check. A theme that collapses the two still renders,
still typechecks, still passes the unit suite; the app just quietly becomes one
flat sheet with unexplained gaps in it. An earlier theme did collapse them and
the shell was rebuilt around hairlines as a result, so this is a live failure
mode rather than a hypothetical one. **No check asserts it**, so the constraint
is enforced by reading alone.

**Every background token is now a genuine light/dark pair, and the two modes
order them differently:**

| token        | light     | dark      |
| ------------ | --------- | --------- |
| `bg-surface` | `#ffffff` | `#262626` |
| `bg-body`    | `#f1f1f1` | `#000000` |
| `bg-card`    | `#fafafa` | `#1b1b1b` |
| `bg-popover` | `#fafafa` | `#1b1b1b` |
| `bg-muted`   | `#f1f1f1` | `#1b1b1b` |

Read the two columns against each other. In light the pane is the _lightest_
tone and everything else steps down from it; in dark the pane is the _lightest_
tone too, but the canvas has dropped to true black, so the same ordering spans a
much wider range. `bg-card` and `bg-popover` still share one tone in dark, and
`bg-muted` joins them there.

That shared `#1b1b1b` is why the rim survives. In dark mode
`--shadow-low/med/high` each carry a **1px all-around white inset** at 8% / 12%
/ 15%, wrapped in `light-dark(transparent, …)` so light mode is untouched. It is
what gives a popover an edge against the card beneath it, and a card an edge
against a muted well — the three places dark mode still has no tonal step. A
dark surface that should read as raised above another `#1b1b1b` surface has no
edge at all without it.

Inside a pane, depth has **two further moves**, both tonal:

1. **Recess** — `bg-muted` (`#f1f1f1` / `#1b1b1b`). Avatar and platform plates, media wells, skeleton blocks. In light it is the canvas value, so it reads only against `bg-surface`. In dark it is a step _above_ the canvas, so on the canvas it raises instead of recessing — see The Recess Is Pane-Relative Rule.
2. **Raise** — `bg-card` (`#fafafa` / `#1b1b1b`), plus `--shadow-low` where Astryx's `Card` applies it. Auth and onboarding sheets, popovers, dialogs. Light mode raises with tone plus shadow; dark mode raises with tone against the canvas and with the rim against another card.

Region boundaries in the authenticated shell are gutters. Hairlines remain for
boundaries _within_ a pane.

### Shadow Vocabulary

Shadows are theme tokens applied by Astryx components. Light mode keeps subtle
drops; dark mode deepens them and adds the rim.

Each is a **single layer with a large negative spread** — a tight contact shadow
rather than the two-layer ambient/direct pair they replaced. The alpha figures
look high for a light interface; the spread is what pulls most of the shadow
back under the shape, so the rendered result is tighter, not darker.

- **`--shadow-low`** (`0 4px 12px -4px` at 40% / dark 60%; dark adds `inset 0 0 0 1px` white 8%): Cards, raised sheets, and every `AppPane` via `shadow-sm`.
- **`--shadow-med`** (`0 14px 26px -16px` at 42% / dark 62%; dark rim 12%): Hover and mid-elevation containers, via `shadow-md`.
- **`--shadow-high`** (`0 28px 60px -42px` at 72% / dark 85%; dark rim 15%): Popovers, dropdowns, dialogs, via `shadow-lg`.
- **`--shadow-inset-hover` / `-selected`** (`inset 0 0 0 2px` signal blue at 30% / 50%): Ring-style emphasis where a real border would shift layout.
- **`--shadow-inset-success` / `-warning` / `-error`** (`inset 0 0 0 2px` at 30%): Status rings on fields and cards.

### Named Rules

**The Surface-Above-Canvas Rule.** `bg-surface` must paint something against
`bg-body`. A theme is free to choose the two tones, but not to make them equal:
the shell's entire structure rests on that gap, and collapsing it removes every
region boundary in the app at once.

**The Rim Is The Edge Rule.** In dark mode, card, popover, and muted are all
`#1b1b1b`. Between any two of them elevation is a light effect, not a tonal one,
and a surface that should read as raised above another must carry a shadow token
so it gets the inset rim. Hand-rolling a "popover" with `bg-popover` and no
shadow produces an invisible rectangle on top of a card. Against the canvas the
tone now does the work on its own — but never rely on that, because which
surface sits behind a component is a composition decision that changes.

**The Recess Is Pane-Relative Rule.** `bg-muted` does not mean one thing.
In light it is byte-identical to `bg-body` (`#f1f1f1`), so it recesses only
_inside_ a pane, against `bg-surface`, and paints nothing on the canvas. In dark
it is `#1b1b1b` against a `#000000` canvas, so outside a pane it _raises_.
Anything that needs to read as recessed must therefore live inside a pane —
which in this shell it always does. A full-bleed `bg-muted` region outside one
is a no-op in light and a wrong-direction step in dark, which is worse than the
no-op: it looks deliberate.

**The Hairline Is Already Thin Rule.** Use `border-border` at full strength.
`border-border/60` is a holdover from a theme whose border token was the accent
at 10% alpha, where `/60` landed a visible 6% rule. The current light token is an
opaque `#ebebeb`; at `/60` it composites to roughly `#f3f3f3` on a white pane —
about 1.06:1, which is not a rule, it is a rumor. `border-border` on its own is
already the intended hairline in both modes. ~26 usages of the `/60` form remain
and should drop the modifier.

**The Gutter Rule.** The canvas showing between panes is what separates regions.
It is owned by `AppPaneGroup` in one place, so the seam is one value everywhere
and a route cannot hand-roll its own. A pane never carries a border: a shadow and
an outline together read as a card drawn on top of a card.

**The Hairline Rule.** A rule divides _within_ a pane — a header and the body
that scrolls under it, a filter strip and its list, one row of a dense list and
the next. It is not used between panes, where the gutter does the work, and it is
never a full outline around a large surface.

**The Shadow-Is-Theme-Only Rule.** Component code carries no ad hoc `shadow-*`
utilities beyond the bridge names. Shadows live in `--shadow-low/med/high` and
are applied by Astryx's `Card`, `Popover`, and `Dialog`, or by `AppPane`, which
maps `shadow-sm` to `--shadow-low` — one lift, applied in one file, shared by
every pane. Two small exceptions exist and both are decorative detail at small
scale: `shadow-xs` on a reaction pill, `drop-shadow-md` on an image-viewer
control. An ad hoc `shadow-md` on hover is still wrong: the pane vocabulary has
exactly one elevation, and a second one competing with it makes the frame read as
unstable.

## Shapes

The radius scale is soft and generous throughout. Under the Open Design
foundations the small end held still and the large end came back down: 28px →
18px at `--radius-page`, which is the largest single move the import makes to
the shell's silhouette.

- **`--radius-none`** `0.25rem` / 4px — not zero. Even the "square" step is curved. Below Open Design's own floor of 6px; retained.
- **`--radius-inner`** `0.375rem` / 6px — buttons resolve here (`calc(--radius-element - --spacing-1)`).
- **`--radius-element`** `0.625rem` / 10px — fields, badges, small chips.
- **`--radius-container`** `0.8125rem` / 13px — panes, list rows, message bubbles, cards, wells.
- **`--radius-page`** `1.125rem` / 18px — avatar and platform plates, media frames, large wells.
- **`--radius-full`** `9999px` — date separators, reaction pills, recording indicators.

**Borders.** One width exists: `--border-width: 1px`. Borders are hairlines that
divide, not outlines that contain.

**Clipping.** `overflow-hidden` on every pane frame is mandatory, so headers and
scroll regions terminate at the pane edge instead of bleeding past it.

### Named Rules

**The Radius-Name Trap.** Tailwind's radius names are rebound to the theme scale
and the mapping is not one-to-one with Tailwind's defaults: **`rounded-sm` = 6px,
`rounded-md` = 10px, `rounded-lg` = 13px, and `rounded-xl` = 18px**. A spec that
says "13px corner" is `rounded-lg` here. The gap between `rounded-lg` and
`rounded-xl` is now one real step rather than the 2.3× jump it was at 28px,
which makes the two easier to confuse — check the token, not the eye.

**The Plate Went Round.** `--radius-page` moved 24px → 28px, which exceeded half
the width of every plate that used it and clamped them all to circles. It is now
18px, which fixes the 48px case (a `size-12` plate is a squircle again) and
_exactly_ misses the 36px case: 18px is precisely half of 36px, so a `size-9`
plate is still a circle. That is the product's most-repeated silhouette, down
the whole conversation list.

So the decision is still open, just smaller. Either accept the circle at 36px
and drop the squircle language for that size, or move the 36px plates to
`rounded-lg` (13px) and let 48px keep `rounded-xl`. Do not reach for an
arbitrary value. Note that `rounded-xl` also lands on wide blocks (the
channel-connect help panels), where 18px is a visible softening from 28px but
not a clamp.

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
- **Focus-visible is never removed, never `outline: none` without a replacement, and never expressed by color alone.** It must be visible against the component's default, hover, _and_ selected fills, which is why it is inset.
- **Disabled is a state of the form, not of the control.** A submitting form locks uniformly; a control that greys itself out while its siblings stay live is a bug.

**Every interactive component must also define keyboard, pointer, and touch
behavior**, and long-content, overflow, and empty-state handling. Those are not
optional sections of a component's description — a component whose overflow
behavior is undefined has a bug that jsdom cannot see.

### Buttons

Resolved and unfussy. State is a tonal shift, never a scale or bounce.

- **Shape:** **10px, measured** — the same value as `--radius-element`. This document previously said 6px via `calc(--radius-element - --spacing-1)`; a rendered `Button` computes `border-radius: 10px`, so either Astryx does not apply that calc or it never did. Trust the measurement.
- **Height:** **a fixed 32px, set by Astryx**, not derived from its padding. The 8px block padding is decorative — the label is flex-centered inside a declared `height: 32px`. This is why the body type moving 14px → 16px did not change the control height: the 24px line box still fits inside 32px with 4px to spare, and nothing clips. It also means the button is **below the 44px touch-target criterion** in the Accessibility section, in both modes and at every breakpoint.
- **Primary:** The brand lime `#63fe13` with a locked `#171717` label, the same in both modes, set as a component override rather than through the accent token — see The Accent Cannot Be Split By Token Rule for why it cannot come from `--color-accent`. Measured 13.42:1. Never `text-white` on it: that is 1.34:1.
- **Secondary:** `--color-background-gray` (`#e5e5e5` / a 10% white wash) with `--color-text-gray`, no border. Astryx's default — the theme does not override it.
- **Ghost:** Transparent, hover `--color-overlay-hover` (black at 5% / white at 5%). The default for icon buttons and inline actions.
- **Destructive:** **A pastel well, not a fill.** `--color-error-muted` background (`#facecb` / a red alpha overlay) with `--color-error` text (`#a50c25` / `#ffc6c1`), computed 5.51:1 in light. This is a change of kind from the previous theme, where destructive was a solid crimson with an inverted label — a destructive action is now the quietest colored object on screen rather than the loudest. If a delete confirmation needs more weight than that, the weight belongs in the copy and the dialog, not in a re-fill.
- **Loading:** `isLoading` keeps the label visible alongside the spinner.

### Navigation

The rail is the product's spine and the only persistent chrome.

- **Structure:** `SideNav` with `header`, `collapsible`, and `footer` slots. Collapse state persists to `app:sidebar-collapsed`.
- **Heading:** the wordmark alone, linking to `/`. It is the rail's only identity chrome — the workspace does not share the row, because a name you switch and a name you cannot are not the same kind of thing. A quiet `bg-primary/5` monogram plate rides beside it, which is also what keeps the header alive collapsed: `SideNavHeading` renders nothing there without an icon.
- **Workspace switcher:** the first row of the nav body rather than part of the heading. Built like the account row in the footer — a ghost `Button` inside a `DropdownMenu`, `px-2` with the label span grown so a trailing `chevrons-up-down` pins to the edge — carrying a `WorkspaceMark` (24px plate, `rounded-md`, accent fill when active and `bg-accent-bg/10` when not) and the workspace name at `font-medium`. Collapsed it becomes an icon-only trigger with a tooltip. The rail's two entity rows, workspace at the top and account at the bottom, share one construction and bracket the navigation between them.
- **Items:** `SideNavItem` with a 16px Lucide icon. Selection is a quiet accent fill; the same grammar as a conversation row.
- **Workspace group:** the selected workspace's destinations sit in a nested `SideNavSection` indented `ml-5` behind a `border-l border-border`, which lands the rule on the workspace mark's own centre axis. The indent is what says the rows belong to that workspace, so the group never repeats the name two rows below the row already showing it — the name goes to the section's hidden group label instead, where a screen reader still gets it. Dropped when collapsed, since there is no text to indent against. The bracket runs at full `border-border`: the alpha that divides two regions across 244px vanishes over an 80px vertical.
- **Sections:** three regions, two rules. Identity; then the workspace and whatever it contains; then Home and notifications, which span every workspace rather than describing where you are. The rules are `Divider`s inset to `-mx-2 my-1` so they run edge-to-edge across the rail, and they disappear when collapsed, matching the footer.
- **Disabled items:** a locked route (Inbox with no active channel) is `isDisabled` and wrapped in a `Tooltip` that explains why. It only locks once readiness is known false — an unsettled or failed check leaves the item alone rather than flickering on every workspace switch.
- **Footer:** the account row — avatar, display name, trailing `chevrons-up-down`, opening Profile / Settings / Sign out. Styled to read as the last nav row rather than a button: `px-2 font-normal` with the label span grown so the chevron pins to the trailing edge. `src/styles.css` suppresses the rule Astryx draws above the footer zone.

### Conversation List Items

The most-read surface in the product.

- **Layout:** a 36px platform plate (`rounded-xl`, 10% brand tint) plus a text body, `gap-3`, `px-3 py-2.5`. Direct children of a scrollable `role="listbox"` with `gap-0.5` — no card wrapping.
- **Typography:** contact name at 600 (unread) or 500 (read); preview at `text-primary/80` (unread) or `text-secondary` (read); timestamp at `text-secondary`. The name and preview belong at `text-base` (16px) and the timestamp at `text-sm` (13px); they currently render at 13px and 12px respectively, which is the drift described in The Two-Tier Rule.
- **Unread:** name goes semibold, preview brightens, and a `NumericUnreadChip` appears in the trailing position. The chip hides on the selected row — opening a conversation resets its count visually.
- **The state line:** the row's third line is where the work stands and who owns it — `ConversationStatusChip` on the leading edge, a 24px assignee face on the trailing one, `justify-between` at `min-h-6`. 24px because that is exactly the badge's own height, so the line has one rhythm rather than two. Nothing renders there when nobody is assigned: an unassigned conversation is the common case in a shared inbox, and a column of empty placeholders down the most-read surface would spend real estate saying "no". An `assigned_to` the workspace roster cannot resolve — a colleague who has left — gets a muted `UserRound` plate instead, because that state must not read as unassigned.
- **The right rail:** timestamp, unread count and assignee face land on one vertical axis at the row's trailing edge, one per line. Three answers to "does this need me", stacked.
- **Assignee identity:** the face carries a `HoverCard` with the member's name, job title, workspace role and phone (`WorkspaceMemberAvatar`). It is pointer-only by construction — the trigger is a plain element inside the row's button, so no second tab stop is introduced — which is why the row's `aria-label` names the assignee too. A hover card is never the only copy of a fact.
- **Selected:** `bg-primary/10` with `text-primary`, via `data-selected="true"`.
- **Hover:** `bg-primary/4`, scoped to `data-[selected=false]` so hover can never override selection.
- **Focus:** `ring-2 ring-accent ring-inset` — inset so it stays legible on top of either state.

### Chips and Badges

`Badge` now carries **two different color languages**, and picking the wrong
variant family is the most common way to get this wrong.

- **Semantic variants** (`info`, `success`, `warning`, `error`) are **saturated opaque fills** with a contrasting label: signal blue / green / red with white in light and `#171717` in dark, and signal amber with `#171717` in both. These are loud on purpose. On an achromatic field a filled badge is the brightest object on screen.
- **Categorical variants** (`blue`, `green`, `red`, `orange`, `yellow`, `teal`, `cyan`, `purple`, `pink`, `gray`) are the **pastel plate + same-hue text** pairs, sourced from `--color-background-{hue}` and `--color-text-{hue}`, inverting to an alpha overlay in dark.
- **`neutral`** mirrors the gray categorical: `--color-background-gray` with `--color-text-gray`.
- **Unread counts** (`NumericUnreadChip`): `variant="info"` — now a filled signal-blue pill rather than the pastel plate it was under the previous theme — or `"neutral"`. Caps at `99+` when `capAt99` is set. Wrapped in `role="status"` with a count-aware label.
- **Conversation status** (`ConversationStatusChip`): variant mapped from the status's semantic color — accent→info, warning→warning, success→success, danger→error, default→neutral. That mapping now resolves to filled badges for every non-default case.
- **Status dots** (`StatusDot`): fills match the semantic badge fills exactly, so a dot and its badge read as one status language. `neutral` is deliberately not overridden — the neutral badge background is near-invisible at 8px, so it keeps the component default's mid-gray.
- **Channel status** and **inline metadata chips**: `text-sm` (13px) in a `border border-border rounded-lg px-2 py-1` outline — the one place a full border is correct, because these are small and self-contained rather than large surfaces.
- **Date separators:** `bg-muted text-secondary rounded-full px-2.5 py-0.5 text-xs font-medium`, centered between day groups. `bg-muted` reads here because the transcript is inside a pane, so the pill sits on `bg-surface` and the muted tone is a real step down from it. Restyle with color only; the transcript measures row heights for scroll anchoring, so a border or size change perturbs the pin.

### Inputs and Fields

- **Shape:** 10px (`--radius-element`).
- **State:** Astryx `TextInput` takes a `status` object (`{ type: 'error', message }`) driven from React Hook Form's `fieldState`. Validation copy renders below the field at label size. The theme adds no per-status overrides: `--color-{success,error,warning}` already clear AA non-text 3:1 against both surfaces the border and icon touch — the input surface and the status message bubble — in both modes.
- **Composer field:** transparent and borderless (`bg-transparent shadow-none`, `resize-none leading-6`). The composer surface _is_ the field; a filled input inside it would be a box inside a box. The floor is the height of an empty composer, so it tracks the layout: `min-h-9` on desktop, where the field owns its own row, and `min-h-8` below 768px, where it shares a row with 32px controls. Either way `resize()` grows it from there to the five-line cap and then scrolls.
- **Composer layout:** two shapes, chosen at the 768px `useIsMobile` breakpoint. Desktop uses Astryx `ChatComposer` and its three-slot column — header actions, field, send footer. Phones get a single row (attach, emoji, field, send/mic) at 48px empty, because that column stacks to ~136px before a word is typed and the transcript is what the screen is for. `ChatComposer` cannot collapse into one row: its footer always renders with a 32px floor, and its footer-actions group is content-sized, so a field placed there cannot grow. The mobile row therefore rebuilds the same surface grammar from tokens — `bg-popover`, `rounded-xl` (18px, the chat radius), `shadow-sm` lifting to `shadow-md` on hover and focus-within, `cursor-text` — rather than from Astryx's hashed StyleX classes. Keep the two in sync by token, not by copied class.
- **Disabled:** driven by the form's `disabled` flag rather than per-field styling, so a submitting form locks uniformly.

### Message Bubbles

Built on Astryx's `Chat` family — `ChatLayout` owns the scroll container and
follow-on-append; `ChatMessage` wraps a same-sender run; `ChatMessageBubble`
draws each bubble.

- **Fill:** `--color-neutral` — black at 6% in light, white at 10% in dark — for **both directions**. Inbound and outbound share one tint. Direction reads from alignment and from the delivery-tick row, not from color. Anything that wants to distinguish them by fill has to introduce a second tint, and that is a system change, not a component tweak.
- **Grouping:** consecutive same-direction messages render as one run with grouped corner radii (`group="first" | "middle" | "last"`). A run shows one timestamp footer; a message carrying state of its own (edited, failed, reactions) always shows its own.
- **Ghost variant:** media-only messages drop the bubble boundary and keep the padding, so the frame is the object.
- **Failed:** the bubble states it — `bg-error/12 ring-1 ring-error/70` — and the caption explains it. The failure never gets a line of its own: `time · ⚠ Not sent · Retry` stays on the single footer row, because a second line sits closer to the next message than to the bubble it describes. The retry is caption-scale and underlined, with padding for a real hit target.
- **Quoted reply:** a 2px `border-current/30` rule with the author at `font-semibold` over the quoted text at 60%, both truncated to one line. Never a plate — the bubble is already the plate, and a fill inside it is a box in a box. The loaded parent outranks the channel's quote payload for author and text, so "Quoted message" only appears when neither is resolvable; without a loaded parent the strip is inert rather than a control that silently does nothing. The composer's reply drawer uses the same rule.
- **Action rail:** a reply control parked in the transcript gutter, absolutely positioned outside the bubble, revealed on `group-hover/msg` and `group-focus-within/msg`. Anchored to the first text line (`top-2`) for text and to the middle for media or structured blocks. Zero hit target until engaged; on touch it sits permanently at 60% opacity with an expanded 44px target.

### Cards

Cards are for auth and onboarding sheets and for overlaid forms — not for
structuring shell content.

- **Shape:** 13px (`--radius-container`), 12px internal padding via the theme's `card` base (`var(--spacing-3)`). `Section` takes the same padding.
- **Background:** `bg-card` (`#fafafa` / `#1b1b1b`) with `--shadow-low`. In light that is off-white on a gray canvas, one shade below the pane. In dark it is a step above the `#000000` canvas but identical to a popover, so a popover opened over a card is drawn entirely by the shadow's inset rim. A raised surface without its shadow is invisible against another `#1b1b1b` surface.
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
- **Hand-composed variant:** a 56px `rounded-2xl bg-primary/5 text-primary/40` icon plate, a semibold heading, and a `text-primary/60` description at `max-w-xs`.
- **Inline query errors:** `bg-error/10 rounded-lg px-3 py-2` with `text-error` copy and a ghost retry button on the trailing edge. Never a toast for a state the user can retry in place.
- **Blocking errors:** `Banner status="error"` with a title, a description that distinguishes the recoverable case (session expired → sign in) from the generic one, and an action in `endContent`.
- **Banner fill:** the `-muted` well at 10px (`--radius-element`), no border — a status surface at full measure is a tinted field, not a plate and not an outlined box. The theme's banner overrides rebind `--color-text-primary`, `--color-text-secondary`, and the status token itself to the hue's `*-vivid` value, so the icon, the title, the description, and the `endContent` chip all arrive in one tone. All four statuses move together; success is not a special case.
- **Retry semantics:** a failed readiness check renders an error with a retry — it never redirects. A failed check is not the same as a workspace with no channels, and redirecting on failure is what turns a flaky network into a loop between two routes.

### Auth and Onboarding

Outside the shell entirely. `bg-surface md:bg-body` on a `min-h-dvh` centering
wrapper, holding a single `Card` at `maxWidth={448}`. On a phone the wrapper
takes the card's own tone, so the form occupies the page; from `md` up it drops
to the canvas and the card floats on it. That switch depends on surface and body
resolving to different values — the same arithmetic the shell's panes depend on,
in a place with no panes.

There is **no decorative background**. No dot grid, no radial gradient, no
texture — beyond its imports, `src/styles.css` holds a cascade-layer declaration,
one footer-rule suppression, two height rules, and one keyframe animation with
its reduced-motion guard. Its imports are the Tailwind entry points, the Astryx
reset and core, the Tailwind token bridge, the generated font floor, and
`./fonts/fonts.css`. That is the entire hand-written stylesheet. Do not add a
background to it.

### Motion

The theme declares `fast: 160ms`, `medium: 300ms`, `slow: 900ms` at ratio 0.875,
compiled to `--duration-*` tokens with min/max companions (fast 140/160/183,
medium 262/300/343). The ratio is chosen so the generated companions land on
Open Design's own named steps — `instant` 140, `normal` 180, `slower` 260 —
rather than on arbitrary values. Product code mostly uses Tailwind's bare
`transition` on hover and selection, and every custom animation guards
`motion-reduce:transition-none` / `motion-reduce:animate-none`.

The one authored animation is `unread-count-emphasis` in `src/styles.css`: 280ms
on `cubic-bezier(0.16, 1, 0.3, 1)`, scaling 0.92 → 1 and fading 0.55 → 1 from
`transform-origin: left center`, so a count that changes draws the eye without
moving its neighbors. It is disabled under `prefers-reduced-motion`.

## Accessibility

**Target: WCAG 2.2 AA.** Keyboard-first interaction is required, focus-visible
is required, and the contrast constraints below are required.

Nothing in this section is enforced by a command. `package.json` has no
contrast, font-size, or overflow check, and jsdom has no layout, so the unit
suite cannot see any of it. Each criterion below is therefore written to be
checkable by one person in a browser in under a minute — that is the standard
these have to meet to be worth writing down.

### Acceptance criteria

Each is pass/fail. "Fail" means the change does not ship.

**Contrast**

1. Body and metadata text must reach 4.5:1 against every surface it lands on — pane, canvas, card, muted well, and any categorical plate. Check both modes. `text-secondary` reaches 7.0:1 light / 6.0:1 dark on the pane and is the safe default for receding copy.
2. An opacity step on `text-primary` must be `/70` or higher. `/55` computes to 3.6:1 in light and fails. Verify in light mode specifically — the two modes disagree, and dark is the forgiving one.
3. Icons, borders, and other non-text objects that carry meaning must reach 3:1 against their background. A decorative icon beside a text label that already says the same thing is exempt.
4. A filled semantic badge must carry its paired label color, not `text-primary`. A categorical plate must carry its `*-vivid` token. Both pairings are AA by construction; hand-assembled ones are not.
5. Nothing may rely on color alone to convey state. A status dot must be accompanied by text, an `aria-label`, or both.

**Keyboard**

6. Every interactive element is reachable by Tab in the order it appears visually, and every one shows a visible focus ring when reached.
7. The focus ring is visible against that element's default, hover, and selected fills. `ring-2 ring-accent ring-inset` satisfies this; an outset ring on a selected row does not.
8. No element introduces a second tab stop for the same action. The conversation row's assignee hover-card is pointer-only by construction for exactly this reason, which is why the row's `aria-label` names the assignee too.
9. Any fact available only on hover must also be available in text or in an accessible name. A hover card is never the only copy of a fact.
10. Dialogs, popovers, and the mobile contact sheet trap focus while open, return focus to their trigger on close, and close on Escape.

**Text and layout**

11. Nothing renders below 12px. The theme clamps `xs` and below to the floor; the two sizes outside a token's reach are floored in `src/generated/astryx-font-floor.css`.
12. At 200% zoom and at 320px width, no content is clipped and nothing scrolls horizontally.
13. Every string is checked in Russian at phone width. Russian runs 15-30% longer than English, and the body tier is now 16px, so a control sized against 14px English copy has two compounding reasons to truncate.
14. Touch targets are at least 44px in their smallest dimension. The message action rail expands to 44px on touch specifically to meet this.

**Motion**

15. Every transition and animation carries a `motion-reduce:` guard. `unread-count-emphasis` in `src/styles.css` is the model.
16. No animation flashes more than three times per second.

### Named Rules

**The Contrast Is Computed, Not Measured Rule.** Almost every ratio in this
document was computed from the token values, not read off a rendered page. The
exception is the sign-in route, where the text/background pairs were sampled in
a browser and agreed with the computed figures to two decimal places — `#262626`
on `#fafafa` at 14.5:1 and `#595959` on `#fafafa` at 6.71:1. That agreement is
evidence the arithmetic is right, not evidence the other routes are: computed
figures can still be wrong for the screen when an alpha composites over an
unexpected background, when a categorical plate sits behind a component that
assumed the pane, or when a token resolves through a variant override. Treat the
figures as the reason to check, not the result of having checked.

**The Two Modes Disagree Rule.** A value tuned in one mode is not verified in
the other. Alpha steps, categorical overlays, and the shadow rim all behave
differently by mode, and light is the stricter one for text while dark is the
stricter one for surfaces. Check both, every time, or state which one you
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
- **Any string inside a fixed-width control gets a budget** in `src/lib/message-lengths.test.ts`. That test reads character counts, not layout, so it catches a translation that doubled and not one that overflowed by 3px. The browser check is still required.

## Rules: Do and Don't

Every rule below is a **must**. Recommendations live in the prose above and use
**should**. If a rule here reads as advice, it is written wrong — report it
rather than working around it.

### Do:

- **Do** treat `src/themes/neutral/neutralTheme.ts` as the source of truth for every token. It is applied at runtime by `<Theme>` in `src/main.tsx`; there is no build step and no compiled `theme.css` to regenerate.
- **Do** add a self-hosted `@font-face` in `src/fonts/fonts.css` for any family the theme names, with the `unicode-range` split intact, and confirm the family ships Cyrillic. Naming a family in the theme does not load it.
- **Do** separate sibling regions with the canvas gutter — compose `AppPane`s and let `AppPaneGroup` own the space between them. Rule _within_ a pane with `border-border`.
- **Do** give a surface a shadow token when it should read as raised. In dark mode the inset rim is the only thing distinguishing a card from the canvas.
- **Do** use the Tailwind bridge names (`text-primary`, `text-secondary`, `bg-muted`, `bg-card`, `bg-surface`, `bg-accent-bg`, `text-on-accent`, `border-border`, `text-error`, `bg-blue-subtle`, `text-blue-vivid`) rather than raw `var(--color-*)` in class strings.
- **Do** express state as the accent at low alpha: `bg-primary/4` hover, `bg-primary/10` selected, `bg-primary/5` quiet plate.
- **Do** put `text-on-accent` on any accent fill, so labels invert with their background.
- **Do** reach for a `Badge` / `Banner` / `Card` variant to get a hue, so the plate and its text arrive as a matched pair — and pick the variant _family_ deliberately: semantic variants are loud saturated fills, categorical variants are quiet pastel plates.
- **Do** fill a full-measure status surface with the hue's `-muted` well and spend the hue on the icon, the copy, and the action. A chip plate stretched to a region is a slab.
- **Do** put body copy on `text-base` (16px) and metadata on `text-sm` (13px), and escalate through weight and opacity.
- **Do** reach for `text-secondary` when copy needs to recede; it is a designed tone with AAA margin in light. If an opacity step is unavoidable, `/70` is the lowest rung that clears AA in both modes.
- **Do** keep `'Golos Text'` directly behind `'Albert Sans'` in every font stack. It is the Cyrillic half, not a fallback, and `baseLocale` is `ru`.
- **Do** define all seven states — default, hover, focus-visible, active, disabled, loading, error — for every interactive component, and say explicitly when one does not apply.
- **Do** state keyboard, pointer, and touch behavior for every interactive component, along with its long-content, overflow, and empty-state handling.
- **Do** give every pane `overflow-hidden`, its own `overflow-y-auto` scroll region, and `min-h-0` through its flex chain.
- **Do** share `TRANSCRIPT_MEASURE` between the transcript, its skeleton, and the composer.
- **Do** guard every transition and animation with `motion-reduce:`.

### Don't:

- **Don't** assume Tailwind's default scales. `text-sm` is 13px, `text-base` is 16px, `rounded-md` is 10px, `rounded-lg` is 13px, and `rounded-xl` is 18px in this project. `text-base` matching Tailwind's 16px is a coincidence, not a pattern.
- **Don't** introduce a size below 12px, and don't reach for `text-2xs`, `text-3xs`, or `text-4xs` expecting a smaller step — the theme clamps all of them to the floor.
- **Don't** name a font family in the theme without an `@font-face` for it in `src/fonts/fonts.css`. This has now gone wrong three times.
- **Don't** put a generic fallback ahead of `'Golos Text'` in a font stack, and don't remove it. Russian returns to the system UI stack silently, and nothing fails.
- **Don't** ship an interactive component without a visible focus-visible state, and don't express focus with color alone.
- **Don't** write `border-border/60`. The border token is opaque in light mode and the modifier thins it to roughly 1.06:1 against a white pane. Use `border-border`.
- **Don't** rely on `bg-muted` to recess against the canvas. In light it is the canvas value and paints nothing; in dark it is a step above the canvas and raises. It only recesses inside a pane.
- **Don't** assume a raised surface reads as raised in dark mode without a shadow. Card, popover, and muted are all `#1b1b1b` there, so only the inset rim separates one from another.
- **Don't** hand-roll a pane. Use `AppPane`, so the fill, the radius, the lift, the scroll containment, and the phone-width full-bleed arrive together and stay in one file.
- **Don't** give a pane a border. It already carries a shadow, and an outline on top of that reads as a card drawn on a card.
- **Don't** put a hairline between two panes. The gutter is the separation there; a rule as well says the same thing twice.
- **Don't** let a theme collapse `background-surface` into `background-body`. Every pane in the app goes invisible at once, and there is no longer an automated check that would tell you.
- **Don't** add ad hoc `shadow-*` in component code beyond the bridge names. Shadows are theme tokens applied by Astryx `Card`, `Popover`, and `Dialog`, and by `AppPane` for the one pane elevation.
- **Don't** tint a structural surface. The spine is chroma 0 and the whole color system depends on hue meaning something. The accent is the one sanctioned hue and it belongs on deliberate accent objects, not on containers, dividers, or backgrounds that want to look branded.
- **Don't** give `--color-accent` and `--color-text-accent` different values. The bridge's alias is overwritten by the theme, so they collapse to one token and `ring-accent` silently ships at the fill value. Keep them byte-identical; put a too-bright brand color on a component override.
- **Don't** put `#63fe13` on text, a border, or a focus ring in light mode. It is 1.34:1 against white — not low-contrast, invisible.
- **Don't** put `text-white` on the primary button. Its label is locked `#171717` in both modes.
- **Don't** use an accent-green surface to mean "success". The accent and the success green are now the closest pair in the palette; status meaning comes from a `Badge`, `Banner`, or `StatusDot` variant.
- **Don't** put `text-primary` on a categorical plate. Use the hue's `*-vivid` token, or the component variant that binds it.
- **Don't** swap the two reds. `#a50c25` is a text tone and `#e33f4a` is a fill; each fails at the other's job.
- **Don't** flatten a dark-mode categorical background to a solid hex. It is an alpha overlay so it can composite onto the canvas, a pane, or a popover.
- **Don't** hardcode a hex. The only exceptions are the three platform brand colors in `src/entities/channel/lib/platform.ts`.
- **Don't** use uppercase or all-caps labels. Labels are sentence case throughout.
- **Don't** nest a Card in a Card, or put a Card inside a shell pane. The pane is already the raised object; a card on it is a second elevation competing with the first.
- **Don't** card-wrap dense list rows. Conversations are transparent rows in a scrollable list; records are ruled rows in a `divide-y border-y` group.
- **Don't** change the box metrics of anything inside the transcript for cosmetic reasons — the list measures row heights for scroll anchoring, so a border or type-size change on a bubble or date separator perturbs the pin. Restyle with color.
- **Don't** add a decorative background. `src/styles.css` has no pattern, gradient, or texture, and the auth screens do not want one.
- **Don't** add a top bar. Identity, navigation, notifications, and the account live in the rail; color mode and language live in Settings under Appearance; every page owns its own title. Breadcrumbs restating the nav selection two rows away are duplication, not wayfinding.
- **Don't** redirect on a failed query. Render the error with a retry — a failed check is not a known-empty result.
- **Don't** cite a verification command for anything in this document. None exists; `package.json` is the complete list of what can be run.

## Quality Gates

These govern this document, not the product. A section that fails one of them
is wrong even if everything it says is true.

1. **Every non-negotiable rule must use "must".** Every recommendation should use "should". A rule that uses neither is not a rule.
2. **Every accessibility rule must be testable in implementation.** If a criterion cannot be checked by one person in a browser in under a minute, rewrite it until it can — or state plainly that it cannot be checked and why.
3. **Every component rule must name its tokens**, never a hex, a px, or a ms. A value written literally here will drift from the theme and nothing will notice.
4. **Every claim about the current code must name the file that holds it.** "The theme clamps four steps" is unverifiable; "`neutralTheme.ts` clamps `--font-size-xs` and below" is one open-file away from checked.
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
- [ ] The cascade-layer order in `src/styles.css` is unchanged.

**Type**

- [ ] Body copy is `text-base`, metadata is `text-sm`. No new `text-xs` without a stated reason.
- [ ] Hierarchy escalates by weight and opacity, not by a third size.
- [ ] Labels are sentence case.

**Color and contrast**

- [ ] Text reaches 4.5:1 on every surface it lands on, in both modes.
- [ ] Any opacity step on `text-primary` is `/70` or higher.
- [ ] Categorical plates carry their `*-vivid` text; semantic fills carry their paired label.
- [ ] No structural surface is tinted.
- [ ] Nothing conveys state by color alone.

**States**

- [ ] All seven states defined, or explicitly marked not-applicable.
- [ ] Focus-visible is present and legible over default, hover, and selected.
- [ ] Hover is scoped so it cannot override selection.
- [ ] Loading keeps the label; disabled comes from the form.

**Layout**

- [ ] Panes come from `AppPane`; the seam is the gutter, not a border.
- [ ] Every pane has `overflow-hidden`, its own `overflow-y-auto`, and `min-h-0` through the flex chain.
- [ ] `--color-background-surface` and `--color-background-body` still resolve to different values.
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
