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
-- Every read after the lock -- the actor's own role, the target's role, the
-- owner count -- runs inside it and observes a roster nobody else can move.
-- The actor's role is also read once *before* the lock, but only as a cheap
-- reject for a caller who plainly never had permission, so an unauthorized
-- caller does not pay for taking a roster-wide lock. That pre-lock read is
-- provisional: the actor's own role can change, or the actor can be removed
-- from the workspace entirely, while their transaction is waiting for the
-- lock a concurrent caller holds. Every authorization decision that matters
-- -- OWNER_ROLE_REQUIRES_OWNER above all -- is therefore taken from a second,
-- authoritative read of the actor's role performed immediately after the
-- lock is acquired, never from the pre-lock value.

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

  -- Cheap pre-lock reject: a caller who plainly has no membership, or holds
  -- neither owner nor admin, should not pay for a roster-wide lock. This
  -- read is provisional -- see the header comment -- and is re-taken,
  -- authoritatively, immediately after the lock below.
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

  -- Authoritative re-read. A concurrent transaction may have demoted or
  -- removed the actor between the provisional check above and this lock;
  -- every decision from here on must use this value, not the stale one.
  select wm.role
  into v_actor_role
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = v_actor;

  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'NOT_A_WORKSPACE_ADMIN' using errcode = '42501';
  end if;

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

  v_is_self := (p_user_id = v_actor);

  -- Cheap pre-lock reject, same reasoning as update_workspace_member_role's
  -- header comment: a caller who plainly has no membership, or is trying to
  -- remove somebody else without owner/admin rights, should not pay for a
  -- roster-wide lock. Provisional -- re-taken authoritatively after the lock.
  if v_actor_role is null then
    raise exception 'NOT_A_WORKSPACE_ADMIN' using errcode = '42501';
  end if;

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

  -- Authoritative re-read. A concurrent transaction may have demoted or
  -- removed the actor between the provisional checks above and this lock;
  -- every decision from here on -- including the self/admin gate and
  -- OWNER_ROLE_REQUIRES_OWNER -- must use this value, not the stale one.
  -- v_is_self itself needs no re-read: it compares two user ids, neither of
  -- which this statement can change.
  select wm.role
  into v_actor_role
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = v_actor;

  if v_actor_role is null then
    raise exception 'NOT_A_WORKSPACE_ADMIN' using errcode = '42501';
  end if;

  if not v_is_self and v_actor_role not in ('owner', 'admin') then
    raise exception 'NOT_A_WORKSPACE_ADMIN' using errcode = '42501';
  end if;

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
