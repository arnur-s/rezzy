// telegram-connect-channel.ts
// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

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

interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  username?: string
}

interface TelegramGetMeResponse {
  ok: boolean
  result?: TelegramUser
  description?: string
}

interface TelegramBoolResponse {
  ok: boolean
  description?: string
}

interface ConnectBody {
  workspace_id?: string
  bot_token?: string
  name?: string
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    headers: JSON_HEADERS,
    status,
  })
}

function logTelegramNetworkError(context: string, error: unknown): void {
  const detail = error instanceof Error ? error.name : typeof error
  console.error(`${context}: ${detail}`)
}

export default {
  async fetch(req: Request): Promise<Response> {
    // Handle CORS preflight
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
      console.error('Missing Supabase environment variables')
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
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
      return jsonResponse(401, { error: 'Not authenticated' })
    }

    let body: ConnectBody
    try {
      body = (await req.json()) as ConnectBody
    } catch {
      return jsonResponse(400, { error: 'Invalid request body' })
    }

    const workspaceId =
      typeof body.workspace_id === 'string' ? body.workspace_id.trim() : ''
    const rawToken =
      typeof body.bot_token === 'string' ? body.bot_token.trim() : ''
    const displayName =
      typeof body.name === 'string' && body.name.trim().length > 0
        ? body.name.trim()
        : undefined

    if (!workspaceId || !rawToken) {
      return jsonResponse(400, {
        error: 'workspace_id and bot_token are required',
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)

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
        error: 'You are not a member of this workspace',
      })
    }

    let getMe: TelegramGetMeResponse
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${rawToken}/getMe`)
      getMe = (await tgRes.json()) as TelegramGetMeResponse
    } catch (e) {
      logTelegramNetworkError('Telegram getMe network error', e)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }

    if (!getMe.ok || !getMe.result?.username) {
      return jsonResponse(400, { error: 'Invalid bot token' })
    }

    const channelName = displayName ?? `@${getMe.result.username}`

    const { data: duplicate, error: dupError } = await admin
      .from('channels')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('type', 'telegram')
      .eq('name', channelName)
      .maybeSingle()

    if (dupError) {
      console.error('Duplicate check failed:', dupError)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }

    if (duplicate) {
      return jsonResponse(409, { error: 'This bot is already connected' })
    }

    const { data: inserted, error: insertError } = await admin
      .from('channels')
      .insert({
        workspace_id: workspaceId,
        type: 'telegram',
        name: channelName,
        is_active: true,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      console.error('Channel insert failed:', insertError)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }

    const channelId = typeof inserted.id === 'string' ? inserted.id : ''
    if (!channelId) {
      console.error('Channel insert returned invalid id')
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }

    const webhookSecret = channelId.replace(/-/g, '')

    const { error: secretError } = await admin.rpc(
      'upsert_channel_credentials',
      {
        p_channel_id: channelId,
        p_credentials: {
          bot_token: rawToken,
          webhook_secret: webhookSecret,
        },
      },
    )

    if (secretError) {
      console.error('Failed to store channel secret:', secretError)
      await admin.from('channels').delete().eq('id', channelId)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook/${channelId}`

    const form = new URLSearchParams({
      url: webhookUrl,
      secret_token: webhookSecret,
    })

    let setWebhook: TelegramBoolResponse
    try {
      const swRes = await fetch(
        `https://api.telegram.org/bot${rawToken}/setWebhook`,
        {
          body: form.toString(),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          method: 'POST',
        },
      )
      setWebhook = (await swRes.json()) as TelegramBoolResponse
    } catch (e) {
      logTelegramNetworkError('Telegram setWebhook network error', e)
      await admin.from('channels').delete().eq('id', channelId)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }

    if (!setWebhook.ok) {
      console.error('Telegram setWebhook rejected')
      await admin.from('channels').delete().eq('id', channelId)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }

    const { data: channelRow, error: rowError } = await admin
      .from('channels')
      .select('id, workspace_id, type, name, is_active, created_at, updated_at')
      .eq('id', channelId)
      .single()

    if (rowError || !channelRow) {
      console.error('Failed to load channel after connect:', rowError)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }

    return jsonResponse(200, { channel: channelRow })
  },
}
