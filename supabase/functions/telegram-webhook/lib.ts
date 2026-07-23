// Pure Telegram update classification and normalization. No I/O — the webhook
// index.ts owns channel resolution, media downloads, and persistence.

import type {
  AttachmentKind,
  NormalizedMessageType,
  ReactionOp,
} from '../_shared/types.ts'
import { diffTelegramReactionSets } from '../_shared/reactions.ts'

// ─── Telegram types (official Bot API subset) ────────────────────────────────

export interface TelegramUser {
  id: number
  is_bot?: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

export interface TelegramChat {
  id: number
  type?: 'private' | 'group' | 'supergroup' | 'channel'
  title?: string
  first_name?: string
  last_name?: string
  username?: string
}

export interface TelegramPhotoSize {
  file_id: string
  file_unique_id: string
  width?: number
  height?: number
  file_size?: number
}

export interface TelegramVideo {
  file_id: string
  file_unique_id: string
  width?: number
  height?: number
  duration?: number
  mime_type?: string
  file_name?: string
  file_size?: number
}

export interface TelegramAudio {
  file_id: string
  file_unique_id: string
  duration?: number
  mime_type?: string
  file_name?: string
  file_size?: number
}

export interface TelegramVoice {
  file_id: string
  file_unique_id: string
  duration?: number
  mime_type?: string
  file_size?: number
}

export interface TelegramDocument {
  file_id: string
  file_unique_id: string
  mime_type?: string
  file_name?: string
  file_size?: number
}

/** https://core.telegram.org/bots/api#sticker */
export interface TelegramSticker {
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
export interface TelegramAnimation {
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
export interface TelegramVideoNote {
  file_id: string
  file_unique_id: string
  length?: number
  duration?: number
  file_size?: number
}

/** https://core.telegram.org/bots/api#messageentity */
export interface TelegramMessageEntity {
  type: string
  offset: number
  length: number
  url?: string
  user?: TelegramUser
  language?: string
  custom_emoji_id?: string
}

export interface TelegramContact {
  phone_number?: string
  first_name?: string
  last_name?: string
  user_id?: number
  vcard?: string
}

export interface TelegramLocation {
  latitude: number
  longitude: number
  horizontal_accuracy?: number
  live_period?: number
  heading?: number
}

export interface TelegramVenue {
  location: TelegramLocation
  title?: string
  address?: string
  foursquare_id?: string
  google_place_id?: string
}

export interface TelegramPollOption {
  text?: string
  voter_count?: number
}

export interface TelegramPoll {
  id?: string
  question?: string
  options?: TelegramPollOption[]
  is_anonymous?: boolean
  type?: string
}

/** https://core.telegram.org/bots/api#messageorigin */
export interface TelegramMessageOrigin {
  type: 'user' | 'hidden_user' | 'chat' | 'channel'
  date?: number
  sender_user?: TelegramUser
  sender_user_name?: string
  sender_chat?: TelegramChat
  chat?: TelegramChat
  message_id?: number
  author_signature?: string
}

export interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date: number
  edit_date?: number
  text?: string
  caption?: string
  entities?: TelegramMessageEntity[]
  caption_entities?: TelegramMessageEntity[]
  reply_to_message?: TelegramMessage
  forward_origin?: TelegramMessageOrigin
  media_group_id?: string
  via_bot?: TelegramUser
  photo?: TelegramPhotoSize[]
  video?: TelegramVideo
  animation?: TelegramAnimation
  audio?: TelegramAudio
  voice?: TelegramVoice
  video_note?: TelegramVideoNote
  document?: TelegramDocument
  sticker?: TelegramSticker
  contact?: TelegramContact
  location?: TelegramLocation
  venue?: TelegramVenue
  poll?: TelegramPoll
  dice?: { emoji?: string; value?: number }
  new_chat_members?: TelegramUser[]
  left_chat_member?: TelegramUser
  new_chat_title?: string
  new_chat_photo?: TelegramPhotoSize[]
  delete_chat_photo?: boolean
  pinned_message?: TelegramMessage
  business_connection_id?: string
}

/** https://core.telegram.org/bots/api#reactiontype */
export interface TelegramReactionType {
  type: 'emoji' | 'custom_emoji' | 'paid'
  emoji?: string
  custom_emoji_id?: string
}

/** https://core.telegram.org/bots/api#messagereactionupdated */
export interface TelegramMessageReactionUpdated {
  chat: TelegramChat
  message_id: number
  user?: TelegramUser
  actor_chat?: TelegramChat
  date: number
  old_reaction: TelegramReactionType[]
  new_reaction: TelegramReactionType[]
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  business_message?: TelegramMessage
  edited_business_message?: TelegramMessage
  channel_post?: TelegramMessage
  edited_channel_post?: TelegramMessage
  message_reaction?: TelegramMessageReactionUpdated
  callback_query?: Record<string, unknown>
  poll_answer?: Record<string, unknown>
  my_chat_member?: Record<string, unknown>
  business_connection?: Record<string, unknown>
  deleted_business_messages?: Record<string, unknown>
}

// ─── Classification ──────────────────────────────────────────────────────────

export type TelegramClassification =
  | { kind: 'message'; eventType: 'message'; message: TelegramMessage }
  | { kind: 'edited_message'; eventType: 'edited_message'; message: TelegramMessage }
  | {
      kind: 'reaction'
      eventType: 'reaction'
      reaction: TelegramMessageReactionUpdated
    }
  | { kind: 'ignored'; eventType: string; reason: string }
  | { kind: 'empty'; eventType: 'unknown' }

function isPrivateChat(chat: TelegramChat | undefined): boolean {
  // Older updates may omit chat.type; a positive id is a user (private) chat,
  // groups/channels are negative.
  if (!chat) return false
  if (chat.type) return chat.type === 'private'
  return chat.id > 0
}

/**
 * Classifies a Telegram update into the events this product handles. The
 * product boundary is private customer conversations: group/channel/business
 * traffic is deliberately recorded as ignored provider events.
 */
export function classifyTelegramUpdate(
  update: TelegramUpdate,
): TelegramClassification {
  if (update.message) {
    if (!update.message.chat?.id) return { kind: 'empty', eventType: 'unknown' }
    if (!isPrivateChat(update.message.chat)) {
      return {
        kind: 'ignored',
        eventType: 'message',
        reason: 'non_private_chat',
      }
    }
    return { kind: 'message', eventType: 'message', message: update.message }
  }
  if (update.edited_message) {
    if (!isPrivateChat(update.edited_message.chat)) {
      return {
        kind: 'ignored',
        eventType: 'edited_message',
        reason: 'non_private_chat',
      }
    }
    return {
      kind: 'edited_message',
      eventType: 'edited_message',
      message: update.edited_message,
    }
  }
  if (update.message_reaction) {
    if (!isPrivateChat(update.message_reaction.chat)) {
      return {
        kind: 'ignored',
        eventType: 'reaction',
        reason: 'non_private_chat',
      }
    }
    return {
      kind: 'reaction',
      eventType: 'reaction',
      reaction: update.message_reaction,
    }
  }
  const ignoredTypes: Array<[keyof TelegramUpdate, string]> = [
    ['business_message', 'business_messages_not_configured'],
    ['edited_business_message', 'business_messages_not_configured'],
    ['deleted_business_messages', 'business_messages_not_configured'],
    ['business_connection', 'business_messages_not_configured'],
    ['channel_post', 'channel_out_of_scope'],
    ['edited_channel_post', 'channel_out_of_scope'],
    ['callback_query', 'callback_query_out_of_scope'],
    ['poll_answer', 'poll_answers_out_of_scope'],
    ['my_chat_member', 'membership_event_out_of_scope'],
  ]
  for (const [key, reason] of ignoredTypes) {
    if (update[key] !== undefined) {
      return { kind: 'ignored', eventType: String(key), reason }
    }
  }
  return { kind: 'empty', eventType: 'unknown' }
}

export function telegramUpdateFingerprint(update: TelegramUpdate): string | null {
  return typeof update.update_id === 'number'
    ? `update:${update.update_id}`
    : null
}

// ─── Media resolution (unchanged behavior, extended metadata) ────────────────

export type DbMessageType = NormalizedMessageType

export interface ResolvedMedia {
  dbType: AttachmentKind
  file_id: string
  file_unique_id: string | null
  file_name: string | null
  mime_type: string | null
  size: number | null
  width?: number
  height?: number
  duration?: number
  emoji?: string
  set_name?: string
}

export function inferDocumentDbType(
  mime: string | null,
  fileName: string | null,
): AttachmentKind {
  const mt = mime?.trim().toLowerCase() ?? ''
  if (mt === 'application/x-tgsticker') return 'sticker'
  if (mt.startsWith('video/')) return 'video'
  if (mt.startsWith('audio/')) return 'audio'
  if (mt.startsWith('image/')) return 'image'
  const lower = fileName?.toLowerCase() ?? ''
  const ext = lower.includes('.') ? (lower.split('.').pop() ?? '') : ''
  if (!ext) return 'document'
  if (ext === 'tgs') return 'sticker'
  const video = new Set(['mp4', 'm4v', 'webm', 'mov', 'mkv', 'avi', '3gp', '3g2'])
  const audio = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'wma'])
  const image = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tif', 'tiff',
  ])
  if (video.has(ext)) return 'video'
  if (audio.has(ext)) return 'audio'
  if (image.has(ext)) return 'image'
  return 'document'
}

