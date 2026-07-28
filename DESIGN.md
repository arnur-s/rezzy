---
name: Rezzy
description: Multi-workspace customer inbox and CRM for sales and account-management teams
colors:
  # The gothic theme is the source of truth: src/themes/gothic/gothicTheme.ts,
  # compiled to src/themes/gothic/theme.css by `pnpm theme:build`. If this block
  # and that file disagree, the theme wins and this is stale.
  #
  # Every token below is a single tone. Light and dark do not use different
  # palettes — they swap which tone plays which role. See "The Five Tones Rule".
  #
  # Core neutral ramp: H≈210, C=4
  ink: '#101314' # T10 — dark-mode page, light-mode text and accent
  charcoal: '#24292D' # T20 — dark-mode recessed step
  slate: '#495056' # T40 — light-mode secondary text
  fog: '#96A0AB' # T75 — dark-mode secondary text, light-mode disabled
  mist: '#D8E2E9' # light-mode recessed step
  parchment: '#E8F1F6' # T95 — light-mode page, dark-mode text and accent
  vellum: '#FFFFFF' # light-mode raised card and popover
  pitch: '#1a1d20' # dark-mode raised card
  # Neutral chip — the one categorical that flips (secondary button, neutral badge)
  stone-chip: '#d5dee4' # light
  iron-chip: '#3d4248' # dark
  # Status — deep tones on parchment, dusty pastels on ink
  forest-moss: '#406a30' # success, light
  sage-moss: '#b3c79a' # success, dark
  blood-crimson: '#a83658' # error, light
  dusty-rose: '#c6a6a2' # error, dark
  deep-gold: '#7c5a03' # warning, light
  aged-gold: '#d3c490' # warning, dark
  # Categorical chips — single-valued, self-contained plate + same-hue text
  periwinkle-plate: '#a3b5d6'
  periwinkle-vivid: '#1f2c54'
  moss-plate: '#b3c79a'
  moss-vivid: '#244023'
  gold-plate: '#d3c490'
  gold-vivid: '#6c5010'
  rose-plate: '#c6a6a2'
  rose-vivid: '#4a2520'
typography:
  display:
    fontFamily: "'Manufacturing Consent', 'UnifrakturMaguntia', 'Old English Text MT', serif"
    fontSize: '3.8125rem'
    fontWeight: 400
    lineHeight: 1.2459
  heading:
    fontFamily: "'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '1.9375rem'
    fontWeight: 600
    lineHeight: 1.4194
  title:
    fontFamily: "'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '1rem'
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '0.8125rem'
    fontWeight: 400
    lineHeight: 1.5385
  label:
    fontFamily: "'Golos Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1.6
  code:
    fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, Consolas, monospace"
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.5
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
    backgroundColor: '{colors.ink}'
    textColor: '{colors.parchment}'
    rounded: '{rounded.inner}'
    padding: '8px 12px'
  button-secondary:
    backgroundColor: '{colors.stone-chip}'
    textColor: '{colors.charcoal}'
    rounded: '{rounded.inner}'
    padding: '8px 12px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    rounded: '{rounded.inner}'
    padding: '8px 12px'
  button-ghost-hover:
    backgroundColor: 'color-mix(in srgb, {colors.ink} 5%, transparent)'
    textColor: '{colors.ink}'
    rounded: '{rounded.inner}'
    padding: '8px 12px'
  button-destructive:
    backgroundColor: '{colors.blood-crimson}'
    textColor: '{colors.parchment}'
    rounded: '{rounded.inner}'
    padding: '8px 12px'
  list-row:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    rounded: '{rounded.container}'
    padding: '10px 12px'
  list-row-hover:
    backgroundColor: 'color-mix(in srgb, {colors.ink} 4%, transparent)'
    textColor: '{colors.ink}'
    rounded: '{rounded.container}'
    padding: '10px 12px'
  list-row-selected:
    backgroundColor: 'color-mix(in srgb, {colors.ink} 10%, transparent)'
    textColor: '{colors.ink}'
    rounded: '{rounded.container}'
    padding: '10px 12px'
  badge-info:
    backgroundColor: '{colors.periwinkle-plate}'
    textColor: '{colors.periwinkle-vivid}'
    rounded: '{rounded.element}'
    padding: '2px 6px'
  badge-neutral:
    backgroundColor: '{colors.stone-chip}'
    textColor: '{colors.charcoal}'
    rounded: '{rounded.element}'
    padding: '2px 6px'
  input-default:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    rounded: '{rounded.element}'
    padding: '6px 8px'
  card-default:
    backgroundColor: '{colors.vellum}'
    textColor: '{colors.ink}'
    rounded: '{rounded.container}'
    padding: '12px'
  message-bubble:
    backgroundColor: 'color-mix(in srgb, {colors.ink} 10%, transparent)'
    textColor: '{colors.ink}'
    rounded: '{rounded.container}'
    padding: '12px'
  pane-header:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    height: '64px'
    padding: '0 12px'
---

# Design System: Rezzy

## Overview

**Creative North Star: "The Ink Desk"**

Rezzy is a desk with sheets laid on it. The authenticated shell is a canvas, and
each region of the app is an elevated pane inset into it: the conversation list,
the thread, the contact panel, a settings page. What separates two regions is
the canvas showing between them, not a line drawn across them. This is the
product's structural claim, and almost every rule below follows from it.

Hairlines still exist, but they were demoted. A rule now marks a boundary
*inside* a pane — a header from the body that scrolls under it, a row from the
next row. It is no longer what tells you where one region ends and another
begins; the gutter does that. A pane carrying both a shadow and an outline reads
as a card drawn on top of a card, so panes have no border at all.

The palette is a single hue worn thin: five steps of a cool blue-gray (H≈210,
C=4), from parchment `#E8F1F6` to ink `#101314`. Light and dark are not two
palettes but one, with the roles reversed — the tone that writes the text on ink
becomes the page in light mode. Because there is only one hue in the neutrals,
chroma is genuinely informative when it appears: the ten categorical chips are
dusty pastel plates carrying deep same-hue text, and they mark channel, status,
and count. Nothing else is colored.

