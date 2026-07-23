// telegram-webhook: verify secret → parse → resolve trusted channel → persist
// sanitized provider event → normalize → persist idempotently → ack.
// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { timingSafeEqualStrings } from '../_shared/http.ts'
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
  persistInboundMessage,
  resolveContactAndConversation,
  touchChannelActivity,
} from '../_shared/persist.ts'
import type { AttachmentInput, NormalizedMessageInput } from '../_shared/types.ts'
import {
  buildTelegramProfile,
  classifyTelegramUpdate,
  normalizeTelegramMessage,
  normalizeTelegramReaction,
  resolveExternalName,
  telegramUpdateFingerprint,
  type ResolvedMedia,
  type TelegramMessage,
  type TelegramUpdate,
} from './lib.ts'

const CHAT_MEDIA_BUCKET = 'chat-media'
type SecretField = 'bot_token' | 'webhook_secret'

// ─── Credential helpers ──────────────────────────────────────────────────────

function getCredentialString(credentials: unknown, field: SecretField): string {
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

function hasCredentialObject(credentials: unknown): boolean {
  return (
    typeof credentials === 'object' &&
    credentials !== null &&
    !Array.isArray(credentials)
  )
}

function logErrorType(context: string, error: unknown): void {
  const detail = error instanceof Error ? error.name : typeof error
  console.error(`${context}: ${detail}`)
}

// ─── Media download pipeline ─────────────────────────────────────────────────

function extensionFromFileName(fileName: string | null): string | null {
  if (!fileName?.includes('.')) return null
  const ext = fileName.split('.').pop()
  if (!ext || ext.length > 10) return null
  return `.${ext.toLowerCase()}`
}

function extensionFromPath(filePath: string): string | null {
  const base = filePath.split('/').pop() ?? ''
  const idx = base.lastIndexOf('.')
  if (idx === -1 || idx === base.length - 1) return null
  const ext = base.slice(idx).toLowerCase()
  return ext.length <= 11 ? ext : null
}

function sanitizeFilenameSegment(name: string, maxLen: number): string {
  const cleaned = name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
  return cleaned.length > 0 ? cleaned : 'file'
}

async function telegramGetFilePath(
  botToken: string,
  fileId: string,
): Promise<string | null> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
    const res = await fetch(url)
    if (!res.ok) {
      console.error('telegram-webhook: getFile HTTP', res.status)
      return null
    }
    const data = (await res.json()) as {
      ok?: boolean
      result?: { file_path?: string }
    }
    if (data.ok !== true || !data.result?.file_path) {
      console.error('telegram-webhook: getFile invalid response')
      return null
    }
    return data.result.file_path
  } catch (e) {
    logErrorType('telegram-webhook: getFile failed', e)
    return null
  }
}

async function telegramDownloadFile(
  botToken: string,
  filePath: string,
): Promise<ArrayBuffer | null> {
  try {
    const encodedPath = filePath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')
    const url = `https://api.telegram.org/file/bot${botToken}/${encodedPath}`
    const res = await fetch(url)
    if (!res.ok) {
      console.error('telegram-webhook: file download HTTP', res.status)
      return null
    }
    return await res.arrayBuffer()
  } catch (e) {
    logErrorType('telegram-webhook: file download failed', e)
    return null
  }
}

function resolveUploadContentType(
  mimeHint: string | null,
  ext: string | null,
  dbType: ResolvedMedia['dbType'],
): string {
  if (mimeHint && mimeHint.trim()) return mimeHint
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.tgs') return 'application/x-tgsticker'
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.oga' || ext === '.ogg') return 'audio/ogg'
  if (dbType === 'image') return 'image/jpeg'
  if (dbType === 'video') return 'video/mp4'
  if (dbType === 'audio' || dbType === 'voice') return 'audio/ogg'
  if (dbType === 'sticker') return 'application/x-tgsticker'
  return 'application/octet-stream'
}

function defaultMediaBaseName(
  dbType: ResolvedMedia['dbType'],
  ext: string | null,
  telegramPath: string,
): string {
  if (dbType === 'image') return `photo${ext ?? '.jpg'}`
  if (dbType === 'video') return `video${ext ?? '.mp4'}`
  if (dbType === 'audio') return `audio${ext ?? '.ogg'}`
  if (dbType === 'voice') return `voice${ext ?? '.ogg'}`
  if (dbType === 'sticker') return `sticker${ext ?? '.tgs'}`
  const tail = telegramPath.split('/').pop()
  if (tail) return tail
  return `document${ext ?? ''}`
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
  /** telegram metadata fields kept for the existing frontend schema. */
  telegramFileMetadata: Record<string, unknown>
  uploadFailed: boolean
  uploadError: string | null
}

