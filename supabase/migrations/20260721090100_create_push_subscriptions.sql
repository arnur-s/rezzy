-- Web Push subscriptions. A user may have many (one per browser/device endpoint).
-- Uniqueness is by endpoint so re-subscribing the same device updates in place.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.handle_updated_at();

revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;

drop policy if exists "Users can view own push subscriptions"
  on public.push_subscriptions;
create policy "Users can view own push subscriptions"
  on public.push_subscriptions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can create own push subscriptions"
  on public.push_subscriptions;
create policy "Users can create own push subscriptions"
  on public.push_subscriptions
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own push subscriptions"
  on public.push_subscriptions;
create policy "Users can update own push subscriptions"
  on public.push_subscriptions
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete own push subscriptions"
  on public.push_subscriptions;
create policy "Users can delete own push subscriptions"
  on public.push_subscriptions
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
