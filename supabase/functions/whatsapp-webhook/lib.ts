// Pure WhatsApp Cloud API payload classification and normalization. No I/O —
// index.ts owns signature verification, channel routing, media downloads, and
// persistence.

import type {
  NormalizedMessageType,
  ReactionOp,
  StatusEventStatus,
} from '../_shared/types.ts'
import { whatsappReactionOp } from '../_shared/reactions.ts'

// ─── WhatsApp Cloud API types (official subset) ──────────────────────────────

export interface WhatsappMediaObject {
  id: string
  mime_type?: string
  sha256?: string
  caption?: string
  filename?: string
  voice?: boolean
  animated?: boolean
}

export interface WhatsappLocation {
  latitude?: number
  longitude?: number
  name?: string
  address?: string
}

export interface WhatsappContactCard {
  name?: {
    formatted_name?: string
    first_name?: string
    last_name?: string
  }
  phones?: Array<{ phone?: string; wa_id?: string; type?: string }>
  emails?: Array<{ email?: string; type?: string }>
  org?: { company?: string; department?: string; title?: string }
  urls?: Array<{ url?: string; type?: string }>
  birthday?: string
}

export interface WhatsappInteractive {
  type?: string
  button_reply?: { id?: string; title?: string }
  list_reply?: { id?: string; title?: string; description?: string }
}

export interface WhatsappReferral {
  source_url?: string
  source_id?: string
  source_type?: string
  headline?: string
  body?: string
  media_type?: string
  ctwa_clid?: string
}

export interface WhatsappError {
  code?: number
  title?: string
  message?: string
  error_data?: { details?: string }
}

export interface WhatsappMessage {
  from?: string
  id?: string
  timestamp?: string
  type?: string
  context?: { from?: string; id?: string; forwarded?: boolean; frequently_forwarded?: boolean }
  text?: { body?: string }
  image?: WhatsappMediaObject
  video?: WhatsappMediaObject
  audio?: WhatsappMediaObject
  document?: WhatsappMediaObject
  sticker?: WhatsappMediaObject
  location?: WhatsappLocation
  contacts?: WhatsappContactCard[]
  interactive?: WhatsappInteractive
  button?: { payload?: string; text?: string }
  reaction?: { message_id?: string; emoji?: string }
  order?: Record<string, unknown>
  system?: { body?: string; type?: string; wa_id?: string }
  referral?: WhatsappReferral
  errors?: WhatsappError[]
}

export interface WhatsappStatus {
  id?: string
  status?: string
  timestamp?: string
  recipient_id?: string
  conversation?: { id?: string; origin?: { type?: string }; expiration_timestamp?: string }
  pricing?: { billable?: boolean; category?: string; pricing_model?: string }
  errors?: WhatsappError[]
}

export interface WhatsappContact {
  wa_id?: string
  profile?: { name?: string }
}

export interface WhatsappChangeValue {
  messaging_product?: string
  metadata?: { phone_number_id?: string; display_phone_number?: string }
  contacts?: WhatsappContact[]
  messages?: WhatsappMessage[]
  statuses?: WhatsappStatus[]
}

export interface WhatsappChange {
  field?: string
  value?: WhatsappChangeValue
}

export interface WhatsappEntry {
  id?: string
  changes?: WhatsappChange[]
}

export interface WhatsappWebhookBody {
  object?: string
  entry?: WhatsappEntry[]
}

// ─── Fingerprints ────────────────────────────────────────────────────────────

export function whatsappMessageFingerprint(wamid: string): string {
  return `msg:${wamid}`
}

/** One webhook body carries many status events; fingerprint each one. */
export function whatsappStatusFingerprint(wamid: string, status: string): string {
  return `status:${wamid}:${status}`
}

// ─── Media ───────────────────────────────────────────────────────────────────

export type WhatsappAttachmentKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'sticker'

export interface ResolvedWhatsappMedia {
  kind: WhatsappAttachmentKind
  media_id: string
  mime_type: string | null
  filename: string | null
  sha256: string | null
  animated: boolean | null
}

function resolveMediaObject(
  kind: WhatsappAttachmentKind,
  media: WhatsappMediaObject,
  fallbackMime: string,
): ResolvedWhatsappMedia {
  return {
    kind,
    media_id: media.id,
    mime_type: media.mime_type ?? fallbackMime,
    filename: media.filename ?? null,
    sha256: media.sha256 ?? null,
    animated: media.animated ?? null,
  }
}

// ─── Normalization ───────────────────────────────────────────────────────────

export interface NormalizedWhatsappMessage {
  type: NormalizedMessageType
  content: string | null
  media: ResolvedWhatsappMedia | null
  externalReplyToId: string | null
  providerTimestamp: string | null
  metadata: Record<string, unknown>
}

function epochStringToIso(timestamp: string | undefined): string | null {
  if (!timestamp) return null
  const seconds = Number(timestamp)
  if (!Number.isFinite(seconds)) return null
  return new Date(seconds * 1000).toISOString()
}

