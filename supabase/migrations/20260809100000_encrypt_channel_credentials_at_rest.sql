begin;

-- Encrypt channel credentials at rest.
--
-- private.channel_secrets.credentials was plaintext jsonb: a WhatsApp
-- access_token, an Instagram access_token, a Telegram bot_token and its webhook
-- secret, sitting in the clear in every base backup, every `supabase db dump`,
-- every read replica and every PITR archive. The table's RLS and its grants
-- describe who may read it *through the running database*; none of them reach a
-- file on disk. Anyone who obtains a dump obtains live provider credentials for
-- every connected workspace, and rotating them means reconnecting every channel
-- by hand.
--
-- supabase_vault (0.3.1, schema `vault`) was already installed and imported
-- nowhere. It stores each secret as authenticated ciphertext in vault.secrets
-- and decrypts on read through vault.decrypted_secrets. The root key is not in
-- the database: `vault.getkey_script` points Postgres at an external script
-- (and supabase/config.toml carries the commented `[db.vault] secret_key`
-- knob), so a dump of the SQL schema is ciphertext with no key beside it. That
-- is precisely the gap above, so Vault it is rather than a pgcrypto column and
-- a key we would then have to keep somewhere ourselves.
--
-- Shape of the change:
--
--   private.channel_secrets   loses `credentials`, gains `secret_id` (the
--                             vault.secrets row) and `whatsapp_phone_number_id`
--                             (see "The index" below).
--   the four RPCs             keep their names and their service_role-only
--                             grants, and stay the only access path. Callers
--                             pass and receive the same jsonb they always did.
--   private.set_channel_credentials
--                             is the single writer; both write RPCs go through
--                             it so the create/rotate logic exists once.
--
--
-- ── The index ────────────────────────────────────────────────────────────────
--
-- get_whatsapp_channel_by_phone routes every inbound WhatsApp webhook by
-- credentials->>'phone_number_id', over an expression index (20260519120000)
-- and a partial unique index on the same expression (20260804100400). Neither
-- can survive encryption: an expression index cannot see inside a ciphertext.
--
-- A Meta phone number id is not a secret -- it is published in the webhook
-- payload that arrives at our own endpoint -- so it moves to a plain column and
-- the two indexes collapse into one plain UNIQUE constraint. 20260804100400
-- needed a partial unique index plus a separate plain index because the planner
-- could not prove the parameter of `credentials->>'phone_number_id' = $1` was
-- non-empty and so could not use the partial index for the lookup. A NOT NULL
-- normalisation on write (`nullif(btrim(...), '')`) plus a `<> ''` check makes
-- the empty string unrepresentable, which makes the uniqueness total, which
-- makes one ordinary UNIQUE index both the constraint and the read path.
-- Uniqueness stays deliberately un-scoped to type = 'whatsapp', for the reason
-- 20260804100400 gives: the value is globally issued by Meta, and two channels
-- of any type holding it would make the lookup ambiguous.
--
--
-- ── The workspace assertion ──────────────────────────────────────────────────
--
-- All four RPCs took a bare channel_id and asserted nothing about it. They are
-- granted to service_role alone, which is a grant, not a guarantee: a bug in
-- any Edge Function that lets an attacker choose the channel_id turns into
-- "read workspace B's access token", and 20260809090000 documented exactly that
-- chain, deferring the RPC-side question to this change.
--
-- Decision: every RPC that can be asked about a specific workspace now takes
-- `p_workspace_id` and refuses when the channel is not in it. The parameter
-- defaults to NULL, and NULL skips the check. Two reasons it is optional rather
-- than required:
--
--   * Three callers have no independent workspace to assert against.
--     whatsapp-webhook, telegram-webhook and instagram-webhook resolve the
--     channel from a provider identity and *derive* the workspace from that
--     channel. Passing it back in would compare the value to itself.
--   * Migrations and Edge Functions deploy separately here (`supabase db push`
--     vs `pnpm deploy-functions:supabase`). A required argument would make the
--     window between the two an outage on every connect flow.
--
-- So this is defence in depth, not the boundary: the boundary is still the
-- service_role-only grant. Every caller that holds a workspace independently of
-- the channel now passes it -- the four send-* functions and the three
-- connect-channel functions.
--
-- Not changed, deliberately: service_role keeps Supabase's default SELECT on
-- vault.decrypted_secrets. Revoking it would not narrow anything -- the same
-- role is granted get_channel_credentials and can read any channel's
-- credentials through it by design -- and it is a platform default this
-- migration would only fight with. The threat this change addresses is the
-- data at rest, not the trusted server identity.

-- ── 1. New storage columns ───────────────────────────────────────────────────

alter table private.channel_secrets
  add column if not exists secret_id uuid,
  add column if not exists whatsapp_phone_number_id text;

