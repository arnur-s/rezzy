import { describe, expect, it } from 'vitest'
import { normalizeReactionEmoji, qualifyReactionEmoji } from './reaction-emoji.ts'
import {
  SUPPORTED_REACTION_EMOJI,
  buildInstagramReactionRequest,
  buildTelegramReactionRequest,
  buildWhatsappReactionRequest,
  interpretInstagramReactionResponse,
  interpretTelegramReactionResponse,
  interpretWhatsappReactionResponse,
} from './reaction-send.ts'

/**
 * The outbound boundary. Canonical emoji go in; each provider's own spelling
 * comes out. Everything under test here is the part that a live provider would
 * otherwise have to teach us the hard way.
 */

// Spelled by code point: the difference between these two values is invisible.
const HEART = String.fromCodePoint(0x2764) // ❤
const VS16 = String.fromCodePoint(0xfe0f)
const THUMBS_UP = String.fromCodePoint(0x1f44d) // 👍

function parseBody(body: string): Record<string, never> {
  return JSON.parse(body)
}

describe('the offered reaction set', () => {
  it('is canonical, so identity comparisons hold', () => {
    // Cross-runtime agreement with the app's own copy is pinned on the app
    // side, in src/entities/channel/model/reaction-capabilities.test.ts — the
    // `@/` alias does not resolve from this directory.
    for (const emoji of SUPPORTED_REACTION_EMOJI) {
      expect(normalizeReactionEmoji(emoji)).toBe(emoji)
    }
  })
})

describe('qualifyReactionEmoji', () => {
  it('re-qualifies a code point that does not default to emoji presentation', () => {
    expect(qualifyReactionEmoji(HEART)).toBe(HEART + VS16)
  })

  it('leaves a code point that already defaults to emoji presentation alone', () => {
    // Appending a redundant selector produces a non-RGI sequence.
    expect(qualifyReactionEmoji(THUMBS_UP)).toBe(THUMBS_UP)
  })

  it('does not touch multi-code-point sequences', () => {
    const flag = String.fromCodePoint(0x1f1f0, 0x1f1ff) // 🇰🇿
    expect(qualifyReactionEmoji(flag)).toBe(flag)
  })

  it('is idempotent against an already-qualified input', () => {
    expect(qualifyReactionEmoji(HEART + VS16)).toBe(HEART + VS16)
  })
})

describe('buildTelegramReactionRequest', () => {
  it('sends the bare emoji, which is what Telegram lists', () => {
    const request = buildTelegramReactionRequest({
      botToken: 'token',
      chatId: '555',
      command: { providerMessageId: '100', emoji: HEART + VS16 },
    })

    expect(request.url).toContain('/setMessageReaction')
    expect(parseBody(request.body)).toEqual({
      chat_id: '555',
      message_id: 100,
      reaction: [{ type: 'emoji', emoji: HEART }],
    })
  })

  it('sends an empty reaction list to remove', () => {
    const request = buildTelegramReactionRequest({
      botToken: 'token',
      chatId: '555',
      command: { providerMessageId: '100', emoji: null },
    })

    expect(parseBody(request.body).reaction).toEqual([])
  })

  it('passes the message id as a number, as the Bot API requires', () => {
    const request = buildTelegramReactionRequest({
      botToken: 'token',
      chatId: '555',
      command: { providerMessageId: '4321', emoji: THUMBS_UP },
    })

    expect(parseBody(request.body).message_id).toBe(4321)
  })
})

