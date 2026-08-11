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
