# Workspace membership management

Date: 2026-08-09
Status: approved, not yet implemented

Answers prompt 5 of `docs/schema-review-2026-08-09-prompts.md`.

## Problem

Rezzy is built on multi-workspace shared inboxes, and nothing can change who is
in a workspace. `public.workspace_members` has one SELECT policy
(`user_id = auth.uid()`) and one INSERT policy; `authenticated` holds
`SELECT, INSERT` and no UPDATE or DELETE. There is no invite, no role change, no
removal, and no way to leave. `invited_by` exists as a column, is indexed, and is
written by nothing.

`src/features/workspaces/components/workspace-members-stub.tsx` already renders
the roster with a disabled email field under a "coming soon" badge, so the
absence is visible in the product.

There is also a privilege path. The INSERT policy admits any row where
`role = 'owner'` and `workspaces.created_by = auth.uid()`, and the `workspaces`
SELECT policy keeps a creator visible through `created_by = auth.uid()`. A
creator who is removed from their own workspace can re-insert themselves as
owner. `20260803090000_workspace_creator_can_read_own_insert.sql` names the
trade-off in its header and justifies it with "there is no client-reachable path
that removes a membership today" — which this work builds.

## Goals

1. Owners and admins can invite an existing Rezzy user by email, change roles,
   and remove members. Anyone can leave.
2. An invited user is notified in-app when the invitation is created, and can
   accept or reject it.
3. A workspace can never reach zero owners, under concurrency as well as in
   sequence.
4. A removed creator cannot re-add themselves as owner, and loses the workspace.
5. Every membership mutation goes through a SECURITY DEFINER RPC. No direct
   client INSERT/UPDATE/DELETE on membership or invitation rows.
6. `soft_delete_workspace` stops appearing in the generated client surface.

## Non-goals

- Inviting people who have no Rezzy account. Email delivery, invite tokens, and
  a signup-linked accept flow are all out of scope; the invitee must already
  have an account.
- Seat billing. `PRICING.md` describes per-seat pricing; nothing here counts,
  limits, or meters seats.
- Read-only access. See "The `viewer` role is dropped" below.
- Restoring a soft-deleted workspace.
- Transferring workspace ownership as a single atomic operation. Promote, then
  demote.

## Decisions

### Invite model: existing users only, with an in-app accept

An owner or admin types an email. If no registered user holds it, the invite is
refused and nothing is written; the UI says the person must sign up first and
share the address they registered with. If a user is found, a **pending
invitation** is created and the invited user accepts or rejects it in-app.

Rejected because they cost more than they are worth here: a token-and-link
invitation (needs an accept route, an expiry story, and email delivery that does
not exist — no Resend, no SMTP, `[auth.email.smtp]` commented out in
`supabase/config.toml`), and `auth.admin.inviteUserByEmail` (needs production
SMTP, and does not fit an existing user being invited to a second workspace).

Rejected also: direct add with no acceptance step. Being added to a shared inbox
without consent is a surprise, and the invited user is the only party who should
decide.

**Creating an invitation must raise an in-app notification to the invitee.** An
invitation the recipient has to go looking for is not an invitation. The
workspace-switcher indicator described below **supplements** that notification;
it is the persistent place to act on a pending invite, not the thing that
announces one. Requirement and mechanism are set out under
"In-app notification" in the client section.

### The email lookup reads `auth.users`, not `public.profiles`

`public.profiles.email` is `text` with no unique index and no index at all, and
`authenticated` holds a **table-wide UPDATE grant** on `profiles`. Any user can
therefore set their own `profiles.email` to a colleague's address and receive
invitations meant for them. `auth.users.email` is the authoritative value,
lowercased by GoTrue and uniquely indexed. `public.complete_onboarding` already
reads `auth.users` from inside a definer function; the invite RPC does the same,
filtering `deleted_at is null`.

The `profiles` UPDATE grant is a real defect in its own right. It belongs to
prompt 11 of the schema review and is deliberately not fixed here — this design
simply does not depend on it.

