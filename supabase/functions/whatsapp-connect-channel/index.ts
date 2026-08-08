// whatsapp-connect-channel.ts
// Completes Meta Embedded Signup: exchanges the OAuth `code` for a long-lived
// token, subscribes the app to the WhatsApp Business Account so webhooks flow,
// registers the phone number, and creates the CMS channel + stored credentials.
// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Env-overridable. Confirm the current stable Graph API version before deploy —
// Meta cycles these on a schedule; a version stays callable ~2 years.
const GRAPH_VERSION = Deno.env.get('WHATSAPP_GRAPH_VERSION') ?? 'v23.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`

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
  /** Existing WhatsApp channel to update in place instead of creating one. */
  channel_id?: string
  /** Embedded Signup flow: exchanged server-side for an access token. */
  code?: string
  /** Manual flow: a Cloud API token supplied directly instead of `code`. */
  access_token?: string
  phone_number_id?: string
  waba_id?: string
  name?: string
}

interface TokenResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: { message?: string; code?: number }
}

interface PhoneNumberResponse {
  id?: string
  verified_name?: string
  display_phone_number?: string
  error?: { message?: string; code?: number }
}

interface WabaPhoneNumbersResponse {
  data?: Array<{ id?: string }>
  paging?: { next?: string }
  error?: { message?: string; code?: number }
}

interface GraphMutationResponse {
  success?: boolean
  error?: { message?: string; code?: number }
}

interface TokenDebugResponse {
  data?: {
    app_id?: string
    is_valid?: boolean
    scopes?: string[]
    granular_scopes?: Array<{ scope?: string; target_ids?: string[] }>
  }
  error?: { message?: string; code?: number }
}

type CredentialField = 'phone_number_id' | 'waba_id' | 'pin'

const REQUIRED_MESSAGING_PERMISSION = 'whatsapp_business_messaging'

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { headers: JSON_HEADERS, status })
}

function logNetworkError(context: string, error: unknown): void {
  const detail = error instanceof Error ? error.name : typeof error
  console.error(`${context}: ${detail}`)
}

