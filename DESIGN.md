---
name: Rezzy
description: Multi-workspace customer inbox and CRM for sales and account-management teams
colors:
  # The neutral theme is the source of truth: src/themes/neutral/neutralTheme.ts,
  # applied at runtime by `<Theme theme={neutralTheme}>` in src/main.tsx. If this
  # block and that file disagree, the theme wins and this is stale.
  #
  # Values below are the LIGHT slot. Unlike the theme this replaced, most tokens
  # here are genuine light/dark pairs rather than one tone playing two roles;
  # the dark partner is named in the Colors prose where it matters.
  #
  # Neutral spine: Tailwind's `neutral` ramp, chroma 0. No hue at all.
  panel-white: '#ffffff' # light pane, card, popover; on-accent label
  canvas-gray: '#f1f1f1' # light canvas — and light `muted`, which is the same value
  rule-gray: '#ebebeb' # light hairline; also the dark-mode accent
  chip-gray: '#e5e5e5' # light neutral chip, gray categorical plate
  border-strong: '#d4d4d4' # emphasized border; switch and progress tracks
  soft-gray: '#a3a3a3' # dark secondary text; light disabled
  mid-gray: '#737373' # light secondary text
  dim-gray: '#525252' # dark disabled
  panel-graphite: '#262626' # light accent; dark pane surface
  canvas-black: '#1b1b1b' # dark canvas — and dark card, popover, and muted
  text-black: '#171717' # light primary text; dark on-accent label
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
  display:
    fontFamily: "'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '2.625rem'
    fontWeight: 400
    lineHeight: 1.2381
  heading:
    fontFamily: "'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '1.5rem'
    fontWeight: 600
    lineHeight: 1.3333
  title:
    fontFamily: "'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 600
    lineHeight: 1.4286
  body:
    fontFamily: "'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.4286
  label:
    fontFamily: "'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1.6667
  code:
    fontFamily: "ui-monospace, 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.4286
rounded:
  none: '0.25rem'
  inner: '0.375rem'
  element: '0.625rem'
  container: '0.75rem'
  page: '1.75rem'
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
    backgroundColor: '{colors.panel-graphite}'
    textColor: '{colors.panel-white}'
    rounded: '{rounded.inner}'
    padding: '8px 12px'
  button-secondary:
    backgroundColor: '{colors.chip-gray}'
    textColor: '{colors.panel-graphite}'
    rounded: '{rounded.inner}'
    padding: '8px 12px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.text-black}'
    rounded: '{rounded.inner}'
    padding: '8px 12px'
  button-ghost-hover:
    backgroundColor: 'color-mix(in srgb, {colors.text-black} 5%, transparent)'
    textColor: '{colors.text-black}'
    rounded: '{rounded.inner}'
    padding: '8px 12px'
  button-destructive:
    backgroundColor: '{colors.red-plate}'
    textColor: '{colors.deep-red}'
    rounded: '{rounded.inner}'
    padding: '8px 12px'
  list-row:
    backgroundColor: 'transparent'
    textColor: '{colors.text-black}'
    rounded: '{rounded.container}'
    padding: '10px 12px'
  list-row-hover:
    backgroundColor: 'color-mix(in srgb, {colors.text-black} 4%, transparent)'
    textColor: '{colors.text-black}'
    rounded: '{rounded.container}'
    padding: '10px 12px'
  list-row-selected:
    backgroundColor: 'color-mix(in srgb, {colors.text-black} 10%, transparent)'
    textColor: '{colors.text-black}'
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
    textColor: '{colors.text-black}'
    rounded: '{rounded.element}'
    padding: '6px 8px'
  card-default:
    backgroundColor: '{colors.panel-white}'
    textColor: '{colors.text-black}'
    rounded: '{rounded.container}'
    padding: '12px'
  message-bubble:
    backgroundColor: 'color-mix(in srgb, #000000 6%, transparent)'
    textColor: '{colors.text-black}'
    rounded: '{rounded.container}'
    padding: '12px'
  pane-header:
    backgroundColor: 'transparent'
    textColor: '{colors.text-black}'
    height: '64px'
    padding: '0 12px'
