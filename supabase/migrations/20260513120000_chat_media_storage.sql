-- Private chat media bucket + messages.metadata for Telegram (and future) media.

alter table public.messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do update
  set public = excluded.public;

drop policy if exists "Workspace members can read chat media objects" on storage.objects;

create policy "Workspace members can read chat media objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-media'
    and exists (
      select 1
      from public.workspace_members wm
      where wm.user_id = auth.uid()
        and wm.workspace_id = split_part(storage.objects.name, '/', 1)::uuid
    )
  );
