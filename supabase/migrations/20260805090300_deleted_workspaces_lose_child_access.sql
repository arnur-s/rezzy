begin;

-- soft_delete_workspace() set deleted_at and stopped. The workspaces policies
-- read that column, so the workspace itself vanished from the switcher -- but
-- every child table authorises through public.is_workspace_member(), which only
-- ever asked "is there a membership row?". Memberships are retained by design,
-- so contacts, conversations, messages, channels, notes, read cursors and
-- notifications all stayed readable and writable in a workspace the product
-- presents as deleted. Deep links kept working; so did realtime.
--
-- The check goes into is_workspace_member() rather than into each child policy:
-- one predicate covers every table that already authorises through it, today
-- and for whatever gets added next, and restoration stays a single flag flip.
--
-- ── Why this function has to hold definer rights ─────────────────────────────
--
-- 20260720090850 made is_workspace_member() SECURITY INVOKER, on the reasoning
-- that its table reads were already covered by RLS. That is true of
-- workspace_members and it stops being true the moment the function reads
-- workspaces, because the workspaces SELECT policy is
--
--   deleted_at is null and (created_by = auth.uid() or is_workspace_member(id))
--
-- An invoker-rights read of workspaces from inside is_workspace_member() calls
-- that policy, which calls is_workspace_member() again. The recursion is
-- through a function-call boundary rather than inside one query, so Postgres
-- does not catch it with "infinite recursion detected in policy"; it recurses
-- until the stack limit. It also does not fail uniformly: a workspace creator
-- short-circuits on `created_by = auth.uid()` and never reaches the second
-- branch, so the author of a change sees it work and every invited member gets
-- 54001. Verified against this schema before choosing definer rights.
--
-- Definer rights do not widen what the function reveals. It returns one boolean
-- about the caller, both reads are pinned to (select auth.uid()) and to the
-- workspace passed in, and the search path is empty so neither relation can be
-- redirected. It is what the function held before 20260720090850.
--
-- Measured on 5 000 conversations under the inbox list query: the added join is
-- a primary-key probe and costs no measurable time (31.7 ms before, 31.3 ms
-- after, five warm runs each); plan shapes are byte-identical. See the note in
-- the pull request for the numbers per query.

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and w.deleted_at is null
  );
$$;

comment on function public.is_workspace_member(uuid) is
  'True when the caller is a member of a workspace that has not been soft deleted. Every workspace-scoped RLS policy authorises through this, so a soft delete withdraws access to the whole workspace at once.';

-- ── The replacement main workspace ───────────────────────────────────────────
--
-- one_main_workspace_per_user is UNIQUE (created_by) WHERE is_main = true and
-- ignored deleted_at, so a soft-deleted main workspace kept occupying the slot:
-- creating a replacement raised 23505 forever. Two independent fixes, because
-- they cover different rows -- the index covers workspaces already deleted
-- before this migration, the assignment below covers every future delete.

drop index if exists public.one_main_workspace_per_user;

create unique index one_main_workspace_per_user
  on public.workspaces (created_by)
  where is_main = true and deleted_at is null;

create or replace function public.soft_delete_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = 'owner'
  ) then
    raise exception 'Not authorized'
      using errcode = '42501';
  end if;

  -- is_main is cleared with the same statement: a deleted workspace is nobody's
  -- default landing target, and leaving the flag set would hold the per-creator
  -- main slot against the partial index above.
  update public.workspaces
  set
    deleted_at = now(),
    is_main = false,
    updated_at = now(),
    updated_by = (select auth.uid())
  where id = p_workspace_id
    and deleted_at is null;
end;
$$;

-- ── Onboarding after a delete ────────────────────────────────────────────────
--
-- The unique_violation handler looked up "my main workspace" without filtering
-- deleted_at, so the recovery path could hand a user back the workspace they
-- had just deleted, reporting is_new = false. With the index above, a live main
-- workspace is the only thing that can raise the violation this handler exists
-- for, and the lookup now says so explicitly rather than relying on it.
--
-- Unchanged from 20260726120000 apart from that filter and the comments.

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
  -- all rather than a profile with no workspace. The same 2-60 range is now a
  -- CHECK on workspaces.name, which covers the direct-insert path this
  -- function never sees.
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
      -- query takes a fresh snapshot and sees the winner's committed row. Only
      -- a live workspace can be the winner -- a soft-deleted one no longer
      -- holds the main slot, and handing it back would be a workspace the
      -- caller cannot open.
      select w.id
      into v_workspace_id
      from public.workspaces w
      where w.created_by = v_user_id
        and w.is_main
        and w.deleted_at is null
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

commit;
