// Pure, Deno-free helpers for instagram-webhook. Import-safe for Vitest.
// crypto.subtle / TextEncoder are Web APIs available in both Deno and Node.

/** Constant-time hex string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

/** Verifies Meta's X-Hub-Signature-256 (HMAC-SHA256 over the raw body). */
export async function verifySignature(
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

export type IgDbMessageType = 'text' | 'image' | 'video' | 'audio' | 'document'

export interface IgAttachmentPayload {
  url?: string
  title?: string
  sticker_id?: string | number
}
export interface IgAttachment {
  type?: string
  payload?: IgAttachmentPayload
}
export interface IgMessage {
  mid?: string
  text?: string
  attachments?: IgAttachment[]
  reply_to?: { mid?: string; story?: { url?: string; id?: string } }
  referral?: {
    ref?: string
    source?: string
    type?: string
    ads_context_data?: { ad_title?: string; photo_url?: string }
  }
  is_echo?: boolean
  is_deleted?: boolean
  is_unsupported?: boolean
}
export interface IgMessagingEvent {
  sender?: { id?: string }
  recipient?: { id?: string }
  timestamp?: number
  message?: IgMessage
  read?: { mid?: string }
  reaction?: { mid?: string; action?: string; reaction?: string; emoji?: string }
}
export interface IgEntry {
  id?: string
  time?: number
  messaging?: IgMessagingEvent[]
}
export interface IgWebhookBody {
  object?: string
  entry?: IgEntry[]
}

export interface ResolvedInboundMessage {
  content: string | null
  /** First attachment carrying a fetchable URL, if any. */
  attachment: { url: string; type: string } | null
}

/**
 * Reduces an inbound Instagram message to text content plus (at most) the first
 * attachment that has a usable URL. Instagram commonly sends one attachment per
 * event; additional attachments are ignored for this MVP.
 */
export function resolveInstagramMessage(
  message: IgMessage | undefined,
): ResolvedInboundMessage {
  const content =
    typeof message?.text === 'string' && message.text.length > 0
      ? message.text
      : null

  const attachment = (message?.attachments ?? []).find(
    (a) => typeof a.payload?.url === 'string' && a.payload.url.length > 0,
  )

  if (attachment && attachment.payload?.url) {
    return {
      content,
      attachment: {
        url: attachment.payload.url,
        type: typeof attachment.type === 'string' ? attachment.type : '',
      },
    }
  }

  return { content, attachment: null }
}

/**
 * Maps a downloaded attachment to a stored message type, preferring the actual
 * MIME and falling back to the webhook's attachment type (share/story/reel etc).
 */
export function mimeToDbType(
  mime: string | null,
  attachmentType?: string,
): Exclude<IgDbMessageType, 'text'> {
  if (mime) {
    if (mime.startsWith('image/')) return 'image'
    if (mime.startsWith('video/')) return 'video'
    if (mime.startsWith('audio/')) return 'audio'
    if (mime === 'application/pdf') return 'document'
  }
  switch (attachmentType) {
    case 'image':
    case 'share':
    case 'story_mention':
    case 'story_reply':
      return 'image'
    case 'video':
    case 'ig_reel':
    case 'reel':
      return 'video'
    case 'audio':
      return 'audio'
    default:
      return 'document'
  }
}

/** Instagram messaging_seen reports the last-read message id as read.mid. */
export function extractReadMid(event: IgMessagingEvent): string | null {
  const mid = event.read?.mid
  return typeof mid === 'string' && mid.length > 0 ? mid : null
}

export function extensionFromMime(mime: string | null): string {
  switch (mime) {
    case 'image/jpeg':
      return '.jpg'
    case 'image/png':
      return '.png'
    case 'image/webp':
      return '.webp'
    case 'image/gif':
      return '.gif'
    case 'video/mp4':
      return '.mp4'
    case 'audio/mpeg':
      return '.mp3'
    case 'audio/mp4':
      return '.m4a'
    case 'audio/ogg':
      return '.ogg'
    case 'application/pdf':
      return '.pdf'
    default:
      return ''
  }
}

export function sanitizeFilenameSegment(name: string, maxLen: number): string {
  const cleaned = name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
  return cleaned.length > 0 ? cleaned : 'file'
}

// ─── Provider-event fingerprints ─────────────────────────────────────────────

export function igMessageFingerprint(mid: string): string {
  return `msg:${mid}`
}

export function igReactionFingerprint(event: IgMessagingEvent): string | null {
  const mid = event.reaction?.mid
  const sender = event.sender?.id
  if (!mid || !sender) return null
  const action = event.reaction?.action ?? 'react'
  return `reaction:${mid}:${sender}:${action}:${event.timestamp ?? 0}`
}

export function igReadFingerprint(event: IgMessagingEvent): string | null {
  const sender = event.sender?.id
  const mid = event.read?.mid
  if (!sender || !mid) return null
  return `read:${sender}:${mid}`
}

// ─── Full-message normalization ──────────────────────────────────────────────

export type IgNormalizedType =
  | 'text'
  | 'media'
  | 'share'
  | 'story_reply'
  | 'story_mention'
  | 'unsupported'

export interface NormalizedInstagramMessage {
  /** 'media' resolves to image/video/audio/document per attachment MIME. */
  type: IgNormalizedType
  content: string | null
  /** Every attachment, in order — not just the first one. */
  attachments: Array<{
    type: string
    url: string | null
    title: string | null
    stickerId: string | null
  }>
  externalReplyToId: string | null
  metadata: Record<string, unknown>
}

const SHARE_ATTACHMENT_TYPES = new Set(['share', 'ig_reel', 'reel', 'media_share'])

/**
 * Normalizes an inbound Instagram message keeping every attachment and the
 * structured story/share/reply context. Unsupported payloads stay explicit.
 */
export function normalizeInstagramMessage(
  message: IgMessage,
): NormalizedInstagramMessage {
  const metadata: Record<string, unknown> = {}
  const content =
    typeof message.text === 'string' && message.text.length > 0
      ? message.text
      : null

  const attachments = (message.attachments ?? []).map((attachment) => ({
    type: typeof attachment.type === 'string' ? attachment.type : 'unknown',
    url:
      typeof attachment.payload?.url === 'string' && attachment.payload.url.length > 0
        ? attachment.payload.url
        : null,
    title:
      typeof attachment.payload?.title === 'string'
        ? attachment.payload.title
        : null,
    stickerId:
      attachment.payload?.sticker_id !== undefined
        ? String(attachment.payload.sticker_id)
        : null,
  }))

  let externalReplyToId: string | null = null
  if (message.reply_to?.mid) {
    externalReplyToId = message.reply_to.mid
    metadata.quote = { external_id: message.reply_to.mid }
  }

  if (message.referral) {
    const referral = message.referral
    metadata.referral = {
      ...(referral.type ? { type: referral.type } : {}),
      ...(referral.source ? { source: referral.source } : {}),
      ...(referral.ref ? { ref: referral.ref } : {}),
      ...(referral.ads_context_data?.ad_title
        ? { ad_title: referral.ads_context_data.ad_title }
        : {}),
    }
  }

  if (message.is_unsupported) {
    metadata.unsupported = { kind: 'instagram_unsupported' }
    return { type: 'unsupported', content, attachments, externalReplyToId, metadata }
  }

  if (message.reply_to?.story) {
    metadata.story = {
      kind: 'reply',
      ...(message.reply_to.story.id ? { id: message.reply_to.story.id } : {}),
      ...(message.reply_to.story.url ? { url: message.reply_to.story.url } : {}),
    }
    return { type: 'story_reply', content, attachments, externalReplyToId, metadata }
  }

  if (attachments.some((a) => a.type === 'story_mention')) {
    const mention = attachments.find((a) => a.type === 'story_mention')
    metadata.story = {
      kind: 'mention',
      ...(mention?.url ? { url: mention.url } : {}),
    }
    return { type: 'story_mention', content, attachments, externalReplyToId, metadata }
  }

  const share = attachments.find((a) => SHARE_ATTACHMENT_TYPES.has(a.type))
  if (share) {
    metadata.share = {
      kind: share.type,
      ...(share.url ? { url: share.url } : {}),
      ...(share.title ? { title: share.title } : {}),
    }
    return { type: 'share', content, attachments, externalReplyToId, metadata }
  }

  if (attachments.length > 0) {
    return { type: 'media', content, attachments, externalReplyToId, metadata }
  }

  if (content !== null) {
    return { type: 'text', content, attachments, externalReplyToId, metadata }
  }

  metadata.unsupported = { kind: 'unknown_payload' }
  return { type: 'unsupported', content, attachments, externalReplyToId, metadata }
}
