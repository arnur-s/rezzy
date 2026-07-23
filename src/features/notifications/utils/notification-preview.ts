import { isMessageType } from '@/entities/message'
import type { MessageType } from '@/entities/message'
import {
  effectiveRichMediaType,
  parseMessageMediaMetadata,
} from '@/features/inbox/schemas/message-metadata'
import { m } from '@/paraglide/messages'
import type { MessagePreviewMode, NotificationMessage } from '../model/types'

const PREVIEW_MAX_LENGTH = 140

const MEDIA_LABELS: Record<Exclude<MessageType, 'text'>, () => string> = {
  image: () => m.notifications_preview_photo(),
  video: () => m.notifications_preview_video(),
  voice: () => m.notifications_preview_voice(),
  audio: () => m.notifications_preview_audio(),
  document: () => m.notifications_preview_document(),
  sticker: () => m.notifications_preview_sticker(),
  location: () => m.inbox_message_type_location(),
  contact: () => m.inbox_message_type_contact(),
  interactive: () => m.inbox_message_type_interactive(),
  share: () => m.inbox_message_type_share(),
  story_reply: () => m.inbox_message_type_story_reply(),
  story_mention: () => m.inbox_message_type_story_mention(),
  system: () => m.inbox_message_type_system(),
  unsupported: () => m.inbox_message_type_unsupported(),
}

function resolveMediaLabel(message: NotificationMessage): string {
  const rowType: MessageType =
    message.type && isMessageType(message.type) ? message.type : 'text'
  if (rowType === 'text') return m.notifications_new_message()
  const effective = effectiveRichMediaType(
    rowType,
    parseMessageMediaMetadata(message.metadata),
    message.media_mime_type,
    message.media_filename,
  )
  if (effective === 'text') return m.notifications_new_message()
  return MEDIA_LABELS[effective]()
}

/** Localized description of a message's content (privacy mode aside). */
export function describeMessage(message: NotificationMessage): string {
  const trimmed = message.content?.trim()
  if (trimmed) {
    return trimmed.length > PREVIEW_MAX_LENGTH
      ? `${trimmed.slice(0, PREVIEW_MAX_LENGTH).trimEnd()}…`
      : trimmed
  }
  return resolveMediaLabel(message)
}

export type NotificationPreview = {
  /** Primary line — contact name, or a generic label under stricter privacy. */
  title: string
  /** Secondary line — message preview, generic label, or empty when hidden. */
  body: string
  /** True when the full message is longer than the shown body. */
  truncated: boolean
}

/**
 * Build the title/body shown in a notification, honoring the privacy mode.
 *   full        -> contact name + message preview
 *   sender_only -> contact name + generic "New message"
 *   hidden      -> generic label, no contact or content
 */
export function buildNotificationPreview({
  contactName,
  message,
  previewMode,
}: {
  contactName: string | null
  message: NotificationMessage
  previewMode: MessagePreviewMode
}): NotificationPreview {
  const name = contactName?.trim() || null

  if (previewMode === 'hidden') {
    return { title: m.notifications_new_message(), body: '', truncated: false }
  }

  if (previewMode === 'sender_only') {
    return {
      title: name ?? m.notifications_new_message(),
      body: m.notifications_new_message(),
      truncated: false,
    }
  }

  const content = message.content?.trim() ?? ''
  return {
    title: name ?? m.notifications_new_message(),
    body: describeMessage(message),
    truncated: content.length > PREVIEW_MAX_LENGTH,
  }
}
