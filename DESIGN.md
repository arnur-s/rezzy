---
name: Rezzy
description: Multi-workspace customer inbox and CRM for sales and account management teams
colors:
  # Values mirror src/styles.css exactly. That file is the source of truth;
  # if the two disagree, styles.css wins and this block is stale.
  # Light mode
  ink-accent: 'oklch(0 0 0)'
  ash-canvas: 'oklch(93.5% 0 0)'
  clean-sheet: 'oklch(100% 0 0)'
  quiet-step: 'oklch(95.24% 0 0)'
  graphite-text: 'oklch(21.03% 0 0)'
  slate-muted: 'oklch(55.17% 0 0)'
  hairline: 'oklch(90% 0 0)'
  # Dark mode
  midnight-ink: 'oklch(12% 0 0)'
  charcoal-surface: 'oklch(21.03% 0 0)'
  charcoal-step: 'oklch(16.5% 0 0)'
  dusk-border: 'oklch(28% 0 0)'
  snow-accent: 'oklch(0.9848 0 0)'
  # Status (shared)
  meadow-green: 'oklch(0.6277 0.1604 153.06)'
  warm-amber: 'oklch(0.8446 0.1525 80.6)'
  coral-alert: 'oklch(0.573 0.2249 21.97)'
typography:
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1.5
  small:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: '0.6875rem'
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 'normal'
rounded:
  sm: '4px'
  md: '8px'
  lg: '12px'
  xl: '16px'
spacing:
  xs: '8px'
  sm: '12px'
  md: '16px'
  lg: '24px'
components:
  button-primary:
    backgroundColor: '{colors.ink-accent}'
    textColor: '{colors.snow-accent}'
    rounded: '{rounded.sm}'
    padding: '8px 20px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.graphite-text}'
    rounded: '{rounded.sm}'
    padding: '8px 20px'
  button-ghost-hover:
    backgroundColor: 'color-mix(in oklab, {colors.ink-accent} 10%, transparent)'
    textColor: '{colors.ink-accent}'
    rounded: '{rounded.sm}'
    padding: '8px 20px'
  nav-item:
    backgroundColor: 'transparent'
    textColor: 'color-mix(in oklab, {colors.graphite-text} 60%, transparent)'
    rounded: '{rounded.md}'
    padding: '8px 12px'
  nav-item-active:
    backgroundColor: 'color-mix(in oklab, {colors.ink-accent} 12%, transparent)'
    textColor: '{colors.ink-accent}'
    rounded: '{rounded.md}'
    padding: '8px 12px'
  workspace-pane:
    backgroundColor: '{colors.clean-sheet}'
    borderColor: 'transparent'
    rounded: '{rounded.lg}'
    padding: '0px'
  input-default:
    backgroundColor: '{colors.quiet-step}'
    textColor: '{colors.graphite-text}'
    rounded: '{rounded.sm}'
    padding: '8px 12px'
---

# Design System: Rezzy

## 1. Overview

**Creative North Star: "The Calm Operator"**

Rezzy is designed for the rhythm of sustained professional work. Sales reps and account managers open this tool to scan new messages, reply to leads, check contact history, and move on. The interface should feel like a well-organized desk: everything findable, nothing asserting itself. The UI does not perform — it performs for you.

The system is fully adaptive between light and dark modes, driven by the user's OS preference with manual override. In light mode, the palette is ash-and-white with shadow giving depth to panes. In dark mode, everything flattens: midnight ink backgrounds and tonal steps replacing shadows. The accent inverts between the two rather than staying fixed, because it is the end of the neutral ramp, not a hue. Both modes share the same restraint. Neither mode is the default because neither use-case is assumed.

Color is not rationed — it is nearly absent. The palette is pure neutral: every grey is zero-chroma, with no blue or purple cast anywhere. The accent is monochrome too — true black in light mode, near-white in dark. It marks where to act — active navigation, unread counts, the selected conversation, primary buttons — and it does so through tone alone. Chroma appears only in the three status colors, where meaning genuinely depends on hue. This is a stronger claim than a restrained palette: nothing on screen competes with the customer's own words.

Structure, not color, carries the hierarchy. The authenticated shell is a base canvas with elevated panes floating on it, and that spatial relationship does the work an accent color would otherwise be asked to do.

**Key Characteristics:**

