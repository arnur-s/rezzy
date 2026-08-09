-- Contact merge, part 3 of 3: finding the duplicates, and counting what a merge
-- would move.
--
-- Exact identity keys only, the same three the product already trusts in
-- public.match_workspace_contacts: normalized phone digits, a channel identity,
-- an exact email. A display name is not a key and never will be -- two people
-- share a name far more often than they share a number, and a name-based
-- "duplicate" invites someone to collapse two real customers.

begin;

create or replace function public.list_duplicate_contact_groups(
  p_workspace_id uuid,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  group_key text,
  match_reason text,
  contacts jsonb,
  contact_count integer,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  return query
  -- SECURITY INVOKER: RLS on public.contacts is the boundary and p_workspace_id
  -- only narrows, exactly as in match_workspace_contacts. Archived and merged
  -- rows are excluded here so a merged contact never reappears as its own
  -- duplicate.
  with live as (
    select
      c.id, c.workspace_id, c.name, c.phone, c.email, c.avatar_url,
      c.status, c.source, c.owner_id, c.tags, c.last_seen_at
    from public.contacts c
    where c.workspace_id = p_workspace_id
      and c.deleted_at is null
  ),
  keyed as (
    select 1 as rank, 'phone'::text as reason, cp.digits as key, cp.contact_id
    from public.contact_phones cp
    join live l on l.id = cp.contact_id
    where cp.workspace_id = p_workspace_id

    union

    -- Rows written before 20260803120000, or by anything other than
    -- set_contact_phones, hold their only number in the column.
    select 1, 'phone', public.phone_digits(l.phone), l.id
    from live l
    where l.phone is not null
      and char_length(public.phone_digits(l.phone)) >= 5

    union

    -- Keyed by type:id so a Telegram user id cannot match a wa_id that happens
    -- to be the same digits. Because (channel_id, external_id) is globally
    -- unique, this only ever groups across different channel rows of one type.
    select 2, 'channel', cc.channel_type || ':' || cc.external_id, cc.contact_id
    from public.contact_channels cc
    join live l on l.id = cc.contact_id
    where cc.workspace_id = p_workspace_id

    union

    select 3, 'email', lower(btrim(l.email)), l.id
    from live l
    where nullif(btrim(l.email), '') is not null
  ),
  grouped as (
    select
      k.rank,
      k.reason,
      k.key,
      -- DISTINCT sorts, which is what makes the dedupe below comparable.
      array_agg(distinct k.contact_id) as ids
    from keyed k
    group by k.rank, k.reason, k.key
    having count(distinct k.contact_id) > 1
  ),
  -- One row per member set. A pair sharing a number AND an email is one
  -- duplicate, reported under the strongest reason rather than twice.
  deduped as (
    select distinct on (g.ids) g.rank, g.reason, g.key, g.ids
    from grouped g
    order by g.ids, g.rank, g.key
  ),
  ranked as (
    select
      d.rank, d.reason, d.key, d.ids,
      count(*) over () as match_total,
      row_number() over (
        order by d.rank, cardinality(d.ids) desc, d.key
      ) as sort_rank
    from deduped d
  ),
  page as (
    select r.rank, r.reason, r.key, r.ids, r.match_total, r.sort_rank
    from ranked r
    order by r.sort_rank
    limit v_limit
    offset v_offset
  )
  -- Members are built after the page is cut, so the per-member subqueries run
  -- v_limit times rather than once per duplicate in the workspace.
  select
    p.key,
    p.reason,
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          -- Computed exactly as search_workspace_contacts and
          -- list_archived_contacts compute it, so a row reads the same in all
          -- three views.
          'display_name', coalesce(
            nullif(btrim(l.name), ''),
            (
              select nullif(btrim(cc.external_name), '')
              from public.contact_channels cc
              where cc.contact_id = l.id
                and cc.workspace_id = l.workspace_id
                and nullif(btrim(cc.external_name), '') is not null
              order by cc.created_at asc, cc.id asc
              limit 1
            )
          ),
          -- Both. display_name is what the row shows; name is what a merge
          -- would actually write to contacts.name, and they differ whenever a
          -- contact has no name of its own and borrowed a channel handle.
          -- Merging the borrowed handle into the name column would invent a
          -- name nobody typed.
          'name', l.name,
          'phone', l.phone,
          'email', l.email,
          'avatar_url', l.avatar_url,
          'status', l.status,
          'source', l.source,
          'owner_id', l.owner_id,
          'tags', to_jsonb(l.tags),
          'last_seen_at', l.last_seen_at,
          'conversation_count', (
            select count(*)
            from public.conversations cv
            where cv.contact_id = l.id
              and cv.workspace_id = l.workspace_id
          )
        )
        order by l.last_seen_at desc nulls last, l.id
      )
      from live l
      where l.id = any (p.ids)
    ),
    cardinality(p.ids)::integer,
    p.match_total
  from page p
  order by p.sort_rank;
end;
$$;

comment on function public.list_duplicate_contact_groups(uuid, integer, integer) is
  'Groups of live contacts in one workspace that share an exact identity key -- normalized phone digits, channel_type:external_id, or a lowercased email -- strongest reason first, one row per member set. Never groups on a display name. SECURITY INVOKER: RLS on public.contacts is the boundary.';

revoke all on function public.list_duplicate_contact_groups(uuid, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.list_duplicate_contact_groups(uuid, integer, integer)
  to authenticated;


-- =========================================================
-- count_contact_merge_children
-- =========================================================
--
-- What a merge would move, for the confirmation step. Four counts in one round
-- trip rather than four queries the dialog would have to assemble, and it is the
-- same answer whichever entry point opened the dialog.

create or replace function public.count_contact_merge_children(
  p_workspace_id uuid,
  p_contact_id uuid
)
returns table (
  conversation_count integer,
  note_count integer,
  phone_count integer,
  channel_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select count(*)::integer from public.conversations cv
      where cv.contact_id = p_contact_id and cv.workspace_id = p_workspace_id),
    (select count(*)::integer from public.contact_notes cn
      where cn.contact_id = p_contact_id and cn.workspace_id = p_workspace_id),
    (select count(*)::integer from public.contact_phones cp
      where cp.contact_id = p_contact_id and cp.workspace_id = p_workspace_id),
    (select count(*)::integer from public.contact_channels cc
      where cc.contact_id = p_contact_id and cc.workspace_id = p_workspace_id)
$$;

comment on function public.count_contact_merge_children(uuid, uuid) is
  'Conversations, notes, phones and channels attached to one contact -- what a merge would move. SECURITY INVOKER; RLS is the boundary.';

revoke all on function public.count_contact_merge_children(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.count_contact_merge_children(uuid, uuid)
  to authenticated;

commit;