export function resolveTelegramMedia(
  message: TelegramMessage,
): ResolvedMedia | null {
  const photos = message.photo
  if (photos?.length) {
    const largest = photos[photos.length - 1]
    return {
      dbType: 'image',
      file_id: largest.file_id,
      file_unique_id: largest.file_unique_id ?? null,
      file_name: null,
      mime_type: 'image/jpeg',
      size: largest.file_size ?? null,
      width: largest.width,
      height: largest.height,
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
      width: v.width,
      height: v.height,
      duration: v.duration,
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
      width: a.width,
      height: a.height,
      duration: a.duration,
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
      duration: a.duration,
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
      duration: v.duration,
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
      width: vn.length,
      height: vn.length,
      duration: vn.duration,
    }
  }
  if (message.sticker) {
    const s = message.sticker
    const base = {
      file_id: s.file_id,
      file_unique_id: s.file_unique_id ?? null,
      size: s.file_size ?? null,
      width: s.width,
      height: s.height,
      emoji: s.emoji,
      set_name: s.set_name,
    }
    if (s.is_video === true) {
      return {
        dbType: 'sticker',
        ...base,
        file_name: 'sticker.webm',
        mime_type: 'video/webm',
      }
    }
    if (s.is_animated === true) {
      return {
        dbType: 'sticker',
        ...base,
        file_name: 'sticker.tgs',
        mime_type: 'application/x-tgsticker',
      }
    }
    return {
      dbType: 'sticker',
      ...base,
      file_name: 'sticker.webp',
      mime_type: 'image/webp',
    }
  }
  if (message.document) {
    const d = message.document
    return {
      dbType: inferDocumentDbType(d.mime_type ?? null, d.file_name ?? null),
      file_id: d.file_id,
      file_unique_id: d.file_unique_id ?? null,
      file_name: d.file_name ?? null,
      mime_type: d.mime_type ?? null,
      size: d.file_size ?? null,
    }
  }
  return null
}

