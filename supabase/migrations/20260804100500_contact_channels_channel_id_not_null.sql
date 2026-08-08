begin;

-- 20260722120000 added contact_channels.channel_id, backfilled what it could,
-- and left two temporary props behind: contact_channels_channel_id_required as
-- NOT VALID, so rows it could not attribute survived the migration, and
-- uq_contact_channels_legacy_null to keep those rows de-duplicated. While the
-- constraint stays NOT VALID the column is only guarded going forward, and the
-- composite FK to channels is inapplicable (MATCH SIMPLE) on exactly the rows
-- that are unscoped -- so a legacy row is precisely the row with no workspace
-- guarantee at all.
--
-- The linked project and a fresh local database both have zero rows with
-- channel_id IS NULL, so the props come out and the column takes its real shape.
--
-- The backfill below repeats the two passes 20260722120000 ran, because a
-- workspace that had no channel of the matching type then may have connected one
-- since. Anything still unattributed afterwards stops the migration instead of
-- being guessed at or deleted: choosing a channel for one of those rows would
-- move a contact's external identity into whichever workspace the guess landed
-- in, which is the exact failure this change exists to prevent.

-- Pass 1: unambiguous conversation linkage -- exactly one channel of the
-- matching type is linked to that contact through conversations.
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

-- Pass 2: the workspace has exactly one channel of that type, so there is
-- nothing to choose between.
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
  from public.contact_channels
  where channel_id is null;

  if remaining > 0 then
    raise exception
      'contact_channels still has % row(s) with channel_id = NULL that neither backfill pass could attribute; resolve them by hand before applying this migration',
      remaining;
  end if;
end $$;

alter table public.contact_channels
  validate constraint contact_channels_channel_id_required;

alter table public.contact_channels
  alter column channel_id set not null;

-- Its predicate (channel_id is null) can never match again.
drop index if exists public.uq_contact_channels_legacy_null;

-- contact_channels_channel_id_required is now implied by the NOT NULL and is
-- kept rather than dropped: it is the constraint 20260722120000 named as the
-- forward guard, and a validated check costs nothing to leave in place.

commit;
