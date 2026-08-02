import { postgrestError } from '@/test/supabase-query-mock'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { callRpc, isMissingFunctionError } from './supabase-rpc'

const { transport } = vi.hoisted(() => ({ transport: vi.fn() }))

/**
 * The mock mirrors the ONE structural detail of `SupabaseClient` this module
 * depends on: `rpc` is a prototype method whose body dereferences `this`.
 *
 * A mock written as `{ rpc: (name, args) => ... }` — an own arrow property —
 * does not, and a version of this module that detached the method from its
 * client passed against such a mock while throwing
 * `Cannot read properties of undefined (reading 'rest')` on every real call.
 */
vi.mock('@/utils/supabase', () => {
  class FakeSupabaseClient {
    rest = { rpc: transport }

    rpc(name: string, args: Record<string, unknown>) {
      return this.rest.rpc(name, args)
    }
  }

  return { supabase: new FakeSupabaseClient() }
})

beforeEach(() => {
  transport.mockReset()
  transport.mockResolvedValue({ data: null, error: null })
})

describe('callRpc', () => {
  it('calls the function as a method on the client', async () => {
    transport.mockResolvedValue({ data: ['ok'], error: null })

    // The assertion that matters is that this resolves at all: detaching
    // `supabase.rpc` rejects here with a TypeError, which a query hook reports
    // as a failed lookup rather than as the bug it is.
    await expect(
      callRpc('some_function', { p_id: 'x' }, z.array(z.string())),
    ).resolves.toEqual(['ok'])

    expect(transport).toHaveBeenCalledWith('some_function', { p_id: 'x' })
  })

  it('throws the PostgREST error rather than returning an empty answer', async () => {
    transport.mockResolvedValue({ data: null, error: postgrestError() })

    await expect(
      callRpc('some_function', {}, z.array(z.string())),
    ).rejects.toBeTruthy()
  })

  it('names the function when the response is not the agreed shape', async () => {
    transport.mockResolvedValue({ data: [{ unexpected: true }], error: null })

    await expect(
      callRpc('some_function', {}, z.array(z.string())),
    ).rejects.toThrow(/some_function/)
  })
})

describe('isMissingFunctionError', () => {
  it('recognises the schema-cache miss and nothing else', () => {
    expect(isMissingFunctionError({ code: 'PGRST202' })).toBe(true)
    expect(isMissingFunctionError(postgrestError())).toBe(false)
    expect(isMissingFunctionError(new TypeError('boom'))).toBe(false)
    expect(isMissingFunctionError(null)).toBe(false)
  })
})
