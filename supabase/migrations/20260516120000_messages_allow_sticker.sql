-- Allow 'sticker' (and 'voice', for parity with the frontend MESSAGE_TYPES enum)
-- as valid message.type values. Previously animated TGS stickers were being
-- rejected by `messages_type_check`; the unified inbound-sticker pipeline now
-- writes every sticker variant (WEBP / TGS / WEBM) as type='sticker' and
-- dispatches on metadata.mime_type in the renderer.

alter table public.messages
  drop constraint if exists messages_type_check;

alter table public.messages
  add constraint messages_type_check
  check (
    type in (
      'text',
      'image',
      'video',
      'audio',
      'voice',
      'document',
      'sticker'
    )
  );