// ─── Normalization ───────────────────────────────────────────────────────────

export interface NormalizedTelegramMessage {
  type: NormalizedMessageType
  content: string | null
  media: ResolvedMedia | null
  externalReplyToId: string | null
  providerTimestamp: string | null
  /** Structured metadata namespaces merged into messages.metadata. */
  metadata: Record<string, unknown>
}

function epochToIso(epochSeconds: number | undefined): string | null {
  if (typeof epochSeconds !== 'number' || !Number.isFinite(epochSeconds)) {
    return null
  }
  return new Date(epochSeconds * 1000).toISOString()
}

function quotePreview(message: TelegramMessage): string | null {
  const text = message.text ?? message.caption
  if (text?.trim()) return text.trim().slice(0, 160)
  return null
}

function contactCard(contact: TelegramContact): Record<string, unknown> {
  return {
    ...(contact.first_name ? { first_name: contact.first_name } : {}),
    ...(contact.last_name ? { last_name: contact.last_name } : {}),
    ...(contact.phone_number ? { phone: contact.phone_number } : {}),
    ...(typeof contact.user_id === 'number'
      ? { telegram_user_id: String(contact.user_id) }
      : {}),
    ...(contact.vcard ? { vcard: contact.vcard } : {}),
  }
}

function serviceEventKind(message: TelegramMessage): string | null {
  if (message.new_chat_members?.length) return 'members_joined'
  if (message.left_chat_member) return 'member_left'
  if (message.new_chat_title) return 'chat_title_changed'
  if (message.new_chat_photo?.length) return 'chat_photo_changed'
  if (message.delete_chat_photo) return 'chat_photo_deleted'
  if (message.pinned_message) return 'message_pinned'
  return null
}

