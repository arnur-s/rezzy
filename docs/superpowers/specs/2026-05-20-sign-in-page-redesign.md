# Sign-in Page Redesign

**Date:** 2026-05-20  
**Status:** Approved

## Problem

The current sign-in page uses a `Card` component centered on `--background`, creating a double-layer effect (grey page bg → white card) that looks weak on mobile. On small screens the card becomes full-width with nothing to differentiate it from the page, making it feel like a plain form with unnecessary wrapper styling.

## Goal

Redesign the sign-in page layout to look polished at every breakpoint — no card, proper use of the surface color system, and a branded feel using the accent color.

## Design

### Mobile

- Page background: `bg-surface` (white / dark-surface)
- Orange accent panel at top (~40% of viewport height), containing:
  - Placeholder icon: `MessageCircleIcon` from lucide (already in project), white, in a semi-transparent rounded square
  - App name: "Rezzy" from `m.sidebar_brand_label()`
- White bottom sheet overlapping the accent panel with `rounded-t-3xl` and a negative top margin
- Form (email, password, forgot password link, submit button, sign-up link) inside the white sheet
- No `Card` component

### Desktop (`lg:` breakpoint)

- Full-height split layout (`min-h-dvh flex flex-row`)
- **Left panel** (~40% width): `bg-accent` with `text-accent-foreground`
  - Centered vertically: icon, app name, tagline
  - Tagline: new i18n key `auth_sign_in_brand_tagline` (e.g. "Your CRM for modern customer conversations")
- **Right panel** (~60% width): `bg-surface`, form centered with `max-w-md`
- No card or border — the panel boundary is the visual separator

### Shared

- The outer wrapper switches from `bg-background` to `bg-surface`
- All form fields, validation logic, mutations, error handling, and i18n keys remain unchanged
- The `Card`, `Card.Header`, `Card.Content`, `Card.Footer` components are removed entirely
- The form structure is preserved inside the new layout shell

## Files to Change

| File | Change |
|------|--------|
| `src/routes/sign-in.tsx` | Replace Card layout with split-panel layout |
| `messages/en.json` | Add `auth_sign_in_brand_tagline` key |
| `messages/ru.json` | Add `auth_sign_in_brand_tagline` key (Russian) |

## i18n Keys

| Key | English | Russian |
|-----|---------|---------|
| `auth_sign_in_brand_tagline` | `Your CRM for modern customer conversations` | `Ваша CRM для современных диалогов с клиентами` |

## Out of Scope

- Sign-up page (`/sign-up`) — separate task if needed
- Password reset page (`/password-reset`) — separate task if needed
- Adding a real logo asset — placeholder icon used for now
- Any changes to form logic, mutation behavior, or routing