Type is a two-size instrument. The product runs on 13px body and 12px labels,
with 16px reserved for page titles; hierarchy is carried by weight (400 → 500 →
600), never by scale. 12px is a floor as much as a step: the generated scale
continues down to 10px and below, and the theme clamps every step under it. Held in reserve above all of it, unused by any product
surface, is a blackletter display face — the theme's signature, waiting for a
marketing surface that does not exist yet. The register is calm and worked-in,
not ceremonial: a desk you return to, not a document you admire.

**Key Characteristics:**

- Canvas and panes: the shell is a canvas, each region is an inset pane with a fill, a radius, a gap, and a shadow
- Gutter separation: the canvas showing between panes is what divides regions; hairlines rule only *within* a pane
- One neutral hue: five tones of H≈210 C=4, whose roles invert between light and dark
- Two-size type: 13px body, 12px labels, 16px page titles; weight carries hierarchy
- Chroma is categorical: ten dusty-pastel chip triples, each self-contained with its own text color
- Reserved blackletter: Manufacturing Consent exists at display sizes only and appears on no product surface
- Theatrical motion tokens (150 / 350 / 800ms) against near-instant UI transitions
- Depth has exactly two moves: recess to `bg-muted`, or raise to `bg-card`

## Colors

One neutral hue, ten categorical hues, and a hard rule that the neutrals carry
structure while chroma carries meaning.

### Primary

The accent is not a hue. It is the far end of the neutral ramp, and it inverts
between modes.

- **Ink** (`#101314`, T10): The accent in light mode and the page in dark mode. As accent it takes primary buttons, active nav, links, the workspace mark, focus rings, and text at full strength (`text-primary`, `bg-accent-bg`, `text-accent`).
- **Parchment** (`#E8F1F6`, T95): The mirror. The page in light mode and the accent in dark mode. On an accent fill the label is always `text-on-accent`, which inverts with it — never a literal tone.

Every interactive tint in the product is this accent at low alpha, expressed as
`bg-primary/4` (hover), `bg-primary/10` (selected), `bg-primary/5` (quiet
plates). Those percentages are the whole state vocabulary.

### Neutral

The full ramp, in role order. Light mode and dark mode draw from the same five
tones and reverse their assignments.

- **Ink** (`#101314`) / **Parchment** (`#E8F1F6`): Page and text. `--color-background-body`, `--color-background-surface`, and `--color-text-primary` all resolve to one of these two. The page and the text are the same two values traded back and forth.
- **Slate** (`#495056`, T40) / **Fog** (`#96A0AB`, T75): Secondary text, timestamps, metadata, supporting copy — `text-secondary`. Slate on parchment, Fog on ink. Fog doubles as light mode's disabled tone.
- **Mist** (`#D8E2E9`) / **Charcoal** (`#24292D`): The recessed step — `bg-muted`. Avatar and platform plates, media wells, skeletons. This is the *only* neutral that reads as a step down from the page, so it does all the recessing in the system.
- **Vellum** (`#FFFFFF`) / **Pitch** (`#1a1d20`): The raised step — `bg-card`. Light mode runs out of room above parchment, so it raises with pure white plus a shadow; dark mode stacks a tone upward and needs no shadow. Popovers use Vellum / Charcoal.
- **Border** (`#1013141A` / `#E8F1F61A`): The hairline — the accent at 10% alpha, not a tone of its own. Drawn in product code at `border-border/60`, which lands it near 6% against the page: present enough to divide, quiet enough to disappear when you stop looking for it.

### Secondary (Categorical)

Ten hues, each shipped as a self-contained triple: a dusty pastel plate
(`bg-*-subtle`), a saturated edge (`border-*-ring`), and deep same-hue text
(`text-*-vivid`). They are single-valued — the same chip reads correctly on
parchment and on ink, because it carries its own foreground. The exception is
gray, which flips, because a dark slate plate on parchment would collide with
the ink accent and collapse primary and secondary buttons into each other.

Four are reachable through product components today, via `Badge` and `Card`
variants:

- **Periwinkle Midnight** (plate `#a3b5d6`, text `#1f2c54`): `variant="info"`. Unread counts and the neutral-informational chip.
- **Sage Moss** (plate `#b3c79a`, text `#244023`): `variant="success"`. Resolved conversations, connected channels.
- **Aged Gold** (plate `#d3c490`, text `#6c5010`): `variant="warning"`. Pending and degraded states.
- **Dusty Rose** (plate `#c6a6a2`, text `#4a2520`): `variant="error"`. Failed sends, disconnected channels.

A plate is sized for a chip. `Banner` takes the same four hues but not the same
fill, because it runs the full measure — see The Chip Is Not A Field Rule.

Cyan, orange, pink, purple, teal, and the flipping gray exist in the theme with
full tonal ramps and are available for data visualization and future
categorization. They are capacity, not current vocabulary — reach for one only
when a new dimension of meaning genuinely appears.

### Tertiary (Status)

Distinct from the categorical chips: status tokens are drawn as *text* and as
5–20% tints of themselves (`text-error`, `bg-error/10`), never as opaque plates.
That is why they are the one place the palette carries a light/dark pair — a
tone has to clear 4.5:1 against the page *and* against its own tint.

- **Forest Moss** (`#3a5e2c`) / **Sage Moss** (`#b3c79a`): `--color-success`.
- **Blood Crimson** (`#8d2d4c`) / **Dusty Rose** (`#c6a6a2`): `--color-error`. Form validation, failed sends, destructive fills, live voice recording. Light mode borrows rose-madder T30 rather than the red ramp's deep end, which reads brown.
- **Deep Gold** (`#6c5010`) / **Aged Gold** (`#d3c490`): `--color-warning`.