### Invitation lifecycle: no expiry, revocable, re-invite replaces

An invitation stays pending until accepted, rejected, or revoked. Inviting an
address that already has a pending invitation updates that row rather than
creating a second. Inviting an existing member is refused with its own error.
Rejected and revoked rows are retained as **history** and do not block a fresh
invite.

History, not durable audit, and the distinction is deliberate.
`invited_user_id` is `ON DELETE CASCADE`, so deleting a user's profile takes
their invitation rows with it. That is the right trade here: the invitee is the
subject of the row, not an incidental actor on it, and a deleted account should
not leave its email address behind in workspaces that never admitted it. If
durable audit is ever required, it needs an append-only log that survives the
account, not a nullable FK on this table.

No expiry, so no scheduled job: `pg_cron` is not installed on this project, and
an expiry that lives only in a WHERE clause produces silence rather than an
explanation for a user who took two weeks to look.

### The `viewer` role is dropped

`workspace_members_role_check` allows `owner`/`admin`/`member`/`viewer`, and
`viewer` is labelled in two UI switches and ordered in two RPCs. No policy
anywhere distinguishes it from `member`: every check is either
`public.is_workspace_member(...)` or `role in ('owner','admin')`. It is a label
that promises read-only and delivers full member access.

Rather than ship a control whose label is a lie, or expand scope into read-only
RLS across the whole inbox, `viewer` is removed: the CHECK tightens to
`('owner','admin','member')` and the label disappears from the client.

### Invitations grant `admin` or `member`, never `owner`

An owner who wants a second owner invites them and then promotes them, so the
"only owners may grant owner" rule lives in exactly one function.

Admins may invite at `admin` level, because the agreed role rules already let an
admin promote a member to admin; refusing it on the invite path would only mean
two operations instead of one.

### Workspace creation moves to an RPC

The `created_by = auth.uid()` branch in the `workspaces` SELECT policy exists for
one reason, documented in `20260803090000`: the client creates a workspace with
`.insert(...).select()`, and for `INSERT ... RETURNING` Postgres applies the
SELECT policy as an extra WITH CHECK in `ExecInsert`, **before** AFTER ROW
triggers fire — so `public.handle_new_workspace()` has not yet seated the owner
and a membership-only policy rejects the creator's own row.

A definer RPC that inserts and returns the row removes that ordering problem, so
the `created_by` branch can go. Without it, a removed creator keeps reading the
workspace row, and `getUserWorkspaces()` — which selects `workspaces` with no
membership join — keeps a ghost workspace in their switcher.

### `soft_delete_workspace` moves to the `private` schema

It stays unreachable from the browser, as
`supabase/tests/database/workspace_lifecycle.test.sql` records is deliberate.
`src/api/types.ts` is generated from the database, so the only way to stop
generating it is to take it out of the Data API:
`alter function public.soft_delete_workspace(uuid) set schema private`. It
remains callable at the owning role exactly as today.

## Data model

### New table `public.workspace_invitations`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid | pk, `gen_random_uuid()` |
| `workspace_id` | uuid | not null → `public.workspaces(id)` on delete cascade |
| `invited_user_id` | uuid | not null → `public.profiles(id)` on delete cascade |
| `invited_email` | text | not null; the address resolved from `auth.users` at invite time |
| `invited_by` | uuid | → `public.profiles(id)` on delete set null |
| `role` | text | not null, check `in ('admin','member')` |
| `status` | text | not null default `'pending'`, check `in ('pending','accepted','rejected','revoked')` |
| `created_at` | timestamptz | not null default `now()` |
| `resolved_at` | timestamptz | set when status leaves `pending` |
| `resolved_by` | uuid | → `public.profiles(id)` on delete set null; distinguishes a revoke from a rejection |

`invited_email` is stored rather than joined so the admin's pending list renders
the address that was actually resolved, not the spoofable `profiles.email`.

