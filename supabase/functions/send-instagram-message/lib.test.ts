import { describe, expect, it } from 'vitest'
import {
  MESSAGING_WINDOW_MS,
  instagramAttachmentType,
  isSendableMessageType,
  isWithinMessagingWindow,
  textExceedsLimit,
} from './lib.ts'

describe('instagramAttachmentType', () => {
  it('maps image/video/audio (and voice -> audio)', () => {
    expect(instagramAttachmentType('image')).toBe('image')
    expect(instagramAttachmentType('video')).toBe('video')
    expect(instagramAttachmentType('audio')).toBe('audio')
    expect(instagramAttachmentType('voice')).toBe('audio')
  })

  it('returns null for unsupported types', () => {
    expect(instagramAttachmentType('document')).toBeNull()
    expect(instagramAttachmentType('sticker')).toBeNull()
    expect(instagramAttachmentType('text')).toBeNull()
  })
})

describe('isSendableMessageType', () => {
  it('allows text and supported attachments', () => {
    expect(isSendableMessageType('text')).toBe(true)
    expect(isSendableMessageType('image')).toBe(true)
    expect(isSendableMessageType('audio')).toBe(true)
  })

  it('rejects unsupported types', () => {
    expect(isSendableMessageType('document')).toBe(false)
    expect(isSendableMessageType('sticker')).toBe(false)
  })
})

describe('isWithinMessagingWindow', () => {
  const now = Date.parse('2026-07-22T12:00:00.000Z')

  it('accepts a recent inbound message', () => {
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString()
    expect(isWithinMessagingWindow(oneHourAgo, now)).toBe(true)
  })

  it('accepts exactly at the 24h boundary', () => {
    const boundary = new Date(now - MESSAGING_WINDOW_MS).toISOString()
    expect(isWithinMessagingWindow(boundary, now)).toBe(true)
  })

  it('rejects an inbound message older than 24h', () => {
    const old = new Date(now - MESSAGING_WINDOW_MS - 1000).toISOString()
    expect(isWithinMessagingWindow(old, now)).toBe(false)
  })

  it('rejects when there is no inbound message', () => {
    expect(isWithinMessagingWindow(null, now)).toBe(false)
    expect(isWithinMessagingWindow(undefined, now)).toBe(false)
    expect(isWithinMessagingWindow('not-a-date', now)).toBe(false)
  })
})

describe('textExceedsLimit', () => {
  it('accepts text at or under 1000 bytes', () => {
    expect(textExceedsLimit('a'.repeat(1000))).toBe(false)
  })

  it('rejects text over 1000 bytes (counting UTF-8 bytes)', () => {
    expect(textExceedsLimit('a'.repeat(1001))).toBe(true)
    // Multi-byte characters count by their encoded length.
    expect(textExceedsLimit('😀'.repeat(251))).toBe(true)
  })
})
