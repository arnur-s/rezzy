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
