# Workspace Membership Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let owners and admins invite existing Rezzy users into a workspace, change roles, and remove members — through SECURITY DEFINER RPCs only — while closing the privilege path that lets a removed workspace creator re-add themselves as owner.

**Architecture:** A new `public.workspace_invitations` table holds pending invitations; seven definer RPCs are the only write path. Authorization runs through one `private.workspace_role` helper that carries the soft-deleted-workspace boundary. The client gets a rebuilt members settings page, an invitations section in the workspace switcher, and a realtime-driven in-app toast reusing the existing notification engine.

**Tech Stack:** Postgres 15 / Supabase (RLS, pgTAP), React 19, TanStack Query + Router, Astryx `@astryxdesign/core@0.1.8`, Tailwind v4, Paraglide/Inlang, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-09-workspace-membership-management-design.md`. Read it before Task 1. Where this plan and the spec disagree, the plan is later and wins — three corrections are marked **SPEC CORRECTION** and are folded in at Task 0.

## Global Constraints

- **Read `AGENTS.md` first.** The repository is the source of truth; verify each finding below still holds before changing anything.
- **Work in this worktree.** `.claude/worktrees/workspace-membership-management`, branch `worktree-workspace-membership-management`. Never `cd` to the main checkout.
- **Local Supabase is shared machine-wide.** `supabase/config.toml` pins fixed ports. Coordinate before `supabase db reset` or `pnpm test:db`; another worktree may be mid-run.
- **Never edit generated files:** `src/routeTree.gen.ts`, `src/paraglide/**`, `src/api/types.ts`, `src/generated/**`.
- **Never rewrite an existing migration.** Add a new one. Migration timestamps in this plan run `20260809130000`–`20260809190000`; the newest existing migration is `20260809120000`.
- **Every new function:** `security definer`, `set search_path = ''`, every relation schema-qualified, then `revoke all ... from public, anon, authenticated, service_role` followed by an explicit `grant execute ... to authenticated`. `20260720090850` revokes execute by default, so a function without an explicit grant is unreachable.
- **All user-facing text through Paraglide.** Edit `messages/ru.json` and `messages/en.json`; `ru` is `baseLocale`. Never hardcode English, including in validation messages and API-layer fallbacks. Nothing checks key parity — read the two catalogues against each other.
- **No new dependencies** without explicit approval. This plan adds none.
- **Astryx APIs are not guessable.** `pnpm exec astryx component <Name>` before using one. The props used in this plan were read from `@astryxdesign/core@0.1.8` and are stated inline.
- **`pnpm typecheck` is the minimum check per task.** It runs `pnpm i18n:compile` for you.
- **Commit after every task.** Do not squash tasks together.

---

## Task 0: Fold the three spec corrections into the spec

Research during planning contradicted the spec in three places. Fix the spec first so the two documents cannot drift while the work is executed.

**Files:**
- Modify: `docs/superpowers/specs/2026-08-09-workspace-membership-management-design.md`

- [ ] **Step 1: Correct the actor-FK targets**

The spec's data model gives `invited_by` and `resolved_by` as `→ public.profiles(id)`. The actor-FK convention established by `20260804100000_actor_fks_on_delete_set_null.sql` targets `auth.users(id)` — that migration explicitly dropped and repointed `workspace_members_invited_by_fkey` at `auth.users(id) on delete set null`. Change both rows of the table to:

```
| `invited_by` | uuid | → `auth.users(id)` on delete set null (actor-FK convention, `20260804100000`) |
| `resolved_by` | uuid | → `auth.users(id)` on delete set null |
```

`invited_user_id` stays `→ public.profiles(id) on delete cascade`: it is the subject of the row, and that matches `workspace_members.user_id`.

- [ ] **Step 2: Correct the switcher interaction**

The spec says each invitation row in the switcher carries "Accept / Decline". `DropdownMenu`'s `items` prop accepts only action items `{label, onClick?, icon?, isDisabled?}`, dividers, and sections — a row cannot host two buttons. Replace that sentence with:

> Astryx `DropdownMenu` items are single-action rows, so the accept/decline choice cannot live inside the menu. The switcher shows a `{type: 'section', title: 'Приглашения'}` group with one row per invitation, labelled with the workspace name; activating a row opens an Astryx `Dialog` carrying who invited, at what role, and the Accept / Decline buttons. This is better than the menu-row form regardless: at `menuWidth: 220` two buttons would not fit, and the decision deserves the room.

- [ ] **Step 3: Note that the toast is unconstrained**

Add after the above: the in-app toast body is arbitrary JSX (`showToast({ body: <JSX/> })` returns a dismiss function — see `showMessageNotificationToast`), so the toast *does* carry Accept / Decline inline. The dialog is the switcher's path; the toast is the notification's.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-08-09-workspace-membership-management-design.md
git commit -m "docs: correct actor-FK targets and switcher interaction in membership spec"
```

---

## Task 1: `private.workspace_role`, drop `viewer`, close the creator escalation

The escalation closes here, in the smallest possible change: `handle_new_workspace()` is a SECURITY DEFINER `AFTER INSERT` trigger that already seats the creator as owner, so the client's INSERT policy and grant on `workspace_members` are dead weight.

**Files:**
- Create: `supabase/migrations/20260809130000_membership_role_helper_and_grants.sql`
- Create: `supabase/tests/database/workspace_membership.test.sql`

**Interfaces:**
- Produces: `private.workspace_role(p_workspace_id uuid) returns text` — `'owner' | 'admin' | 'member' | null`. Null for a non-member **and** for any member of a soft-deleted workspace. Every later task authorizes through it.
- Produces: `workspace_members_role_check` now `in ('owner','admin','member')`.
- Produces: `authenticated` holds `SELECT` only on `public.workspace_members`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/workspace_membership.test.sql`. Fixture ids use the `60000000-…` prefix, unused by the other files (they use `00000000`, `50000000`).

```sql
begin;

select plan(4);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('60000000-0000-4000-8000-000000000001', 'mm-owner@example.com',
   '{"full_name":"MM Owner"}'::jsonb),
  ('60000000-0000-4000-8000-000000000002', 'mm-admin@example.com',
   '{"full_name":"MM Admin"}'::jsonb);

insert into public.workspaces (id, name, created_by)
values ('60000000-0000-4000-8000-000000000101', 'MM Workspace',
        '60000000-0000-4000-8000-000000000001');
-- on_workspace_created seated user 001 as owner.

insert into public.workspace_members (workspace_id, user_id, role)
values ('60000000-0000-4000-8000-000000000101',
        '60000000-0000-4000-8000-000000000002', 'admin');

-- ── The role helper ──────────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}';

select is(
  private.workspace_role('60000000-0000-4000-8000-000000000101'),
  'admin',
  'workspace_role returns the caller''s role in a live workspace'
);

reset role;

-- ── The creator escalation is closed ─────────────────────────────────────────
--
-- The creator is removed from their own workspace, then tries the insert the
-- old policy admitted: role = 'owner' on a workspace they created.

delete from public.workspace_members
where workspace_id = '60000000-0000-4000-8000-000000000101'
  and user_id = '60000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$
    insert into public.workspace_members (workspace_id, user_id, role)
    values ('60000000-0000-4000-8000-000000000101',
            '60000000-0000-4000-8000-000000000001', 'owner')
  $$,
  '42501',
  null,
  'a removed creator cannot re-insert themselves as owner'
);

reset role;

select ok(
  not has_table_privilege('authenticated', 'public.workspace_members', 'insert')
  and not has_table_privilege('authenticated', 'public.workspace_members', 'update')
  and not has_table_privilege('authenticated', 'public.workspace_members', 'delete'),
  'authenticated holds select only on workspace_members'
);

-- ── viewer is gone ───────────────────────────────────────────────────────────

select throws_ok(
  $$
    insert into public.workspace_members (workspace_id, user_id, role)
    values ('60000000-0000-4000-8000-000000000101',
            '60000000-0000-4000-8000-000000000002', 'viewer')
  $$,
  '23514',
  null,
  'viewer is no longer an accepted role'
);

select * from finish();

rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm test:db
```

Expected: FAIL — `private.workspace_role` does not exist, and the escalation insert succeeds.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260809130000_membership_role_helper_and_grants.sql`:

```sql
begin;

-- Membership management needs one place that answers "what is this caller
-- allowed to do in this workspace", and three corrections that have to land
-- before any of it is reachable.
--
-- ── Why the INSERT policy and grant go ───────────────────────────────────────
--
-- "Workspace creators can create owner membership" admitted any row where
-- role = 'owner' and workspaces.created_by = auth.uid(). Combined with the
-- workspaces SELECT policy keeping a creator visible through created_by, a
-- creator removed from their own workspace could re-insert themselves as owner.
-- Nothing legitimate needs the grant: public.handle_new_workspace() is a
-- SECURITY DEFINER AFTER INSERT trigger on public.workspaces that seats the
-- creator, and it runs as its owner rather than as the caller.
--
-- ── Why the helper is in private ─────────────────────────────────────────────
--
-- It is internal authorization infrastructure with no client caller. The
-- private schema is not exposed through the Data API, so it can never be
-- reached as an RPC and never appears in src/api/types.ts. The definer RPCs
-- that call it execute as their owner and reach it without authenticated
-- holding USAGE on the schema.
--
-- It must hold definer rights for the reason 20260805090300 documents at
-- length: an invoker-rights read of public.workspaces from inside a function
-- the workspaces SELECT policy itself calls recurses through that policy until
-- the stack limit, and does so only for non-creators. It reads the same two
-- relations as public.is_workspace_member and draws the same boundary --
-- same join, same deleted_at predicate, same (select auth.uid()) identity --
-- so "no role" and "workspace withdrawn" collapse into one null answer.

create or replace function private.workspace_role(p_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select wm.role
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.workspace_id = p_workspace_id
    and wm.user_id = (select auth.uid())
    and w.deleted_at is null;
$$;

comment on function private.workspace_role(uuid) is
  'The calling user''s role in one live workspace, or null when they are not a member or the workspace is soft-deleted. Internal authorization helper for the membership RPCs; lives in private so it is not exposed through the Data API. Draws the same boundary as public.is_workspace_member.';

revoke all on function private.workspace_role(uuid)
  from public, anon, authenticated, service_role;

-- ── viewer is dropped ────────────────────────────────────────────────────────
--
-- No policy has ever distinguished it from member: every check in the schema is
-- either public.is_workspace_member(...) or role in ('owner','admin'). It was a
-- label promising read-only and delivering full member access. Existing rows are
-- migrated rather than left to fail the constraint.

update public.workspace_members
set role = 'member'
where role = 'viewer';

alter table public.workspace_members
  drop constraint if exists workspace_members_role_check;

alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'member'));

-- ── The client loses every write on the roster ───────────────────────────────

drop policy if exists "Workspace creators can create owner membership"
  on public.workspace_members;

revoke insert, update, delete on table public.workspace_members
  from authenticated;

commit;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm test:db
```

Expected: PASS, 4/4 in `workspace_membership.test.sql`. Other files may now fail — `security_contract.test.sql` asserts the old grant set. Leave those; Task 7 fixes them. Note which fail so Task 7 can confirm it fixed exactly those.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260809130000_membership_role_helper_and_grants.sql supabase/tests/database/workspace_membership.test.sql
git commit -m "feat(db): add private.workspace_role, drop viewer, close the creator escalation"
```

---

## Task 2: `create_workspace` RPC and the `created_by` read path

Dropping the `created_by` branch from the `workspaces` SELECT policy is what stops a removed creator keeping a ghost workspace in their switcher. It can only go once the client stops creating workspaces with `INSERT ... RETURNING`.

**Files:**
- Create: `supabase/migrations/20260809140000_create_workspace_rpc.sql`
- Modify: `src/features/workspaces/api/workspaces.ts` (`createWorkspace`, lines ~123-151)
- Modify: `supabase/tests/database/workspace_membership.test.sql`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `public.create_workspace(p_name text, p_description text, p_icon text, p_is_main boolean) returns public.workspaces` — the created row. Raises `22023` on a name outside 2–60 trimmed characters, `23505` on the main-workspace unique violation.
- Produces: `createWorkspace()` in TypeScript keeps its existing signature and return type (`Tables<'workspaces'>`), so `useCreateWorkspace` is untouched.

- [ ] **Step 1: Add the failing tests**

Raise `plan(4)` to `plan(7)` and append before `select * from finish();`:

```sql
-- ── Workspace creation moved behind an RPC ───────────────────────────────────

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}';

select ok(
  not has_table_privilege('authenticated', 'public.workspaces', 'insert'),
  'authenticated can no longer insert workspaces directly'
);

select is(
  (select name from public.create_workspace('RPC Made', null, 'briefcase', false)),
  'RPC Made',
  'create_workspace returns the row it created'
);

select is(
  (
    select wm.role
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where w.name = 'RPC Made'
      and wm.user_id = '60000000-0000-4000-8000-000000000002'
  ),
  'owner',
  'the trigger seated the caller as owner inside the RPC'
);

reset role;
```

Then, to pin the ghost-workspace fix, append after the escalation assertions (the creator has already been removed there):

```sql
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty(
  $$
    select id from public.workspaces
    where id = '60000000-0000-4000-8000-000000000101'
  $$,
  'a removed creator no longer reads the workspace they created'
);

reset role;
```

Raise the plan count to `plan(8)`.

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test:db
```

Expected: FAIL — `create_workspace` does not exist; the removed creator still reads the workspace.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260809140000_create_workspace_rpc.sql`:

```sql
begin;

-- The workspaces SELECT policy carries `created_by = (select auth.uid())` for
-- exactly one reason, documented in 20260803090000: the browser creates a
-- workspace with .insert(...).select(), and for INSERT ... RETURNING Postgres
-- applies the SELECT policy as an extra WITH CHECK inside ExecInsert -- before
-- AFTER ROW triggers fire. public.handle_new_workspace() has therefore not yet
-- seated the owner, and a membership-only policy rejects the creator's own row.
--
-- That migration's header names the trade-off it accepted: "a creator who is
-- removed from workspace_members keeps read access to the workspace row
-- itself... there is no client-reachable path that removes a membership today."
-- Membership management builds that path, so the trade-off has to go. Since
-- getUserWorkspaces() selects public.workspaces with no membership join, a
-- removed creator would otherwise keep a workspace in their switcher that
-- contains nothing they can read.
--
-- A definer RPC removes the ordering problem: it inserts and returns the row
-- with the trigger's membership already committed inside the same statement, so
-- no SELECT policy has to see past it. Modelled on public.complete_onboarding,
-- which has created workspaces this way since 20260726120000.
--
-- The workspaces UPDATE policy is untouched: it is already membership-based
-- (owner/admin via workspace_members), not created_by.

create or replace function public.create_workspace(
  p_name text,
  p_description text default null,
  p_icon text default null,
  p_is_main boolean default false
)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_workspace public.workspaces;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  -- Validated before anything is written, and stated here rather than left to
  -- workspaces_name_length_check alone, so the caller gets a named error rather
  -- than a constraint name. The bounds match complete_onboarding's.
  if v_name is null
    or char_length(v_name) < 2
    or char_length(v_name) > 60
  then
    raise exception 'INVALID_WORKSPACE_NAME' using errcode = '22023';
  end if;

  insert into public.workspaces (name, description, icon, is_main, created_by)
  values (
    v_name,
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_icon, '')), ''),
    coalesce(p_is_main, false),
    v_user_id
  )
  returning * into v_workspace;

  -- public.handle_new_workspace() has now seated v_user_id as owner, in this
  -- same transaction. Unlike complete_onboarding this does not swallow a
  -- unique_violation on one_main_workspace_per_user: this function is called
  -- from an explicit "create workspace" action, and silently handing back a
  -- different workspace than the one the caller asked to create would be a
  -- worse answer than the error.
  return v_workspace;
end;
$$;

comment on function public.create_workspace(text, text, text, boolean) is
  'Creates a workspace and returns it, with the caller seated as owner by the on_workspace_created trigger. Exists so the browser never issues INSERT ... RETURNING on public.workspaces, which is what forced the created_by branch into the workspaces SELECT policy.';

revoke all on function public.create_workspace(text, text, text, boolean)
  from public, anon, authenticated, service_role;

grant execute on function public.create_workspace(text, text, text, boolean)
  to authenticated;

-- With creation behind the RPC, the direct insert path and the created_by read
-- branch both go.

drop policy if exists "Users can create workspaces" on public.workspaces;

revoke insert on table public.workspaces from authenticated;

drop policy if exists "Workspace members can view active workspaces"
  on public.workspaces;

create policy "Workspace members can view active workspaces"
  on public.workspaces
  for select
  to authenticated
  using (
    deleted_at is null
    and public.is_workspace_member(id)
  );

commit;
```

- [ ] **Step 4: Switch the client to the RPC**

In `src/features/workspaces/api/workspaces.ts`, replace the body of `createWorkspace` (the `insertPayload` block through `return data`) with:

```ts
export async function createWorkspace({
  description,
  icon,
  isMain,
  name,
}: CreateWorkspaceFormValues & { isMain: boolean; userId: string }) {
  // Not an insert: public.workspaces has no INSERT grant for authenticated.
  // The RPC exists so the browser never issues INSERT ... RETURNING here — see
  // the header of 20260809140000. `userId` stays in the parameter list because
  // useCreateWorkspace passes it, but identity comes from auth.uid() inside the
  // function and cannot be supplied by the caller.
  const { data, error } = await supabase.rpc('create_workspace', {
    p_name: name.trim(),
    p_description: normalizeDescription(description),
    p_icon: icon ?? null,
    p_is_main: isMain,
  })

  if (error) {
    throw error
  }

  return data
}
```

`TablesInsert` may now be unused in the import on line 1 — remove it if `pnpm typecheck` reports it.

- [ ] **Step 5: Run both checks**

```bash
pnpm test:db
pnpm typecheck
```

Expected: `workspace_membership.test.sql` 8/8. `typecheck` will fail on `create_workspace` not existing in `src/api/types.ts` — that is expected and is fixed in Task 7, which regenerates types. Record the failure and continue.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260809140000_create_workspace_rpc.sql src/features/workspaces/api/workspaces.ts supabase/tests/database/workspace_membership.test.sql
git commit -m "feat(db): create workspaces through an RPC and drop the created_by read branch"
```

---

## Task 3: The `workspace_invitations` table

**Files:**
- Create: `supabase/migrations/20260809150000_workspace_invitations.sql`
- Modify: `supabase/tests/database/workspace_membership.test.sql`

**Interfaces:**
- Produces: `public.workspace_invitations` with columns `id, workspace_id, invited_user_id, invited_email, invited_by, role, status, created_at, resolved_at, resolved_by`.
- Produces: partial unique index `workspace_invitations_pending_key on (workspace_id, invited_user_id) where status = 'pending'` — Task 4's upsert infers this exact index.
- Produces: `authenticated` holds `SELECT` only, under policy `invited_user_id = (select auth.uid()) and status = 'pending'`.

- [ ] **Step 1: Add the failing tests**

Raise the plan to `plan(11)` and append before `finish()`:

```sql
-- ── The invitations table ────────────────────────────────────────────────────

select ok(
  has_table_privilege('authenticated', 'public.workspace_invitations', 'select')
  and not has_table_privilege('authenticated', 'public.workspace_invitations', 'insert')
  and not has_table_privilege('authenticated', 'public.workspace_invitations', 'update')
  and not has_table_privilege('authenticated', 'public.workspace_invitations', 'delete'),
  'authenticated may read invitations and write none'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.workspace_invitations'::regclass
  ),
  'RLS is enabled on workspace_invitations'
);

-- Realtime cannot deliver an event for a table outside the publication, and the
-- invitee's notification depends on it.
select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workspace_invitations'
  ),
  'workspace_invitations is in the supabase_realtime publication'
);
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test:db
```

Expected: FAIL — relation `public.workspace_invitations` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260809150000_workspace_invitations.sql`:

```sql
begin;

-- A pending invitation addressed to somebody who already has a Rezzy account.
--
-- Only registered users can be invited, so this table holds a resolved user id
-- rather than an unresolved address with a token. There is no invite link, no
-- expiry, and no email delivery: the invitee is notified in-app and accepts or
-- rejects from the workspace switcher.
--
-- ── Why invited_email is stored ──────────────────────────────────────────────
--
-- The address is resolved from auth.users at invite time and kept, rather than
-- joined from public.profiles for display. profiles.email has no unique index
-- and authenticated holds a table-wide UPDATE grant on profiles, so any user can
-- set their profiles.email to a colleague's address. Rendering the admin's
-- pending list from that column would show an address nobody verified.
--
-- ── Why there is a SELECT grant at all ───────────────────────────────────────
--
-- Every write goes through a definer RPC and there is no INSERT/UPDATE/DELETE
-- grant. SELECT is different: postgres_changes evaluates RLS as the subscribing
-- user, so a table with no SELECT policy delivers no realtime event, and the
-- invitee would never be notified that they had been invited. The policy is
-- scoped to the caller's own pending rows -- not other people's invitations, not
-- their own resolved history, and nothing about the workspace beyond what these
-- columns carry.
--
-- Because realtime evaluates the policy against the new record, an UPDATE that
-- moves status out of 'pending' fails the policy and is never delivered. That is
-- deliberate: accept, reject and revoke must not raise a notification. The
-- client still checks status itself; a policy predicate quietly doing double
-- duty as presentation logic is how the two drift apart.

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  invited_user_id uuid not null
    references public.profiles (id) on delete cascade,
  invited_email text not null,
  -- Actor columns follow 20260804100000: auth.users, ON DELETE SET NULL, so an
  -- actor who deletes their account does not delete the history row.
  invited_by uuid references auth.users (id) on delete set null,
  resolved_by uuid references auth.users (id) on delete set null,
  role text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint workspace_invitations_role_check
    check (role in ('admin', 'member')),
  constraint workspace_invitations_status_check
    check (status in ('pending', 'accepted', 'rejected', 'revoked')),
  -- A resolved row records when; a pending row has not been resolved.
  constraint workspace_invitations_resolved_at_check
    check ((status = 'pending') = (resolved_at is null))
);

comment on table public.workspace_invitations is
  'Pending and historical invitations of existing Rezzy users into a workspace. Written only by the invite/respond/revoke RPCs; authenticated may read its own pending rows so realtime can deliver them.';

comment on column public.workspace_invitations.invited_email is
  'The address resolved from auth.users at invite time. Stored rather than joined from profiles.email, which is user-writable and unverified.';

-- One live invitation per (workspace, user). This is what makes "re-inviting
-- updates the existing row" a constraint rather than a convention, and it is the
-- index the invite RPC's ON CONFLICT infers -- the predicate below must match
-- that clause exactly.
create unique index workspace_invitations_pending_key
  on public.workspace_invitations (workspace_id, invited_user_id)
  where status = 'pending';

-- The invitee's own list, read on every app load.
create index workspace_invitations_invitee_pending_idx
  on public.workspace_invitations (invited_user_id)
  where status = 'pending';

-- The members page, and the workspace cascade delete.
create index workspace_invitations_workspace_status_idx
  on public.workspace_invitations (workspace_id, status);

-- FK-supporting indexes, named for the convention performance_contract.test.sql
-- enumerates. Both parents are ON DELETE SET NULL, so an account deletion scans
-- these rather than the table.
create index workspace_invitations_invited_by_fkey_idx
  on public.workspace_invitations (invited_by);

create index workspace_invitations_resolved_by_fkey_idx
  on public.workspace_invitations (resolved_by);

alter table public.workspace_invitations enable row level security;

revoke all on table public.workspace_invitations
  from anon, authenticated, service_role;

grant select on table public.workspace_invitations to authenticated;
grant select, insert, update, delete on table public.workspace_invitations
  to service_role;

create policy "Invitees can read their own pending invitations"
  on public.workspace_invitations
  for select
  to authenticated
  using (
    invited_user_id = (select auth.uid())
    and status = 'pending'
  );

-- Without this the invitee's realtime subscription is silently inert.
alter publication supabase_realtime add table public.workspace_invitations;

commit;
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm test:db
```

Expected: `workspace_membership.test.sql` 11/11.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260809150000_workspace_invitations.sql supabase/tests/database/workspace_membership.test.sql
git commit -m "feat(db): add workspace_invitations with a scoped invitee read policy"
```

---

## Task 4: Invite, revoke, and the two list RPCs

**Files:**
- Create: `supabase/migrations/20260809160000_invitation_rpcs.sql`
- Modify: `supabase/tests/database/workspace_membership.test.sql`

**Interfaces:**
- Consumes: `private.workspace_role(uuid)` (Task 1); `workspace_invitations_pending_key` (Task 3).
- Produces:
  - `public.invite_workspace_member(p_workspace_id uuid, p_email text, p_role text) returns uuid`
  - `public.revoke_workspace_invitation(p_invitation_id uuid) returns void`
  - `public.list_my_workspace_invitations() returns table (id uuid, workspace_id uuid, workspace_name text, workspace_icon text, role text, invited_by_name text, created_at timestamptz)`
  - `public.list_workspace_invitations(p_workspace_id uuid) returns table (id uuid, invited_email text, invited_name text, role text, invited_by_name text, created_at timestamptz)`
- Error tokens raised as the exception *message*, with the errcode in brackets: `NOT_A_WORKSPACE_ADMIN` (42501), `USER_NOT_FOUND` (P0002), `ALREADY_A_MEMBER` (42710), `CANNOT_INVITE_SELF` (22023), `INVALID_ROLE` (22023), `INVITATION_NOT_FOUND` (P0002).

- [ ] **Step 1: Add the failing tests**

Raise the plan to `plan(17)` and append before `finish()`:

```sql
-- ── Inviting ─────────────────────────────────────────────────────────────────

insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-4000-8000-000000000003', 'mm-invitee@example.com',
        '{"full_name":"MM Invitee"}'::jsonb);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$
    select public.invite_workspace_member(
      '60000000-0000-4000-8000-000000000101', 'nobody@example.com', 'member')
  $$,
  'P0002',
  'USER_NOT_FOUND',
  'inviting an address no user holds is refused'
);

select is(
  (select count(*)::int from public.workspace_invitations),
  0,
  'and writes nothing'
);

select throws_ok(
  $$
    select public.invite_workspace_member(
      '60000000-0000-4000-8000-000000000101', 'MM-Owner@Example.com ', 'member')
  $$,
  '42710',
  'ALREADY_A_MEMBER',
  'inviting an existing member is refused, and the lookup is case- and space-insensitive'
);

select throws_ok(
  $$
    select public.invite_workspace_member(
      '60000000-0000-4000-8000-000000000101', 'mm-admin@example.com', 'member')
  $$,
  '22023',
  'CANNOT_INVITE_SELF',
  'inviting yourself is refused'
);

select throws_ok(
  $$
    select public.invite_workspace_member(
      '60000000-0000-4000-8000-000000000101', 'mm-invitee@example.com', 'owner')
  $$,
  '22023',
  'INVALID_ROLE',
  'an invitation cannot grant owner'
);

select lives_ok(
  $$
    select public.invite_workspace_member(
      '60000000-0000-4000-8000-000000000101', 'mm-invitee@example.com', 'member')
  $$,
  'an admin can invite an existing user'
);

-- Re-invite: same row, new role, no second pending invitation, no 23505.
select public.invite_workspace_member(
  '60000000-0000-4000-8000-000000000101', 'mm-invitee@example.com', 'admin');

select results_eq(
  $$
    select count(*)::int, max(role)
    from public.workspace_invitations
    where status = 'pending'
  $$,
  $$ values (1, 'admin') $$,
  're-inviting updates the pending row rather than creating a second'
);

reset role;
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test:db
```

Expected: FAIL — `invite_workspace_member` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260809160000_invitation_rpcs.sql`:

```sql
begin;

-- Creating, revoking and reading invitations. Every function authorizes through
-- private.workspace_role, which returns null for a soft-deleted workspace, so
-- none of them needs its own deleted_at predicate.
--
-- Errors are raised with a machine-readable token as the message and a
-- meaningful errcode, matching the convention public.list_workspace_members and
-- public.archive_contact established. The client maps the token to a localized
-- string; nothing here is user-facing text.

create or replace function public.invite_workspace_member(
  p_workspace_id uuid,
  p_email text,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_role text := private.workspace_role(p_workspace_id);
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_invitee uuid;
  v_invitation_id uuid;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'NOT_A_WORKSPACE_ADMIN' using errcode = '42501';
  end if;

  -- Owner is deliberately not invitable: only an owner may grant it, and
  -- keeping that rule in update_workspace_member_role alone means one place
  -- enforces it. An owner who wants a second owner invites, then promotes.
  if p_role is null or p_role not in ('admin', 'member') then
    raise exception 'INVALID_ROLE' using errcode = '22023';
  end if;

  -- auth.users, not public.profiles. profiles.email is user-writable under a
  -- table-wide UPDATE grant and has no unique index, so resolving there would
  -- let a user redirect a colleague's invitation to themselves. GoTrue stores
  -- this lowercased and keeps it uniquely indexed.
  select u.id
  into v_invitee
  from auth.users u
  where lower(u.email) = v_email
    and u.deleted_at is null;

  if v_invitee is null then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_invitee = v_actor then
    raise exception 'CANNOT_INVITE_SELF' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = v_invitee
  ) then
    raise exception 'ALREADY_A_MEMBER' using errcode = '42710';
  end if;

  -- One statement, inferring workspace_invitations_pending_key. A read followed
  -- by an insert or update loses the race between two admins inviting the same
  -- person, and hands whichever arrives second a raw 23505. The WHERE clause
  -- must match the index predicate exactly for the inference to resolve.
  --
  -- created_at is bumped on re-invite and that is load-bearing beyond ordering:
  -- the client keys notification presentation on id + created_at, because a
  -- re-invite carries the same primary key as the row it replaces and would
  -- otherwise be swallowed by the notification deduper.
  insert into public.workspace_invitations
    (workspace_id, invited_user_id, invited_email, invited_by, role)
  values
    (p_workspace_id, v_invitee, v_email, v_actor, p_role)
  on conflict (workspace_id, invited_user_id) where status = 'pending'
  do update set
    role = excluded.role,
    invited_by = excluded.invited_by,
    invited_email = excluded.invited_email,
    created_at = now()
  returning id into v_invitation_id;

  return v_invitation_id;
end;
$$;

comment on function public.invite_workspace_member(uuid, text, text) is
  'Invites an existing registered user into a workspace, resolving the address against auth.users. Re-inviting somebody who already has a pending invitation updates that row atomically. Owner/admin only.';

revoke all on function public.invite_workspace_member(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.invite_workspace_member(uuid, text, text)
  to authenticated;

create or replace function public.revoke_workspace_invitation(
  p_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_workspace_id uuid;
  v_actor_role text;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select wi.workspace_id
  into v_workspace_id
  from public.workspace_invitations wi
  where wi.id = p_invitation_id
    and wi.status = 'pending';

  if v_workspace_id is null then
    raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_actor_role := private.workspace_role(v_workspace_id);

  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'NOT_A_WORKSPACE_ADMIN' using errcode = '42501';
  end if;

  update public.workspace_invitations
  set status = 'revoked',
      resolved_at = now(),
      resolved_by = v_actor
  where id = p_invitation_id
    and status = 'pending';
end;
$$;

comment on function public.revoke_workspace_invitation(uuid) is
  'Withdraws a pending invitation. Owner/admin of the invitation''s workspace only.';

revoke all on function public.revoke_workspace_invitation(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.revoke_workspace_invitation(uuid)
  to authenticated;

-- ── Reads ────────────────────────────────────────────────────────────────────

create or replace function public.list_my_workspace_invitations()
returns table (
  id uuid,
  workspace_id uuid,
  workspace_name text,
  workspace_icon text,
  role text,
  invited_by_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  -- The invitee is not a member of this workspace yet, so
  -- private.workspace_role returns null for them and cannot carry the
  -- soft-delete boundary here. The join to public.workspaces does it instead --
  -- without it, an invitation into a withdrawn workspace stays acceptable.
  return query
  select
    wi.id,
    wi.workspace_id,
    w.name,
    w.icon,
    wi.role,
    p.full_name,
    wi.created_at
  from public.workspace_invitations wi
  join public.workspaces w on w.id = wi.workspace_id
  left join public.profiles p on p.id = wi.invited_by
  where wi.invited_user_id = v_actor
    and wi.status = 'pending'
    and w.deleted_at is null
  order by wi.created_at desc, wi.id asc;
end;
$$;

comment on function public.list_my_workspace_invitations() is
  'The calling user''s pending invitations, with the workspace and inviter names they cannot read directly. Excludes soft-deleted workspaces.';

revoke all on function public.list_my_workspace_invitations()
  from public, anon, authenticated, service_role;
grant execute on function public.list_my_workspace_invitations()
  to authenticated;

create or replace function public.list_workspace_invitations(
  p_workspace_id uuid
)
returns table (
  id uuid,
  invited_email text,
  invited_name text,
  role text,
  invited_by_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_role text := private.workspace_role(p_workspace_id);
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  -- Owner/admin rather than any member, because this returns email addresses.
  -- public.list_workspace_members deliberately withholds them from colleagues
  -- (see 20260731183000), and this must not become the way around that.
  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'NOT_A_WORKSPACE_ADMIN' using errcode = '42501';
  end if;

  return query
  select
    wi.id,
    wi.invited_email,
    invitee.full_name,
    wi.role,
    inviter.full_name,
    wi.created_at
  from public.workspace_invitations wi
  join public.profiles invitee on invitee.id = wi.invited_user_id
  left join public.profiles inviter on inviter.id = wi.invited_by
  where wi.workspace_id = p_workspace_id
    and wi.status = 'pending'
  order by wi.created_at desc, wi.id asc;
end;
$$;

comment on function public.list_workspace_invitations(uuid) is
  'Pending invitations for one workspace, for the members settings page. Owner/admin only: it returns email addresses, which list_workspace_members deliberately withholds.';

revoke all on function public.list_workspace_invitations(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.list_workspace_invitations(uuid)
  to authenticated;

commit;
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm test:db
```

Expected: `workspace_membership.test.sql` 17/17.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260809160000_invitation_rpcs.sql supabase/tests/database/workspace_membership.test.sql
git commit -m "feat(db): add invite, revoke and invitation list RPCs"
```

---

## Task 5: Accepting and rejecting an invitation

**Files:**
- Create: `supabase/migrations/20260809170000_respond_to_invitation.sql`
- Modify: `supabase/tests/database/workspace_membership.test.sql`

**Interfaces:**
- Consumes: the invitations table and its statuses.
- Produces: `public.respond_to_workspace_invitation(p_invitation_id uuid, p_accept boolean) returns uuid` — returns the workspace id on accept, null on reject. Raises `INVITATION_NOT_FOUND` (P0002) for every failure.

- [ ] **Step 1: Add the failing tests**

Raise the plan to `plan(21)` and append before `finish()` (a pending `admin` invitation for user 003 exists from Task 4):

```sql
-- ── Responding ───────────────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$
    select public.respond_to_workspace_invitation(
      (select id from public.workspace_invitations where status = 'pending'),
      true)
  $$,
  'P0002',
  'INVITATION_NOT_FOUND',
  'somebody who is not the invitee cannot accept the invitation'
);

set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000003","role":"authenticated"}';

select lives_ok(
  $$
    select public.respond_to_workspace_invitation(
      (select id from public.workspace_invitations where status = 'pending'),
      true)
  $$,
  'the invitee accepts'
);

reset role;

select results_eq(
  $$
    select wm.role, wm.invited_by
    from public.workspace_members wm
    where wm.workspace_id = '60000000-0000-4000-8000-000000000101'
      and wm.user_id = '60000000-0000-4000-8000-000000000003'
  $$,
  $$ values ('admin', '60000000-0000-4000-8000-000000000002'::uuid) $$,
  'acceptance seats them at the invited role, carrying invited_by'
);

select results_eq(
  $$
    select status, resolved_by
    from public.workspace_invitations
    where invited_user_id = '60000000-0000-4000-8000-000000000003'
  $$,
  $$ values ('accepted', '60000000-0000-4000-8000-000000000003'::uuid) $$,
  'and stamps the invitation'
);
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test:db
```

Expected: FAIL — `respond_to_workspace_invitation` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260809170000_respond_to_invitation.sql`:

```sql
begin;

-- The invitee's own decision. Accepting seats them and stamps the invitation in
-- one transaction, so a workspace_members row cannot exist next to an
-- invitation that still reads pending.
--
-- Every failure -- not yours, not pending, workspace withdrawn, no such row --
-- raises the same INVITATION_NOT_FOUND. Distinguishing them would tell a caller
-- whether an invitation they do not hold exists, which is exactly the question
-- the scoped SELECT policy refuses to answer.
--
-- private.workspace_role cannot authorize this one: the invitee is by
-- definition not a member yet, so it returns null for them. The join to
-- public.workspaces carries the soft-delete boundary instead.

create or replace function public.respond_to_workspace_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_invitation public.workspace_invitations;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  -- FOR UPDATE so two tabs cannot both accept and race the membership insert
  -- into a unique violation on workspace_members_workspace_user_key.
  select wi.*
  into v_invitation
  from public.workspace_invitations wi
  join public.workspaces w on w.id = wi.workspace_id
  where wi.id = p_invitation_id
    and wi.invited_user_id = v_actor
    and wi.status = 'pending'
    and w.deleted_at is null
  for update of wi;

  if v_invitation.id is null then
    raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not coalesce(p_accept, false) then
    update public.workspace_invitations
    set status = 'rejected',
        resolved_at = now(),
        resolved_by = v_actor
    where id = v_invitation.id;

    return null;
  end if;

  -- invited_by is carried from the invitation rather than set to the accepting
  -- user: the column records who brought them in. This is the only writer of
  -- workspace_members.invited_by in the schema.
  insert into public.workspace_members (workspace_id, user_id, role, invited_by)
  values (
    v_invitation.workspace_id,
    v_actor,
    v_invitation.role,
    v_invitation.invited_by
  );

  update public.workspace_invitations
  set status = 'accepted',
      resolved_at = now(),
      resolved_by = v_actor
  where id = v_invitation.id;

  return v_invitation.workspace_id;
end;
$$;

comment on function public.respond_to_workspace_invitation(uuid, boolean) is
  'The invitee accepts or rejects their own pending invitation. Accepting seats them and stamps the invitation in one transaction. Every failure is INVITATION_NOT_FOUND so the function reveals nothing about invitations addressed to others.';

revoke all on function public.respond_to_workspace_invitation(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.respond_to_workspace_invitation(uuid, boolean)
  to authenticated;

commit;
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm test:db
```

Expected: `workspace_membership.test.sql` 21/21.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260809170000_respond_to_invitation.sql supabase/tests/database/workspace_membership.test.sql
git commit -m "feat(db): let invitees accept or reject their own invitation"
```

---

## Task 6: Role changes and removal, under the roster lock

The highest-risk task. Two authorization races, both invisible to a single-session test.

**Files:**
- Create: `supabase/migrations/20260809180000_membership_mutation_rpcs.sql`
- Modify: `supabase/tests/database/workspace_membership.test.sql`

**Interfaces:**
- Consumes: `private.workspace_role(uuid)`.
- Produces:
  - `public.update_workspace_member_role(p_workspace_id uuid, p_user_id uuid, p_role text) returns void`
  - `public.remove_workspace_member(p_workspace_id uuid, p_user_id uuid) returns void`
- Error tokens: `NOT_A_WORKSPACE_ADMIN` (42501), `MEMBER_NOT_FOUND` (P0002), `OWNER_ROLE_REQUIRES_OWNER` (42501), `LAST_OWNER` (23514), `INVALID_ROLE` (22023).

- [ ] **Step 1: Add the failing tests**

Raise the plan to `plan(27)` and append before `finish()`. At this point workspace `…101` has owner `…001`? No — `…001` was removed by the escalation test. Re-seat deterministically first:

```sql
-- ── Role changes and removal ─────────────────────────────────────────────────
--
-- Roster at this point: 002 admin (seeded), 003 admin (accepted). The workspace
-- has no owner, because the escalation test removed the creator. Seat one
-- directly -- at the owning role, which is the only writer left.

insert into public.workspace_members (workspace_id, user_id, role)
values ('60000000-0000-4000-8000-000000000101',
        '60000000-0000-4000-8000-000000000001', 'owner');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$
    select public.update_workspace_member_role(
      '60000000-0000-4000-8000-000000000101',
      '60000000-0000-4000-8000-000000000001', 'member')
  $$,
  '42501',
  'OWNER_ROLE_REQUIRES_OWNER',
  'an admin cannot demote an owner'
);

select throws_ok(
  $$
    select public.update_workspace_member_role(
      '60000000-0000-4000-8000-000000000101',
      '60000000-0000-4000-8000-000000000003', 'owner')
  $$,
  '42501',
  'OWNER_ROLE_REQUIRES_OWNER',
  'nor promote anyone to owner'
);

select throws_ok(
  $$
    select public.remove_workspace_member(
      '60000000-0000-4000-8000-000000000101',
      '60000000-0000-4000-8000-000000000001')
  $$,
  '42501',
  'OWNER_ROLE_REQUIRES_OWNER',
  'nor remove an owner'
);

select lives_ok(
  $$
    select public.update_workspace_member_role(
      '60000000-0000-4000-8000-000000000101',
      '60000000-0000-4000-8000-000000000003', 'member')
  $$,
  'an admin can move another admin down to member'
);

-- The last owner is immovable, by any path.

set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$
    select public.update_workspace_member_role(
      '60000000-0000-4000-8000-000000000101',
      '60000000-0000-4000-8000-000000000001', 'admin')
  $$,
  '23514',
  'LAST_OWNER',
  'the last owner cannot demote themselves'
);

select throws_ok(
  $$
    select public.remove_workspace_member(
      '60000000-0000-4000-8000-000000000101',
      '60000000-0000-4000-8000-000000000001')
  $$,
  '23514',
  'LAST_OWNER',
  'nor leave'
);

reset role;
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test:db
```

Expected: FAIL — `update_workspace_member_role` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260809180000_membership_mutation_rpcs.sql`:

```sql
begin;

-- Changing a role and removing a member. Both are the same shape and both have
-- the same two races, so they open identically.
--
-- ── Why one lock statement rather than two ───────────────────────────────────
--
-- Two things must not move while these functions decide:
--
--   The target's role. An admin reads the target as 'member' and, while the
--   decision is being made, an owner promotes that same user to 'owner'. The
--   admin's write then lands on an owner's row -- exactly what
--   OWNER_ROLE_REQUIRES_OWNER exists to prevent.
--
--   The owner count. Two concurrent demotions each read two owners, both
--   succeed, and the workspace reaches zero owners.
--
-- Locking the target row and then the owner set deadlocks against itself as
-- soon as the target is an owner: a transaction demoting owner A holds A and
-- asks for the set containing B, while a concurrent transaction demoting B
-- holds B and asks for the set containing A. So both functions take one
-- statement over the whole roster, ordered, which covers the target row and the
-- owner set together and gives concurrent callers a single scan order to
-- serialize on. A workspace roster is tens of rows; the cost is irrelevant.
--
-- Every read after that -- the target's role, the owner count -- runs inside
-- the lock and observes a roster nobody else can move.

create or replace function public.update_workspace_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_role text := private.workspace_role(p_workspace_id);
  v_target_role text;
  v_owner_count integer;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'NOT_A_WORKSPACE_ADMIN' using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('owner', 'admin', 'member') then
    raise exception 'INVALID_ROLE' using errcode = '22023';
  end if;

  perform 1
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
  order by wm.user_id
  for update;

  select wm.role
  into v_target_role
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = p_user_id;

  if v_target_role is null then
    raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Only an owner may hand the role out or take it away. An admin is refused
  -- both for granting it and for touching a row that already holds it.
  if (p_role = 'owner' or v_target_role = 'owner')
    and v_actor_role <> 'owner'
  then
    raise exception 'OWNER_ROLE_REQUIRES_OWNER' using errcode = '42501';
  end if;

  if v_target_role = p_role then
    return;
  end if;

  if v_target_role = 'owner' then
    select count(*)
    into v_owner_count
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'LAST_OWNER' using errcode = '23514';
    end if;
  end if;

  update public.workspace_members
  set role = p_role
  where workspace_id = p_workspace_id
    and user_id = p_user_id;
end;
$$;

comment on function public.update_workspace_member_role(uuid, uuid, text) is
  'Changes a member''s role. Owners and admins may move member <-> admin; only an owner may grant or remove owner. A workspace can never reach zero owners. Locks the roster before reading the target''s role so a concurrent promotion cannot slip under the authorization check.';

revoke all on function public.update_workspace_member_role(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_workspace_member_role(uuid, uuid, text)
  to authenticated;

create or replace function public.remove_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_role text := private.workspace_role(p_workspace_id);
  v_target_role text;
  v_owner_count integer;
  v_is_self boolean;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if v_actor_role is null then
    raise exception 'NOT_A_WORKSPACE_ADMIN' using errcode = '42501';
  end if;

  v_is_self := (p_user_id = v_actor);

  -- Leaving is removing yourself, so a plain member needs no admin rights for
  -- it -- but they may not remove anybody else.
  if not v_is_self and v_actor_role not in ('owner', 'admin') then
    raise exception 'NOT_A_WORKSPACE_ADMIN' using errcode = '42501';
  end if;

  perform 1
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
  order by wm.user_id
  for update;

  select wm.role
  into v_target_role
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = p_user_id;

  if v_target_role is null then
    raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_target_role = 'owner' and v_actor_role <> 'owner' then
    raise exception 'OWNER_ROLE_REQUIRES_OWNER' using errcode = '42501';
  end if;

  if v_target_role = 'owner' then
    select count(*)
    into v_owner_count
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'LAST_OWNER' using errcode = '23514';
    end if;
  end if;

  -- trg_clear_assignments_for_removed_member (20260805090400) clears
  -- conversations.assigned_to and contacts.owner_id on this delete. It shipped
  -- ahead of this path deliberately; nothing more is needed here.
  delete from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = p_user_id;
end;
$$;

comment on function public.remove_workspace_member(uuid, uuid) is
  'Removes a member, or removes the caller (leaving). Owners and admins may remove others; only an owner may remove an owner; the last owner can neither be removed nor leave.';

revoke all on function public.remove_workspace_member(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.remove_workspace_member(uuid, uuid)
  to authenticated;

commit;
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm test:db
```

Expected: `workspace_membership.test.sql` 27/27.

- [ ] **Step 5: Record the concurrency gap**

Nothing in `supabase/tests/database/` runs more than one session — no `dblink`, every file a single transaction ending in `rollback`. The two races above are therefore **not** covered by the tests written here, and a single-session test cannot cover them.

Do not paper over it. Append this to `workspace_membership.test.sql` after the role assertions (and raise the plan to `plan(29)`):

```sql
-- ── The concurrency invariants, as far as one session can pin them ───────────
--
-- The real races -- a promotion landing between an admin's role read and their
-- write, and two demotions both seeing two owners -- need two sessions.
-- Nothing in this suite runs more than one, and introducing dblink for it is a
-- new extension on the project that has not been agreed. So these assert that
-- the mechanism which prevents them is present, and the file records that the
-- interleaving itself is unverified. A test that appeared to cover the race and
-- did not would be worse: the next person deletes the lock and stays green.

select ok(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in
        ('update_workspace_member_role', 'remove_workspace_member')
      and p.prosrc like '%order by wm.user_id%for update%'
  ) = 2,
  'both mutation RPCs lock the whole roster in user_id order before deciding'
);

select ok(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'invite_workspace_member'
      and p.prosrc like '%on conflict (workspace_id, invited_user_id) where status = ''pending''%'
  ) = 1,
  're-invite is one statement inferring the partial unique index'
);
```

- [ ] **Step 6: Run and commit**

```bash
pnpm test:db
```

Expected: 29/29.

```bash
git add supabase/migrations/20260809180000_membership_mutation_rpcs.sql supabase/tests/database/workspace_membership.test.sql
git commit -m "feat(db): add role change and removal RPCs under a deterministic roster lock"
```

---

## Task 7: Retire `soft_delete_workspace` from the API, repair the contract tests, regenerate types

**Files:**
- Create: `supabase/migrations/20260809190000_retire_soft_delete_from_data_api.sql`
- Modify: `supabase/tests/database/security_contract.test.sql`
- Modify: `supabase/tests/database/performance_contract.test.sql`
- Modify: `supabase/tests/database/workspace_lifecycle.test.sql`
- Regenerate: `src/api/types.ts`

**Interfaces:**
- Produces: `private.soft_delete_workspace(uuid)` — same body, no longer in the Data API or in `src/api/types.ts`.
- Produces: `src/api/types.ts` containing the seven new RPCs and `workspace_invitations`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260809190000_retire_soft_delete_from_data_api.sql`:

```sql
begin;

-- soft_delete_workspace is REVOKEd from PUBLIC and granted to no role, and
-- supabase/tests/database/workspace_lifecycle.test.sql records that as
-- deliberate. It nonetheless appeared in src/api/types.ts as a callable RPC,
-- because that file is generated from whatever the Data API exposes -- so the
-- client surface advertised an operation the database refuses.
--
-- Moving it out of public is what removes it from generation. It stays callable
-- at the owning role, exactly as today, and its ownership check is unchanged.
-- Deleting a workspace remains unreachable from the browser until someone
-- deliberately builds it.

alter function public.soft_delete_workspace(uuid) set schema private;

commit;
```

- [ ] **Step 2: Update `workspace_lifecycle.test.sql`**

Two edits. Replace both `public.soft_delete_workspace(` call sites with `private.soft_delete_workspace(`. Then correct the comment at lines ~373-379, which states removal is unreachable:

```sql
-- ── Removing somebody from the roster ────────────────────────────────────────
--
-- Reachable from the browser since 20260809180000, through
-- public.remove_workspace_member. This file still exercises the raw DELETE,
-- because what it is testing is the trigger beneath that RPC:
-- contacts.owner_id and conversations.assigned_to are guarded on write against
-- the roster, and nothing re-checked them when the roster changed underneath.
-- The RPC's own authorization is covered in workspace_membership.test.sql.
```

Also update the comment at lines ~159-164 that explains why the function is called at the owning role, to name the new schema.

- [ ] **Step 3: Update `security_contract.test.sql`**

Four changes:

1. In both definer-function lists (lines ~49-61 and ~83-95), replace `('public.soft_delete_workspace(uuid)')` with `('private.soft_delete_workspace(uuid)')` if the query is schema-agnostic; if it filters `nspname = 'public'`, remove the row and let the private-schema assertion cover it. Read the surrounding query before deciding.
2. Add the six new `public` definer functions to the same lists: `create_workspace(text,text,text,boolean)`, `invite_workspace_member(uuid,text,text)`, `respond_to_workspace_invitation(uuid,boolean)`, `revoke_workspace_invitation(uuid)`, `update_workspace_member_role(uuid,uuid,text)`, `remove_workspace_member(uuid,uuid)`, `list_my_workspace_invitations()`, `list_workspace_invitations(uuid)`.
3. In all three `user_rpcs(signature)` blocks (lines ~123-128, ~147-152, ~171-176), add the same eight signatures — they are the RPCs `authenticated` may now execute and `anon` may not.
4. Add `('public.workspace_invitations')` to the `exposed_tables` list at line ~409 so the anon-has-no-privileges assertion covers it.

Then add an assertion that the roster is read-only for the client:

```sql
select ok(
  has_table_privilege('authenticated', 'public.workspace_members', 'select')
  and not has_table_privilege('authenticated', 'public.workspace_members', 'insert')
  and not has_table_privilege('authenticated', 'public.workspace_members', 'update')
  and not has_table_privilege('authenticated', 'public.workspace_members', 'delete'),
  'authenticated reads the roster and writes it only through the membership RPCs'
);

select ok(
  not has_table_privilege('authenticated', 'public.workspaces', 'insert'),
  'workspaces are created through create_workspace, not by direct insert'
);
```

Raise that file's `plan(N)` by the number of assertions added.

- [ ] **Step 4: Update `performance_contract.test.sql`**

Add two rows to the `expected_indexes(table_name, index_name, column_name)` values list at line ~95:

```sql
    (
      'workspace_invitations',
      'workspace_invitations_invited_by_fkey_idx',
      'invited_by'
    ),
    (
      'workspace_invitations',
      'workspace_invitations_resolved_by_fkey_idx',
      'resolved_by'
    ),
```

- [ ] **Step 5: Reset, run the whole suite, regenerate types**

Coordinate first — local Supabase is shared machine-wide.

```bash
pnpm supabase:start
supabase db reset
pnpm test:db
pnpm types:supabase:local
```

Expected: every test file passes. `src/api/types.ts` gains `workspace_invitations` and the eight new functions, and loses `soft_delete_workspace`.

- [ ] **Step 6: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS. The Task 2 `create_workspace` failure is now resolved. If anything still references `soft_delete_workspace` from TypeScript, remove it — nothing should.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260809190000_retire_soft_delete_from_data_api.sql supabase/tests/database/ src/api/types.ts
git commit -m "feat(db): retire soft_delete_workspace from the Data API and update the contract tests"
```

---

## Task 8: Membership API and hooks

**Files:**
- Create: `src/features/workspaces/api/workspace-membership.ts`
- Create: `src/features/workspaces/hooks/use-workspace-membership.ts`
- Create: `src/features/workspaces/api/workspace-membership.test.ts`
- Modify: `src/features/workspaces/api/workspaces.ts` (`workspaceQueryKeys`)

**Interfaces:**
- Consumes: the eight RPCs from Tasks 2 and 4–6, typed through the regenerated `src/api/types.ts`.
- Produces:
  - `type WorkspaceInvitation = { id, workspaceId, workspaceName, workspaceIcon, role, invitedByName, createdAt }`
  - `type WorkspaceInvitationForAdmin = { id, invitedEmail, invitedName, role, invitedByName, createdAt }`
  - `type MembershipErrorToken` and `membershipErrorMessage(error: unknown): string`
  - `listMyInvitations()`, `listWorkspaceInvitations(workspaceId)`, `inviteWorkspaceMember({workspaceId, email, role})`, `revokeWorkspaceInvitation(invitationId)`, `respondToInvitation({invitationId, accept})`, `updateMemberRole({workspaceId, userId, role})`, `removeMember({workspaceId, userId})`
  - Hooks: `useMyInvitations()`, `useWorkspaceInvitations(workspaceId)`, `useInviteMember(workspaceId)`, `useRevokeInvitation(workspaceId)`, `useRespondToInvitation()`, `useUpdateMemberRole(workspaceId)`, `useRemoveMember(workspaceId)`
- Produces: `workspaceQueryKeys.myInvitations` and `workspaceQueryKeys.invitations(workspaceId)`.

- [ ] **Step 1: Write the failing test**

Create `src/features/workspaces/api/workspace-membership.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { membershipErrorMessage } from './workspace-membership'
import { m } from '@/paraglide/messages'

describe('membershipErrorMessage', () => {
  it('maps every RPC token to its own localized string', () => {
    expect(membershipErrorMessage({ message: 'USER_NOT_FOUND' })).toBe(
      m.workspace_settings_members_invite_error_user_not_found(),
    )
    expect(membershipErrorMessage({ message: 'ALREADY_A_MEMBER' })).toBe(
      m.workspace_settings_members_invite_error_already_member(),
    )
    expect(membershipErrorMessage({ message: 'LAST_OWNER' })).toBe(
      m.workspace_settings_members_error_last_owner(),
    )
    expect(
      membershipErrorMessage({ message: 'OWNER_ROLE_REQUIRES_OWNER' }),
    ).toBe(m.workspace_settings_members_error_owner_only())
  })

  it('falls back to a localized generic message, never to raw English', () => {
    expect(membershipErrorMessage({ message: 'some_pg_internal_detail' })).toBe(
      m.workspace_settings_members_error_generic(),
    )
    expect(membershipErrorMessage(null)).toBe(
      m.workspace_settings_members_error_generic(),
    )
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test src/features/workspaces/api/workspace-membership.test.ts
```

Expected: FAIL — module not found. (Task 9 adds the message keys; if the keys are missing this also fails on `m.*`, which is fine — write Task 9's keys first if you prefer, the two are independent.)

- [ ] **Step 3: Write the API module**

Create `src/features/workspaces/api/workspace-membership.ts`:

```ts
import { m } from '@/paraglide/messages'
import { supabase } from '@/utils/supabase'

/**
 * One pending invitation as its recipient sees it.
 *
 * Comes from `public.list_my_workspace_invitations`, not from a table read: the
 * invitee can select their own pending row, but not the workspace name, the
 * icon, or the inviter's name, all of which belong to relations they are not a
 * member of yet.
 */