function contactCardToMetadata(card: WhatsappContactCard): Record<string, unknown> {
  const name =
    card.name?.formatted_name ??
    [card.name?.first_name, card.name?.last_name].filter(Boolean).join(' ')
  return {
    ...(name ? { name } : {}),
    ...(card.phones?.length
      ? {
          phones: card.phones
            .filter((p) => p.phone || p.wa_id)
            .map((p) => ({
              ...(p.phone ? { phone: p.phone } : {}),
              ...(p.wa_id ? { wa_id: p.wa_id } : {}),
              ...(p.type ? { type: p.type } : {}),
            })),
        }
      : {}),
    ...(card.emails?.length
      ? {
          emails: card.emails
            .filter((e) => e.email)
            .map((e) => ({
              email: e.email,
              ...(e.type ? { type: e.type } : {}),
            })),
        }
      : {}),
    ...(card.org?.company ? { company: card.org.company } : {}),
  }
}

export function sanitizeWhatsappErrors(
  errors: WhatsappError[] | undefined,
): Array<Record<string, unknown>> {
  return (errors ?? []).map((error) => ({
    ...(typeof error.code === 'number' ? { code: String(error.code) } : {}),
    ...(error.title ? { title: error.title } : {}),
    ...(error.message ? { message: error.message } : {}),
    ...(error.error_data?.details ? { details: error.error_data.details } : {}),
  }))
}

/**
 * Normalizes an inbound WhatsApp message. Every payload type gets an explicit
 * representation — nothing degrades to an empty text row.
 */
export function normalizeWhatsappMessage(
  message: WhatsappMessage,
): NormalizedWhatsappMessage {
  const metadata: Record<string, unknown> = {}
  const providerTimestamp = epochStringToIso(message.timestamp)

  if (message.id) {
    metadata.whatsapp = { message_id: message.id }
  }

  let externalReplyToId: string | null = null
  if (message.context?.id) {
    externalReplyToId = message.context.id
    metadata.quote = {
      external_id: message.context.id,
      ...(message.context.from ? { author_external_id: message.context.from } : {}),
    }
  }
  if (message.context?.forwarded || message.context?.frequently_forwarded) {
    metadata.forward_origin = {
      type: 'forwarded',
      ...(message.context.frequently_forwarded ? { frequently_forwarded: true } : {}),
    }
  }

  if (message.referral) {
    const referral = message.referral
    metadata.referral = {
      ...(referral.source_type ? { source_type: referral.source_type } : {}),
      ...(referral.source_id ? { source_id: referral.source_id } : {}),
      ...(referral.source_url ? { source_url: referral.source_url } : {}),
      ...(referral.headline ? { headline: referral.headline } : {}),
      ...(referral.body ? { body: referral.body } : {}),
      ...(referral.media_type ? { media_type: referral.media_type } : {}),
      ...(referral.ctwa_clid ? { ctwa_clid: referral.ctwa_clid } : {}),
    }
  }

  const finish = (
    type: NormalizedMessageType,
    content: string | null,
    media: ResolvedWhatsappMedia | null = null,
  ): NormalizedWhatsappMessage => ({
    type,
    content,
    media,
    externalReplyToId,
    providerTimestamp,
    metadata,
  })

  switch (message.type) {
    case 'text':
      return finish('text', message.text?.body ?? null)
    case 'image':
      if (!message.image?.id) break
      return finish(
        'image',
        message.image.caption ?? null,
        resolveMediaObject('image', message.image, 'image/jpeg'),
      )
    case 'video':
      if (!message.video?.id) break
      return finish(
        'video',
        message.video.caption ?? null,
        resolveMediaObject('video', message.video, 'video/mp4'),
      )
    case 'audio': {
      if (!message.audio?.id) break
      const kind = message.audio.voice ? 'voice' : 'audio'
      return finish(kind, null, resolveMediaObject(kind, message.audio, 'audio/ogg'))
    }
    case 'document':
      if (!message.document?.id) break
      return finish(
        'document',
        message.document.caption ?? null,
        resolveMediaObject('document', message.document, 'application/octet-stream'),
      )
    case 'sticker':
      if (!message.sticker?.id) break
      return finish(
        'sticker',
        null,
        resolveMediaObject('sticker', message.sticker, 'image/webp'),
      )
    case 'location': {
      const location = message.location
      if (
        typeof location?.latitude !== 'number' ||
        typeof location?.longitude !== 'number'
      ) {
        break
      }
      metadata.location = {
        kind: location.name || location.address ? 'venue' : 'point',
        latitude: location.latitude,
        longitude: location.longitude,
        ...(location.name ? { name: location.name } : {}),
        ...(location.address ? { address: location.address } : {}),
      }
      return finish('location', null)
    }
    case 'contacts': {
      const cards = (message.contacts ?? []).map(contactCardToMetadata)
      if (cards.length === 0) break
      metadata.contacts = cards
      return finish('contact', null)
    }
    case 'interactive': {
      const interactive = message.interactive
      if (interactive?.button_reply?.id) {
        metadata.interactive = {
          kind: 'button_reply',
          id: interactive.button_reply.id,
          ...(interactive.button_reply.title
            ? { title: interactive.button_reply.title }
            : {}),
        }
        return finish('interactive', interactive.button_reply.title ?? null)
      }
      if (interactive?.list_reply?.id) {
        metadata.interactive = {
          kind: 'list_reply',
          id: interactive.list_reply.id,
          ...(interactive.list_reply.title
            ? { title: interactive.list_reply.title }
            : {}),
          ...(interactive.list_reply.description
            ? { description: interactive.list_reply.description }
            : {}),
        }
        return finish('interactive', interactive.list_reply.title ?? null)
      }
      break
    }
    case 'button': {
      const button = message.button
      if (!button?.payload && !button?.text) break
      metadata.interactive = {
        kind: 'button_reply',
        ...(button.payload ? { id: button.payload } : {}),
        ...(button.text ? { title: button.text } : {}),
      }
      return finish('interactive', button.text ?? null)
    }
    case 'order':
      metadata.unsupported = { kind: 'order' }
      return finish('unsupported', null)
    case 'system':
      metadata.system = {
        kind: message.system?.type ?? 'system',
        ...(message.system?.body ? { body: message.system.body } : {}),
      }
      return finish('system', null)
    case 'unsupported':
      metadata.unsupported = {
        kind: 'unsupported',
        ...(message.errors?.length
          ? { provider_errors: sanitizeWhatsappErrors(message.errors) }
          : {}),
      }
      return finish('unsupported', null)
    default:
      break
  }

  metadata.unsupported = {
    kind: message.type ?? 'unknown_payload',
    ...(message.errors?.length
      ? { provider_errors: sanitizeWhatsappErrors(message.errors) }
      : {}),
  }
  return finish('unsupported', null)
}

