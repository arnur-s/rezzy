import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHAT_MEDIA_BUCKET,
  chatMediaSignedUrlQueryKey,
  createSignedChatMediaUrl,
} from './chat-media-urls'

const { createSignedUrl } = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
}))

vi.mock('@/utils/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: (...args: Array<unknown>) => createSignedUrl(...args),
      })),
    },
  },
}))

describe('chatMediaSignedUrlQueryKey', () => {
  it('is stable per storage path', () => {
    expect(chatMediaSignedUrlQueryKey('a/b')).toEqual(['chat-media-signed-url', 'a/b'])
  })
})

describe('createSignedChatMediaUrl', () => {
  beforeEach(() => {
    createSignedUrl.mockReset()
  })

  it('throws when path is blank', async () => {
    await expect(createSignedChatMediaUrl('  ')).rejects.toThrow('Missing storage path')
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('returns signed URL from storage client', async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
      error: null,
    })

    const url = await createSignedChatMediaUrl('ws/cv/file.jpg', 120)

    expect(url).toBe('https://example.com/signed')
    expect(createSignedUrl).toHaveBeenCalledWith('ws/cv/file.jpg', 120)
  })

  it('rethrows storage errors', async () => {
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'not found' },
    })

    await expect(createSignedChatMediaUrl('missing')).rejects.toEqual(
      expect.objectContaining({ message: 'not found' }),
    )
  })

  it('uses configured bucket via from()', async () => {
    const { supabase } = await import('@/utils/supabase')
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://x' },
      error: null,
    })
    await createSignedChatMediaUrl('p')
    expect(supabase.storage.from).toHaveBeenCalledWith(CHAT_MEDIA_BUCKET)
  })
})
