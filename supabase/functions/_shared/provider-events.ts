// Provider-event claim/terminal-state helpers. All writes go through the
// service-role client; provider_events is never browser-accessible.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { ClaimResult, ProviderEventInput } from './types.ts'

/**
 * Claims a logical provider event for processing. Returns 'duplicate' when the
 * event was already processed (or is being processed by a live instance) —
 * the caller must ack the webhook without reprocessing.
 */
export async function claimProviderEvent(
  client: SupabaseClient,
  event: ProviderEventInput,
): Promise<ClaimResult> {
  const { data, error } = await client.rpc('claim_provider_event', {
    p_workspace_id: event.workspaceId,
    p_channel_id: event.channelId,
    p_provider: event.provider,
    p_event_type: event.eventType,
    p_event_fingerprint: event.eventFingerprint,
    p_payload: event.payload,
    p_provider_timestamp: event.providerTimestamp ?? null,
  })
  if (error) {
    return { outcome: 'error', message: error.message }
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') {
    return { outcome: 'error', message: 'claim returned no row' }
  }
  const { event_id: eventId, duplicate } = row as {
    event_id: string | null
    duplicate: boolean
  }
  if (duplicate || !eventId) return { outcome: 'duplicate' }
  return { outcome: 'claimed', eventId }
}

interface MarkExtras {
  createdMessageId?: string | null
  createdRecordIds?: Record<string, string[]>
}

async function markEvent(
  client: SupabaseClient,
  eventId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await client
    .from('provider_events')
    .update({ ...values, processed_at: new Date().toISOString() })
    .eq('id', eventId)
  if (error) {
    console.error('provider-events: mark failed', error.code ?? error.message)
  }
}

export function markEventProcessed(
  client: SupabaseClient,
  eventId: string,
  extras: MarkExtras = {},
): Promise<void> {
  return markEvent(client, eventId, {
    status: 'processed',
    created_message_id: extras.createdMessageId ?? null,
    created_record_ids: extras.createdRecordIds ?? {},
  })
}

/** Deliberate skip: unsupported/out-of-scope events we keep for audit. */
export function markEventIgnored(
  client: SupabaseClient,
  eventId: string,
  reason: string,
): Promise<void> {
  return markEvent(client, eventId, { status: 'ignored', last_error: reason })
}

/**
 * Failure terminal state. 'temporary' failures are surfaced to the provider as
 * non-2xx so it redelivers; 'permanent' failures are acked to stop retry loops.
 */
export function markEventFailed(
  client: SupabaseClient,
  eventId: string,
  errorKind: 'temporary' | 'permanent',
  reason: string,
): Promise<void> {
  return markEvent(client, eventId, {
    status: 'failed',
    error_kind: errorKind,
    last_error: reason.slice(0, 500),
  })
}
