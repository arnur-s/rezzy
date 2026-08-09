-- Contact merge, part 2 of 3: the mutation.
--
-- Repoints the four tables that reference a contact onto a survivor, applies the
-- scalar values a human picked, and archives the loser. One way: there is no
-- unmerge, and the only thing it destroys is whichever of the survivor's scalar
-- fields the picker chose to overwrite.
--
-- SECURITY DEFINER with an explicit owner/admin check, following
-- public.archive_contact. Merge is strictly more destructive than archive, so it
-- must not carry a weaker authority than archive does -- including the
-- workspaces.deleted_at join 20260809120000 added to archive_contact and
-- restore_contact after both were found reading workspace_members directly and
-- letting a caller keep acting on a soft-deleted workspace. Omitting it here
-- would reopen that same containment gap in a brand new function.
--
-- public.enforce_contact_note_integrity (20260731143003, tightened to definer
-- rights in 20260804090000) unconditionally refuses to change a note's
-- contact_id -- CONTACT_NOTE_IDENTITY_IMMUTABLE, 23514 -- which blocks the
-- repoint below outright. That trigger runs on every UPDATE regardless of who
-- issues it, definer rights included, so merge_contacts cannot get past it by
-- privilege alone; it needs a narrow, data-driven exemption, which this
-- migration adds below: a contact_id change is allowed only when the row it is
-- moving away from is already recorded as merged into the row it is moving to.
-- That is true only once this function has stamped the loser, so the stamp
-- moves up to run right after conversations are repointed instead of last --
-- notes, channels and phones move after it, not before. The conversations move
-- still has to precede the stamp, for the reason given at the stamp below;
-- nothing else does.

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

  update public.contact_notes
  set contact_id = p_survivor_id
  where contact_id = p_merged_id
    and workspace_id = v_workspace_id;

  update public.contact_channels
  set contact_id = p_survivor_id
  where contact_id = p_merged_id
    and workspace_id = v_workspace_id;

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
  with ordered as (
    select
      cp.id,
      (row_number() over (order by cp.position, cp.created_at, cp.id) - 1)::integer as rank
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
  'Merges p_merged_id into p_survivor_id: repoints conversations, notes, channels and phones, applies the allowlisted scalar values in p_fields, unions tags, then archives the loser with merged_into_id. Owner/admin only, one workspace, one way -- there is no unmerge. Refuses a pair holding conversations on the same channel.';

revoke all on function public.merge_contacts(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.merge_contacts(uuid, uuid, jsonb) to authenticated;


-- =========================================================
-- enforce_contact_note_integrity: allow a merge to move a note
-- =========================================================
--
-- Unchanged from 20260804090000 except the one exemption below. CREATE OR
-- REPLACE preserves its existing grants (there are none to restate; it is
-- never callable directly, only fired as a trigger).

create or replace function public.enforce_contact_note_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  contact_workspace_id uuid;
  current_user_id uuid := (select auth.uid());
  author_profile_was_deleted boolean := false;
  -- True only when old.contact_id is itself already merged into
  -- new.contact_id -- a state only merge_contacts produces, by stamping the
  -- loser before it repoints notes. This is data-driven on purpose: a
  -- definer function does not need this exemption to move a note at the
  -- privilege layer (definer rights already bypass every column grant), so
  -- gating on privilege would exempt every future definer function that
  -- touches this table, not just a real merge.
  contact_id_move_is_merge boolean := false;
begin
  if tg_op = 'INSERT' then
    select c.workspace_id
    into contact_workspace_id
    from public.contacts c
    where c.id = new.contact_id;

    if contact_workspace_id is null then
      raise exception 'CONTACT_NOTE_CONTACT_NOT_FOUND'
        using errcode = '23503';
    end if;

    new.workspace_id := contact_workspace_id;
    new.body := btrim(new.body);

    if current_user_id is not null then
      new.author_id := current_user_id;

      select nullif(btrim(p.full_name), '')
      into new.author_name
      from public.profiles p
      where p.id = current_user_id;
    end if;

    return new;
  end if;

  -- Now that profiles is visible in full, this is true only when the author's
  -- profile is genuinely gone, which is the case the allowance exists for: the
  -- author_id FK is ON DELETE SET NULL, so the null arrives with the row.
  author_profile_was_deleted :=
    old.author_id is not null
    and new.author_id is null
    and not exists (
      select 1
      from public.profiles p
      where p.id = old.author_id
    );

  if new.contact_id is distinct from old.contact_id then
    select exists (
      select 1
      from public.contacts c
      where c.id = old.contact_id
        and c.merged_into_id = new.contact_id
    )
    into contact_id_move_is_merge;
  end if;

  if new.id is distinct from old.id
    or new.workspace_id is distinct from old.workspace_id
    or (new.contact_id is distinct from old.contact_id and not contact_id_move_is_merge)
    or (
      new.author_id is distinct from old.author_id
      and not author_profile_was_deleted
    )
    or new.author_name is distinct from old.author_name
    or new.created_at is distinct from old.created_at
  then
    raise exception 'CONTACT_NOTE_IDENTITY_IMMUTABLE'
      using errcode = '23514';
  end if;

  new.body := btrim(new.body);

  if new.body is distinct from old.body
    and old.author_id is distinct from current_user_id
  then
    raise exception 'CONTACT_NOTE_BODY_AUTHOR_ONLY'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_contact_note_integrity()
from public, anon, authenticated, service_role;

commit;