The `-muted` companions (`--color-success-muted` and friends) are fills only —
status message wells. Dark keeps the opaque pastel; light steps up to T90, where
the hue reads as a soft note on parchment rather than a slab. `Banner` is their
one consumer, and info's pair (`#dde2f1` / `#a3b5d6`) is declared inside the
banner override rather than as a token, since there is no `--color-info` for it
to hang off and nothing else would read it.

### Named Rules

**The Five Tones Rule.** The neutral system is five steps of one hue, and light
mode inverts their roles rather than introducing new values. If a surface seems
to need a sixth neutral, it needs a different layer or a hairline — not a new
tone. Add one and the mode inversion stops being reversible.

**The Status Tone Is Solved, Not Chosen Rule.** The light status tones carry two
constraints that pull against each other: each has to clear 4.5:1 on parchment
*and* stay readable on a 10-12% tint of itself. Solving for a tint alpha the code
does not draw is what made the first pass heavy — it targeted 20%, which appears
nowhere in `src`, and paid about 1.5 tone steps for it, landing all three near
6.5-7.0:1 where an ordinary form error read as a system failure.

Chroma is the other half, and it matters more than lightness once a tone is
composited at 10% alpha. `#8d2d4c` at 10% over parchment lands at C=0.011 against
a page that is itself C=0.012, so the error well came out lavender-gray with no
red in it. A status tint has to out-chroma the page or it is not a status tint.

The three `-muted` wells are matched in lightness (L≈90.5%) so a banner signals
with hue alone. They were not: error sat a full tone step below its siblings,
which is why the same surface shouted in red and whispered in gold.

`pnpm check:contrast` asserts every ratio above and reads the tint alphas out of
`src` rather than assuming them, so a new `bg-error/25` is checked the moment it
is written.

**The Chip Carries Its Own Text Rule.** A categorical plate is never combined
with `text-primary`. Each hue's `-vivid` token is the only correct foreground on
its `-subtle` plate, and the theme's `Card` and `Banner` variants rebind
`--color-text-primary` locally so nested `Text` children inherit it. Use the
variant; do not hand-assemble a plate.

**The Chip Is Not A Field Rule.** A plate is calibrated for chip area. `#b3c79a`
is right behind 12px text at 60px wide and a slab at 700px, where it outshouts
the ink primary button beside it and inverts the page's hierarchy on a message
that is only a confirmation. So a status surface that runs the full measure fills
with the `-muted` well instead, and the hue stays at full strength in the icon,
the copy, and the action — the field goes quiet, the meaning does not. Measured
light: the well lands 1.07–1.46:1 against the page, its copy 6.2–10.5:1 against
the well.

**The Region Rebinds The Neutral Chip Rule.** Inside a status region the neutral
chip becomes that hue's vivid tone, so a secondary `Button` in a banner's
`endContent` arrives as a deep same-hue chip instead of `#d5dee4` — a cool gray
at the same tone as the well it sits on, which is a shape with no affordance.
Rebind `--color-background-gray` / `--color-text-gray` on the region, never the
button; that way the loudest note on a quiet well is the thing to press.

**The Brand-Hex Exception.** Platform brand colors — Telegram `#26A5E4`,
WhatsApp `#25D366`, Instagram `#E1306C`, in `src/entities/channel/lib/platform.ts`
— are the only raw hex values permitted in component code, because they are
other companies' identities and must not drift with the theme. Every other color
comes from a token.

## Typography

