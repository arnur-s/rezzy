---
name: Rezzy
description: Multi-workspace customer inbox and CRM for sales and account management teams
colors:
  signal-blue: 'oklch(62.04% 0.195 253.83)'
  ash-canvas: 'oklch(97.02% 0 0)'
  clean-sheet: 'oklch(100% 0 0)'
  graphite-text: 'oklch(21.03% 0.0059 285.89)'
  slate-muted: 'oklch(55.17% 0.0138 285.94)'
  hairline: 'oklch(90% 0.004 286.32)'
  midnight-ink: 'oklch(12% 0.005 285.823)'
  charcoal-surface: 'oklch(21.03% 0.0059 285.89)'
  dusk-border: 'oklch(28% 0.006 286.033)'
  meadow-green: 'oklch(73.29% 0.1935 150.81)'
  warm-amber: 'oklch(78.19% 0.1585 72.33)'
  coral-alert: 'oklch(65.32% 0.2328 25.74)'
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
    backgroundColor: '{colors.signal-blue}'
    textColor: 'oklch(99.11% 0 0)'
    rounded: '{rounded.md}'
    padding: '8px 20px'
  button-primary-hover:
    backgroundColor: 'oklch(57% 0.18 253.83)'
    textColor: 'oklch(99.11% 0 0)'
    rounded: '{rounded.md}'
    padding: '8px 20px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.graphite-text}'
    rounded: '{rounded.md}'
    padding: '8px 20px'
  button-ghost-hover:
    backgroundColor: 'color-mix(in oklab, {colors.signal-blue} 10%, transparent)'
    textColor: '{colors.signal-blue}'
    rounded: '{rounded.md}'
    padding: '8px 20px'
  nav-item:
    backgroundColor: 'transparent'
    textColor: 'color-mix(in oklab, {colors.graphite-text} 60%, transparent)'
    rounded: '{rounded.md}'
    padding: '8px 12px'
  nav-item-active:
    backgroundColor: 'color-mix(in oklab, {colors.signal-blue} 12%, transparent)'
    textColor: '{colors.signal-blue}'
    rounded: '{rounded.md}'
    padding: '8px 12px'
  input-default:
    backgroundColor: 'oklch(95.24% 0.0013 286.37)'
    textColor: '{colors.graphite-text}'
    rounded: '{rounded.lg}'
    padding: '8px 12px'
---

# Design System: Rezzy

## 1. Overview

**Creative North Star: "The Calm Operator"**

Rezzy is designed for the rhythm of sustained professional work. Sales reps and account managers open this tool to scan new messages, reply to leads, check contact history, and move on. The interface should feel like a well-organized desk: everything findable, nothing asserting itself. The UI does not perform — it performs for you.

The system is fully adaptive between light and dark modes, driven by the user's OS preference with manual override. In light mode, the palette is ash-and-white with ambient shadow giving depth to cards and panels. In dark mode, everything flattens: midnight ink backgrounds, tonal steps replacing shadows, the same Signal Blue accent unchanged between both. Both modes share the same restraint. Neither mode is the default because neither use-case is assumed.

Color is rationed. Signal Blue is the only expressive color in the system. It marks where to act — active navigation, unread counts, primary buttons. Every other pixel is neutral infrastructure. This restraint is not minimalism for its own sake; it's operational clarity. When Signal Blue appears, it means something.

**Key Characteristics:**

- System-adaptive theming: full light and dark support with shared token vocabulary
- Restrained accent: Signal Blue occupies at most 10% of any given surface
- Tonal elevation: light mode uses ambient shadow; dark mode uses flat tonal layering
- Work-dense scale: 14px body, 12px labels, no display sizes — this is a tool, not a brochure
- System typography: no loaded typeface; the interface defers to the OS font
- Ambient effect reserved: the dot-grid radial background appears only on auth and onboarding screens

## 2. Colors: The Signal Palette

One expressive color, carefully placed. The rest is neutral infrastructure.

### Primary

