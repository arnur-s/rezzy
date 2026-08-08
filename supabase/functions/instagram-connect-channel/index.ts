// instagram-connect-channel.ts
// Completes "Instagram API with Instagram Login" Business Login: consumes the
// one-time OAuth state, exchanges the authorization code for a long-lived token
// server-side, validates the connected professional account, subscribes it to
// messaging webhooks, and creates (or reconnects, non-destructively) the CMS
// channel with credentials stored only in private.channel_secrets.
// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  hasMessagingScope,
  isProfessionalAccountType,
  normalizeAccountType,
  parseGrantedScopes,
} from './lib.ts'

// Env-overridable. Confirm the current stable Graph API version before deploy —
// Meta cycles these on a schedule. Instagram API with Instagram Login lives on
// graph.instagram.com (and api.instagram.com for the short-token exchange).
const GRAPH_VERSION = Deno.env.get('INSTAGRAM_GRAPH_VERSION') ?? 'v25.0'
const IG_GRAPH = `https://graph.instagram.com/${GRAPH_VERSION}`
const IG_TOKEN_URL = 'https://api.instagram.com/oauth/access_token'
const SUBSCRIBE_FIELDS = 'messages,messaging_seen'

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

interface ConnectBody {
  workspace_id?: string
  /** Existing Instagram channel to reconnect in place instead of creating one. */
  channel_id?: string
  /** OAuth authorization code from the Instagram Login redirect. */
  code?: string
  /** One-time CSRF state issued by begin_instagram_oauth. */
  state?: string
  name?: string
}

interface ShortTokenResponse {
  access_token?: string
  user_id?: string | number
  permissions?: unknown
  error_type?: string
  error_message?: string
}

interface LongTokenResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: { message?: string; code?: number }
}

interface ProfileResponse {
  user_id?: string | number
  username?: string
  account_type?: string
  name?: string
  profile_picture_url?: string
  error?: { message?: string; code?: number }
}

interface GraphMutationResponse {
  success?: boolean
  error?: { message?: string; code?: number }
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { headers: JSON_HEADERS, status })
}

function logNetworkError(context: string, error: unknown): void {
  const detail = error instanceof Error ? error.name : typeof error
  console.error(`${context}: ${detail}`)
}

async function subscribeApp(
  igUserId: string,
  token: string,
): Promise<{ ok: boolean; code?: number }> {
  const params = new URLSearchParams({
    subscribed_fields: SUBSCRIBE_FIELDS,
    access_token: token,
  })
  const res = await fetch(`${IG_GRAPH}/${igUserId}/subscribed_apps?${params}`, {
    method: 'POST',
  })
  const json = (await res.json().catch(() => ({}))) as GraphMutationResponse
  return { ok: res.ok && json.success !== false, code: json.error?.code }
}