export type WorkspaceInvitation = {
  id: string
  workspaceId: string
  workspaceName: string
  workspaceIcon: string | null
  role: string
  invitedByName: string | null
  createdAt: string
}

/** One pending invitation as an owner or admin of the workspace sees it. */
export type WorkspaceInvitationForAdmin = {
  id: string
  invitedEmail: string
  invitedName: string
  role: string
  invitedByName: string | null
  createdAt: string
}

/**
 * The tokens the membership RPCs raise as their exception message.
 *
 * They are identifiers, not copy: every one is mapped to a localized string
 * below. Postgres error text must never reach a user.
 */
const MEMBERSHIP_ERROR_MESSAGES: Record<string, () => string> = {
  USER_NOT_FOUND: () =>
    m.workspace_settings_members_invite_error_user_not_found(),
  ALREADY_A_MEMBER: () =>
    m.workspace_settings_members_invite_error_already_member(),
  CANNOT_INVITE_SELF: () => m.workspace_settings_members_invite_error_self(),
  INVALID_ROLE: () => m.workspace_settings_members_error_generic(),
  NOT_A_WORKSPACE_ADMIN: () => m.workspace_settings_members_error_not_admin(),
  OWNER_ROLE_REQUIRES_OWNER: () =>
    m.workspace_settings_members_error_owner_only(),
  LAST_OWNER: () => m.workspace_settings_members_error_last_owner(),
  MEMBER_NOT_FOUND: () => m.workspace_settings_members_error_member_gone(),
  INVITATION_NOT_FOUND: () =>
    m.workspace_settings_members_error_invitation_gone(),
}

