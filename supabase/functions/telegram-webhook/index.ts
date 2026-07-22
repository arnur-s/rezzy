// telegram-webhook.ts
// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CHAT_MEDIA_BUCKET = 'chat-media'

// ─── Telegram types ───────────────────────────────────────────────────────────

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

interface TelegramPhotoSize {
  file_id: string
  file_unique_id: string
  width?: number
  height?: number
  file_size?: number
}

interface TelegramVideo {
  file_id: string
  file_unique_id: string
  width?: number
  height?: number
  duration?: number
  mime_type?: string
  file_name?: string
  file_size?: number
}

interface TelegramAudio {
  file_id: string
  file_unique_id: string
  duration?: number
  mime_type?: string
  file_name?: string
  file_size?: number
}

interface TelegramVoice {
  file_id: string
  file_unique_id: string
  duration?: number
  mime_type?: string
  file_size?: number
}

interface TelegramDocument {
  file_id: string
  file_unique_id: string
  mime_type?: string
  file_name?: string
  file_size?: number
}

/** https://core.telegram.org/bots/api#sticker */
interface TelegramSticker {
  file_id: string
  file_unique_id: string
  type?: string
  is_animated?: boolean
  is_video?: boolean
  width?: number
  height?: number
  emoji?: string
  set_name?: string
  file_size?: number
}

/** https://core.telegram.org/bots/api#animation */
interface TelegramAnimation {
  file_id: string
  file_unique_id: string
  width?: number
  height?: number
  duration?: number
  mime_type?: string
  file_name?: string
  file_size?: number
}

/** https://core.telegram.org/bots/api#videonote */
interface TelegramVideoNote {
  file_id: string
  file_unique_id: string
  length?: number
  duration?: number
  file_size?: number
}

interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: { id: number; title?: string }
  date: number
  text?: string
  caption?: string
  photo?: TelegramPhotoSize[]
  video?: TelegramVideo
  animation?: TelegramAnimation
  audio?: TelegramAudio
  voice?: TelegramVoice
  video_note?: TelegramVideoNote
  document?: TelegramDocument
  sticker?: TelegramSticker
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

type DbMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'sticker'

type TelegramProviderMetadata = {
  file_id: string
  file_unique_id?: string
  file_path?: string
  width?: number
  height?: number
  duration?: number
  emoji?: string
  set_name?: string
}

interface ResolvedMedia {
  dbType: Exclude<DbMessageType, 'text'>
  file_id: string
  file_unique_id: string | null
  file_name: string | null
  mime_type: string | null
  size: number | null
  telegram?: Omit<TelegramProviderMetadata, 'file_id' | 'file_unique_id'>
}

interface InboundMediaResult {
  metadata: MessageMetadata
  mediaUrl: string | null
  mediaMimeType: string | null
  mediaSize: number | null
  mediaFilename: string | null
  uploadedObjectPath: string | null
}

type MessageMetadata = Record<string, unknown>
type SecretField = 'bot_token' | 'webhook_secret'

// ─── Classification ───────────────────────────────────────────────────────────

