-- Canonical reaction identity.
--
-- A reaction is identified by its emoji: (channel, provider message, reactor,
-- emoji) is unique. Providers disagree on how to spell one emoji — WhatsApp
-- sends U+2764 U+FE0F where Telegram sends a bare U+2764 — so the same visible
-- reaction could occupy two rows, count twice under a bubble, and survive a
-- removal callback that only matched one of the spellings.
--
-- The webhook pipeline now canonicalizes before it writes
-- (supabase/functions/_shared/reaction-emoji.ts), which fixes new traffic but
-- not rows already stored in provider form, and application code cannot be the
-- guarantee for a table other writers can reach. This migration canonicalizes
-- the history and moves the invariant into the database.
--
-- Canonical form is NFC with the U+FE0E/U+FE0F presentation selectors removed.
-- Skin-tone modifiers, zero-width joiner sequences, and opaque provider
-- identifiers such as `custom:<id>` are preserved: stripping any of those would
-- merge reactions that are genuinely different.

begin;

-- chr() rather than a literal: the characters this function removes are
-- invisible, and an invisible character in a migration is unreviewable.
create or replace function public.normalize_reaction_emoji(emoji text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select btrim(
    translate(normalize(emoji, nfc), chr(65038) || chr(65039), '')
  )
$$;

comment on function public.normalize_reaction_emoji(text) is
  'Canonical reaction identity: NFC without the U+FE0E/U+FE0F presentation selectors. Mirrors src/lib/reaction-emoji.ts and supabase/functions/_shared/reaction-emoji.ts.';

revoke all on function public.normalize_reaction_emoji(text)
from public, anon, authenticated;

-- The webhook pipeline writes as service_role, and the normalizing trigger
-- below calls this function as the writing role.
grant execute on function public.normalize_reaction_emoji(text) to service_role;

-- ── Collapse identities that normalization merges ────────────────────────────
-- Rows that differ only by presentation selector are one reaction. Keep the
-- most recently known state, which is the same rule the pipeline's
-- out-of-order guard applies (provider_timestamp first, clock time after), and
-- drop the rest so the unique key below can hold.
with canonical as (
  select
    id,
    row_number() over (
      partition by
        channel_id,
        provider_message_id,
        reactor_external_id,
        public.normalize_reaction_emoji(emoji)
      order by
        provider_timestamp desc nulls last,
        updated_at desc,
        created_at desc,
        id desc
    ) as duplicate_rank
  from public.message_reactions
)
delete from public.message_reactions target
using canonical
where target.id = canonical.id
  and canonical.duplicate_rank > 1;

update public.message_reactions
set emoji = public.normalize_reaction_emoji(emoji)
where emoji is distinct from public.normalize_reaction_emoji(emoji);

-- ── Keep it canonical ────────────────────────────────────────────────────────
-- A normalizing trigger rather than a check constraint: a writer that skips the
-- shared helpers should be corrected, not rejected. Where correcting the value
-- collides with an existing reaction the write raises 23505, which every caller
-- already treats as successful deduplication.
create or replace function public.normalize_message_reaction_emoji()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.emoji := public.normalize_reaction_emoji(new.emoji);
  return new;
end;
$$;

revoke all on function public.normalize_message_reaction_emoji()
from public, anon, authenticated, service_role;

drop trigger if exists message_reactions_normalize_emoji
on public.message_reactions;

create trigger message_reactions_normalize_emoji
  before insert or update on public.message_reactions
  for each row
  execute function public.normalize_message_reaction_emoji();

comment on column public.message_reactions.emoji is
  'Canonical reaction identity: emoji in NFC without presentation selectors, or a provider identifier such as custom:<id>. Normalized on write by message_reactions_normalize_emoji.';

commit;