export function membershipErrorMessage(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : ''

  return (
    MEMBERSHIP_ERROR_MESSAGES[message]?.() ??
    m.workspace_settings_members_error_generic()
  )
}

export async function listMyInvitations(): Promise<Array<WorkspaceInvitation>> {
  const { data, error } = await supabase.rpc('list_my_workspace_invitations')

  if (error) throw error

  // Postgres records no nullability for a function's RETURNS TABLE, so the
  // generated type says `string` for columns that are nullable at the source.
  // Normalised here rather than letting an absent icon travel as '' into the UI.
  return data.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    workspaceIcon: nullIfBlank(row.workspace_icon),
    role: row.role,
    invitedByName: nullIfBlank(row.invited_by_name),
    createdAt: row.created_at,
  }))
}

export async function listWorkspaceInvitations(
  workspaceId: string,
): Promise<Array<WorkspaceInvitationForAdmin>> {
  const { data, error } = await supabase.rpc('list_workspace_invitations', {
    p_workspace_id: workspaceId,
  })

  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    invitedEmail: row.invited_email,
    invitedName: row.invited_name,
    role: row.role,
    invitedByName: nullIfBlank(row.invited_by_name),
    createdAt: row.created_at,
  }))
}

export async function inviteWorkspaceMember({
  workspaceId,
  email,
  role,
}: {
  workspaceId: string
  email: string
  role: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('invite_workspace_member', {
    p_workspace_id: workspaceId,
    p_email: email,
    p_role: role,
  })

  if (error) throw error

  return data
}

export async function revokeWorkspaceInvitation(
  invitationId: string,
): Promise<void> {
  const { error } = await supabase.rpc('revoke_workspace_invitation', {
    p_invitation_id: invitationId,
  })

  if (error) throw error
}

export async function respondToInvitation({
  invitationId,
  accept,
}: {
  invitationId: string
  accept: boolean
}): Promise<string | null> {
  const { data, error } = await supabase.rpc(
    'respond_to_workspace_invitation',
    { p_invitation_id: invitationId, p_accept: accept },
  )

  if (error) throw error

  return data
}

export async function updateMemberRole({
  workspaceId,
  userId,
  role,
}: {
  workspaceId: string
  userId: string
  role: string
}): Promise<void> {
  const { error } = await supabase.rpc('update_workspace_member_role', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_role: role,
  })

  if (error) throw error
}

