// instagram-webhook.ts
// Single shared endpoint for every connected Instagram account. GET performs the
// Meta verification handshake; POST is signature-verified (X-Hub-Signature-256),
// routed to a channel by entry.id -> channels.provider_account_id, split into
// logical events (messages, reactions, reads, deletions), persisted as
// sanitized provider events, then normalized idempotently.
// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import {
  extensionFromMime,
  extractReadMid,
  igMessageFingerprint,
  igReactionFingerprint,
  igReadFingerprint,
  type IgMessage,
  type IgMessagingEvent,
  type IgWebhookBody,
  mimeToDbType,
  normalizeInstagramMessage,
  sanitizeFilenameSegment,
  verifySignature,
} from './lib.ts'
import { sanitizeProviderPayload } from '../_shared/sanitize.ts'
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
  touchChannelActivity,
} from '../_shared/persist.ts'
import { instagramReactionOp } from '../_shared/reactions.ts'
import type {
  AttachmentInput,
  NormalizedMessageType,
} from '../_shared/types.ts'

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
  is_verified_user?: boolean
  follower_count?: number
  is_user_follow_business?: boolean
  is_business_follow_user?: boolean
}

const PROFILE_FIELDS_FULL =
  'name,username,profile_pic,is_verified_user,follower_count,is_user_follow_business,is_business_follow_user'
const PROFILE_FIELDS_BASIC = 'name,username,profile_pic'