`invited_by` and `resolved_by` follow the actor-FK convention established by
`20260804100000_actor_fks_on_delete_set_null.sql`: an actor who leaves does not
delete the history row.

Indexes:

- `unique (workspace_id, invited_user_id) where status = 'pending'` — this is
  what makes "re-invite updates the existing row" a constraint rather than a
  convention, and what stops two concurrent invites producing two rows.
- `(invited_user_id) where status = 'pending'` — the invitee's switcher query.
- `(workspace_id, status)` — the members page, and the cascade delete.
- FK-supporting indexes on `invited_by` and `resolved_by`, named
  `workspace_invitations_invited_by_fkey_idx` and
  `workspace_invitations_resolved_by_fkey_idx`.
  `supabase/tests/database/performance_contract.test.sql` enumerates the
  `(table, index, column)` triples it expects rather than sweeping `pg_constraint`,
  so both must be added to that list or the contract will not cover them.

RLS is enabled. `authenticated` receives **`SELECT` only, under a single policy
`invited_user_id = (select auth.uid()) and status = 'pending'`**. There is no
INSERT, UPDATE, or DELETE grant and no policy for them, so every write goes
through a definer RPC.

The SELECT grant is not a convenience — it is load-bearing. `postgres_changes`
evaluates RLS as the subscribing user, so a table with no SELECT policy delivers
no realtime events, and the invitee would never be notified (see
"In-app notification" below). The policy is scoped so an invitee sees their own
pending row and nothing else: not other people's invitations, not the workspace's
roster, and not their own rejected history.

The table must also be added to the `supabase_realtime` publication, or the
subscription is silently inert.

Note that this makes `list_my_workspace_invitations()` a convenience rather than
a boundary — it exists for the joins to workspace name, icon, and inviter name,
which the invitee cannot read directly. Keep the guard inside it regardless; a
read RPC that trusts its caller is how the next one gets written.

### Changes to `public.workspace_members`

- `workspace_members_role_check` tightens to `('owner','admin','member')`. The
  migration first migrates any `viewer` rows to `member`, so the constraint
  cannot fail on data.
- `invited_by` starts being written, by the accept RPC.
- Grants become `SELECT` only for `authenticated`.

## Authorization changes

Three changes, each closing a specific path:

1. Drop policy `"Workspace creators can create owner membership"` on
   `public.workspace_members` and revoke `INSERT`. Creation is unaffected:
   `public.handle_new_workspace()` is a SECURITY DEFINER AFTER INSERT trigger on
   `workspaces` that already seats the creator as owner. This alone closes the
   re-add escalation.
2. Add `public.create_workspace(p_name, p_description, p_icon, p_is_main)`,
   modelled on `public.complete_onboarding`: definer, `search_path = ''`,
   seats via the same trigger, returns the row.
3. Drop `created_by = (select auth.uid())` from the `workspaces` SELECT policy,
   drop policy `"Users can create workspaces"`, and revoke `INSERT` on
   `public.workspaces` from `authenticated`.

Plus a shared helper `private.workspace_role(p_workspace_id uuid) returns text` —
definer, stable, `search_path = ''`, returning the caller's role, or null. Every
RPC below authorizes through it, so the boundary is stated once.

**It lives in `private`, not `public`.** It is internal authorization
infrastructure with no client caller, and `private` is not exposed through the
Data API, so it can never be reached as an RPC and never appears in
`src/api/types.ts`. The definer RPCs call it fully qualified as
`private.workspace_role(...)`; because they execute as their owner, they reach it
without `authenticated` holding `USAGE` on the schema. Confirm no such grant
exists before relying on that — `private.channel_secrets` implies it does not.

**It preserves exactly the boundary `public.is_workspace_member` draws.** Same
join to `public.workspaces`, same `w.deleted_at is null` predicate, same
`(select auth.uid())` identity: a soft-deleted workspace yields null for every
caller, so "no role" and "workspace withdrawn" collapse into one answer and no
RPC below needs its own `deleted_at` check.

