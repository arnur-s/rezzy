# Workspace onboarding and the inbox access gate

Date: 2026-07-26

## Problem

A new user can currently reach an empty inbox. Two gaps cause it:

1. Onboarding collects a full name that sign-up already captured, then drops the
   user straight into the inbox.
2. Nothing checks whether the workspace can actually receive messages. A
   workspace with no connected channel renders an inbox that will never fill.

The flow should be:

```text
Sign up
→ Create workspace
→ Redirect to channel settings
→ Inbox stays locked
→ Connect at least one channel successfully
→ Inbox becomes available
```

## What already exists

The `complete_onboarding` RPC (migration `20260726090000`) already creates the
profile, workspace, and owner membership in one transaction, derives identity
from `auth.uid()`, and returns the existing workspace on repeat calls. The
`/onboarding` route, `resolveAppGate`, `resolveOnboardingGate`, and a 24-assertion
database test are in place. This design reshapes that work rather than replacing
it.

Sign-up already writes `full_name` into `auth.users.raw_user_meta_data`, and the
`on_auth_user_created` trigger creates the profile row from it. The onboarding
form's full-name field duplicates both.

## Readiness model

No new column and no boolean flag. Three states, each derived from data the app
already fetches.

| State | Derived from | Destination |
| --- | --- | --- |
| No workspace | `workspaces/list` is empty | `/onboarding` |
| Workspace, no active channel | `channels/list/$id` has no `is_active` row | `/workspaces/$id/settings/channels` |
| Workspace with an active channel | at least one `is_active` row | inbox unlocked |

`channels.is_active` is the schema's real connected state. The connect edge
functions (`telegram-connect-channel`, `whatsapp-connect-channel`,
`instagram-connect-channel`) validate credentials against the provider before
inserting, and only ever insert with `is_active: true`. A failed connection
therefore leaves no row at all, so there is no pending, failed, or placeholder
record to exclude. Disconnecting sets `is_active = false` and leaves
conversations untouched; the table has no `deleted_at`.

Readiness splits across three layers so each piece is testable on its own:

- `src/entities/channel/lib/channel-readiness.ts` — `hasActiveChannel(channels)`.
  Domain knowledge about the channel model, no React and no network.
- `src/features/channels/hooks/use-channels.ts` — `useWorkspaceReadiness(workspaceId)`,
  a `select` over the existing `useChannels` query. It reuses the
  `['channels', 'list', workspaceId]` key, so it issues no second request and
  every existing channel mutation already invalidates it. Connect, reconnect,
  rename, deactivate, activate, and workspace switching all recompute readiness
  with no extra wiring.
- `src/features/onboarding/lib/onboarding-gate.ts` — `resolveInboxGate`, beside
  the two existing resolvers. Keeping all three in one pure module is what stops
  them from disagreeing and bouncing a user between routes.

## Database

One new migration: `supabase/migrations/20260726120000_onboarding_workspace_name_only.sql`.

It drops `public.complete_onboarding(text, text)` and creates
`public.complete_onboarding(p_workspace_name text)`. Nothing else in the
repository calls the two-argument form, so replacing it leaves no dead grant
behind.

The body is the existing one with two changes:

- The profile name is read from `auth.users.raw_user_meta_data->>'full_name'`
  server-side instead of arriving as a parameter. The client sends only the
  workspace name.
- The profile upsert becomes `on conflict (id) do nothing`. The
  `on_auth_user_created` trigger owns the display name; onboarding only
  guarantees the row exists to satisfy the `workspaces.created_by` foreign key.

Everything else is preserved:

- `security definer` with `set search_path = ''`.
- `raise ... using errcode = '28000'` when `auth.uid()` is null.
- `errcode = '22023'` when the trimmed workspace name is not 2–60 characters,
  raised before any write so invalid input leaves no partial records.
- The already-onboarded early return, which makes a repeat call return the
  existing workspace with `is_new = false`.
- The `unique_violation` handler over the `one_main_workspace_per_user` partial
  unique index, which is the final duplicate guard when two submissions race.
- `revoke all` from `public, anon, authenticated`, then
  `grant execute ... to authenticated`.

Types are regenerated with `pnpm types:supabase:local`. `src/api/types.ts` is
never edited by hand.

## Routing

