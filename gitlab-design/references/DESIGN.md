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