describe('buildWhatsappReactionRequest', () => {
  it('sends the fully-qualified emoji, which is what WhatsApp echoes', () => {
    const request = buildWhatsappReactionRequest({
      graphUrl: 'https://graph.facebook.com/v23.0',
      accessToken: 'secret',
      phoneNumberId: 'pn1',
      recipientId: '77015550000',
      command: { providerMessageId: 'wamid.abc', emoji: HEART },
    })

    expect(request.url).toBe('https://graph.facebook.com/v23.0/pn1/messages')
    expect(request.headers.Authorization).toBe('Bearer secret')
    expect(parseBody(request.body)).toMatchObject({
      messaging_product: 'whatsapp',
      to: '77015550000',
      type: 'reaction',
      reaction: { message_id: 'wamid.abc', emoji: HEART + VS16 },
    })
  })

  it('sends an empty emoji string to remove', () => {
    const request = buildWhatsappReactionRequest({
      graphUrl: 'https://graph.facebook.com/v23.0',
      accessToken: 'secret',
      phoneNumberId: 'pn1',
      recipientId: '77015550000',
      command: { providerMessageId: 'wamid.abc', emoji: null },
    })

    expect(parseBody(request.body).reaction).toEqual({
      message_id: 'wamid.abc',
      emoji: '',
    })
  })
})

describe('buildInstagramReactionRequest', () => {
  const base = {
    graphUrl: 'https://graph.instagram.com/v25.0',
    accessToken: 'secret',
    instagramUserId: 'ig1',
    recipientId: 'IGSID-9',
  }

  it('reacts with a sender_action, not a message', () => {
    const request = buildInstagramReactionRequest({
      ...base,
      command: { providerMessageId: 'mid.abc', emoji: HEART },
    })

    expect(request.url).toBe('https://graph.instagram.com/v25.0/ig1/messages')
    expect(request.headers.Authorization).toBe('Bearer secret')
    expect(parseBody(request.body)).toEqual({
      recipient: { id: 'IGSID-9' },
      sender_action: 'react',
      // Fully qualified: Meta echoes the display form back through the webhook.
      payload: { message_id: 'mid.abc', reaction: HEART + VS16 },
    })
  })

  it('edits an existing reaction with the same call', () => {
    // Meta's documented way to change a reaction is to repeat `react`.
    const request = buildInstagramReactionRequest({
      ...base,
      command: { providerMessageId: 'mid.abc', emoji: THUMBS_UP },
    })
    const body = parseBody(request.body)

    expect(body.sender_action).toBe('react')
    expect(body.payload).toEqual({
      message_id: 'mid.abc',
      reaction: THUMBS_UP,
    })
  })

  it('withdraws with unreact, omitting the emoji entirely', () => {
    const request = buildInstagramReactionRequest({
      ...base,
      command: { providerMessageId: 'mid.abc', emoji: null },
    })
    const body = parseBody(request.body)

    expect(body.sender_action).toBe('unreact')
    // The reaction field must be absent, not empty.
    expect(body.payload).toEqual({ message_id: 'mid.abc' })
  })
})

describe('interpretInstagramReactionResponse', () => {
  it('accepts a 2xx, which carries no reaction id', () => {
    expect(
      interpretInstagramReactionResponse(200, {
        recipient_id: 'IGSID-9',
        message_id: 'mid.abc',
      }),
    ).toEqual({ ok: true, providerReactionId: null })
  })

  it('maps the messaging window and expired credentials', () => {
    expect(
      interpretInstagramReactionResponse(400, {
        error: { code: 10, error_subcode: 2534022 },
      }),
    ).toMatchObject({ code: 'window_expired' })
    expect(
      interpretInstagramReactionResponse(401, { error: { code: 190 } }),
    ).toMatchObject({ code: 'channel_unauthorized', isRetryable: false })
  })

  it('marks throttling retryable', () => {
    expect(
      interpretInstagramReactionResponse(429, { error: { code: 613 } }),
    ).toMatchObject({ code: 'rate_limited', isRetryable: true })
  })

  it('keeps an unmapped code identifiable', () => {
    expect(
      interpretInstagramReactionResponse(400, {
        error: { code: 33, message: 'unknown object' },
      }),
    ).toMatchObject({ code: 'instagram_33' })
  })
})