---

# Design System: Rezzy

## Overview

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
appears, it is the *only* thing on screen carrying meaning. A blue badge is the
single saturated object in a field of gray, and that is the whole point.

Depth changed with it. In light mode the panes still lift by tone: white sheets
on a gray canvas. In dark mode the tones collapse — card, popover, muted, and the
canvas are all `#1b1b1b` — and a pane is instead cut out of the dark by a **1px
inset rim of white at 8-15%** carried inside `--shadow-low/med/high`. That rim,
not the drop shadow, is what gives a panel an edge against a dark field. It is
the most distinctive thing the theme does and the reason for the North Star:
in dark mode the interface is not layered, it is *lit*.

**Key Characteristics:**

- Canvas and panes: the shell is a canvas, each region is an inset pane with a fill, a radius, a gap, and a lift
- Gutter separation: the canvas showing between panes divides regions; hairlines rule only *within* a pane
- Grayscale spine: the entire structure is chroma 0, so any hue on screen is a signal
- Two color languages: pastel plates with same-hue text for categories, saturated opaque fills for status signals
- Lift by tone in light, lift by rim-light in dark — dark mode collapses card/popover/muted onto the canvas
- Two type tiers: 14px body, 12px metadata floor; hierarchy escalates through weight and opacity, never size
- Soft, generous corners: 4 / 6 / 10 / 12 / 28px, with 28px large enough to circle any plate it lands on
- Snappy motion: 125 / 300 / 700ms

### Known drift

The theme was swapped from a bespoke gothic theme to `neutralTheme` in commit
`341a3a2` without a follow-up pass over the surfaces built against the old one.
These are live and load-bearing; each is stated again in the section that owns
it. Nothing here is a style preference — they are places where the code and this
document deliberately disagree, with this document describing the target.

1. **The two type tiers render the same size.** `text-sm` and `text-xs` both
   resolve to 12px. ~160 usages across `src/` need an audit onto the right tier.
   See The Two-Tier Rule.
2. **No webfont loads.** `neutralTheme.ts` named `Figtree`, which has no
   `@font-face` anywhere in the repo. Corrected to Golos Text, which is already
   self-hosted with a Cyrillic subset. See The Cyrillic Coverage Rule.
3. **Plates that were squircles are now circles.** `--radius-page` moved 24px →
   28px, which exceeds half the width of every 36-48px plate that uses
   `rounded-xl`. See The Plate Went Round.
4. **`bg-muted` no longer recesses against the canvas.** It is byte-identical to
   `bg-body` in both modes. It still recesses *inside* a pane. See The Recess Is
   Pane-Relative Rule.
5. **`border-border/60` is close to invisible in light mode.** The `/60` modifier
   was tuned for an alpha border token; the current one is an opaque `#ebebeb`.
   See The Hairline Is Already Thin Rule.
6. **Every verification command this document used to cite is gone.**
   `scripts/` no longer exists, so `pnpm theme:build`, `check:contrast`,
   `check:font-size`, `check:shell-elevation`, and `astryx:font-floor` are not
   runnable. Contrast figures below are computed from the token values rather
   than measured in a browser, and are marked as such.

## Colors

A grayscale structure and a chromatic vocabulary, kept strictly apart. The
neutrals carry every surface, every rule, and every piece of running text; hue
appears only where something needs to be *told* to the user.

### Primary

The accent is not a hue. It is the far end of the neutral ramp, and it inverts
between modes.

- **Panel Graphite** (`#262626`): The accent in light mode (`bg-accent-bg`, `text-accent`) — primary buttons, active nav, links, the workspace mark, focus rings. In dark mode this same value is the *pane surface*, which is the clearest illustration of how far the ramp is reused.
- **Bone** (`#ebebeb`): The dark-mode accent. On any accent fill the label is `text-on-accent` (`#ffffff` light / `#171717` dark), which inverts with it — never a literal tone.

Interactive state is this accent's *text* sibling at low alpha: `bg-primary/4`
(hover), `bg-primary/10` (selected), `bg-primary/5` (quiet plate), where
`bg-primary` bridges to `--color-text-primary`. Those three percentages are the
whole state vocabulary.

