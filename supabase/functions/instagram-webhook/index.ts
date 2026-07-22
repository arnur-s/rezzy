// instagram-webhook.ts
// Single shared endpoint for every connected Instagram account. GET performs the
// Meta verification handshake; POST is signature-verified (X-Hub-Signature-256),
// routed to a channel by entry.id -> channels.provider_account_id, and turned
// into inbound messages. messaging_seen (read.mid) advances outbound state.
// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  extensionFromMime,
  extractReadMid,
  type IgDbMessageType,
  type IgMessage,
  type IgMessagingEvent,
  type IgWebhookBody,
  mimeToDbType,
  resolveInstagramMessage,
  sanitizeFilenameSegment,
  verifySignature,
} from './lib.ts'

const GRAPH_VERSION = Deno.env.get('INSTAGRAM_GRAPH_VERSION') ?? 'v25.0'
const IG_GRAPH = `https://graph.instagram.com/${GRAPH_VERSION}`
const CHAT_MEDIA_BUCKET = 'chat-media'
// The chat-media bucket caps objects at 25 MB; reject anything larger up front.
const MAX_MEDIA_BYTES = 25 * 1024 * 1024

function logErrorType(context: string, error: unknown): void {
  const detail = error instanceof Error ? error.name : typeof error
  console.error(`${context}: ${detail}`)
}

interface SenderProfile {
  name?: string
  username?: string
  profile_pic?: string
}