Note for the implementer: `public.is_workspace_member` is SECURITY DEFINER for a
reason documented at length in
`20260805090300_deleted_workspaces_lose_child_access.sql` — an invoker-rights
read of `workspaces` from inside it recurses through the `workspaces` SELECT
policy until the stack limit, and does so only for non-creators.
`private.workspace_role` reads the same two tables and must be definer for the
same reason.

## RPC surface

All seven are `security definer`, `set search_path = ''`, revoked from
`public, anon, service_role` and granted to `authenticated`. All refuse in a
workspace whose `deleted_at` is set.

Five of them authorize through `private.workspace_role`, which carries the
`deleted_at` predicate for free. The two invitee-facing ones —
`respond_to_workspace_invitation` and `list_my_workspace_invitations` — cannot:
the invitee is not a member yet, so `workspace_role` correctly returns null for
them. Those two identify the caller as `invited_user_id` and must **join
`public.workspaces` and check `deleted_at is null` themselves**. Forgetting it
there is how someone accepts their way into a workspace the product has already
withdrawn.

### Writes

**`invite_workspace_member(p_workspace_id uuid, p_email text, p_role text) returns uuid`**

Caller must be owner or admin. `p_role` must be `admin` or `member`. Resolves
`lower(btrim(p_email))` against `auth.users` where `deleted_at is null`.

| condition | error |
| --- | --- |
| caller is not owner/admin | `NOT_A_WORKSPACE_ADMIN` (42501) |
| no user holds that email | `USER_NOT_FOUND` (P0002) |
| resolved user is already a member | `ALREADY_A_MEMBER` (42710) |
| resolved user is the caller | `CANNOT_INVITE_SELF` (22023) |
| `p_role` not in (`admin`,`member`) | `INVALID_ROLE` (22023) |

**Re-invite must be atomic.** On an existing pending invitation for the same
pair, the row's `role`, `invited_by`, and `created_at` are updated and the same
id is returned. This must be one statement that infers the partial unique index,
not a `select` followed by an `insert` or `update`:

```sql
insert into public.workspace_invitations
  (workspace_id, invited_user_id, invited_email, invited_by, role)
values (...)
on conflict (workspace_id, invited_user_id) where status = 'pending'
do update set
  role       = excluded.role,
  invited_by = excluded.invited_by,
  created_at = now()
returning id;
```

Two admins inviting the same person at the same moment must leave exactly one
pending invitation, and neither call may surface a raw `23505` — the read-then-
write shape loses that race and returns a unique-violation to whichever admin
arrives second.

**`respond_to_workspace_invitation(p_invitation_id uuid, p_accept boolean) returns uuid`**

Caller must be `invited_user_id` and the invitation must be pending in a live
workspace. Accept inserts the `workspace_members` row — carrying `invited_by`
from the invitation — and stamps `status = 'accepted'`, in one transaction.
Reject stamps `status = 'rejected'`. Both set `resolved_at` and `resolved_by`.

Every failing case raises the single error `INVITATION_NOT_FOUND` (P0002):
not yours, not pending, and workspace-is-gone are indistinguishable to the
caller, so the function reveals nothing about invitations addressed to others.

**`revoke_workspace_invitation(p_invitation_id uuid) returns void`**

Owner or admin of the invitation's workspace. Stamps `status = 'revoked'` and
`resolved_by = auth.uid()`. Raises `NOT_A_WORKSPACE_ADMIN` or
`INVITATION_NOT_FOUND`.

**`update_workspace_member_role(p_workspace_id uuid, p_user_id uuid, p_role text) returns void`**