The guard lives in the inbox layout route,
`src/routes/_authenticated/workspaces/$id/inbox.tsx`, as a `<Navigate>` gate.
This matches how `_authenticated.tsx` and `onboarding.tsx` already gate, and the
route file stays thin: it reads params, calls the hooks, and delegates the
decision to `resolveInboxGate`.

`inbox/index.tsx` and `inbox/$conversationId.tsx` render through that route's
`<Outlet>`, so guarding the parent covers direct conversation URLs, bookmarks,
refresh, and back/forward navigation with a single check.

```text
/onboarding
  → no session                       → /sign-in
  → auth or workspace query unsettled→ Loader
  → workspace query failed           → retryable error screen
  → workspace exists                 → /workspaces/$id/inbox
  → otherwise                        → onboarding form

/workspaces/$id/inbox/*
  → auth, workspaces, or channels unsettled → Loader
  → channels query failed                   → retryable error screen
  → no active channel                       → /workspaces/$id/settings/channels
  → otherwise                               → inbox
```

An onboarded user landing on `/onboarding` is sent to the inbox and the inbox
gate takes it from there. That costs one extra hop but keeps a single readiness
implementation instead of duplicating the channel check in the onboarding route.

Only inbox routes are locked. The workspace dashboard, contacts, workspace
settings, account settings, profile, home, and sign-out stay reachable while a
workspace has no channel.

Every unresolved state resolves to `loading` and every query failure resolves to
a retry screen rather than a redirect. That is the existing anti-loop rule in
`onboarding-gate.ts`, extended to the third resolver: a redirect on failure is
what turns a flaky network into an infinite loop.

## UI

### Onboarding screen

One field. `workspaceName`, autofocused, required, trimmed, 2–60 characters
matching the RPC's own limits. Title "Create your workspace", supporting text
"Your workspace keeps your conversations, contacts, and team together.", primary
action "Create workspace" with a "Creating workspace…" pending state.

The centered `Card` layout shared with sign-in is kept. DESIGN.md mentions a
dot-grid background for auth and onboarding screens, but the class name in that
document is empty and no such rule exists in `src/styles.css` — it is stale
HeroUI-era documentation, so there is nothing to reuse.

Removed: the full-name field, and the `supabase.auth.updateUser` metadata sync in
`use-complete-onboarding`. Sign-up already wrote that metadata and onboarding no
longer collects a name.

On success the form navigates to `/workspaces/$id/settings/channels` using the
workspace id the RPC returned.

Preserved behaviour: submit disabled while pending, an early return in the
submit handler so a queued Enter keypress cannot start a second call, entered
values retained on failure, and the distinct expired-session banner with a
sign-in action.

### Channel settings handoff

`ChannelList` gains two states:

- With zero channels, the empty state carries the first-run copy: "Connect your
  first channel" / "Add a channel to start receiving customer conversations and
  unlock your inbox."
- Once `hasActiveChannel` is true, a success `Banner` appears above the list with
  an "Open inbox" action.

No automatic navigation. A user who has just connected Telegram may want to
connect a second provider, and the existing channel workflow already ends in a
toast and stays put.

A failed connection keeps the user on the page with the provider-specific error
the existing forms already render, the inbox stays locked, and retrying is
submitting the form again. No local success state is fabricated.

### Sidebar

The Inbox `SideNavItem` takes `isDisabled` and is wrapped in an Astryx `Tooltip`
reading "Connect a channel to open the inbox."

It is disabled only once readiness is known to be false. While the channels
query is loading the item stays enabled, so it never flickers from enabled to
disabled on every workspace switch. The route guard is the real enforcement; the
disabled item is the explanation.

## Internationalisation

All copy goes through Paraglide. `messages/en.json` and `messages/ru.json` are
edited together; `src/paraglide/**` is generated.

Removed: `onboarding_full_name_label`, `onboarding_full_name_placeholder`,
`onboarding_full_name_required`, `onboarding_full_name_max`.

Changed: `onboarding_title`, `onboarding_description`, `onboarding_submit`,
`channels_empty_title`, `channels_empty_description`.

The existing `channels_empty_*` keys are rewritten rather than duplicated by a
parallel set of first-run keys. A workspace with zero channels always has a
locked inbox, so the first-run copy is correct every time that empty state
renders.