function getCredentialString(
  credentials: unknown,
  field: SecretField,
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

function inferDocumentDbType(
  mime: string | null,
  fileName: string | null,
): Exclude<DbMessageType, 'text'> {
  const mt = mime?.trim().toLowerCase() ?? ''
  if (mt === 'application/x-tgsticker') return 'sticker'
  if (mt.startsWith('video/')) return 'video'
  if (mt.startsWith('audio/')) return 'audio'
  if (mt.startsWith('image/')) return 'image'
  const lower = fileName?.toLowerCase() ?? ''
  const ext = lower.includes('.') ? (lower.split('.').pop() ?? '') : ''
  if (!ext) return 'document'
  if (ext === 'tgs') return 'sticker'
  const video = new Set([
    'mp4',
    'm4v',
    'webm',
    'mov',
    'mkv',
    'avi',
    '3gp',
    '3g2',
  ])
  const audio = new Set([
    'mp3',
    'wav',
    'ogg',
    'm4a',
    'aac',
    'flac',
    'opus',
    'wma',
  ])
  const image = new Set([
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'heic',
    'heif',
    'bmp',
    'tif',
    'tiff',
  ])
  if (video.has(ext)) return 'video'
  if (audio.has(ext)) return 'audio'
  if (image.has(ext)) return 'image'
  return 'document'
}

function resolveTelegramMedia(message: TelegramMessage): ResolvedMedia | null {
  const photos = message.photo
  if (photos?.length) {
    const largest = photos.at(-1)!
    return {
      dbType: 'image',
      file_id: largest.file_id,
      file_unique_id: largest.file_unique_id ?? null,
      file_name: null,
      mime_type: 'image/jpeg',
      size: largest.file_size ?? null,
      telegram: {
        width: largest.width,
        height: largest.height,
      },
    }
  }
  if (message.video) {
    const v = message.video
    return {
      dbType: 'video',
      file_id: v.file_id,
      file_unique_id: v.file_unique_id ?? null,
      file_name: v.file_name ?? null,
      mime_type: v.mime_type ?? null,
      size: v.file_size ?? null,
      telegram: {
        width: v.width,
        height: v.height,
        duration: v.duration,
      },
    }
  }
  if (message.animation) {
    const a = message.animation
    return {
      dbType: 'video',
      file_id: a.file_id,
      file_unique_id: a.file_unique_id ?? null,
      file_name: a.file_name ?? null,
      mime_type: a.mime_type ?? 'video/mp4',
      size: a.file_size ?? null,
      telegram: {
        width: a.width,
        height: a.height,
        duration: a.duration,
      },
    }
  }
  if (message.audio) {
    const a = message.audio
    return {
      dbType: 'audio',
      file_id: a.file_id,
      file_unique_id: a.file_unique_id ?? null,
      file_name: a.file_name ?? null,
      mime_type: a.mime_type ?? null,
      size: a.file_size ?? null,
      telegram: {
        duration: a.duration,
      },
    }
  }
  if (message.voice) {
    const v = message.voice
    return {
      dbType: 'voice',
      file_id: v.file_id,
      file_unique_id: v.file_unique_id ?? null,
      file_name: null,
      mime_type: v.mime_type ?? 'audio/ogg',
      size: v.file_size ?? null,
      telegram: {
        duration: v.duration,
      },
    }
  }
  if (message.video_note) {
    const vn = message.video_note
    return {
      dbType: 'video',
      file_id: vn.file_id,
      file_unique_id: vn.file_unique_id ?? null,
      file_name: null,
      mime_type: 'video/mp4',
      size: vn.file_size ?? null,
      telegram: {
        width: vn.length,
        height: vn.length,
        duration: vn.duration,
      },
    }
  }
  if (message.sticker) {
    const s = message.sticker
    const stickerExtra: Omit<
      TelegramProviderMetadata,
      'file_id' | 'file_unique_id' | 'file_path'
    > = {
      width: s.width,
      height: s.height,
      emoji: s.emoji,
      set_name: s.set_name,
    }
    if (s.is_video === true) {
      return {
        dbType: 'sticker',
        file_id: s.file_id,
        file_unique_id: s.file_unique_id ?? null,
        file_name: 'sticker.webm',
        mime_type: 'video/webm',
        size: s.file_size ?? null,
        telegram: stickerExtra,
      }
    }
    if (s.is_animated === true) {
      return {
        dbType: 'sticker',
        file_id: s.file_id,
        file_unique_id: s.file_unique_id ?? null,
        file_name: 'sticker.tgs',
        mime_type: 'application/x-tgsticker',
        size: s.file_size ?? null,
        telegram: stickerExtra,
      }
    }
    return {
      dbType: 'sticker',
      file_id: s.file_id,
      file_unique_id: s.file_unique_id ?? null,
      file_name: 'sticker.webp',
      mime_type: 'image/webp',
      size: s.file_size ?? null,
      telegram: stickerExtra,
    }
  }
  if (message.document) {
    const d = message.document
    const dbType = inferDocumentDbType(d.mime_type ?? null, d.file_name ?? null)
    return {
      dbType,
      file_id: d.file_id,
      file_unique_id: d.file_unique_id ?? null,
      file_name: d.file_name ?? null,
      mime_type: d.mime_type ?? null,
      size: d.file_size ?? null,
    }
  }
  return null
}

function getDbMessageType(message: TelegramMessage): DbMessageType {
  const m = resolveTelegramMedia(message)
  if (m) return m.dbType
  return 'text'
}

/** Display name for CRM; Telegram sendMessage uses chat.id, not from.id. */
function resolveExternalName(message: TelegramMessage): string {
  const from = message.from
  if (from) {
    const full =
      [from.first_name, from.last_name].filter(Boolean).join(' ') || null
    if (full) return full
    if (from.username) return from.username
  }
  if (message.chat.title?.trim()) return message.chat.title.trim()
  return 'Unknown'
}

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
  supabase: ReturnType<typeof createClient>,
  objectPath: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<{ error: string | null }> {
  const body =
    bytes.byteLength === 0
      ? new Blob([], { type: contentType })
      : new Blob([new Uint8Array(bytes)], {
          type: contentType,
        })
  const { error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .upload(objectPath, body, {
      contentType,
      upsert: false,
    })
  if (!error) return { error: null }
  const msg = error.message ?? 'upload failed'
  return { error: msg }
}

async function removeChatMediaObject(
  supabase: ReturnType<typeof createClient>,
  objectPath: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .remove([objectPath])
  if (error) {
    console.error('telegram-webhook: storage cleanup failed', error.message)
  }
}

function telegramMetadata(
  media: ResolvedMedia,
  filePath?: string,
): TelegramProviderMetadata {
  return {
    file_id: media.file_id,
    ...(media.file_unique_id ? { file_unique_id: media.file_unique_id } : {}),
    ...(filePath ? { file_path: filePath } : {}),
    ...(media.telegram ?? {}),
  }
}

function failedInboundMediaResult(
  media: ResolvedMedia,
  uploadError: string,
  filePath?: string,
): InboundMediaResult {
  return {
    metadata: {
      telegram: telegramMetadata(media, filePath),
      upload_failed: true,
      upload_error: uploadError,
    },
    mediaUrl: null,
    mediaMimeType: media.mime_type,
    mediaSize: media.size,
    mediaFilename: media.file_name,
    uploadedObjectPath: null,
  }
}

async function processInboundMedia(args: {
  supabase: ReturnType<typeof createClient>
  botToken: string
  workspaceId: string
  conversationId: string
  messageId: string
  media: ResolvedMedia
}): Promise<InboundMediaResult> {
  const { supabase, botToken, workspaceId, conversationId, messageId, media } =
    args

  const filePath = await telegramGetFilePath(botToken, media.file_id)
  if (!filePath) {
    console.error('telegram-webhook: could not resolve Telegram file path')
    return failedInboundMediaResult(media, 'telegram_get_file_failed')
  }

  const bytes = await telegramDownloadFile(botToken, filePath)
  if (!bytes || bytes.byteLength === 0) {
    console.error('telegram-webhook: empty or missing file bytes')
    return failedInboundMediaResult(media, 'telegram_download_failed', filePath)
  }

  const extFromName = extensionFromFileName(media.file_name)
  const extFromTp = extensionFromPath(filePath)
  const ext =
    extFromName ?? extFromTp ?? (media.dbType === 'image' ? '.jpg' : '')

  const rawFileName =
    media.file_name?.trim() || defaultMediaBaseName(media.dbType, ext, filePath)
  let safeFileName = sanitizeFilenameSegment(rawFileName, 180)
  if (!safeFileName.includes('.') && ext) {
    safeFileName = `${safeFileName}${ext}`
  }

  const contentType = resolveUploadContentType(
    media.mime_type,
    ext,
    media.dbType,
  )

  let objectPath = [
    workspaceId,
    conversationId,
    messageId,
    safeFileName,
  ].join('/')
  let uploadResult = await uploadToChatMedia(
    supabase,
    objectPath,
    bytes,
    contentType,
  )

  if (
    uploadResult.error &&
    /exists|duplicate|already/i.test(uploadResult.error)
  ) {
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
      contentType,
    )
  }

  if (uploadResult.error) {
    console.error('telegram-webhook: storage upload failed', uploadResult.error)
    return failedInboundMediaResult(media, 'storage_upload_failed', filePath)
  }

  return {
    metadata: {
      telegram: telegramMetadata(media, filePath),
      upload_failed: false,
    },
    mediaUrl: objectPath,
    mediaMimeType: contentType,
    mediaSize: bytes.byteLength,
    mediaFilename: safeFileName,
    uploadedObjectPath: objectPath,
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

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

    const secretFromHeader = req.headers.get('x-telegram-bot-api-secret-token')
    if (secretFromHeader !== expectedSecret) {
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

    const message = update.message
    if (!message?.chat?.id) {
      return new Response('OK', { status: 200 })
    }

    const workspaceId: string = channel.workspace_id
    const externalChatId = String(message.chat.id)
    const externalName = resolveExternalName(message)

    const { data: existingContactChannel } = await supabase
      .from('contact_channels')
      .select('contact_id, contacts!inner(workspace_id)')
      .eq('channel_type', 'telegram')
      .eq('external_id', externalChatId)
      .eq('contacts.workspace_id', workspaceId)
      .maybeSingle()

    let contactId: string

    if (existingContactChannel) {
      contactId = existingContactChannel.contact_id

      await supabase
        .from('contact_channels')
        .update({ external_name: externalName })
        .eq('contact_id', contactId)
        .eq('channel_type', 'telegram')
        .eq('external_id', externalChatId)
    } else {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          workspace_id: workspaceId,
          name: externalName,
          status: 'new',
        })
        .select('id')
        .single()

      if (contactError || !newContact) {
        console.error('Failed to create contact:', contactError)
        return new Response('Failed to create contact', { status: 500 })
      }

      contactId = newContact.id

      await supabase.from('contact_channels').insert({
        workspace_id: workspaceId,
        contact_id: contactId,
        channel_id: channelId,
        channel_type: 'telegram',
        external_id: externalChatId,
        external_name: externalName,
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
      conversationId = existingConversation.id
    } else {
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          workspace_id: workspaceId,
          contact_id: contactId,
          channel_id: channelId,
          status: 'open',
        })
        .select('id')
        .single()

      if (convError || !newConversation) {
        console.error('Failed to create conversation:', convError)
        return new Response('Failed to create conversation', { status: 500 })
      }

      conversationId = newConversation.id
    }

    if (typeof update.update_id !== 'number') {
      console.warn('telegram-webhook: missing update_id, ignoring')
      return new Response('OK', { status: 200 })
    }

    const externalMessageId = String(update.update_id)

    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('external_id', externalMessageId)
      .maybeSingle()

    if (existingMessage) {
      return new Response('OK', { status: 200 })
    }

    const media = resolveTelegramMedia(message)
    const dbType = getDbMessageType(message)
    const content = message.caption ?? message.text ?? null
    const messageId = crypto.randomUUID()

    let metadata: MessageMetadata = {}
    let mediaUrl: string | null = null
    let mediaMimeType: string | null = null
    let mediaSize: number | null = null
    let mediaFilename: string | null = null
    let uploadedObjectPath: string | null = null

    if (media) {
      const botToken = getCredentialString(credentials, 'bot_token')
      let mediaResult: InboundMediaResult
      if (!botToken) {
        console.error('telegram-webhook: missing bot_token for media message')
        mediaResult = failedInboundMediaResult(media, 'missing_bot_token')
      } else {
        try {
          mediaResult = await processInboundMedia({
            supabase,
            botToken,
            workspaceId,
            conversationId,
            messageId,
            media,
          })
        } catch (e) {
          logErrorType('telegram-webhook: media pipeline error', e)
          mediaResult = failedInboundMediaResult(media, 'media_pipeline_failed')
        }
      }
      metadata = mediaResult.metadata
      mediaUrl = mediaResult.mediaUrl
      mediaMimeType = mediaResult.mediaMimeType
      mediaSize = mediaResult.mediaSize
      mediaFilename = mediaResult.mediaFilename
      uploadedObjectPath = mediaResult.uploadedObjectPath
    }

    const insertRow: Record<string, unknown> = {
      id: messageId,
      workspace_id: workspaceId,
      conversation_id: conversationId,
      external_id: externalMessageId,
      direction: 'inbound',
      type: dbType,
      content,
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
      console.error('Failed to insert message:', messageError)
      if (uploadedObjectPath) {
        await removeChatMediaObject(supabase, uploadedObjectPath)
      }
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

    console.info(
      `Message stored — workspace: ${workspaceId}, contact: ${contactId}, conversation: ${conversationId}`,
    )

    return new Response('OK', { status: 200 })
  },
}
