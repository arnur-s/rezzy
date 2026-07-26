-- Onboarding asks for the workspace name and nothing else.
--
-- Sign-up already captures the display name into auth.users.raw_user_meta_data,
-- and the on_auth_user_created trigger writes it to the profile. Collecting it
-- again during onboarding duplicated data the server already had, so the
-- parameter is gone: the display name is now read from auth metadata inside the
-- function and can no longer be supplied by the caller.
--
-- Identity still comes only from auth.uid(): the function takes no user id, so a
-- caller cannot run onboarding on behalf of somebody else.

drop function if exists public.complete_onboarding(text, text);

create or replace function public.complete_onboarding(
  p_workspace_name text
)
returns table (workspace_id uuid, is_new boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_workspace_name text := nullif(btrim(coalesce(p_workspace_name, '')), '');
  v_email text;
  v_full_name text;
  v_workspace_id uuid;
begin
  if v_user_id is null then
    raise exception 'complete_onboarding requires an authenticated user'
      using errcode = '28000';
  end if;

  -- Validate before writing anything, so an invalid call leaves no records at
  -- all rather than a profile with no workspace.
  if v_workspace_name is null
    or char_length(v_workspace_name) < 2
    or char_length(v_workspace_name) > 60
  then
    raise exception 'workspace name must be between 2 and 60 characters'
      using errcode = '22023';
  end if;

  -- Already onboarded: return the workspace the app would land on and write
  -- nothing. Ordered like getUserWorkspaces() so the RPC and the UI agree on
  -- which workspace is primary.
  select w.id
  into v_workspace_id
  from public.workspaces w
  join public.workspace_members wm on wm.workspace_id = w.id
  where wm.user_id = v_user_id
    and w.deleted_at is null
  order by w.is_main desc, w.created_at asc
  limit 1;

  if v_workspace_id is not null then
    return query select v_workspace_id, false;
    return;
  end if;

  select u.email, nullif(btrim(u.raw_user_meta_data ->> 'full_name'), '')
  into v_email, v_full_name
  from auth.users u
  where u.id = v_user_id;

  -- The on_auth_user_created trigger normally created this row already. The
  -- insert is only a safety net for a missing profile, because
  -- workspaces.created_by references it. It never overwrites an existing name:
  -- the trigger owns the display name now, not onboarding. The fallback chain
  -- matches private.handle_new_user() because profiles.full_name is not null.
  insert into public.profiles (id, full_name, email)
  values (
    v_user_id,
    coalesce(v_full_name, nullif(split_part(coalesce(v_email, ''), '@', 1), ''), 'New user'),
    coalesce(v_email, '')
  )
  on conflict (id) do nothing;

  -- is_main is what makes the one_main_workspace_per_user partial unique index
  -- the final duplicate guard: concurrent submissions race on it, and the loser
  -- lands in the handler below instead of creating a second workspace.
  begin
    insert into public.workspaces (name, description, icon, is_main, created_by)
    values (v_workspace_name, null, 'briefcase', true, v_user_id)
    returning id into v_workspace_id;
  exception
    when unique_violation then
      -- The exception rolled back to this block's savepoint; the follow-up
      -- query takes a fresh snapshot and sees the winner's committed row.
      -- Soft-deleted workspaces are not excluded here: the index ignores
      -- deleted_at, and soft delete is not reachable from the browser today
      -- (soft_delete_workspace is not granted to authenticated).
      select w.id
      into v_workspace_id
      from public.workspaces w
      where w.created_by = v_user_id
        and w.is_main
      limit 1;

      if v_workspace_id is null then
        raise;
      end if;

      return query select v_workspace_id, false;
      return;
  end;

  -- The on_workspace_created trigger created the owner membership inside this
  -- same transaction.
  return query select v_workspace_id, true;
end;
$$;

-- The function hardening migration revokes execute by default, so a new
-- function stays unreachable from the browser until it is granted explicitly.
revoke all on function public.complete_onboarding(text)
  from public, anon, authenticated;
grant execute on function public.complete_onboarding(text)
  to authenticated;
