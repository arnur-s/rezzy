-- Structured message attachments: multiple attachments per provider message
-- with a download-state machine, provider media identity, and safe failure
-- reasons so the UI can explain and retry.
--
-- Legacy coexistence: the first attachment is dual-written into the existing
-- messages.media_* columns so current rendering, previews, and push text keep
-- working. The frontend prefers message_attachments and falls back to the
-- legacy columns. Legacy columns are never migrated destructively.

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  position integer not null default 0
    constraint message_attachments_position_check check (position >= 0),
  kind text not null
    constraint message_attachments_kind_check
    check (kind in ('image', 'video', 'audio', 'voice', 'document', 'sticker', 'file')),
  provider_media_id text,
  provider_media_unique_id text,
  storage_bucket text not null default 'chat-media',
  storage_path text,
  thumbnail_path text,
  filename text,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  duration_seconds integer,
  checksum text,
  download_status text not null default 'pending'
    constraint message_attachments_download_status_check
    check (download_status in ('pending', 'downloading', 'stored', 'failed', 'skipped')),
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.message_attachments is
  'Provider message attachments (multiple per message where the provider permits). Customer media stays in the private chat-media bucket; display uses signed URLs.';
comment on column public.message_attachments.provider_media_id is 'Provider media id (Telegram file_id, WhatsApp media id, Instagram attachment id when present). May expire; not a permanent URL.';
comment on column public.message_attachments.provider_media_unique_id is 'Stable provider media identity where available (Telegram file_unique_id).';
comment on column public.message_attachments.storage_path is 'Private storage object path once stored; null until download succeeds.';
comment on column public.message_attachments.checksum is 'Provider-supplied content hash where available (e.g. WhatsApp sha256).';
comment on column public.message_attachments.download_status is 'pending | downloading | stored | failed | skipped. A failed download never rejects the parent message.';
comment on column public.message_attachments.failure_reason is 'Safe download failure reason for UI/retry. Never tokens or provider URLs with credentials.';
comment on column public.message_attachments.metadata is 'Sanitized provider media metadata (e.g. sticker emoji/set, animation flags).';

alter table public.message_attachments
  add constraint message_attachments_message_position_key
  unique (message_id, position);

create index message_attachments_message_idx
  on public.message_attachments (message_id);

create index message_attachments_workspace_idx
  on public.message_attachments (workspace_id, created_at);

alter table public.message_attachments enable row level security;

revoke all on public.message_attachments from anon, authenticated;
grant select on public.message_attachments to authenticated;
grant select, insert, update, delete on public.message_attachments to service_role;

create policy "Workspace members can view message attachments"
  on public.message_attachments
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

alter publication supabase_realtime add table public.message_attachments;