/** Best-effort rollback so a failed create does not leave a dangling app subscription. */
async function unsubscribeApp(igUserId: string, token: string): Promise<void> {
  try {
    const params = new URLSearchParams({ access_token: token })
    await fetch(`${IG_GRAPH}/${igUserId}/subscribed_apps?${params}`, {
      method: 'DELETE',
    })
  } catch (e) {
    logNetworkError('Instagram unsubscribe rollback', e)
  }
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
    const appId = Deno.env.get('INSTAGRAM_APP_ID')
    const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET')
    const redirectUri = Deno.env.get('INSTAGRAM_REDIRECT_URI')

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error('Missing Supabase environment variables')
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }
    if (!appId || !appSecret || !redirectUri) {
      console.error('Missing INSTAGRAM_APP_ID / APP_SECRET / REDIRECT_URI')
      return jsonResponse(500, {
        error: 'Instagram is not configured. Contact your administrator.',
      })
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return jsonResponse(401, { code: 'unauthorized', error: 'Not authenticated' })
    }

    let body: ConnectBody
    try {
      body = (await req.json()) as ConnectBody
    } catch {
      return jsonResponse(400, { error: 'Invalid request body' })
    }

    const workspaceId =
      typeof body.workspace_id === 'string' ? body.workspace_id.trim() : ''
    const reconnectChannelId =
      typeof body.channel_id === 'string' ? body.channel_id.trim() : ''
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const state = typeof body.state === 'string' ? body.state.trim() : ''
    const displayName =
      typeof body.name === 'string' && body.name.trim().length > 0
        ? body.name.trim()
        : undefined

    if (!workspaceId || !code || !state) {
      return jsonResponse(400, {
        error: 'workspace_id, code and state are required',
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // 1. Workspace membership.
    const { data: membership, error: memberError } = await admin
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberError) {
      console.error('workspace_members lookup failed:', memberError)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }
    if (!membership) {
      return jsonResponse(403, {
        code: 'forbidden',
        error: 'You are not a member of this workspace',
      })
    }

    // 2. Reconnect target lookup (keep the row + history; validate later).
    let existingProviderAccountId = ''
    if (reconnectChannelId) {
      const { data: channel, error: channelError } = await admin
        .from('channels')
        .select('id, workspace_id, type, provider_account_id')
        .eq('id', reconnectChannelId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      if (channelError) {
        console.error('Instagram reconnect lookup failed:', channelError)
        return jsonResponse(500, {
          error: 'Something went wrong. Please try again.',
        })
      }
      if (!channel) {
        return jsonResponse(404, { error: 'Instagram channel not found' })
      }
      if (channel.type !== 'instagram') {
        return jsonResponse(400, { error: 'Channel is not Instagram' })
      }
      existingProviderAccountId =
        typeof channel.provider_account_id === 'string'
          ? channel.provider_account_id
          : ''
    }

    // 3. Consume the one-time OAuth state (single-use, expiring). Bind it to the
    //    authenticated user, the workspace, and the reconnect target.
    const { data: stateRows, error: stateError } = await admin.rpc(
      'consume_oauth_state',
      { p_state: state, p_provider: 'instagram' },
    )
    if (stateError) {
      console.error('consume_oauth_state failed:', stateError)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }
    const stateRow = Array.isArray(stateRows) ? stateRows[0] : stateRows
    const stateChannelId =
      stateRow && typeof stateRow.channel_id === 'string'
        ? stateRow.channel_id
        : ''
    if (
      !stateRow ||
      stateRow.workspace_id !== workspaceId ||
      stateRow.user_id !== user.id ||
      stateChannelId !== reconnectChannelId
    ) {
      return jsonResponse(400, {
        code: 'state_mismatch',
        error: 'This sign-in link is invalid or has expired. Please try again.',
      })
    }

    // 4. Exchange the code for a short-lived token (returns the IG user id).
    let shortToken: ShortTokenResponse
    try {
      const form = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      })
      const res = await fetch(IG_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      })
      shortToken = (await res.json()) as ShortTokenResponse
      if (!res.ok || !shortToken.access_token || shortToken.user_id == null) {
        console.warn('Instagram code exchange rejected:', shortToken.error_type)
        return jsonResponse(400, {
          code: 'invalid_code',
          error: 'Could not verify your Instagram sign-in. Please try again.',
        })
      }
    } catch (e) {
      logNetworkError('Instagram code exchange network error', e)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }

    const igUserId = String(shortToken.user_id)
    const grantedScopes = parseGrantedScopes(shortToken.permissions)
    // Treat the exchange-response permissions as advisory. If present and clearly
    // missing messaging, fail fast; otherwise the subscription call below is the
    // authoritative capability gate.
    if (grantedScopes.length > 0 && !hasMessagingScope(grantedScopes)) {
      return jsonResponse(400, {
        code: 'missing_permission',
        error:
          'Grant Instagram messaging access when connecting. Please try again and allow messaging.',
      })
    }

    // 5. Upgrade to a long-lived (~60-day) token. Non-fatal: fall back to the
    //    short-lived token if the exchange fails so setup can still complete.
    let accessToken = shortToken.access_token
    let tokenExpiresAt: string | null = new Date(
      Date.now() + 60 * 60 * 1000,
    ).toISOString()
    try {
      const params = new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_secret: appSecret,
        access_token: accessToken,
      })
      const res = await fetch(`${IG_GRAPH}/access_token?${params}`)
      const json = (await res.json()) as LongTokenResponse
      if (res.ok && json.access_token) {
        accessToken = json.access_token
        if (typeof json.expires_in === 'number' && json.expires_in > 0) {
          tokenExpiresAt = new Date(
            Date.now() + json.expires_in * 1000,
          ).toISOString()
        }
      } else {
        console.warn('Instagram long-lived token exchange skipped')
      }
    } catch (e) {
      logNetworkError('Instagram long-lived token exchange network error', e)
    }

    // 6. Load the connected professional account profile.
    let profile: ProfileResponse
    try {
      const params = new URLSearchParams({
        fields: 'user_id,username,account_type,name,profile_picture_url',
        access_token: accessToken,
      })
      const res = await fetch(`${IG_GRAPH}/me?${params}`)
      profile = (await res.json()) as ProfileResponse
      if (!res.ok || profile.user_id == null) {
        console.warn('Instagram profile lookup rejected:', profile.error?.code)
        return jsonResponse(400, {
          code: 'invalid_token',
          error: 'Could not read your Instagram account. Please try again.',
        })
      }
    } catch (e) {
      logNetworkError('Instagram profile lookup network error', e)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }

    // The /me user_id is the professional account id used for send + webhook
    // routing; prefer it, falling back to the exchange response.
    const providerAccountId = String(profile.user_id ?? igUserId)
    const username =
      typeof profile.username === 'string' ? profile.username : ''

    // 7. Only professional (Business/Creator) accounts can use messaging.
    if (!isProfessionalAccountType(profile.account_type)) {
      console.warn(
        'Instagram non-professional account_type:',
        normalizeAccountType(profile.account_type) || 'unknown',
      )
      return jsonResponse(400, {
        code: 'not_professional',
        error:
          'Connect an Instagram Business or Creator account to receive messages.',
      })
    }

    // 8. Reconnect must be the same Instagram account — never re-point history.
    if (existingProviderAccountId && existingProviderAccountId !== providerAccountId) {
      return jsonResponse(409, {
        code: 'account_mismatch',
        error:
          'This is a different Instagram account. Create a new channel instead of reconnecting.',
      })
    }

    // 9. Global duplicate check: an Instagram account maps to one channel.
    const { data: duplicate, error: duplicateError } = await admin
      .from('channels')
      .select('id')
      .eq('type', 'instagram')
      .eq('provider_account_id', providerAccountId)
      .maybeSingle()

    if (duplicateError) {
      console.error('Instagram duplicate check failed:', duplicateError)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }
    if (duplicate && duplicate.id !== reconnectChannelId) {
      return jsonResponse(409, {
        code: 'duplicate',
        error: 'This Instagram account is already connected.',
      })
    }

    // 10. Subscribe the account to messaging webhooks with the NEW token. This
    //     is also the authoritative messaging-capability gate.
    let subscribed: { ok: boolean; code?: number }
    try {
      subscribed = await subscribeApp(providerAccountId, accessToken)
    } catch (e) {
      logNetworkError('Instagram subscribe network error', e)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }
    if (!subscribed.ok) {
      console.warn('Instagram app subscription rejected:', subscribed.code)
      return jsonResponse(400, {
        code: 'missing_permission',
        error:
          'Could not enable Instagram messaging. Reconnect and allow messaging access.',
      })
    }

    const credentials = {
      access_token: accessToken,
      instagram_user_id: providerAccountId,
      ...(username ? { username } : {}),
      ...(tokenExpiresAt ? { token_expires_at: tokenExpiresAt } : {}),
      ...(grantedScopes.length > 0 ? { granted_scopes: grantedScopes } : {}),
    }
    const channelName =
      displayName ?? (username ? `@${username}` : 'Instagram')

    // 11. Persist. Reconnect is a single atomic RPC (credentials + channel row);
    //     create inserts the row then stores credentials, rolling both the row
    //     and the app subscription back on failure.
    let channelId = reconnectChannelId
    if (reconnectChannelId) {
      const { error: finalizeError } = await admin.rpc(
        'finalize_instagram_channel_connection',
        {
          p_channel_id: reconnectChannelId,
          p_provider_account_id: providerAccountId,
          p_name: displayName ?? null,
          p_credentials: credentials,
          p_workspace_id: workspaceId,
        },
      )
      if (finalizeError) {
        console.error('Instagram reconnect finalize failed:', finalizeError)
        return jsonResponse(500, {
          error: 'Something went wrong. Please try again.',
        })
      }
    } else {
      const { data: inserted, error: insertError } = await admin
        .from('channels')
        .insert({
          workspace_id: workspaceId,
          type: 'instagram',
          name: channelName,
          is_active: true,
          provider_account_id: providerAccountId,
        })
        .select('id')
        .single()

      if (insertError || !inserted) {
        // A unique-violation here means a concurrent connect won the race.
        const isDuplicate =
          typeof insertError?.code === 'string' && insertError.code === '23505'
        await unsubscribeApp(providerAccountId, accessToken)
        if (isDuplicate) {
          return jsonResponse(409, {
            code: 'duplicate',
            error: 'This Instagram account is already connected.',
          })
        }
        console.error('Instagram channel insert failed:', insertError)
        return jsonResponse(500, {
          error: 'Something went wrong. Please try again.',
        })
      }

      channelId = typeof inserted.id === 'string' ? inserted.id : ''
      const { error: secretError } = await admin.rpc(
        'upsert_channel_credentials',
        {
          p_channel_id: channelId,
          p_credentials: credentials,
          p_workspace_id: workspaceId,
        },
      )
      if (secretError) {
        console.error('Failed to store Instagram credentials:', secretError)
        await admin.from('channels').delete().eq('id', channelId)
        await unsubscribeApp(providerAccountId, accessToken)
        return jsonResponse(500, {
          error: 'Something went wrong. Please try again.',
        })
      }
    }

    // 12. Return only safe public channel fields.
    const { data: channelRow, error: rowError } = await admin
      .from('channels')
      .select('id, workspace_id, type, name, is_active, created_at, updated_at')
      .eq('id', channelId)
      .single()

    if (rowError || !channelRow) {
      console.error('Failed to load Instagram channel after connect:', rowError)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }

    return jsonResponse(200, { channel: channelRow })
  },
}