-- ── 2. Backfill ──────────────────────────────────────────────────────────────
--
-- One vault secret per channel, named for the channel so an operator reading
-- vault.secrets can tell what a row is without decrypting it. Row by row
-- because vault.create_secret is a function per secret, and because the volume
-- is one row per connected channel -- 5 on the linked project when this was
-- written.

do $$
declare
  v_row record;
  v_secret_id uuid;
begin
  for v_row in
    select cs.channel_id, cs.credentials
    from private.channel_secrets cs
    where cs.secret_id is null
    order by cs.channel_id
  loop
    v_secret_id := vault.create_secret(
      v_row.credentials::text,
      'channel_credentials:' || v_row.channel_id::text,
      'Provider credentials for public.channels ' || v_row.channel_id::text
    );

    update private.channel_secrets cs
    set secret_id = v_secret_id,
        whatsapp_phone_number_id =
          nullif(btrim(coalesce(v_row.credentials->>'phone_number_id', '')), '')
    where cs.channel_id = v_row.channel_id;
  end loop;
end $$;

-- ── 3. Drop the plaintext ────────────────────────────────────────────────────
--
-- Both indexes are over an expression on the column being dropped, so DROP
-- COLUMN would take them anyway; naming them is the record that they are gone
-- on purpose and replaced by the constraint below.

drop index if exists private.idx_channel_secrets_wa_phone;
drop index if exists private.uq_channel_secrets_wa_phone;

alter table private.channel_secrets
  drop column credentials;

alter table private.channel_secrets
  alter column secret_id set not null;

alter table private.channel_secrets
  add constraint channel_secrets_secret_id_key unique (secret_id);

alter table private.channel_secrets
  add constraint channel_secrets_wa_phone_not_empty
  check (whatsapp_phone_number_id <> '');

alter table private.channel_secrets
  add constraint channel_secrets_wa_phone_key unique (whatsapp_phone_number_id);

comment on table private.channel_secrets is
  'One row per connected channel. Holds no credential material: secret_id points at the vault.secrets row that does, and whatsapp_phone_number_id is the (non-secret, Meta-issued) inbound routing key that could not stay inside an encrypted blob. Reachable only through the public.*_channel_credentials RPCs.';

comment on column private.channel_secrets.secret_id is
  'vault.secrets row holding this channel''s credentials as a JSON object. Deleted with the channel by trg_forget_channel_secret.';

comment on column private.channel_secrets.whatsapp_phone_number_id is
  'Meta phone number id, extracted from the credentials so get_whatsapp_channel_by_phone can index it. Not secret: it arrives in the plaintext of every inbound WhatsApp webhook.';

-- ── 4. A deleted channel must not leave a live token behind ──────────────────
--
-- channel_secrets.channel_id cascades from public.channels, so disconnecting a
-- channel removes the row -- but the vault.secrets row it pointed at is not
-- reachable by that cascade and would survive, holding a working provider
-- token, indefinitely and invisibly. AFTER DELETE FOR EACH ROW fires on the
-- cascade as well as on a direct delete.

create or replace function private.forget_channel_secret()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets where id = old.secret_id;
  return null;
end;
$$;

revoke all on function private.forget_channel_secret()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_forget_channel_secret on private.channel_secrets;
create trigger trg_forget_channel_secret
after delete on private.channel_secrets
for each row execute function private.forget_channel_secret();

-- ── 5. The single writer ─────────────────────────────────────────────────────
--
-- The advisory lock is what makes this an upsert rather than a race. Two
-- concurrent connects for one channel that both found no row would each mint a
-- vault secret, and whichever lost the insert would leave its secret orphaned
-- and undeletable -- nothing would point at it. Serialising on the channel id
-- for the length of the transaction costs nothing on a path that runs once per
-- channel connection.

