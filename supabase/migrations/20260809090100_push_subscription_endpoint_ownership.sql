begin;

-- Let a push endpoint change hands when a second user signs in on the device.
--
-- push_subscriptions.endpoint is globally unique and the client upserted with
-- onConflict: 'endpoint'. On a shared device that resolves to ON CONFLICT DO
-- UPDATE against a row owned by somebody else, which the UPDATE policy's USING
-- clause rejects -- so registration failed with 42501 and, worse, failed in the
-- only way that matters: the first user's row survived. Their subscription
-- stayed live, so their message previews kept arriving on a device now signed
-- in as someone else. A registration that errors is a bug; a registration that
-- errors while leaving the previous owner subscribed is a privacy defect.
--
-- Two ways out were available.
--
--   change the key   Making the key (user_id, endpoint) lets both rows exist.
--                    That removes the error and keeps the leak: send-message-push
--                    fans out per recipient and would deliver to the endpoint for
--                    both users. Rejected -- an endpoint is one physical
--                    notification channel on one device, and modelling it as
--                    something two users hold at once is what caused this.
--
--   transfer it      A SECURITY DEFINER function that takes the endpoint over
--                    for the caller. Uniqueness stays global, which keeps
--                    "one endpoint, one owner" enforced by the schema rather
--                    than by whoever writes the next caller. Chosen.
--
-- The transfer is one INSERT ... ON CONFLICT DO UPDATE rather than a DELETE
-- followed by an INSERT. Both are atomic inside the function, but concurrent
-- re-registrations of the same endpoint serialize on the conflicting row here,
-- where the delete/insert pair would have both transactions insert after their
-- deletes and one raise a unique violation. created_at is re-stamped when the
-- owner actually changes, so it keeps meaning "when this user subscribed this
-- device" rather than dating back to the previous owner.
--
-- What this does not defend against: anyone who learns another user's endpoint
-- string can call this and take it. That is inherent in "transfer on
-- re-registration" and it is not a disclosure path -- the thief supplies their
-- own p256dh/auth, so subsequent pushes are encrypted to keys the device cannot
-- decrypt. The victim stops receiving notifications; the attacker reads nothing.
-- Endpoints are per-device URLs that never leave the browser and the server,
-- and the alternative -- refusing the transfer -- reinstates the shared-device
-- bug this migration exists to fix.


create or replace function public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED'
      using errcode = '28000';
  end if;

  if nullif(btrim(coalesce(p_endpoint, '')), '') is null
    or nullif(btrim(coalesce(p_p256dh, '')), '') is null
    or nullif(btrim(coalesce(p_auth, '')), '') is null
  then
    raise exception 'INVALID_PUSH_SUBSCRIPTION'
      using errcode = '22023';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    user_agent,
    last_used_at
  )
  values (
    v_user_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    p_user_agent,
    now()
  )
  on conflict (endpoint) do update
  set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    last_used_at = excluded.last_used_at,
    -- Only on a real handover. A user refreshing their own registration keeps
    -- the date they first subscribed this device.
    created_at = case
      when public.push_subscriptions.user_id = excluded.user_id
        then public.push_subscriptions.created_at
      else now()
    end;
  -- updated_at is left to the push_subscriptions_updated_at trigger.
end;
$$;

comment on function public.upsert_push_subscription(text, text, text, text) is
  'Registers the calling user''s Web Push subscription for one endpoint, taking the endpoint over from a previous owner if the device was registered by another user. SECURITY DEFINER because the transfer writes a row the caller does not yet own; the owner is always auth.uid(), never a parameter.';

revoke all on function public.upsert_push_subscription(text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_push_subscription(text, text, text, text)
  to authenticated;


-- The RPC is now the only way a client writes this table, so the privileges
-- that let it write directly go. Removing the grants as well as the policies
-- means a future caller that re-adds a policy still cannot reach the table, and
-- it keeps the old upsert path from being reintroduced by accident. SELECT
-- stays for the settings UI; DELETE stays for sign-out, which deletes by
-- endpoint under the caller's own RLS and therefore removes nothing once the
-- endpoint has moved to someone else -- exactly what is wanted.
revoke insert, update on public.push_subscriptions from authenticated;

drop policy if exists "Users can create own push subscriptions"
  on public.push_subscriptions;
drop policy if exists "Users can update own push subscriptions"
  on public.push_subscriptions;

commit;