/**
 * Normalizes an inbound Telegram message into the cross-provider message
 * shape. Unknown payloads become explicit `unsupported` messages that keep
 * their provider object in provider_events — never empty text rows.
 */
export function normalizeTelegramMessage(
  message: TelegramMessage,
  updateId: number | null,
): NormalizedTelegramMessage {
  const metadata: Record<string, unknown> = {}

  const telegramIds: Record<string, unknown> = {
    message_id: message.message_id,
    ...(updateId !== null ? { update_id: updateId } : {}),
  }

  const entities = message.entities ?? message.caption_entities
  if (entities?.length) {
    metadata.entities = entities.map((entity) => ({
      type: entity.type,
      offset: entity.offset,
      length: entity.length,
      ...(entity.url ? { url: entity.url } : {}),
      ...(entity.user ? { user_id: String(entity.user.id) } : {}),
      ...(entity.language ? { language: entity.language } : {}),
      ...(entity.custom_emoji_id
        ? { custom_emoji_id: entity.custom_emoji_id }
        : {}),
    }))
  }

  if (message.forward_origin) {
    const origin = message.forward_origin
    metadata.forward_origin = {
      type: origin.type,
      ...(origin.date ? { date: epochToIso(origin.date) } : {}),
      ...(origin.sender_user
        ? {
            sender_user_id: String(origin.sender_user.id),
            sender_name: [origin.sender_user.first_name, origin.sender_user.last_name]
              .filter(Boolean)
              .join(' '),
          }
        : {}),
      ...(origin.sender_user_name ? { sender_name: origin.sender_user_name } : {}),
      ...(origin.chat?.title || origin.sender_chat?.title
        ? { chat_title: origin.chat?.title ?? origin.sender_chat?.title }
        : {}),
    }
  }

  if (message.media_group_id) {
    metadata.media_group_id = message.media_group_id
  }

  let externalReplyToId: string | null = null
  if (message.reply_to_message) {
    externalReplyToId = String(message.reply_to_message.message_id)
    const preview = quotePreview(message.reply_to_message)
    metadata.quote = {
      external_id: externalReplyToId,
      ...(preview ? { preview } : {}),
      ...(message.reply_to_message.from
        ? {
            author_external_id: String(message.reply_to_message.from.id),
            author_name: [
              message.reply_to_message.from.first_name,
              message.reply_to_message.from.last_name,
            ]
              .filter(Boolean)
              .join(' '),
          }
        : {}),
    }
  }

  const providerTimestamp = epochToIso(message.date)
  const content = message.caption ?? message.text ?? null

  const finish = (
    type: NormalizedMessageType,
    media: ResolvedMedia | null = null,
  ): NormalizedTelegramMessage => {
    metadata.telegram = { ...telegramIds }
    return { type, content, media, externalReplyToId, providerTimestamp, metadata }
  }

  if (message.contact) {
    metadata.contacts = [contactCard(message.contact)]
    return finish('contact')
  }

  if (message.venue) {
    const venue = message.venue
    metadata.location = {
      kind: 'venue',
      latitude: venue.location?.latitude,
      longitude: venue.location?.longitude,
      ...(venue.title ? { name: venue.title } : {}),
      ...(venue.address ? { address: venue.address } : {}),
      ...(venue.google_place_id ? { place_id: venue.google_place_id } : {}),
      ...(venue.foursquare_id ? { foursquare_id: venue.foursquare_id } : {}),
    }
    return finish('location')
  }

  if (message.location) {
    const location = message.location
    metadata.location = {
      kind: typeof location.live_period === 'number' ? 'live' : 'point',
      latitude: location.latitude,
      longitude: location.longitude,
      ...(typeof location.live_period === 'number'
        ? { live_period_seconds: location.live_period }
        : {}),
      ...(typeof location.horizontal_accuracy === 'number'
        ? { accuracy_meters: location.horizontal_accuracy }
        : {}),
    }
    return finish('location')
  }

  if (message.poll) {
    metadata.unsupported = {
      kind: 'poll',
      ...(message.poll.question ? { preview: message.poll.question } : {}),
    }
    return finish('unsupported')
  }

  if (message.dice) {
    metadata.unsupported = {
      kind: 'dice',
      ...(message.dice.emoji ? { preview: message.dice.emoji } : {}),
    }
    return finish('unsupported')
  }

  const serviceKind = serviceEventKind(message)
  if (serviceKind) {
    metadata.system = { kind: serviceKind }
    return finish('system')
  }

  const media = resolveTelegramMedia(message)
  if (media) {
    return finish(
      media.dbType === 'file' ? 'document' : (media.dbType as NormalizedMessageType),
      media,
    )
  }

  if (typeof message.text === 'string') {
    return finish('text')
  }

  metadata.unsupported = { kind: 'unknown_payload' }
  return finish('unsupported')
}

