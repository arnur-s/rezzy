-- Per-recipient message notification records. These make recipient selection
-- deterministic (resolved once, at message-creation time) and let delivery be
-- deduplicated across realtime, tabs, and push. Rows are created only by the
-- trusted server-side trigger below, never by browser clients.

create table if not exists public.message_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null
    references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint message_notifications_message_recipient_key
    unique (message_id, recipient_id)
);

create index if not exists message_notifications_recipient_created_idx
  on public.message_notifications(recipient_id, created_at desc);
create index if not exists message_notifications_recipient_read_idx
  on public.message_notifications(recipient_id, read_at);
create index if not exists message_notifications_workspace_idx
  on public.message_notifications(workspace_id);
create index if not exists message_notifications_conversation_idx
  on public.message_notifications(conversation_id);

alter table public.message_notifications enable row level security;

revoke all on public.message_notifications from anon, authenticated;
-- Recipients may read their own records and update only read_at; they may never
-- create or delete records directly.
grant select, update (read_at) on public.message_notifications to authenticated;
grant select, insert, update, delete on public.message_notifications
  to service_role;

drop policy if exists "Recipients can view own notifications"
  on public.message_notifications;
create policy "Recipients can view own notifications"
  on public.message_notifications
  for select
  to authenticated
  using (recipient_id = (select auth.uid()));

drop policy if exists "Recipients can update own notifications"
  on public.message_notifications;
create policy "Recipients can update own notifications"
  on public.message_notifications
  for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- Resolve recipients server-side on every new inbound message:
--   unassigned conversation  -> every current workspace member
--   assigned conversation    -> only the assignee (if still a member)
--   outbound message         -> nobody
-- The join to workspace_members also enforces "no notification for non-members".
-- Assignment is read at insert time, so the recipient set is frozen per message.
-- Idempotent via the unique (message_id, recipient_id) constraint.
create or replace function public.create_message_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assigned_to uuid;
begin
  if new.direction <> 'inbound' then
    return new;
  end if;

  select c.assigned_to
    into v_assigned_to
  from public.conversations c
  where c.id = new.conversation_id;

  insert into public.message_notifications (
    workspace_id,
    conversation_id,
    message_id,
    recipient_id
  )
  select
    new.workspace_id,
    new.conversation_id,
    new.id,
    wm.user_id
  from public.workspace_members wm
  where wm.workspace_id = new.workspace_id
    and (v_assigned_to is null or wm.user_id = v_assigned_to)
  on conflict (message_id, recipient_id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_message_notifications()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_create_message_notifications on public.messages;
create trigger trg_create_message_notifications
  after insert on public.messages
  for each row execute function public.create_message_notifications();

-- Expose to Supabase Realtime for user-scoped (recipient_id) client subscriptions.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_notifications'
  ) then
    alter publication supabase_realtime add table public.message_notifications;
  end if;
end $$;
