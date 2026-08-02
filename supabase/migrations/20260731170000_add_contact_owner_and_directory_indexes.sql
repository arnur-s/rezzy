-- Contacts directory, part 1 of 2: an owner per contact, trigram indexes for the
-- directory's search, and removal of the legacy single-note column.
--
-- Part 2 (20260731170100) adds the Data API surface that reads all of this.

begin;

-- =========================================================
-- 1. contacts.owner_id
-- =========================================================
--
-- References public.profiles(id) rather than auth.users(id), unlike the older
-- conversations.assigned_to:
--
--   * profiles is the only table carrying full_name / avatar_url, which both the
--     owner picker and the directory rows render. auth.users is not on the Data
--     API, which is why every conversation query already pays a second round trip
--     to hand-join assignee profiles in TypeScript.
--   * public.workspace_members.user_id already references public.profiles(id), so
--     "is a member" and "is an owner" resolve against one identity table.
--   * profiles.id references auth.users(id) on delete cascade, so deleting the
--     auth user still clears the owner. This is not the weaker guarantee.
--
-- on delete set null matches contact_notes.author_id: losing a colleague must not
-- lose the contact.

alter table public.contacts
  add column if not exists owner_id uuid
    references public.profiles(id) on delete set null;

comment on column public.contacts.owner_id is
  'Workspace member accountable for this contact. Enforced to be a current member of contacts.workspace_id by trg_ensure_contact_owner_is_workspace_member.';

-- Every FK column needs a non-partial btree with the FK column leading (see
-- 20260720093622 and the expected_indexes contract in
-- supabase/tests/database/performance_contract.test.sql). This also serves the
-- directory's owner facet.
create index if not exists contacts_owner_id_fkey_idx
  on public.contacts using btree (owner_id);


-- =========================================================
-- 2. Owner must be a member of the contact's workspace
-- =========================================================
--
-- SECURITY DEFINER, deliberately, and this is the one thing about this function
-- that must not be "simplified" later.
--
-- public.ensure_conversation_assignee_is_workspace_member() (20260518130000) is
-- security invoker, and public.workspace_members has own-row-only RLS
-- ("Users can view own workspace memberships": user_id = auth.uid()). An
-- invoker-rights EXISTS over workspace_members can therefore only ever see the
-- caller's own membership row, so it rejects every co-worker. Copying that shape
-- here would mean a user could only ever assign a contact to themselves, which is
-- precisely the feature this guard exists to permit.
--
-- Running as definer, the EXISTS sees the real membership set. It reads no caller
-- input beyond the row being written, returns no data, and is executable by no
-- Data API role, so the widened visibility cannot leak.

create or replace function public.ensure_contact_owner_is_workspace_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is not null
    and not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = new.workspace_id
        and wm.user_id = new.owner_id
    )
  then
    raise exception 'CONTACT_OWNER_NOT_WORKSPACE_MEMBER'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

revoke all on function public.ensure_contact_owner_is_workspace_member()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_ensure_contact_owner_is_workspace_member
  on public.contacts;

create trigger trg_ensure_contact_owner_is_workspace_member
  before insert or update of owner_id, workspace_id
  on public.contacts
  for each row
  execute function public.ensure_contact_owner_is_workspace_member();


-- =========================================================
-- 3. Retire the legacy contacts.notes column
-- =========================================================
--
-- 20260731143003 copied every nonblank value into public.contact_notes. Nothing
-- has written the column since, and the last client read of it was removed in the
-- same change as this migration.
--
-- The re-run below is belt and braces: it costs nothing on an already-migrated
-- database and it is the difference between "we believe the backfill ran" and
-- "no row is dropped that is not already preserved". The assertion after it turns
-- any surviving unmigrated row into a failed migration rather than silent loss.
--
-- contact_notes_integrity derives workspace_id from the contact and leaves
-- author_id/author_name null when auth.uid() is null, which is exactly the
-- author-less "imported note" shape the original backfill produced.

insert into public.contact_notes (contact_id, body, is_pinned, created_at, updated_at)
select c.id, btrim(c.notes), false, c.created_at, c.updated_at
from public.contacts c
where nullif(btrim(c.notes), '') is not null
  and not exists (
    select 1
    from public.contact_notes n
    where n.contact_id = c.id
      and n.body = btrim(c.notes)
  );

do $$
begin
  if exists (
    select 1
    from public.contacts c
    where nullif(btrim(c.notes), '') is not null
      and not exists (
        select 1
        from public.contact_notes n
        where n.contact_id = c.id
          and n.body = btrim(c.notes)
      )
  ) then
    raise exception 'LEGACY_CONTACT_NOTES_NOT_MIGRATED';
  end if;
end $$;

-- Metadata-only: there are no views over public.contacts, and it is in the
-- supabase_realtime publication without a column list.
alter table public.contacts drop column if exists notes;


-- =========================================================
-- 4. Trigram indexes for directory search
-- =========================================================
--
-- Installed into "extensions", not "public": supabase/config.toml already puts
-- "extensions" on every request's search_path, and "public" is the schema
-- PostgREST exposes as RPCs. pg_trgm's similarity(), show_trgm() and set_limit()
-- do not belong on the Data API surface. Operator classes are schema-qualified
-- below because a migration's search_path is not a request's search_path.

create extension if not exists pg_trgm with schema extensions;

-- One multicolumn GIN rather than three single-column ones. public.contacts is on
-- the hot inbound path -- sync_contact_last_seen() touches a contact on every
-- inbound message, and because idx_contacts_last_seen covers last_seen_at those
-- updates can never be HOT, so each extra index is a guaranteed extra index write
-- per message. Postgres answers the directory's OR across the three columns with
-- a BitmapOr over this single index.
create index if not exists contacts_search_trgm_idx
  on public.contacts using gin (
    name extensions.gin_trgm_ops,
    email extensions.gin_trgm_ops,
    phone extensions.gin_trgm_ops
  );

-- Channel handles are searched too: a contact created from an inbound Telegram
-- message frequently has a null name and is findable only by its handle.
create index if not exists contact_channels_external_name_trgm_idx
  on public.contact_channels using gin (
    external_name extensions.gin_trgm_ops
  );

-- No name/created_at/updated_at sort indexes, deliberately. The directory's
-- count(*) over () has an unbounded frame, so the WindowAgg reads the entire
-- matching set before emitting row 1 regardless; a sort-supporting index would
-- save only the sort of a set already fully read, while costing an extra index
-- write per inbound message. The existing idx_contacts_last_seen already covers
-- the default sort. Revisit if a workspace ever grows past ~100k contacts.

commit;