async function fetchSenderProfile(
  token: string,
  igsid: string,
): Promise<SenderProfile | null> {
  if (!token) return null
  try {
    const params = new URLSearchParams({
      fields: 'name,username,profile_pic',
      access_token: token,
    })
    const res = await fetch(`${IG_GRAPH}/${igsid}?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    return data && typeof data === 'object' ? (data as SenderProfile) : null
  } catch (e) {
    logErrorType('instagram-webhook: sender profile fetch failed', e)
    return null
  }
}

async function downloadInstagramMedia(
  url: string,
  token: string,
): Promise<{ bytes: ArrayBuffer; mime: string | null } | null> {
  const attempt = (useAuth: boolean) =>
    fetch(
      url,
      useAuth && token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    )
  try {
    // Instagram attachment URLs are pre-signed CDN links; retry with the token
    // only if the CDN rejects the anonymous request.
    let res = await attempt(false)
    if ((res.status === 401 || res.status === 403) && token) {
      res = await attempt(true)
    }
    if (!res.ok) {
      console.error('instagram-webhook: media download HTTP', res.status)
      return null
    }
    const lengthHeader = res.headers.get('content-length')
    if (lengthHeader && Number(lengthHeader) > MAX_MEDIA_BYTES) {
      console.error('instagram-webhook: media exceeds size limit (header)')
      return null
    }
    const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || null
    const bytes = await res.arrayBuffer()
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_BYTES) {
      console.error('instagram-webhook: media empty or too large')
      return null
    }
    return { bytes, mime }
  } catch (e) {
    logErrorType('instagram-webhook: media download failed', e)
    return null
  }
}

async function uploadToChatMedia(
  supabase: ReturnType<typeof createClient>,
  objectPath: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<{ error: string | null }> {
  const body = new Blob([new Uint8Array(bytes)], { type: contentType })
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
    console.error('instagram-webhook: storage cleanup failed', error.message)
  }
}

function defaultMediaBaseName(
  dbType: Exclude<IgDbMessageType, 'text'>,
  ext: string,
): string {
  switch (dbType) {
    case 'image':
      return `photo${ext || '.jpg'}`
    case 'video':
      return `video${ext || '.mp4'}`
    case 'audio':
      return `audio${ext || '.m4a'}`
    default:
      return `attachment${ext}`
  }
}

interface InboundMediaResult {
  dbType: Exclude<IgDbMessageType, 'text'>
  mediaUrl: string | null
  mime: string | null
  size: number | null
  filename: string | null
  uploadedObjectPath: string | null
  uploadFailed: boolean
  uploadError?: string
}

async function processInboundMedia(args: {
  supabase: ReturnType<typeof createClient>
  token: string
  url: string
  attachmentType: string
  workspaceId: string
  conversationId: string
  messageId: string
}): Promise<InboundMediaResult> {
  const { supabase, token, url, attachmentType, workspaceId, conversationId, messageId } =
    args

  const downloaded = await downloadInstagramMedia(url, token)
  if (!downloaded) {
    return {
      dbType: mimeToDbType(null, attachmentType),
      mediaUrl: null,
      mime: null,
      size: null,
      filename: null,
      uploadedObjectPath: null,
      uploadFailed: true,
      uploadError: 'download_failed',
    }
  }

  const dbType = mimeToDbType(downloaded.mime, attachmentType)
  const ext = extensionFromMime(downloaded.mime)
  let safeFileName = sanitizeFilenameSegment(
    defaultMediaBaseName(dbType, ext),
    180,
  )
  if (!safeFileName.includes('.') && ext) safeFileName = `${safeFileName}${ext}`
  const effectiveType = downloaded.mime ?? 'application/octet-stream'

  let objectPath = [workspaceId, conversationId, messageId, safeFileName].join('/')
  let uploadResult = await uploadToChatMedia(
    supabase,
    objectPath,
    downloaded.bytes,
    effectiveType,
  )
  if (uploadResult.error && /exists|duplicate|already/i.test(uploadResult.error)) {
    const suffix = crypto.randomUUID().slice(0, 8)
    objectPath = [workspaceId, conversationId, messageId, `${suffix}-${safeFileName}`].join('/')
    uploadResult = await uploadToChatMedia(
      supabase,
      objectPath,
      downloaded.bytes,
      effectiveType,
    )
  }
  if (uploadResult.error) {
    console.error('instagram-webhook: storage upload failed', uploadResult.error)
    return {
      dbType,
      mediaUrl: null,
      mime: downloaded.mime,
      size: downloaded.bytes.byteLength,
      filename: null,
      uploadedObjectPath: null,
      uploadFailed: true,
      uploadError: 'storage_upload_failed',
    }
  }

  return {
    dbType,
    mediaUrl: objectPath,
    mime: effectiveType,
    size: downloaded.bytes.byteLength,
    filename: safeFileName,
    uploadedObjectPath: objectPath,
    uploadFailed: false,
  }
}

async function applyReadEvent(
  supabase: ReturnType<typeof createClient>,
  channelId: string,
  workspaceId: string,
  event: IgMessagingEvent,
): Promise<void> {
  const mid = extractReadMid(event)
  if (!mid) return
  const { error } = await supabase.rpc('mark_outbound_message_read', {
    p_channel_id: channelId,
    p_workspace_id: workspaceId,
    p_external_id: mid,
  })
  if (error) console.error('instagram-webhook: mark read failed', error)
}

async function ingestMessage(args: {
  supabase: ReturnType<typeof createClient>
  token: string
  channelId: string
  workspaceId: string
  senderId: string
  message: IgMessage
}): Promise<void> {
  const { supabase, token, channelId, workspaceId, senderId, message } = args

  const mid = message.mid?.trim()
  if (!mid) return

  const { data: existing } = await supabase
    .from('messages')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('external_id', mid)
    .maybeSingle()
  if (existing) return

  const profile = await fetchSenderProfile(token, senderId)
  const displayName = profile?.name ?? profile?.username ?? null
  const externalName = profile?.username ?? profile?.name ?? null
  const avatarUrl = profile?.profile_pic ?? null

  const { data: resolvedRows, error: resolveError } = await supabase.rpc(
    'resolve_instagram_conversation',
    {
      p_channel_id: channelId,
      p_external_id: senderId,
      p_external_name: externalName,
      p_name: displayName,
      p_avatar_url: avatarUrl,
    },
  )
  if (resolveError) {
    console.error('instagram-webhook: resolve conversation failed', resolveError)
    return
  }
  const resolved = Array.isArray(resolvedRows) ? resolvedRows[0] : resolvedRows
  const conversationId =
    resolved && typeof resolved.conversation_id === 'string'
      ? resolved.conversation_id
      : ''
  if (!conversationId) {
    console.error('instagram-webhook: resolve returned no conversation')
    return
  }

  const messageId = crypto.randomUUID()
  const parsed = resolveInstagramMessage(message)

  let dbType: IgDbMessageType = 'text'
  let metadata: Record<string, unknown> = { instagram: { mid } }
  let mediaUrl: string | null = null
  let mediaMime: string | null = null
  let mediaSize: number | null = null
  let mediaFilename: string | null = null
  let uploadedObjectPath: string | null = null

  if (parsed.attachment) {
    let result: InboundMediaResult
    try {
      result = await processInboundMedia({
        supabase,
        token,
        url: parsed.attachment.url,
        attachmentType: parsed.attachment.type,
        workspaceId,
        conversationId,
        messageId,
      })
    } catch (e) {
      logErrorType('instagram-webhook: media pipeline error', e)
      result = {
        dbType: mimeToDbType(null, parsed.attachment.type),
        mediaUrl: null,
        mime: null,
        size: null,
        filename: null,
        uploadedObjectPath: null,
        uploadFailed: true,
        uploadError: 'media_pipeline_failed',
      }
    }
    dbType = result.dbType
    mediaUrl = result.mediaUrl
    mediaMime = result.mime
    mediaSize = result.size
    mediaFilename = result.filename
    uploadedObjectPath = result.uploadedObjectPath
    metadata = {
      instagram: { mid, attachment_type: parsed.attachment.type },
      ...(result.uploadFailed
        ? { upload_failed: true, upload_error: result.uploadError }
        : {}),
    }
  }

  const { error: insertError } = await supabase.from('messages').insert({
    id: messageId,
    workspace_id: workspaceId,
    conversation_id: conversationId,
    external_id: mid,
    direction: 'inbound',
    type: dbType,
    content: parsed.content,
    sender_id: null,
    status: 'delivered',
    media_url: mediaUrl,
    media_mime_type: mediaMime,
    media_size: mediaSize,
    media_filename: mediaFilename,
    metadata,
  })

  if (insertError) {
    // A duplicate webhook delivery races on messages_unique_external_id; treat
    // the unique violation as a successful de-dup.
    if (uploadedObjectPath) await removeChatMediaObject(supabase, uploadedObjectPath)
    if (insertError.code !== '23505') {
      console.error('instagram-webhook: failed to insert message', insertError)
    }
    return
  }

  // Fan out desktop/push notifications (fire-and-forget; never break ingestion).
  try {
    await supabase.functions.invoke('send-message-push', {
      body: { messageId },
      headers: {
        Authorization: `Bearer ${Deno.env.get('PUSH_DISPATCH_SECRET') ?? ''}`,
      },
    })
  } catch (pushError) {
    console.error('instagram-webhook: push dispatch failed', pushError)
  }
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)

    // GET — Meta verification handshake.
    if (req.method === 'GET') {
      const verifyToken = Deno.env.get('INSTAGRAM_VERIFY_TOKEN')
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

    const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET')
    if (!appSecret) {
      console.error('instagram-webhook: missing INSTAGRAM_APP_SECRET')
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

    let payload: IgWebhookBody
    try {
      payload = JSON.parse(rawBody) as IgWebhookBody
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }
    // Acknowledge non-Instagram objects so Meta stops retrying.
    if (payload.object !== 'instagram') {
      return new Response('OK', { status: 200 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    for (const entry of payload.entry ?? []) {
      const igAccountId = entry.id?.trim()
      if (!igAccountId) continue

      const { data: channel, error: lookupError } = await supabase
        .from('channels')
        .select('id, workspace_id, is_active')
        .eq('type', 'instagram')
        .eq('provider_account_id', igAccountId)
        .maybeSingle()

      if (lookupError) {
        console.error('instagram-webhook: channel lookup failed', lookupError)
        continue
      }
      if (!channel) continue

      const channelId = channel.id as string
      const workspaceId = channel.workspace_id as string

      let token = ''
      const { data: credentials } = await supabase.rpc(
        'get_channel_credentials',
        { p_channel_id: channelId },
      )
      if (
        credentials &&
        typeof credentials === 'object' &&
        !Array.isArray(credentials)
      ) {
        const raw = (credentials as Record<string, unknown>).access_token
        token = typeof raw === 'string' ? raw : ''
      }

      for (const event of entry.messaging ?? []) {
        // Read receipts apply to outbound history regardless of channel state.
        if (event.read) {
          await applyReadEvent(supabase, channelId, workspaceId, event)
          continue
        }
        // Reactions are acknowledged but not stored (no clean model fit).
        if (event.reaction) continue

        const message = event.message
        if (!message || message.is_echo || message.is_deleted) continue
        if (!channel.is_active) continue

        const senderId = event.sender?.id?.trim()
        if (!senderId) continue

        try {
          await ingestMessage({
            supabase,
            token,
            channelId,
            workspaceId,
            senderId,
            message,
          })
        } catch (e) {
          logErrorType('instagram-webhook: ingest failed', e)
        }
      }
    }

    return new Response('OK', { status: 200 })
  },
}