export async function removeMember({
  workspaceId,
  userId,
}: {
  workspaceId: string
  userId: string
}): Promise<void> {
  const { error } = await supabase.rpc('remove_workspace_member', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
  })

  if (error) throw error
}

function nullIfBlank(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
```

- [ ] **Step 4: Add the query keys**

In `src/features/workspaces/api/workspaces.ts`, extend `workspaceQueryKeys`:

```ts
  myInvitations: ['workspaces', 'my-invitations'] as const,
  invitations: (workspaceId: string) =>
    ['workspaces', 'invitations', workspaceId] as const,
```

- [ ] **Step 5: Write the hooks**

Create `src/features/workspaces/hooks/use-workspace-membership.ts`:

```ts
import {
  inviteWorkspaceMember,
  listMyInvitations,
  listWorkspaceInvitations,
  removeMember,
  respondToInvitation,
  revokeWorkspaceInvitation,
  updateMemberRole,
} from '@/features/workspaces/api/workspace-membership'
import { workspaceQueryKeys } from '@/features/workspaces/api/workspaces'
import { useAuth } from '@/providers/auth-provider'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

/**
 * The signed-in user's pending invitations, read app-wide by the workspace
 * switcher.
 *
 * Short `staleTime` rather than the roster's five minutes: an invitation is a
 * thing waiting on the user, and the realtime binding in the notifications
 * engine invalidates this key the moment one arrives — so this only has to
 * cover the gap before that subscription is established.
 */
export function useMyInvitations() {
  const { user } = useAuth()

  return useQuery({
    queryFn: listMyInvitations,
    queryKey: workspaceQueryKeys.myInvitations,
    enabled: !!user?.id,
    staleTime: 30 * 1000,
  })
}

/** Pending invitations for one workspace. Owner/admin only — the RPC refuses
 *  anyone else, so this is gated by the caller rather than retried. */
export function useWorkspaceInvitations(
  workspaceId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryFn: () => listWorkspaceInvitations(workspaceId),
    queryKey: workspaceQueryKeys.invitations(workspaceId),
    enabled: enabled && !!workspaceId,
    retry: false,
  })
}

