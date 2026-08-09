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