// ─── Reactions ───────────────────────────────────────────────────────────────

export interface NormalizedWhatsappReaction {
  targetProviderMessageId: string
  reactorExternalId: string
  op: ReactionOp | null
}

export function normalizeWhatsappReaction(
  message: WhatsappMessage,
): NormalizedWhatsappReaction | null {
  if (message.type !== 'reaction') return null
  const targetProviderMessageId = message.reaction?.message_id
  const reactorExternalId = message.from?.trim()
  if (!targetProviderMessageId || !reactorExternalId) return null
  return {
    targetProviderMessageId,
    reactorExternalId,
    op: whatsappReactionOp({
      reactorExternalId,
      emoji: message.reaction?.emoji,
      providerTimestamp: epochStringToIso(message.timestamp),
    }),
  }
}

// ─── Statuses ────────────────────────────────────────────────────────────────

export interface NormalizedWhatsappStatus {
  externalId: string
  status: StatusEventStatus
  providerTimestamp: string | null
  errorCode: string | null
  errorDetail: string | null
  metadata: Record<string, unknown>
}

const STATUS_MAP: Record<string, StatusEventStatus> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  played: 'played',
  failed: 'failed',
  deleted: 'deleted',
}

export function normalizeWhatsappStatus(
  status: WhatsappStatus,
): NormalizedWhatsappStatus | null {
  if (!status.id || !status.status) return null
  const mapped = STATUS_MAP[status.status] ?? 'unknown'
  const errors = sanitizeWhatsappErrors(status.errors)
  const metadata: Record<string, unknown> = {
    ...(status.conversation?.id
      ? {
          conversation: {
            id: status.conversation.id,
            ...(status.conversation.origin?.type
              ? { origin: status.conversation.origin.type }
              : {}),
            ...(status.conversation.expiration_timestamp
              ? {
                  expires_at: epochStringToIso(
                    status.conversation.expiration_timestamp,
                  ),
                }
              : {}),
          },
        }
      : {}),
    ...(status.pricing?.category
      ? {
          pricing: {
            category: status.pricing.category,
            ...(status.pricing.billable !== undefined
              ? { billable: status.pricing.billable }
              : {}),
          },
        }
      : {}),
    ...(errors.length > 0 ? { provider_errors: errors } : {}),
    ...(status.recipient_id ? { recipient_id: status.recipient_id } : {}),
  }
  const firstError = errors[0]
  return {
    externalId: status.id,
    status: mapped,
    providerTimestamp: epochStringToIso(status.timestamp),
    errorCode: typeof firstError?.code === 'string' ? firstError.code : null,
    errorDetail:
      typeof firstError?.details === 'string'
        ? firstError.details
        : typeof firstError?.title === 'string'
          ? firstError.title
          : null,
    metadata,
  }
}

// ─── Identity ────────────────────────────────────────────────────────────────

export function buildWhatsappProfile(args: {
  waId: string
  profileName: string | null
  referral?: WhatsappReferral | null
}): Record<string, unknown> {
  return {
    wa_id: args.waId,
    phone: `+${args.waId}`,
    ...(args.profileName ? { profile_name: args.profileName } : {}),
    ...(args.referral?.source_type
      ? {
          referral: {
            source_type: args.referral.source_type,
            ...(args.referral.source_id ? { source_id: args.referral.source_id } : {}),
            ...(args.referral.ctwa_clid ? { ctwa_clid: args.referral.ctwa_clid } : {}),
          },
        }
      : {}),
  }
}
