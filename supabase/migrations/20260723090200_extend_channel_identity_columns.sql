-- Provider identity and provider-state columns.
--
-- contact_channels.profile: officially supplied identity metadata per provider
-- (documented shapes in docs/provider-data-model.md):
--   telegram:  { user_id, first_name, last_name, username, language_code,
--                is_premium, is_bot, business_connection_id }
--   whatsapp:  { wa_id, phone, profile_name, locale, referral }
--   instagram: { username, name, profile_pic, is_verified_user, follower_count,
--                is_user_follow_business, is_business_follow_user }
-- None of these fields are filtered or sorted on, so JSONB (not columns).
--
-- conversations/channels gain provider activity state used for messaging-window
-- checks and channel diagnostics. Provider events never change CRM workflow
-- state (status/assignee/snooze) beyond existing designed behavior.

alter table public.contact_channels
  add column profile jsonb not null default '{}'::jsonb,
  add column profile_synced_at timestamptz;

comment on column public.contact_channels.profile is
  'Sanitized provider identity profile (per-provider shape, see docs/provider-data-model.md). Never merged across identities by heuristics.';
comment on column public.contact_channels.profile_synced_at is
  'When the provider profile was last synchronized.';

alter table public.conversations
  add column external_thread_id text,
  add column last_inbound_at timestamptz;

comment on column public.conversations.external_thread_id is
  'Provider conversation/thread id when the provider exposes one (e.g. Telegram chat id, WhatsApp wa_id, Instagram sender IGSID).';
comment on column public.conversations.last_inbound_at is
  'Receipt time of the latest inbound message; drives WhatsApp/Instagram messaging-window checks.';

alter table public.channels
  add column api_version text,
  add column last_webhook_at timestamptz,
  add column last_outbound_at timestamptz,
  add column last_error_at timestamptz,
  add column last_error_code text;

comment on column public.channels.api_version is 'Provider API version last used for this channel.';
comment on column public.channels.last_webhook_at is 'Receipt time of the latest verified webhook for this channel.';
comment on column public.channels.last_outbound_at is 'Time of the latest successful outbound send on this channel.';
comment on column public.channels.last_error_at is 'Time of the latest provider failure on this channel.';
comment on column public.channels.last_error_code is 'Safe provider error code for the latest failure. Never tokens, bodies, or phone numbers.';

-- Maintain conversations.last_inbound_at and extend the server-side preview
-- fallback for the new message types. Preview strings stay hardcoded English by
-- existing design (the frontend derives localized previews separately).
create or replace function public.handle_inbound_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.direction = 'inbound' then
    update public.conversations
    set
      last_message_at = new.created_at,
      last_inbound_at = new.created_at,
      last_message_preview = coalesce(
        nullif(trim(new.content), ''),
        case new.type
          when 'image' then '📷 Photo'
          when 'video' then '🎥 Video'
          when 'audio' then '🎧 Audio'
          when 'voice' then '🎤 Voice message'
          when 'document' then coalesce(new.media_filename, '📎 Document')
          when 'sticker' then 'Sticker'
          when 'location' then '📍 Location'
          when 'contact' then '👤 Contact'
          when 'interactive' then 'Interactive reply'
          when 'share' then 'Shared post'
          when 'story_reply' then 'Story reply'
          when 'story_mention' then 'Story mention'
          when 'system' then 'System event'
          when 'unsupported' then 'Unsupported message'
          else 'Message'
        end
      ),
      updated_at = now()
    where id = new.conversation_id;
  end if;

  return new;
end;
$$;
