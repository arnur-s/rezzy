-- Per-user conversation read cursors for inbox scroll/read-state behavior.

create table if not exists public.conversation_reads (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_message_id uuid references public.messages(id) on delete set null,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_reads_workspace_user_idx
  on public.conversation_reads(workspace_id, user_id);

create index if not exists conversation_reads_last_read_message_id_idx
  on public.conversation_reads(last_read_message_id)
  where last_read_message_id is not null;

alter table public.conversation_reads enable row level security;

revoke all on public.conversation_reads from anon;
revoke all on public.conversation_reads from authenticated;
grant select, insert, update on public.conversation_reads to authenticated;

drop policy if exists "Workspace members can view own read cursors" on public.conversation_reads;
create policy "Workspace members can view own read cursors"
  on public.conversation_reads
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "Workspace members can create own read cursors" on public.conversation_reads;
create policy "Workspace members can create own read cursors"
  on public.conversation_reads
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_reads.conversation_id
        and c.workspace_id = conversation_reads.workspace_id
    )
    and (
      last_read_message_id is null
      or exists (
        select 1
        from public.messages m
        where m.id = conversation_reads.last_read_message_id
          and m.conversation_id = conversation_reads.conversation_id
          and m.workspace_id = conversation_reads.workspace_id
      )
    )
  );

drop policy if exists "Workspace members can update own read cursors" on public.conversation_reads;
create policy "Workspace members can update own read cursors"
  on public.conversation_reads
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_workspace_member(workspace_id)
  )
  with check (
    user_id = (select auth.uid())
    and public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_reads.conversation_id
        and c.workspace_id = conversation_reads.workspace_id
    )
    and (
      last_read_message_id is null
      or exists (
        select 1
        from public.messages m
        where m.id = conversation_reads.last_read_message_id
          and m.conversation_id = conversation_reads.conversation_id
          and m.workspace_id = conversation_reads.workspace_id
      )
    )
  );

drop policy if exists "Workspace members can delete own read cursors" on public.conversation_reads;

drop function if exists public.mark_conversation_read(uuid);
drop function if exists public.mark_conversation_read(uuid, uuid);

create or replace function public.mark_conversation_read(
  p_conversation_id uuid,
  p_last_read_message_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_workspace_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select c.workspace_id
    into target_workspace_id
  from public.conversations c
  where c.id = p_conversation_id;

  if target_workspace_id is null then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;

  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_last_read_message_id is not null
    and not exists (
      select 1
      from public.messages m
      where m.id = p_last_read_message_id
        and m.conversation_id = p_conversation_id
        and m.workspace_id = target_workspace_id
    )
  then
    raise exception 'Read cursor message does not belong to conversation'
      using errcode = '23503';
  end if;

  insert into public.conversation_reads (
    workspace_id,
    conversation_id,
    user_id,
    last_read_message_id,
    last_read_at
  )
  values (
    target_workspace_id,
    p_conversation_id,
    current_user_id,
    p_last_read_message_id,
    now()
  )
  on conflict (conversation_id, user_id)
  do update
    set
      workspace_id = excluded.workspace_id,
      last_read_message_id = excluded.last_read_message_id,
      last_read_at = now();

  update public.conversations
  set unread_count = 0
  where id = p_conversation_id;
end;
$$;

comment on function public.mark_conversation_read(uuid, uuid) is
  'Stores the current user read cursor for a conversation and clears its unread count.';

revoke all on function public.mark_conversation_read(uuid, uuid) from PUBLIC;
revoke all on function public.mark_conversation_read(uuid, uuid) from anon;
revoke all on function public.mark_conversation_read(uuid, uuid) from authenticated;

grant execute on function public.mark_conversation_read(uuid, uuid) to authenticated;
