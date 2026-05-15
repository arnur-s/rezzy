import type { MessageType } from '@/entities/message'
import { z } from 'zod'

const telegramMetadataSchema = z
  .object({
    file_id: z.string().min(1),
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