**Body / Interface Font:** Golos Text, falling back to `-apple-system,
BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
**Heading Font:** Golos Text — headings match the body; only display sizes differ
**Display Font:** Manufacturing Consent, falling back to UnifrakturMaguntia and
Old English Text MT
**Code Font:** JetBrains Mono, falling back to SF Mono, Monaco, Consolas

Both real families are **self-hosted**: woff2 subsets live in `src/fonts` and are
declared in `src/fonts/fonts.css`, which `src/styles.css` imports outside every
cascade layer. No third-party request, nothing to fetch from a CDN, and the
faces exist before the theme references them by name — the same reasoning that
made the theme ship pre-built CSS instead of injecting styles at runtime. Naming
a family in `gothicTheme.ts` does nothing on its own; the `@font-face` is what
makes it real.

Subsets are split by `unicode-range`, so a browser downloads only what the page
actually contains: Latin alone is ~37 KB, Latin plus Cyrillic ~59 KB, and
Manufacturing Consent's two files are never fetched at all while no surface uses
a display size.

**Character:** Golos Text is a Cyrillic-first humanist sans with open apertures
and sturdy, slightly condensed forms — which is what keeps 13px legible for
hours and gives the interface a worked-in rather than technical register. It
replaced Fustat, the theme's original choice, for the reason recorded in The
Cyrillic Coverage Rule below. Manufacturing Consent is the opposite register
entirely, and that contrast is deliberate: the theme reserves its voice for a
scale the product never uses.

### Hierarchy

The type scale is base 16 with a 1.25 ratio, so the steps run 10 / 13 / 16 / 20
/ 25 / 31 / 39 / 49 / 61px, and the theme clamps the bottom of that ramp to 12px.
The product uses three steps.

- **Display** (Manufacturing Consent, 400, 3.8125rem / 61px, 1.2459 lh): `Text type="display-1"`. Also `display-2` (49px) and `display-3` (39px). **No product surface uses these.** They are theme identity in reserve.
- **Heading** (Golos Text, 600, 1.9375rem / 31px, 1.4194 lh): Astryx `heading-1`. Theme capacity; the shell has nothing at this scale.
- **Title** (Golos Text, 600, 1rem / 16px, 1.5 lh): `text-base font-semibold`. Page titles — the workspace settings `h1`, empty-state headings. The largest type any authenticated screen shows.
- **Subtitle** (Golos Text, 600, 0.8125rem / 13px, 1.5385 lh): `text-sm font-semibold`. Pane header names — the conversation's contact name, the contact panel title. Distinguished from body by weight alone.
- **Body** (Golos Text, 400–500, 0.8125rem / 13px, 1.5385 lh): `text-sm`. The workhorse: message text, contact names, previews, form content, descriptions. Prose runs inside a `max-w-3xl` measure.
- **Label** (Golos Text, 500, 0.75rem / 12px, 1.6 lh): `text-xs`. Timestamps, metadata, chip text, filter labels, kickers. Sentence case, always. This is the smallest type the product renders anywhere — see The 12px Floor Rule.

### Named Rules

**The Remapped Scale Rule.** Tailwind's size names do not mean their Tailwind
values here. `@astryxdesign/core/tailwind-theme.css` rebinds `--text-*` to the
theme scale, so **`text-sm` is 13px, not 14px**. `text-xs` is 12px, which
matches Tailwind's default by coincidence rather than by inheritance: the
generated step is 10.24px and the theme's floor raises it. Never reason about a size from Tailwind's defaults, and never convert a
design spec's px value by assuming the default scale. The same bridge rebinds
`--spacing` to a 4px base, so `p-4` is 16px as expected — spacing is safe,
type is not.

**The 12px Floor Rule.** Nothing in this product renders below 12px. The
generated scale does not stop there — base 16 at ratio 1.25 produces 10.24px at
`xs` and continues to 8.19, 6.55, and 5.24px at `2xs`, `3xs`, and `4xs` — so
the theme clamps all four steps to `0.75rem` rather than rescaling, which would
move the display sizes the blackletter face is tuned for. The four sub-`sm`
steps are therefore one step: that is what makes it a floor and not a scale.

Two sizes are outside a token's reach and are floored in `src/styles.css`
instead. Astryx's `Avatar` computes its initials from the avatar's pixel size
(`size * 0.4`) and writes an inline `--x-fontSize`, which drew the account row's
`xsm` avatar at 8px; `Table`'s sort indicator carries a literal
`font-size: 10px`. Both use `max()`, so larger avatars keep their proportional
initials and only the ones below the floor are lifted.

`pnpm check:font-size` measures the rendered result on every route in both
locales, both modes, and both widths, which is the only check that can see a
size hardcoded inside a dependency.

**The Two-Size Rule.** The interface runs on `text-sm` and `text-xs`. `text-base`
is for page titles. Escalate through weight (400 → 500 → 600) and opacity
(`text-primary/55` → `/80` → full), not through size. Introducing a fourth size
into a shell means the hierarchy failed at weight first.

**The Blackletter Reserve Rule.** Manufacturing Consent is bound to `display-1`,
`display-2`, and `display-3` and nowhere else. It does not go on a page title, a
pane header, or the brand mark. It is legible at 61px and illegible as UI, and
holding it back is what keeps it available for a marketing surface later. It is
Latin-only, which is acceptable *because* it is reserved — a display face that
never renders product copy never meets a Cyrillic string.

**The Cyrillic Coverage Rule.** Any face that carries interface text must ship a
Cyrillic subset. `baseLocale` is `ru` (`project.inlang/settings.json`), so
Russian is the default experience, not a translation bolted on — a Latin-only
body font leaves the primary locale in the system fallback and styles only the
Latin strings beside it, which reads as two typefaces on one screen. This is why
the theme's original choice, Fustat, could not stay: it ships Arabic and Latin
and no Cyrillic. Judge a candidate body face by its `unicode-range` coverage
before its shapes.

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
group is the canvas and owns the gutter (`md:gap-2 md:p-2`, an 8px seam); the
pane carries the fill, the radius, the lift, and the scroll containment. The
group is mounted once, in the shell root, so a route contributes panes and can
never forget the inset. The inbox contributes three sibling panes; a
single-pane route contributes one. `contentPadding={0}` on AppShell is what
keeps the two from doubling the seam.

A pane has no padding of its own. Its children — a 64px header, a scroll
region, a composer — each own their insets, and a pane-level pad would double
them. `overflow-hidden` on the pane is structural rather than cosmetic: it is
what clips a child's square corners to the pane's radius, so a header rule or a
selected row stops at the curve instead of poking through it.

Below `md` the frame is dropped entirely. A phone has no room to spend on a
gutter, so panes go full-bleed and the canvas stops being visible — which is why
the radius, the shadow, and the inset are all `md:`-prefixed.

**The pane header contract.** 64px (`h-16`) plus `border-b border-border/60`,
attached to the pane's top edge. That rule is intra-pane: it separates the fixed
title from the region that scrolls under it, not one pane from the next. The
conversation list, the thread, the contact panel, and workspace settings all
honor those two numbers, which is what makes the inbox columns line up across
the gutters between them. Horizontal padding is the
pane's own business and varies with what the header holds — the thread runs
`px-3 sm:px-6`, the contact panel `px-4`, the settings column `px-4 sm:px-8`.
Height and the rule are the contract; padding is not.

**Scroll ownership.** Every pane owns its own scroll (`min-h-0 flex-1
overflow-y-auto`). The shell content area never scrolls. The scroll container
spans the pane edge to edge and the reading measure goes on a child, so the
scrollbar rides the pane rather than the text.

**The reading measure.** `mx-auto w-full max-w-3xl` (768px), exported as
`TRANSCRIPT_MEASURE` from
`src/features/inbox/components/message-thread/transcript-measure.ts` and shared
by the transcript, its loading skeleton, and the composer so all three align on
one axis. Settings pages use the same `max-w-3xl` column with `px-4 sm:px-8`.

**Density.** Spacing is a 4px scale (2 / 4 / 6 / 8 / 12 / 16 / 20 / 24 / 28 / 32
/ 36 / 40 / 44 / 48px). Conversation rows are `px-3 py-2.5` with `gap-3` and
`gap-0.5` between rows; nav rows are `px-2 py-2`; settings rows are `py-4`. The
inbox list is user-resizable via `useResizable` (default 320px, min 200, max
480, persisted as `inbox:list-width`) with a `ResizeHandle` in the seam. The
handle runs without `hasDivider`, so it takes zero width and contributes only a
hit area: what the user grabs is the gutter itself. `-mx-1` absorbs the second
gap the group would otherwise put around it, keeping that seam the same width
as every other one.

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
shell or to a wrapper around several panes. A pane that does not carry
`min-h-0` in its flex chain will push its scroll up to an ancestor and take the
whole shell with it.

## Elevation & Depth

The shell's depth is arithmetic before it is styling: **`--color-background-body`
(canvas) and `--color-background-surface` (pane) must resolve to different
values.** Under the neutral theme they do — `#f1f1f1` / `#ffffff` in light,
`#1b1b1b` / `#262626` in dark — and that difference is the entire reason a pane
reads as an object rather than as more page.

