-- Contact identity, part 1 of 1: normalized phone storage, a workspace phone
-- region, and the server-side identity lookup the shared-contact card uses.
--
-- Why this exists
-- ---------------
-- The first cut of "is this shared contact already in the CRM?" pre-filtered
-- `contacts.phone` with a wildcard ILIKE and finished the comparison in the
-- browser, bounded to 200 rows. Past 200 contacts in a workspace that lookup can
-- MISS an existing contact and offer "Create contact" for someone who is already
-- there — a duplicate-creating correctness bug, not a performance one. Matching
-- therefore moves into the database, where it is an indexed equality over
-- normalized digits and reads every candidate row rather than a page of them.
--
-- It also fixes the other half of the problem: a contact could only hold ONE
-- phone number, so a shared card carrying three numbers lost two of them and
-- could not be matched by them afterwards.

begin;

-- =========================================================
-- 1. phone_digits
-- =========================================================
--
-- The normal form both sides of a comparison are reduced to. IMMUTABLE so it can
-- back a generated column and an index; STRICT so a null stays null rather than
-- collapsing to the empty string, which would make every null phone equal.
--
-- Deliberately dumb: it strips punctuation and nothing else. All country
-- reasoning — E.164 vs trunk-prefixed national, and which region an ambiguous
-- local number belongs to — happens in the client before the digits arrive here,
-- because that reasoning needs a phone-number metadata library that Postgres does
-- not have. The database's job is exact matching over a canonical form.
create or replace function public.phone_digits(p_value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select regexp_replace(p_value, '[^0-9]', '', 'g')
$$;

comment on function public.phone_digits(text) is
  'Digits of a written phone number, with +, spaces, brackets and dashes removed. IMMUTABLE so it can back generated columns and indexes. Country interpretation is the client''s job; this is only the canonical comparison form.';

revoke all on function public.phone_digits(text) from public, anon;
grant execute on function public.phone_digits(text) to authenticated, service_role;

-- =========================================================
-- 2. contact_phones
-- =========================================================
--
-- One row per number a contact can be reached on. `contacts.phone` stays as the
-- primary number — every existing read, the directory search and the RPCs above
-- it keep working untouched — and this table is the complete set, position 0
-- being the primary. `set_contact_phones` below is what keeps the two in step;
-- nothing else should write this table.
create table public.contact_phones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  contact_id uuid not null,
  phone text not null,
  -- Generated, not application-supplied: a normalized column that the client
  -- computes is a normalized column that eventually disagrees with itself.
  digits text generated always as (public.phone_digits(phone)) stored,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint contact_phones_contact_workspace_fkey
    foreign key (workspace_id, contact_id)
    references public.contacts(workspace_id, id)
    on delete cascade,
  constraint contact_phones_phone_length_check
    check (char_length(btrim(phone)) between 3 and 32),
  -- Five digits is the shortest string worth storing as a number rather than as
  -- a fragment; it is also the floor the client's matcher refuses to expand.
  constraint contact_phones_digits_length_check
    check (char_length(public.phone_digits(phone)) >= 5),
  constraint contact_phones_position_check check (position >= 0)
);

-- One contact cannot hold the same number twice, however it was spelled.
create unique index contact_phones_contact_digits_key
  on public.contact_phones (contact_id, digits);

-- The lookup index: workspace first, because every match is workspace-scoped and
-- the workspace boundary must not be a filter applied after a global digit scan.
create index contact_phones_workspace_digits_idx
  on public.contact_phones (workspace_id, digits);

create index contact_phones_contact_position_idx
  on public.contact_phones (contact_id, position, created_at);

-- Existing single numbers become position 0 of the new set. Rows whose stored
-- value carries too few digits to be a number are left behind rather than
-- inserted and then failing the check.
insert into public.contact_phones (workspace_id, contact_id, phone, position)
select c.workspace_id, c.id, btrim(c.phone), 0
from public.contacts c
where nullif(btrim(c.phone), '') is not null
  and char_length(public.phone_digits(c.phone)) >= 5
  and char_length(btrim(c.phone)) between 3 and 32
on conflict do nothing;

alter table public.contact_phones enable row level security;

revoke all privileges on table public.contact_phones
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.contact_phones
  to authenticated;
grant select, insert, update, delete on table public.contact_phones
  to service_role;

-- Same boundary as public.contacts: a workspace member sees and edits the phone
-- numbers of that workspace's contacts and no others.
create policy "Workspace members can view contact phones"
  on public.contact_phones
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can add contact phones"
  on public.contact_phones
  for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.contacts c
      where c.workspace_id = contact_phones.workspace_id
        and c.id = contact_phones.contact_id
    )
  );

create policy "Workspace members can update contact phones"
  on public.contact_phones
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "Workspace members can delete contact phones"
  on public.contact_phones
  for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- =========================================================
