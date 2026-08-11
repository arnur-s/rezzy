-- Contact merge, part 6: a number that lives only in contacts.phone survives.
--
-- 20260809110000 sets contacts.phone directly and deliberately leaves
-- public.contact_phones empty -- "a contact whose only number came from the
-- webhook already looks exactly like this: the column set, the table empty" --
-- so every WhatsApp-derived contact, and every row written before
-- 20260803120000, holds its only number in the column.
--
-- list_duplicate_contact_groups reads both, contact_phones.digits UNION
-- phone_digits(contacts.phone), so exactly those contacts are offered as merge
-- candidates. merge_contacts read only the table: it repointed the loser's
-- contact_phones rows, of which such a contact has none, and never looked at
-- the loser's column. The number was dropped silently, and p_fields has no
-- phone key, so nothing asked the admin first. There is no unmerge, so the
-- loss was final.
--
-- The fix: materialize both sides' column numbers into contact_phones before
-- the repoint, on the same terms as 20260803120000's backfill. The loser's
-- number then travels with every other phone it holds. Materializing the
-- SURVIVOR's column as well is what preserves the existing guarantee that a
-- merge never silently replaces the survivor's primary number -- see the
-- comment on the statement itself.
--
-- count_contact_merge_children gains the same dual read, so the confirmation
-- step counts the merge that will actually run.
--
-- CREATE OR REPLACE preserves both functions' existing grants; the
-- merge_contacts body below is copied byte-for-byte from 20260810090400 with
-- exactly one statement added, immediately before the survivor-phone snapshot.

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

  -- 20260809110000 sets contacts.phone without writing contact_phones, so a
  -- WhatsApp-derived contact -- and any row written before 20260803120000 --
  -- holds its only number in the column. list_duplicate_contact_groups reads
  -- the column as well as the table, so exactly those contacts arrive here as
  -- merge candidates, and repointing contact_phones alone drops the loser's
  -- number with nothing to show for it: p_fields has no phone key to ask with,
  -- and there is no unmerge. Materialize both sides first, on the same terms
  -- as 20260803120000's backfill -- btrim, plus the two length checks the
  -- table's own constraints enforce, so a value too short to be a number is
  -- left in the column rather than raising here. ON CONFLICT DO NOTHING covers
  -- the ordinary case, where set_contact_phones already keeps the column and
  -- the table in step.
  --
  -- Both sides, not only the loser: leave the survivor's column
  -- unmaterialized and the loser's new row becomes the survivor's *only*
  -- contact_phones row, so the re-sync at the end of this function promotes it
  -- into contacts.phone -- exactly the silent replacement of the survivor's
  -- primary number that the ranking below exists to prevent.
  insert into public.contact_phones (workspace_id, contact_id, phone, position)
  select c.workspace_id, c.id, btrim(c.phone), 0
  from public.contacts c
  where c.id in (p_survivor_id, p_merged_id)
    and c.workspace_id = v_workspace_id
    and nullif(btrim(c.phone), '') is not null
    and char_length(public.phone_digits(c.phone)) >= 5
    and char_length(btrim(c.phone)) between 3 and 32
  on conflict do nothing;

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
-- count_contact_merge_children: count the numbers the merge will actually move
-- =========================================================
--
-- Counting public.contact_phones alone reported phone_count = 0 for precisely
-- the contacts the duplicates view surfaces on a column-only number, so the
-- confirmation step described a different merge from the one that would run.
-- Same dual read as list_duplicate_contact_groups, same UNION, so a column
-- already mirrored by a row counts once rather than twice.

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
    (select count(*)::integer from (
      select cp.digits
      from public.contact_phones cp
      where cp.contact_id = p_contact_id and cp.workspace_id = p_workspace_id

      union

      -- Rows written before 20260803120000, or by anything other than
      -- set_contact_phones, hold their only number in the column.
      select public.phone_digits(c.phone)
      from public.contacts c
      where c.id = p_contact_id
        and c.workspace_id = p_workspace_id
        and char_length(public.phone_digits(c.phone)) >= 5
    ) d),
    (select count(*)::integer from public.contact_channels cc
      where cc.contact_id = p_contact_id and cc.workspace_id = p_workspace_id)
$$;

comment on function public.count_contact_merge_children(uuid, uuid) is
  'Conversations, notes, phones and channels attached to one contact -- what a merge would move. Phones are counted the way merge_contacts moves them: contact_phones rows unioned with a contacts.phone that no row mirrors. SECURITY INVOKER; RLS is the boundary.';

-- Grants are unchanged by CREATE OR REPLACE, but restated for clarity, matching
-- what 20260810090200 already set.
revoke all on function public.count_contact_merge_children(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.count_contact_merge_children(uuid, uuid)
  to authenticated;

commit;