| rule | error when violated |
| --- | --- |
| caller is owner or admin | `NOT_A_WORKSPACE_ADMIN` (42501) |
| the target must be a member of this workspace | `MEMBER_NOT_FOUND` (P0002) |
| only an owner may set `role = 'owner'`, or change a row that currently holds it | `OWNER_ROLE_REQUIRES_OWNER` (42501) |
| admins may move member ↔ admin | — |
| the workspace must retain at least one owner | `LAST_OWNER` (23514) |
| `p_role` in (`owner`,`admin`,`member`) | `INVALID_ROLE` (22023) |

The target's current role is read from the locked roster described below, never
from an unlocked read.

**`remove_workspace_member(p_workspace_id uuid, p_user_id uuid) returns void`**

Owner or admin may remove anyone; any member may remove themselves (this is
"leave"). An admin may not remove an owner (`OWNER_ROLE_REQUIRES_OWNER`). The
last owner may not be removed and may not leave (`LAST_OWNER`). A target who is
not a member is `MEMBER_NOT_FOUND`. Same locked-roster rule as above: the
target's role is read from the locked tuple, not before it.

`trg_clear_assignments_for_removed_member` already clears
`conversations.assigned_to` and `contacts.owner_id` on DELETE — shipped ahead of
this path by `20260805090400`, and asserted in `workspace_lifecycle.test.sql`.
Nothing new is needed for cleanup.

### Both write paths lock the roster before deciding anything

`update_workspace_member_role` and `remove_workspace_member` must lock **the
target row** and **the owner set** before any authorization check reads either.
Two distinct races otherwise:

- **The target row.** An admin reads the target as `member` and, while the
  decision is being made, an owner promotes that same user to `owner`. The
  admin's write then lands on an owner's row — precisely what
  `OWNER_ROLE_REQUIRES_OWNER` exists to prevent. The target's role must be read
  from a locked tuple and every owner/admin check must run against that value,
  never against a role read before the lock or re-read after it.
- **The owner set.** Two concurrent demotions each read two owners, both
  succeed, and the workspace reaches zero.

**Acquire both with one statement, not two.** Two separate `FOR UPDATE`
statements deadlock against each other whenever the target is itself an owner:
a transaction demoting owner A locks A, then asks for the owner set containing
B; a concurrent transaction demoting owner B holds B and asks for the set
containing A. Neither can proceed. So both functions open with a single lock
over the whole workspace roster in a deterministic order:

```sql
select 1
from public.workspace_members
where workspace_id = p_workspace_id
order by user_id
for update;
```

One statement, one scan order, so concurrent callers serialize instead of
deadlocking. It covers the target row and the owner set together, and a
workspace roster is tens of rows, so the cost is irrelevant. Every subsequent
read — the target's role, the owner count — then runs inside that lock and
observes a roster nobody else can move.

A target with no row is `MEMBER_NOT_FOUND` (P0002), decided first, inside the
lock.

### Reads

**`list_my_workspace_invitations()`** — pending invitations for `auth.uid()` in
live workspaces, joined to workspace name and icon and to the inviter's
`full_name`. Feeds the switcher. Returns an empty set, never an error, for a
user with none.

**`list_workspace_invitations(p_workspace_id uuid)`** — pending invitations for
the members settings page. **Owner/admin only**, because it returns email
addresses: `list_workspace_members` deliberately excludes email (see the header
of `20260731183000_member_directory_contact_fields.sql`) and this must not
become the back door around that decision.

## Client and UI

### Feature layer

`src/features/workspaces/api/workspace-membership.ts` and
`hooks/use-workspace-membership.ts`: the seven RPCs, one query-key group added
to `workspaceQueryKeys`, and one place that maps a Postgres error message token
onto an i18n key. Existing `workspaces.ts` keeps the workspace CRUD; membership
is its own module rather than growing that file further.

`createWorkspace()` switches from `.insert().select()` to the new RPC.

### Members settings page

`workspace-members-stub.tsx` is rebuilt in place (and renamed off "stub"):

- The invite section loses its `Badge variant="warning"` and its `isDisabled`.
  Email field plus a role select (`Администратор` / `Участник`).
