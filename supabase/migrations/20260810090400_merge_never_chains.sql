-- Contact merge, part 5: merge never chains, for real.
--
-- 20260810090000's column comment and 20260810090300's function comment both
-- assert "merged_into_id never chains" on the strength of one fact:
-- merge_contacts refuses a LOSER that already carries merged_into_id. That
-- stops the same contact being merged twice. It does nothing about a
-- SURVIVOR later being merged away as someone else's loser -- which is the
-- ordinary workflow, not a race: merge A into B today, and next week the
-- duplicates view offers {B, C} and someone merges B into C. Nothing before
-- this migration repointed A, so A.merged_into_id stayed B, and B.merged_into_id
-- now points at C -- a two-hop chain the redirect in src/features/contacts/
-- ui/contact-detail-page.tsx was built to assume never happens.
--
-- The fix: when a survivor is merged away, repoint every contact that pointed
-- at it onto the new survivor, in the same transaction. CREATE OR REPLACE
-- preserves merge_contacts' existing grants; the body below is copied
-- byte-for-byte from 20260810090100 with exactly one statement added,
-- immediately after the loser is stamped, plus updated comments that no
-- longer claim the old, narrower invariant.
--
-- This migration also folds in two one-line fixes to
-- list_duplicate_contact_groups (20260810090200) found by the same review,
-- unrelated to chaining but too small to justify a sixth migration: the
-- per-member subquery reads public.contacts directly instead of re-scanning
-- the materialized `live` CTE up to 50 times per page, and the dedupe on
-- array_agg(distinct ...) states its reliance on sort order explicitly with
-- an ORDER BY rather than depending on a DISTINCT side effect.

begin;

