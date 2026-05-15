import { describe, expect, it } from 'vitest'
import {
  effectiveRichMediaType,
  getChatMediaStoragePath,
  messageMediaMetadataSchema,
  parseMessageMediaMetadata,
} from './message-metadata'

describe('messageMediaMetadataSchema', () => {
  const workspaceId = '11111111-1111-4111-8111-111111111111'
  const conversationId = '22222222-2222-4222-8222-222222222222'
  const messageId = '33333333-3333-4333-8333-333333333333'

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
    const r = messageMediaMetadataSchema.safeParse({
      storage_path: 'a/b',
      future: 1,
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect((r.data as { future?: number }).future).toBe(1)
    }
  })

  it('accepts nested provider metadata for Telegram details', () => {
    const r = messageMediaMetadataSchema.safeParse({
      telegram: {
        file_id: 'file-id',
        file_unique_id: 'unique-id',
        file_path: 'photos/file_1.jpg',
        width: 640,
        height: 480,
        duration: 12,
      },
      upload_failed: false,
    })

    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.telegram?.file_id).toBe('file-id')
      expect(r.data.telegram?.width).toBe(640)
    }
  })

  it('rejects invalid nested Telegram metadata shapes', () => {
    const r = messageMediaMetadataSchema.safeParse({
      telegram: { file_id: 123 },
    })

    expect(r.success).toBe(false)
  })

  it('prefers canonical media_url over legacy metadata storage_path', () => {
    expect(
      getChatMediaStoragePath(
        { storage_path: `${workspaceId}/${conversationId}/legacy.jpg` },
        'image',
        `${workspaceId}/${conversationId}/${messageId}/canonical.jpg`,
      ),
    ).toBe(`${workspaceId}/${conversationId}/${messageId}/canonical.jpg`)
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
    expect(effectiveRichMediaType('video', { mime_type: 'video/mp4' })).toBe(
      'video',
    )
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

  it('returns canonical media_url for voice messages', () => {
    expect(getChatMediaStoragePath({}, 'voice', 'w/c/m/voice.ogg')).toBe(
      'w/c/m/voice.ogg',
    )
  })

  it('does not return canonical media_url when upload failed', () => {
    expect(
      getChatMediaStoragePath(
        { upload_failed: true },
        'image',
        'w/c/m/image.jpg',
      ),
    ).toBeNull()
  })

  it('returns null for text type', () => {
    expect(getChatMediaStoragePath({ storage_path: 'x' }, 'text')).toBeNull()
  })

  it('returns null when path missing', () => {
    expect(getChatMediaStoragePath({ upload_failed: false }, 'video')).toBeNull()
  })
})
