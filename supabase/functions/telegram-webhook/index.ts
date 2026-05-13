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
  file_size?: number
}

interface TelegramVideo {
  file_id: string
  file_unique_id: string
  mime_type?: string
  file_name?: string
  file_size?: number
}

interface TelegramAudio {
  file_id: string
  file_unique_id: string
  mime_type?: string
  file_name?: string
  file_size?: number
}

interface TelegramVoice {
  file_id: string
  file_unique_id: string
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

interface ChannelCredentials {
  bot_token?: string
  webhook_secret?: string
}

type DbMessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker'

interface ResolvedMedia {
  dbType: Exclude<DbMessageType, 'text'>
  file_id: string
  file_unique_id: string | null
  file_name: string | null
  mime_type: string | null
  size: number | null
  /** Extra fields merged into the stored metadata (e.g. sticker shape hints). */
  extra?: Record<string, unknown>
}

type MessageMetadata = Record<string, unknown>

// ─── Classification ───────────────────────────────────────────────────────────

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
    }
  }
  if (message.voice) {
    const v = message.voice
    return {
      dbType: 'audio',
      file_id: v.file_id,
      file_unique_id: v.file_unique_id ?? null,
      file_name: null,
      mime_type: v.mime_type ?? 'audio/ogg',
      size: v.file_size ?? null,
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
    }
  }
  if (message.sticker) {
    const s = message.sticker
    const stickerExtra: Record<string, unknown> = {
      sticker_width: s.width ?? null,
      sticker_height: s.height ?? null,
      sticker_emoji: s.emoji ?? null,
      sticker_set_name: s.set_name ?? null,
    }
    if (s.is_video === true) {
      return {
        dbType: 'sticker',
        file_id: s.file_id,
        file_unique_id: s.file_unique_id ?? null,
        file_name: 'sticker.webm',
        mime_type: 'video/webm',
        size: s.file_size ?? null,
        extra: stickerExtra,
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
        extra: stickerExtra,
      }
    }
    return {
      dbType: 'sticker',
      file_id: s.file_id,
      file_unique_id: s.file_unique_id ?? null,
      file_name: 'sticker.webp',
      mime_type: 'image/webp',
      size: s.file_size ?? null,
      extra: stickerExtra,
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

function buildPreview(content: string | null, dbType: DbMessageType): string {
  const trimmed = content?.trim()
  if (trimmed) return trimmed.length > 100 ? trimmed.slice(0, 100) : trimmed
  const labels: Record<DbMessageType, string> = {
    text: 'Message',
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    document: 'Document',
    sticker: 'Sticker',
  }
  return `[${labels[dbType]}]`
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
    console.error('telegram-webhook: getFile failed', e)
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
    console.error('telegram-webhook: file download failed', e)
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
  if (dbType === 'audio') return 'audio/ogg'
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
    bytes.byteLength === 0 ? new Blob([], { type: contentType }) : new Blob([new Uint8Array(bytes)], {
      type: contentType,
    })
  const { error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(objectPath, body, {
    contentType,
    upsert: false,
  })
  if (!error) return { error: null }
  const msg = error.message ?? 'upload failed'
  return { error: msg }
}

async function processInboundMedia(args: {
  supabase: ReturnType<typeof createClient>
  botToken: string
  workspaceId: string
  conversationId: string
  media: ResolvedMedia
}): Promise<MessageMetadata> {
  const { supabase, botToken, workspaceId, conversationId, media } = args

  const baseMeta: MessageMetadata = {
    storage_path: null,
    file_name: media.file_name,
    mime_type: media.mime_type,
    size: media.size,
    telegram_file_id: media.file_id,
    telegram_file_unique_id: media.file_unique_id,
    upload_failed: true,
    ...(media.extra ?? {}),
  }

  const filePath = await telegramGetFilePath(botToken, media.file_id)
  if (!filePath) {
    console.error('telegram-webhook: could not resolve Telegram file path')
    return baseMeta
  }

  const bytes = await telegramDownloadFile(botToken, filePath)
  if (!bytes || bytes.byteLength === 0) {
    console.error('telegram-webhook: empty or missing file bytes')
    return baseMeta
  }

  const extFromName = extensionFromFileName(media.file_name)
  const extFromTp = extensionFromPath(filePath)
  const ext = extFromName ?? extFromTp ?? (media.dbType === 'image' ? '.jpg' : '')

  const uniquePart = sanitizeFilenameSegment(
    (media.file_unique_id ?? media.file_id).replace(/:/g, '_'),
    80,
  )
  const rawFileName =
    media.file_name?.trim() || defaultMediaBaseName(media.dbType, ext, filePath)
  let safeFileName = sanitizeFilenameSegment(rawFileName, 180)
  if (!safeFileName.includes('.') && ext) {
    safeFileName = `${safeFileName}${ext}`
  }

  const contentType = resolveUploadContentType(media.mime_type, ext, media.dbType)

  let objectPath = `${workspaceId}/${conversationId}/${uniquePart}-${safeFileName}`
  let uploadResult = await uploadToChatMedia(supabase, objectPath, bytes, contentType)

  if (uploadResult.error && /exists|duplicate|already/i.test(uploadResult.error)) {
    const suffix = crypto.randomUUID().slice(0, 8)
    objectPath = `${workspaceId}/${conversationId}/${uniquePart}-${suffix}-${safeFileName}`
    uploadResult = await uploadToChatMedia(supabase, objectPath, bytes, contentType)
  }

  if (uploadResult.error) {
    console.error('telegram-webhook: storage upload failed', uploadResult.error)
    return baseMeta
  }

  return {
    storage_path: objectPath,
    file_name: media.file_name,
    mime_type: contentType,
    size: bytes.byteLength,
    telegram_file_id: media.file_id,
    telegram_file_unique_id: media.file_unique_id,
    upload_failed: false,
    ...(media.extra ?? {}),
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
      .select('id, workspace_id, is_active, credentials')
      .eq('id', channelId)
      .eq('type', 'telegram')
      .single()

    if (channelError || !channel) {
      console.error('Channel not found:', channelId)
      return new Response('Channel not found', { status: 404 })
    }

    const creds = channel.credentials as ChannelCredentials | null
    const expectedSecret = creds?.webhook_secret
    const secretFromHeader = req.headers.get('x-telegram-bot-api-secret-token')
    if (expectedSecret && secretFromHeader !== expectedSecret) {
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
        contact_id: contactId,
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
          unread_count: 0,
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
    const preview = buildPreview(content, dbType)

    let metadata: MessageMetadata = {}
    let mediaMimeType: string | null = null

    if (media) {
      const botToken = creds?.bot_token?.trim()
      if (!botToken) {
        console.error('telegram-webhook: missing bot_token for media message')
        metadata = {
          storage_path: null,
          file_name: media.file_name,
          mime_type: media.mime_type,
          size: media.size,
          telegram_file_id: media.file_id,
          telegram_file_unique_id: media.file_unique_id,
          upload_failed: true,
          ...(media.extra ?? {}),
        }
      } else {
        try {
          metadata = await processInboundMedia({
            supabase,
            botToken,
            workspaceId,
            conversationId,
            media,
          })
        } catch (e) {
          console.error('telegram-webhook: media pipeline error', e)
          metadata = {
            storage_path: null,
            file_name: media.file_name,
            mime_type: media.mime_type,
            size: media.size,
            telegram_file_id: media.file_id,
            telegram_file_unique_id: media.file_unique_id,
            upload_failed: true,
            ...(media.extra ?? {}),
          }
        }
      }
      const mt = metadata.mime_type
      mediaMimeType = typeof mt === 'string' ? mt : media.mime_type
    }

    const insertRow: Record<string, unknown> = {
      workspace_id: workspaceId,
      conversation_id: conversationId,
      external_id: externalMessageId,
      direction: 'inbound',
      type: dbType,
      content,
      sender_id: null,
      status: 'delivered',
      media_mime_type: mediaMimeType,
    }
    if (Object.keys(metadata).length > 0) {
      insertRow.metadata = metadata
    }

    const { error: messageError } = await supabase.from('messages').insert(insertRow)

    if (messageError) {
      console.error('Failed to insert message:', messageError)
      return new Response('Failed to insert message', { status: 500 })
    }

    let unreadCount: number | undefined
    try {
      const { data, error: unreadRpcError } = await supabase.rpc('increment_unread', {
        conversation_id: conversationId,
      })
      if (unreadRpcError) {
        console.error('telegram-webhook: increment_unread failed', unreadRpcError)
      } else if (typeof data === 'number' && Number.isFinite(data)) {
        unreadCount = data
      } else if (typeof data === 'string' && data.trim() !== '') {
        const n = Number(data)
        if (Number.isFinite(n)) unreadCount = n
      }
    } catch (e) {
      console.error('telegram-webhook: increment_unread threw', e)
    }

    const convUpdate: Record<string, unknown> = {
      last_message_at: new Date().toISOString(),
      last_message_preview: preview,
      status: 'open',
    }
    if (unreadCount !== undefined) {
      convUpdate.unread_count = unreadCount
    }

    const { error: convUpdateError } = await supabase
      .from('conversations')
      .update(convUpdate)
      .eq('id', conversationId)

    if (convUpdateError) {
      console.error('telegram-webhook: conversation update failed', convUpdateError)
    }

    console.info(
      `Message stored — workspace: ${workspaceId}, contact: ${contactId}, conversation: ${conversationId}`,
    )

    return new Response('OK', { status: 200 })
  },
}