This is worth stating as a constraint rather than a description, because it is
invisible to every cheap check. A theme that collapses the two still renders,
still typechecks, still passes the unit suite; the app just quietly becomes one
flat sheet with unexplained gaps in it. `pnpm check:shell-elevation` asserts it
against the built page in both modes, along with the gutter being real space and
the phone breakpoint dropping the frame. An earlier theme did collapse them, and
the shell was rebuilt around hairlines as a result — so this is a live failure
mode, not a hypothetical one.

In dark mode `--shadow-low` also carries a 1px inset rim. That rim, not the drop
shadow, is what gives a pane an edge against a dark canvas, where a soft shadow
alone reads as nothing.

Inside a pane, depth has **two further moves**, both tonal:

1. **Recess** — `bg-muted` (`#D8E2E9` / `#24292D`). Avatar and platform plates, media wells, skeleton blocks, disabled fields. The only neutral that reads below the page.
2. **Raise** — `bg-card` (`#FFFFFF` / `#1a1d20`), plus `--shadow-low` in light mode where Astryx's `Card` applies it. Auth and onboarding sheets, popovers, dialogs. Light mode has exactly one step left above parchment — white — so the tone alone cannot carry the lift and the shadow does the rest; dark stacks a real tone upward and stays flat.

Region boundaries in the authenticated shell are gutters. Hairlines remain for
boundaries *within* a pane.

### Shadow Vocabulary

Shadows are theme tokens applied by Astryx components. Only the color slot
switches per mode; the geometry is shared, because `light-dark()` takes colors
rather than whole shadow lists. Light mode tints with ink at low alpha rather
than black — pure black on parchment reads as dirt.

- **`--shadow-low`** (`0 2px 4px …, 0 4px 8px …`): Cards and raised sheets at rest.
- **`--shadow-med`** (`0 2px 4px …, 0 4px 12px …`): Hover and mid-elevation containers.
- **`--shadow-high`** (`0 4px 6px …, 0 12px 24px …`): Popovers, dropdowns, dialogs.
- **`--shadow-inset-hover` / `-selected`** (`inset 0 0 0 1px|2px …`): Ring-style emphasis where a real border would shift layout.
- **`--shadow-inset-success` / `-warning` / `-error`**: Status rings on fields and cards.

### Named Rules

**The Surface-Above-Canvas Rule.** `bg-surface` must paint something against
`bg-body`. A theme is free to choose the two tones, but not to make them equal:
the shell's entire structure rests on that gap, and collapsing it removes every
region boundary in the app at once. `pnpm check:shell-elevation` enforces this.

**The Gutter Rule.** The canvas showing between panes is what separates regions.
It is owned by `AppPaneGroup` in one place, so the seam is one value everywhere
and a route cannot hand-roll its own. A pane never carries a border: a shadow
and an outline together read as a card drawn on top of a card.

**The Hairline Rule.** `border-border/60` rules *within* a pane — a header and
the body that scrolls under it, a filter strip and its list, one row of a dense
list and the next. It is not used between panes, where the gutter does the work,
and it is never a full outline around a large surface.

**The Shadow-Is-Theme-Only Rule.** Component code carries no ad hoc `shadow-*`
utilities. Shadows live in `--shadow-low/med/high` and are applied by Astryx's
`Card`, `Popover`, and `Dialog`, or by `AppPane`, which maps `shadow-sm` to
`--shadow-low` — one lift, applied in one file, shared by every pane. Two small
exceptions exist and both are decorative detail at small scale: `shadow-xs` on a
reaction pill, `drop-shadow-md` on an image-viewer control. An ad hoc
`shadow-md` on hover is still wrong: the pane vocabulary has exactly one
elevation, and a second one competing with it makes the frame read as unstable.

## Shapes

The radius scale is deliberately soft at the large end and crisp at the small
end, which inverts the usual convention: controls are tightly curved, plates and
media are nearly circular.

- **`--radius-none`** `0.125rem` / 2px — not zero. Even the "square" step has a hint of curve.
- **`--radius-inner`** `0.25rem` / 4px — buttons resolve here (`calc(--radius-element - --spacing-1)`).
- **`--radius-element`** `0.5rem` / 8px — fields, badges, small chips.
- **`--radius-container`** `0.75rem` / 12px — list rows, message bubbles, cards, wells.
- **`--radius-page`** `1.5rem` / 24px — avatar and platform plates, media frames.
- **`--radius-full`** `9999px` — date separators, reaction pills, recording indicators.

**Borders.** One width exists: `--border-width: 1px`. Borders are hairlines that
divide, not outlines that contain. The theme's secondary button sets
`borderWidth: 0` explicitly rather than inheriting an outline.

**Clipping.** `overflow-hidden` on every pane frame is mandatory, so headers and
scroll regions terminate at the pane edge instead of bleeding past it.

### Named Rules

**The Radius-Name Trap.** Tailwind's radius names are rebound to the theme
scale, and the mapping is not one-to-one with Tailwind's defaults:
`rounded-sm` = 4px, `rounded-md` = 8px, `rounded-lg` = 12px, and **`rounded-xl`
= 24px, not 12px**. A spec that says "12px corner" is `rounded-lg` here.
Reaching for `rounded-xl` because it sounds like a slightly-rounder `rounded-lg`
doubles the radius.