### Neutral

Tailwind's `neutral` ramp, chroma 0 throughout. Unlike the theme this replaced,
light and dark are genuine pairs rather than one ramp read backwards, so read
each role as a pair.

- **Panel White** (`#ffffff`) / **Canvas Black** (`#1b1b1b`): The raised surfaces — `bg-card`, `bg-popover`. Note the dark value is *the canvas value*; see Elevation.
- **Canvas Gray** (`#f1f1f1`) / **Canvas Black** (`#1b1b1b`): The canvas — `bg-body`. Also `bg-muted`, at the same hex in both modes.
- **Panel White** (`#ffffff`) / **Panel Graphite** (`#262626`): The pane — `bg-surface`. The one background token that is reliably a step away from the canvas in both modes, which is why the shell is built on it.
- **Text Black** (`#171717`) / **Near White** (`#fafafa`): `text-primary`. Computed 17.9:1 light, 14.5:1 dark against the pane.
- **Mid Gray** (`#737373`) / **Soft Gray** (`#a3a3a3`): `text-secondary` — timestamps, metadata, supporting copy. Computed 4.74:1 light, 5.99:1 dark against the pane. Both clear AA, with light having almost no margin.
- **Soft Gray** (`#a3a3a3`) / **Dim Gray** (`#525252`): `text-disabled`.
- **Rule Gray** (`#ebebeb`) / **White at 10%** (`#FFFFFF1A`): `border-border`. Light is an opaque tone; dark is an alpha wash. That asymmetry is why the `/60` modifier misbehaves — see The Hairline Is Already Thin Rule.
- **Border Strong** (`#d4d4d4`) / **Dim Gray** (`#525252`): `border-border-strong`. Also the switch and progress-bar tracks, where a wash would vanish and a defined channel is wanted.
- **Chip Gray** (`#e5e5e5`) / **White at 10%**: `--color-background-gray`. The secondary button and the neutral badge.

### Secondary (Categorical)

Ten hues placed at evenly-spaced OKLCH positions — red 22, orange 55, yellow 90,
green 144, teal 180, cyan 215, blue 255, purple 320, pink 355, plus a chroma-0
gray. Each ships four tokens, bridged to Tailwind as `*-subtle` (plate),
`*-ring` (border), and `*-vivid` (text); the icon slot uses the vivid color.

**These invert by mode, and that is new.** Light mode is an opaque pastel plate
(T87-T90) carrying deep same-hue text (T30). Dark mode is a *hue-tinted alpha
overlay* — the T70 stop at 24% — carrying light pastel text (T80). The overlay
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
*text and icon*, on a pastel well or on the page. It never fills a large surface.

- **Deep Green** (`#007004`) / **Pastel Green** (`#9fe59b`)
- **Deep Red** (`#a50c25`) / **Pastel Red** (`#ffc6c1`)
- **Deep Amber** (`#745b00`) / **Pastel Amber** (`#fdcf4f`)

Computed against the light pane: 6.33:1, 7.84:1, and 6.48:1 respectively. Against
their own wells: deep red on `#facecb` is 5.51:1. All clear AA with room.

**The signal language** — the saturated opaque fills — is the opposite. These are
mode-locked, high-chroma, and used only where a small object has to *be* the
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
tone in this system is chroma 0. Nothing that is merely *structure* may take a
tint. The corollary is the valuable half: because the field is achromatic, a
single chip is loud without being large, and adding a second decorative hue costs
more here than it would in a tinted system.

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
that is right behind 12px text at 60px wide is a slab at 700px, where it
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

