import type { MessageRow, MessageType } from '@/entities/message'
import { getMediaPlaceholder, isMessageType } from '@/entities/message'
import { z } from 'zod'

const telegramMetadataSchema = z
  .object({
    /** Optional: text messages now carry telegram ids without file fields. */
    file_id: z.string().min(1).optional(),
    file_unique_id: z.string().min(1).optional(),
    file_path: z.string().min(1).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    duration: z.number().int().nonnegative().optional(),
    emoji: z.string().min(1).optional(),
    set_name: z.string().min(1).optional(),
  })
  .passthrough()

/** Matches Telegram → Storage pipeline metadata (and future outbound media). */
export const messageMediaMetadataSchema = z
  .object({
    telegram: telegramMetadataSchema.optional(),
    upload_failed: z.boolean().optional(),
    upload_error: z.string().min(1).optional(),
    /** Legacy flat fields kept for existing rows created before media_url. */
    storage_path: z.string().min(1).optional(),
    file_name: z.string().nullable().optional(),
    mime_type: z.string().nullable().optional(),
    size: z.number().finite().nullable().optional(),
    telegram_file_id: z.string().optional(),
    telegram_file_unique_id: z.string().nullable().optional(),
    public_url: z.string().optional(),
    sticker_width: z.number().int().positive().nullable().optional(),
    sticker_height: z.number().int().positive().nullable().optional(),
    sticker_emoji: z.string().nullable().optional(),
    sticker_set_name: z.string().nullable().optional(),
  })
  .passthrough()

export type MessageMediaMetadata = z.infer<typeof messageMediaMetadataSchema>

// ─── Structured provider metadata (parsed per message type at render time) ───

export const locationMetadataSchema = z
  .object({
    kind: z.enum(['point', 'live', 'venue']).optional(),
    latitude: z.number(),
    longitude: z.number(),
    name: z.string().optional(),
    address: z.string().optional(),
    live_period_seconds: z.number().optional(),
  })
  .passthrough()

export type LocationMetadata = z.infer<typeof locationMetadataSchema>

export const contactCardSchema = z
  .object({
    name: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    phones: z
      .array(
        z.object({ phone: z.string().optional(), wa_id: z.string().optional() }).passthrough(),
      )
      .optional(),
    emails: z.array(z.object({ email: z.string().optional() }).passthrough()).optional(),
    company: z.string().optional(),
  })
  .passthrough()

export type ContactCardMetadata = z.infer<typeof contactCardSchema>