export function useInviteMember(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { email: string; role: string }) =>
      inviteWorkspaceMember({ workspaceId, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.invitations(workspaceId),
      })
    },
  })
}

export function useRevokeInvitation(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: revokeWorkspaceInvitation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.invitations(workspaceId),
      })
    },
  })
}

/**
 * Accept or reject. Not scoped to a workspace: the caller is not a member of it
 * yet, which is the whole point.
 */
export function useRespondToInvitation() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: respondToInvitation,
    onSuccess: async (workspaceId) => {
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.myInvitations,
      })
      // Accepting adds a workspace to the switcher and puts the user on a
      // roster; rejecting changes neither, so only accept invalidates them.
      if (workspaceId && user?.id) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: workspaceQueryKeys.list(user.id),
          }),
          queryClient.invalidateQueries({
            queryKey: workspaceQueryKeys.memberDirectory(workspaceId),
          }),
        ])
      }
    },
  })
}

export function useUpdateMemberRole(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string; role: string }) =>
      updateMemberRole({ workspaceId, ...input }),
    onSuccess: async () => {
      await invalidateRoster(queryClient, workspaceId)
    },
  })
}

export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string }) =>
      removeMember({ workspaceId, ...input }),
    onSuccess: async () => {
      await invalidateRoster(queryClient, workspaceId)
    },
  })
}

