-- Structured message reactions. Reactions are not chat-bubble messages: one
-- current-state row per (channel, provider message, reactor, emoji) with an
-- added/removed action. Removed rows are kept for idempotency and audit.
--
-- message_id/conversation_id are nullable so reactions arriving before their
-- message (out-of-order delivery) are stored keyed by provider_message_id and
-- backfilled after the message insert.

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  provider_message_id text not null,
  reactor_external_id text not null,
  is_from_contact boolean not null default true,
  emoji text not null,
  action text not null
    constraint message_reactions_action_check
    check (action in ('added', 'removed')),
  provider_timestamp timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.message_reactions is
  'Current-state reactions per (channel, provider message, reactor, emoji). Rows flip between added/removed; provider_timestamp guards out-of-order callbacks.';
comment on column public.message_reactions.provider_message_id is 'Provider id of the reacted-to message; used to backfill message_id when the message arrives late.';
comment on column public.message_reactions.reactor_external_id is 'Provider identity of the reacting user (Telegram user id, wa_id, IGSID) or the channel account for outbound-side reactions.';
comment on column public.message_reactions.is_from_contact is 'True when the reactor is the customer; false when it is the connected business account.';
comment on column public.message_reactions.emoji is 'Reaction emoji or provider reaction identifier.';
comment on column public.message_reactions.action is 'Latest known state: added or removed.';

alter table public.message_reactions
  add constraint message_reactions_identity_key
  unique (channel_id, provider_message_id, reactor_external_id, emoji);

create index message_reactions_message_idx
  on public.message_reactions (message_id)
  where message_id is not null;

-- Backfill lookups: reactions stored before their message arrived.
create index message_reactions_pending_idx
  on public.message_reactions (channel_id, provider_message_id)
  where message_id is null;

create index message_reactions_conversation_idx
  on public.message_reactions (conversation_id)
  where conversation_id is not null;

create trigger message_reactions_updated_at
  before update on public.message_reactions
  for each row
  execute function public.handle_updated_at();

alter table public.message_reactions enable row level security;

revoke all on public.message_reactions from anon, authenticated;
grant select on public.message_reactions to authenticated;
grant select, insert, update, delete on public.message_reactions to service_role;

create policy "Workspace members can view message reactions"
  on public.message_reactions
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

alter publication supabase_realtime add table public.message_reactions;