create or replace function private.set_channel_credentials(
  p_channel_id uuid,
  p_credentials jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
  v_phone_number_id text;
begin
  if p_credentials is null or jsonb_typeof(p_credentials) <> 'object' then
    raise exception 'channel credentials must be a JSON object'
      using errcode = '22023';
  end if;

  v_phone_number_id :=
    nullif(btrim(coalesce(p_credentials->>'phone_number_id', '')), '');

  perform pg_advisory_xact_lock(
    hashtextextended('private.channel_secrets:' || p_channel_id::text, 0)
  );

  select cs.secret_id into v_secret_id
  from private.channel_secrets cs
  where cs.channel_id = p_channel_id;

  if v_secret_id is null then
    v_secret_id := vault.create_secret(
      p_credentials::text,
      'channel_credentials:' || p_channel_id::text,
      'Provider credentials for public.channels ' || p_channel_id::text
    );

    insert into private.channel_secrets
      (channel_id, secret_id, whatsapp_phone_number_id)
    values (p_channel_id, v_secret_id, v_phone_number_id);
  else
    perform vault.update_secret(v_secret_id, p_credentials::text);

    update private.channel_secrets cs
    set whatsapp_phone_number_id = v_phone_number_id
    where cs.channel_id = p_channel_id;
  end if;
end;
$$;

comment on function private.set_channel_credentials(uuid, jsonb) is
  'Creates or rotates a channel''s vault secret and keeps the extracted WhatsApp routing key in step. The only writer of private.channel_secrets; both public write RPCs delegate here.';

revoke all on function private.set_channel_credentials(uuid, jsonb)
  from public, anon, authenticated, service_role;

-- ── 6. The RPCs ──────────────────────────────────────────────────────────────
--
-- Each is dropped and recreated rather than CREATE OR REPLACE'd: adding a
-- defaulted parameter changes the signature, and leaving the old arity in place
-- would make an unqualified call ambiguous. PostgREST resolves overloads by
-- argument name, so callers that omit p_workspace_id keep working against the
-- single remaining definition.

drop function if exists public.get_channel_credentials(uuid);

create function public.get_channel_credentials(
  p_channel_id uuid,
  p_workspace_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
begin
  if p_workspace_id is not null and not exists (
    select 1
    from public.channels c
    where c.id = p_channel_id
      and c.workspace_id = p_workspace_id
  ) then
    raise exception 'channel % is not in workspace %',
      p_channel_id, p_workspace_id
      using errcode = '42501';
  end if;

  select cs.secret_id into v_secret_id
  from private.channel_secrets cs
  where cs.channel_id = p_channel_id;

  if v_secret_id is null then
    return null;
  end if;

  return (
    select s.decrypted_secret::jsonb
    from vault.decrypted_secrets s
    where s.id = v_secret_id
  );
end;
$$;

comment on function public.get_channel_credentials(uuid, uuid) is
  'Decrypts and returns a channel''s provider credentials. Pass p_workspace_id wherever the caller knows the workspace independently of the channel; NULL skips the check, which is what the provider webhooks need because they derive the workspace from the channel.';

drop function if exists public.upsert_channel_credentials(uuid, jsonb);

create function public.upsert_channel_credentials(
  p_channel_id uuid,
  p_credentials jsonb,
  p_workspace_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_workspace_id is not null and not exists (
    select 1
    from public.channels c
    where c.id = p_channel_id
      and c.workspace_id = p_workspace_id
  ) then
    raise exception 'channel % is not in workspace %',
      p_channel_id, p_workspace_id
      using errcode = '42501';
  end if;

  perform private.set_channel_credentials(p_channel_id, p_credentials);
end;
$$;

drop function if exists
  public.finalize_instagram_channel_connection(uuid, text, text, jsonb);

create function public.finalize_instagram_channel_connection(
  p_channel_id uuid,
  p_provider_account_id text,
  p_name text,
  p_credentials jsonb,
  p_workspace_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.channels c
  set provider_account_id = p_provider_account_id,
      name = coalesce(p_name, c.name),
      is_active = true
  where c.id = p_channel_id
    and c.type = 'instagram'
    and (p_workspace_id is null or c.workspace_id = p_workspace_id);

  if not found then
    raise exception 'not an Instagram channel %', p_channel_id;
  end if;

  perform private.set_channel_credentials(p_channel_id, p_credentials);
end;
$$;

-- Reads the extracted column now. `nullif(btrim(...), '')` on the parameter
-- keeps a blank or whitespace-only phone_number_id from matching anything: the
-- column can never hold the empty string, so the comparison finds no row rather
-- than routing a malformed webhook at whichever channel sorts first.
create or replace function public.get_whatsapp_channel_by_phone(
  p_phone_number_id text
)
returns table(channel_id uuid, workspace_id uuid, is_active boolean)
language sql
security definer
set search_path = ''
as $$
  select c.id, c.workspace_id, c.is_active
  from private.channel_secrets s
  join public.channels c on c.id = s.channel_id
  where c.type = 'whatsapp'
    and s.whatsapp_phone_number_id = nullif(btrim(p_phone_number_id), '')
  limit 1
$$;

-- ── 7. Grants ────────────────────────────────────────────────────────────────
--
-- Unchanged in substance -- service_role only, on the new signatures. Postgres
-- grants EXECUTE to PUBLIC on a newly created function, so each revoke has to
-- come first.

revoke all on function public.get_channel_credentials(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_channel_credentials(uuid, uuid)
  to service_role;

revoke all on function public.upsert_channel_credentials(uuid, jsonb, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_channel_credentials(uuid, jsonb, uuid)
  to service_role;

revoke all on function
  public.finalize_instagram_channel_connection(uuid, text, text, jsonb, uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  public.finalize_instagram_channel_connection(uuid, text, text, jsonb, uuid)
  to service_role;

revoke all on function public.get_whatsapp_channel_by_phone(text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_whatsapp_channel_by_phone(text)
  to service_role;

-- The table grants date from 20260515130754, when the row held the credentials
-- themselves. It no longer holds anything worth reading directly, and no code
-- path outside the definer functions above touches it, so "the RPCs are the
-- only access path" becomes a privilege rather than a convention.
revoke all on table private.channel_secrets from service_role;

commit;
