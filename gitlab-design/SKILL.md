---
name: gitlab-design
description: Design system skill for gitlab. Activate when building UI components, pages, or any visual elements. Provides exact color tokens, typography scale, spacing grid, component patterns, and craft rules. Read references/DESIGN.md before writing any CSS or JSX.
---

# gitlab Design System

You are building UI for **gitlab**. Dark-themed, cool palette, sans-serif typography (Arial), compact density on a 4px grid.

## Visual Reference

**IMPORTANT**: Study ALL screenshots below before writing any UI. Match colors, typography, spacing, layout, and motion exactly as shown.

### Homepage

![gitlab Homepage](screenshots/homepage.png)

> Read `references/DESIGN.md` for full token details.

## Design Philosophy

- **Layered depth** — use shadow tokens to create a sense of physical layering. Each elevation level has a specific shadow.
- **Gradient accents** — gradients are used thoughtfully for emphasis, not decoration.
- **Type pairing** — Arial for body/UI text, GitLab Sans for headings/display. Never introduce a third typeface.
- **compact density** — 4px base grid. Every dimension is a multiple of 4.
- **cool palette** — the color temperature runs cool, matching the sans-serif typography.
- **Restrained accent** — `#0000ee` is the only pop of color. Used exclusively for CTAs, links, focus rings, and active states.
- **Subtle motion** — transitions smooth state changes. Keep durations under 300ms, use ease-out curves.

## Color System

### Core Palette

| Role | Token | Hex | Use |
|------|-------|-----|-----|
| Background | `--background` | `#171321` | Page/app background |
| Surface | `--surface` | `#333333` | Cards, panels, modals |
| Text Primary | `--text-primary` | `#ffffff` | Headings, body text |
| Text Muted | `--text-muted` | `#74717a` | Captions, placeholders |
| Accent | `--accent` | `#0000ee` | CTAs, links, focus rings |
| Border | `--border` | `#565656` | Dividers, card borders |

### Status Colors

| Status | Hex | Use |
|--------|-----|-----|
| Danger | `#c02f12` | Errors, destructive actions |

### Extended Palette

- `#7759c2`
- `#1f1c2e`
- `#000000` — Deep background layer or shadow color
- `#f2f1f5` — Light surface or highlight color
- `#fc6d26`
- `#1f75cb`
- `#2f5ca0`
- `#468254`

### CSS Variable Tokens

```css
--card-width: calc(33.33333% - 21.33333px);
--card-gap: 32px;
--card-width: calc(50% - 16px);
--card-gap: 16px;
--card-width: 85%;
--card-gap: 16px;
--ci-icon-success-background-color: var(--gl-color-green-100);
--ci-icon-success-icon-background-color: var(--gl-color-green-500);
--ci-icon-warning-background-color: var(--gl-color-orange-100);
--ci-icon-warning-icon-background-color: var(--gl-color-orange-500);
--ci-icon-danger-background-color: var(--gl-color-red-100);
--ci-icon-danger-icon-background-color: var(--gl-color-red-500);
--ci-icon-info-background-color: var(--gl-color-blue-100);
--ci-icon-info-icon-background-color: var(--gl-color-neutral-0);
--ci-icon-neutral-background-color: var(--gl-color-neutral-100);
--ci-icon-neutral-icon-background-color: var(--gl-color-neutral-0);
--timeline-entry-draft-note-background-color: var(--gl-color-orange-50);
--timeline-entry-internal-note-background-color: var(--gl-color-orange-50);
--timeline-entry-target-background-color: var(--gl-color-blue-50);
--find-and-replace-match-background-color: var(--gl-color-orange-100);
```

## Typography

### Font Stack

- **Arial** — Heading 1, Heading 2, Heading 3
- **GitLab Sans** — Body, Caption

### Font Sources

```css
@font-face {
  font-family: "GitLab Sans";
  src: url("https://gitlab.com/fonts/gitlab-sans/GitLabSans.woff2") format("woff2");
  font-weight: 100;
}
```