function getCredentialString(
  credentials: unknown,
  field: CredentialField,
): string {
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

/** Six-digit registration PIN, persisted for future re-registration. */
function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
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
    const appId = Deno.env.get('WHATSAPP_APP_ID')
    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET')

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error('Missing Supabase environment variables')
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }
    // App credentials are only needed to exchange an Embedded Signup code; the
    // manual flow supplies its own token, so the check lives in that branch.

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
    const reconnectChannelId =
      typeof body.channel_id === 'string' ? body.channel_id.trim() : ''
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const providedToken =
      typeof body.access_token === 'string' ? body.access_token.trim() : ''
    const phoneNumberId =
      typeof body.phone_number_id === 'string'
        ? body.phone_number_id.trim()
        : ''
    const providedWabaId =
      typeof body.waba_id === 'string' ? body.waba_id.trim() : ''
    const displayName =
      typeof body.name === 'string' && body.name.trim().length > 0
        ? body.name.trim()
        : undefined

    // Manual flow: caller brought its own Cloud API token instead of a code.
    const isManual = !code && providedToken.length > 0

    if (!workspaceId || !phoneNumberId) {
      return jsonResponse(400, {
        error: 'workspace_id and phone_number_id are required',
      })
    }

    if (!code && !providedToken) {
      return jsonResponse(400, {
        error: 'Either code or access_token is required',
      })
    }

    // Embedded Signup always reports the WABA; the manual flow may omit it and
    // simply skip the app subscription below.
    if (code && !providedWabaId) {
      return jsonResponse(400, { error: 'waba_id is required with code' })
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

    // Reconnect keeps the public channel row and all dependent conversations in
    // place. Only credentials are replaced, after the new Meta access has been
    // fully validated. Loading through the service-only RPC also lets an omitted
    // manual WABA ID preserve the existing webhook subscription target.
    let previousCredentials: unknown = null
    if (reconnectChannelId) {
      const { data: reconnectChannel, error: reconnectError } = await admin
        .from('channels')
        .select('id, workspace_id, type')
        .eq('id', reconnectChannelId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      if (reconnectError) {
        console.error(
          'WhatsApp reconnect channel lookup failed:',
          reconnectError,
        )
        return jsonResponse(500, {
          error: 'Something went wrong. Please try again.',
        })
      }

      if (!reconnectChannel) {
        return jsonResponse(404, { error: 'WhatsApp channel not found' })
      }

      if (reconnectChannel.type !== 'whatsapp') {
        return jsonResponse(400, { error: 'Channel is not WhatsApp' })
      }

      const { data: credentials, error: credentialsError } = await admin.rpc(
        'get_channel_credentials',
        { p_channel_id: reconnectChannelId, p_workspace_id: workspaceId },
      )

      if (credentialsError) {
        console.error(
          'WhatsApp reconnect credential lookup failed:',
          credentialsError,
        )
        return jsonResponse(500, {
          error: 'Something went wrong. Please try again.',
        })
      }

      previousCredentials = credentials
      const previousPhoneNumberId = getCredentialString(
        previousCredentials,
        'phone_number_id',
      )
      if (previousPhoneNumberId && previousPhoneNumberId !== phoneNumberId) {
        return jsonResponse(409, {
          code: 'phone_mismatch',
          error:
            'Reconnect this channel with the same phone number ID. Add a new channel for a different number.',
        })
      }
    }

    const wabaId =
      providedWabaId || getCredentialString(previousCredentials, 'waba_id')

    // 1. Obtain an access token: exchange the Embedded Signup code, or take the
    //    one the manual flow supplied.
    let accessToken = providedToken
    if (code) {
      if (!appId || !appSecret) {
        console.error('Missing WHATSAPP_APP_ID or WHATSAPP_APP_SECRET')
        return jsonResponse(500, {
          error: 'WhatsApp is not configured. Contact your administrator.',
        })
      }
      try {
        const params = new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          code,
        })
        const res = await fetch(
          `${GRAPH}/oauth/access_token?${params.toString()}`,
        )
        const json = (await res.json()) as TokenResponse
        if (!res.ok || !json.access_token) {
          console.error('WhatsApp code exchange rejected:', json.error?.code)
          return jsonResponse(400, {
            error: 'Could not verify WhatsApp sign-in. Please try again.',
          })
        }
        accessToken = json.access_token
      } catch (e) {
        logNetworkError('WhatsApp code exchange network error', e)
        return jsonResponse(500, {
          error: 'Something went wrong. Please try again.',
        })
      }
    }

    // 2. Upgrade to a long-lived (60-day) token so sends don't silently expire.
    //    Non-fatal: fall back to the original token if the exchange fails, and
    //    skip entirely without app credentials (possible in the manual flow).
    let tokenExpiresAt: string | null = null
    if (appId && appSecret) {
      try {
        const params = new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: accessToken,
        })
        const res = await fetch(
          `${GRAPH}/oauth/access_token?${params.toString()}`,
        )
        const json = (await res.json()) as TokenResponse
        if (res.ok && json.access_token) {
          accessToken = json.access_token
          if (typeof json.expires_in === 'number' && json.expires_in > 0) {
            tokenExpiresAt = new Date(
              Date.now() + json.expires_in * 1000,
            ).toISOString()
          }
        } else {
          console.warn('WhatsApp long-lived token exchange skipped')
        }
      } catch (e) {
        logNetworkError('WhatsApp long-lived token exchange network error', e)
      }
    }

    // A successful phone-number lookup only proves management/read access. The
    // messages endpoint separately requires whatsapp_business_messaging. The
    // token must also belong to this deployment's Meta app, because inbound
    // webhook signatures are verified with that app's secret.
    if (appId && appSecret) {
      try {
        const params = new URLSearchParams({ input_token: accessToken })
        const res = await fetch(`${GRAPH}/debug_token?${params.toString()}`, {
          headers: { Authorization: `Bearer ${appId}|${appSecret}` },
        })
        const json = (await res.json()) as TokenDebugResponse

        if (
          !res.ok ||
          !json.data ||
          json.data.is_valid !== true ||
          json.data.app_id !== appId
        ) {
          console.warn('WhatsApp token debug rejected:', json.error?.code)
          return jsonResponse(400, {
            code: 'invalid_token',
            error:
              'The access token is invalid or belongs to another Meta app.',
          })
        }

        const permissionNames = new Set([
          ...(Array.isArray(json.data.scopes) ? json.data.scopes : []),
          ...(Array.isArray(json.data.granular_scopes)
            ? json.data.granular_scopes.flatMap((scope) =>
                typeof scope.scope === 'string' ? [scope.scope] : [],
              )
            : []),
        ])

        if (!permissionNames.has(REQUIRED_MESSAGING_PERMISSION)) {
          return jsonResponse(400, {
            code: 'missing_permission',
            error: 'The access token must include whatsapp_business_messaging.',
          })
        }

        const messagingTargets = json.data.granular_scopes
          ?.filter((scope) => scope.scope === REQUIRED_MESSAGING_PERMISSION)
          .flatMap((scope) => scope.target_ids ?? [])

        if (
          wabaId &&
          messagingTargets &&
          messagingTargets.length > 0 &&
          !messagingTargets.includes(wabaId)
        ) {
          return jsonResponse(400, {
            code: 'missing_permission',
            error:
              'The access token is not assigned to this WhatsApp Business Account.',
          })
        }
      } catch (e) {
        logNetworkError('WhatsApp token debug network error', e)
        return jsonResponse(500, {
          error:
            'Could not verify the WhatsApp access token. Please try again.',
        })
      }
    }

    // 3. Validate the phone number + token, and derive a display name.
    let phoneInfo: PhoneNumberResponse
    try {
      const params = new URLSearchParams({
        fields: 'verified_name,display_phone_number',
        access_token: accessToken,
      })
      const res = await fetch(`${GRAPH}/${phoneNumberId}?${params.toString()}`)
      phoneInfo = (await res.json()) as PhoneNumberResponse
      if (!res.ok || !phoneInfo.id) {
        console.error('WhatsApp phone lookup rejected:', phoneInfo.error?.code)
        return jsonResponse(400, {
          error: 'Could not read the WhatsApp phone number. Please try again.',
        })
      }
    } catch (e) {
      logNetworkError('WhatsApp phone lookup network error', e)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }

    // A WABA is optional only for a brand-new manual send-only connection. If
    // one is known, prove that the token can manage it and that it owns this
    // phone number. This catches copied IDs from different Meta accounts before
    // replacing a working secret.
    if (wabaId) {
      let nextUrl: string | undefined =
        `${GRAPH}/${wabaId}/phone_numbers?fields=id&limit=100`
      const visitedUrls = new Set<string>()
      let foundPhoneNumber = false

      try {
        while (nextUrl && !visitedUrls.has(nextUrl)) {
          visitedUrls.add(nextUrl)
          const res = await fetch(nextUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const json = (await res.json()) as WabaPhoneNumbersResponse

          if (!res.ok || !Array.isArray(json.data)) {
            console.error(
              'WhatsApp WABA phone lookup rejected:',
              json.error?.code,
            )
            return jsonResponse(400, {
              code: 'missing_permission',
              error:
                'Could not access this WhatsApp Business Account with the supplied token.',
            })
          }

          if (json.data.some((phone) => phone.id === phoneNumberId)) {
            foundPhoneNumber = true
            break
          }

          const candidateNextUrl = json.paging?.next
          if (typeof candidateNextUrl === 'string') {
            const parsedNextUrl = new URL(candidateNextUrl)
            nextUrl =
              parsedNextUrl.origin === new URL(GRAPH).origin
                ? parsedNextUrl.toString()
                : undefined
          } else {
            nextUrl = undefined
          }
        }
      } catch (e) {
        logNetworkError('WhatsApp WABA phone lookup network error', e)
        return jsonResponse(500, {
          error:
            'Could not verify the WhatsApp Business Account. Please try again.',
        })
      }

      if (!foundPhoneNumber) {
        return jsonResponse(409, {
          code: 'phone_mismatch',
          error:
            'The phone number does not belong to this WhatsApp Business Account.',
        })
      }
    }

    const channelName =
      displayName ??
      phoneInfo.verified_name ??
      phoneInfo.display_phone_number ??
      'WhatsApp'

    // 4. Reject if this number is already connected in the workspace.
    const { data: existing, error: existingError } = await admin.rpc(
      'get_whatsapp_channel_by_phone',
      { p_phone_number_id: phoneNumberId },
    )

    if (existingError) {
      console.error('WhatsApp duplicate check failed:', existingError)
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }

    const isConnectedToAnotherChannel =
      Array.isArray(existing) &&
      existing.some((match) => {
        if (typeof match !== 'object' || match === null) return true
        const channelId = Reflect.get(match, 'channel_id')
        return channelId !== reconnectChannelId
      })

    if (isConnectedToAnotherChannel) {
      return jsonResponse(409, {
        code: 'duplicate',
        error: 'This WhatsApp number is already connected',
      })
    }

    // 5. Reuse the existing public row during reconnect. New connections still
    //    create one here, but credentials are not written until all fatal Meta
    //    validation has completed below.
    let channelId = reconnectChannelId
    let createdChannel = false

    if (!channelId) {
      const { data: inserted, error: insertError } = await admin
        .from('channels')
        .insert({
          workspace_id: workspaceId,
          type: 'whatsapp',
          name: channelName,
          is_active: true,
        })
        .select('id')
        .single()

      if (insertError || !inserted) {
        console.error('WhatsApp channel insert failed:', insertError)
        return jsonResponse(500, {
          error: 'Something went wrong. Please try again.',
        })
      }

      channelId = typeof inserted.id === 'string' ? inserted.id : ''
      if (!channelId) {
        console.error('WhatsApp channel insert returned invalid id')
        return jsonResponse(500, {
          error: 'Something went wrong. Please try again.',
        })
      }
      createdChannel = true
    }

    const previousPin = getCredentialString(previousCredentials, 'pin')
    const pin = previousPin || generatePin()

    // 6. Subscribe our app to the WABA so inbound webhooks are delivered.
    //    Embedded Signup always has a WABA and depends on this, so a failure is
    //    fatal there. A new manual send-only connection may omit the WABA or
    //    subscribe it in Meta; reconnect requires the known WABA subscription
    //    to succeed before any stored credential is replaced.
    if (wabaId) {
      try {
        const res = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const json = (await res.json()) as GraphMutationResponse
        if (!res.ok || json.success === false) {
          console.error('WhatsApp app subscription rejected:', json.error?.code)
          if (!isManual || reconnectChannelId) {
            if (createdChannel) {
              await admin.from('channels').delete().eq('id', channelId)
            }
            return jsonResponse(500, {
              error: 'Could not enable WhatsApp messaging. Please try again.',
            })
          }
        }
      } catch (e) {
        logNetworkError('WhatsApp subscribe network error', e)
        if (!isManual || reconnectChannelId) {
          if (createdChannel) {
            await admin.from('channels').delete().eq('id', channelId)
          }
          return jsonResponse(500, {
            error: 'Something went wrong. Please try again.',
          })
        }
      }
    }

    // 7. Register the phone number for Cloud API. Best-effort: numbers that are
    //    already registered return an error we can safely ignore. Skipped for
    //    the manual flow, where the number is already set up by hand.
    if (!isManual) {
      try {
        const res = await fetch(`${GRAPH}/${phoneNumberId}/register`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
        })
        if (!res.ok) {
          const json = (await res.json()) as GraphMutationResponse
          console.warn('WhatsApp register non-fatal error:', json.error?.code)
        }
      } catch (e) {
        logNetworkError('WhatsApp register network error', e)
      }
    }

    // 8. Replace credentials only after the new token passed validation and all
    //    fatal setup calls. This makes a failed reconnect non-destructive: the
    //    previous secret remains available for sends until a retry succeeds.
    const { error: secretError } = await admin.rpc(
      'upsert_channel_credentials',
      {
        p_channel_id: channelId,
        p_credentials: {
          access_token: accessToken,
          phone_number_id: phoneNumberId,
          ...(wabaId ? { waba_id: wabaId } : {}),
          ...(!isManual || previousPin ? { pin } : {}),
          ...(tokenExpiresAt ? { token_expires_at: tokenExpiresAt } : {}),
        },
        p_workspace_id: workspaceId,
      },
    )

    if (secretError) {
      console.error('Failed to store WhatsApp credentials:', secretError)
      if (createdChannel) {
        await admin.from('channels').delete().eq('id', channelId)
      }
      return jsonResponse(500, {
        error: 'Something went wrong. Please try again.',
      })
    }

    if (reconnectChannelId) {
      const { error: reactivateError } = await admin
        .from('channels')
        .update({ is_active: true })
        .eq('id', channelId)
        .eq('workspace_id', workspaceId)

      if (reactivateError) {
        console.error('Failed to reactivate WhatsApp channel:', reactivateError)
        return jsonResponse(500, {
          error:
            'Credentials were updated, but the channel could not be activated.',
        })
      }
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
