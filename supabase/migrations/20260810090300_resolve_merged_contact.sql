-- Contact merge, part 4: resolving a merged contact's own detail URL to its
-- survivor.
--
-- 20260810090100 taught list_archived_contacts to say where a merged row went,
-- but that RPC is owner/admin only and returns a page, not a point lookup. The
-- detail route for the merged contact's own id needs the same fact for ANY
-- workspace member -- whoever opens a stale link or bookmark, not only an
-- admin -- and needs exactly one row, not a page.
--
-- public.contacts' own SELECT policy cannot answer that. 20260808090000 put
-- `deleted_at is null` into it for every caller, admins included, and
-- 20260810090000's contacts_merged_is_archived_check means a merged row always
-- carries a non-null deleted_at -- the two columns are set in the same
-- statement by merge_contacts. So a merged contact is invisible to every plain
-- SELECT the instant it becomes one, for every caller, with no window in which
-- an ordinary query -- including the one behind getWorkspaceContact, which the
-- detail page's own useContactDetail runs -- could ever see merged_into_id on
-- that row. This is the narrow, guarded hole for that one fact.

begin;

create function public.resolve_merged_contact(
  p_workspace_id uuid,
  p_contact_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_survivor_id uuid;
begin
  -- Every non-qualifying case returns the same null a caller cannot tell
  -- apart from any other: not authenticated, not a member of p_workspace_id,
  -- an id that names no contact, a contact that belongs to a different
  -- workspace, an ordinary archived contact, or a live one. A definer
  -- function must not let an arbitrary caller learn which of those is true
  -- for an arbitrary uuid -- the same reasoning as the opaque errors
  -- elsewhere in this feature (merge_contacts' NOT_A_WORKSPACE_ADMIN covers
  -- "no such contact" and "wrong workspace" alike), just returning null
  -- instead of raising, because this function backs a redirect that a caller
  -- needs no authority over the target of -- only membership in the
  -- workspace they are already looking at a contact inside.
  if (select auth.uid()) is null then
    return null;
  end if;

  -- Any member, not owner/admin: whoever can open a contact's detail URL at
  -- all should be the one who gets redirected off a dead one. is_workspace_member
  -- also excludes a soft-deleted workspace, matching every other reader here.
  if not public.is_workspace_member(p_workspace_id) then
    return null;
  end if;

  select c.merged_into_id
  into v_survivor_id
  from public.contacts c
  where c.id = p_contact_id
    and c.workspace_id = p_workspace_id;

  -- Null for a live contact, an ordinary archived one, or an id that matched
  -- nothing above -- v_survivor_id is simply never assigned in those cases.
  -- One hop only: merge_contacts refuses a contact that already carries
  -- merged_into_id, so the value returned here, when not null, names a
  -- contact that has not itself been merged. No chain to walk.
  return v_survivor_id;
end;
$$;

comment on function public.resolve_merged_contact(uuid, uuid) is
  'The survivor a merged contact was folded into, or null for every other case: no such contact, a different workspace, an ordinary archived contact, a live one, or a caller who is not a member of p_workspace_id. SECURITY DEFINER so it can read a row the contacts SELECT policy hides from everyone once merged_into_id is set. Guarded on workspace membership only -- any member, not owner/admin -- because opening a stale contact URL requires no more authority than opening a live one.';

revoke all on function public.resolve_merged_contact(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.resolve_merged_contact(uuid, uuid) to authenticated;

commit;