- **The email field carries permanent helper text**, rendered before any
  submission, stating that only people who already have a Rezzy account can be
  invited and that the invitee must sign up first and share the address they
  registered with. This is a standing constraint of the invite model, not an
  error: it must be readable by an inviter who has typed nothing yet, so it
  cannot be deferred to validation state. It is separate from, and does not
  replace, the `USER_NOT_FOUND` error — the error explains a failed attempt,
  the helper prevents one.
- A pending-invitations section listing invitee, role, inviter, and a revoke
  action. Hidden entirely for non-admins, who cannot read it anyway.
- Roster rows gain a role menu and a remove action.

Every control is gated on `useIsWorkspaceAdmin`, which already exists and
already distinguishes "not an admin" from "roster not loaded". Affordances that
the last-owner rule forbids are disabled with an explanation; the RPC enforces
the same rule, so the UI never becomes the boundary.

### Workspace switcher

`WorkspaceSwitcher` is defined inside `src/widgets/sidebar/sidebar.tsx`. Its
popover gains a pending-invitations section below the workspace list, each row
carrying the workspace name, the offered role, who invited, and Accept /
Decline. A dot on the switcher trigger when any are pending.

Accepting invalidates `workspaceQueryKeys.list` and the member directory, so the
new workspace appears in the same interaction.

The indicator is the persistent surface. It does not satisfy the notification
requirement on its own — a user who never opens the switcher never learns they
were invited.

### In-app notification

**The infrastructure exists, and it is half-general.** Documented here because
the split decides how much is new work:

*Generic and reusable as-is* — the Astryx `useToast` host; `NotificationDeduper`
and `createTabCoordinator`, both keyed by an opaque row id so only one tab
presents a given event; `playNotificationSound`; the notification preferences
record (`inAppEnabled`, `soundEnabled`, `previewMode`); and the per-user realtime
channel `notifications:${userId}` that `useMessageNotifications` opens once from
the notifications provider.

*Message-shaped, and not reusable* — `public.message_notifications` is a
conversation/message join table, not a general notification store;
`shouldPresentInApp` takes a `MessageNotificationRow` and applies exact-thread
suppression; `showMessageNotificationToast` and `getMessageNotificationDetails`
render and hydrate a conversation; the `/notifications` route and the header bell
are an unread-**conversations** view, as
`docs/superpowers/specs/2026-08-09-notification-toast-redesign-design.md` treats
them, not a notification centre.

**So: no new mechanism is introduced.** `useMessageNotifications` gains a second
`.on('postgres_changes', ...)` binding on the same per-user channel, filtered
`invited_user_id=eq.${userId}`, reusing the deduper, the tab coordinator, and
the sound, and presenting a distinct invitation toast with Accept / Decline and
a link to the switcher. The hook keeps its name or gains a neutral one; either
way it stays mounted once, from the same provider.

**It must bind `INSERT` *and* `UPDATE`.** A re-invite is an `ON CONFLICT
DO UPDATE`, so an invitation that was already pending produces an UPDATE and no
INSERT. Binding INSERT alone means the one case where an admin actively tries
again — because the first attempt went unnoticed — is the one case that
notifies nobody.

**Re-invite notifies again.** `role`, `invited_by`, and `created_at` can all
change, so the invitee is being told something new. Present an UPDATE only when
the resulting row is still `pending`; accept, reject, and revoke all move
`status` away from it. In practice the server filters these out already — the
SELECT policy is `... and status = 'pending'`, and realtime evaluates it against
the new record, so a row leaving `pending` fails the policy and no event is
delivered. Guard on `status === 'pending'` in the client regardless: relying on
a policy predicate to carry presentation logic is how the two drift apart.