- **Signal Blue** (`oklch(62.04% 0.195 253.83)`): The sole action color. Used in active navigation highlights, unread count chips, primary buttons, focus rings, and the brand mark. Never decorative. When Signal Blue appears, it denotes a state the user should act on or has acted on.

### Neutral (Light Mode)

- **Ash Canvas** (`oklch(97.02% 0 0)`): Page background in light mode. The working surface behind all panels and cards.
- **Clean Sheet** (`oklch(100% 0 0)`): Card and surface backgrounds. The layer above the canvas.
- **Graphite Text** (`oklch(21.03% 0.0059 285.89)`): Primary text and icons. Carries a faint blue-purple tint; warm enough to read, cool enough to recede.
- **Slate Muted** (`oklch(55.17% 0.0138 285.94)`): Secondary text, timestamps, metadata, placeholder text. Always supporting, never leading.
- **Hairline** (`oklch(90% 0.004 286.32)`): Borders, dividers, and separators. Visible enough to structure, invisible enough to not distract.

### Neutral (Dark Mode)

- **Midnight Ink** (`oklch(12% 0.005 285.823)`): Page background in dark mode. Near-black with a whisper of blue-indigo.
- **Charcoal Surface** (`oklch(21.03% 0.0059 285.89)`): Card and surface backgrounds in dark mode. The tonal step above Midnight Ink.
- **Dusk Border** (`oklch(28% 0.006 286.033)`): Borders and dividers in dark mode.

### Tertiary (Status)

- **Meadow Green** (`oklch(73.29% 0.1935 150.81)`): Success states, resolved conversation indicators.
- **Warm Amber** (`oklch(78.19% 0.1585 72.33)`): Warning states.
- **Coral Alert** (`oklch(65.32% 0.2328 25.74)`): Error states, form validation, danger actions.

### Named Rules

**The Signal Rule.** Signal Blue is used on at most 10% of any given screen. Its rarity is the point. When it appears in an unread chip or an active nav item, it draws the eye precisely. Dilute it and you lose that signal entirely.

**The Mode Split Rule.** Light mode and dark mode are not the same theme inverted. Light mode uses ambient shadow for elevation; dark mode uses tonal layering. Never apply `shadow-*` unconditionally. Trust the `--surface-shadow` token to resolve to the correct value per theme.

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

The elevation system is theme-split by design. Light mode relies on a three-layer ambient shadow to separate surfaces from backgrounds. Dark mode eliminates shadows entirely and expresses depth through tonal steps — Midnight Ink to Charcoal Surface creates the same spatial relationship that shadow creates in light mode.

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

- **Shape:** Gently curved (8px radius, via `--radius`)
- **Primary:** Signal Blue fill, snow text. Height 40px, padding 0 20px. `transition-colors` at 150ms ease-out. Hover reduces opacity slightly; active scales to 0.98.
- **Ghost:** Transparent background, graphite text. On hover: 10% Signal Blue tint background, Signal Blue text. Same radius and height as primary.
- **Focus:** 2px offset ring in Signal Blue (`box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--accent)`).
- **Loading:** Spinner (Lucide-equivalent, 16px) prepended; label and spinner visible simultaneously.

### Navigation Items

The sidebar is the product's spine. Navigation items carry the entire wayfinding system.

- **Shape:** Rounded (8px), full-width
- **Padding:** 8px vertical, 12px horizontal
- **Typography:** 14px / 500 weight
- **Inactive:** Foreground text at 60% opacity, transparent background. Hover: 8% Signal Blue tint bg, Signal Blue text.
- **Active:** 12% Signal Blue tint background, Signal Blue text. Persists until route changes.
- **Icons:** 16px Lucide icons, `shrink-0`. Gap of 10px between icon and label.
- **Collapsed state (64px sidebar):** Icon only, centered, tooltips on hover with 300ms delay.
- **Focus:** 2px ring in `--focus` (Signal Blue).

### Inputs and Fields

Softly contained, focus-responsive.