async function fetchSenderProfile(
  token: string,
  igsid: string,
): Promise<SenderProfile | null> {
  if (!token) return null
  const request = async (fields: string): Promise<SenderProfile | null> => {
    const params = new URLSearchParams({ fields, access_token: token })
    const res = await fetch(`${IG_GRAPH}/${igsid}?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    return data && typeof data === 'object' ? (data as SenderProfile) : null
  }
  try {
    // Extended identity fields need additional permissions on some apps; fall
    // back to the basic profile when the full request is rejected.
    return (
      (await request(PROFILE_FIELDS_FULL)) ??
      (await request(PROFILE_FIELDS_BASIC))
    )
  } catch (e) {
    logErrorType('instagram-webhook: sender profile fetch failed', e)
    return null
  }
}

function buildInstagramProfile(profile: SenderProfile | null): Record<string, unknown> {
  if (!profile) return {}
  return {
    ...(profile.username ? { username: profile.username } : {}),
    ...(profile.name ? { name: profile.name } : {}),
    ...(profile.profile_pic ? { profile_pic: profile.profile_pic } : {}),
    ...(profile.is_verified_user !== undefined
      ? { is_verified_user: profile.is_verified_user }
      : {}),
    ...(typeof profile.follower_count === 'number'
      ? { follower_count: profile.follower_count }
      : {}),
    ...(profile.is_user_follow_business !== undefined
      ? { is_user_follow_business: profile.is_user_follow_business }
      : {}),
    ...(profile.is_business_follow_user !== undefined
      ? { is_business_follow_user: profile.is_business_follow_user }
      : {}),
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
  supabase: SupabaseClient,
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

function defaultMediaBaseName(
  kind: 'image' | 'video' | 'audio' | 'document',
  ext: string,
): string {
  switch (kind) {
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

/**
 * Downloads one attachment into private storage. Failures become failed
 * attachment rows — they never reject the message.
 */
async function processAttachment(args: {
  supabase: SupabaseClient
  token: string
  position: number
  attachment: { type: string; url: string | null; title: string | null; stickerId: string | null }
  workspaceId: string
  conversationId: string
  messageId: string
}): Promise<AttachmentInput> {
  const { supabase, token, position, attachment, workspaceId, conversationId, messageId } =
    args

  const baseMetadata: Record<string, unknown> = {
    attachment_type: attachment.type,
    ...(attachment.title ? { title: attachment.title } : {}),
    ...(attachment.stickerId ? { sticker_id: attachment.stickerId } : {}),
  }

  if (!attachment.url) {
    return {
      position,
      kind: 'file',
      downloadStatus: 'skipped',
      failureReason: 'no_media_url',
      metadata: baseMetadata,
    }
  }

  const downloaded = await downloadInstagramMedia(attachment.url, token)
  if (!downloaded) {
    return {
      position,
      kind: mimeToDbType(null, attachment.type),
      downloadStatus: 'failed',
      failureReason: 'download_failed',
      metadata: baseMetadata,
    }
  }

  const kind = mimeToDbType(downloaded.mime, attachment.type)
  const ext = extensionFromMime(downloaded.mime)
  let safeFileName = sanitizeFilenameSegment(defaultMediaBaseName(kind, ext), 180)
  if (!safeFileName.includes('.') && ext) safeFileName = `${safeFileName}${ext}`
  const effectiveType = downloaded.mime ?? 'application/octet-stream'
  const positionedName = position === 0 ? safeFileName : `${position}-${safeFileName}`

  let objectPath = [workspaceId, conversationId, messageId, positionedName].join('/')
  let uploadResult = await uploadToChatMedia(
    supabase,
    objectPath,
    downloaded.bytes,
    effectiveType,
  )
  if (uploadResult.error && /exists|duplicate|already/i.test(uploadResult.error)) {
    const suffix = crypto.randomUUID().slice(0, 8)
    objectPath = [
      workspaceId,
      conversationId,
      messageId,
      `${suffix}-${positionedName}`,
    ].join('/')
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
      position,
      kind,
      mimeType: downloaded.mime,
      sizeBytes: downloaded.bytes.byteLength,
      downloadStatus: 'failed',
      failureReason: 'storage_upload_failed',
      metadata: baseMetadata,
    }
  }

  return {
    position,
    kind,
    storagePath: objectPath,
    filename: positionedName,
    mimeType: effectiveType,
    sizeBytes: downloaded.bytes.byteLength,
    downloadStatus: 'stored',
    metadata: baseMetadata,
  }
}

async function resolveConversation(args: {
  supabase: SupabaseClient
  token: string
  channelId: string
  senderId: string
}): Promise<{ conversationId: string } | null> {
  const { supabase, token, channelId, senderId } = args
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
    return null
  }
  const resolved = Array.isArray(resolvedRows) ? resolvedRows[0] : resolvedRows
  const conversationId =
    resolved && typeof resolved.conversation_id === 'string'
      ? resolved.conversation_id
      : ''
  if (!conversationId) {
    console.error('instagram-webhook: resolve returned no conversation')
    return null
  }

  // The resolve RPC predates the profile column; sync the official identity
  // profile separately (best effort).
  const igProfile = buildInstagramProfile(profile)
  if (Object.keys(igProfile).length > 0) {
    await supabase
      .from('contact_channels')
      .update({ profile: igProfile, profile_synced_at: new Date().toISOString() })
      .eq('channel_id', channelId)
      .eq('external_id', senderId)
  }

  return { conversationId }
}

async function applyDeletedMessage(args: {
  supabase: SupabaseClient
  workspaceId: string
  eventId: string
  mid: string | null
}): Promise<void> {
  const { supabase, workspaceId, eventId, mid } = args
  if (!mid) {
    await markEventIgnored(supabase, eventId, 'deleted_without_mid')
    return
  }
  const { data: target } = await supabase
    .from('messages')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('external_id', mid)
    .limit(1)
    .maybeSingle()
  if (!target) {
    await markEventIgnored(supabase, eventId, 'deleted_target_missing')
    return
  }
  await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', target.id)
  await insertStatusEvent(supabase, {
    workspaceId,
    messageId: target.id,
    status: 'deleted',
    providerEventId: eventId,
  })
  await markEventProcessed(supabase, eventId, { createdMessageId: target.id })
}

async function ingestMessage(args: {
  supabase: SupabaseClient
  token: string
  channelId: string
  workspaceId: string
  senderId: string
  eventId: string
  message: IgMessage
  providerTimestamp: string | null
}): Promise<'ok' | 'temporary_failure'> {
  const {
    supabase,
    token,
    channelId,
    workspaceId,
    senderId,
    eventId,
    message,
    providerTimestamp,
  } = args

  const mid = message.mid?.trim()
  if (!mid) {
    await markEventIgnored(supabase, eventId, 'message_without_mid')
    return 'ok'
  }

  const resolved = await resolveConversation({ supabase, token, channelId, senderId })
  if (!resolved) {
    await markEventFailed(supabase, eventId, 'temporary', 'conversation_resolution_failed')
    return 'temporary_failure'
  }
  const { conversationId } = resolved

  const normalized = normalizeInstagramMessage(message)
  const messageId = crypto.randomUUID()

  const attachments: AttachmentInput[] = []
  for (const [index, attachment] of normalized.attachments.entries()) {
    try {
      attachments.push(
        await processAttachment({
          supabase,
          token,
          position: index,
          attachment,
          workspaceId,
          conversationId,
          messageId,
        }),
      )
    } catch (e) {
      logErrorType('instagram-webhook: media pipeline error', e)
      attachments.push({
        position: index,
        kind: mimeToDbType(null, attachment.type),
        downloadStatus: 'failed',
        failureReason: 'media_pipeline_failed',
        metadata: { attachment_type: attachment.type },
      })
    }
  }

  // Message type: structured types stay as-is; plain media derives from the
  // first attachment's downloaded kind.
  let dbType: NormalizedMessageType
  if (normalized.type === 'media') {
    const firstKind = attachments[0]?.kind ?? 'document'
    dbType = firstKind === 'file' ? 'document' : firstKind
  } else {
    dbType = normalized.type
  }

  const firstStored = attachments.find((a) => a.downloadStatus === 'stored')
  const anyFailed = attachments.some((a) => a.downloadStatus === 'failed')
  const metadata: Record<string, unknown> = {
    ...normalized.metadata,
    instagram: {
      mid,
      ...(normalized.attachments[0]?.type
        ? { attachment_type: normalized.attachments[0].type }
        : {}),
    },
    ...(anyFailed && !firstStored
      ? {
          upload_failed: true,
          upload_error:
            attachments.find((a) => a.failureReason)?.failureReason ??
            'download_failed',
        }
      : {}),
  }

  const persisted = await persistInboundMessage(supabase, messageId, {
    workspaceId,
    conversationId,
    channelId,
    externalId: mid,
    type: dbType,
    content: normalized.content,
    externalReplyToId: normalized.externalReplyToId,
    providerTimestamp,
    metadata,
    attachments,
  })

  if (persisted.outcome === 'duplicate') {
    await markEventIgnored(supabase, eventId, 'duplicate_message')
    return 'ok'
  }
  if (persisted.outcome === 'error') {
    await markEventFailed(supabase, eventId, 'temporary', persisted.message)
    return 'temporary_failure'
  }

  console.log(
    `instagram-webhook: ingested mid=${mid} conv=${conversationId} type=${dbType}`,
  )

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

  await markEventProcessed(supabase, eventId, { createdMessageId: messageId })
  return 'ok'
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

    console.log(
      `instagram-webhook: object=${payload.object} entries=${(payload.entry ?? [])
        .map((e) => `${e.id ?? '?'}#${(e.messaging ?? []).length}`)
        .join(',')}`,
    )

    let hadTemporaryFailure = false

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
        hadTemporaryFailure = true
        continue
      }
      if (!channel) {
        console.log(`instagram-webhook: no channel for entry.id=${igAccountId}`)
        continue
      }

      const channelId = channel.id as string
      const workspaceId = channel.workspace_id as string

      await touchChannelActivity(supabase, channelId, 'webhook')

      let token = ''
      const { data: credentials } = await supabase.rpc('get_channel_credentials', {
        p_channel_id: channelId,
      })
      if (
        credentials &&
        typeof credentials === 'object' &&
        !Array.isArray(credentials)
      ) {
        const raw = (credentials as Record<string, unknown>).access_token
        token = typeof raw === 'string' ? raw : ''
      }

      for (const event of entry.messaging ?? []) {
        const providerTimestamp =
          typeof event.timestamp === 'number'
            ? new Date(event.timestamp).toISOString()
            : null
        const sanitizedEvent = sanitizeProviderPayload(
          event as Record<string, unknown>,
        )

        // ── Read receipts (apply regardless of channel state) ───────────────
        if (event.read) {
          const fingerprint = igReadFingerprint(event)
          if (!fingerprint) continue
          const claim = await claimProviderEvent(supabase, {
            workspaceId,
            channelId,
            provider: 'instagram',
            eventType: 'read',
            eventFingerprint: fingerprint,
            payload: sanitizedEvent,
            providerTimestamp,
          })
          if (claim.outcome !== 'claimed') continue

          const mid = extractReadMid(event)
          const { error: readError } = await supabase.rpc(
            'mark_outbound_message_read',
            {
              p_channel_id: channelId,
              p_workspace_id: workspaceId,
              p_external_id: mid,
            },
          )
          if (readError) {
            console.error('instagram-webhook: mark read failed', readError)
          }
          if (mid) {
            const { data: target } = await supabase
              .from('messages')
              .select('id')
              .eq('workspace_id', workspaceId)
              .eq('external_id', mid)
              .limit(1)
              .maybeSingle()
            if (target) {
              await insertStatusEvent(supabase, {
                workspaceId,
                messageId: target.id,
                status: 'read',
                providerEventId: claim.eventId,
                providerTimestamp,
              })
            }
          }
          await markEventProcessed(supabase, claim.eventId)
          continue
        }

        // ── Reactions ───────────────────────────────────────────────────────
        if (event.reaction) {
          const fingerprint = igReactionFingerprint(event)
          const senderId = event.sender?.id?.trim()
          if (!fingerprint || !senderId) continue
          const claim = await claimProviderEvent(supabase, {
            workspaceId,
            channelId,
            provider: 'instagram',
            eventType: 'reaction',
            eventFingerprint: fingerprint,
            payload: sanitizedEvent,
            providerTimestamp,
          })
          if (claim.outcome !== 'claimed') continue

          const targetMid = event.reaction.mid
          const op = instagramReactionOp({
            reactorExternalId: senderId,
            action: event.reaction.action === 'unreact' ? 'unreact' : 'react',
            emoji: event.reaction.emoji,
            reactionName: event.reaction.reaction,
            providerTimestamp,
          })
          if (!targetMid || !op) {
            await markEventIgnored(supabase, claim.eventId, 'reaction_without_target')
            continue
          }
          const reactionIds = await applyReactionOps(
            supabase,
            { workspaceId, channelId, providerMessageId: targetMid },
            [op],
          )
          await markEventProcessed(supabase, claim.eventId, {
            createdRecordIds:
              reactionIds.length > 0 ? { message_reactions: reactionIds } : {},
          })
          continue
        }

        const message = event.message
        if (!message) continue

        const mid = message.mid?.trim() ?? null
        const senderId = event.sender?.id?.trim()

        // ── Echoes and deletions ────────────────────────────────────────────
        if (message.is_echo || message.is_deleted) {
          const fingerprint = mid
            ? `${message.is_deleted ? 'deleted' : 'echo'}:${mid}`
            : null
          if (!fingerprint) continue
          const claim = await claimProviderEvent(supabase, {
            workspaceId,
            channelId,
            provider: 'instagram',
            eventType: message.is_deleted ? 'deleted_message' : 'echo',
            eventFingerprint: fingerprint,
            payload: sanitizedEvent,
            providerTimestamp,
          })
          if (claim.outcome !== 'claimed') continue
          if (message.is_deleted) {
            await applyDeletedMessage({
              supabase,
              workspaceId,
              eventId: claim.eventId,
              mid,
            })
          } else {
            await markEventIgnored(supabase, claim.eventId, 'echo_message')
          }
          continue
        }

        if (!channel.is_active) {
          console.log('instagram-webhook: channel inactive, skipping')
          continue
        }
        if (!senderId || !mid) continue

        const claim = await claimProviderEvent(supabase, {
          workspaceId,
          channelId,
          provider: 'instagram',
          eventType: 'message',
          eventFingerprint: igMessageFingerprint(mid),
          payload: sanitizedEvent,
          providerTimestamp,
        })
        if (claim.outcome === 'duplicate') continue
        if (claim.outcome === 'error') {
          hadTemporaryFailure = true
          continue
        }

        try {
          const result = await ingestMessage({
            supabase,
            token,
            channelId,
            workspaceId,
            senderId,
            eventId: claim.eventId,
            message,
            providerTimestamp,
          })
          if (result === 'temporary_failure') hadTemporaryFailure = true
        } catch (e) {
          logErrorType('instagram-webhook: ingest failed', e)
          await markEventFailed(supabase, claim.eventId, 'temporary', 'ingest_exception')
          hadTemporaryFailure = true
        }
      }
    }

    if (hadTemporaryFailure) {
      return new Response('Temporary failure', { status: 500 })
    }
    return new Response('OK', { status: 200 })
  },
}