Added: `onboarding_submit_pending`, `channels_ready_title`,
`channels_ready_description`, `channels_ready_open_inbox`,
`sidebar_inbox_locked_tooltip`.

## Error handling

| Case | Behaviour |
| --- | --- |
| Unauthenticated | Gate resolves to `sign-in` before any query runs |
| Expired session | RPC raises `28000`; the form shows the session-expired banner with a sign-in action |
| Empty or whitespace-only name | Zod rejects client-side; the RPC rejects with `22023` server-side |
| Duplicate submission | Disabled button, pending-guard early return, RPC early return, unique index |
| RPC or network failure | Retryable banner, entered value retained, nothing created |
| Existing membership | RPC returns the existing workspace with `is_new = false` |
| Created but redirect failed | Refresh re-reads the workspace list and routes to channel settings |
| Invalid workspace in channel settings route | Out of scope. RLS already hides the workspace and the settings route's existing `useWorkspace` handling is unchanged |
| Last active channel disconnected | Readiness flips false, inbox locks again, conversations are preserved |

## Tests

### Database

`supabase/tests/database/onboarding.test.sql` is rewritten for the one-argument
signature:

1. An authenticated user creates their first workspace.
2. The workspace, the owner membership, and the profile row all exist.
3. The caller is the owner.
4. The profile name comes from auth metadata, not from any client parameter.
5. Unauthenticated calls raise `28000`.
6. A caller cannot create records for another user; identity is `auth.uid()` only.
7. Invalid input raises `22023` and leaves no workspace, membership, or profile change.
8. Repeat calls create exactly one workspace and one membership.
9. A second user cannot read the first user's workspace through RLS.
10. Function contract checks: exists, `security definer`, empty `search_path`,
    executable by `authenticated`, not by `anon`.

### Frontend

- `onboarding-form.test.tsx`, rewritten: required validation, whitespace-only
  rejection, trimming, pending and disabled states, repeated-click protection,
  success navigating to `/workspaces/$id/settings/channels`, failure retaining
  the entered value, expired-session copy.
- `onboarding-gate.test.ts`: `resolveInboxGate` over every input combination —
  unsettled auth, unsettled workspaces, unsettled channels, query error, no
  workspace, workspace without an active channel, workspace with an active
  channel. Asserts that no unresolved or failed state produces a redirect.
- `channel-readiness.test.ts`: `hasActiveChannel` over an empty list, all
  inactive, one active, and a mix.
- `channel-list.test.tsx`: first-run copy at zero channels, the ready banner and
  its "Open inbox" action when an active channel exists, and no banner when only
  inactive channels exist.
- `sidebar.test.tsx`: the Inbox item disabled with its tooltip when readiness is
  known false, enabled when ready, and enabled while readiness is loading.

The repository has no router-integration harness — no test renders a
`RouterProvider`, and navigation is asserted by mocking `useNavigate`. The
navigation-shaped requirements (direct URLs, refresh, back/forward, workspace
switching) all run through the same guard, so they are covered as
`resolveInboxGate` cases plus `navigate()` call assertions rather than real
browser-history tests. Building a router harness is out of scope for this change.

## Validation

`pnpm typecheck` at minimum, then `pnpm test` and `pnpm lint`. `pnpm test:db`
and `pnpm types:supabase:local` require a running local Supabase stack and
Docker; if either is unavailable it is reported rather than skipped silently.

## Risks and assumptions

- Regenerating `src/api/types.ts` needs Docker and the local Supabase stack. The
  Supabase CLI is not installed globally and is invoked through the repository's
  `supabase` devDependency. Scratch lines pasted into `.env.local` have broken
  the CLI before.
- Astryx `SideNavItem` has no `tooltip` prop, so the tooltip comes from wrapping
  the item in `Tooltip`. If a disabled item swallows the hover events the
  tooltip needs, the fallback is to leave the item enabled and let the route
  guard redirect — the guard is the enforcement either way.
- Dropping `complete_onboarding(text, text)` assumes no external caller. Only
  `src/features/onboarding/api/onboarding.ts` calls it today.
- `resolveInboxGate` reads the channels query, so the inbox waits on one
  additional request before first paint. It reuses the key the channel list
  already populates, so it is cached after the first visit.