-- 3. set_contact_phones
-- =========================================================
--
-- Replaces a contact's whole number set in one statement pair, and syncs
-- `contacts.phone` to the first entry. Atomic on purpose: writing the table from
-- the client as delete-then-insert would leave a contact with no numbers if the
-- second call failed.
--
-- SECURITY INVOKER — the policies above are the authorization boundary, so a
-- caller who is not a member of p_workspace_id deletes nothing and inserts
-- nothing rather than being told they were refused.
create or replace function public.set_contact_phones(
  p_workspace_id uuid,
  p_contact_id uuid,
  p_phones text[]
)
returns table (id uuid, phone text, digits text, position integer)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  -- Trimmed, de-duplicated by digits, order preserved, capped. The cap is a
  -- guard against a pasted document, not a product limit anyone will reach.
  v_phones text[];
begin
  with cleaned as (
    select btrim(raw.value) as value, raw.ordinality as rank
    from unnest(coalesce(p_phones, array[]::text[]))
      with ordinality as raw(value, ordinality)
    where nullif(btrim(raw.value), '') is not null
      and char_length(public.phone_digits(raw.value)) >= 5
      and char_length(btrim(raw.value)) between 3 and 32
  ),
  -- Two spellings of one number are one number: the first spelling wins, so the
  -- set the user typed keeps the form they typed it in.
  deduped as (
    select
      (array_agg(cleaned.value order by cleaned.rank))[1] as value,
      min(cleaned.rank) as rank
    from cleaned
    group by public.phone_digits(cleaned.value)
  ),
  capped as (
    select deduped.value, deduped.rank
    from deduped
    order by deduped.rank
    limit 10
  )
  select coalesce(array_agg(capped.value order by capped.rank), array[]::text[])
  into v_phones
  from capped;

  delete from public.contact_phones cp
  where cp.workspace_id = p_workspace_id
    and cp.contact_id = p_contact_id
    and not exists (
      select 1
      from unnest(v_phones) as kept(value)
      where public.phone_digits(kept.value) = cp.digits
    );

  insert into public.contact_phones (workspace_id, contact_id, phone, position)
  select p_workspace_id, p_contact_id, entry.value, entry.ordinality - 1
  from unnest(v_phones) with ordinality as entry(value, ordinality)
  on conflict (contact_id, digits) do update
    set phone = excluded.phone,
        position = excluded.position;

  -- The primary number is what `contacts.phone` means, and the directory search,
  -- the inbox panel and every existing read still go through that column.
  update public.contacts c
  set phone = v_phones[1]
  where c.workspace_id = p_workspace_id
    and c.id = p_contact_id
    and c.phone is distinct from v_phones[1];

  return query
  select cp.id, cp.phone, cp.digits, cp.position
  from public.contact_phones cp
  where cp.workspace_id = p_workspace_id
    and cp.contact_id = p_contact_id
  order by cp.position, cp.created_at, cp.id;
end;
$$;

comment on function public.set_contact_phones(uuid, uuid, text[]) is
  'Replaces one contact''s phone numbers with the given list (order significant, first is primary, duplicates by digits collapsed, capped at 10) and syncs public.contacts.phone to the first entry. SECURITY INVOKER: RLS on public.contact_phones and public.contacts is the boundary.';

