// whatsapp-webhook.ts
// Single shared endpoint for every connected WhatsApp number. GET performs the
// Meta verification handshake; POST is signature-verified (X-Hub-Signature-256),
// routed to a channel by metadata.phone_number_id, and turned into inbound
// messages. statuses[] events advance outbound message delivery state.
// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const GRAPH_VERSION = Deno.env.get('WHATSAPP_GRAPH_VERSION') ?? 'v23.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`
const CHAT_MEDIA_BUCKET = 'chat-media'

// ─── WhatsApp types ───────────────────────────────────────────────────────────

interface WhatsappMediaObject {
  id: string
  mime_type?: string
  sha256?: string
  caption?: string
  filename?: string
  voice?: boolean
  animated?: boolean
}

interface WhatsappLocation {
  latitude?: number
  longitude?: number
  name?: string
  address?: string
}

interface WhatsappMessage {
  from?: string
  id?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
  image?: WhatsappMediaObject
  video?: WhatsappMediaObject
  audio?: WhatsappMediaObject
  document?: WhatsappMediaObject
  sticker?: WhatsappMediaObject
  location?: WhatsappLocation
}

interface WhatsappStatus {
  id?: string
  status?: string
  recipient_id?: string
}

interface WhatsappContact {
  wa_id?: string
  profile?: { name?: string }
}

interface WhatsappChangeValue {
  metadata?: { phone_number_id?: string; display_phone_number?: string }
  contacts?: WhatsappContact[]
  messages?: WhatsappMessage[]
  statuses?: WhatsappStatus[]
}

interface WhatsappChange {
  field?: string
  value?: WhatsappChangeValue
}

interface WhatsappEntry {
  id?: string
  changes?: WhatsappChange[]
}

interface WhatsappWebhookBody {
  object?: string
  entry?: WhatsappEntry[]
}

type DbMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'sticker'

interface ResolvedMedia {
  dbType: Exclude<DbMessageType, 'text'>
  media_id: string
  mime_type: string | null
  filename: string | null
}

