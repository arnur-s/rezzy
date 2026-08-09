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
