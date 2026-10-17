import { FunctionsHttpError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { retryOutboundMessage, sendOutboundMessage } from './messages'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
}))
vi.mock('@/utils/supabase', () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    from: () => {
      const builder = {
        insert: () => builder,
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        single: mocks.single,
        update: (...args: Array<unknown>) => {
          mocks.update(...args)
          return builder
        },
        then: (resolve: (value: { error: null }) => void) =>
          resolve({ error: null }),
      }
      return builder
    },
  },
}))

const inserted = {
  id: 'm1',
  conversation_id: 'c1',
  workspace_id: 'w1',
  status: 'sent',
  external_id: null,
}
const input = {
  conversationId: 'c1',
  workspaceId: 'w1',
  content: 'reply',
  senderId: 'u1',
  channelType: 'telegram' as const,
}

describe('outbound delivery reconciliation', () => {
  beforeEach(() => {
    mocks.single.mockReset()
    mocks.invoke.mockReset()
    mocks.update.mockReset()
  })

  it('returns the accepted row when the edge response fails after provider delivery', async () => {
    const delivered = {
      ...inserted,
      status: 'delivered',
      external_id: 'telegram-123',
    }
    mocks.single
      .mockResolvedValueOnce({ data: inserted, error: null })
      .mockResolvedValueOnce({ data: delivered, error: null })
    mocks.invoke.mockResolvedValue({
      data: null,
      error: new Error('Response lost'),
    })

    await expect(sendOutboundMessage(input)).resolves.toEqual(delivered)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('does not mark an uncertain in-flight message failed when invocation times out', async () => {
    mocks.single.mockResolvedValue({ data: inserted, error: null })
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('Timeout') })

    await expect(sendOutboundMessage(input)).rejects.toThrow('Timeout')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('preserves failed server state for a rejected send and reports its error', async () => {
    mocks.single
      .mockResolvedValueOnce({ data: inserted, error: null })
      .mockResolvedValueOnce({
        data: { ...inserted, status: 'failed' },
        error: null,
      })
    mocks.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(
        new Response(JSON.stringify({ error: 'Provider rejected' }), {
          status: 502,
        }),
      ),
    })
    await expect(sendOutboundMessage(input)).rejects.toThrow(
      'Provider rejected',
    )
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('reconciles an already accepted retry without overwriting its delivered state', async () => {
    const delivered = {
      ...inserted,
      status: 'delivered',
      external_id: 'telegram-123',
    }
    mocks.single.mockResolvedValue({ data: delivered, error: null })
    mocks.invoke.mockResolvedValue({
      data: null,
      error: new Error('Response lost'),
    })
    await expect(
      retryOutboundMessage({ messageId: 'm1', channelType: 'telegram' }),
    ).resolves.toEqual(delivered)
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ status: 'sent' })
  })
})
