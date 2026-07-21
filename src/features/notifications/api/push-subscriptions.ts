import { supabase } from '@/utils/supabase'

export type PushSubscriptionInput = {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent: string | null
}

/** Store (or refresh) the current browser's push subscription, keyed by endpoint. */
export async function upsertPushSubscription(
  input: PushSubscriptionInput,
): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )

  if (error) throw error
}

export async function deletePushSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)

  if (error) throw error
}