**The dedupe key cannot be the row id.** `NotificationDeduper.add(id)` is a
bounded FIFO of the last 500 ids seen in a tab, and `coordinator.claim(id)` has
a 60-second TTL — both permanent enough to swallow a re-invite, which carries
the *same* primary key as the invitation it replaces. Key presentation on
`` `${row.id}:${row.created_at}` `` instead. The upsert sets `created_at = now()`,
so every genuine re-invite mints a fresh key while duplicate deliveries of one
event still collapse to a single toast. These two details interlock: if the
`DO UPDATE` ever stops bumping `created_at`, re-invite notifications go silent
and nothing fails.

A re-invite after a rejection is an INSERT, not an UPDATE — the partial unique
index covers `status = 'pending'` only, so the rejected row does not conflict
and a new one is created. That path needs nothing special.

Two consequences already recorded in the data model: `workspace_invitations`
needs the invitee's own-row SELECT policy for the subscription to receive
anything, and the table must join the `supabase_realtime` publication.

Invitations respect `inAppEnabled` and `soundEnabled`. `previewMode` does not
apply — there is no message body — and the exact-thread suppression rule does
not either, so invitations get their own small predicate rather than being
forced through `shouldPresentInApp`.

**Out of scope: OS/push notification for invitations.** The `send-message-push`
edge function is message-specific and is triggered from the message path;
extending Web Push to a second event type is its own piece of work. An invitee
who is not in the app learns about the invitation the next time they open it,
from the switcher indicator. Stated here so the gap is a decision rather than an
oversight.

### `viewer` removal

Out of `WORKSPACE_ROLES` in `src/features/account/model/types.ts` and the role
list in `src/entities/workspace/model/member.ts`; out of the label switches in
`workspace-members-stub.tsx` and
`src/features/account/components/workspace-membership-list.tsx`; its message
keys deleted from `messages/en.json` and `messages/ru.json`. The now-dead
`when 'viewer' then 3` ordering branches in `list_workspace_members` and the
contacts directory RPC go in the same migration.

### Internationalization

`ru` is `baseLocale`, so the Russian copy is the product rather than a
translation of the English. New keys are grouped under the existing
`workspace_settings_members_*` prefix and a new `workspace_invitations_*` group,
in both catalogues, checked against each other by hand — nothing enforces key
parity.

**Existing copy that is now wrong.** `workspace_settings_members_invite_description`
reads «Отправим коллеге ссылку — по ней он войдёт в пространство» / "Email a
teammate a link that adds them to this workspace". That describes the
token-and-link model this design rejected: no email is sent and no link exists.
It must be rewritten, not supplemented.
`workspace_settings_members_invite_coming_soon` is deleted with the badge.

| key | ru (base) | en |
| --- | --- | --- |
| `workspace_settings_members_invite_description` | Приглашённый коллега получит уведомление и сам решит, присоединяться ли | The person you invite gets a notification and decides whether to join |
| `workspace_settings_members_invite_help` | Пригласить можно только тех, у кого уже есть аккаунт в Rezzy. Попросите коллегу зарегистрироваться и сообщить адрес, который он указал при регистрации | You can only invite people who already have a Rezzy account. Ask them to sign up first and share the email address they registered with |
| `workspace_settings_members_invite_error_user_not_found` | Пользователь не найден. Сначала он должен зарегистрироваться и сообщить вам адрес, на который создан аккаунт | User not found. This person must sign up first and share the email address associated with their account |
| `workspace_settings_members_invite_error_already_member` | Этот человек уже участник пространства | This person is already a member of the workspace |
| `workspace_settings_members_invite_error_self` | Нельзя пригласить самого себя | You cannot invite yourself |

The helper text is the longest string in the section and sits under a
full-width field rather than inside a fixed-width control, so it wraps rather
than truncates — but it is also the copy most likely to be shortened later
without checking. Read it at phone width in Russian before calling the section
done.

The role select is a fixed-width control, so `администратор` and `участник` get
a budget in `src/lib/message-lengths.test.ts`. Nothing here is counted, so no
plural variants are needed — except the pending-invitation count on the switcher
dot if it renders a number, which takes `one`/`few`/`many`.

## Tests

