// whatsapp-webhook: single shared endpoint for every connected WhatsApp
// number. GET performs the Meta verification handshake; POST is
// signature-verified (X-Hub-Signature-256), routed to a channel by
// metadata.phone_number_id, split into logical events (messages + statuses),
// persisted as sanitized provider events, then normalized idempotently.
// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import {
  fingerprintFromPayload,
  sanitizeProviderPayload,
} from '../_shared/sanitize.ts'
import {
  claimProviderEvent,
  markEventFailed,
  markEventIgnored,
  markEventProcessed,
} from '../_shared/provider-events.ts'
import {
  applyReactionOps,
  insertStatusEvent,
  persistInboundMessage,
  resolveContactAndConversation,
  touchChannelActivity,
} from '../_shared/persist.ts'
import type { AttachmentInput, NormalizedMessageInput } from '../_shared/types.ts'
import {
  buildWhatsappProfile,
  normalizeWhatsappMessage,
  normalizeWhatsappReaction,
  normalizeWhatsappStatus,
  whatsappMessageFingerprint,
  whatsappStatusFingerprint,
  type ResolvedWhatsappMedia,
  type WhatsappChangeValue,
  type WhatsappMessage,
  type WhatsappWebhookBody,
} from './lib.ts'

const GRAPH_VERSION = Deno.env.get('WHATSAPP_GRAPH_VERSION') ?? 'v23.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`
const CHAT_MEDIA_BUCKET = 'chat-media'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function logErrorType(context: string, error: unknown): void {
  const detail = error instanceof Error ? error.name : typeof error
  console.error(`${context}: ${detail}`)
}

