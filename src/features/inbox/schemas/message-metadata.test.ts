import { describe, expect, it } from 'vitest'
import {
  effectiveRichMediaType,
  getChatMediaStoragePath,
  messageMediaMetadataSchema,
  parseMessageMediaMetadata,
} from './message-metadata'

describe('messageMediaMetadataSchema', () => {
  it('accepts a full metadata object', () => {
    const raw = {
      storage_path: 'ws/conv/abc-photo.jpg',
      file_name: 'photo.jpg',
      mime_type: 'image/jpeg',
      size: 1200,
      telegram_file_id: 'id',
      telegram_file_unique_id: 'uniq',
    }
    const r = messageMediaMetadataSchema.safeParse(raw)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.storage_path).toBe('ws/conv/abc-photo.jpg')
    }
  })

  it('parses empty object for text messages', () => {
    const r = messageMediaMetadataSchema.safeParse({})
    expect(r.success).toBe(true)
  })

  it('preserves extra keys with passthrough', () => {
    const r = messageMediaMetadataSchema.safeParse({ storage_path: 'a/b', future: 1 })
    expect(r.success).toBe(true)
    if (r.success) {
      expect((r.data as { future?: number }).future).toBe(1)
    }
  })
})

describe('parseMessageMediaMetadata', () => {
  it('returns null for invalid shapes', () => {
    expect(parseMessageMediaMetadata(null)).toBeNull()
    expect(parseMessageMediaMetadata(42)).toBeNull()
  })
})

describe('effectiveRichMediaType', () => {
  it('maps Telegram-style document + video/mp4 to video', () => {
    expect(
      effectiveRichMediaType('document', {
        mime_type: 'video/mp4',
        file_name: 'IMG_3907.MP4',
      }),
    ).toBe('video')
  })

  it('maps document + mp4 extension when mime is missing', () => {
    expect(
      effectiveRichMediaType('document', {
        mime_type: null,
        file_name: 'clip.mp4',
      }),
    ).toBe('video')
  })

  it('leaves generic documents unchanged', () => {
    expect(
      effectiveRichMediaType('document', {
        mime_type: 'application/pdf',
        file_name: 'spec.pdf',
      }),
    ).toBe('document')
  })

  it('maps document + application/x-tgsticker to sticker (existing rows)', () => {
    expect(
      effectiveRichMediaType('document', {
        mime_type: 'application/x-tgsticker',
        file_name: 'sticker.tgs',
      }),
    ).toBe('sticker')
  })

  it('does not remap non-document rows', () => {
    expect(effectiveRichMediaType('video', { mime_type: 'video/mp4' })).toBe('video')
  })
})

describe('getChatMediaStoragePath', () => {
  it('returns path for previewable media', () => {
    expect(
      getChatMediaStoragePath(
        { storage_path: 'w/c/file.pdf', upload_failed: false },
        'document',
      ),
    ).toBe('w/c/file.pdf')
  })

  it('returns null when upload failed', () => {
    expect(
      getChatMediaStoragePath(
        { storage_path: 'w/c/x', upload_failed: true },
        'image',
      ),
    ).toBeNull()
  })

  it('returns path for sticker type', () => {
    expect(
      getChatMediaStoragePath(
        { storage_path: 'w/c/sticker.tgs', upload_failed: false },
        'sticker',
      ),
    ).toBe('w/c/sticker.tgs')
  })

  it('returns null for text type', () => {
    expect(getChatMediaStoragePath({ storage_path: 'x' }, 'text')).toBeNull()
  })

  it('returns null when path missing', () => {
    expect(getChatMediaStoragePath({ upload_failed: false }, 'video')).toBeNull()
  })
})
