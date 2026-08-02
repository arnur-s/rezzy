-- Repairs public.set_contact_phones, which 20260803120000 created in a form that
-- fails on every call with:
--
--   42702  column reference "digits" is ambiguous
--
-- Why it was not caught by the migration
-- --------------------------------------
-- CREATE FUNCTION does not compile a plpgsql body, so the statement succeeded and
-- the defect only appears when the function is first executed.
--
-- The cause
-- ---------
-- The columns of a RETURNS TABLE list become plpgsql variables, so this function
-- has variables named id, phone, digits and position. Inside the body,
--
--   insert into public.contact_phones (...)
--   on conflict (contact_id, digits) do update ...
--
-- has an ON CONFLICT inference list that plpgsql runs through variable
-- substitution, and `digits` matches both the variable and the column. Every
-- other reference in the function is table-qualified, which is why this is the
-- only one that breaks — and qualifying is not available here, because an
-- ON CONFLICT inference list takes bare column names.
--
-- The fix
-- -------
-- `#variable_conflict use_column` resolves such a collision to the column. It is
-- safe to apply to the whole body: every value the function actually reads is
-- named p_* or v_*, so nothing here needs the variable to win. The alternative,
-- renaming the RETURNS TABLE columns, would change the field names the client
-- parses in src/features/contacts/api/contact-phones.ts.
--
-- The body is otherwise identical to 20260803120000.

begin;

create or replace function public.set_contact_phones(
  p_workspace_id uuid,
  p_contact_id uuid,
  p_phones text[]
)
returns table (id uuid, phone text, digits text, "position" integer)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
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

commit;