**The Squircle Plate.** 36–48px avatar and platform plates take `rounded-xl`
(24px) — at that size the radius consumes most of the square and the plate reads
as a squircle. This is the product's one recurring silhouette: a soft tinted
plate holding a brand glyph, repeated down every list. Keep the pairing (`size-9
rounded-xl` with a 10% brand tint) intact; a smaller radius turns it into a
generic app icon.

## Components

### Buttons

Resolved and unfussy. State is a tonal shift, never a scale or bounce.

- **Shape:** 4px, resolved as `calc(--radius-element - --spacing-1)` — the crispest step in the system, and derived rather than declared, so it tracks the element radius. Padding is 8px block / 12px inline, which computes to a ~36px control at body size.
- **Primary:** Accent fill, `text-on-accent` label — ink-on-parchment in light, parchment-on-ink in dark. Inverts with the mode; never a literal tone.
- **Secondary:** The neutral chip (`--color-background-gray`, `#d5dee4` / `#3d4248`) with `--color-text-gray`, no border. This is the one categorical that flips, precisely so secondary never reads as primary on parchment.
- **Ghost:** Transparent, hover `--color-overlay-hover` (accent at 5%). The default for icon buttons and inline actions.
- **Destructive:** `--color-error` fill with `--color-on-error` — not the red chip's text token, because the fill is a deep crimson in light and a pale dusty rose in dark and only `on-error` inverts with it.
- **Loading:** `isLoading` keeps the label visible alongside the spinner.

### Navigation

The rail is the product's spine and the only persistent chrome.

- **Structure:** `SideNav` with `header`, `collapsible`, and `footer` slots. Collapse state persists to `app:sidebar-collapsed`.
- **Heading:** the wordmark alone, linking to `/`. It is the rail's only identity chrome and the only `text-base` element in it — the workspace no longer shares the row, because a name you switch and a name you cannot are not the same kind of thing. A quiet `bg-primary/5` monogram plate rides beside it, which is also what keeps the header alive collapsed: `SideNavHeading` renders nothing there without an icon.
- **Workspace switcher:** the first row of the nav body rather than part of the heading. Built like the account row in the footer — a ghost `Button` inside a `DropdownMenu`, `px-2` with the label span grown so a trailing `chevrons-up-down` pins to the edge — carrying a `WorkspaceMark` (24px plate, `rounded-md`, accent fill when active and `bg-accent-bg/10` when not) and the workspace name at `font-medium`. Collapsed it becomes an icon-only trigger with a tooltip. The rail's two entity rows, workspace at the top and account at the bottom, share one construction and bracket the navigation between them.
- **Items:** `SideNavItem` with a 16px Lucide icon. Selection is a quiet accent fill; the same grammar as a conversation row.
- **Workspace group:** the selected workspace's destinations sit in a nested `SideNavSection` indented `ml-5` behind a `border-l border-border`, which lands the rule on the workspace mark's own centre axis. The indent is what says the rows belong to that workspace, so the group never repeats the name two rows below the row already showing it — the name goes to the section's hidden group label instead, where a screen reader still gets it. Dropped when collapsed, since there is no text to indent against. The bracket runs at full `border-border` rather than the `/60` the horizontal rules use: the alpha that divides two regions across 244px vanishes over an 80px vertical, so matching the number would not match the weight.
- **Sections:** three regions, two rules. Identity; then the workspace and whatever it contains; then Home and notifications, which span every workspace rather than describing where you are. The rules are `Divider`s inset to `-mx-2 my-1` so they run edge-to-edge across the rail, and they disappear when collapsed, matching the footer.
- **Disabled items:** a locked route (Inbox with no active channel) is `isDisabled` and wrapped in a `Tooltip` that explains why. It only locks once readiness is known false — an unsettled or failed check leaves the item alone rather than flickering on every workspace switch.
- **Footer:** the account row — avatar, display name, trailing `chevrons-up-down`, opening Profile / Settings / Sign out. Styled to read as the last nav row rather than a button: `px-2 font-normal` with the label span grown so the chevron pins to the trailing edge.

### Conversation List Items

The most-read surface in the product.

- **Layout:** a 36px platform plate (`rounded-xl`, 10% brand tint) plus a text body, `gap-3`, `px-3 py-2.5`. Direct children of a scrollable `role="listbox"` with `gap-0.5` — no card wrapping.
- **Typography:** contact name 13px at 600 (unread) or 500 (read); preview 12px at `text-primary/80` (unread) or `text-secondary` (read); timestamp 12px at `text-secondary`.
- **Unread:** name goes semibold, preview brightens, and a `NumericUnreadChip` appears in the trailing position. The chip hides on the selected row — opening a conversation resets its count visually.
- **Selected:** `bg-primary/10` with `text-primary`, via `data-selected="true"`.
- **Hover:** `bg-primary/4`, scoped to `data-[selected=false]` so hover can never override selection.
- **Focus:** `ring-2 ring-accent ring-inset` — inset so it stays legible on top of either state.

### Chips and Badges

- **Unread counts** (`NumericUnreadChip`): Astryx `Badge`, `variant="info"` (periwinkle plate) or `"neutral"`. Caps at `99+` when `capAt99` is set. Wrapped in `role="status"` with a count-aware label.
- **Conversation status** (`ConversationStatusChip`): `Badge` with the variant mapped from the status's semantic color — accent→info, warning→warning, success→success, danger→error, default→neutral.
- **Channel status** and **inline metadata chips**: 12px text in a `border border-border/60 rounded-lg px-2 py-1` outline — the one place a full border is correct, because these are small and self-contained rather than large surfaces.
- **Date separators:** `bg-muted text-secondary rounded-full px-2.5 py-0.5 text-xs font-medium`, centered between day groups. The fill is `bg-muted` and not `bg-surface`: the transcript has no background of its own, so the pill sits directly on the page, and a surface fill would paint the page colour onto the page. Measured in the browser it lands at 1.15:1 against the page in light and 1.27:1 in dark — a soft plate rather than a card. Restyle with colour only; the transcript measures row heights for scroll anchoring, so a border or size change perturbs the pin.