interface ResolvedMessage {
  dbType: DbMessageType
  content: string | null
  media: ResolvedMedia | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function resolveMediaObject(
  dbType: ResolvedMedia['dbType'],
  media: WhatsappMediaObject,
  fallbackMime: string,
): ResolvedMedia {
  return {
    dbType,
    media_id: media.id,
    mime_type: media.mime_type ?? fallbackMime,
    filename: media.filename ?? null,
  }
}

function resolveWhatsappMessage(message: WhatsappMessage): ResolvedMessage {
  switch (message.type) {
    case 'text':
      return {
        dbType: 'text',
        content: message.text?.body ?? null,
        media: null,
      }
    case 'image':
      return message.image?.id
        ? {
            dbType: 'image',
            content: message.image.caption ?? null,
            media: resolveMediaObject('image', message.image, 'image/jpeg'),
          }
        : { dbType: 'text', content: null, media: null }
    case 'video':
      return message.video?.id
        ? {
            dbType: 'video',
            content: message.video.caption ?? null,
            media: resolveMediaObject('video', message.video, 'video/mp4'),
          }
        : { dbType: 'text', content: null, media: null }
    case 'audio':
      return message.audio?.id
        ? {
            dbType: message.audio.voice ? 'voice' : 'audio',
            content: null,
            media: resolveMediaObject(
              message.audio.voice ? 'voice' : 'audio',
              message.audio,
              'audio/ogg',
            ),
          }
        : { dbType: 'text', content: null, media: null }
    case 'document':
      return message.document?.id
        ? {
            dbType: 'document',
            content: message.document.caption ?? null,
            media: resolveMediaObject(
              'document',
              message.document,
              'application/octet-stream',
            ),
          }
        : { dbType: 'text', content: null, media: null }
    case 'sticker':
      return message.sticker?.id
        ? {
            dbType: 'sticker',
            content: null,
            media: resolveMediaObject('sticker', message.sticker, 'image/webp'),
          }
        : { dbType: 'text', content: null, media: null }
    case 'location': {
      const loc = message.location
      const parts = [loc?.name, loc?.address].filter(Boolean)
      const summary =
        parts.length > 0
          ? parts.join(' — ')
          : loc?.latitude != null && loc?.longitude != null
            ? `${loc.latitude}, ${loc.longitude}`
            : null
      return { dbType: 'text', content: summary, media: null }
    }
    default:
      // Unsupported (contacts, interactive, button, reactions, …): record a row
      // so the conversation still advances, without inventing content.
      return { dbType: 'text', content: null, media: null }
  }
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
  dbType: ResolvedMedia['dbType'],
  ext: string,
): string {
  switch (dbType) {
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
  supabase: ReturnType<typeof createClient>,
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

async function removeChatMediaObject(
  supabase: ReturnType<typeof createClient>,
  objectPath: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .remove([objectPath])
  if (error) {
    console.error('whatsapp-webhook: storage cleanup failed', error.message)
  }
}

interface InboundMediaResult {
  metadata: Record<string, unknown>
  mediaUrl: string | null
  mediaMimeType: string | null
  mediaSize: number | null
  mediaFilename: string | null
  uploadedObjectPath: string | null
}

function failedMediaResult(
  media: ResolvedMedia,
  uploadError: string,
): InboundMediaResult {
  return {
    metadata: {
      whatsapp: { media_id: media.media_id },
      upload_failed: true,
      upload_error: uploadError,
    },
    mediaUrl: null,
    mediaMimeType: media.mime_type,
    mediaSize: null,
    mediaFilename: media.filename,
    uploadedObjectPath: null,
  }
}

async function processInboundMedia(args: {
  supabase: ReturnType<typeof createClient>
  token: string
  workspaceId: string
  conversationId: string
  messageId: string
  media: ResolvedMedia
}): Promise<InboundMediaResult> {
  const { supabase, token, workspaceId, conversationId, messageId, media } =
    args

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
    media.filename?.trim() || defaultMediaBaseName(media.dbType, ext)
  let safeFileName = sanitizeFilenameSegment(rawFileName, 180)
  if (!safeFileName.includes('.') && ext) {
    safeFileName = `${safeFileName}${ext}`
  }

  const effectiveType = contentType ?? 'application/octet-stream'

  let objectPath = [workspaceId, conversationId, messageId, safeFileName].join(
    '/',
  )
  let uploadResult = await uploadToChatMedia(
    supabase,
    objectPath,
    bytes,
    effectiveType,
  )

  if (uploadResult.error && /exists|duplicate|already/i.test(uploadResult.error)) {
    const suffix = crypto.randomUUID().slice(0, 8)
    objectPath = [
      workspaceId,
      conversationId,
      messageId,
      `${suffix}-${safeFileName}`,
    ].join('/')
    uploadResult = await uploadToChatMedia(
      supabase,
      objectPath,
      bytes,
      effectiveType,
    )
  }

  if (uploadResult.error) {
    console.error('whatsapp-webhook: storage upload failed', uploadResult.error)
    return failedMediaResult(media, 'storage_upload_failed')
  }

  return {
    metadata: { whatsapp: { media_id: media.media_id }, upload_failed: false },
    mediaUrl: objectPath,
    mediaMimeType: effectiveType,
    mediaSize: bytes.byteLength,
    mediaFilename: safeFileName,
    uploadedObjectPath: objectPath,
  }
}

// ─── Delivery-status progression ────────────────────────────────────────────

const STATUS_RANK: Record<string, number> = {
  sent: 1,
  delivered: 2,
  read: 3,
}

async function applyStatuses(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  statuses: WhatsappStatus[],
): Promise<void> {
  for (const status of statuses) {
    const externalId = status.id
    const next = status.status
    if (!externalId || !next) continue

    const { data: existing } = await supabase
      .from('messages')
      .select('id, status')
      .eq('workspace_id', workspaceId)
      .eq('external_id', externalId)
      .maybeSingle()

    if (!existing) continue
    const current = existing.status as string | null

    if (next === 'failed') {
      if (current === 'failed') continue
      await supabase
        .from('messages')
        .update({ status: 'failed' })
        .eq('id', existing.id)
      continue
    }

    const nextRank = STATUS_RANK[next]
    const currentRank = current ? (STATUS_RANK[current] ?? 0) : 0
    // Only advance forward — never downgrade a read message back to delivered.
    if (!nextRank || nextRank <= currentRank) continue

    await supabase
      .from('messages')
      .update({ status: next })
      .eq('id', existing.id)
  }
}

// ─── Inbound message ingestion ────────────────────────────────────────────────

async function ingestMessage(args: {
  supabase: ReturnType<typeof createClient>
  token: string
  channelId: string
  workspaceId: string
  message: WhatsappMessage
  contactName: string
}): Promise<void> {
  const { supabase, token, channelId, workspaceId, message, contactName } = args

  const waId = message.from?.trim()
  const externalMessageId = message.id?.trim()
  if (!waId || !externalMessageId) return

  const { data: existingMessage } = await supabase
    .from('messages')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('external_id', externalMessageId)
    .maybeSingle()

  if (existingMessage) return

  const { data: existingContactChannel } = await supabase
    .from('contact_channels')
    .select('contact_id, contacts!inner(workspace_id)')
    .eq('channel_type', 'whatsapp')
    .eq('external_id', waId)
    .eq('contacts.workspace_id', workspaceId)
    .maybeSingle()

  let contactId: string

  if (existingContactChannel) {
    contactId = existingContactChannel.contact_id as string
    await supabase
      .from('contact_channels')
      .update({ external_name: contactName })
      .eq('contact_id', contactId)
      .eq('channel_type', 'whatsapp')
      .eq('external_id', waId)
  } else {
    const { data: newContact, error: contactError } = await supabase
      .from('contacts')
      .insert({ workspace_id: workspaceId, name: contactName, status: 'new' })
      .select('id')
      .single()

    if (contactError || !newContact) {
      console.error('whatsapp-webhook: failed to create contact', contactError)
      return
    }

    contactId = newContact.id

    await supabase.from('contact_channels').insert({
      workspace_id: workspaceId,
      contact_id: contactId,
      channel_type: 'whatsapp',
      external_id: waId,
      external_name: contactName,
    })
  }

  const { data: existingConversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId)
    .eq('channel_id', channelId)
    .maybeSingle()

  let conversationId: string

  if (existingConversation) {
    conversationId = existingConversation.id as string
  } else {
    const { data: newConversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        workspace_id: workspaceId,
        contact_id: contactId,
        channel_id: channelId,
        status: 'open',
        unread_count: 0,
      })
      .select('id')
      .single()

    if (convError || !newConversation) {
      console.error('whatsapp-webhook: failed to create conversation', convError)
      return
    }

    conversationId = newConversation.id
  }

  const resolved = resolveWhatsappMessage(message)
  const messageId = crypto.randomUUID()

  let metadata: Record<string, unknown> = {}
  let mediaUrl: string | null = null
  let mediaMimeType: string | null = null
  let mediaSize: number | null = null
  let mediaFilename: string | null = null
  let uploadedObjectPath: string | null = null

  if (resolved.media) {
    let result: InboundMediaResult
    try {
      result = await processInboundMedia({
        supabase,
        token,
        workspaceId,
        conversationId,
        messageId,
        media: resolved.media,
      })
    } catch (e) {
      logErrorType('whatsapp-webhook: media pipeline error', e)
      result = failedMediaResult(resolved.media, 'media_pipeline_failed')
    }
    metadata = result.metadata
    mediaUrl = result.mediaUrl
    mediaMimeType = result.mediaMimeType
    mediaSize = result.mediaSize
    mediaFilename = result.mediaFilename
    uploadedObjectPath = result.uploadedObjectPath
  }

  const insertRow: Record<string, unknown> = {
    id: messageId,
    workspace_id: workspaceId,
    conversation_id: conversationId,
    external_id: externalMessageId,
    direction: 'inbound',
    type: resolved.dbType,
    content: resolved.content,
    sender_id: null,
    status: 'delivered',
    media_url: mediaUrl,
    media_mime_type: mediaMimeType,
    media_size: mediaSize,
    media_filename: mediaFilename,
  }
  if (Object.keys(metadata).length > 0) {
    insertRow.metadata = metadata
  }

  const { error: messageError } = await supabase
    .from('messages')
    .insert(insertRow)

  if (messageError) {
    console.error('whatsapp-webhook: failed to insert message', messageError)
    if (uploadedObjectPath) {
      await removeChatMediaObject(supabase, uploadedObjectPath)
    }
    return
  }

  const { error: convUpdateError } = await supabase
    .from('conversations')
    .update({ status: 'open' })
    .eq('id', conversationId)
    .neq('status', 'open')

  if (convUpdateError) {
    console.error('whatsapp-webhook: conversation update failed', convUpdateError)
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

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
          continue
        }

        const channel = Array.isArray(channelRows) ? channelRows[0] : null
        if (!channel) continue

        const workspaceId = channel.workspace_id as string
        const channelId = channel.channel_id as string

        // Statuses can arrive for inactive channels too; still record them.
        if (value?.statuses?.length) {
          await applyStatuses(supabase, workspaceId, value.statuses)
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
            ? (nameByWaId.get(message.from) ?? message.from)
            : 'Unknown'
          try {
            await ingestMessage({
              supabase,
              token,
              channelId,
              workspaceId,
              message,
              contactName,
            })
          } catch (e) {
            logErrorType('whatsapp-webhook: ingest failed', e)
          }
        }
      }
    }

    return new Response('OK', { status: 200 })
  },
}