create or replace function public.merge_contacts(
  p_survivor_id uuid,
  p_merged_id uuid,
  p_fields jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_workspace_id uuid;
  v_merged_workspace_id uuid;
  v_key text;
  v_status text;
  v_source text;
  v_owner uuid;
  v_primary_phone text;
  v_survivor_phone_ids uuid[];
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED'
      using errcode = '28000';
  end if;

  if p_survivor_id = p_merged_id then
    raise exception 'CONTACT_MERGE_SAME_CONTACT'
      using errcode = '22023';
  end if;

  -- Locked in id order. Two admins merging the same pair in opposite directions
  -- would otherwise take the two row locks in opposite orders and deadlock.
  perform 1
  from public.contacts c
  where c.id in (p_survivor_id, p_merged_id)
  order by c.id
  for update;

  -- Both sides must be live and not already merged. Folding those conditions
  -- into the lookup means every failure reaching the check below is reported
  -- identically, which is the point.
  select c.workspace_id into v_workspace_id
  from public.contacts c
  where c.id = p_survivor_id
    and c.deleted_at is null
    and c.merged_into_id is null;

  select c.workspace_id into v_merged_workspace_id
  from public.contacts c
  where c.id = p_merged_id
    and c.deleted_at is null
    and c.merged_into_id is null;

  -- One error for "no such contact", "already archived or merged", "a different
  -- workspace", "not an admin here", and "the workspace was soft-deleted". A
  -- definer function that distinguishes them tells any authenticated caller
  -- whether an arbitrary uuid names a real contact, and in which workspace.
  if v_workspace_id is null
     or v_merged_workspace_id is null
     or v_workspace_id <> v_merged_workspace_id
     or not exists (
       select 1
       from public.workspace_members wm
       join public.workspaces w on w.id = wm.workspace_id
       where wm.workspace_id = v_workspace_id
         and wm.user_id = v_actor
         and wm.role = any (array['owner', 'admin'])
         and w.deleted_at is null
     )
  then
    raise exception 'NOT_A_WORKSPACE_ADMIN'
      using errcode = '42501';
  end if;

  -- conversations_contact_channel_unique (contact_id, channel_id) cannot be
  -- relaxed: all three inbound resolvers use it as an ON CONFLICT target. So a
  -- pair holding threads on one channel is refused rather than folded, which
  -- would mean repointing messages and recomputing every counter.
  if exists (
    select 1
    from public.conversations a
    join public.conversations b on b.channel_id = a.channel_id
    where a.contact_id = p_survivor_id
      and b.contact_id = p_merged_id
  ) then
    raise exception 'CONTACT_MERGE_CONVERSATION_CONFLICT'
      using errcode = 'P0001';
  end if;

  -- The client chooses which VALUE wins. It never names a column: an unfiltered
  -- jsonb applied to an UPDATE is a way to write deleted_at, workspace_id or
  -- merged_into_id from the browser.
  for v_key in select jsonb_object_keys(p_fields) loop
    if v_key not in ('name', 'email', 'owner_id', 'status', 'avatar_url', 'source') then
      raise exception 'CONTACT_MERGE_UNKNOWN_FIELD: %', v_key
        using errcode = '22023';
    end if;
  end loop;

  -- Each value is checked against what the column would accept anyway, so the
  -- caller gets a named error instead of a raw 23514 three statements later.
  if p_fields ? 'status' then
    v_status := p_fields ->> 'status';
    if v_status is null
       or v_status not in ('new', 'in_progress', 'done', 'lost') then
      raise exception 'CONTACT_MERGE_INVALID_FIELD: status'
        using errcode = '22023';
    end if;
  end if;

  if p_fields ? 'source' then
    v_source := p_fields ->> 'source';
    if v_source is not null
       and v_source not in ('whatsapp', 'instagram', 'telegram', 'email', 'manual') then
      raise exception 'CONTACT_MERGE_INVALID_FIELD: source'
        using errcode = '22023';
    end if;
  end if;

  if p_fields ? 'owner_id' then
    begin
      v_owner := nullif(p_fields ->> 'owner_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'CONTACT_MERGE_INVALID_FIELD: owner_id'
        using errcode = '22023';
    end;

    if v_owner is not null and not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = v_workspace_id
        and wm.user_id = v_owner
    ) then
      raise exception 'CONTACT_MERGE_INVALID_FIELD: owner_id'
        using errcode = '22023';
    end if;
  end if;

  -- Absent keys leave the column alone; present keys overwrite it. Tags are
  -- always the union and are never a choice: a tag is a label somebody applied
  -- to this person, and the merge does not make it untrue.
  update public.contacts c
  set
    name = case when p_fields ? 'name'
      then nullif(btrim(coalesce(p_fields ->> 'name', '')), '') else c.name end,
    email = case when p_fields ? 'email'
      then nullif(btrim(coalesce(p_fields ->> 'email', '')), '') else c.email end,
    avatar_url = case when p_fields ? 'avatar_url'
      then nullif(p_fields ->> 'avatar_url', '') else c.avatar_url end,
    status = case when p_fields ? 'status' then v_status else c.status end,
    source = case when p_fields ? 'source' then v_source else c.source end,
    owner_id = case when p_fields ? 'owner_id' then v_owner else c.owner_id end,
    tags = (
      select coalesce(array_agg(distinct u.tag order by u.tag), array[]::text[])
      from (
        select unnest(c.tags) as tag
        union
        select unnest(mc.tags)
        from public.contacts mc
        where mc.id = p_merged_id
      ) u
    ),
    -- GREATEST ignores nulls, so a contact that has never been seen does not
    -- erase the other one's timestamp.
    last_seen_at = greatest(
      c.last_seen_at,
      (select mc.last_seen_at from public.contacts mc where mc.id = p_merged_id)
    ),
    updated_at = now()
  where c.id = p_survivor_id;

  update public.conversations
  set contact_id = p_survivor_id
  where contact_id = p_merged_id
    and workspace_id = v_workspace_id;

  -- Stamped here, not last: trg_cascade_contact_archive stamps deleted_at onto
  -- the conversations of a contact being archived, and by now this contact has
  -- none, because they just moved above. Stamping before that move would
  -- archive the survivor's new threads.
  --
  -- Also, not last, for a second reason: enforce_contact_note_integrity's
  -- merge exemption below reads this row's merged_into_id to decide whether
  -- the contact_notes repoint two statements down is a real merge or an
  -- ordinary rewrite, so it has to already be true by the time that UPDATE
  -- runs.
  update public.contacts
  set
    deleted_at = now(),
    merged_into_id = p_survivor_id,
    merged_at = now(),
    merged_by = v_actor,
    updated_at = now()
  where id = p_merged_id;

  -- Merge never chains -- enforced here, not merely assumed. Refusing a
  -- LOSER that already carries merged_into_id (the lookup above) only stops
  -- the same contact being merged twice; it does nothing when a SURVIVOR is
  -- later merged away as someone else's loser, which is the ordinary
  -- workflow: merge A into B today, then B into C next week. Without this
  -- repoint, A.merged_into_id would stay B while B.merged_into_id now points
  -- at C -- a two-hop chain the detail-page redirect never expects to walk.
  -- Repointing every contact that currently points at the just-merged loser
  -- (p_merged_id) onto its new survivor keeps merged_into_id a single hop,
  -- always. Rides contacts_merged_into_idx (workspace_id, merged_into_id).
  update public.contacts
  set merged_into_id = p_survivor_id, updated_at = now()
  where merged_into_id = p_merged_id
    and workspace_id = v_workspace_id;

  update public.contact_notes
  set contact_id = p_survivor_id
  where contact_id = p_merged_id
    and workspace_id = v_workspace_id;

  update public.contact_channels
  set contact_id = p_survivor_id
  where contact_id = p_merged_id
    and workspace_id = v_workspace_id;

  -- Snapshot which rows were the survivor's own *before* the repoint below, so
  -- the renumbering ranking after it can tell "always was the survivor's" from
  -- "just arrived from the loser" -- see the comment on that ranking for why
  -- that distinction is load-bearing, not cosmetic.
  select coalesce(array_agg(cp.id), array[]::uuid[])
  into v_survivor_phone_ids
  from public.contact_phones cp
  where cp.contact_id = p_survivor_id
    and cp.workspace_id = v_workspace_id;

  -- contact_phones_contact_digits_key is (contact_id, digits): a number the
  -- survivor already holds cannot move, so it is left behind and deleted below.
  -- Nothing is lost -- the survivor has that number, however it was spelled.
  update public.contact_phones cp
  set contact_id = p_survivor_id
  where cp.contact_id = p_merged_id
    and cp.workspace_id = v_workspace_id
    and not exists (
      select 1
      from public.contact_phones s
      where s.contact_id = p_survivor_id
        and s.digits = cp.digits
    );

  delete from public.contact_phones
  where contact_id = p_merged_id
    and workspace_id = v_workspace_id;

  -- Moved rows arrive carrying the loser's positions, so the survivor can end up
  -- with two position-0 numbers and no defined primary. Renumber, then re-sync
  -- contacts.phone the way set_contact_phones does.
  --
  -- The survivor's own rows are ranked first, ahead of position/created_at/id:
  -- without that, a moved row and a kept row competing for the same position
  -- are ordered by created_at, and every row touched by this merge shares one
  -- timestamp -- `now()` is constant for the whole transaction -- so the real
  -- tiebreak would fall to a random contact_phones.id and the survivor's own
  -- primary number could be silently replaced by whichever the loser held.
  -- p_fields has no phone key precisely so a human has to choose that
  -- deliberately; this ranking is what keeps a merge from choosing it instead.
  with ordered as (
    select
      cp.id,
      (row_number() over (
        order by
          (cp.id = any (v_survivor_phone_ids)) desc,
          cp.position,
          cp.created_at,
          cp.id
      ) - 1)::integer as rank
    from public.contact_phones cp
    where cp.contact_id = p_survivor_id
      and cp.workspace_id = v_workspace_id
  )
  update public.contact_phones cp
  set position = ordered.rank
  from ordered
  where cp.id = ordered.id
    and cp.position is distinct from ordered.rank;

  select cp.phone into v_primary_phone
  from public.contact_phones cp
  where cp.contact_id = p_survivor_id
    and cp.workspace_id = v_workspace_id
  order by cp.position, cp.created_at, cp.id
  limit 1;

  -- COALESCE, not a bare assignment: a survivor with no contact_phones rows at
  -- all is a pre-20260803120000 row whose only number lives in the column.
  update public.contacts c
  set phone = coalesce(v_primary_phone, c.phone)
  where c.id = p_survivor_id
    and c.phone is distinct from coalesce(v_primary_phone, c.phone);
end;
$$;

comment on function public.merge_contacts(uuid, uuid, jsonb) is
  'Merges p_merged_id into p_survivor_id: repoints conversations, notes, channels and phones, applies the allowlisted scalar values in p_fields, unions tags, takes the later last_seen_at, then archives the loser with merged_into_id. Also repoints any contact that already pointed at p_merged_id from an earlier merge, so merged_into_id never chains even when today''s survivor is itself merged away next week. Owner/admin only, one workspace, one way -- there is no unmerge. Refuses a pair holding conversations on the same channel.';

-- Grants are unchanged by CREATE OR REPLACE, but restated for clarity, matching
-- what 20260810090100 already set.
revoke all on function public.merge_contacts(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.merge_contacts(uuid, uuid, jsonb) to authenticated;


-- =========================================================
-- The column comment: restate the invariant it actually holds now
-- =========================================================

comment on column public.contacts.merged_into_id is
  'The surviving contact this one was merged into, or NULL. Always accompanied by deleted_at. Never chains: whenever a survivor is itself later merged away, merge_contacts repoints every contact that pointed at it onto the new survivor in the same transaction, so this column always names a contact that has not itself been merged.';


-- =========================================================
-- resolve_merged_contact: same behaviour, corrected comments
-- =========================================================
--
-- Nothing about this function's logic changes -- it just reads the column
-- merge_contacts now keeps single-hop for real, instead of single-hop by
-- assumption. CREATE OR REPLACE preserves its existing grants.

create or replace function public.resolve_merged_contact(
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
  -- One hop only: merge_contacts repoints every contact that pointed at a
  -- survivor onto its new survivor whenever that survivor is itself later
  -- merged away, so the value returned here, when not null, always names a
  -- contact that has not itself been merged. No chain to walk.
  return v_survivor_id;
end;
$$;

comment on function public.resolve_merged_contact(uuid, uuid) is
  'The survivor a merged contact was folded into, or null for every other case: no such contact, a different workspace, an ordinary archived contact, a live one, or a caller who is not a member of p_workspace_id. SECURITY DEFINER so it can read a row the contacts SELECT policy hides from everyone once merged_into_id is set. Guarded on workspace membership only -- any member, not owner/admin -- because opening a stale contact URL requires no more authority than opening a live one. One hop only: merge_contacts repoints a chain of prior losers whenever their survivor is itself later merged away, so this never needs to walk more than one link.';

revoke all on function public.resolve_merged_contact(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.resolve_merged_contact(uuid, uuid) to authenticated;


-- =========================================================
-- list_duplicate_contact_groups: two one-line fixes
-- =========================================================
--
-- 1. The per-member subquery (building the `contacts` jsonb column) read the
--    materialized `live` CTE, which Postgres spools into a tuplestore and then
--    re-scans in full for every one of the up to v_limit (<= 50) groups on the
--    page. Reading public.contacts directly is a primary-key lookup instead --
--    same rows, same RLS boundary, since this function is SECURITY INVOKER and
--    `live` was only ever `select ... from public.contacts where workspace_id
--    = p_workspace_id and deleted_at is null` to begin with.
-- 2. `array_agg(distinct k.contact_id)` produced a sorted array as a side
--    effect of how Postgres currently implements DISTINCT inside array_agg,
--    and the `distinct on (g.ids)` dedupe one CTE down silently depends on
--    that array being comparably ordered. Spelling the order explicitly
--    (`order by k.contact_id`) makes the dependency the dedupe relies on part
--    of the query's contract instead of an implementation accident.
--
-- Nothing else about the function changes. CREATE OR REPLACE preserves its
-- existing grants and comment (restated below to keep both current).

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
      -- Explicit ORDER BY: the dedupe below (distinct on (g.ids)) needs this
      -- array comparably ordered across rows that share the same member set,
      -- and that must not depend on whatever order DISTINCT happens to leave
      -- array_agg's input in.
      array_agg(distinct k.contact_id order by k.contact_id) as ids
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
  -- v_limit times rather than once per duplicate in the workspace. Reads
  -- public.contacts directly (a PK lookup) rather than re-scanning the `live`
  -- CTE's tuplestore for every group on the page.
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
      from public.contacts l
      where l.id = any (p.ids)
        and l.workspace_id = p_workspace_id
        and l.deleted_at is null
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

commit;
