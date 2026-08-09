begin;

-- A WhatsApp identity IS a phone number, so a WhatsApp contact must never show
-- an empty phone field.
--
-- What went wrong
-- ---------------
-- `contact_channels.external_id` for a WhatsApp identity is the subscriber's
-- wa_id: their number in international form, without the leading `+`. The
-- client already treats it as both things at once -- src/entities/message/lib/
-- shared-contact.ts turns a card's wa_id into `+<wa_id>` AND into a channel
-- identity -- but `public.contacts.phone` was left null for every contact
-- created before supabase/functions/_shared/persist.ts started backfilling it
-- (2026-07-23).
--
-- The visible symptom: a shared contact card in the inbox prints the number,
-- finds the person in the CRM by their WhatsApp identity, and its "Open contact"
-- lands on a detail page whose phone row is missing entirely -- the same number,
-- one click apart, present on one screen and absent on the next. The directory,
-- the inbox contact panel and phone-based matching all read that same column, so
-- they were blank for those contacts too.
--
-- The webhook's own backfill closed this for new contacts only, and only when
-- the person messages again. Two halves are needed: the rows that already exist,
-- and every identity written from here on by whatever writes it.

-- =========================================================
-- 1. phone_from_wa_id
-- =========================================================
--
-- The single statement of the rule, so the backfill below and the trigger below
-- that cannot disagree about it.
--
-- Returns null -- rather than a `+` glued onto whatever arrived -- for anything
-- that is not a plain digit string. A Telegram user id or an Instagram-scoped id
-- is NOT a phone number, and neither is a malformed wa_id; the column stays
-- empty rather than gaining a number nobody can dial.
--
-- The 31-digit ceiling keeps `+` || digits inside the 32 characters
-- public.contact_phones allows, so a number promoted from an identity can always
-- be carried by the multi-number table later. The 5-digit floor is the same one
-- public.contact_phones enforces: shorter than that is a fragment, not a number.
create or replace function public.phone_from_wa_id(p_external_id text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select case
    when btrim(p_external_id) ~ '^[0-9]{5,31}$' then '+' || btrim(p_external_id)
  end
$$;

comment on function public.phone_from_wa_id(text) is
  'The dialable number behind a WhatsApp wa_id (+ prefixed), or null when the identity is not a plain digit string. Null is the answer for every non-WhatsApp identity: a Telegram or Instagram id is not a phone number.';

revoke all on function public.phone_from_wa_id(text) from public, anon;
grant execute on function public.phone_from_wa_id(text) to authenticated, service_role;

-- =========================================================
-- 2. The rows that already exist
-- =========================================================
--
-- Only contacts whose phone is null are touched: a number somebody typed, or a
-- primary set through public.set_contact_phones, is never overwritten by a
-- derived one.
--
-- DISTINCT ON because one contact can hold several WhatsApp identities (one per
-- channel). The oldest wins, deterministically, rather than whichever row the
-- planner happened to reach first.
--
-- public.contact_phones is deliberately NOT written here. That table has one
-- writer -- public.set_contact_phones -- and a contact whose only number came
-- from the webhook already looks exactly like this: the column set, the table
-- empty. Both the detail page and public.match_workspace_contacts read the
-- column as well as the table, so nothing needs the duplicate.
update public.contacts c
set phone = derived.phone
from (
  select distinct on (cc.contact_id)
    cc.contact_id,
    cc.workspace_id,
    public.phone_from_wa_id(cc.external_id) as phone
  from public.contact_channels cc
  where cc.channel_type = 'whatsapp'
    and public.phone_from_wa_id(cc.external_id) is not null
  order by cc.contact_id, cc.created_at, cc.id
) as derived
where c.id = derived.contact_id
  and c.workspace_id = derived.workspace_id
  and c.phone is null;

-- =========================================================
-- 3. Every identity written from here on
-- =========================================================
--
-- A trigger rather than another line in the WhatsApp webhook, for the reason
-- trg_cascade_contact_archive is one: the invariant should hold whoever writes
-- the identity -- that webhook, a future one, a support fix applied by hand --
-- and not only on the one code path that remembered.
--
-- Definer rights, like the cascade, so that filling the number does not depend
-- on the writer's own permissions on public.contacts. Today every writer that
-- can create a WhatsApp identity can also update the contact behind it -- the
-- contact_channels policies resolve the contact through its SELECT policy, so an
-- archived contact's identity rows are unreachable for a member, and the webhook
-- runs as service_role -- and the point is not to make the invariant contingent
-- on that staying true. The write is pinned to the contact named by the row the
-- trigger was handed, touches one column, only when it is null, with a value
-- derived from that same row, and the search path is empty: a caller who can
-- write the identity already controls everything this can change.
create or replace function public.set_contact_phone_from_whatsapp_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
begin
  if new.channel_type <> 'whatsapp' then
    return null;
  end if;

  v_phone := public.phone_from_wa_id(new.external_id);
  if v_phone is null then
    return null;
  end if;

  -- `phone is null` is the whole guard, and it is what makes this safe to run on
  -- every identity write: a contact whose number was edited, or deliberately
  -- cleared, keeps whatever the human left there. Only emptiness is filled.
  update public.contacts c
  set phone = v_phone
  where c.id = new.contact_id
    and c.workspace_id = new.workspace_id
    and c.phone is null;

  return null;
end;
$$;

comment on function public.set_contact_phone_from_whatsapp_identity() is
  'Fills public.contacts.phone from a WhatsApp wa_id when the contact has no number yet. Never overwrites an existing one, and ignores identities that are not plain digit strings. SECURITY DEFINER so an archived contact, hidden from the caller by the contacts UPDATE policy, is filled in too.';

-- AFTER, because nothing about the identity row itself changes; and restricted
-- to the three columns the number is derived from, so the webhook's
-- external_name/profile refresh on every inbound message does not re-run it.
drop trigger if exists trg_set_contact_phone_from_whatsapp_identity
  on public.contact_channels;
create trigger trg_set_contact_phone_from_whatsapp_identity
  after insert or update of contact_id, channel_type, external_id
  on public.contact_channels
  for each row
  execute function public.set_contact_phone_from_whatsapp_identity();

commit;
