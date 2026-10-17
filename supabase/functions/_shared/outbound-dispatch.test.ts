import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { describe, expect, it, vi } from 'vitest'
import {
  claimOutboundDispatch,
  releaseRejectedDispatch,
} from './outbound-dispatch.ts'

describe('outbound dispatch fence', () => {
  it.each([
    [true, null, 'claimed'],
    [false, null, 'unavailable'],
    [null, null, 'unavailable'],
    [null, { code: 'database_unavailable' }, 'error'],
  ])(
    'fails closed unless the database grants the claim (%s)',
    async (data, error, expected) => {
      const rpc = vi.fn().mockResolvedValue({ data, error })
      const client = { rpc } as unknown as SupabaseClient

      expect(await claimOutboundDispatch(client, 'message-1')).toBe(expected)
      expect(rpc).toHaveBeenCalledWith('claim_outbound_message', {
        p_message_id: 'message-1',
      })
    },
  )

  it('releases only the explicitly rejected message through the service RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    await releaseRejectedDispatch(
      { rpc } as unknown as SupabaseClient,
      'message-1',
    )
    expect(rpc).toHaveBeenCalledWith('release_outbound_message', {
      p_message_id: 'message-1',
    })
  })
})