// ─── Identity ────────────────────────────────────────────────────────────────

/** Display name for CRM; Telegram sendMessage uses chat.id, not from.id. */
export function resolveExternalName(message: TelegramMessage): string {
  const from = message.from
  if (from) {
    const full = [from.first_name, from.last_name].filter(Boolean).join(' ') || null
    if (full) return full
    if (from.username) return from.username
  }
  if (message.chat.title?.trim()) return message.chat.title.trim()
  const chatName = [message.chat.first_name, message.chat.last_name]
    .filter(Boolean)
    .join(' ')
  if (chatName) return chatName
  return 'Unknown'
}

/** Officially supplied identity fields for contact_channels.profile. */
export function buildTelegramProfile(
  from: TelegramUser | undefined,
  businessConnectionId?: string,
): Record<string, unknown> {
  if (!from) return {}
  return {
    user_id: String(from.id),
    first_name: from.first_name,
    ...(from.last_name ? { last_name: from.last_name } : {}),
    ...(from.username ? { username: from.username } : {}),
    ...(from.language_code ? { language_code: from.language_code } : {}),
    ...(from.is_premium !== undefined ? { is_premium: from.is_premium } : {}),
    ...(from.is_bot !== undefined ? { is_bot: from.is_bot } : {}),
    ...(businessConnectionId
      ? { business_connection_id: businessConnectionId }
      : {}),
  }
}

// ─── Reactions ───────────────────────────────────────────────────────────────

function reactionIdentifier(reaction: TelegramReactionType): string | null {
  if (reaction.type === 'emoji') return reaction.emoji ?? null
  if (reaction.type === 'custom_emoji') {
    return reaction.custom_emoji_id ? `custom:${reaction.custom_emoji_id}` : null
  }
  if (reaction.type === 'paid') return '⭐'
  return null
}

export function normalizeTelegramReaction(
  reaction: TelegramMessageReactionUpdated,
): { reactorExternalId: string; ops: ReactionOp[] } | null {
  const reactorId = reaction.user?.id ?? reaction.actor_chat?.id
  if (reactorId === undefined) return null
  const reactorExternalId = String(reactorId)
  const toIdentifiers = (list: TelegramReactionType[]): string[] =>
    list
      .map((item) => reactionIdentifier(item))
      .filter((value): value is string => value !== null)
  const ops = diffTelegramReactionSets({
    reactorExternalId,
    isFromContact: true,
    oldEmojis: toIdentifiers(reaction.old_reaction ?? []),
    newEmojis: toIdentifiers(reaction.new_reaction ?? []),
    providerTimestamp: epochToIso(reaction.date),
  })
  return { reactorExternalId, ops }
}
