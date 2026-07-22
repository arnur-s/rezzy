import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  extractReadMid,
  mimeToDbType,
  resolveInstagramMessage,
  timingSafeEqual,
  verifySignature,
} from './lib.ts'

const secret = 'test_app_secret'
const body = JSON.stringify({ object: 'instagram', entry: [{ id: '17841400000' }] })
const validSignature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`

describe('verifySignature', () => {
  it('accepts a valid signature', async () => {
    expect(await verifySignature(secret, body, validSignature)).toBe(true)
  })

  it('rejects a wrong secret', async () => {
    expect(await verifySignature('wrong_secret', body, validSignature)).toBe(false)
  })

  it('rejects a tampered body', async () => {
    expect(await verifySignature(secret, `${body} `, validSignature)).toBe(false)
  })

  it('rejects a missing or malformed header', async () => {
    expect(await verifySignature(secret, body, null)).toBe(false)
    expect(await verifySignature(secret, body, 'md5=abc')).toBe(false)
  })
})

describe('timingSafeEqual', () => {
  it('compares strings', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true)
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
    expect(timingSafeEqual('abc', 'ab')).toBe(false)
  })
})

describe('resolveInstagramMessage', () => {
  it('extracts text content', () => {
    expect(resolveInstagramMessage({ mid: 'm1', text: 'hello' })).toEqual({
      content: 'hello',
      attachment: null,
    })
  })

  it('picks the first attachment carrying a url', () => {
    const result = resolveInstagramMessage({
      mid: 'm2',
      attachments: [
        { type: 'image', payload: {} },
        { type: 'image', payload: { url: 'https://cdn.example/x.jpg' } },
      ],
    })
    expect(result.attachment).toEqual({
      url: 'https://cdn.example/x.jpg',
      type: 'image',
    })
  })

  it('returns a null attachment for empty or unsupported payloads', () => {
    expect(resolveInstagramMessage({ mid: 'm3' }).attachment).toBeNull()
    expect(resolveInstagramMessage(undefined).attachment).toBeNull()
  })
})

describe('mimeToDbType', () => {
  it('prefers the actual mime type', () => {
    expect(mimeToDbType('image/jpeg', 'file')).toBe('image')
    expect(mimeToDbType('video/mp4', 'image')).toBe('video')
    expect(mimeToDbType('audio/mp4')).toBe('audio')
    expect(mimeToDbType('application/pdf')).toBe('document')
  })

  it('falls back to the webhook attachment type', () => {
    expect(mimeToDbType(null, 'story_mention')).toBe('image')
    expect(mimeToDbType(null, 'ig_reel')).toBe('video')
    expect(mimeToDbType(null, 'audio')).toBe('audio')
    expect(mimeToDbType(null, 'anything_else')).toBe('document')
  })
})

describe('extractReadMid', () => {
  it('returns read.mid when present', () => {
    expect(extractReadMid({ read: { mid: 'm9' } })).toBe('m9')
  })

  it('returns null when absent', () => {
    expect(extractReadMid({})).toBeNull()
    expect(extractReadMid({ read: {} })).toBeNull()
  })
})
