import { setLocale } from '@/paraglide/runtime'
import { beforeAll, describe, expect, it } from 'vitest'
import type { NotificationMessage } from '../model/types'
import { buildNotificationPreview } from './notification-preview'

function message(
  overrides: Partial<NotificationMessage> = {},
): NotificationMessage {
  return {
    id: 'm1',
    type: 'text',
    content: 'Hello there',
    metadata: {},
    media_filename: null,
    media_mime_type: null,
    created_at: new Date().toISOString(),
    direction: 'inbound',
    ...overrides,
  }
}

describe('buildNotificationPreview', () => {
  beforeAll(() => {
    setLocale('en')
  })

  it('full mode shows the contact name and message text', () => {
    const preview = buildNotificationPreview({
      contactName: 'Maria',
      message: message(),
      previewMode: 'full',
    })
    expect(preview.title).toBe('Maria')
    expect(preview.body).toBe('Hello there')
    expect(preview.truncated).toBe(false)
  })

  it('full mode flags long messages as truncated', () => {
    const long = 'x'.repeat(200)
    const preview = buildNotificationPreview({
      contactName: 'Maria',
      message: message({ content: long }),
      previewMode: 'full',
    })
    expect(preview.truncated).toBe(true)
    expect(preview.body.length).toBeLessThan(long.length)
  })

  it('full mode uses a localized media label when there is no text', () => {
    const preview = buildNotificationPreview({
      contactName: 'Maria',
      message: message({ type: 'image', content: null }),
      previewMode: 'full',
    })
    expect(preview.body).toBe('Photo')
  })

  it('maps a voice note to a localized label', () => {
    const preview = buildNotificationPreview({
      contactName: 'Maria',
      message: message({ type: 'voice', content: null }),
      previewMode: 'full',
    })
    expect(preview.body).toBe('Voice message')
  })

  it('sender_only mode hides the message text', () => {
    const preview = buildNotificationPreview({
      contactName: 'Maria',
      message: message(),
      previewMode: 'sender_only',
    })
    expect(preview.title).toBe('Maria')
    expect(preview.body).toBe('New message')
  })

  it('hidden mode hides both sender and content', () => {
    const preview = buildNotificationPreview({
      contactName: 'Maria',
      message: message(),
      previewMode: 'hidden',
    })
    expect(preview.title).toBe('New message')
    expect(preview.body).toBe('')
  })
})