/**
 * Both roster queries, because they are two different reads of the same fact:
 * `members` is the settings page's own-row table read, `memberDirectory` is the
 * RPC every assignee picker shares. A role change that refreshed only one would
 * leave the inbox showing a stale role until the five-minute staleTime expired.
 */
async function invalidateRoster(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: workspaceQueryKeys.members(workspaceId),
    }),
    queryClient.invalidateQueries({
      queryKey: workspaceQueryKeys.memberDirectory(workspaceId),
    }),
  ])
}
```

- [ ] **Step 6: Run the test and typecheck**

```bash
pnpm test src/features/workspaces/api/workspace-membership.test.ts
pnpm typecheck
```

Expected: PASS (after Task 9's message keys exist — do Task 9 first if these fail only on missing `m.*`).

- [ ] **Step 7: Commit**

```bash
git add src/features/workspaces/api/workspace-membership.ts src/features/workspaces/api/workspace-membership.test.ts src/features/workspaces/hooks/use-workspace-membership.ts src/features/workspaces/api/workspaces.ts
git commit -m "feat(workspaces): add the membership API module and its query hooks"
```

---

## Task 9: Messages and the `viewer` removal

**Files:**
- Modify: `messages/ru.json`, `messages/en.json`
- Modify: `src/entities/workspace/model/member.ts`
- Modify: `src/features/account/model/types.ts`
- Modify: `src/features/account/components/workspace-membership-list.tsx`
- Modify: `src/lib/message-lengths.test.ts`

**Interfaces:**
- Produces: `WORKSPACE_MEMBER_ROLES = ['owner','admin','member']`, `WORKSPACE_ROLES = ['owner','admin','member']`.
- Produces: every `m.workspace_settings_members_*` and `m.workspace_invitations_*` key used by Tasks 8, 10, 11, and 12.

- [ ] **Step 1: Rewrite and extend the message catalogues**

In `messages/ru.json`, replace the existing invite block (lines ~108-113) and add the rest. `workspace_settings_members_invite_description` currently promises an emailed link — the model this design rejected — and `..._coming_soon` goes with the badge.

```json
  "workspace_settings_members_invite_title": "Пригласить по email",
  "workspace_settings_members_invite_description": "Приглашённый коллега получит уведомление и сам решит, присоединяться ли",
  "workspace_settings_members_invite_help": "Пригласить можно только тех, у кого уже есть аккаунт в Rezzy. Попросите коллегу зарегистрироваться и сообщить адрес, который он указал при регистрации",
  "workspace_settings_members_invite_email_label": "Email адрес",
  "workspace_settings_members_invite_email_placeholder": "teammate@example.com",
  "workspace_settings_members_invite_role_label": "Роль",
  "workspace_settings_members_invite_action": "Отправить приглашение",
  "workspace_settings_members_invite_sent": "Приглашение отправлено",
  "workspace_settings_members_invite_error_user_not_found": "Пользователь не найден. Сначала он должен зарегистрироваться и сообщить вам адрес, на который создан аккаунт",
  "workspace_settings_members_invite_error_already_member": "Этот человек уже участник пространства",
  "workspace_settings_members_invite_error_self": "Нельзя пригласить самого себя",
  "workspace_settings_members_error_not_admin": "Нужны права владельца или администратора",
  "workspace_settings_members_error_owner_only": "Роль владельца может менять только владелец",
  "workspace_settings_members_error_last_owner": "В пространстве должен остаться хотя бы один владелец",
  "workspace_settings_members_error_member_gone": "Этого человека больше нет в пространстве",
  "workspace_settings_members_error_invitation_gone": "Приглашение больше недоступно",
  "workspace_settings_members_error_generic": "Не удалось выполнить действие. Попробуйте ещё раз",
  "workspace_settings_members_pending_title": "Ожидают ответа",
  "workspace_settings_members_pending_empty": "Нет приглашений, ожидающих ответа",
  "workspace_settings_members_pending_invited_by": "Пригласил {name}",
  "workspace_settings_members_pending_revoke": "Отозвать",
  "workspace_settings_members_role_change_label": "Изменить роль",
  "workspace_settings_members_remove": "Удалить из пространства",
  "workspace_settings_members_remove_last_owner_hint": "В пространстве должен остаться хотя бы один владелец",
  "workspace_settings_members_leave": "Покинуть пространство",
  "workspace_invitations_section_title": "Приглашения",
  "workspace_invitations_dialog_title": "Приглашение в пространство",
  "workspace_invitations_dialog_body": "{inviter} приглашает вас в «{workspace}» — роль: {role}",
  "workspace_invitations_dialog_body_unknown_inviter": "Вас приглашают в «{workspace}» — роль: {role}",
  "workspace_invitations_accept": "Принять",
  "workspace_invitations_decline": "Отклонить",
  "workspace_invitations_accepted": "Вы присоединились к «{workspace}»",
  "workspace_invitations_declined": "Приглашение отклонено",
  "workspace_invitations_toast_title": "Приглашение в пространство",
  "workspace_invitations_indicator_aria": "{count, plural, one {# приглашение} few {# приглашения} many {# приглашений} other {# приглашений}}",
