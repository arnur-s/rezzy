import { describe, expect, it } from 'vitest'
import {
  canonicalJson,
  fingerprintFromPayload,
  isDenylistedKey,
  sanitizeProviderPayload,
} from './sanitize.ts'

describe('sanitizeProviderPayload', () => {
  it('redacts credential-bearing keys at any depth', () => {
    const result = sanitizeProviderPayload({
      message: { text: 'hello' },
      access_token: 'tok-123',
      nested: {
        Authorization: 'Bearer abc',
        webhook_secret: 's3cret',
        deep: [{ api_key: 'k', signature: 'sig', fine: 'keep' }],
      },
    })
    expect(result).toEqual({
      message: { text: 'hello' },
      access_token: '[redacted]',
      nested: {
        Authorization: '[redacted]',
        webhook_secret: '[redacted]',
        deep: [{ api_key: '[redacted]', signature: '[redacted]', fine: 'keep' }],
      },
    })
  })

  it('redacts header dumps and hub params wholesale', () => {
    const result = sanitizeProviderPayload({
      headers: { 'x-hub-signature-256': 'sha256=deadbeef' },
      'hub.verify_token': 'v',
      body: 'ok',
    })
    expect(result.headers).toBe('[redacted]')
    expect(result['hub.verify_token']).toBe('[redacted]')
    expect(result.body).toBe('ok')
  })

  it('keeps ordinary provider fields verbatim', () => {
    const payload = {
      update_id: 12,
      message: {
        message_id: 34,
        from: { id: 99, first_name: 'Aizhan', username: 'aizhan' },
        text: 'привет',
        entities: [{ type: 'mention', offset: 0, length: 6 }],
      },
    }
    expect(sanitizeProviderPayload(payload)).toEqual(payload)
  })

  it('truncates oversized strings', () => {
    const long = 'a'.repeat(10_000)
    const result = sanitizeProviderPayload({ text: long }) as { text: string }
    expect(result.text.length).toBeLessThan(9_000)
    expect(result.text.endsWith('…[truncated]')).toBe(true)
  })

  it('never crashes on non-finite numbers or deep nesting', () => {
    let deep: Record<string, unknown> = { end: true }
    for (let i = 0; i < 20; i += 1) deep = { next: deep }
    const result = sanitizeProviderPayload({ n: Number.NaN, deep })
    expect(result.n).toBe('NaN')
    expect(JSON.stringify(result)).toContain('[max-depth]')
  })
})

describe('isDenylistedKey', () => {
  it.each(['bot_token', 'ACCESS_TOKEN', 'client_secret', 'x-hub-signature', 'cookie'])(
    'flags %s',
    (key) => {
      expect(isDenylistedKey(key)).toBe(true)
    },
  )

  it.each(['text', 'username', 'mid', 'wa_id', 'emoji'])('keeps %s', (key) => {
    expect(isDenylistedKey(key)).toBe(false)
  })
})

describe('canonicalJson / fingerprintFromPayload', () => {
  it('is key-order independent', async () => {
    const a = { b: 1, a: { d: [1, 2], c: 'x' } }
    const b = { a: { c: 'x', d: [1, 2] }, b: 1 }
    expect(canonicalJson(a)).toBe(canonicalJson(b))
    expect(await fingerprintFromPayload(a)).toBe(await fingerprintFromPayload(b))
  })

  it('produces a sha256-prefixed deterministic fingerprint', async () => {
    const fp = await fingerprintFromPayload({ x: 1 })
    expect(fp).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(await fingerprintFromPayload({ x: 1 })).toBe(fp)
  })

  it('distinguishes different payloads', async () => {
    expect(await fingerprintFromPayload({ x: 1 })).not.toBe(
      await fingerprintFromPayload({ x: 2 }),
    )
  })
})
