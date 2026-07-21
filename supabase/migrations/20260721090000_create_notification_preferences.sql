-- Per-user notification delivery preferences (in-app / desktop / sound / preview privacy).
-- Preferences affect delivery methods only; they never change recipient selection.

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  desktop_enabled boolean not null default false,
  sound_enabled boolean not null default false,
  preview_mode text not null default 'full',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_preview_mode_check
    check (preview_mode in ('full', 'sender_only', 'hidden'))
);

alter table public.notification_preferences enable row level security;

drop trigger if exists notification_preferences_updated_at
  on public.notification_preferences;
create trigger notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.handle_updated_at();

revoke all on public.notification_preferences from anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.notification_preferences
  to service_role;

drop policy if exists "Users can view own notification preferences"
  on public.notification_preferences;
create policy "Users can view own notification preferences"
  on public.notification_preferences
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can insert own notification preferences"
  on public.notification_preferences;
create policy "Users can insert own notification preferences"
  on public.notification_preferences
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own notification preferences"
  on public.notification_preferences;
create policy "Users can update own notification preferences"
  on public.notification_preferences
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