- **Shape:** More rounded than buttons (12px via `--field-radius`), matching the softer role of a form field
- **Background:** Surface-secondary (`oklch(95.24% 0.0013 286.37)`), no border at rest
- **Prefix/Suffix:** Icon prefixes at 16px Lucide, 60% opacity. Action suffixes (reveal, copy) use the same 16px sizing and respond to hover.
- **Focus:** Border-color shifts to Signal Blue; 2px ring in Signal Blue at 20% opacity around the group.
- **Error:** Field border becomes Coral Alert; error message appears below in 12px label size.
- **Disabled:** 50% opacity on the entire field group.

### Cards

Cards appear in the dashboard workspace grid and in overlaid form sheets.

- **Shape:** 8px radius (matching `--radius`)
- **Background:** Clean Sheet (light) / Charcoal Surface (dark)
- **Shadow:** Surface shadow in light; flat in dark (token-driven)
- **Border:** Hairline (`oklch(90% 0.004 286.32)` in light; none in dark by default)
- **Padding:** 24px internal (via Card.Header/Content/Footer structure)
- **Hover:** Transitions to `shadow-md`. The card rises slightly.
- **Prohibition:** No nested cards. A Card inside a Card is never correct.

### Chips

Used exclusively for unread message counts and conversation status indicators.

- **Unread (filled):** Signal Blue background, snow text, 18px height, min-width 16px, px-1, fully rounded. 10px / 600 weight, tabular-nums. Caps at "99+" when `capAt99` is enabled.
- **Status (flat):** Transparent background, graphite text, no border, no shadow. Used when a conversation row is already active (selected state).
- **Status labels (ConversationStatusChip):** Color-coded per status. 12px, pill shape.

### Conversation List Items

The most-read surface in the application.

- **Layout:** Icon (36px, rounded-xl platform avatar) + text body in a row. No card wrapping — items are direct children of a scrollable list.
- **Typography:** Contact name at 14px / 600 weight (unread) or 500 (read). Preview at 12px, foreground at 80% (unread) or 55% (read). Timestamp at 11px / foreground at 50%.
- **Unread state:** Name becomes semibold, preview text brightens, NumericUnreadChip appears in the trailing position.
- **Active state:** Background tint (sidebar-accent); unread chip hides (count resets visually to 0).
- **Hover/focus:** Implicit through list container's selection styles.

### Sidebar

The structural container for navigation.

- **Width:** 260px expanded, 64px collapsed. Width transition at 200ms ease-out.
- **Background:** Surface (light: white; dark: charcoal)
- **Right border:** Hairline at 60% opacity
- **Header:** 64px tall, 16px padding. Brand mark: 32px square, Signal Blue background, rounded-lg, white initial letter. Label at 14px / 600.
- **Workspace switcher:** Dropdown trigger with WorkspaceMark icon, workspace name, and chevron. Sits in its own section with a separator below.
- **Footer:** Sign-out action, below a separator. Ghost button style.

### Ambient Background (Auth Only)

Used exclusively on sign-in and sign-up screens. Prohibited in the authenticated product shell.

Two `::before` / `::after` pseudo-elements on `.ambient`:

1. Radial gradient from Signal Blue (18% opacity) at top center, fading to transparent at 34rem
2. Dot grid (1.6rem cells, 1px dots in hairline color at 70% opacity), radially masked at 22% opacity

## 6. Do's and Don'ts

### Do:

- **Do** reserve Signal Blue for interactive signals: unread counts, active navigation, primary actions. Nowhere else.
- **Do** use `color-mix(in oklab, var(--accent) 12%, transparent)` for active nav background tints.
- **Do** express dark-mode elevation through tonal steps (Midnight Ink → Charcoal Surface), never through shadow.
- **Do** use OKLCH for all color declarations; never hardcode hex equivalents alongside token references.
- **Do** use HeroUI's token vocabulary (`--accent`, `--surface`, `--foreground`, `--border`) rather than custom properties that shadow them.
- **Do** use the `ambient` class pattern only on authentication and onboarding screens.
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
- **Don't** nest HeroUI Cards. A `Card` inside another `Card` is always wrong structurally.
- **Don't** load a custom display typeface for branding. The system font is fast, familiar, and correct for this product's register.
- **Don't** use uppercase labels or all-caps text. Labels are sentence case throughout.