export const interactiveMetadataSchema = z
  .object({
    kind: z.string(),
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough()

export type InteractiveMetadata = z.infer<typeof interactiveMetadataSchema>

export const shareMetadataSchema = z
  .object({
    kind: z.string().optional(),
    url: z.string().optional(),
    title: z.string().optional(),
  })
  .passthrough()

export type ShareMetadata = z.infer<typeof shareMetadataSchema>

export const storyMetadataSchema = z
  .object({
    kind: z.enum(['reply', 'mention']).optional(),
    id: z.string().optional(),
    url: z.string().optional(),
  })
  .passthrough()

export type StoryMetadata = z.infer<typeof storyMetadataSchema>

export const quoteMetadataSchema = z
  .object({
    external_id: z.string(),
    preview: z.string().optional(),
    author_name: z.string().optional(),
    author_external_id: z.string().optional(),
  })
  .passthrough()

export type QuoteMetadata = z.infer<typeof quoteMetadataSchema>

export const unsupportedMetadataSchema = z
  .object({
    kind: z.string().optional(),
    preview: z.string().optional(),
  })
  .passthrough()

export type UnsupportedMetadata = z.infer<typeof unsupportedMetadataSchema>

function metadataSection(raw: unknown, key: string): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  return (raw as Record<string, unknown>)[key] ?? null
}

export function parseLocationMetadata(raw: unknown): LocationMetadata | null {
  const result = locationMetadataSchema.safeParse(metadataSection(raw, 'location'))
  return result.success ? result.data : null
}

export function parseContactsMetadata(raw: unknown): Array<ContactCardMetadata> {
  const result = z.array(contactCardSchema).safeParse(metadataSection(raw, 'contacts'))
  return result.success ? result.data : []
}

export function parseInteractiveMetadata(raw: unknown): InteractiveMetadata | null {
  const result = interactiveMetadataSchema.safeParse(
    metadataSection(raw, 'interactive'),
  )
  return result.success ? result.data : null
}

export function parseShareMetadata(raw: unknown): ShareMetadata | null {
  const result = shareMetadataSchema.safeParse(metadataSection(raw, 'share'))
  return result.success ? result.data : null
}

export function parseStoryMetadata(raw: unknown): StoryMetadata | null {
  const result = storyMetadataSchema.safeParse(metadataSection(raw, 'story'))
  return result.success ? result.data : null
}

export function parseQuoteMetadata(raw: unknown): QuoteMetadata | null {
  const result = quoteMetadataSchema.safeParse(metadataSection(raw, 'quote'))
  return result.success ? result.data : null
}

export function parseUnsupportedMetadata(raw: unknown): UnsupportedMetadata | null {
  const result = unsupportedMetadataSchema.safeParse(
    metadataSection(raw, 'unsupported'),
  )
  return result.success ? result.data : null
}

const MEDIA_RENDER_TYPES = new Set([
  'image',
  'video',
  'audio',
  'voice',
  'document',
  'sticker',
])

export function parseMessageMediaMetadata(raw: unknown): MessageMediaMetadata | null {
  const result = messageMediaMetadataSchema.safeParse(raw)
  return result.success ? result.data : null
}

const VIDEO_EXTS = new Set([
  'mp4',
  'm4v',
  'webm',
  'mov',
  'mkv',
  'avi',
  '3gp',
  '3g2',
])
const AUDIO_EXTS = new Set([
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'aac',
  'flac',
  'opus',
  'wma',
])
const IMAGE_EXTS = new Set([
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

function extensionFromFileName(name: string | null | undefined): string | null {
  if (!name?.includes('.')) return null
  const ext = name.split('.').pop()?.toLowerCase()
  return ext && ext.length > 0 ? ext : null
}

/**
 * Telegram often sends video files as `document`. Map document + mime/name to
 * the rich type we use for previews and inline players (existing rows included).
 */
export function effectiveRichMediaType(
  rowType: MessageType,
  metadata: MessageMediaMetadata | null,
  mediaMimeType?: string | null,
  mediaFilename?: string | null,
): MessageType {
  if (rowType !== 'document') return rowType
  const mime = (mediaMimeType ?? metadata?.mime_type ?? '').trim().toLowerCase()
  if (mime === 'application/x-tgsticker') return 'sticker'
  const fileName = mediaFilename ?? metadata?.file_name ?? null
  const extEarly = extensionFromFileName(fileName)
  if (extEarly === 'tgs') return 'sticker'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('image/')) return 'image'
  const ext = extensionFromFileName(fileName)
  if (ext) {
    if (VIDEO_EXTS.has(ext)) return 'video'
    if (AUDIO_EXTS.has(ext)) return 'audio'
    if (IMAGE_EXTS.has(ext)) return 'image'
  }
  return rowType
}

/** Short list preview when content is empty (e.g. media without caption). */
export function listPreviewFromMessage(
  message: Pick<
    MessageRow,
    'content' | 'type' | 'metadata' | 'media_filename' | 'media_mime_type'
  >,
): string | null {
  const trimmed = message.content?.trim()
  if (trimmed) return trimmed.length > 100 ? trimmed.slice(0, 100) : trimmed
  const rowType: MessageType =
    message.type && isMessageType(message.type) ? message.type : 'text'
  if (rowType !== 'text') {
    const label = effectiveRichMediaType(
      rowType,
      parseMessageMediaMetadata(message.metadata),
      message.media_mime_type,
      message.media_filename,
    )
    return getMediaPlaceholder(label)
  }
  return null
}

/** Stable storage object path for signed URL fetch, or null when not previewable. */
export function getChatMediaStoragePath(
  raw: unknown,
  messageType: string,
  mediaUrl?: string | null,
): string | null {
  if (!MEDIA_RENDER_TYPES.has(messageType)) return null
  const parsed = parseMessageMediaMetadata(raw)
  if (parsed?.upload_failed) return null

  const canonicalPath = mediaUrl?.trim()
  if (canonicalPath) return canonicalPath
  if (!parsed) return null

  const path = parsed.storage_path?.trim()
  return path && path.length > 0 ? path : null
}
