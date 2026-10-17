import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/** A preflight failure cannot overwrite another request's in-flight delivery. */
export async function recordUnclaimedFailure(
  client: SupabaseClient,
  messageId: string,
  errorCode: string | null,
  errorType: string | null,
): Promise<boolean> {
  const { data, error } = await client.rpc(
    'record_outbound_preflight_failure',
    {
      p_message_id: messageId,
      p_error_code: errorCode,
      p_error_type: errorType,
    },
  )
  if (error)
    console.error(
      'outbound-dispatch: preflight failure persistence failed',
      error.code,
    )
  return !error && data === true
}

/** An atomic fence prevents concurrent retries from making duplicate provider calls. */
export async function claimOutboundDispatch(
  client: SupabaseClient,
  messageId: string,
): Promise<'claimed' | 'unavailable' | 'error'> {
  const { data, error } = await client.rpc('claim_outbound_message', {
    p_message_id: messageId,
  })
  if (error) return 'error'
  return data === true ? 'claimed' : 'unavailable'
}

/** Only a definitive rejection may reopen delivery; uncertain delivery keeps its fence. */
export async function releaseRejectedDispatch(
  client: SupabaseClient,
  messageId: string,
): Promise<void> {
  const { error } = await client.rpc('release_outbound_message', {
    p_message_id: messageId,
  })
  if (error)
    console.error(
      'outbound-dispatch: failed to release rejected delivery',
      error.code,
    )
}

/** Recover callbacks that committed before the sender saved the provider id. */
export async function reconcileOutboundReceipts(
  client: SupabaseClient,
  messageId: string,
): Promise<void> {
  const { error } = await client.rpc('reconcile_outbound_receipts', {
    p_message_id: messageId,
  })
  if (error)
    console.error(
      'outbound-dispatch: receipt reconciliation failed',
      error.code,
    )
}
