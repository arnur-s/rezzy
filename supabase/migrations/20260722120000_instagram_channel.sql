-- Instagram Direct messaging channel.
--
-- Adds a public, non-secret provider account identifier for webhook routing and
-- duplicate detection, makes contact_channels channel-scoped (a workspace may
-- connect multiple Instagram accounts, and the same Instagram user can message
-- more than one connected account), stores one-time OAuth CSRF state, and adds
-- the service-role RPCs the Instagram Edge Functions rely on.
--
-- Design notes:
--   * provider_account_id is globally unique per (type, provider_account_id):
--     Meta webhooks carry no workspace id, so entry.id -> channels must resolve
--     to at most one channel. An Instagram account maps to one workspace channel.
--   * Cross-workspace / channel-type integrity on contact_channels is enforced
--     with composite foreign keys, because Edge Functions use the service role,
--     which bypasses RLS. Table constraints -- not policies -- are the real guard.

-- 1. channels: public provider account identifier -----------------------------

alter table public.channels
  add column if not exists provider_account_id text;

-- Global (not workspace-scoped) uniqueness: inbound webhooks route entry.id ->
-- provider_account_id with no workspace context, so it must be unambiguous.
create unique index if not exists uq_channels_provider_account
  on public.channels (type, provider_account_id)
  where provider_account_id is not null;

-- 2. Composite-FK target ------------------------------------------------------

alter table public.channels
  add constraint channels_id_workspace_type_key unique (id, workspace_id, type);

-- 3. contact_channels: channel scoping ---------------------------------------

alter table public.contact_channels
  add column if not exists channel_id uuid;

-- Backfill pass 1: unambiguous conversation linkage. A contact_channel gets its
-- channel when exactly one channel of the matching type is linked to that
-- contact through conversations.
with linkage as (
  select cc.id as contact_channel_id,
         (array_agg(distinct conv.channel_id))[1] as channel_id,
         count(distinct conv.channel_id) as channel_count
  from public.contact_channels cc
  join public.conversations conv on conv.contact_id = cc.contact_id
  join public.channels ch
    on ch.id = conv.channel_id
   and ch.type = cc.channel_type
   and ch.workspace_id = cc.workspace_id
  where cc.channel_id is null
  group by cc.id
)
update public.contact_channels cc
set channel_id = linkage.channel_id
from linkage
where cc.id = linkage.contact_channel_id
  and linkage.channel_count = 1;

-- Backfill pass 2: single-channel-of-type fallback for rows still unscoped.
with singletons as (
  select ch.workspace_id, ch.type,
         (array_agg(ch.id))[1] as channel_id,
         count(*) as channel_count
  from public.channels ch
  group by ch.workspace_id, ch.type
)
update public.contact_channels cc
set channel_id = s.channel_id
from singletons s
where cc.channel_id is null
  and s.workspace_id = cc.workspace_id
  and s.type = cc.channel_type
  and s.channel_count = 1;

do $$
declare
  remaining int;
begin
  select count(*) into remaining
  from public.contact_channels where channel_id is null;
  if remaining > 0 then
    raise notice
      'contact_channels: % row(s) left with channel_id = NULL (ambiguous legacy; protected by uq_contact_channels_legacy_null)',
      remaining;
  end if;
end $$;

-- The composite FKs below fail loudly if any row's workspace_id disagrees with
-- its parent contact; surface that explicitly rather than as an opaque error.
do $$
declare
  bad int;
begin
  select count(*) into bad
  from public.contact_channels cc
  join public.contacts c on c.id = cc.contact_id
  where c.workspace_id <> cc.workspace_id;
  if bad > 0 then
    raise exception
      'contact_channels has % row(s) whose workspace_id disagrees with the parent contact; resolve before migrating',
      bad;
  end if;
end $$;

-- Channel-side composite FK -- enforced even under the service role, which
-- bypasses RLS, so channel_id can never point at a channel in another workspace
-- or of a different type. A NULL channel_id makes it inapplicable (MATCH
-- SIMPLE), so legacy rows that could not be backfilled are left intact.
--
-- The contact side (contact_channels.workspace_id = contacts.workspace_id) is
-- enforced by the trigger below rather than a second composite FK: a second
-- contacts<->contact_channels relationship would make PostgREST resource
-- embedding ambiguous (contacts!inner(...), contact_channels(...)).
alter table public.contact_channels
  add constraint contact_channels_channel_ws_type_fk
    foreign key (channel_id, workspace_id, channel_type)
    references public.channels (id, workspace_id, type) on delete cascade;

-- New rows must be channel-scoped; NOT VALID leaves the frozen legacy NULL rows
-- untouched while enforcing the rule for every insert/update from now on.
alter table public.contact_channels
  add constraint contact_channels_channel_id_required
  check (channel_id is not null) not valid;