### Type Scale

| Role | Family | Size | Weight |
|------|--------|------|--------|
| Heading 1 | Arial | 3.125rem | 700 |
| Heading 2 | Arial | 2.5rem | 700 |
| Heading 3 | Arial | 2rem | 700 |
| Body | GitLab Sans | .875rem | 400 |
| Caption | GitLab Sans | 16px | 400 |

### Typography Rules

- Body/UI: **Arial**, Headings: **GitLab Sans** — these are the only display fonts
- Max 3-4 font sizes per screen
- Headings: weight 600-700, body: weight 400
- Use color and opacity for text hierarchy, not additional font sizes
- Line height: 1.5 for body, 1.2 for headings

## Spacing & Layout

### Base Grid: 4px

Every dimension (margin, padding, gap, width, height) must be a multiple of **4px**.

### Spacing Scale

`2, 4, 6, 8, 10, 12, 16, 20, 22, 24, 28, 30` px

### Spacing as Meaning

| Spacing | Use |
|---------|-----|
| 4-8px | Tight: related items (icon + label, avatar + name) |
| 12-16px | Medium: between groups within a section |
| 24-32px | Wide: between distinct sections |
| 48px+ | Vast: major page section breaks |

### Border Radius

Scale: `0px 0px 8px 8px, 0px 0px 2px 2px, 2px, 3px, 8px, 8px 8px 0px 0px, 14px, 16px, unset, 4px, 6px 6px 0px 0px, 17px, 20px, 24px, 28px, 50px, 999px`
Default: `unset`

### Container

Max-width: `1025px`, centered with auto margins.

### Breakpoints

| Name | Value |
|------|-------|
| xs | 320px |
| xs | 375px |
| sm | 500px |
| sm | 546px |
| sm | 576px |
| md | 768px |
| lg | 769px |
| lg | 829px |
| lg | 880px |
| lg | 1024px |
| xl | 1025px |
| xl | 1200px |
| xl | 1220px |
| 2xl | 1300px |
| 2xl | 1440px |
| 2xl | 1550px |

Mobile-first: design for small screens, layer on responsive overrides.

## Component Patterns

### Card

```css
.card {
  background: #333333;
  border: 1px solid #565656;
  border-radius: unset;
  padding: 16px;
  box-shadow: rgb(199, 197, 199) -3px -3px 5px -2px;
}
```

```html
<div class="card">
  <h3>Card Title</h3>
  <p>Card content goes here.</p>
</div>
```

### Button

```css
/* Primary */
.btn-primary {
  background: #0000ee;
  color: #ffffff;
  border-radius: unset;
  padding: 8px 16px;
  font-weight: 500;
  transition: opacity 150ms ease;
}
.btn-primary:hover { opacity: 0.9; }

/* Ghost */
.btn-ghost {
  background: transparent;
  border: 1px solid #565656;
  color: #ffffff;
  border-radius: unset;
  padding: 8px 16px;
}
```

```html
<button class="btn-primary">Get Started</button>
<button class="btn-ghost">Learn More</button>
```

### Input

```css
.input {
  background: #171321;
  border: 1px solid #565656;
  border-radius: unset;
  padding: 8px 12px;
  color: #ffffff;
  font-size: 14px;
}
.input:focus { border-color: #0000ee; outline: none; }
```

```html
<input class="input" type="text" placeholder="Search..." />
```

### Badge / Chip

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  background: #333333;
  color: #74717a;
}
```

```html
<span class="badge">New</span>
<span class="badge">Beta</span>
```

### Modal / Dialog

```css
.modal-backdrop { background: rgba(0, 0, 0, 0.6); }
.modal {
  background: #333333;
  border: 1px solid #565656;
  border-radius: 999px;
  padding: 24px;
  max-width: 480px;
  width: 90vw;
  box-shadow: 0-4px 20px #00000014;
}
```

```html
<div class="modal-backdrop">
  <div class="modal">
    <h2>Dialog Title</h2>
    <p>Dialog content.</p>
    <button class="btn-primary">Confirm</button>
    <button class="btn-ghost">Cancel</button>
  </div>
