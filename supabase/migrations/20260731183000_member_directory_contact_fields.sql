-- Adds job_title and phone to the workspace member directory.
--
-- Why this exists as its own migration rather than an edit to 20260731170100:
-- that file may already be applied somewhere, and changing a function's RETURNS
-- TABLE is not something CREATE OR REPLACE can do — it needs a DROP first. This
-- migration is safe in both worlds: it drops whatever shape is there and states
-- the new one in full.
--
-- What changed and why:
--
-- The inbox now renders the assignee as a person rather than a name. A
-- conversation row carries their face; the thread header carries a card with
-- their role and their phone, so an agent picking up someone else's thread can
-- reach them without leaving the inbox. Both need columns the previous shape
-- did not return.
--
-- 20260731170100 wrote "Email is deliberately not returned. The picker needs a
-- name and a face; exposing every colleague's address is a wider hole than the
-- feature needs." That reasoning still holds and email stays out. job_title and
-- phone are a deliberate, narrower widening: they are the two facts a colleague
-- needs in order to *route work* to another colleague, which is the feature
-- being built, and they are visible only to someone who has already proven
-- membership of the same workspace. Email — the credential-shaped identifier,
-- and the one that travels outside the product — is still not on this list.
--
-- Everything else about the function is unchanged: SECURITY DEFINER so it can
-- see past the own-row RLS on public.workspace_members and public.profiles,
-- guarded by public.is_workspace_member so a non-member gets an exception
-- rather than a roster.

begin;

drop function if exists public.list_workspace_members(uuid);

create function public.list_workspace_members(p_workspace_id uuid)
returns table (
  user_id uuid,
  role text,
  full_name text,
  avatar_url text,
  job_title text,
  phone text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  -- public.is_workspace_member is SECURITY INVOKER, but inside this definer
  -- function the effective role owns workspace_members, so its EXISTS sees every
  -- membership row rather than only the caller's. The question it answers is
  -- unchanged -- "is auth.uid() a member of p_workspace_id" -- and auth.uid()
  -- still reads the request JWT, which a caller cannot forge. This guard is the
  -- only thing standing between a caller and every membership row in the table.
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'NOT_A_WORKSPACE_MEMBER' using errcode = '42501';
  end if;

  -- Every column reference is qualified: the RETURNS TABLE names are plpgsql
  -- variables, so an unqualified user_id or role would be ambiguous.
  return query
  select
    wm.user_id,
    wm.role,
    p.full_name,
    p.avatar_url,
    p.job_title,
    p.phone,
    wm.created_at
  from public.workspace_members wm
  join public.profiles p on p.id = wm.user_id
  where wm.workspace_id = p_workspace_id
  order by
    case wm.role
      when 'owner' then 0
      when 'admin' then 1
      when 'member' then 2
      when 'viewer' then 3
      else 4
    end asc,
    nullif(btrim(p.full_name), '') asc nulls last,
    wm.user_id asc;
end;
$$;

comment on function public.list_workspace_members(uuid) is
  'Members of one workspace with the profile fields the inbox and the owner/assignee pickers render: name, avatar, job title and phone. Email is deliberately excluded. SECURITY DEFINER so it can see rows the own-row RLS on workspace_members and profiles hides, guarded by public.is_workspace_member so only a member of that workspace can call it.';

revoke all on function public.list_workspace_members(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.list_workspace_members(uuid) to authenticated;

commit;