/** Constant-time hex string comparison. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

async function verifySignature(
  appSecret: string,
  rawBody: string,
  headerValue: string | null,
): Promise<boolean> {
  if (!headerValue?.startsWith('sha256=')) return false
  const provided = headerValue.slice('sha256='.length).trim()
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(rawBody),
  )
  const expected = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return timingSafeEqual(expected, provided)
}

function sanitizeFilenameSegment(name: string, maxLen: number): string {
  const cleaned = name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
  return cleaned.length > 0 ? cleaned : 'file'
}

function extensionFromMime(mime: string | null): string {
  switch (mime) {
    case 'image/jpeg':
      return '.jpg'
    case 'image/png':
      return '.png'
    case 'image/webp':
      return '.webp'
    case 'video/mp4':
      return '.mp4'
    case 'audio/ogg':
      return '.ogg'
    case 'audio/mpeg':
      return '.mp3'
    case 'audio/mp4':
      return '.m4a'
    case 'audio/amr':
      return '.amr'
    case 'application/pdf':
      return '.pdf'
    default:
      return ''
  }
}

function defaultMediaBaseName(
  kind: ResolvedWhatsappMedia['kind'],
  ext: string,
): string {
  switch (kind) {
    case 'image':
      return `photo${ext || '.jpg'}`
    case 'video':
      return `video${ext || '.mp4'}`
    case 'audio':
      return `audio${ext || '.ogg'}`
    case 'voice':
      return `voice${ext || '.ogg'}`
    case 'sticker':
      return `sticker${ext || '.webp'}`
    default:
      return `document${ext}`
  }
}

async function whatsappGetMediaUrl(
  token: string,
  mediaId: string,
): Promise<{ url: string; mime_type: string | null } | null> {
  try {
    const res = await fetch(`${GRAPH}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      console.error('whatsapp-webhook: get media url HTTP', res.status)
      return null
    }
    const data = (await res.json()) as { url?: string; mime_type?: string }
    if (!data.url) {
      console.error('whatsapp-webhook: media url missing')
      return null
    }
    return { url: data.url, mime_type: data.mime_type ?? null }
  } catch (e) {
    logErrorType('whatsapp-webhook: get media url failed', e)
    return null
  }
}

async function whatsappDownloadMedia(
  token: string,
  url: string,
): Promise<ArrayBuffer | null> {
  try {
    // The lookaside URL still requires the bearer token — it is not public.
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      console.error('whatsapp-webhook: media download HTTP', res.status)
      return null
    }
    return await res.arrayBuffer()
  } catch (e) {
    logErrorType('whatsapp-webhook: media download failed', e)
    return null
  }
}

async function uploadToChatMedia(
  supabase: SupabaseClient,
  objectPath: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<{ error: string | null }> {
  const body =
    bytes.byteLength === 0
      ? new Blob([], { type: contentType })
      : new Blob([new Uint8Array(bytes)], { type: contentType })
  const { error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .upload(objectPath, body, { contentType, upsert: false })
  if (!error) return { error: null }
  return { error: error.message ?? 'upload failed' }
}

interface MediaPipelineResult {
  attachment: AttachmentInput
  uploadFailed: boolean
  uploadError: string | null
}

function failedMediaResult(
  media: ResolvedWhatsappMedia,
  reason: string,
): MediaPipelineResult {
  return {
    attachment: {
      position: 0,
      kind: media.kind,
      providerMediaId: media.media_id,
      filename: media.filename,
      mimeType: media.mime_type,
      checksum: media.sha256,
      downloadStatus: 'failed',
      failureReason: reason,
      metadata: media.animated !== null ? { animated: media.animated } : {},
    },
    uploadFailed: true,
    uploadError: reason,
  }
}

async function processInboundMedia(args: {
  supabase: SupabaseClient
  token: string
  workspaceId: string
  conversationId: string
  messageId: string
  media: ResolvedWhatsappMedia
}): Promise<MediaPipelineResult> {
  const { supabase, token, workspaceId, conversationId, messageId, media } = args

  if (!token) {
    return failedMediaResult(media, 'missing_access_token')
  }

  const resolved = await whatsappGetMediaUrl(token, media.media_id)
  if (!resolved) {
    return failedMediaResult(media, 'whatsapp_get_media_failed')
  }

  const bytes = await whatsappDownloadMedia(token, resolved.url)
  if (!bytes || bytes.byteLength === 0) {
    return failedMediaResult(media, 'whatsapp_download_failed')
  }

  const contentType = media.mime_type ?? resolved.mime_type ?? undefined
  const ext = extensionFromMime(contentType ?? null)
  const rawFileName =
    media.filename?.trim() || defaultMediaBaseName(media.kind, ext)
  let safeFileName = sanitizeFilenameSegment(rawFileName, 180)
  if (!safeFileName.includes('.') && ext) {
    safeFileName = `${safeFileName}${ext}`
  }

  const effectiveType = contentType ?? 'application/octet-stream'

  let objectPath = [workspaceId, conversationId, messageId, safeFileName].join('/')
  let uploadResult = await uploadToChatMedia(supabase, objectPath, bytes, effectiveType)

  if (uploadResult.error && /exists|duplicate|already/i.test(uploadResult.error)) {
    const suffix = crypto.randomUUID().slice(0, 8)
    objectPath = [
      workspaceId,
      conversationId,
      messageId,
      `${suffix}-${safeFileName}`,
    ].join('/')
    uploadResult = await uploadToChatMedia(supabase, objectPath, bytes, effectiveType)
  }

  if (uploadResult.error) {
    console.error('whatsapp-webhook: storage upload failed', uploadResult.error)
    return failedMediaResult(media, 'storage_upload_failed')
  }

  return {
    attachment: {
      position: 0,
      kind: media.kind,
      providerMediaId: media.media_id,
      storagePath: objectPath,
      filename: safeFileName,
      mimeType: effectiveType,
      sizeBytes: bytes.byteLength,
      checksum: media.sha256,
      downloadStatus: 'stored',
      metadata: media.animated !== null ? { animated: media.animated } : {},
    },
    uploadFailed: false,
    uploadError: null,
  }
}

// ─── Statuses ────────────────────────────────────────────────────────────────

/**
 * Applies statuses[] as status events (the DB trigger advances
 * messages.status, never regressing). Returns true when a temporary failure
 * should trigger a Meta redelivery.
 */
async function applyStatuses(
  supabase: SupabaseClient,
  workspaceId: string,
  channelId: string,
  value: WhatsappChangeValue,
): Promise<boolean> {
  let hadTemporaryFailure = false
  for (const rawStatus of value.statuses ?? []) {
    const normalized = normalizeWhatsappStatus(rawStatus)
    if (!normalized) continue

    const claim = await claimProviderEvent(supabase, {
      workspaceId,
      channelId,
      provider: 'whatsapp',
      eventType: 'status',
      eventFingerprint: whatsappStatusFingerprint(
        normalized.externalId,
        rawStatus.status ?? 'unknown',
      ),
      payload: sanitizeProviderPayload(rawStatus as Record<string, unknown>),
      providerTimestamp: normalized.providerTimestamp,
    })
    if (claim.outcome === 'duplicate') continue
    if (claim.outcome === 'error') {
      hadTemporaryFailure = true
      continue
    }

    const { data: target } = await supabase
      .from('messages')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('external_id', normalized.externalId)
      .limit(1)
      .maybeSingle()

    if (!target) {
      await markEventIgnored(supabase, claim.eventId, 'status_target_missing')
      continue
    }

    const firstError =
      (normalized.metadata.provider_errors as
        | Array<Record<string, unknown>>
        | undefined)?.[0] ?? null

    await insertStatusEvent(supabase, {
      workspaceId,
      messageId: target.id,
      status: normalized.status,
      providerEventId: claim.eventId,
      providerTimestamp: normalized.providerTimestamp,
      errorCode: normalized.errorCode,
      errorType:
        typeof firstError?.title === 'string' ? (firstError.title as string) : null,
      metadata: normalized.metadata,
    })

    if (normalized.status === 'failed') {
      await touchChannelActivity(supabase, channelId, 'error', normalized.errorCode)
    }

    await markEventProcessed(supabase, claim.eventId, {
      createdMessageId: target.id,
    })
  }
  return hadTemporaryFailure
}