</div>
```

### Table

```css
.table { width: 100%; border-collapse: collapse; }
.table th {
  text-align: left;
  padding: 8px 12px;
  font-weight: 500;
  font-size: 12px;
  color: #74717a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #565656;
}
.table td {
  padding: 12px;
  border-bottom: 1px solid #565656;
}
```

```html
<table class="table">
  <thead><tr><th>Name</th><th>Status</th><th>Date</th></tr></thead>
  <tbody>
    <tr><td>Item One</td><td>Active</td><td>Jan 1</td></tr>
    <tr><td>Item Two</td><td>Pending</td><td>Jan 2</td></tr>
  </tbody>
</table>
```

### Navigation

```css
.nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #565656;
}
.nav-link {
  color: #74717a;
  padding: 8px 12px;
  border-radius: unset;
  transition: color 150ms;
}
.nav-link:hover { color: #ffffff; }
.nav-link.active { color: #0000ee; }
```

```html
<nav class="nav">
  <a href="/" class="nav-link active">Home</a>
  <a href="/about" class="nav-link">About</a>
  <a href="/pricing" class="nav-link">Pricing</a>
  <button class="btn-primary" style="margin-left: auto">Get Started</button>
</nav>
```

### Extracted Components

These components were found in the codebase:

**Button** (`html`)
- Variants: `ghost`, `icon`, `tertiary`

**Navigation** (`html`)

## Page Structure

The following page sections were detected:

- **Navigation** — Top navigation bar (60 items)
- **Hero** — Hero/banner section with headline and CTAs
- **Features** — Feature/benefit cards grid (17 items)
- **Footer** — Page footer with links and info (63 items)
- **Cta** — Call-to-action section
- **Testimonials** — Testimonials/reviews section

When building pages, follow this section order and structure.

## Animation & Motion

This project uses **subtle motion**. Transitions smooth state changes without calling attention.

### CSS Animations

- `scroll-d1493ba9`
- `scale-up-510628fe`

### Motion Tokens

- **Duration scale:** `200ms`, `250ms`, `300ms`, `350ms`, `500ms`
- **Easing functions:** `ease`, `ease-in-out`, `cubic-bezier(.34,1.56,.64,1)`, `cubic-bezier(.25,1,.5,1)`
- **Animated properties:** `color`

### Motion Guidelines

- **Duration:** Use values from the duration scale above. Short (200ms) for micro-interactions, long (500ms) for page transitions
- **Easing:** Use `ease` as the default easing curve
- **Direction:** Elements enter from bottom/right, exit to top/left
- **Reduced motion:** Always respect `prefers-reduced-motion` — disable animations when set

## Depth & Elevation

### Shadow Tokens

- Subtle: `rgb(137, 136, 141) 0px 0px 0px 1px inset`
- Raised (cards, buttons): `rgb(199, 197, 199) -3px -3px 5px -2px`
- Floating (dropdowns, popovers): `0-4px 20px #00000014`
- Floating (dropdowns, popovers): `0 6px 10px #00000026`
- Floating (dropdowns, popovers): `rgba(0, 0, 0, 0.08) 0px -4px 20px 0px`
- Floating (dropdowns, popovers): `rgba(0, 0, 0, 0) 0px 2px 4px 0px, rgba(50, 50, 93, 0.1) 0px 7px 14px 0px`

### Z-Index Scale

`1, 2, 1024, 1025, 1026, 1060`

Use these exact values — never invent z-index values.

## Anti-Patterns (Never Do)

- **No blur effects** — no backdrop-blur, no filter: blur()
- **No zebra striping** — tables and lists use borders for separation
- **No invented colors** — every hex value must come from the palette above
- **No arbitrary spacing** — every dimension is a multiple of 4px
- **No extra fonts** — only Arial and GitLab Sans are allowed
- **No arbitrary border-radius** — use the scale: 2px, 3px, 8px, 14px, 16px, 4px, 17px, 20px, 24px, 28px
- **No opacity for disabled states** — use muted colors instead

## Workflow

1. **Read** `references/DESIGN.md` before writing any UI code
2. **Pick colors** from the Color System section — never invent new ones
3. **Set typography** — Arial, GitLab Sans only, using the type scale
4. **Build layout** on the 4px grid — check every margin, padding, gap
5. **Match components** to patterns above before creating new ones
6. **Apply elevation** — use shadow tokens
7. **Validate** — every value traces back to a design token. No magic numbers.

## Brand Spec

- **Favicon:** `/images/ico/favicon.ico`
- **Site URL:** `https://gitlab.com`
- **Brand color:** `#0000ee`
- **Brand typeface:** Arial

## Quick Reference

```
Background:     #171321
Surface:        #333333
Text:           #ffffff / #74717a
Accent:         #0000ee
Border:         #565656
Font:           Arial
Spacing:        4px grid
Radius:         unset
Components:     7 detected
```

## When to Trigger

Activate this skill when:
- Creating new components, pages, or visual elements for gitlab
- Writing CSS, Tailwind classes, styled-components, or inline styles
- Building page layouts, templates, or responsive designs
- Reviewing UI code for design consistency
- The user mentions "gitlab" design, style, UI, or theme
- Generating mockups, wireframes, or visual prototypes

---

# Full Reference Files

> Every output file is embedded below. Claude has full design system context from /skills alone.

## Design System Tokens (DESIGN.md)

# gitlab DESIGN.md

> Auto-generated design system — reverse-engineered via static analysis by skillui.
> Frameworks: None detected
> Colors: 20 · Fonts: 2 · Components: 7
> Icon library: not detected · State: not detected
> Primary theme: dark · Dark mode toggle: no · Motion: subtle

## Visual Reference

**Match this design exactly** — study colors, fonts, spacing, and component shapes before writing any UI code.

![gitlab Homepage](../screenshots/homepage.png)

---

## 1. Visual Theme & Atmosphere

This is a **dark-themed** interface with a cool tone. Depth is expressed through layered shadows and subtle surface color variation. Typography pairs **GitLab Sans** for display/headings with **Arial** for body text, creating clear visual hierarchy through type contrast. Spacing follows a **4px base grid** (compact density), with scale: 2, 4, 6, 8, 10, 12, 16, 20px. The palette is predominantly monochromatic with **#0000ee** as the single accent color — used sparingly for interactive elements and emphasis. Motion is subtle — smooth transitions (150-300ms) ease state changes without drawing attention.

---

## 2. Color Palette & Roles

| Token | Hex | Role | Use |
|---|---|---|---|
| background | `#171321` | background | Page background, darkest surface |
| surface | `#333333` | surface | Card and panel backgrounds |
| text-primary | `#ffffff` | text-primary | Headings and body text |
| text-muted | `#74717a` | text-muted | Captions, placeholders, secondary info |
| border | `#565656` | border | Dividers, card borders, outlines |
| accent | `#0000ee` | accent | CTAs, links, focus rings, active states |
| danger | `#c02f12` | danger | Error states, destructive actions |
| info | `#7759c2` | info | Informational highlights |
| unknown | `#1f1c2e` | unknown | Palette color |
| unknown | `#000000` | unknown | Palette color |
| unknown | `#f2f1f5` | unknown | Palette color |
| unknown | `#fc6d26` | unknown | Palette color |
| unknown | `#1f75cb` | unknown | Palette color |
| unknown | `#2f5ca0` | unknown | Palette color |
| unknown | `#468254` | unknown | Palette color |
| unknown | `#a4a3a8` | unknown | Palette color |
| unknown | `#626168` | unknown | Palette color |
| unknown | `#3860be` | unknown | Palette color |
| unknown | `#d1d0d3` | unknown | Palette color |
| unknown | `#89888d` | unknown | Palette color |

### CSS Variable Tokens

```css
--card-width: calc(33.33333% - 21.33333px);
--card-gap: 32px;
--card-width: calc(50% - 16px);
--card-gap: 16px;
--card-width: 85%;
--card-gap: 16px;
--ci-icon-success-background-color: var(--gl-color-green-100);
--ci-icon-success-icon-background-color: var(--gl-color-green-500);
--ci-icon-warning-background-color: var(--gl-color-orange-100);
--ci-icon-warning-icon-background-color: var(--gl-color-orange-500);
--ci-icon-danger-background-color: var(--gl-color-red-100);
--ci-icon-danger-icon-background-color: var(--gl-color-red-500);
--ci-icon-info-background-color: var(--gl-color-blue-100);
--ci-icon-info-icon-background-color: var(--gl-color-neutral-0);
--ci-icon-neutral-background-color: var(--gl-color-neutral-100);
--ci-icon-neutral-icon-background-color: var(--gl-color-neutral-0);
--timeline-entry-draft-note-background-color: var(--gl-color-orange-50);
--timeline-entry-internal-note-background-color: var(--gl-color-orange-50);
--timeline-entry-target-background-color: var(--gl-color-blue-50);
--find-and-replace-match-background-color: var(--gl-color-orange-100);
```


---

## 3. Typography Rules

**Font Stack:**
- **Arial** — Heading 1, Heading 2, Heading 3
- **GitLab Sans** — Body, Caption

**Font Sources:**

```css
@font-face {
  font-family: "GitLab Sans";
  src: url("https://gitlab.com/fonts/gitlab-sans/GitLabSans.woff2") format("woff2");
  font-weight: 100;
}
```

| Role | Font | Size | Weight |
|---|---|---|---|
| Heading 1 | Arial | 3.125rem | 700 |
| Heading 2 | Arial | 2.5rem | 700 |
| Heading 3 | Arial | 2rem | 700 |
| Body | GitLab Sans | .875rem | 400 |
| Caption | GitLab Sans | 16px | 400 |

**Typographic Rules:**
- Limit to 2 font families max per screen
- Use **Arial** for body/UI text, **GitLab Sans** for display/headings
- Maintain consistent hierarchy: no more than 3-4 font sizes per screen
- Headings use bold (600-700), body uses regular (400)
- Line height: 1.5 for body text, 1.2 for headings
- Use color and opacity for secondary hierarchy, not additional font sizes


---

## 4. Component Stylings

### Layout (1)

**Footer** — `html`

### Navigation (1)

**Navigation** — `html`

### Data Display (1)

**List** — `html`

### Data Input (2)

**Button** — `html`
- Variants: `ghost`, `icon`, `tertiary`

**Input** — `html`
- State: :focus, :placeholder

### Media (2)

**Image** — `html`

**Icon** — `html`



---

## 5. Layout Principles

- **Base spacing unit:** 4px
- **Spacing scale:** 2, 4, 6, 8, 10, 12, 16, 20, 22, 24, 28, 30
- **Border radius:** 0px 0px 8px 8px, 0px 0px 2px 2px, 2px, 3px, 8px, 8px 8px 0px 0px, 14px, 16px, unset, 4px, 6px 6px 0px 0px, 17px, 20px, 24px, 28px, 50px, 999px
- **Max content width:** 1025px

**Spacing as Meaning:**
| Spacing | Use |
|---|---|
| 4-8px | Tight: related items within a group |
| 12-16px | Medium: between groups |
| 24-32px | Wide: between sections |
| 48px+ | Vast: major section breaks |


---

## 6. Depth & Elevation

### Flat — subtle depth hints

- `rgb(137, 136, 141) 0px 0px 0px 1px inset`

### Raised — cards, buttons, interactive elements

- `rgb(199, 197, 199) -3px -3px 5px -2px`

### Floating — dropdowns, popovers, modals

- `0-4px 20px #00000014`
- `0 6px 10px #00000026`
- `rgba(0, 0, 0, 0.08) 0px -4px 20px 0px`

### Overlay — full-screen overlays, top-level dialogs

- `0 81px 23px 0 transparent,0 52px 21px #00000003,0 29px 17px #00000008,0 13px 13px #0000000a,0 3px 7px #0000000d`

### Z-Index Scale

`1, 2, 1024, 1025, 1026, 1060`



---

## 7. Animation & Motion

This project uses **subtle motion**. Transitions smooth state changes without demanding attention.

### CSS Animations

- `@keyframes scroll-d1493ba9`
- `@keyframes scale-up-510628fe`

### Motion Guidelines

- Duration: 150-300ms for micro-interactions, 300-500ms for page transitions
- Easing: `ease-out` for enters, `ease-in` for exits
- Always respect `prefers-reduced-motion`


---

## 8. Do's and Don'ts

### Do's

- Use `#0000ee` for interactive elements (buttons, links, focus rings)
- Use `#171321` as the primary page background
- Pair **Arial** (body) with **GitLab Sans** (display) — these are the only allowed fonts
- Follow the **4px** spacing grid for all margins, padding, and gaps
- Use the defined shadow tokens for elevation — see Section 6
- Use border-radius from the scale: 0px 0px 8px 8px, 0px 0px 2px 2px, 2px, 3px, 8px
- Reuse existing components from Section 4 before creating new ones

### Don'ts

- Don't introduce colors outside this palette — extend the design tokens first
- Don't introduce additional font families beyond Arial and GitLab Sans
- Don't use arbitrary spacing values — stick to multiples of 4px
- Don't create custom box-shadow values outside the system tokens
- Don't use arbitrary border-radius values — pick from the defined scale
- Don't duplicate component patterns — check Section 4 first
- Don't use backdrop-blur or blur effects

### Anti-Patterns (detected from codebase)

- No blur or backdrop-blur effects
- No zebra striping on tables/lists


---

## 9. Responsive Behavior

| Name | Value | Source |
|---|---|---|
| xs | 320px | css |
| xs | 375px | css |
| sm | 500px | css |
| sm | 546px | css |
| sm | 576px | css |
| md | 768px | css |
| lg | 769px | css |
| lg | 829px | css |
| lg | 880px | css |
| lg | 1024px | css |
| xl | 1025px | css |
| xl | 1200px | css |
| xl | 1220px | css |
| 2xl | 1300px | css |
| 2xl | 1440px | css |
| 2xl | 1550px | css |

**Approach:** Use `@media (min-width: ...)` queries matching the breakpoints above.


---

## 10. Agent Prompt Guide

Use these as starting points when building new UI:

### Build a Card

```
Background: #333333
Border: 1px solid #565656
Radius: unset
Padding: 16px
Font: Arial
Use shadow tokens from Section 6.
```

### Build a Button

```
Primary: bg #0000ee, text white
Ghost: bg transparent, border #565656
Padding: 8px 16px
Radius: unset
Hover: opacity 0.9 or lighter shade
Focus: ring with #0000ee
```

### Build a Page Layout

```
Background: #171321
Max-width: 1025px, centered
Grid: 4px base
Responsive: mobile-first, breakpoints from Section 9
```

### Build a Stats Card

```
Surface: #333333
Label: #74717a (muted, 12px, uppercase)
Value: #ffffff (primary, 24-32px, bold)
Status: use success/warning/danger from Section 2
```

### Build a Form

```
Input bg: #171321
Input border: 1px solid #565656
Focus: border-color #0000ee
Label: #74717a 12px
Spacing: 16px between fields
Radius: unset
```

### General Component

```
1. Read DESIGN.md Sections 2-6 for tokens
2. Colors: only from palette
3. Font: Arial, type scale from Section 3
4. Spacing: 4px grid
5. Components: match patterns from Section 4
6. Elevation: shadow tokens
```

## Homepage Screenshots (screenshots/)

![homepage.png](screenshots/homepage.png)

