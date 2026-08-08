// Resolves the contact and channel an outbound message must be delivered
// through, scoped to the message's own workspace.
//
// Every send function runs as service_role, so RLS never sees these queries and
// the workspace filters below are the only thing keeping a send inside its
// workspace. They used to be missing: the conversation was loaded by id and the
// channel by conversations.channel_id, so a conversation repointed at another
// workspace's channel resolved that channel and get_channel_credentials handed
// back its access token. 20260809090000 closed the write path that produced
// such a row; this closes the read path that trusted it, so neither depends on
// the other.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export interface OutboundRoute {
  contactId: string
  channelId: string
  channelType: string
  channelIsActive: boolean
}

export type OutboundRouteFailure = 'conversation_not_found' | 'channel_not_found'

export type ResolveOutboundRouteResult =
  | { ok: true; route: OutboundRoute }
  | { ok: false; reason: OutboundRouteFailure }

/**
 * Both lookups are filtered on `workspaceId` — pass the workspace of the
 * message being sent, never one read back from the conversation, or the check
 * is circular. A row in another workspace is reported as not found rather than
 * as a distinct error: to the caller it does not exist.
 *
 * `context` prefixes the log line, e.g. 'send-whatsapp-message'.
 */
export async function resolveOutboundRoute(
  admin: SupabaseClient,
  {
    workspaceId,
    conversationId,
    context,
  }: { workspaceId: string; conversationId: string; context?: string },
): Promise<ResolveOutboundRouteResult> {
  const { data: conversation, error: convError } = await admin
    .from('conversations')
    .select('contact_id, channel_id')
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (convError || !conversation) {
    if (context) console.error(`${context}: conversation load`, convError)
    return { ok: false, reason: 'conversation_not_found' }
  }

  const channelId = conversation.channel_id as string

  const { data: channel, error: channelError } = await admin
    .from('channels')
    .select('id, type, is_active')
    .eq('id', channelId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (channelError || !channel) {
    if (context) console.error(`${context}: channel load`, channelError)
    return { ok: false, reason: 'channel_not_found' }
  }

  return {
    ok: true,
    route: {
      contactId: conversation.contact_id as string,
      channelId,
      channelType: channel.type as string,
      channelIsActive: channel.is_active as boolean,
    },
  }
}
