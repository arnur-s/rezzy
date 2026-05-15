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
    expect(chatMediaSignedUrlQueryKey('a/b')).toEqual([
      'chat-media-signed-url',
      'a/b',
    ])
  })
})

describe('createSignedChatMediaUrl', () => {
  const workspaceId = '11111111-1111-4111-8111-111111111111'
  const conversationId = '22222222-2222-4222-8222-222222222222'
  const messageId = '33333333-3333-4333-8333-333333333333'

  beforeEach(() => {
    createSignedUrl.mockReset()
  })

  it('throws when path is blank', async () => {
    await expect(createSignedChatMediaUrl('  ')).rejects.toThrow(
      'Missing storage path',
    )
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('returns signed URL from storage client', async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
      error: null,
    })

    const path = `${workspaceId}/${conversationId}/${messageId}/file.jpg`
    const url = await createSignedChatMediaUrl(path, {
      expiresInSeconds: 120,
      workspaceId,
    })

    expect(url).toBe('https://example.com/signed')
    expect(createSignedUrl).toHaveBeenCalledWith(path, 120)
  })

  it('accepts legacy three-segment storage paths during transition', async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/legacy' },
      error: null,
    })

    const legacyPath = `${workspaceId}/${conversationId}/legacy-file.jpg`
    const url = await createSignedChatMediaUrl(legacyPath, { workspaceId })

    expect(url).toBe('https://example.com/legacy')
    expect(createSignedUrl).toHaveBeenCalledWith(legacyPath, 3600)
  })

  it('rejects unsafe paths before calling storage', async () => {
    await expect(
      createSignedChatMediaUrl('https://example.com/object.jpg', { workspaceId }),
    ).rejects.toThrow('Invalid storage path')
    await expect(
      createSignedChatMediaUrl(`${workspaceId}/${conversationId}/../file.jpg`, {
        workspaceId,
      }),
    ).rejects.toThrow('Invalid storage path')
    await expect(
      createSignedChatMediaUrl(`${workspaceId}/${conversationId}`, {
        workspaceId,
      }),
    ).rejects.toThrow('Invalid storage path')

    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('rejects paths outside the active workspace', async () => {
    const otherWorkspacePath = `99999999-9999-4999-8999-999999999999/${conversationId}/${messageId}/file.jpg`

    await expect(
      createSignedChatMediaUrl(otherWorkspacePath, { workspaceId }),
    ).rejects.toThrow('Invalid storage path')
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('rethrows storage errors', async () => {
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'not found' },
    })

    await expect(
      createSignedChatMediaUrl(`${workspaceId}/${conversationId}/missing.pdf`, {
        workspaceId,
      }),
    ).rejects.toEqual(
      expect.objectContaining({ message: 'not found' }),
    )
  })

  it('uses configured bucket via from()', async () => {
    const { supabase } = await import('@/utils/supabase')
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://x' },
      error: null,
    })
    await createSignedChatMediaUrl(`${workspaceId}/${conversationId}/p.pdf`, {
      workspaceId,
    })
    expect(supabase.storage.from).toHaveBeenCalledWith(CHAT_MEDIA_BUCKET)
  })
})