-- Channel-scoped identity. A plain unique constraint (not a partial index) so
-- ON CONFLICT (channel_id, external_id) infers it reliably; SQL uniqueness
-- already permits the multiple NULLs legacy rows may still hold.
alter table public.contact_channels
  add constraint uq_contact_channels_channel_external
  unique (channel_id, external_id);

-- Preserve de-dup among any remaining legacy NULL-channel rows.
create unique index if not exists uq_contact_channels_legacy_null
  on public.contact_channels (workspace_id, channel_type, external_id)
  where channel_id is null;

create index if not exists idx_contact_channels_channel
  on public.contact_channels (channel_id);

drop index if exists public.uq_contact_channels_type_external;

-- Contact-side workspace integrity (see note on the composite FK above). Runs
-- for every writer, including service-role Edge Functions that bypass RLS.
create or replace function public.ensure_contact_channel_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.contacts c
    where c.id = new.contact_id
      and c.workspace_id = new.workspace_id
  ) then
    raise exception 'contact_channels.workspace_id must match the contact''s workspace'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.ensure_contact_channel_workspace()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_ensure_contact_channel_workspace
  on public.contact_channels;
create trigger trg_ensure_contact_channel_workspace
before insert or update on public.contact_channels
for each row execute function public.ensure_contact_channel_workspace();

-- 4. contact_channels RLS: also require the target channel to be in-workspace --
-- Defense-in-depth atop the composite FKs, for authenticated writes.

drop policy if exists "Workspace members can create contact channels" on public.contact_channels;
create policy "Workspace members can create contact channels"
  on public.contact_channels
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.contacts c
      where c.id = contact_channels.contact_id
        and public.is_workspace_member(c.workspace_id)
    )
    and (
      channel_id is null
      or exists (
        select 1 from public.channels ch
        where ch.id = contact_channels.channel_id
          and public.is_workspace_member(ch.workspace_id)
      )
    )
  );