- System-adaptive theming: full light and dark support with shared token vocabulary
- Monochrome accent: the interface has no expressive hue outside status colors
- Layered shell: a canvas holds the sidebar; workspace content sits on panes above it
- Tonal elevation: light mode uses shadow; dark mode uses flat tonal layering
- Work-dense scale: 14px body, 12px labels, no display sizes — this is a tool, not a brochure
- System typography: no loaded typeface; the interface defers to the OS font
- Effect reserved: the dot-grid radial background appears only on auth and onboarding screens, never inside the product shell

## 2. Colors: The Monochrome Palette

No expressive color. Tone and structure carry everything except status.

### Accent

- **Ink Accent** (light: `oklch(0 0 0)` / dark: `oklch(0.9848 0 0)`): The sole action color, and it is not a color — it is the far end of the neutral ramp, inverting between modes. Used for active navigation, unread count chips, the selected conversation row, primary buttons, focus rings, outbound message bubbles, and the brand mark. Never decorative.
- **Accent Soft** (`color-mix(in oklab, var(--accent) 15%, transparent)`, via HeroUI's `--accent-soft`): The accent at low opacity. Tints active states on *small controls that sit on a surface* — nav items, filter chips. It is not used for selected list rows; see The Lift-Not-Fill Rule.

### Neutral (Light Mode)

- **Ash Canvas** (`oklch(93.5% 0 0)`): The app canvas. The sidebar and header sit directly on it; panes float above it. Deliberately a full step below Clean Sheet: because panes carry no border, the canvas contrast *is* the pane edge.
- **Clean Sheet** (`oklch(100% 0 0)`): Pane and surface backgrounds. The layer above the canvas.
- **Quiet Step** (`oklch(95.24% 0 0)`, HeroUI's `--surface-secondary`): The recessed step inside a pane — the message transcript, form field fills.
- **Graphite Text** (`oklch(21.03% 0 0)`): Primary text and icons. Zero chroma — no blue-purple cast.
- **Slate Muted** (`oklch(55.17% 0 0)`): Secondary text, timestamps, metadata, placeholder text. Always supporting, never leading.
- **Hairline** (`oklch(90% 0 0)`): Borders, dividers, pane edges. Visible enough to structure, invisible enough to not distract.

### Neutral (Dark Mode)

- **Midnight Ink** (`oklch(12% 0 0)`): The app canvas in dark mode. Pure neutral near-black. Dark mode has no shadow *and* no pane border, so this token carries the entire separation between canvas and pane — it must stay well below Charcoal Surface.
- **Charcoal Surface** (`oklch(21.03% 0 0)`): Pane backgrounds. The tonal step above Midnight Ink that replaces shadow.
- **Charcoal Step** (`oklch(16.5% 0 0)`): The recessed step inside a pane. Sits *below* the pane, matching light mode's direction, so a surface lifted back up inside it (the composer, a selected row) reads as raised in both themes. This overrides HeroUI's default `--surface-secondary`, which sits above `--surface` and inverts the relationship.
- **Dusk Border** (`oklch(28% 0 0)`): Separators *inside* panes only. Never around a pane.

### Tertiary (Status)

The only chroma in the system. Reserved for meaning that cannot be conveyed by tone.

- **Meadow Green** (`oklch(0.6277 0.1604 153.06)`): Success states, resolved conversation indicators.
- **Warm Amber** (`oklch(0.8446 0.1525 80.6)`): Warning states.
- **Coral Alert** (`oklch(0.573 0.2249 21.97)`): Error states, form validation, danger actions, active voice recording.

### Named Rules

**The Monochrome Rule.** There is no brand hue. If a design problem seems to need one, it is a hierarchy problem: solve it with tone, weight, spacing, or elevation. Introducing a chromatic accent would flatten the status colors, which are the only place hue currently means anything.

**The Lift-Not-Fill Rule.** In a monochrome system, tinting a selected row with the accent produces grey — the exact "generic grey block" that reads as disabled rather than chosen. So selection in a list is expressed by *elevation*: the list body is recessed, rows are transparent, and the selected row lifts to `--surface`. Small controls (nav items, filter chips) may still use a low-opacity accent tint, because they sit on a surface rather than in a recessed list.

**The Mode Split Rule.** Light mode and dark mode are not the same theme inverted. Light mode uses shadow for elevation; dark mode uses tonal layering. Never apply `shadow-*` unconditionally. Trust the `--surface-shadow` token to resolve to the correct value per theme — and never delete its dark-mode override, which is what keeps dark surfaces flat.

## 3. Typography

**Body/Interface Font:** System UI (San Francisco on Apple, Segoe UI on Windows, Roboto on Android)

No typeface is loaded. This is a deliberate choice: the interface defers to the user's operating system. It loads faster, feels familiar instantly, and makes no claim to personality through type. The work is the personality.

**Character:** Functional and neutral, with weight contrast carrying all hierarchy. Size differences are modest — the scale is compressed to support information-dense screens.

### Hierarchy

- **Title** (600, 0.875rem / 14px, 1.5 lh): Section headings, card titles, panel headers. Distinction comes from weight only — not from size. Used sparingly.
- **Body** (400, 0.875rem / 14px, 1.5 lh): Conversation previews, contact names, form content, body copy. The workhorse of the interface. Line length capped at 65ch where prose runs long.
- **Label** (500, 0.75rem / 12px, 1.5 lh): Metadata, timestamps, filter labels, form field labels. Uppercase is never used — labels are sentence case.
- **Small** (600, 0.6875rem / 11px, tabular-nums): Unread counts, compact badges, indicator chips. Tabular figures mandatory for numeric content.

### Named Rules

**The No-Display Rule.** There is no display size. No heading exceeds 1.125rem (18px) in the application shell. Page titles, if they exist, use title weight at body size. This is a tool, not a publication.

**The Weight-First Rule.** Hierarchy is expressed through weight contrast (400 → 500 → 600), not through size steps. Don't introduce new font sizes; introduce new font weights.

## 4. Elevation

### The Three Layers

The authenticated shell is three tonal layers. This is the structural backbone of the product and the reason it does not read as one flat sheet.

1. **Canvas** (`--background`) — the base plane. The sidebar and header sit *directly* on it, with no surface of their own and no dividing borders. They belong to the application frame, not to the content.
2. **Pane** (`--surface`) — workspace content floats here: the conversation list, the conversation, the details panel, the dashboard, settings. Panes are separated from the canvas and from each other by an ~8px gap, and they clip their own content.
3. **Recessed** (`--surface-secondary`) — regions *inside* a pane that should sit back: the message transcript, form field fills. Never elevated, never shadowed.

A fourth treatment, **Raised**, is a surface deliberately lifted back up inside a recessed region — the composer, and the selected conversation row.

The layering is theme-split by design. Light mode relies on a three-layer shadow to separate panes from the canvas. Dark mode eliminates shadows entirely and expresses depth through tonal steps — Midnight Ink to Charcoal Surface creates the same spatial relationship that shadow creates in light mode.

### Panes Have No Border

This is the defining rule of the shell. A pane is a rounded, borderless surface; separation comes from the canvas showing through the gap around it, plus the light-mode shadow. Outlining every pane adds a grey line to a system that is already almost entirely grey, and it makes the shell read as a diagram of boxes rather than as depth.

The consequence is that **canvas contrast is load-bearing**. If `--background` drifts too close to `--surface`, pane edges dissolve and the whole structure collapses — particularly in dark mode, where there is no shadow to fall back on. Changing either token means re-checking both themes.

A hairline is correct in two places, and nowhere else. *Between adjacent regions inside a single pane* — a pane header and its body, a filter strip and the list below it; use `paneStyle.separator` there. And *at the sidebar's right edge*, where the rail meets the content area; see "The Rail Edge Rule." Never draw a line around a pane.

### Frame Metrics

- **Outer padding:** 8px around the workspace area (4px on mobile). The panes never touch the browser edge.
- **Gap between panes:** 8px, rendered as a real grid track so it can also carry the list-resize affordance.
- **Pane radius:** 12px (`rounded-xl`), softened to 8px on mobile.
- **Pane clipping:** `overflow-hidden` is mandatory. Pane headers and scroll regions must round with the pane.
- **Scroll ownership:** every pane owns its own scrolling. The workspace area itself never scrolls.

### Shadow Vocabulary (Light Mode Only)

- **Surface** (`0 2px 4px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.06)`): Cards, inline containers at rest. The lightest possible depth signal — barely visible, structurally meaningful.
- **Elevated** (Tailwind `shadow-md`): Cards and interactive containers on hover. Feedback, not drama.
- **Overlay** (`0 2px 8px rgba(0,0,0,0.06), 0 -6px 12px rgba(0,0,0,0.03), 0 14px 28px rgba(0,0,0,0.08)`): Popovers, dropdowns, tooltips, modals. The most prominent shadow in the system and still subtle.

In dark mode, all three resolve to transparent or flat. Surfaces float above backgrounds via tonal step only.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest in dark mode. Shadow appears in light mode as part of the token system, not as an expressive choice per component. If a component looks wrong in dark mode because it relies on shadow for definition, the structure is wrong — use a border or tonal background instead.

## 5. Components

### Buttons

Resolved and unfussy. State changes happen through opacity and tonal shift, not through scale or bounce.

- **Shape:** Tightly curved (4px radius, via `--radius`). Controls are crisp; only the large workspace panes are softly rounded.
- **Primary:** Accent fill, inverted text. Height 40px, padding 0 20px. `transition-colors` at 150ms ease-out. Hover reduces opacity slightly; active scales to 0.98.
- **Ghost:** Transparent background, graphite text. On hover: 10% accent tint background, accent text. Same radius and height as primary.
- **Focus:** 2px offset ring in the accent (`box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--accent)`).
- **Loading:** Spinner (Lucide-equivalent, 16px) prepended; label and spinner visible simultaneously.

### Navigation Items

The sidebar is the product's spine. Navigation items carry the entire wayfinding system.

- **Shape:** Rounded (8px via `rounded-lg`), full-width
- **Padding:** 8px vertical, 12px horizontal
- **Typography:** 14px / 500 weight
- **Inactive:** Foreground text at 60% opacity, transparent background. Hover: 10% accent tint bg, accent text.
- **Active:** 10% accent tint background (15% in dark), accent text. Persists until route changes.
- **Icons:** 16px Lucide icons, `shrink-0`. Gap of 10px between icon and label.
- **Collapsed state (64px sidebar):** Icon only, centered, tooltips on hover with 300ms delay.
- **Focus:** 2px ring in `--focus`.

### Inputs and Fields

Softly contained, focus-responsive.

- **Shape:** 4px via `--field-radius`, matching the button radius. Fields and controls share one crisp corner; the 12px curve is reserved for panes.
- **Background:** Surface-secondary (`oklch(95.24% 0 0)`), no border at rest
- **Prefix/Suffix:** Icon prefixes at 16px Lucide, 60% opacity. Action suffixes (reveal, copy) use the same 16px sizing and respond to hover.
- **Focus:** Border-color shifts to the accent; 2px ring in the accent at 20% opacity around the group.
- **Exception:** a field already sitting on a raised surface (the composer's textarea) goes transparent instead of filled. A filled field inside a raised box is a box inside a box.
- **Error:** Field border becomes Coral Alert; error message appears below in 12px label size.
- **Disabled:** 50% opacity on the entire field group.

### Workspace Panes

The primary structural unit of the authenticated shell. Implemented as `paneStyle` / `WorkspacePane` in `src/components/pane.tsx`.

- **Shape:** 12px radius (`rounded-xl`), 8px on mobile
- **Background:** Clean Sheet (light) / Charcoal Surface (dark)
- **Border:** none, ever. See "Panes Have No Border" above.
- **Shadow:** Surface shadow in light; flat in dark (token-driven, never conditional in component code)
- **Clipping:** `overflow-hidden`, always
- **Padding:** none at the pane level. Padding belongs to the regions inside it, so headers and scroll regions can meet the pane edge.
- **Header:** when present, 64px tall and attached to the pane's top edge with a hairline `border-b`
- **Prohibition:** No nested panes, and no Card inside a pane. The pane *is* the container. If content seems to need its own box, it needs spacing or a recessed background instead.

### Cards

Cards are for the dashboard workspace grid and overlaid form sheets — not for structuring pane content.

- **Shape:** 4px radius (matching `--radius`)
- **Background:** Clean Sheet (light) / Charcoal Surface (dark)
- **Shadow:** Surface shadow in light; flat in dark (token-driven)
- **Border:** Hairline in light; none in dark by default
- **Padding:** 24px internal (via Card.Header/Content/Footer structure)
- **Hover:** Transitions to `shadow-md`. The card rises slightly.
- **Prohibition:** No nested cards. A Card inside a Card is never correct.

### Chips

Used for unread message counts, conversation status, and transcript date separators.

- **Unread (filled):** Accent background, inverted text, 18px height, min-width 16px, px-1, fully rounded. 10px / 600 weight, tabular-nums. Caps at "99+" when `capAt99` is enabled.
- **Status (flat):** Transparent background, graphite text, no border, no shadow. Used when a conversation row is already active (selected state).
- **Status labels (ConversationStatusChip):** Color-coded per status. 12px, pill shape.
- **Date separators:** surface background, muted text, no shadow. Subtle through *color only* — never add a border or change the type size, because the transcript is virtualized and the row's measured height feeds scroll anchoring.

### Conversation List Items

The most-read surface in the application.

- **Layout:** Icon (36px, rounded-xl platform avatar) + text body in a row. No card wrapping — items are direct children of a scrollable list.
- **Typography:** Contact name at 14px / 600 weight (unread) or 500 (read). Preview at 12px, foreground at 80% (unread) or 55% (read). Timestamp at 11px / foreground at 50%.
- **Unread state:** Name becomes semibold, preview text brightens, NumericUnreadChip appears in the trailing position.
- **List body:** recessed, so rows can lift off it. Rows themselves are transparent.
- **Selected:** lifted to `--surface` with the surface shadow — a card raised out of the recessed list. Not a fill; see The Lift-Not-Fill Rule. The unread chip hides (count resets visually to 0).
- **Hover:** `bg-foreground/5`, and only on unselected rows, so hover can never override selection.
- **Focus:** inset 2px ring in `--focus`, so it stays legible on top of either state.

### Composer

A raised work surface inside the conversation pane, not a strip attached to the pane edge.

- **Shape:** 12px radius, no border, surface background, theme-aware shadow
- **Placement:** inside the conversation pane on the transcript's readable column, with margin around it so the recessed transcript shows through on all sides
- **Internal padding:** 8px around the control row
- **Field:** transparent, not filled — the composer surface is the field
- **Focus:** the textarea's own ring is suppressed and the *composer* shows `focus-within`. A full-width field's ring would otherwise outline the whole surface in near-black.
- **Control order:** attach, emoji, then mic-or-send. Send is terminal and set apart by a wider gap; it is the only primary-variant control in the pane.
- **Footnote:** the "replying via {channel}" line sits *outside* the raised surface, centered, in muted 12px.

### Sidebar

The navigation spine, and the only persistent chrome in the shell. There is no
application header: the rail carries identity, navigation, notifications, and
the account, and every page owns its own title.

- **Width:** 260px expanded, 64px collapsed. Width transition at 200ms ease-out.
- **Background:** none — the canvas shows through. The sidebar is never wrapped in a card or given a surface fill.
- **Right edge:** a single hairline divider, supplied by AppShell's `section` variant. See "The Rail Edge Rule."
- **Heading:** the product name as a superheading linking to `/`, above the workspace switcher — one identity block rather than a separate brand row. The switcher keeps its WorkspaceMark icon, workspace name, and chevron.
- **Sections:** area navigation first (Home/Settings off-workspace; Dashboard/Inbox/Settings inside one), then notifications in its own section, because unread spans every workspace rather than describing where you are.
- **Footer:** the account row — avatar, display name, and a trailing `chevrons-up-down`, opening a menu with Profile, Settings, and Sign out. All three are scoped to the person, not the workspace.

### The Rail Edge Rule

The sidebar carries a hairline on its right edge, and it is the one border in
the shell. This is a deliberate exception to "Panes Have No Border," and it
exists because the rail is not a pane: it is the frame the panes sit in.

Draw it with AppShell's `variant="section"`, never with a `border-right` on the
sidebar itself. The variant sources the line from the theme's border token, so
it tracks the palette instead of pinning a colour into component code.

The elevated variant is the alternative and separates nav from content by tone
alone. It is correct only while the canvas and the content surface actually
differ — when a theme resolves both to the same value, `elevated` renders
nothing at all and the shell collapses into one flat sheet. Prefer `section`
unless a theme's tonal step is verified in both modes.

### No Application Header

The shell has no top bar. Everything a header would carry now has a better home:
identity and navigation in the rail, notifications as a rail row with its count
in the trailing slot, the account in the rail footer, and colour mode plus
language in Settings under Appearance.

Page titles live in the page, not in chrome. A route that needs a title renders
its own heading at title weight and body size; full-bleed routes like the inbox
name things in their pane headers and need no page title at all. Breadcrumbs are
not part of the system — a title bar restating the nav selection two rows away
is duplication, not wayfinding.

Below the mobile breakpoint AppShell renders the rail horizontally with a drawer
toggle. That top strip is generated by the shell, not authored — do not add a
TopNav to recreate it.

### Message Transcript

- **Background:** recessed (`--surface-secondary`). Never a pattern, gradient, or dot grid.
- **Measure:** centered, max 820px. Messages must not sprawl across a wide pane. Tailwind's `container` is wrong here — its max-width tracks the breakpoint.
- **Alignment:** the composer and the loading skeleton share the same measure, so all three line up on one axis.

### Background (Auth Only)

Used exclusively on sign-in and sign-up screens. Prohibited in the authenticated product shell.

Two `::before` / `::after` pseudo-elements on `.`:

1. Radial gradient from Signal Blue (18% opacity) at top center, fading to transparent at 34rem
2. Dot grid (1.6rem cells, 1px dots in hairline color at 70% opacity), radially masked at 22% opacity

## 6. Do's and Don'ts

### Do:

- **Do** reserve Signal Blue for interactive signals: unread counts, active navigation, primary actions. Nowhere else.
- **Do** use `color-mix(in oklab, var(--accent) 12%, transparent)` for active nav background tints.
- **Do** express dark-mode elevation through tonal steps (Midnight Ink → Charcoal Surface), never through shadow.
- **Do** use OKLCH for all color declarations; never hardcode hex equivalents alongside token references.
- **Do** use HeroUI's token vocabulary (`--accent`, `--surface`, `--foreground`, `--border`) rather than custom properties that shadow them.
- **Do** use the `` class pattern only on authentication and onboarding screens.
- **Do** keep interface text at 14px or 12px; escalate through weight, not size.
- **Do** use tabular-nums for any numeric content in chips, counts, and timestamps.

### Don't:

- **Don't** build generic SaaS admin layouts: grey table rows, blue primary buttons on white backgrounds, stockphoto sidebar patterns. Rezzy should be immediately distinguishable from the sea of admin templates.
- **Don't** build cluttered enterprise CRM layouts in the style of Salesforce or HubSpot: too many columns, nested panels without clear hierarchy, screens with no discernible primary action.
- **Don't** use gradient text (`background-clip: text` with gradient fill). Emphasis is weight and size, not decoration.
- **Don't** use side-stripe borders (`border-left` or `border-right` greater than 1px as colored accent). Rewrite with full borders, background tints, or nothing.
- **Don't** use glassmorphism decoratively. No blur + transparency cards outside of a purposeful, specific context.
- **Don't** use the hero-metric template: big number, small label, gradient accent. This is an operational tool, not a pitch deck.
- **Don't** apply shadows unconditionally across themes. Dark mode is flat by design; shadow utilities must be theme-aware.
- **Don't** nest HeroUI Cards. A `Card` inside another `Card` is always wrong structurally, and the same holds for a Card inside a workspace pane.
- **Don't** load a custom display typeface for branding. The system font is fast, familiar, and correct for this product's register. `--font-sans` must always resolve to a real stack.
- **Don't** use uppercase labels or all-caps text. Labels are sentence case throughout.
- **Don't** put a decorative pattern behind the product shell. The dot grid, radial gradients, and any texture belong to auth screens only; the transcript and every pane use flat tonal backgrounds.
- **Don't** let panes run edge-to-edge or share a border. If two regions look joined, the gap is missing.
- **Don't** put a border on a pane, a composer, or any other large surface. Lines belong inside panes, not around them.
- **Don't** use a flat neutral fill (`bg-foreground/10`) for a selected list row. Recess the list and lift the row.
- **Don't** change the box metrics of anything inside the virtualized transcript for cosmetic reasons — borders and type-size changes on message rows or date separators perturb scroll anchoring. Restyle with color.
- **Don't** delete the dark-mode `--surface-shadow` / `--overlay-shadow` / `--field-shadow` overrides in `src/styles.css`. Without them HeroUI's defaults apply and dark mode gains shadows the system is designed not to have.