**Body / Interface Font:** Golos Text, falling back to `-apple-system,
BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
**Heading Font:** Golos Text — headings match the body
**Display Font:** Golos Text — display sizes are the same family, larger
**Code Font:** `ui-monospace`, the platform monospace stack. Nothing self-hosted.

Golos Text is **self-hosted**: woff2 subsets live in `src/fonts` and are declared
in `src/fonts/fonts.css`, which `src/styles.css` imports outside every cascade
layer, so the faces are registered before the theme references them by name.
Subsets are split by `unicode-range`, so a browser downloads only what the page
contains — Latin alone is ~37 KB, Latin plus Cyrillic ~59 KB.

**Character:** Golos Text is a Cyrillic-first humanist sans with open apertures
and sturdy, slightly condensed forms, which is what keeps a 12px metadata tier
legible for hours. There is no longer a second voice. The gothic theme reserved a
blackletter display face it never used; the neutral theme has one family doing
every job from 12px to 42px, and the register is carried by the grayscale and the
generous corners rather than by a contrasting typeface.

### Hierarchy

The scale is **base 14, ratio 1.2**, and Astryx rounds each step to a 1/16rem
grid, producing 12 / 14 / 17 / 20 / 24 / 29 / 35 / 42px from `sm` up. Below `sm`
the generated ramp falls to 10 / 8 / 7 / 6px, and the theme clamps all four to
12px.

- **Display** (Golos Text, 400, 2.625rem / 42px, 1.2381 lh): `Text type="display-1"`, plus `display-2` (35px) and `display-3` (29px). No product surface uses these.
- **Heading** (Golos Text, 600, 1.5rem / 24px, 1.3333 lh): Astryx `heading-1`. Theme capacity; the shell has nothing at this scale. `h3` and `h4` are bold (700) rather than semibold, set by `typography.heading.weights`.
- **Title** (Golos Text, 600, 0.875rem / 14px, 1.4286 lh): `text-base font-semibold`. Page titles — the workspace settings `h1`, empty-state headings.
- **Body** (Golos Text, 400-500, 0.875rem / 14px, 1.4286 lh): `text-base`. The intended workhorse: message text, contact names, previews, form content, descriptions. Prose runs inside a `max-w-3xl` measure.
- **Label** (Golos Text, 500, 0.75rem / 12px, 1.6667 lh): `text-sm` and `text-xs`, which are the same size. Timestamps, metadata, chip text, filter labels. Sentence case, always. This is the floor.

### Named Rules

**The Remapped Scale Rule.** Tailwind's size names do not mean their Tailwind
values here. `@astryxdesign/core/tailwind-theme.css` rebinds `--text-*` to the
theme scale, so **`text-base` is 14px, `text-lg` is 17px, and `text-xl` is
20px** — and critically, **`text-sm` is 12px, not 14px**. Never convert a design
spec's px value by assuming Tailwind's defaults. The same bridge rebinds
`--spacing` to `--spacing-1` (4px), so `p-4` is 16px as expected — spacing is
safe, type is not.

**The 12px Floor Rule.** Nothing in this product renders below 12px. 12px is the
bottom of the legible range for interface text, and `baseLocale` is `ru`, whose
diacritics and soft signs are the first things to go as size drops. The generated
scale does not stop there — base 14 at ratio 1.2 produces 10px at `xs` and
continues to 8, 7, and 6px at `2xs`, `3xs`, and `4xs` — so the theme clamps those
four steps to `0.75rem` rather than rescaling, which would move every size in the
system including the display sizes. `sm` already rounds to 12px on its own; the
theme restates it for clarity, but it is those four sub-`sm` steps that are
actually being raised.

Two sizes are outside a token's reach and are floored in
`src/generated/astryx-font-floor.css` instead. Astryx's `Avatar` computes its
initials from the avatar's pixel size (`size * 0.4`) and writes an inline
`--x-fontSize`; `Table`'s sort indicator carries a literal `font-size: 10px`.
Both are raised with `max()`, so larger avatars keep their proportional initials.
The selectors are StyleX atomic hashes read out of the installed package rather
than written by hand — **but the generator that produced that file
(`scripts/font-floor-build.mjs`) no longer exists**, so the file cannot currently
be regenerated after an `@astryxdesign/core` upgrade. Treat it as pinned to
0.1.8.

**The Two-Tier Rule.** The interface has two tiers: **body at `text-base`
(14px)** and **metadata at the 12px floor**. `text-lg` and above are theme
capacity, not shell vocabulary. Escalate through weight (400 → 500 → 600) and
opacity, not through size. Introducing a third size into a shell means the
hierarchy failed at weight first.

*This is the target, not the current state.* The previous theme ran on a 13px
body via `text-sm` and a 12px label via `text-xs`. Under the neutral theme's
floor both resolve to 12px, so ~84 `text-sm` and ~76 `text-xs` usages are now the
same size, the body tier lost a step, and hierarchy is carried entirely by weight
and color. Fixing it means auditing those usages onto the correct tier — body
copy to `text-base`, metadata staying put — not globally find-and-replacing one
for the other.

**The Opacity Step Is Mode-Asymmetric Rule.** `text-primary/55` computes to
4.0:1 in light and 5.4:1 in dark, so an opacity step tuned in one mode can be
under AA in the other. `/70` is the lowest rung that clears both. When copy needs
to recede, prefer `text-secondary`, which is a designed tone rather than an
arithmetic one.

**The Cyrillic Coverage Rule.** Any face that carries interface text must ship a
Cyrillic subset. `baseLocale` is `ru` (`project.inlang/settings.json`), so
Russian is the default experience, not a translation bolted on — a Latin-only
body font leaves the primary locale in the system fallback and styles only the
Latin strings beside it, which reads as two typefaces on one screen. This rule
has now caught two faces: **Fustat**, the gothic theme's original choice, which
ships Arabic and Latin; and **Figtree**, which the neutral theme named on arrival
and which ships Latin and Latin-ext only. Figtree additionally had no
`@font-face` anywhere in the repo, so for a period the entire interface rendered
in the system UI stack. Judge a candidate body face by its `unicode-range`
coverage before its shapes, and confirm the `@font-face` exists — naming a family
in the theme does not load it.

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
(`bg-surface`), the radius (`md:rounded-lg`, 12px), the lift (`md:shadow-sm` →
`--shadow-low`), and the scroll containment. The group is mounted once, in the
shell root, so a route contributes panes and can never forget the inset. The
inbox contributes three sibling panes; a single-pane route contributes one.
`contentPadding={0}` on AppShell is what keeps the two from doubling the seam.

A pane has no padding of its own. Its children — a 64px header, a scroll region,
a composer — each own their insets, and a pane-level pad would double them.
`overflow-hidden` on the pane is structural rather than cosmetic: it is what
clips a child's square corners to the pane's radius, so a header rule or a
selected row stops at the curve instead of poking through it.

Below `md` the frame is dropped entirely. A phone has no room to spend on a
gutter, so panes go full-bleed and the canvas stops being visible — which is why
the radius, the shadow, and the inset are all `md:`-prefixed.

**The pane header contract.** 64px (`h-16`) plus a bottom rule, attached to the
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
`#1b1b1b` / `#262626` in dark — and that difference is the entire reason a pane
reads as an object rather than as more page.

