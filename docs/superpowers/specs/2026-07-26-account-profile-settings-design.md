# Account profile and personal settings

Date: 2026-07-26

## Problem

The personal account area is two disconnected stubs. `/profile` renders an
`EmptyState` reading "Profile settings are under construction." `/settings` is a
single scrolling page holding appearance and notification controls, described as
"Preferences for your account, across every workspace" — a claim that is wrong
for two of the five controls it contains.

Three concerns are tangled or missing:

- **Who the user is** — nothing edits `profiles`. `full_name` is whatever the
  sign-up trigger wrote; `avatar_url` is read in the member list but nothing
  ever writes it.
- **How Rezzy behaves for the user** — theme is device-local, language is a
  cookie, notification preferences are server-backed. The page presents all
  three as the same kind of thing.
- **How an organization operates** — already lives under
  `/workspaces/$id/settings` and must stay there.

Language is the sharpest gap: it is a cookie, so it does not follow the user to
another browser or device, and there is no server record of the choice at all.

## What already exists

`public.profiles` (`id, full_name, email, avatar_url, created_at, updated_at`)
is the global per-user table. RLS is `id = auth.uid()` for select, insert, and
update; a `handle_new_user` trigger seeds the row from auth metadata at sign-up;
a `profiles_updated_at` trigger maintains the timestamp. There is no
`user_preferences` table.

`public.notification_preferences` is global per user (`in_app_enabled`,
`desktop_enabled`, `sound_enabled`, `preview_mode`) with the same own-row RLS
shape, an optimistic `useUpdateNotificationPreferences` mutation, and real
`Notification.permission` handling in `usePushSubscription`.

`src/lib/locale.ts` resolves explicit cookie → browser language → `en`, and
`initLocale()` installs it via `overwriteGetLocale` before React mounts.
`applyLocalePreference` reloads the page when the rendered locale changes. The
installed Paraglide runtime supports `setLocale(locale, { reload: false })`.

`public.workspace_members` RLS is `user_id = auth.uid()` — a user can only read
their own membership rows. Storage has one bucket, `chat-media`: private, with
policies keyed on the workspace id in the object path.

`/workspaces/$id/settings` is the established settings shell: a 64px header with
a hairline, a `TabList` section switcher, a `max-w-3xl` column, and the pane
owning the scroll.

## Design

### Information architecture

```text
src/routes/_authenticated/
  settings.tsx              shell: header + TabList + <Outlet/>
  settings/index.tsx        redirect → /settings/profile
  settings/profile.tsx
  settings/appearance.tsx
  settings/notifications.tsx
  settings/security.tsx
  profile.tsx               redirect → /settings/profile
```

The shell mirrors the workspace settings route: same header height and hairline,
same `TabList`, same measure, same scroll ownership. `TabList` already scrolls
horizontally below the mobile breakpoint, so one navigation serves both
breakpoints and the active section is exposed through the tab's own selected
state.

The two shells are not extracted into a shared component. Their headers differ
(a workspace name with a loading state versus a static account title) and their
nav item types differ; one more instance is not yet meaningful duplication.

`/profile` becomes a redirect rather than being deleted, so the existing sidebar
link and any bookmark still land somewhere correct. In the sidebar, account
route matching becomes prefix-based, the account menu's **Profile** entry points
at `/settings/profile`, and its **Settings** entry points at
`/settings/appearance` so the two are not the same destination.

### Layer ownership

A new `src/features/account/` owns the personal account capability:

```text
api/      profile.ts (queries, mutations, query keys), avatar.ts (storage)
hooks/    use-my-profile, use-language-preference, use-avatar-upload,
          use-my-memberships, use-change-password, use-session-actions
schemas/  profile-form-schema.ts, password-form-schema.ts
model/    types.ts
components/
          profile-form, avatar-field, workspace-membership-list,
          change-password-form, session-actions, account-email-row
```

`src/features/preferences/` keeps the appearance UI and imports the language
hook from `@/features/account`. Feature-to-feature imports are already the house
pattern (`inbox` imports `dashboard` and `workspaces`). `NotificationSettings`
stays in `features/notifications`; only its grouping and scope copy change.

Route files render one feature component each.

### Data model

One migration, `20260726150000_account_profile_fields.sql`:

```sql
alter table public.profiles
  add column if not exists job_title text,
  add column if not exists phone     text,
  add column if not exists timezone  text,
  add column if not exists language  text not null default 'auto';

alter table public.profiles
  add constraint profiles_language_check check (language in ('auto','en','ru'));

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;
```

Language lands on `profiles` rather than in a new table: `profiles` is the
existing global per-user record, its own-row RLS already covers every new column
without policy changes, and `notification_preferences` is documented as
notification *delivery* preferences, so language would not belong there.

Storage policies restrict insert, update, and delete on `avatars` to
`(storage.foldername(name))[1] = auth.uid()::text`; select is public. The bucket
is public because `profiles.avatar_url` is a plain text URL that the member list
already feeds straight into `<Avatar src>`, and because signing every avatar
render would buy nothing while profile RLS already hides other users' rows.
Avatar images are therefore readable by anyone holding the URL.

