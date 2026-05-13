import type { Json } from '@/api/types'
import { z } from 'zod'
import type { MessageType } from '../types'

/** Matches Telegram → Storage pipeline metadata (and future outbound media). */
export const messageMediaMetadataSchema = z
  .object({
    storage_path: z.string().min(1).optional(),
    file_name: z.string().nullable().optional(),
    mime_type: z.string().nullable().optional(),
    size: z.number().finite().nullable().optional(),
    telegram_file_id: z.string().optional(),
    telegram_file_unique_id: z.string().nullable().optional(),
    public_url: z.string().optional(),
    upload_failed: z.boolean().optional(),
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
): MessageType {
  if (rowType !== 'document' || !metadata) return rowType
  const mime = (metadata.mime_type ?? '').trim().toLowerCase()
  if (mime === 'application/x-tgsticker') return 'sticker'
  const extEarly = extensionFromFileName(metadata.file_name ?? null)
  if (extEarly === 'tgs') return 'sticker'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('image/')) return 'image'
  const ext = extensionFromFileName(metadata.file_name ?? null)
  if (ext) {
    if (VIDEO_EXTS.has(ext)) return 'video'
    if (AUDIO_EXTS.has(ext)) return 'audio'
    if (IMAGE_EXTS.has(ext)) return 'image'
  }
  return rowType
}

/** Stable storage object path for signed URL fetch, or null when not previewable. */
export function getChatMediaStoragePath(
  raw: Json,
  messageType: string,
): string | null {
  if (!MEDIA_RENDER_TYPES.has(messageType)) return null
  const parsed = parseMessageMediaMetadata(raw)
  if (!parsed) return null
  if (parsed.upload_failed) return null
  const path = parsed.storage_path?.trim()
  return path && path.length > 0 ? path : null
}