// ─── Inbound message ingestion ───────────────────────────────────────────────

async function ingestMessage(args: {
  supabase: SupabaseClient
  token: string
  channelId: string
  workspaceId: string
  message: WhatsappMessage
  contactName: string | null
}): Promise<'ok' | 'temporary_failure'> {
  const { supabase, token, channelId, workspaceId, message, contactName } = args

  const waId = message.from?.trim()
  const externalMessageId = message.id?.trim()
  if (!waId || !externalMessageId) return 'ok'

  const sanitizedPayload = sanitizeProviderPayload(
    message as Record<string, unknown>,
  )
  const isReaction = message.type === 'reaction'
  const claim = await claimProviderEvent(supabase, {
    workspaceId,
    channelId,
    provider: 'whatsapp',
    eventType: isReaction ? 'reaction' : 'message',
    eventFingerprint: whatsappMessageFingerprint(externalMessageId),
    payload: sanitizedPayload,
    providerTimestamp: message.timestamp
      ? new Date(Number(message.timestamp) * 1000).toISOString()
      : null,
  })
  if (claim.outcome === 'duplicate') return 'ok'
  if (claim.outcome === 'error') return 'temporary_failure'
  const eventId = claim.eventId

  // ── Reactions ──────────────────────────────────────────────────────────────
  if (isReaction) {
    const normalized = normalizeWhatsappReaction(message)
    if (!normalized) {
      await markEventIgnored(supabase, eventId, 'reaction_without_target')
      return 'ok'
    }
    const reactionIds = await applyReactionOps(
      supabase,
      {
        workspaceId,
        channelId,
        providerMessageId: normalized.targetProviderMessageId,
      },
      normalized.op ? [normalized.op] : [],
      {
        replaceOthers: {
          reactorExternalId: normalized.reactorExternalId,
          keepEmoji: normalized.op?.emoji,
        },
      },
    )
    await markEventProcessed(supabase, eventId, {
      createdRecordIds:
        reactionIds.length > 0 ? { message_reactions: reactionIds } : {},
    })
    return 'ok'
  }

  // ── Ordinary messages ──────────────────────────────────────────────────────
  const resolved = await resolveContactAndConversation(supabase, {
    workspaceId,
    channelId,
    channelType: 'whatsapp',
    externalId: waId,
    externalName: contactName ?? waId,
    profile: buildWhatsappProfile({
      waId,
      profileName: contactName,
      referral: message.referral ?? null,
    }),
    phone: `+${waId}`,
    createIfMissing: true,
  })
  if (!resolved) {
    await markEventFailed(supabase, eventId, 'temporary', 'contact_resolution_failed')
    return 'temporary_failure'
  }
  const { conversationId } = resolved

  const normalized = normalizeWhatsappMessage(message)
  const messageId = crypto.randomUUID()
  const attachments: AttachmentInput[] = []

  if (normalized.media) {
    let result: MediaPipelineResult
    try {
      result = await processInboundMedia({
        supabase,
        token,
        workspaceId,
        conversationId,
        messageId,
        media: normalized.media,
      })
    } catch (e) {
      logErrorType('whatsapp-webhook: media pipeline error', e)
      result = failedMediaResult(normalized.media, 'media_pipeline_failed')
    }
    attachments.push(result.attachment)
    // Preserve the existing frontend metadata contract for media messages.
    normalized.metadata.whatsapp = {
      ...(normalized.metadata.whatsapp as Record<string, unknown> | undefined),
      media_id: normalized.media.media_id,
    }
    normalized.metadata.upload_failed = result.uploadFailed
    if (result.uploadError) {
      normalized.metadata.upload_error = result.uploadError
    }
  }

  const persisted = await persistInboundMessage(supabase, messageId, {
    workspaceId,
    conversationId,
    channelId,
    externalId: externalMessageId,
    type: normalized.type,
    content: normalized.content,
    externalReplyToId: normalized.externalReplyToId,
    providerTimestamp: normalized.providerTimestamp,
    metadata: normalized.metadata,
    attachments,
  } satisfies NormalizedMessageInput)

  if (persisted.outcome === 'duplicate') {
    await markEventIgnored(supabase, eventId, 'duplicate_message')
    return 'ok'
  }
  if (persisted.outcome === 'error') {
    await markEventFailed(supabase, eventId, 'temporary', persisted.message)
    return 'temporary_failure'
  }

  const { error: convUpdateError } = await supabase
    .from('conversations')
    .update({ status: 'open' })
    .eq('id', conversationId)
    .neq('status', 'open')
  if (convUpdateError) {
    console.error('whatsapp-webhook: conversation update failed', convUpdateError)
  }

  // Fan out desktop/push notifications to the recipients created by the
  // create_message_notifications trigger. Fire-and-forget: push failures must
  // never break message ingestion.
  try {
    await supabase.functions.invoke('send-message-push', {
      body: { messageId },
      headers: {
        Authorization: `Bearer ${Deno.env.get('PUSH_DISPATCH_SECRET') ?? ''}`,
      },
    })
  } catch (pushError) {
    console.error('whatsapp-webhook: push dispatch failed', pushError)
  }

  await markEventProcessed(supabase, eventId, { createdMessageId: messageId })
  return 'ok'
}

