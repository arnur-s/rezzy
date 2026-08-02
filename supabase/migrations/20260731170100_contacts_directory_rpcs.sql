-- Contacts directory, part 2 of 2: the two Data API entry points.

begin;

-- =========================================================
-- 1. search_workspace_contacts
-- =========================================================
--
-- SECURITY INVOKER. public.contacts and public.contact_channels are already
-- restricted to workspace members by their select policies, so RLS remains the
-- authorization boundary. p_workspace_id is a *filter*, not the boundary: a
-- non-member passing another workspace's id gets zero rows because the policy
-- rejects them, not because this function checked anything.
--
-- No dynamic SQL anywhere. The sort is a static CASE ladder and the text query
-- reaches the plan only as a bound parameter, so there is no injection surface.
-- This is the specific thing the existing PostgREST conversation search gets
-- wrong: it interpolates raw input into .or(`...ilike.%${q}%,...`), where "," "."
-- "(" and ")" are grammar, so a comma silently rewrites the filter.
--
-- Filter semantics, stated once because "filter by tags" is ambiguous:
--   p_statuses   any-of      status = any(...)
--   p_sources    any-of      source = any(...)
--   p_tags       contains-ALL  tags @> ...   (selecting two tags narrows)
--   owner        p_owner_ids any-of, OR unowned when p_include_unowned
--   across facets  AND

