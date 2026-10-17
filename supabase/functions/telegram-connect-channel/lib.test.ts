import { describe, expect, it, vi } from 'vitest'
import { createWebhookSecret } from './lib.ts'

describe('createWebhookSecret', () => {
  it('generates an independent 256-bit secret using Telegram-compatible characters', () => {
    const random = vi.spyOn(crypto, 'getRandomValues')
    const first = createWebhookSecret()
    const second = createWebhookSecret()

    expect(first).toMatch(/^[a-f0-9]{64}$/)
    expect(second).not.toBe(first)
    expect(random).toHaveBeenCalledTimes(2)
    expect(random.mock.calls[0]?.[0]).toHaveLength(32)
    random.mockRestore()
  })
})
