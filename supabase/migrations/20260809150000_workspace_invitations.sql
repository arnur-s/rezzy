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