```

Add the identical key set to `messages/en.json`:

```json
  "workspace_settings_members_invite_title": "Invite by email",
  "workspace_settings_members_invite_description": "The person you invite gets a notification and decides whether to join",
  "workspace_settings_members_invite_help": "You can only invite people who already have a Rezzy account. Ask them to sign up first and share the email address they registered with",
  "workspace_settings_members_invite_email_label": "Email address",
  "workspace_settings_members_invite_email_placeholder": "teammate@example.com",
  "workspace_settings_members_invite_role_label": "Role",
  "workspace_settings_members_invite_action": "Send invite",
  "workspace_settings_members_invite_sent": "Invitation sent",
  "workspace_settings_members_invite_error_user_not_found": "User not found. This person must sign up first and share the email address associated with their account",
  "workspace_settings_members_invite_error_already_member": "This person is already a member of the workspace",
  "workspace_settings_members_invite_error_self": "You cannot invite yourself",
  "workspace_settings_members_error_not_admin": "Owner or admin rights are required",
  "workspace_settings_members_error_owner_only": "Only an owner can change the owner role",
  "workspace_settings_members_error_last_owner": "A workspace must always have at least one owner",
  "workspace_settings_members_error_member_gone": "This person is no longer in the workspace",
  "workspace_settings_members_error_invitation_gone": "This invitation is no longer available",
  "workspace_settings_members_error_generic": "That didn't work. Please try again",
  "workspace_settings_members_pending_title": "Awaiting response",
  "workspace_settings_members_pending_empty": "No invitations are awaiting a response",
  "workspace_settings_members_pending_invited_by": "Invited by {name}",
  "workspace_settings_members_pending_revoke": "Revoke",
  "workspace_settings_members_role_change_label": "Change role",
  "workspace_settings_members_remove": "Remove from workspace",
  "workspace_settings_members_remove_last_owner_hint": "A workspace must always have at least one owner",
  "workspace_settings_members_leave": "Leave workspace",
  "workspace_invitations_section_title": "Invitations",
  "workspace_invitations_dialog_title": "Workspace invitation",
  "workspace_invitations_dialog_body": "{inviter} is inviting you to \"{workspace}\" as {role}",
  "workspace_invitations_dialog_body_unknown_inviter": "You have been invited to \"{workspace}\" as {role}",
  "workspace_invitations_accept": "Accept",
  "workspace_invitations_decline": "Decline",
  "workspace_invitations_accepted": "You joined \"{workspace}\"",
  "workspace_invitations_declined": "Invitation declined",
  "workspace_invitations_toast_title": "Workspace invitation",
  "workspace_invitations_indicator_aria": "{count, plural, one {# invitation} other {# invitations}}",
```

Delete `workspace_settings_members_invite_coming_soon` and `workspace_settings_members_role_viewer` from **both** files.

`workspace_invitations_indicator_aria` is counted, so it takes plural variants — Russian needs `one`/`few`/`many`, and a ternary in TypeScript cannot produce three forms. `src/lib/message-plurals.test.ts` pins the expected form per bucket; add a case there for this key.

- [ ] **Step 2: Drop `viewer` from the TypeScript role sets**

`src/entities/workspace/model/member.ts`:

```ts
export const WORKSPACE_MEMBER_ROLES = ['owner', 'admin', 'member'] as const
```

`src/features/account/model/types.ts`:

```ts
export const WORKSPACE_ROLES = ['owner', 'admin', 'member'] as const
```

Remove the `case 'viewer':` branch from the label switch in `src/features/account/components/workspace-membership-list.tsx` (line ~18). The `default:` branch already returns the raw role, so a legacy row cannot render blank.

- [ ] **Step 3: Add the length budget**

The role `Selector` is a fixed-width control. Add to `src/lib/message-lengths.test.ts`, following the file's existing shape:

```ts
  {
    key: 'workspace_settings_members_role_admin',
    max: 16,
  },
  {
    key: 'workspace_settings_members_role_member',
    max: 16,
  },
```

- [ ] **Step 4: Compile and check**

```bash
pnpm i18n:compile
pnpm typecheck
pnpm test src/lib
```

Expected: PASS. Any remaining reference to a deleted key fails the typecheck — fix at the call site, do not restore the key.

- [ ] **Step 5: Commit**

```bash
git add messages/ src/entities/workspace/model/member.ts src/features/account/ src/lib/message-lengths.test.ts src/lib/message-plurals.test.ts
git commit -m "feat(i18n): membership copy in ru and en, and drop the viewer role"
```

---

## Task 10: Rebuild the members settings page

**Files:**
- Create: `src/features/workspaces/components/workspace-members-section.tsx`
- Delete: `src/features/workspaces/components/workspace-members-stub.tsx`
- Rename: `src/features/workspaces/components/workspace-members-stub.test.tsx` → `workspace-members-section.test.tsx`
- Modify: `src/routes/_authenticated/workspaces/$id/settings/members.tsx`

**Interfaces:**
- Consumes: `useWorkspaceMemberDirectory`, `useIsWorkspaceAdmin` (existing), and every hook from Task 8.
- Produces: `<WorkspaceMembersSection workspaceId={string} />`.

Astryx APIs used, read from `@astryxdesign/core@0.1.8`:
- `TextInput` — `label` (required), `value` (required), `onChange: (value, e) => void`, `description` (helper text between label and input), `type: 'email'`, `placeholder`, `isDisabled`.
- `Selector` — `label` (required), `options: SelectorOption[]` (strings, or `{value,label,icon,disabled}`), `value`, `onChange: (value: string) => void`, `size`, `isDisabled`, `disabledMessage` (tooltip explaining *why*, keeps the trigger focusable — use this instead of wrapping a disabled control in `Tooltip`, which swallows the hover events).
- `MoreMenu` — `items: DropdownMenuOption[]`, `label`, `variant`, `size`.

- [ ] **Step 1: Write the failing test**

Rename the stub test and replace its contents with assertions for the new behaviour. The helper-text assertion is the one that must not be lost:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { m } from '@/paraglide/messages'

describe('WorkspaceMembersSection', () => {
  it('shows the existing-account helper before anything is typed', () => {
    renderSection()

    // The standing constraint of the invite model, not a validation result:
    // it must be readable by an inviter who has typed nothing.
    expect(
      screen.getByText(m.workspace_settings_members_invite_help()),
    ).toBeInTheDocument()
  })

  it('does not render the invite form for a non-admin', () => {
    renderSection({ role: 'member' })

    expect(
      screen.queryByLabelText(m.workspace_settings_members_invite_email_label()),
    ).not.toBeInTheDocument()
  })

  it('disables removal of the last owner and says why', () => {
    renderSection({ role: 'owner', members: [OWNER_ONLY] })

    expect(
      screen.getByText(m.workspace_settings_members_remove_last_owner_hint()),
    ).toBeInTheDocument()
  })
})
```

Build `renderSection` on the harness the existing `workspace-members-stub.test.tsx` already uses — read that file and reuse its `QueryClientProvider` and mocking approach rather than inventing a second one. Define `OWNER_ONLY` as a one-element roster whose single member is `role: 'owner'` and whose `userId` matches the mocked auth user.

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test src/features/workspaces/components/workspace-members-section.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Build the section**

Create `src/features/workspaces/components/workspace-members-section.tsx`, carrying over the roster row, skeleton, and the `knownName` handling from the stub verbatim — that avatar-initials comment records a real defect and must survive. Add:

```tsx
/**
 * The invite form. Rendered only for owners and admins; the RPC refuses
 * everyone else, so this hides an affordance rather than enforcing a rule.
 *
 * The helper text is permanent and sits on the field itself via `description`,
 * not in an error slot. Only registered users can be invited, which is a
 * standing property of the invite model — an inviter needs to know it before
 * they type, not after the attempt fails. `USER_NOT_FOUND` explains a failed
 * attempt; this prevents one.
 */
function InviteMemberForm({ workspaceId }: { workspaceId: string }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const invite = useInviteMember(workspaceId)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim()) return
    invite.mutate(
      { email, role },
      { onSuccess: () => setEmail('') },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border/60 flex flex-col gap-3 border-y py-5"
    >
      <div className="flex items-center gap-2">
        <MailPlusIcon className="text-secondary size-4" />
        <h3 className="text-sm font-medium">
          {m.workspace_settings_members_invite_title()}
        </h3>
      </div>
      <p className="text-secondary text-xs">
        {m.workspace_settings_members_invite_description()}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextInput
            label={m.workspace_settings_members_invite_email_label()}
            description={m.workspace_settings_members_invite_help()}
            type="email"
            placeholder={m.workspace_settings_members_invite_email_placeholder()}
            value={email}
            onChange={setEmail}
            isDisabled={invite.isPending}
          />
        </div>
        <Selector
          label={m.workspace_settings_members_invite_role_label()}
          value={role}
          onChange={setRole}
          options={[
            { value: 'admin', label: m.workspace_settings_members_role_admin() },
            {
              value: 'member',
              label: m.workspace_settings_members_role_member(),
            },
          ]}
          isDisabled={invite.isPending}
        />
        <Button
          label={m.workspace_settings_members_invite_action()}
          type="submit"
          isLoading={invite.isPending}
          isDisabled={!email.trim()}
        />
      </div>

      {invite.isError ? (
        <p className="text-error text-xs" role="alert">
          {membershipErrorMessage(invite.error)}
        </p>
      ) : null}
    </form>
  )
}
```

Add a `PendingInvitationsList` reading `useWorkspaceInvitations(workspaceId, { enabled: isAdmin })` with a revoke action per row, and give each roster row a `MoreMenu` whose items are the role changes and the remove action.

The last-owner rule gates the affordance **and** is enforced in the RPC. Compute it from the roster the page already holds:

```tsx
// Derived from the roster query, so this costs no extra request. It disables
// the control and explains why; update_workspace_member_role and
// remove_workspace_member enforce the same rule, and they are what decides.
const ownerCount = members.filter((member) => member.role === 'owner').length
const isLastOwner = (member: WorkspaceMember) =>
  member.role === 'owner' && ownerCount <= 1
```

Gate every mutating control on `useIsWorkspaceAdmin(workspaceId)`, respecting its `isLoaded` flag — before the roster arrives, "not an admin" and "not known yet" are the same `false`, and rendering the difference flashes an admin's controls away from them.

- [ ] **Step 4: Point the route at the new component**

In `src/routes/_authenticated/workspaces/$id/settings/members.tsx`, swap the import and the element from `WorkspaceMembersStub` to `WorkspaceMembersSection`. Delete `workspace-members-stub.tsx`.

- [ ] **Step 5: Run and typecheck**

```bash
pnpm test src/features/workspaces
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/workspaces/components/ src/routes/_authenticated/workspaces/\$id/settings/members.tsx
git commit -m "feat(workspaces): build the members settings section on the membership RPCs"
```

---

## Task 11: Invitations in the workspace switcher

**SPEC CORRECTION applied here.** `DropdownMenu` items are single-action rows — `{label, onClick?, icon?, isDisabled?}`, dividers, and sections. Accept and Decline cannot both live in one row, and at `menuWidth: 220` they would not fit. A menu row opens a `Dialog` instead.

**Files:**
- Create: `src/features/workspaces/components/invitation-response-dialog.tsx`
- Modify: `src/widgets/sidebar/sidebar.tsx` (`WorkspaceSwitcher`, lines ~323-422)
- Create: `src/features/workspaces/components/invitation-response-dialog.test.tsx`

**Interfaces:**
- Consumes: `useMyInvitations`, `useRespondToInvitation` (Task 8); `WorkspaceInvitation` (Task 8).
- Produces: `<InvitationResponseDialog invitation={WorkspaceInvitation | null} onOpenChange={(open: boolean) => void} />`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { m } from '@/paraglide/messages'
import { InvitationResponseDialog } from './invitation-response-dialog'

const INVITATION = {
  id: 'inv-1',
  workspaceId: 'ws-1',
  workspaceName: 'Gamma Ltd',
  workspaceIcon: null,
  role: 'admin',
  invitedByName: 'Анна Петрова',
  createdAt: '2026-08-09T10:00:00Z',
}