### Inputs and Fields

- **Shape:** 8px (`--radius-element`), set by the theme's `field` override.
- **State:** Astryx `TextInput` takes a `status` object (`{ type: 'error', message }`) driven from React Hook Form's `fieldState`. Validation copy renders below the field at label size.
- **Composer field:** transparent and borderless (`bg-transparent shadow-none`, `h-9 min-h-9 resize-none text-sm leading-6`). The composer surface *is* the field; a filled input inside it would be a box inside a box.
- **Disabled:** driven by the form's `disabled` flag rather than per-field styling, so a submitting form locks uniformly.

### Message Bubbles

Built on Astryx's `Chat` family — `ChatLayout` owns the scroll container and
follow-on-append; `ChatMessage` wraps a same-sender run; `ChatMessageBubble`
draws each bubble.

- **Fill:** `--color-neutral` — the accent at 10% alpha — for **both directions**. Inbound and outbound share one tint. Direction reads from alignment and from the delivery-tick row, not from color. Anything that wants to distinguish them by fill has to introduce a second tint, and that is a system change, not a component tweak.
- **Grouping:** consecutive same-direction messages render as one run with grouped corner radii (`group="first" | "middle" | "last"`). A run shows one timestamp footer; a message carrying state of its own (edited, failed, reactions) always shows its own.
- **Ghost variant:** media-only messages drop the bubble boundary and keep the padding, so the frame is the object.
- **Failed:** the bubble states it — `bg-error/12 ring-1 ring-error/70` — and the caption explains it. The failure never gets a line of its own: `time · ⚠ Not sent · Retry` stays on the single footer row, because a second line sits closer to the next message than to the bubble it describes. The retry is caption-scale and underlined, with padding for a real hit target.
- **Quoted reply:** a 2px `border-current/30` rule with the author at `font-semibold` over the quoted text at 60%, both truncated to one line. Never a plate — the bubble is already the plate, and a fill inside it is a box in a box. The loaded parent outranks the channel's quote payload for author and text, so "Quoted message" only appears when neither is resolvable; without a loaded parent the strip is inert rather than a control that silently does nothing. The composer's reply drawer uses the same rule, on the composer's 12px content column.
- **Action rail:** a reply control parked in the transcript gutter, absolutely positioned outside the bubble, revealed on `group-hover/msg` and `group-focus-within/msg`. Anchored to the first text line (`top-2`) for text and to the middle for media or structured blocks. Zero hit target until engaged; on touch it sits permanently at 60% opacity with an expanded 44px target.

### Cards

Cards are for auth and onboarding sheets and for overlaid forms — not for
structuring shell content.

- **Shape:** 12px (`--radius-container`), 12px internal padding via the theme's `card` base.
- **Background:** `bg-card` (Vellum / Pitch) with `--shadow-low` in light mode.
- **Categorical variants:** `variant="blue"`, `"green"`, and the rest rebind `--color-text-primary` and `--color-text-secondary` locally so nested `Text` children stay readable on the pastel plate.
- **Prohibition:** no nested cards, and no card inside a shell pane. The pane is the container; content that seems to need a box needs spacing, a rule, or a recessed background.

### Ruled Row Groups

The product's answer to "a list of records that is not a conversation" —
channels, members, settings rows. Edge-to-edge rows separated by rules, with the
group closed top and bottom:

```
divide-y divide-border/60 border-y border-border/60
```

Rows are `py-4` with `gap-4`. Empty and error states for the group sit inside the
same `border-y` frame so the group keeps its shape while it has nothing in it.
`SettingRow` is the same idea per-row (`border-t border-border/60
first:border-t-0`): label and description left, the control that changes it
right.

### Empty and Error States

- **In-pane:** Astryx `EmptyState` centered in the pane (`flex h-full items-center justify-center`), with a `title`, optional `description`, a muted Lucide icon at `size-8`, and an action button.
- **Hand-composed variant:** a 64px `rounded-2xl bg-primary/5 text-primary/40` icon plate, a 16px semibold heading, and a 13px `text-primary/60` description at `max-w-xs`.
- **Inline query errors:** `bg-error/10 rounded-lg px-3 py-2` with `text-error` copy and a ghost retry button on the trailing edge. Never a toast for a state the user can retry in place.
- **Blocking errors:** `Banner status="error"` with a title, a description that distinguishes the recoverable case (session expired → sign in) from the generic one, and an action in `endContent`.
- **Banner fill:** the `-muted` well at 8px (`--radius-element`), no border — a status surface at full measure is a tinted field, not a plate and not an outlined box. The icon, the title, the description, and the `endContent` chip all carry the hue's vivid tone, which is the whole of its color weight. All four statuses move together; success is not a special case.
- **Retry semantics:** a failed readiness check renders an error with a retry — it never redirects. A failed check is not the same as a workspace with no channels, and redirecting on failure is what turns a flaky network into a loop between two routes.

### Auth and Onboarding

Outside the shell entirely. `bg-surface md:bg-body` on a `min-h-dvh` centering
wrapper, holding a single `Card` at `maxWidth={448}`. On a phone the wrapper
takes the card's own tone, so the form occupies the page; from `md` up it drops
to the canvas and the card floats on it. That switch was inert for as long as
surface and body resolved to the same value, and it started working again the
day the canvas got its own token — the same arithmetic the shell's panes depend
on, in a place with no panes.

There is **no decorative background**. No dot grid, no radial gradient, no
texture — beyond its imports, `src/styles.css` holds a cascade-layer declaration,
two height rules, and one keyframe animation with its reduced-motion guard. Its
imports are the Tailwind entry points, the Astryx reset and core, the pre-built
gothic theme, the Tailwind token bridge, and `./fonts/fonts.css`. That is the
entire hand-written stylesheet. Do not add a background to it.