### New `supabase/tests/database/workspace_membership.test.sql`

- A removed creator cannot re-insert themselves as owner, and cannot read the
  workspace row. Asserted directly, as the escalation it is.
- Inviting an address no user holds raises `USER_NOT_FOUND` and writes nothing.
- Inviting an existing member raises `ALREADY_A_MEMBER`.
- Re-inviting a pending invitee updates the row; the partial unique index holds.
- **Two concurrent invitations** for the same `(workspace_id, invited_user_id)`
  leave exactly one pending row, and neither call raises `23505`.
- Accept creates the membership carrying `invited_by`, and stamps the
  invitation.
- A user who is not the invitee cannot accept or reject that invitation.
- An admin cannot demote or remove an owner, and cannot promote anyone to owner.
- The last owner cannot be demoted, removed, or leave.
- Two concurrent demotions cannot reach zero owners.
- **The promote-under-an-admin race:** an admin's role change or removal, racing
  a concurrent promotion of the same target to `owner`, cannot land on an owner's
  row. One of the two transactions must observe the other's result and refuse
  with `OWNER_ROLE_REQUIRES_OWNER`.
- Every write path refuses in a soft-deleted workspace.
- `authenticated` holds no INSERT/UPDATE/DELETE on `workspace_members` and no
  INSERT/UPDATE/DELETE on `workspace_invitations`.
- An invitee reads their own pending invitation row directly and **cannot** read
  another user's, a non-pending one of their own, or any other column of the
  workspace — the SELECT policy is scoped, not a general read grant.

The three concurrency tests need two sessions, and **nothing in
`supabase/tests/database/` runs more than one today** — no `dblink`, no
connection helper, and every file is a single transaction ending in `rollback`.
Introducing `dblink` for this is a defensible call and should be made
deliberately; it is a new extension on the project.

If it is not introduced, do not write a single-session test that appears to
cover the race and cannot. Assert what one session can — that the lock statement
is present in the function body, and that the serialized order produces the
right answer — and record in the test file that the true interleaving is
unverified. A test that quietly proves less than it claims is worse here than an
acknowledged gap, because the next person deletes the lock and stays green.

### Existing tests that must change

- `security_contract.test.sql` asserts the current grant set on
  `workspace_members` and the current `workspaces` policies.
- `workspace_lifecycle.test.sql` states in a comment that removal is unreachable
  from the browser, and calls `public.soft_delete_workspace` by that name.

Both statements stop being true; update them rather than working around them.

### Application tests

Unit tests for the error-token → i18n mapping, the last-owner affordance gating,
and the switcher's invitation section rendering and mutations.

Two that specifically pin the notification behaviour, because both fail silently
rather than loudly:

- A re-invite — same row id, later `created_at` — presents a second toast; the
  same event delivered twice presents one. This is the assertion that keeps the
  `` `${id}:${created_at}` `` key from being "simplified" back to `id`.
- An UPDATE whose new `status` is not `pending` presents nothing, even if one is
  delivered.

The invite section's helper text is asserted as present on first render, with no
input and no submission — it is the requirement most easily lost to a refactor
that moves it into an error slot.

### Validation

`pnpm test:db` and `pnpm verify`. Then a browser pass in Russian at phone width:
the switcher's invitation rows are new UI inside a width-constrained control,
and jsdom has no layout, so truncation there is invisible to the unit suite.

## Risks

- **Migration ordering.** Revoking INSERT on `workspaces` before
  `create_workspace` is granted breaks workspace creation for the length of the
  deploy. The migration must create and grant the RPC before revoking anything,
  and the client change must ship with it.
- **`one_main_workspace_per_user`.** `create_workspace` inherits the unique
  violation handling that `complete_onboarding` documents; it must not silently
  return a different workspace than the caller asked to create.
- **Dropping the `created_by` SELECT branch** is the change most likely to
  surface an unrelated dependency. Search for every reader of `workspaces` that
  assumes a creator can see their own row before removing it.