Types are regenerated with `pnpm types:supabase:local`. A database test covers
the language default, the check constraint, and cross-user write denial.

### Language flow

`profiles.language` is authoritative. The Paraglide cookie is the local cache —
`initLocale()` already reads it before React mounts, which is exactly the
"initialize before the authenticated request finishes" requirement, and the
absence of the cookie already means `auto`, so the three-way distinction
survives without a second storage key.

- **Boot, and signed out**: unchanged — cookie, then browser language, then
  `en`. No mutation is attempted without a session.
- **Server sync**: when the profile query resolves, compare `profiles.language`
  against `getLocalePreference()`. When they differ, write the cache, and reload
  only when the *effective* locale changes. A reconciliation that resolves to
  the same rendered locale (server `auto`, cookie `en`, browser `en`) rewrites
  the cache silently. This is what bounds the reload: after one reload the
  cookie matches the server, so the next comparison is a no-op.
- **On change**: control state, cookie, and query cache update synchronously;
  the write is awaited; the page reloads only after it succeeds. On failure all
  three roll back and a localized toast fires, with no reload and no flicker.

Persisting before reloading is a deliberate ordering. Paraglide re-renders
messages by reloading, and a reload fired first would abort the in-flight write;
rolling a language back after the page had already re-rendered in it would also
be worse than a brief pending state on the control. A code comment records the
constraint.

### Pages

**Profile.** Avatar, full name (required), job title, phone, time zone, and a
read-only email row. Text fields trim; optional fields normalize empty input to
`null` rather than to an invalid value. Time zones come from
`Intl.supportedValuesOf('timeZone')` through a `Typeahead` — real data, no new
dependency. An explicit **Save changes** button is disabled until the form is
dirty, guards against double submission, writes through `setQueryData` on
success, and preserves typed values on failure. The update is an upsert, so a
missing row self-heals the way notification preferences already do.

Avatar upload uses `FileInput` with a click-to-pick affordance so it works
without drag-and-drop. Type and size are validated before upload; upload,
success, and failure are all visible; removal is offered only when an avatar
exists, and clears both the object and the column.

No email-change workflow: Supabase can change an email, but the full verified
flow is not implemented here and a partial one would be a lie.

**Workspace membership.** Read-only, derived from the user's own membership rows
joined to their workspaces: workspace, role, and member-since, with copy stating
that roles are managed by workspace administrators. No teams, assignments,
presence, or availability — none of those models exist and none are invented.

**Appearance and language.** Theme (system/light/dark, device-scoped,
`localStorage`, behavior unchanged) and language (auto/en/ru, account-scoped).
Each carries scope-specific supporting text.

**Notifications.** The same five controls, regrouped and labelled by scope:
account preference, this browser, and browser-managed permission. Permission
state is read from the real `Notification.permission`, stays visually separate
from the user's preference, is requested only on an explicit action, and is
never re-prompted after denial. Saves stay immediate and optimistic.

**Security.** Only actions the current backend fully supports: the
authenticated email, connected providers read from `user.identities`, a change
password form (new plus confirmation, cleared on success, disabled with an
explanation for accounts with no password identity), sign out of this device,
and sign out of other devices via `signOut({ scope: 'others' })`. Both sign-out
actions are confirmed through a dialog and set apart from the preferences above.

Supabase's `updateUser({ password })` does not verify the current password, so
the form does not ask for one — an unverified "current password" field would be
decoration. Two-factor authentication, session history, login audit history, and
email changing are omitted for the same reason.

### Errors and states

Every query handles pending, error, and background refetch; populated content is
never replaced by a spinner during a refetch. Covered explicitly: initial
profile load, a missing profile or preference row, a failed profile query, a
failed preferences query, failed mutations, avatar upload progress, unsupported
browser notifications, denied permission, offline and transient network
failures, and stale data during refetch.

Accessibility: visible labels on every field, keyboard-operable controls, the
active settings section exposed by the tab, toggle labels naming the resulting
behavior, permission and error text associated with its control, focus moved
after dialogs, disabled controls explaining why, and success signalled by text
rather than color alone.

### Testing

Unit tests cover profile form initial values, profile validation, successful and
failed profile updates, language resolution for `auto`/`en`/`ru`, server
language synchronization, the optimistic language update, language rollback
after a failed mutation, signed-out cached-language behavior, theme persistence,
the unsupported-notifications state, granted and denied permission states,
notification preference rollback, read-only membership rendering, and password
form validation. Vitest renders Russian by default, so tests asserting English
copy set the locale explicitly.

The database test asserts the language default, the check constraint, and that a
user cannot write another user's profile row.

## Out of scope

Workspace administration of any kind, email changing, two-factor authentication,
session history, provider linking and unlinking, and any team, assignment,
presence, or availability model.
