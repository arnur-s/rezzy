// Pure, Deno-free helpers for send-instagram-message. Import-safe for Vitest.

/** Instagram Send API accepts text plus image/video/audio attachments only. */
export function instagramAttachmentType(
  messageType: string,
): 'image' | 'video' | 'audio' | null {
  switch (messageType) {
    case 'image':
      return 'image'
    case 'video':
      return 'video'
    case 'audio':
    case 'voice':
      return 'audio'
    default:
      return null
  }
}

/** Whether a stored message type can be sent through Instagram at all. */
export function isSendableMessageType(messageType: string): boolean {
  return messageType === 'text' || instagramAttachmentType(messageType) !== null
}

/**
 * Instagram only permits replies within 24 hours of the customer's last inbound
 * message. Enforce from the latest INBOUND message time, never last_message_at
 * (which may point at an outbound message).
 */
export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000

export function isWithinMessagingWindow(
  lastInboundIso: string | null | undefined,
  nowMs: number,
): boolean {
  if (!lastInboundIso) return false
  const parsed = Date.parse(lastInboundIso)
  if (Number.isNaN(parsed)) return false
  return nowMs - parsed <= MESSAGING_WINDOW_MS
}

/** Instagram message text must be UTF-8 and at most 1000 bytes. */
export const TEXT_MAX_BYTES = 1000

export function textByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

export function textExceedsLimit(text: string): boolean {
  return textByteLength(text) > TEXT_MAX_BYTES
}
