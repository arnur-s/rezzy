begin;

select plan(19);

-- Contract for the personal account area: the profile row is the global
-- per-user record (identity plus the language preference), and the avatars
-- bucket is publicly readable but owner-only for writes.

select has_column('public', 'profiles', 'job_title', 'profiles has job_title');
select has_column('public', 'profiles', 'phone', 'profiles has phone');
select has_column('public', 'profiles', 'timezone', 'profiles has timezone');
select has_column('public', 'profiles', 'language', 'profiles has language');

select col_not_null(
  'public',
  'profiles',
  'language',
  'language is never null'
);

select col_is_null(
  'public',
  'profiles',
  'job_title',
  'job_title is optional'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'profiles_language_check'
      and conrelid = 'public.profiles'::regclass
      and contype = 'c'
  ),
  'language values are constrained'
);

-- The preference, not the resolved locale: 'auto' has to be storable so the
-- client can keep following the browser.
insert into auth.users (id, email, raw_user_meta_data)
values (
  '00000000-0000-4000-8000-000000000901',
  'account-owner@example.com',
  '{"full_name":"Account owner"}'::jsonb
),
(
  '00000000-0000-4000-8000-000000000902',
  'account-other@example.com',
  '{"full_name":"Other account"}'::jsonb
);

select is(
  (
    select language
    from public.profiles
    where id = '00000000-0000-4000-8000-000000000901'
  ),
  'auto'::text,
  'a new profile defaults to the automatic language preference'
);

select lives_ok(
  $$
    update public.profiles
    set language = 'ru'
    where id = '00000000-0000-4000-8000-000000000901'
  $$,
  'ru is an accepted language preference'
);

select lives_ok(
  $$
    update public.profiles
    set language = 'en'
    where id = '00000000-0000-4000-8000-000000000901'
  $$,
  'en is an accepted language preference'
);

select throws_ok(
  $$
    update public.profiles
    set language = 'de'
    where id = '00000000-0000-4000-8000-000000000901'
  $$,
  '23514',
  null,
  'an unsupported language is rejected'
);

select throws_ok(
  $$
    update public.profiles
    set language = 'en-GB'
    where id = '00000000-0000-4000-8000-000000000901'
  $$,
  '23514',
  null,
  'a resolved locale tag is not a valid preference'
);

-- Everything below runs as the signed-in owner, the way PostgREST would.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000901","role":"authenticated"}';

select lives_ok(
  $$
    update public.profiles
    set
      full_name = 'Account owner',
      job_title = 'Account manager',
      phone = '+1 555 0100',
      timezone = 'Europe/Berlin',
      language = 'ru'
    where id = '00000000-0000-4000-8000-000000000901'
  $$,
  'a user can write every personal field on their own profile'
);

select is(
  (
    select count(*)::int
    from public.profiles
    where id = '00000000-0000-4000-8000-000000000902'
  ),
  0,
  'another user profile is invisible through RLS'
);

-- RLS filters the row out rather than raising, so a cross-user write has to be
-- checked by its effect.
update public.profiles
set job_title = 'Injected'
where id = '00000000-0000-4000-8000-000000000902';

reset role;

select is(
  (
    select job_title
    from public.profiles
    where id = '00000000-0000-4000-8000-000000000902'
  ),
  null,
  'a user cannot write another user profile'
);

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'avatars'
      and public
  ),
  'the avatars bucket exists and is publicly readable'
);

select is(
  (
    select file_size_limit
    from storage.buckets
    where id = 'avatars'
  ),
  2097152::bigint,
  'avatar uploads are capped at 2MB'
);

select ok(
  (
    select allowed_mime_types @> array['image/png', 'image/jpeg', 'image/webp']
    from storage.buckets
    where id = 'avatars'
  ),
  'the avatars bucket accepts only image types'
);

select ok(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'Users can upload own avatar',
        'Users can update own avatar',
        'Users can delete own avatar'
      )
  ) = 3,
  'avatar writes are restricted by owner-scoped policies'
);

select * from finish();

rollback;