create or replace function public.search_workspace_contacts(
  p_workspace_id uuid,
  p_query text default null,
  p_statuses text[] default null,
  p_sources text[] default null,
  p_tags text[] default null,
  p_owner_ids uuid[] default null,
  p_include_unowned boolean default false,
  p_sort text default 'recent_interaction',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  workspace_id uuid,
  name text,
  -- The string the row prints AND the string name sorts order by, computed once
  -- here so the two can never drift apart in two implementations.
  display_name text,
  phone text,
  email text,
  avatar_url text,
  status text,
  source text,
  tags text[],
  owner_id uuid,
  last_seen_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  channel_types text[],
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_pattern text;
  v_statuses text[] := nullif(p_statuses, '{}'::text[]);
  v_sources text[] := nullif(p_sources, '{}'::text[]);
  v_tags text[] := nullif(p_tags, '{}'::text[]);
  v_owner_ids uuid[] := nullif(p_owner_ids, '{}'::uuid[]);
  v_include_unowned boolean := coalesce(p_include_unowned, false);
  v_sort text;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  -- Closed whitelist. An unrecognised value degrades to the default rather than
  -- raising: the client's Zod search-param schema already .catch()es to the same
  -- default, so a hand-edited URL should render a sane list, not an error page.
  -- Because the value is only ever compared, never concatenated, a sort argument
  -- carrying SQL is inert.
  v_sort := case
    when btrim(coalesce(p_sort, '')) in (
      'recent_interaction',
      'recently_added',
      'recently_updated',
      'name_asc',
      'name_desc'
    ) then btrim(p_sort)
    else 'recent_interaction'
  end;

  if v_query is not null then
    -- Bound the pattern so a pasted document cannot become a multi-megabyte LIKE.
    v_query := left(v_query, 128);
    -- Escape ILIKE's own metacharacters so a search for "50%" means the literal
    -- string. Backslash first, or the escapes introduced by the next two replaces
    -- get escaped in turn.
    v_pattern := '%'
      || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_')
      || '%';
  end if;

  return query
  with matched as (
    select
      c.id as contact_id,
      dn.display_name,
      count(*) over () as match_total,
      row_number() over (
        order by
          -- Every branch that is not the active sort collapses to a constant NULL
          -- and ties out into the next key. The trailing keys make the order
          -- TOTAL -- contacts.id is the primary key, so no two rows compare equal.
          --
          -- A total order removes ties as a source of skipped or repeated rows.
          -- It does NOT make OFFSET stable against concurrent writes: an insert
          -- or delete before the current offset still shifts later pages. That is
          -- accepted for a page-numbered UI; keyset would be the fix, at the cost
          -- of jump-to-page and the total count.
          case when v_sort = 'recent_interaction'
            then c.last_seen_at end desc nulls last,
          case when v_sort = 'recently_added'
            then c.created_at end desc,
          case when v_sort = 'recently_updated'
            then c.updated_at end desc,
          -- Name sorts order by the SAME string the UI prints. The directory
          -- renders name -> first channel handle -> "unnamed", so sorting on
          -- c.name alone would file a channel-only contact under a letter that
          -- appears nowhere on its row. nulls last in BOTH directions, so a
          -- contact with neither name nor handle sinks to the bottom of A-Z and
          -- Z-A alike rather than heading the reverse sort -- and it is never
          -- ordered by a translated placeholder, which would reorder per locale.
          case when v_sort = 'name_asc' then lower(dn.display_name) end
            asc nulls last,
          case when v_sort = 'name_desc' then lower(dn.display_name) end
            desc nulls last,
          c.created_at desc,
          c.id desc
      ) as sort_rank
    from public.contacts c
    left join lateral (
      select coalesce(
        nullif(btrim(c.name), ''),
        (
          select nullif(btrim(cc.external_name), '')
          from public.contact_channels cc
          where cc.contact_id = c.id
            and cc.workspace_id = c.workspace_id
            and nullif(btrim(cc.external_name), '') is not null
          order by cc.created_at asc, cc.id asc
          limit 1
        )
      ) as display_name
    ) dn on true
    where c.workspace_id = p_workspace_id
      and (v_statuses is null or c.status = any (v_statuses))
      and (v_sources is null or c.source = any (v_sources))
      and (v_tags is null or c.tags @> v_tags)
      and (
        -- No owner facet selected at all.
        (v_owner_ids is null and not v_include_unowned)
        -- "Unassigned" chip, alone or alongside named owners.
        or (v_include_unowned and c.owner_id is null)
        or (v_owner_ids is not null and c.owner_id = any (v_owner_ids))
      )
      and (
        v_pattern is null
        or c.name ilike v_pattern
        or c.email ilike v_pattern
        or c.phone ilike v_pattern
        or exists (
          select 1
          from public.contact_channels cc
          where cc.contact_id = c.id
            and cc.workspace_id = c.workspace_id
            and cc.external_name ilike v_pattern
        )
      )
  ),
  page as (
    select m.contact_id, m.display_name, m.match_total, m.sort_rank
    from matched m
    order by m.sort_rank
    limit v_limit
    offset v_offset
  )
  -- Channels are aggregated after the page is cut, so this costs v_limit lateral
  -- scans rather than one per matching row. A plain join here would multiply
  -- contact rows and corrupt both the page size and the count.
  select
    c.id,
    c.workspace_id,
    c.name,
    p.display_name,
    c.phone,
    c.email,
    c.avatar_url,
    c.status,
    c.source,
    c.tags,
    c.owner_id,
    c.last_seen_at,
    c.created_at,
    c.updated_at,
    coalesce(ch.types, array[]::text[]),
    p.match_total
  from page p
  join public.contacts c on c.id = p.contact_id
  left join lateral (
    select array_agg(distinct cc.channel_type order by cc.channel_type) as types
    from public.contact_channels cc
    where cc.contact_id = c.id
      and cc.workspace_id = c.workspace_id
  ) ch on true
  order by p.sort_rank;
end;
$$;

comment on function public.search_workspace_contacts(
  uuid, text, text[], text[], text[], uuid[], boolean, text, integer, integer
) is
  'One page of a workspace''s contacts plus the total number of matches, filtered by free text (contacts.name/email/phone and contact_channels.external_name), status, source, tags and owner. RLS on public.contacts is the workspace boundary; p_workspace_id only narrows. Deliberately returns owner_id and no owner name: public.profiles has own-row RLS, so a join here would return NULL for every co-worker. Resolve owner display names through public.list_workspace_members.';

revoke all on function public.search_workspace_contacts(
  uuid, text, text[], text[], text[], uuid[], boolean, text, integer, integer
) from public, anon, authenticated, service_role;

grant execute on function public.search_workspace_contacts(
  uuid, text, text[], text[], text[], uuid[], boolean, text, integer, integer
) to authenticated;


-- =========================================================
-- 2. list_workspace_members
-- =========================================================
--
-- The owner picker's roster. public.workspace_members and public.profiles are
-- both own-row-only under RLS, so the browser cannot list co-workers today --
-- getWorkspaceMembers() silently returns just the caller. This is the narrow,
-- guarded hole for that, rather than broadening either policy: membership and
-- profile rows stay invisible except through a workspace the caller has already
-- proven they belong to.

create or replace function public.list_workspace_members(p_workspace_id uuid)
returns table (
  user_id uuid,
  role text,
  full_name text,
  avatar_url text,
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
  --
  -- Email is deliberately not returned. The picker needs a name and a face;
  -- exposing every colleague's address is a wider hole than the feature needs.
  return query
  select
    wm.user_id,
    wm.role,
    p.full_name,
    p.avatar_url,
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
  'Members of one workspace with their profile display fields, for owner and assignee pickers. SECURITY DEFINER so it can see rows the own-row RLS on workspace_members and profiles hides, guarded by public.is_workspace_member so only a member of that workspace can call it.';

revoke all on function public.list_workspace_members(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.list_workspace_members(uuid) to authenticated;

commit;
