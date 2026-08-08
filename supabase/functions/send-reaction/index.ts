// send-reaction
//
// Adds, replaces, or removes the workspace's own reaction on a provider
// message. A reaction is not a message: this function writes exactly one
// message_reactions row and touches nothing else — no conversation preview, no
// last_message_at, no status event, no unread counter, no push. The only
// non-reaction write is the channel's error stamp, which is channel health.
//
// The browser never holds provider credentials, so it sends a canonical command
// (message + emoji, or emoji: null to remove) and this function resolves the
// channel, its secret, and the provider payload.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { resolveOutboundRoute } from '../_shared/outbound-route.ts'
import { applyReactionOps, touchChannelActivity } from '../_shared/persist.ts'
import { normalizeReactionEmoji } from '../_shared/reaction-emoji.ts'
import type {
  ProviderOutcome,
  ProviderRequest,
  SendReactionCommand,
} from '../_shared/reaction-send.ts'
import {
  OUTBOUND_REACTOR_ID,
  SUPPORTED_REACTION_EMOJI,
  buildInstagramReactionRequest,
  buildTelegramReactionRequest,
  buildWhatsappReactionRequest,
  interpretInstagramReactionResponse,
  interpretTelegramReactionResponse,
  interpretWhatsappReactionResponse,
} from '../_shared/reaction-send.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  ...CORS_HEADERS,
}

const GRAPH_VERSION = Deno.env.get('WHATSAPP_GRAPH_VERSION') ?? 'v23.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`

// Instagram messaging is served from its own host and pinned to its own
// version, matching send-instagram-message.
const IG_GRAPH_VERSION = Deno.env.get('INSTAGRAM_GRAPH_VERSION') ?? 'v25.0'
const IG_GRAPH = `https://graph.instagram.com/${IG_GRAPH_VERSION}`

/** Providers whose business account can send a reaction. */
const REACTION_PROVIDERS = new Set(['telegram', 'whatsapp', 'instagram'])

interface SendReactionBody {
  messageId?: string
  emoji?: string | null
}

interface MessageRow {
  id: string
  workspace_id: string
  conversation_id: string
  type: string
  external_id: string | null
  deleted_at: string | null
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { headers: JSON_HEADERS, status })
}

/**
 * A failure the agent can see. Only the stable code crosses the wire — the
 * client turns it into localized copy — so provider prose and anything it might
 * name stays in the function log.
 */
function failure(status: number, code: string, detail?: string | null): Response {
  if (detail) console.error(`send-reaction: ${code}: ${detail}`)
  return jsonResponse(status, { ok: false, code })
}

function getCredentialString(credentials: unknown, field: string): string {
  if (
    typeof credentials !== 'object' ||
    credentials === null ||
    Array.isArray(credentials)
  ) {
    return ''
  }
  const value = Object.entries(credentials).find(([key]) => key === field)?.[1]
  return typeof value === 'string' ? value.trim() : ''
}

async function callProvider(
  request: ProviderRequest,
  interpret: (status: number, json: never) => ProviderOutcome,
): Promise<ProviderOutcome> {
  let response: Response
  try {
    response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
    })
  } catch (error) {
    // Name only: a thrown network error can carry the request URL, and the URL
    // carries the bot token.
    console.error(
      `send-reaction: network error: ${
        error instanceof Error ? error.name : typeof error
      }`,
    )
    return {
      ok: false,
      code: 'provider_unreachable',
      detail: null,
      isRetryable: true,
    }
  }

  let json: unknown = null
  try {
    json = await response.json()
  } catch {
    /* A provider that answered with a non-JSON body is handled by interpret. */
  }
  return interpret(response.status, json as never)
}

/**
 * Records the outcome. `applyReactionOps` owns the idempotency: the row is
 * keyed by (channel, provider message, reactor, emoji), so a retried request
 * updates the row it already wrote instead of adding a second one.
 *
 * `replaceOthers` enforces one reaction per actor — the previous emoji is
 * flipped to `removed` in the same call that adds the new one, so the counters
 * never show the workspace holding two.
 */