describe('the providers agree on identity while disagreeing on spelling', () => {
  it('serializes one canonical emoji into each provider’s own form', () => {
    const canonical = normalizeReactionEmoji(HEART + VS16)

    const telegram = parseBody(
      buildTelegramReactionRequest({
        botToken: 't',
        chatId: '1',
        command: { providerMessageId: '1', emoji: canonical },
      }).body,
    )
    const whatsapp = parseBody(
      buildWhatsappReactionRequest({
        graphUrl: 'https://graph.facebook.com/v23.0',
        accessToken: 'a',
        phoneNumberId: 'p',
        recipientId: 'r',
        command: { providerMessageId: '1', emoji: canonical },
      }).body,
    )

    const telegramEmoji = (telegram.reaction as unknown as Array<{ emoji: string }>)[0]
      .emoji
    const whatsappEmoji = (whatsapp.reaction as unknown as { emoji: string }).emoji

    expect(telegramEmoji).not.toBe(whatsappEmoji)
    // Different on the wire, the same reaction once normalized back.
    expect(normalizeReactionEmoji(telegramEmoji)).toBe(
      normalizeReactionEmoji(whatsappEmoji),
    )
  })
})

describe('interpretTelegramReactionResponse', () => {
  it('accepts ok:true', () => {
    expect(interpretTelegramReactionResponse(200, { ok: true, result: true })).toEqual(
      { ok: true, providerReactionId: null },
    )
  })

  it('maps a rejected emoji to a code the UI can phrase', () => {
    const outcome = interpretTelegramReactionResponse(400, {
      ok: false,
      error_code: 400,
      description: 'Bad Request: REACTION_INVALID',
    })

    expect(outcome).toMatchObject({ ok: false, code: 'emoji_unsupported' })
  })

  it('maps a missing target message', () => {
    expect(
      interpretTelegramReactionResponse(400, {
        ok: false,
        error_code: 400,
        description: 'Bad Request: message to react not found',
      }),
    ).toMatchObject({ code: 'message_unavailable' })
  })

  it('marks rate limits and provider outages retryable, and bad requests not', () => {
    expect(
      interpretTelegramReactionResponse(429, { ok: false, error_code: 429 }),
    ).toMatchObject({ code: 'rate_limited', isRetryable: true })
    expect(
      interpretTelegramReactionResponse(502, { ok: false, error_code: 502 }),
    ).toMatchObject({ isRetryable: true })
    expect(
      interpretTelegramReactionResponse(400, { ok: false, error_code: 400 }),
    ).toMatchObject({ isRetryable: false })
  })

  it('treats a result of false as a failure even under ok:true', () => {
    expect(
      interpretTelegramReactionResponse(200, { ok: true, result: false }).ok,
    ).toBe(false)
  })

  it('keeps an unmapped code identifiable instead of flattening it', () => {
    expect(
      interpretTelegramReactionResponse(400, {
        ok: false,
        error_code: 403,
        description: 'something new',
      }),
    ).toMatchObject({ code: 'telegram_403', detail: 'something new' })
  })
})

describe('interpretWhatsappReactionResponse', () => {
  it('accepts a 2xx and keeps the reaction message id', () => {
    expect(
      interpretWhatsappReactionResponse(200, {
        messages: [{ id: 'wamid.reaction' }],
      }),
    ).toEqual({ ok: true, providerReactionId: 'wamid.reaction' })
  })

  it('maps the re-engagement window to its own code', () => {
    expect(
      interpretWhatsappReactionResponse(400, {
        error: { code: 131047, message: 'Re-engagement message' },
      }),
    ).toMatchObject({ code: 'window_expired' })
  })

  it('maps throttling and expired credentials', () => {
    expect(
      interpretWhatsappReactionResponse(429, { error: { code: 4 } }),
    ).toMatchObject({ code: 'rate_limited', isRetryable: true })
    expect(
      interpretWhatsappReactionResponse(401, { error: { code: 190 } }),
    ).toMatchObject({ code: 'channel_unauthorized', isRetryable: false })
  })

  it('treats an error body under a 200 as a failure', () => {
    // Graph occasionally answers 200 with an error payload.
    expect(
      interpretWhatsappReactionResponse(200, { error: { code: 131026 } }).ok,
    ).toBe(false)
  })
})