This is worth stating as a constraint rather than a description, because it is
invisible to every cheap check. A theme that collapses the two still renders,
still typechecks, still passes the unit suite; the app just quietly becomes one
flat sheet with unexplained gaps in it. An earlier theme did collapse them and
the shell was rebuilt around hairlines as a result, so this is a live failure
mode rather than a hypothetical one. It used to be asserted against the built
page by `pnpm check:shell-elevation`; **that check no longer exists**, so the
constraint is now enforced by reading alone.

**`bg-surface` is the only background token that behaves in both modes.** The
others collapse in dark:

| token | light | dark |
| --- | --- | --- |
| `bg-surface` | `#ffffff` | `#262626` |
| `bg-body` | `#f1f1f1` | `#1b1b1b` |
| `bg-card` | `#ffffff` | `#1b1b1b` |
| `bg-popover` | `#ffffff` | `#1b1b1b` |
| `bg-muted` | `#f1f1f1` | `#1b1b1b` |

Read that column: in dark mode a card, a popover, the muted well, and the canvas
are one tone. Nothing tonal separates them. What separates them is the rim.

In dark mode `--shadow-low/med/high` each carry a **1px all-around white inset**
at 8% / 12% / 15%, wrapped in `light-dark(transparent, …)` so light mode is
untouched. That inset, not the drop shadow, is what gives a card or a pane an
edge against a dark canvas, where a soft shadow alone reads as nothing. A dark
surface without a shadow token on it has no edge at all.