async function recordReaction(
  admin: SupabaseClient,
  args: {
    workspaceId: string
    channelId: string
    conversationId: string
    messageId: string
    providerMessageId: string
    emoji: string | null
  },
): Promise<void> {
  const target = {
    workspaceId: args.workspaceId,
    channelId: args.channelId,
    providerMessageId: args.providerMessageId,
    conversationId: args.conversationId,
    messageId: args.messageId,
  }
  const providerTimestamp = new Date().toISOString()

  if (!args.emoji) {
    // Removal: withdraw whatever this workspace was holding, whichever emoji.
    await applyReactionOps(admin, target, [], {
      replaceOthers: { reactorExternalId: OUTBOUND_REACTOR_ID },
    })
    return
  }

  await applyReactionOps(
    admin,
    target,
    [
      {
        reactorExternalId: OUTBOUND_REACTOR_ID,
        isFromContact: false,
        emoji: args.emoji,
        action: 'added',
        providerTimestamp,
      },
    ],
    {
      replaceOthers: {
        reactorExternalId: OUTBOUND_REACTOR_ID,
        keepEmoji: args.emoji,
      },
    },
  )
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: CORS_HEADERS })
    }
    if (req.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: CORS_HEADERS,
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error('send-reaction: missing Supabase env')
      return failure(500, 'server_misconfigured')
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) return failure(401, 'not_authenticated')

    let body: SendReactionBody
    try {
      body = (await req.json()) as SendReactionBody
    } catch {
      return failure(400, 'invalid_request')
    }

    const messageId =
      typeof body.messageId === 'string' ? body.messageId.trim() : ''
    if (!messageId) return failure(400, 'invalid_request')

    // `null` removes; anything else must be one of ours. An unsupported emoji
    // is rejected here rather than sent and refused by the provider.
    let emoji: string | null = null
    if (body.emoji !== null && body.emoji !== undefined) {
      if (typeof body.emoji !== 'string') return failure(400, 'invalid_request')
      emoji = normalizeReactionEmoji(body.emoji)
      if (!SUPPORTED_REACTION_EMOJI.includes(emoji)) {
        return failure(400, 'emoji_unsupported')
      }
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: message, error: msgError } = await admin
      .from('messages')
      .select('id, workspace_id, conversation_id, type, external_id, deleted_at')
      .eq('id', messageId)
      .maybeSingle()

    if (msgError) {
      console.error('send-reaction: message load error', msgError)
      return failure(500, 'lookup_failed')
    }
    if (!message) return failure(404, 'message_unavailable')

    const row = message as MessageRow

    const { data: membership, error: memberError } = await admin
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', row.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberError) {
      console.error('send-reaction: membership lookup', memberError)
      return failure(500, 'lookup_failed')
    }
    if (!membership) return failure(403, 'forbidden')

    if (row.deleted_at) return failure(409, 'message_unavailable')
    if (!row.external_id?.trim()) return failure(409, 'missing_provider_id')

    const providerMessageId = row.external_id.trim()

    // Both lookups are scoped to the message's workspace. Without that, a
    // conversation repointed at another workspace's channel would react on that
    // workspace's credentials -- see _shared/outbound-route.ts.
    const resolved = await resolveOutboundRoute(admin, {
      workspaceId: row.workspace_id,
      conversationId: row.conversation_id,
      context: 'send-reaction',
    })

    if (!resolved.ok) {
      return failure(
        404,
        resolved.reason === 'conversation_not_found'
          ? 'message_unavailable'
          : 'channel_unavailable',
      )
    }
    const { contactId, channelId, channelType, channelIsActive } =
      resolved.route

    if (!REACTION_PROVIDERS.has(channelType)) {
      return failure(400, 'reactions_unsupported')
    }
    if (!channelIsActive) return failure(409, 'channel_disconnected')

    const { data: credentials, error: secretError } = await admin.rpc(
      'get_channel_credentials',
      { p_channel_id: channelId, p_workspace_id: row.workspace_id },
    )
    if (secretError) {
      console.error('send-reaction: channel secret load', secretError)
      return failure(500, 'lookup_failed')
    }

    const { data: contactChannel, error: ccError } = await admin
      .from('contact_channels')
      .select('external_id')
      .eq('contact_id', contactId)
      .eq('channel_type', channelType)
      .maybeSingle()

    if (ccError) {
      console.error('send-reaction: contact_channel load', ccError)
      return failure(500, 'lookup_failed')
    }
    const recipientId = contactChannel?.external_id?.trim() ?? ''
    if (!recipientId) return failure(409, 'missing_provider_id')

    const command: SendReactionCommand = { providerMessageId, emoji }
    let outcome: ProviderOutcome

    if (channelType === 'telegram') {
      const botToken = getCredentialString(credentials, 'bot_token')
      if (!botToken) return failure(400, 'channel_unauthorized')

      outcome = await callProvider(
        buildTelegramReactionRequest({ botToken, chatId: recipientId, command }),
        interpretTelegramReactionResponse,
      )
    } else if (channelType === 'instagram') {
      const accessToken = getCredentialString(credentials, 'access_token')
      const instagramUserId = getCredentialString(
        credentials,
        'instagram_user_id',
      )
      if (!accessToken || !instagramUserId) {
        return failure(400, 'channel_unauthorized')
      }

      outcome = await callProvider(
        buildInstagramReactionRequest({
          graphUrl: IG_GRAPH,
          accessToken,
          instagramUserId,
          recipientId,
          command,
        }),
        interpretInstagramReactionResponse,
      )
    } else {
      const accessToken = getCredentialString(credentials, 'access_token')
      const phoneNumberId = getCredentialString(credentials, 'phone_number_id')
      if (!accessToken || !phoneNumberId) {
        return failure(400, 'channel_unauthorized')
      }

      outcome = await callProvider(
        buildWhatsappReactionRequest({
          graphUrl: GRAPH,
          accessToken,
          phoneNumberId,
          recipientId,
          command,
        }),
        interpretWhatsappReactionResponse,
      )
    }

    if (!outcome.ok) {
      await touchChannelActivity(admin, channelId, 'error', outcome.code)
      return failure(
        outcome.isRetryable ? 503 : 502,
        outcome.code,
        outcome.detail,
      )
    }

    // Only after the provider accepted it: the row is a record of what the
    // provider holds, and writing it earlier would leave a chip behind on a
    // send that never happened.
    await recordReaction(admin, {
      workspaceId: row.workspace_id,
      channelId,
      conversationId: row.conversation_id,
      messageId: row.id,
      providerMessageId,
      emoji,
    })

    return jsonResponse(200, { ok: true })
  },
}