function failedMediaResult(
  media: ResolvedMedia,
  reason: string,
  filePath?: string,
): MediaPipelineResult {
  return {
    attachment: {
      position: 0,
      kind: media.dbType,
      providerMediaId: media.file_id,
      providerMediaUniqueId: media.file_unique_id,
      filename: media.file_name,
      mimeType: media.mime_type,
      sizeBytes: media.size,
      width: media.width ?? null,
      height: media.height ?? null,
      durationSeconds: media.duration ?? null,
      downloadStatus: 'failed',
      failureReason: reason,
      metadata: {
        ...(media.emoji ? { emoji: media.emoji } : {}),
        ...(media.set_name ? { set_name: media.set_name } : {}),
      },
    },
    telegramFileMetadata: telegramFileMetadata(media, filePath),
    uploadFailed: true,
    uploadError: reason,
  }
}

function telegramFileMetadata(
  media: ResolvedMedia,
  filePath?: string,
): Record<string, unknown> {
  return {
    file_id: media.file_id,
    ...(media.file_unique_id ? { file_unique_id: media.file_unique_id } : {}),
    ...(filePath ? { file_path: filePath } : {}),
    ...(media.width !== undefined ? { width: media.width } : {}),
    ...(media.height !== undefined ? { height: media.height } : {}),
    ...(media.duration !== undefined ? { duration: media.duration } : {}),
    ...(media.emoji ? { emoji: media.emoji } : {}),
    ...(media.set_name ? { set_name: media.set_name } : {}),
  }
}