Inside a pane, depth has **two further moves**, both tonal — and one of them is
weaker than it used to be:

1. **Recess** — `bg-muted` (`#f1f1f1` / `#1b1b1b`). Avatar and platform plates, media wells, skeleton blocks. Reads only against `bg-surface`, never against the canvas, because it is the canvas value.
2. **Raise** — `bg-card` (`#ffffff` / `#1b1b1b`), plus `--shadow-low` where Astryx's `Card` applies it. Auth and onboarding sheets, popovers, dialogs. Light mode raises with tone plus shadow; dark mode raises with the rim alone.

Region boundaries in the authenticated shell are gutters. Hairlines remain for
boundaries *within* a pane.

### Shadow Vocabulary

Shadows are theme tokens applied by Astryx components. Light mode keeps subtle
drops; dark mode deepens them and adds the rim.

- **`--shadow-low`** (`0 2px 4px` + `0 4px 8px`; dark adds `inset 0 0 0 1px` white 8%): Cards, raised sheets, and every `AppPane` via `shadow-sm`.
- **`--shadow-med`** (`0 2px 4px` + `0 4px 12px`; dark rim 12%): Hover and mid-elevation containers, via `shadow-md`.
- **`--shadow-high`** (`0 4px 6px` + `0 12px 24px`; dark rim 15%): Popovers, dropdowns, dialogs, via `shadow-lg`.
- **`--shadow-inset-hover` / `-selected`** (`inset 0 0 0 2px` signal blue at 30% / 50%): Ring-style emphasis where a real border would shift layout.
- **`--shadow-inset-success` / `-warning` / `-error`** (`inset 0 0 0 2px` at 30%): Status rings on fields and cards.

### Named Rules

**The Surface-Above-Canvas Rule.** `bg-surface` must paint something against
`bg-body`. A theme is free to choose the two tones, but not to make them equal:
the shell's entire structure rests on that gap, and collapsing it removes every
region boundary in the app at once.

**The Rim Is The Edge Rule.** In dark mode, elevation is a light effect, not a
tonal one — card, popover, muted, and canvas are all `#1b1b1b`. A surface that
should read as raised must carry a shadow token so it gets the inset rim.
Hand-rolling a "card" with `bg-card` and no shadow produces an invisible
rectangle in dark mode.

**The Recess Is Pane-Relative Rule.** `bg-muted` is byte-identical to `bg-body`
in both modes, so it recesses only *inside* a pane, against `bg-surface`. On the
canvas it paints nothing. Anything that needs to read as recessed must therefore
live inside a pane — which in this shell it always does, but a full-bleed
`bg-muted` region outside one is a no-op, not a subtle effect.

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

**The Hairline Rule.** A rule divides *within* a pane — a header and the body
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

The radius scale is soft and generous throughout, and it got softer with the
theme change — every step moved up, with the largest moving furthest.

- **`--radius-none`** `0.25rem` / 4px — not zero. Even the "square" step is curved.
- **`--radius-inner`** `0.375rem` / 6px — buttons resolve here (`calc(--radius-element - --spacing-1)`).
- **`--radius-element`** `0.625rem` / 10px — fields, badges, small chips.
- **`--radius-container`** `0.75rem` / 12px — panes, list rows, message bubbles, cards, wells.
- **`--radius-page`** `1.75rem` / 28px — avatar and platform plates, media frames, large wells.
- **`--radius-full`** `9999px` — date separators, reaction pills, recording indicators.

**Borders.** One width exists: `--border-width: 1px`. Borders are hairlines that
divide, not outlines that contain.

**Clipping.** `overflow-hidden` on every pane frame is mandatory, so headers and
scroll regions terminate at the pane edge instead of bleeding past it.

### Named Rules

**The Radius-Name Trap.** Tailwind's radius names are rebound to the theme scale
and the mapping is not one-to-one with Tailwind's defaults: **`rounded-sm` = 6px,
`rounded-md` = 10px, `rounded-lg` = 12px, and `rounded-xl` = 28px**. A spec that
says "12px corner" is `rounded-lg` here. `rounded-xl` is more than double
`rounded-lg`, not one step up from it.