### Motion

The theme declares theatrical durations — `fast: 150ms`, `medium: 350ms`,
`slow: 800ms`, ratio 0.75 — compiled to `--duration-*` tokens with min/max
companions. Product code mostly uses Tailwind's bare `transition` on hover and
selection, and every custom animation guards
`motion-reduce:transition-none` / `motion-reduce:animate-none`.

The one authored animation is `unread-count-emphasis` in `src/styles.css`: 280ms
on `cubic-bezier(0.16, 1, 0.3, 1)`, scaling 0.92 → 1 and fading 0.55 → 1 from
`transform-origin: left center`, so a count that changes draws the eye without
moving its neighbors. It is disabled under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:

- **Do** treat `src/themes/gothic/gothicTheme.ts` as the source of truth for every token, and run `pnpm theme:build` after changing it — that regenerates `theme.css`, `gothic.js`, and `gothic.d.ts`, and `main.tsx` imports the built module, so skipping the rebuild leaves the app on the old tokens.
- **Do** add a self-hosted `@font-face` in `src/fonts/fonts.css` for any family the theme names, with the `unicode-range` split intact. Naming a family in the theme does not load it.
- **Do** separate sibling regions with the canvas gutter — compose `AppPane`s and let `AppPaneGroup` own the space between them. Rule *within* a pane with `border-border/60`.
- **Do** recess with `bg-muted` and raise with `bg-card`. Those are the only two tonal moves available.
- **Do** use the Tailwind bridge names (`text-primary`, `text-secondary`, `bg-muted`, `bg-card`, `bg-accent-bg`, `text-on-accent`, `border-border`, `text-error`) rather than raw `var(--color-*)` in class strings.
- **Do** express state as the accent at low alpha: `bg-primary/4` hover, `bg-primary/10` selected, `bg-primary/5` quiet plate.
- **Do** put `text-on-accent` on any accent fill and `--color-on-error` on any error fill, so labels invert with their background.
- **Do** reach for a `Badge` / `Banner` / `Card` variant to get a categorical hue, so the plate and its text arrive as a matched pair.
- **Do** fill a full-measure status surface with the hue's `-muted` well and spend the hue on the icon, the copy, and the action. A chip plate stretched to a region is a slab.
- **Do** keep interface text at `text-sm` (13px) or `text-xs` (12px), and escalate through weight and opacity.
- **Do** reach for `text-secondary` when copy needs to recede. `text-primary/55` is 5.55:1 in dark but 3.97:1 in light, so an opacity step tuned in one mode can be under AA in the other; `/70` is the lowest rung that clears both.
- **Do** give every pane `overflow-hidden`, its own `overflow-y-auto` scroll region, and `min-h-0` through its flex chain.
- **Do** share `TRANSCRIPT_MEASURE` between the transcript, its skeleton, and the composer.
- **Do** honor the 64px `h-16` pane-header contract on every pane that has a header, so the inbox columns align across the gutters between them.
- **Do** guard every transition and animation with `motion-reduce:`.

### Don't:

- **Don't** assume Tailwind's default scales. `text-sm` is 13px and `rounded-xl` is 24px in this project.
- **Don't** introduce a size below 12px, and don't reach for `text-2xs`, `text-3xs`, or `text-4xs` expecting a smaller step — the theme clamps all three to the floor.
- **Don't** hand-roll a pane. Use `AppPane`, so the fill, the radius, the lift, the scroll containment, and the phone-width full-bleed arrive together and stay in one file.
- **Don't** give a pane a border. It already carries a shadow, and an outline on top of that reads as a card drawn on a card.
- **Don't** put a hairline between two panes. The gutter is the separation there; a rule as well says the same thing twice.
- **Don't** let a theme collapse `background-surface` into `background-body`. Every pane in the app goes invisible at once and nothing but `pnpm check:shell-elevation` will tell you.
- **Don't** add ad hoc `shadow-*` in component code. Shadows are theme tokens applied by Astryx `Card`, `Popover`, and `Dialog`, and by `AppPane` for the one pane elevation.
- **Don't** introduce a second neutral tone. The ramp is five steps of one hue and the light/dark inversion depends on that symmetry.
- **Don't** put `text-primary` on a categorical plate. Use the hue's `-vivid` token, or the component variant that binds it.
- **Don't** leave a secondary `Button` on a colored well. The neutral chip is a cool gray at the same tone as the well and reads as a shape, not a control — rebind `--color-background-gray` / `--color-text-gray` on the region so the action takes the hue.
- **Don't** hardcode a hex. The only exceptions are the three platform brand colors in `src/entities/channel/lib/platform.ts`.
- **Don't** put Manufacturing Consent on a product surface. It is bound to `display-1..3` and the shell has nothing at that scale.
- **Don't** use uppercase or all-caps labels. Labels are sentence case throughout.
- **Don't** nest a Card in a Card, or put a Card inside a shell pane. The pane is already the raised object; a card on it is a second elevation competing with the first.
- **Don't** card-wrap dense list rows. Conversations are transparent rows in a scrollable list; records are ruled rows in a `divide-y border-y` group.
- **Don't** change the box metrics of anything inside the transcript for cosmetic reasons — the list measures row heights for scroll anchoring, so a border or type-size change on a bubble or date separator perturbs the pin. Restyle with color.
- **Don't** add a decorative background. `src/styles.css` has no pattern, gradient, or texture, and the auth screens do not want one.
- **Don't** add a top bar. Identity, navigation, notifications, and the account live in the rail; color mode and language live in Settings under Appearance; every page owns its own title. Breadcrumbs restating the nav selection two rows away are duplication, not wayfinding.
- **Don't** redirect on a failed query. Render the error with a retry — a failed check is not a known-empty result.