revoke all on function public.set_contact_phones(uuid, uuid, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.set_contact_phones(uuid, uuid, text[]) to authenticated;

-- =========================================================
-- 4. list_contact_phones
-- =========================================================
create or replace function public.list_contact_phones(
  p_workspace_id uuid,
  p_contact_id uuid
)
returns table (id uuid, phone text, digits text, position integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select cp.id, cp.phone, cp.digits, cp.position
  from public.contact_phones cp
  where cp.workspace_id = p_workspace_id
    and cp.contact_id = p_contact_id
  order by cp.position, cp.created_at, cp.id
$$;

comment on function public.list_contact_phones(uuid, uuid) is
  'One contact''s phone numbers in primary-first order. SECURITY INVOKER; RLS is the boundary.';

revoke all on function public.list_contact_phones(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.list_contact_phones(uuid, uuid) to authenticated;

-- =========================================================
-- 5. match_workspace_contacts
-- =========================================================
--
-- "Which contacts in THIS workspace already carry one of these identifiers?"
--
-- Three sources, in the confidence order the product states:
--
--   phone    contact_phones.digits, plus contacts.phone for any row written
--            before this migration or by something other than set_contact_phones
--   channel  contact_channels, keyed by 'channel_type:external_id' so a Telegram
--            user id can never match a wa_id that happens to be the same digits
--   email    exact, case-insensitive
--
-- A display name is not a source and never will be: two people share a name far
-- more often than they share a number.
--
-- Every branch is an equality against an indexed expression, so this reads the
-- matching rows rather than a bounded page of the workspace. That is the whole
-- point of moving it here.
create or replace function public.match_workspace_contacts(
  p_workspace_id uuid,
  p_phone_digits text[] default null,
  p_emails text[] default null,
  p_identities text[] default null,
  p_limit integer default 6
)
returns table (
  id uuid,
  name text,
  phone text,
  email text,
  avatar_url text,
  status text,
  match_reason text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_digits text[] := nullif(p_phone_digits, '{}'::text[]);
  v_emails text[] := nullif(p_emails, '{}'::text[]);
  v_identities text[] := nullif(p_identities, '{}'::text[]);
  v_limit integer := least(greatest(coalesce(p_limit, 6), 1), 25);
begin
  if v_digits is null and v_emails is null and v_identities is null then
    return;
  end if;

  return query
  with matched as (
    select cp.contact_id, 1 as rank
    from public.contact_phones cp
    where cp.workspace_id = p_workspace_id
      and v_digits is not null
      and cp.digits = any (v_digits)

    union all

    select c.id, 1
    from public.contacts c
    where c.workspace_id = p_workspace_id
      and v_digits is not null
      and c.phone is not null
      and public.phone_digits(c.phone) = any (v_digits)

    union all

    select cc.contact_id, 2
    from public.contact_channels cc
    where cc.workspace_id = p_workspace_id
      and v_identities is not null
      and (cc.channel_type || ':' || cc.external_id) = any (v_identities)

    union all

    select c.id, 3
    from public.contacts c
    where c.workspace_id = p_workspace_id
      and v_emails is not null
      and c.email is not null
      and lower(btrim(c.email)) = any (v_emails)
  ),
  best as (
    select m.contact_id, min(m.rank) as rank
    from matched m
    group by m.contact_id
  )
  select
    c.id,
    c.name,
    c.phone,
    c.email,
    c.avatar_url,
    c.status,
    case b.rank when 1 then 'phone' when 2 then 'channel' else 'email' end
  from best b
  join public.contacts c
    on c.id = b.contact_id
   and c.workspace_id = p_workspace_id
  -- Total order, so "the first match" is the same match on every call.
  order by b.rank, c.created_at, c.id
  limit v_limit;
end;
$$;

comment on function public.match_workspace_contacts(uuid, text[], text[], text[], integer) is
  'Contacts in one workspace carrying any of the given normalized phone digits, channel identities (channel_type:external_id) or lowercased emails, strongest signal first. Never matches on a display name. SECURITY INVOKER: RLS on public.contacts is the boundary and p_workspace_id only narrows.';

revoke all on function public.match_workspace_contacts(uuid, text[], text[], text[], integer)
  from public, anon, authenticated, service_role;
grant execute on function public.match_workspace_contacts(uuid, text[], text[], text[], integer)
  to authenticated;

-- =========================================================
-- 6. Workspace phone region
-- =========================================================
--
-- The country a number written WITHOUT a `+` belongs to, when the workspace
-- knows. Nullable, and null means "unknown" rather than any particular country:
-- a product used by teams in different countries must not assume one of them.
-- With no region and no country code, the client marks the number ambiguous and
-- declines to match on it instead of guessing.
alter table public.workspaces
  add column if not exists default_phone_region text;

alter table public.workspaces
  drop constraint if exists workspaces_default_phone_region_check;
alter table public.workspaces
  add constraint workspaces_default_phone_region_check
  check (default_phone_region is null or default_phone_region ~ '^[A-Z]{2}$');

comment on column public.workspaces.default_phone_region is
  'ISO 3166-1 alpha-2 region used to interpret phone numbers written without a country code. NULL means unknown: callers must treat such numbers as ambiguous rather than assuming a country.';

create or replace function public.get_workspace_phone_region(p_workspace_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select w.default_phone_region
  from public.workspaces w
  where w.id = p_workspace_id
$$;

comment on function public.get_workspace_phone_region(uuid) is
  'The workspace''s default phone region, or NULL when it has none. SECURITY INVOKER; RLS on public.workspaces is the boundary.';

revoke all on function public.get_workspace_phone_region(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_workspace_phone_region(uuid) to authenticated;

-- Owners and admins only: the region silently changes how every unqualified
-- number in the workspace is interpreted, which is not a per-member preference.
create or replace function public.set_workspace_phone_region(
  p_workspace_id uuid,
  p_region text
)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_region text := nullif(btrim(upper(coalesce(p_region, ''))), '');
begin
  if v_region is not null and v_region !~ '^[A-Z]{2}$' then
    raise exception 'INVALID_PHONE_REGION' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner'::text, 'admin'::text])
  ) then
    raise exception 'NOT_A_WORKSPACE_ADMIN' using errcode = '42501';
  end if;

  update public.workspaces w
  set default_phone_region = v_region
  where w.id = p_workspace_id;

  return v_region;
end;
$$;

comment on function public.set_workspace_phone_region(uuid, text) is
  'Sets the workspace default phone region (ISO alpha-2, or NULL to clear). Owners and admins only.';

revoke all on function public.set_workspace_phone_region(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_workspace_phone_region(uuid, text) to authenticated;

commit;