async function processInboundMedia(args: {
  supabase: SupabaseClient
  botToken: string
  workspaceId: string
  conversationId: string
  messageId: string
  media: ResolvedMedia
}): Promise<MediaPipelineResult> {
  const { supabase, botToken, workspaceId, conversationId, messageId, media } =
    args

  const filePath = await telegramGetFilePath(botToken, media.file_id)
  if (!filePath) {
    return failedMediaResult(media, 'telegram_get_file_failed')
  }

  const bytes = await telegramDownloadFile(botToken, filePath)
  if (!bytes || bytes.byteLength === 0) {
    return failedMediaResult(media, 'telegram_download_failed', filePath)
  }

  const extFromName = extensionFromFileName(media.file_name)
  const extFromTp = extensionFromPath(filePath)
  const ext = extFromName ?? extFromTp ?? (media.dbType === 'image' ? '.jpg' : '')

  const rawFileName =
    media.file_name?.trim() || defaultMediaBaseName(media.dbType, ext, filePath)
  let safeFileName = sanitizeFilenameSegment(rawFileName, 180)
  if (!safeFileName.includes('.') && ext) {
    safeFileName = `${safeFileName}${ext}`
  }

  const contentType = resolveUploadContentType(media.mime_type, ext, media.dbType)

  let objectPath = [workspaceId, conversationId, messageId, safeFileName].join('/')
  let uploadResult = await uploadToChatMedia(supabase, objectPath, bytes, contentType)

  if (uploadResult.error && /exists|duplicate|already/i.test(uploadResult.error)) {
    const suffix = crypto.randomUUID().slice(0, 8)
    objectPath = [
      workspaceId,
      conversationId,
      messageId,
      `${suffix}-${safeFileName}`,
    ].join('/')
    uploadResult = await uploadToChatMedia(supabase, objectPath, bytes, contentType)
  }

  if (uploadResult.error) {
    console.error('telegram-webhook: storage upload failed', uploadResult.error)
    return failedMediaResult(media, 'storage_upload_failed', filePath)
  }

  return {
    attachment: {
      position: 0,
      kind: media.dbType,
      providerMediaId: media.file_id,
      providerMediaUniqueId: media.file_unique_id,
      storagePath: objectPath,
      filename: safeFileName,
      mimeType: contentType,
      sizeBytes: bytes.byteLength,
      width: media.width ?? null,
      height: media.height ?? null,
      durationSeconds: media.duration ?? null,
      downloadStatus: 'stored',
      metadata: {
        ...(media.emoji ? { emoji: media.emoji } : {}),
        ...(media.set_name ? { set_name: media.set_name } : {}),
      },
    },
    telegramFileMetadata: telegramFileMetadata(media, filePath),
    uploadFailed: false,
    uploadError: null,
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const url = new URL(req.url)
    const channelId = url.pathname.split('/').pop()
    if (!channelId) {
      return new Response('Missing channel id', { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, workspace_id, is_active')
      .eq('id', channelId)
      .eq('type', 'telegram')
      .single()

    if (channelError || !channel) {
      console.error('Channel not found:', channelId)
      return new Response('Channel not found', { status: 404 })
    }

    const { data: credentials, error: secretError } = await supabase.rpc(
      'get_channel_credentials',
      { p_channel_id: channel.id },
    )

    if (secretError) {
      console.error('telegram-webhook: channel secret load failed', secretError)
      return new Response('Failed to load channel secret', { status: 500 })
    }

    if (!hasCredentialObject(credentials)) {
      console.error('telegram-webhook: channel secret missing', channelId)
      return new Response('Unauthorized', { status: 401 })
    }

    const expectedSecret = getCredentialString(credentials, 'webhook_secret')
    if (!expectedSecret) {
      console.error('telegram-webhook: webhook secret missing', channelId)
      return new Response('Unauthorized', { status: 401 })
    }

    const secretFromHeader =
      req.headers.get('x-telegram-bot-api-secret-token') ?? ''
    if (!timingSafeEqualStrings(secretFromHeader, expectedSecret)) {
      return new Response('Unauthorized', { status: 401 })
    }

    let update: TelegramUpdate
    try {
      update = await req.json()
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }

    if (!channel.is_active) {
      return new Response('OK', { status: 200 })
    }

    const workspaceId: string = channel.workspace_id
    const classification = classifyTelegramUpdate(update)
    if (classification.kind === 'empty') {
      return new Response('OK', { status: 200 })
    }

    // Sanitize + persist the provider event before normalization; the
    // fingerprint dedups provider redeliveries.
    const sanitizedPayload = sanitizeProviderPayload(
      update as unknown as Record<string, unknown>,
    )
    const fingerprint =
      telegramUpdateFingerprint(update) ??
      (await fingerprintFromPayload(sanitizedPayload))

    const eventDate =
      classification.kind === 'reaction'
        ? classification.reaction.date
        : classification.kind === 'message' ||
            classification.kind === 'edited_message'
          ? classification.message.date
          : undefined
    const claim = await claimProviderEvent(supabase, {
      workspaceId,
      channelId,
      provider: 'telegram',
      eventType: classification.eventType,
      eventFingerprint: fingerprint,
      payload: sanitizedPayload,
      providerTimestamp:
        typeof eventDate === 'number'
          ? new Date(eventDate * 1000).toISOString()
          : null,
    })
    if (claim.outcome === 'duplicate') {
      return new Response('OK', { status: 200 })
    }
    if (claim.outcome === 'error') {
      console.error('telegram-webhook: event claim failed', claim.message)
      return new Response('Event claim failed', { status: 500 })
    }
    const eventId = claim.eventId

    await touchChannelActivity(supabase, channelId, 'webhook')

    if (classification.kind === 'ignored') {
      await markEventIgnored(supabase, eventId, classification.reason)
      return new Response('OK', { status: 200 })
    }

    // ── Reactions ────────────────────────────────────────────────────────────
    if (classification.kind === 'reaction') {
      const reaction = classification.reaction
      const normalized = normalizeTelegramReaction(reaction)
      if (!normalized || normalized.ops.length === 0) {
        await markEventIgnored(supabase, eventId, 'no_reaction_change')
        return new Response('OK', { status: 200 })
      }
      const resolved = await resolveContactAndConversation(supabase, {
        workspaceId,
        channelId,
        channelType: 'telegram',
        externalId: String(reaction.chat.id),
        externalName: reaction.user
          ? [reaction.user.first_name, reaction.user.last_name]
              .filter(Boolean)
              .join(' ') || 'Unknown'
          : 'Unknown',
        profile: buildTelegramProfile(reaction.user),
        createIfMissing: false,
      })
      const reactionIds = await applyReactionOps(
        supabase,
        {
          workspaceId,
          channelId,
          providerMessageId: String(reaction.message_id),
          conversationId: resolved?.conversationId ?? null,
        },
        normalized.ops,
      )
      await markEventProcessed(supabase, eventId, {
        createdRecordIds:
          reactionIds.length > 0 ? { message_reactions: reactionIds } : {},
      })
      return new Response('OK', { status: 200 })
    }

    // ── Edits ────────────────────────────────────────────────────────────────
    if (classification.kind === 'edited_message') {
      const message = classification.message
      const resolved = await resolveContactAndConversation(supabase, {
        workspaceId,
        channelId,
        channelType: 'telegram',
        externalId: String(message.chat.id),
        externalName: resolveExternalName(message),
        profile: buildTelegramProfile(message.from),
        createIfMissing: false,
      })
      if (!resolved) {
        await markEventIgnored(supabase, eventId, 'edit_target_conversation_missing')
        return new Response('OK', { status: 200 })
      }
      const { data: target } = await supabase
        .from('messages')
        .select('id, metadata')
        .eq('workspace_id', workspaceId)
        .eq('conversation_id', resolved.conversationId)
        .eq('external_id', String(message.message_id))
        .maybeSingle()
      if (!target) {
        await markEventIgnored(supabase, eventId, 'edit_target_message_missing')
        return new Response('OK', { status: 200 })
      }
      const normalized = normalizeTelegramMessage(message, update.update_id)
      const existingMetadata =
        target.metadata && typeof target.metadata === 'object'
          ? (target.metadata as Record<string, unknown>)
          : {}
      const { error: editError } = await supabase
        .from('messages')
        .update({
          content: normalized.content,
          edited_at:
            typeof message.edit_date === 'number'
              ? new Date(message.edit_date * 1000).toISOString()
              : new Date().toISOString(),
          metadata: { ...existingMetadata, ...normalized.metadata },
        })
        .eq('id', target.id)
      if (editError) {
        await markEventFailed(supabase, eventId, 'temporary', editError.message)
        return new Response('Edit failed', { status: 500 })
      }
      await markEventProcessed(supabase, eventId, { createdMessageId: target.id })
      return new Response('OK', { status: 200 })
    }

    // ── New messages ─────────────────────────────────────────────────────────
    const message: TelegramMessage = classification.message
    const resolved = await resolveContactAndConversation(supabase, {
      workspaceId,
      channelId,
      channelType: 'telegram',
      externalId: String(message.chat.id),
      externalName: resolveExternalName(message),
      profile: buildTelegramProfile(message.from, message.business_connection_id),
      createIfMissing: true,
    })
    if (!resolved) {
      await markEventFailed(supabase, eventId, 'temporary', 'contact_resolution_failed')
      return new Response('Failed to resolve conversation', { status: 500 })
    }
    const { contactId, conversationId } = resolved

    const normalized = normalizeTelegramMessage(message, update.update_id)
    const messageId = crypto.randomUUID()
    const attachments: AttachmentInput[] = []

    if (normalized.media) {
      const botToken = getCredentialString(credentials, 'bot_token')
      let mediaResult: MediaPipelineResult
      if (!botToken) {
        console.error('telegram-webhook: missing bot_token for media message')
        mediaResult = failedMediaResult(normalized.media, 'missing_bot_token')
      } else {
        try {
          mediaResult = await processInboundMedia({
            supabase,
            botToken,
            workspaceId,
            conversationId,
            messageId,
            media: normalized.media,
          })
        } catch (e) {
          logErrorType('telegram-webhook: media pipeline error', e)
          mediaResult = failedMediaResult(normalized.media, 'media_pipeline_failed')
        }
      }
      attachments.push(mediaResult.attachment)
      // Preserve the existing frontend metadata contract for media messages.
      normalized.metadata.telegram = {
        ...(normalized.metadata.telegram as Record<string, unknown>),
        ...mediaResult.telegramFileMetadata,
      }
      normalized.metadata.upload_failed = mediaResult.uploadFailed
      if (mediaResult.uploadError) {
        normalized.metadata.upload_error = mediaResult.uploadError
      }
    }

    const input: NormalizedMessageInput = {
      workspaceId,
      conversationId,
      channelId,
      externalId: String(message.message_id),
      type: normalized.type,
      content: normalized.content,
      externalReplyToId: normalized.externalReplyToId,
      providerTimestamp: normalized.providerTimestamp,
      metadata: normalized.metadata,
      attachments,
    }

    const persisted = await persistInboundMessage(supabase, messageId, input)
    if (persisted.outcome === 'duplicate') {
      await markEventIgnored(supabase, eventId, 'duplicate_message')
      return new Response('OK', { status: 200 })
    }
    if (persisted.outcome === 'error') {
      await markEventFailed(supabase, eventId, 'temporary', persisted.message)
      return new Response('Failed to insert message', { status: 500 })
    }

    const { error: convUpdateError } = await supabase
      .from('conversations')
      .update({ status: 'open' })
      .eq('id', conversationId)
      .neq('status', 'open')
    if (convUpdateError) {
      console.error(
        'telegram-webhook: conversation update failed',
        convUpdateError,
      )
    }

    // Fan out desktop/push notifications to the recipients created by the
    // create_message_notifications trigger. Fire-and-forget — push failures
    // must never break message ingestion.
    try {
      await supabase.functions.invoke('send-message-push', {
        body: { messageId },
        headers: {
          Authorization: `Bearer ${Deno.env.get('PUSH_DISPATCH_SECRET') ?? ''}`,
        },
      })
    } catch (pushError) {
      console.error('telegram-webhook: push dispatch failed', pushError)
    }

    await markEventProcessed(supabase, eventId, { createdMessageId: messageId })

    console.info(
      `Message stored — workspace: ${workspaceId}, contact: ${contactId}, conversation: ${conversationId}`,
    )

    return new Response('OK', { status: 200 })
  },
}
