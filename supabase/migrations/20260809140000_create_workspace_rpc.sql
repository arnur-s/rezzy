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