**The Plate Went Round.** `--radius-page` moved from 24px to 28px, and 28px
exceeds half the width of every plate that uses it: a `size-9` (36px) plate
clamps to an 18px radius and a `size-12` (48px) plate clamps to 24px — both are
circles. The product's recurring silhouette used to be a squircle: a soft tinted
plate holding a brand glyph, repeated down every list. It is now a circle, and
nobody chose that. Decide deliberately — keep the circle and drop the squircle
language, or move the 36-48px plates to `rounded-lg`/`rounded-xl`-with-an-arbitrary
value to restore it. Note that `rounded-xl` also lands on wide blocks (the
channel-connect help panels), where 28px is a real and visible change from 24px
but not a clamp.

## Components

### Buttons

Resolved and unfussy. State is a tonal shift, never a scale or bounce.

- **Shape:** 6px, resolved as `calc(--radius-element - --spacing-1)` — derived rather than declared, so it tracks the element radius. Padding is 8px block / 12px inline, which computes to a ~36px control at body size.
- **Primary:** Accent fill (`#262626` / `#ebebeb`) with a `text-on-accent` label (`#ffffff` / `#171717`). Inverts with the mode; never a literal tone.
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
- **Typography:** contact name at 600 (unread) or 500 (read); preview at `text-primary/80` (unread) or `text-secondary` (read); timestamp at `text-secondary`. All three currently render at 12px — under The Two-Tier Rule the name and preview belong at `text-base` and the timestamp at the floor.
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
- **Channel status** and **inline metadata chips**: 12px text in a `border border-border rounded-lg px-2 py-1` outline — the one place a full border is correct, because these are small and self-contained rather than large surfaces.
- **Date separators:** `bg-muted text-secondary rounded-full px-2.5 py-0.5 text-xs font-medium`, centered between day groups. `bg-muted` reads here because the transcript is inside a pane, so the pill sits on `bg-surface` and the muted tone is a real step down from it. Restyle with color only; the transcript measures row heights for scroll anchoring, so a border or size change perturbs the pin.

### Inputs and Fields

- **Shape:** 10px (`--radius-element`).
- **State:** Astryx `TextInput` takes a `status` object (`{ type: 'error', message }`) driven from React Hook Form's `fieldState`. Validation copy renders below the field at label size. The theme adds no per-status overrides: `--color-{success,error,warning}` already clear AA non-text 3:1 against both surfaces the border and icon touch — the input surface and the status message bubble — in both modes.
- **Composer field:** transparent and borderless (`bg-transparent shadow-none`, `h-9 min-h-9 resize-none leading-6`). The composer surface *is* the field; a filled input inside it would be a box inside a box.
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

- **Shape:** 12px (`--radius-container`), 12px internal padding via the theme's `card` base (`var(--spacing-3)`). `Section` takes the same padding.
- **Background:** `bg-card` with `--shadow-low`. In light that is white on a gray canvas; in dark the fill matches the canvas exactly and the shadow's inset rim is the only thing drawing the card. A card without its shadow is invisible in dark mode.
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
- **Hand-composed variant:** a 64px `rounded-2xl bg-primary/5 text-primary/40` icon plate, a semibold heading, and a `text-primary/60` description at `max-w-xs`.
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

The theme declares `fast: 125ms`, `medium: 300ms`, `slow: 700ms` at ratio 0.75,
compiled to `--duration-*` tokens with min/max companions (fast 95/125/165,
medium 225/300/400). These are snappier than the theatrical durations the
previous theme carried and match the pace product code was already running at.
Product code mostly uses Tailwind's bare `transition` on hover and selection, and
every custom animation guards `motion-reduce:transition-none` /
`motion-reduce:animate-none`.

The one authored animation is `unread-count-emphasis` in `src/styles.css`: 280ms
on `cubic-bezier(0.16, 1, 0.3, 1)`, scaling 0.92 → 1 and fading 0.55 → 1 from
`transform-origin: left center`, so a count that changes draws the eye without
moving its neighbors. It is disabled under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:

