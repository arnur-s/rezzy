-- Harden private chat media storage for workspace-scoped signed URL access.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'chat-media',
  'chat-media',
  false,
  26214400,
  null
)
on conflict (id) do update
  set
    public = false,
    file_size_limit = 26214400,
    allowed_mime_types = null;

drop policy if exists "Workspace members can read chat media objects" on storage.objects;

create policy "Workspace members can read chat media objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-media'
    and case
      when split_part(storage.objects.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then exists (
        select 1
        from public.workspace_members wm
        where wm.user_id = auth.uid()
          and wm.workspace_id = split_part(storage.objects.name, '/', 1)::uuid
      )
      else false
    end
  );
