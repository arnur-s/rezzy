import { supabase } from '@/utils/supabase'

export type PushSubscriptionInput = {
  endpoint: string
  p256dh: string
  auth: string
  userAgent: string | null
}

/**
 * Store (or refresh) the current browser's push subscription, keyed by endpoint.
 *
 * Goes through the RPC rather than a direct upsert: an endpoint is one device's
 * notification channel, so re-registering one another user already holds has to
 * move it, and a client cannot write a row it does not own. The owner is
 * `auth.uid()` inside the function — there is no user id to pass.
 */
export async function upsertPushSubscription(
  input: PushSubscriptionInput,
): Promise<void> {
  const { error } = await supabase.rpc('upsert_push_subscription', {
    p_endpoint: input.endpoint,
    p_p256dh: input.p256dh,
    p_auth: input.auth,
    p_user_agent: input.userAgent ?? undefined,
  })

  if (error) throw error
}

/**
 * Sign-out path. RLS scopes the delete to the caller's own row, so this removes
 * nothing if the endpoint has since been taken over by another user on the same
 * device — which is correct: it is no longer this user's subscription to drop.
 */
export async function deletePushSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)

  if (error) throw error
}