// ─── Main handler ────────────────────────────────────────────────────────────

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)

    // GET — Meta verification handshake.
    if (req.method === 'GET') {
      const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN')
      const mode = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')
      if (mode === 'subscribe' && verifyToken && token === verifyToken) {
        return new Response(challenge ?? '', { status: 200 })
      }
      return new Response('Forbidden', { status: 403 })
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET')
    if (!appSecret) {
      console.error('whatsapp-webhook: missing WHATSAPP_APP_SECRET')
      return new Response('Server misconfiguration', { status: 500 })
    }

    const rawBody = await req.text()
    const signatureOk = await verifySignature(
      appSecret,
      rawBody,
      req.headers.get('x-hub-signature-256'),
    )
    if (!signatureOk) {
      return new Response('Unauthorized', { status: 401 })
    }

    let payload: WhatsappWebhookBody
    try {
      payload = JSON.parse(rawBody) as WhatsappWebhookBody
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let hadTemporaryFailure = false

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue
        const value = change.value
        const phoneNumberId = value?.metadata?.phone_number_id?.trim()
        if (!phoneNumberId) continue

        const { data: channelRows, error: lookupError } = await supabase.rpc(
          'get_whatsapp_channel_by_phone',
          { p_phone_number_id: phoneNumberId },
        )

        if (lookupError) {
          console.error('whatsapp-webhook: channel lookup failed', lookupError)
          hadTemporaryFailure = true
          continue
        }

        const channel = Array.isArray(channelRows) ? channelRows[0] : null
        if (!channel) continue

        const workspaceId = channel.workspace_id as string
        const channelId = channel.channel_id as string

        await touchChannelActivity(supabase, channelId, 'webhook')

        // Statuses can arrive for inactive channels too; still record them.
        if (value?.statuses?.length) {
          const statusFailure = await applyStatuses(
            supabase,
            workspaceId,
            channelId,
            value,
          )
          hadTemporaryFailure = hadTemporaryFailure || statusFailure
        }

        if (!channel.is_active) continue
        if (!value?.messages?.length) continue

        const nameByWaId = new Map<string, string>()
        for (const contact of value.contacts ?? []) {
          if (contact.wa_id && contact.profile?.name) {
            nameByWaId.set(contact.wa_id, contact.profile.name)
          }
        }

        let token = ''
        const { data: credentials, error: secretError } = await supabase.rpc(
          'get_channel_credentials',
          { p_channel_id: channelId },
        )
        if (secretError) {
          console.error('whatsapp-webhook: credential load failed', secretError)
        } else if (
          credentials &&
          typeof credentials === 'object' &&
          !Array.isArray(credentials)
        ) {
          const rawToken = (credentials as Record<string, unknown>).access_token
          token = typeof rawToken === 'string' ? rawToken : ''
        }

        for (const message of value.messages) {
          const contactName = message.from
            ? (nameByWaId.get(message.from) ?? null)
            : null
          try {
            const result = await ingestMessage({
              supabase,
              token,
              channelId,
              workspaceId,
              message,
              contactName,
            })
            if (result === 'temporary_failure') {
              hadTemporaryFailure = true
            }
          } catch (e) {
            logErrorType('whatsapp-webhook: ingest failed', e)
            hadTemporaryFailure = true
          }
        }
      }
    }

    // Non-200 makes Meta redeliver the batch; fingerprints dedup everything
    // that already succeeded.
    if (hadTemporaryFailure) {
      return new Response('Temporary failure', { status: 500 })
    }
    return new Response('OK', { status: 200 })
  },
}