describe('InvitationResponseDialog', () => {
  it('names the inviter, the workspace and the role', () => {
    renderDialog(INVITATION)

    expect(screen.getByText(/Gamma Ltd/)).toBeInTheDocument()
    expect(screen.getByText(/Анна Петрова/)).toBeInTheDocument()
  })

  it('falls back to a localized string when the inviter is unknown', () => {
    // invited_by is ON DELETE SET NULL, so the inviter can be gone.
    renderDialog({ ...INVITATION, invitedByName: null })

    expect(
      screen.getByText(
        m.workspace_invitations_dialog_body_unknown_inviter({
          workspace: 'Gamma Ltd',
          role: m.workspace_settings_members_role_admin(),
        }),
      ),
    ).toBeInTheDocument()
  })

  it('offers accept and decline', async () => {
    renderDialog(INVITATION)

    expect(
      screen.getByRole('button', { name: m.workspace_invitations_accept() }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: m.workspace_invitations_decline() }),
    ).toBeInTheDocument()
  })
})
```

Write `renderDialog` on the same `QueryClientProvider` harness used elsewhere in `src/features/workspaces`.

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test src/features/workspaces/components/invitation-response-dialog.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Build the dialog**

Create `src/features/workspaces/components/invitation-response-dialog.tsx` using `Dialog` and `DialogHeader` from `@astryxdesign/core/Dialog`, matching the construction in `src/features/channels/components/edit-channel-name-modal.tsx`. It renders the workspace name, the role, and the inviter, with Accept and Decline calling `useRespondToInvitation()`. `invitedByName` is nullable — `invited_by` is `ON DELETE SET NULL` — so pick the `..._unknown_inviter` message when it is null rather than interpolating an empty string.

- [ ] **Step 4: Add the section to the switcher**

In `WorkspaceSwitcher`, read `useMyInvitations()` and append to `items` when there are any:

```tsx
  // Astryx DropdownMenu items are single-action rows, so Accept/Decline cannot
  // live in the menu; a row opens the dialog, which is the better home for the
  // decision anyway — at menuWidth 220 two buttons do not fit.
  if (invitations.length > 0) {
    items.push({ type: 'divider' })
    items.push({
      type: 'section',
      title: m.workspace_invitations_section_title(),
      items: invitations.map((invitation) => ({
        label: invitation.workspaceName,
        icon: <MailPlusIcon className="size-4" aria-hidden />,
        onClick: () => {
          setIsOpen(false)
          setRespondingTo(invitation)
        },
      })),
    })
  }
```

Add the indicator on the trigger. `WorkspaceSwitcher` builds two `button` shapes (collapsed and expanded) — put the dot on both, and give it the counted aria label:

```tsx
  const invitationCount = invitations.length
  const invitationBadge =
    invitationCount > 0 ? (
      <span
        className="bg-error absolute top-0 right-0 size-2 rounded-full"
        aria-label={m.workspace_invitations_indicator_aria({
          count: invitationCount,
        })}
      />
    ) : null
```

Render `<InvitationResponseDialog invitation={respondingTo} onOpenChange={...} />` as a sibling of the `DropdownMenu`, not inside it — the menu unmounts its content on close and would take the dialog with it.

- [ ] **Step 5: Run and typecheck**

```bash
pnpm test src/features/workspaces src/widgets/sidebar
pnpm typecheck
```

Expected: PASS. `src/widgets/sidebar/sidebar.test.tsx` may need its mocks extended for the new query — update it rather than skipping it.

- [ ] **Step 6: Commit**

```bash
git add src/features/workspaces/components/invitation-response-dialog.tsx src/features/workspaces/components/invitation-response-dialog.test.tsx src/widgets/sidebar/
git commit -m "feat(workspaces): surface pending invitations in the workspace switcher"
```

---

## Task 12: The in-app invitation notification

**Files:**
- Create: `src/features/notifications/components/invitation-notification.tsx`
- Create: `src/features/notifications/components/invitation-notification.test.tsx`
- Modify: `src/features/notifications/hooks/use-message-notifications.ts`
- Modify: `src/features/notifications/model/types.ts`

**Interfaces:**
- Consumes: `workspaceQueryKeys.myInvitations` (Task 8), the message keys from Task 9.
- Produces: `type WorkspaceInvitationRow = Database['public']['Tables']['workspace_invitations']['Row']`
- Produces: `showInvitationNotificationToast({ row, showToast, onOpen }): void`
- Produces: `invitationPresentationKey(row): string` — `` `${row.id}:${row.created_at}` ``.

No new mechanism. The Astryx toast host, `NotificationDeduper`, `createTabCoordinator`, `playNotificationSound`, the preferences record, and the per-user channel `notifications:${userId}` are all generic and reused. `message_notifications`, `shouldPresentInApp`, `showMessageNotificationToast` and the `/notifications` route are message-shaped and are not touched.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from 'vitest'
import { invitationPresentationKey } from './invitation-notification'

const ROW = {
  id: 'inv-1',
  created_at: '2026-08-09T10:00:00Z',
}

describe('invitationPresentationKey', () => {
  it('changes when the same invitation is re-sent', () => {
    // A re-invite is an ON CONFLICT DO UPDATE, so it carries the SAME primary
    // key as the row it replaces. NotificationDeduper keeps the last 500 ids
    // and the tab coordinator claims for 60s — keying on `id` alone would
    // swallow exactly the case where an admin tries again because the first
    // attempt went unnoticed. created_at is bumped by the upsert.
    const first = invitationPresentationKey(ROW)
    const reinvited = invitationPresentationKey({
      ...ROW,
      created_at: '2026-08-09T11:30:00Z',
    })

    expect(first).not.toBe(reinvited)
  })

  it('is stable for a duplicate delivery of one event', () => {
    expect(invitationPresentationKey(ROW)).toBe(
      invitationPresentationKey({ ...ROW }),
    )
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test src/features/notifications/components/invitation-notification.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Build the toast**

Create `src/features/notifications/components/invitation-notification.tsx`. The toast body is arbitrary JSX and `showToast` returns a dismiss function, so Accept and Decline live inline here — unlike the switcher's menu row.

```tsx
/**
 * The presentation key for one invitation event.
 *
 * Not the row id. A re-invite is `ON CONFLICT DO UPDATE`, so it carries the
 * same primary key as the invitation it replaces, and both the deduper (500
 * ids per tab) and the tab coordinator (60s claims) would treat it as a
 * duplicate and present nothing. `created_at` is bumped by the upsert, which
 * makes this pair change exactly when there is something new to say.
 *
 * This couples to `invite_workspace_member`: if its DO UPDATE ever stops
 * setting `created_at = now()`, re-invite notifications go silent and nothing
 * fails. The migration header says so too.
 */
export function invitationPresentationKey(row: {
  id: string
  created_at: string
}): string {
  return `${row.id}:${row.created_at}`
}
```

Then `showInvitationNotificationToast`, modelled on `showMessageNotificationToast`: `uniqueID: invitationPresentationKey(row)`, `type: 'info'`, `autoHideDuration: 8000`, and a body naming the workspace with Accept / Decline buttons that call the mutation and then dismiss.

- [ ] **Step 4: Bind the subscription**

In `src/features/notifications/hooks/use-message-notifications.ts`, add a second `.on(...)` to the existing channel — before `.subscribe(...)`, so it is part of the same subscription:

```ts
      .on(
        'postgres_changes',
        {
          // INSERT *and* UPDATE. A re-invite is the ON CONFLICT DO UPDATE
          // branch of invite_workspace_member, so binding INSERT alone would
          // leave the one case where an admin tries again — because the first
          // attempt went unnoticed — notifying nobody.
          event: '*',
          schema: 'public',
          table: 'workspace_invitations',
          filter: `invited_user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          const row = payload.new as WorkspaceInvitationRow

          // Accept, reject and revoke all move status out of 'pending' and must
          // not notify. The server already filters them — the SELECT policy
          // carries `and status = 'pending'` and realtime evaluates it against
          // the new record — but a policy predicate quietly doing double duty
          // as presentation logic is how the two drift apart.
          if (row.status !== 'pending') return

          void queryClient.invalidateQueries({
            queryKey: workspaceQueryKeys.myInvitations,
          })
          void presentInvitation(row)
        },
      )
```

`presentInvitation` mirrors `present`: dedupe and claim on `invitationPresentationKey(row)`, respect `ctx.preferences.inAppEnabled` and the focus check, then show the toast and play the sound if `soundEnabled`. It does **not** run `shouldPresentInApp` — that takes a `MessageNotificationRow` and applies exact-thread suppression, neither of which means anything here.

- [ ] **Step 5: Add the row type**

In `src/features/notifications/model/types.ts`:

```ts
export type WorkspaceInvitationRow =
  Database['public']['Tables']['workspace_invitations']['Row']
```

- [ ] **Step 6: Add the status test**

Append to `invitation-notification.test.tsx` a test that a payload whose `status` is `'accepted'` presents nothing, exercising the guard directly.

- [ ] **Step 7: Run and typecheck**

```bash
pnpm test src/features/notifications
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/notifications/
git commit -m "feat(notifications): notify an invitee in-app on invite and re-invite"
```

---

## Task 13: Full validation and the browser pass

**Files:** none created; fixes only.

- [ ] **Step 1: Run everything**

Coordinate the database reset — the local Supabase instance is shared.

```bash
supabase db reset
pnpm test:db
pnpm verify
```

`pnpm verify` chains typecheck, lint, test, and build and stops at the first failure. Expected: all pass.

- [ ] **Step 2: Browser pass, in Russian, at phone width**

jsdom has no layout, so overflow and truncation are invisible to the unit suite, and `ru` is `baseLocale` and runs 15–30% longer than English. Start the dev server (`pnpm dev` — this worktree gets its own port in 3100–3499) and sign in as `ncase01@gmail.com` / `123456789`.

Check, at phone width:
1. The members settings page: the invite helper text wraps and is readable with nothing typed; the role `Selector` does not truncate `администратор`.
2. Invite a second test account. Confirm `USER_NOT_FOUND` renders for an unregistered address and does not read as English.
3. As the invitee: the toast appears with Accept and Decline; the switcher shows the dot and the Приглашения section; the dialog names inviter, workspace, and role.
4. Re-invite the same person at a different role while they are signed in — **a second toast must appear.** This is the dedupe-key behaviour; if nothing appears, `created_at` is not being bumped or the key is keyed on `id`.
5. Accept, and confirm the workspace appears in the switcher without a reload.
6. Demote and remove a member; confirm the last owner's controls are disabled with the explanation.

- [ ] **Step 3: Fix anything found, then open the pull request**

```bash
pnpm worktree:finish
```

It refuses on a dirty tree or a branch with no commits beyond `origin/main`, and will not commit for you.

---

## Self-review

**Spec coverage.** Data model → Task 3. Authorization changes (three) → Tasks 1 and 2. `private.workspace_role` → Task 1. Seven RPCs → Tasks 2, 4, 5, 6. Locking → Task 6. Re-invite atomicity → Task 4. Feature layer → Task 8. Members page and the permanent helper → Tasks 9, 10. Switcher → Task 11. In-app notification, INSERT+UPDATE, dedupe key → Task 12. `viewer` removal → Tasks 1, 9. i18n → Task 9. `soft_delete_workspace` → Task 7. DB tests → Tasks 1–7. Application tests → Tasks 8, 10, 11, 12. Validation → Task 13.

**Known gaps, stated rather than hidden.**
- The two concurrency races and the concurrent-invite race are **not** covered by an interleaved test: the suite has no second session and adding `dblink` is an unmade decision. Task 6 Step 5 asserts the mechanism is present and records the gap in the test file.
- The dead `when 'viewer' then 3` ordering branches in `list_workspace_members` and the contacts directory RPC are left in place. They are unreachable once the CHECK excludes `viewer`, and rewriting two unrelated RPCs to delete a dead `CASE` arm is churn this plan does not need. Noted so it is a decision, not an oversight.
- OS/push notification for invitations is out of scope per the spec.

**Type consistency.** `WorkspaceInvitation` (Task 8) is consumed by Tasks 11 and 12 under that name. `invitationPresentationKey` and `showInvitationNotificationToast` are defined in Task 12 and used only there. `membershipErrorMessage` is defined in Task 8 and used in Task 10. `workspaceQueryKeys.myInvitations` and `.invitations(id)` are added in Task 8 and consumed in Tasks 11 and 12. RPC parameter names (`p_workspace_id`, `p_email`, `p_role`, `p_invitation_id`, `p_accept`, `p_user_id`) match between the migrations and the API module.
