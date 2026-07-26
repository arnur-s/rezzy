-- Personal account fields on the existing global profile row, plus the avatar
-- bucket that backs profiles.avatar_url.
--
-- profiles is already the per-user global record (own-row RLS for select,
-- insert, and update; seeded by private.handle_new_user; timestamped by
-- profiles_updated_at), so the new columns inherit all of that unchanged.
-- Language belongs here rather than in notification_preferences, which is
-- scoped to notification delivery.

alter table public.profiles
  add column if not exists job_title text,
  add column if not exists phone text,
  add column if not exists timezone text,
  add column if not exists language text not null default 'auto';

-- Stored as the preference, not the resolved locale: 'auto' has to stay
-- distinguishable from an explicit 'en' so the client can keep following the
-- browser when the user never chose.
alter table public.profiles
  drop constraint if exists profiles_language_check;
alter table public.profiles
  add constraint profiles_language_check
  check (language in ('auto', 'en', 'ru'));

-- An IANA identifier ('Europe/Berlin') or nothing. Length only: the browser
-- supplies the list, and Postgres has no view of the client's tz database.
alter table public.profiles
  drop constraint if exists profiles_timezone_check;
alter table public.profiles
  add constraint profiles_timezone_check
  check (timezone is null or char_length(timezone) between 1 and 64);

alter table public.profiles
  drop constraint if exists profiles_job_title_check;
alter table public.profiles
  add constraint profiles_job_title_check
  check (job_title is null or char_length(job_title) between 1 and 80);

alter table public.profiles
  drop constraint if exists profiles_phone_check;
alter table public.profiles
  add constraint profiles_phone_check
  check (phone is null or char_length(phone) between 3 and 32);

-- full_name deliberately gets no length constraint here. It is an existing
-- column on rows this migration cannot inspect ahead of time, and the profile
-- form is its only writer, so the requirement is enforced in the Zod schema
-- rather than by a constraint that could fail against already-applied data.

-- Public, unlike chat-media: avatar_url is a plain text column that the member
-- list feeds straight into <Avatar src>, and signing each render would buy
-- nothing while profile RLS already hides other users' rows. Writes stay
-- owner-only through the policies below.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array[
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif'
    ];

-- Every object lives under a folder named for its owner, so the first path
-- segment is the authorization check.
drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