- **Do** treat `src/themes/neutral/neutralTheme.ts` as the source of truth for every token. It is applied at runtime by `<Theme>` in `src/main.tsx`; there is no build step and no compiled `theme.css` to regenerate.
- **Do** add a self-hosted `@font-face` in `src/fonts/fonts.css` for any family the theme names, with the `unicode-range` split intact, and confirm the family ships Cyrillic. Naming a family in the theme does not load it.
- **Do** separate sibling regions with the canvas gutter — compose `AppPane`s and let `AppPaneGroup` own the space between them. Rule *within* a pane with `border-border`.
- **Do** give a surface a shadow token when it should read as raised. In dark mode the inset rim is the only thing distinguishing a card from the canvas.
- **Do** use the Tailwind bridge names (`text-primary`, `text-secondary`, `bg-muted`, `bg-card`, `bg-surface`, `bg-accent-bg`, `text-on-accent`, `border-border`, `text-error`, `bg-blue-subtle`, `text-blue-vivid`) rather than raw `var(--color-*)` in class strings.
- **Do** express state as the accent at low alpha: `bg-primary/4` hover, `bg-primary/10` selected, `bg-primary/5` quiet plate.
- **Do** put `text-on-accent` on any accent fill, so labels invert with their background.
- **Do** reach for a `Badge` / `Banner` / `Card` variant to get a hue, so the plate and its text arrive as a matched pair — and pick the variant *family* deliberately: semantic variants are loud saturated fills, categorical variants are quiet pastel plates.
- **Do** fill a full-measure status surface with the hue's `-muted` well and spend the hue on the icon, the copy, and the action. A chip plate stretched to a region is a slab.
- **Do** put body copy on `text-base` (14px) and metadata on the 12px floor, and escalate through weight and opacity.
- **Do** reach for `text-secondary` when copy needs to recede; it is a designed tone. If an opacity step is unavoidable, `/70` is the lowest rung that clears AA in both modes.
- **Do** give every pane `overflow-hidden`, its own `overflow-y-auto` scroll region, and `min-h-0` through its flex chain.
- **Do** share `TRANSCRIPT_MEASURE` between the transcript, its skeleton, and the composer.
- **Do** honor the 64px `h-16` pane-header contract on every pane that has a header, so the inbox columns align across the gutters between them.
- **Do** guard every transition and animation with `motion-reduce:`.

### Don't:

- **Don't** assume Tailwind's default scales. `text-sm` is 12px, `text-base` is 14px, `rounded-md` is 10px, and `rounded-xl` is 28px in this project.
- **Don't** introduce a size below 12px, and don't reach for `text-2xs`, `text-3xs`, or `text-4xs` expecting a smaller step — the theme clamps all of them to the floor.
- **Don't** write `border-border/60`. The border token is opaque in light mode and the modifier thins it to roughly 1.06:1 against a white pane. Use `border-border`.
- **Don't** rely on `bg-muted` to recess against the canvas. It is the canvas value; it only reads inside a pane.
- **Don't** assume `bg-card` looks like anything in dark mode without a shadow. Card, popover, muted, and body are all `#1b1b1b` there.
- **Don't** hand-roll a pane. Use `AppPane`, so the fill, the radius, the lift, the scroll containment, and the phone-width full-bleed arrive together and stay in one file.
- **Don't** give a pane a border. It already carries a shadow, and an outline on top of that reads as a card drawn on a card.
- **Don't** put a hairline between two panes. The gutter is the separation there; a rule as well says the same thing twice.
- **Don't** let a theme collapse `background-surface` into `background-body`. Every pane in the app goes invisible at once, and there is no longer an automated check that would tell you.
- **Don't** add ad hoc `shadow-*` in component code beyond the bridge names. Shadows are theme tokens applied by Astryx `Card`, `Popover`, and `Dialog`, and by `AppPane` for the one pane elevation.
- **Don't** tint a structural surface. The spine is chroma 0 and the whole color system depends on hue meaning something.
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
- **Don't** cite `pnpm theme:build`, `check:contrast`, `check:font-size`, `check:shell-elevation`, or `astryx:font-floor`. `scripts/` was removed; none of them exist.