drop policy if exists "Workspace members can update contact channels" on public.contact_channels;
create policy "Workspace members can update contact channels"
  on public.contact_channels
  for update
  to authenticated
  using (
    exists (
      select 1 from public.contacts c
      where c.id = contact_channels.contact_id
        and public.is_workspace_member(c.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.contacts c
      where c.id = contact_channels.contact_id
        and public.is_workspace_member(c.workspace_id)
    )
    and (
      channel_id is null
      or exists (
        select 1 from public.channels ch
        where ch.id = contact_channels.channel_id
          and public.is_workspace_member(ch.workspace_id)
      )
    )
  );

-- 5. One-time OAuth CSRF state ------------------------------------------------

create table if not exists private.oauth_states (
  state text primary key,
  provider text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table private.oauth_states enable row level security;

create index if not exists idx_oauth_states_cleanup
  on private.oauth_states (provider, user_id, expires_at);

-- Issues a cryptographically random, single-use state bound to the caller's
-- workspace and (optional) reconnect target. Granted to authenticated.
create or replace function public.begin_instagram_oauth(
  p_workspace_id uuid,
  p_channel_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a member of workspace' using errcode = '42501';
  end if;

  if p_channel_id is not null then
    if not exists (
      select 1 from public.channels
      where id = p_channel_id
        and workspace_id = p_workspace_id
        and type = 'instagram'
    ) then
      raise exception 'not an Instagram channel in this workspace'
        using errcode = '42501';
    end if;
  end if;

  delete from private.oauth_states
  where user_id = auth.uid() and expires_at < now();

  v_state := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  insert into private.oauth_states
    (state, provider, workspace_id, user_id, channel_id, expires_at)
  values
    (v_state, 'instagram', p_workspace_id, auth.uid(), p_channel_id,
     now() + interval '10 minutes');

  return v_state;
end;
$$;

-- Atomically consumes a state (single-use). Service role only.
create or replace function public.consume_oauth_state(
  p_state text,
  p_provider text
)
returns table(workspace_id uuid, user_id uuid, channel_id uuid)
language sql
security definer
set search_path = ''
as $$
  delete from private.oauth_states
  where state = p_state
    and provider = p_provider
    and expires_at > now()
  returning workspace_id, user_id, channel_id;
$$;

-- 6. Service-role ingestion / finalization RPCs -------------------------------

-- Race-safe resolve-or-create of contact + contact_channel + conversation for
-- an inbound Instagram message. Derives workspace from the channel. Reopens the
-- conversation. Returns the resolved ids. Service role only.
create or replace function public.resolve_instagram_conversation(
  p_channel_id uuid,
  p_external_id text,
  p_external_name text default null,
  p_name text default null,
  p_avatar_url text default null
)
returns table(contact_id uuid, contact_channel_id uuid, conversation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
-- The OUT column names (contact_id, conversation_id) collide with table columns
-- referenced in ON CONFLICT targets; prefer the column in ambiguous cases.
#variable_conflict use_column
declare
  v_workspace_id uuid;
  v_contact_id uuid;
  v_contact_channel_id uuid;
  v_conversation_id uuid;
begin
  select c.workspace_id into v_workspace_id
  from public.channels c
  where c.id = p_channel_id and c.type = 'instagram';

  if v_workspace_id is null then
    raise exception 'unknown Instagram channel %', p_channel_id;
  end if;

  select cc.id, cc.contact_id
    into v_contact_channel_id, v_contact_id
  from public.contact_channels cc
  where cc.channel_id = p_channel_id and cc.external_id = p_external_id;

  if v_contact_channel_id is null then
    insert into public.contacts (workspace_id, name, avatar_url, source, status)
    values (v_workspace_id, p_name, p_avatar_url, 'instagram', 'new')
    returning id into v_contact_id;

    insert into public.contact_channels
      (contact_id, workspace_id, channel_id, channel_type, external_id, external_name)
    values
      (v_contact_id, v_workspace_id, p_channel_id, 'instagram', p_external_id, p_external_name)
    on conflict (channel_id, external_id) do nothing
    returning id into v_contact_channel_id;

    if v_contact_channel_id is null then
      -- Lost the race: drop our orphan contact and adopt the winner.
      delete from public.contacts where id = v_contact_id;
      select cc.id, cc.contact_id
        into v_contact_channel_id, v_contact_id
      from public.contact_channels cc
      where cc.channel_id = p_channel_id and cc.external_id = p_external_id;
    end if;
  else
    update public.contact_channels
    set external_name = coalesce(p_external_name, external_name)
    where id = v_contact_channel_id;
  end if;

  insert into public.conversations as conv
    (workspace_id, contact_id, channel_id, status)
  values
    (v_workspace_id, v_contact_id, p_channel_id, 'open')
  on conflict (contact_id, channel_id) do update
    set status = 'open'
    where conv.status <> 'open'
  returning conv.id into v_conversation_id;

  if v_conversation_id is null then
    select conv.id into v_conversation_id
    from public.conversations conv
    where conv.contact_id = v_contact_id and conv.channel_id = p_channel_id;
  end if;

  return query select v_contact_id, v_contact_channel_id, v_conversation_id;
end;
$$;

-- Atomic reconnect finalization: rotate credentials and reactivate the channel
-- in one transaction so the two never diverge. Service role only.
create or replace function public.finalize_instagram_channel_connection(
  p_channel_id uuid,
  p_provider_account_id text,
  p_name text,
  p_credentials jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.channels
  set provider_account_id = p_provider_account_id,
      name = coalesce(p_name, name),
      is_active = true
  where id = p_channel_id and type = 'instagram';

  if not found then
    raise exception 'not an Instagram channel %', p_channel_id;
  end if;

  insert into private.channel_secrets (channel_id, credentials)
  values (p_channel_id, p_credentials)
  on conflict (channel_id) do update set credentials = excluded.credentials;
end;
$$;

-- Advances an outbound message to 'read' from a messaging_seen event, scoped to
-- the routed channel + workspace (service role bypasses RLS). Service role only.
create or replace function public.mark_outbound_message_read(
  p_channel_id uuid,
  p_workspace_id uuid,
  p_external_id text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.messages m
  set status = 'read'
  from public.conversations c
  where m.conversation_id = c.id
    and c.channel_id = p_channel_id
    and m.workspace_id = p_workspace_id
    and m.external_id = p_external_id
    and m.direction = 'outbound'
    and m.status in ('sent', 'delivered');
$$;

-- 7. Grants (revoke from PUBLIC first; Postgres grants EXECUTE to PUBLIC by
-- default, and default privileges only cover functions created after the harden
-- migration) -----------------------------------------------------------------

revoke all on function public.begin_instagram_oauth(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.begin_instagram_oauth(uuid, uuid) to authenticated;

revoke all on function public.consume_oauth_state(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.consume_oauth_state(text, text) to service_role;

revoke all on function public.resolve_instagram_conversation(uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.resolve_instagram_conversation(uuid, text, text, text, text)
  to service_role;

revoke all on function public.finalize_instagram_channel_connection(uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_instagram_channel_connection(uuid, text, text, jsonb)
  to service_role;

revoke all on function public.mark_outbound_message_read(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.mark_outbound_message_read(uuid, uuid, text)
  to service_role;
