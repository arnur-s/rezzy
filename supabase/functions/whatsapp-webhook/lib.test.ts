import { describe, expect, it } from 'vitest'
import {
  buildWhatsappProfile,
  normalizeWhatsappMessage,
  normalizeWhatsappReaction,
  normalizeWhatsappStatus,
  sanitizeWhatsappErrors,
  whatsappMessageFingerprint,
  whatsappStatusFingerprint,
  type WhatsappMessage,
} from './lib.ts'

function message(overrides: Partial<WhatsappMessage>): WhatsappMessage {
  return {
    from: '77015550000',
    id: 'wamid.abc',
    timestamp: '1753262000',
    ...overrides,
  }
}

describe('fingerprints', () => {
  it('are kind-prefixed and status-specific', () => {
    expect(whatsappMessageFingerprint('wamid.abc')).toBe('msg:wamid.abc')
    expect(whatsappStatusFingerprint('wamid.abc', 'read')).toBe(
      'status:wamid.abc:read',
    )
    expect(whatsappStatusFingerprint('wamid.abc', 'delivered')).not.toBe(
      whatsappStatusFingerprint('wamid.abc', 'read'),
    )
  })
})

describe('normalizeWhatsappMessage', () => {
  it('normalizes text with reply context', () => {
    const result = normalizeWhatsappMessage(
      message({
        type: 'text',
        text: { body: 'hi there' },
        context: { id: 'wamid.parent', from: '77010000000' },
      }),
    )
    expect(result.type).toBe('text')
    expect(result.content).toBe('hi there')
    expect(result.externalReplyToId).toBe('wamid.parent')
    expect(result.metadata.quote).toEqual({
      external_id: 'wamid.parent',
      author_external_id: '77010000000',
    })
    expect(result.providerTimestamp).toBe('2025-07-23T09:13:20.000Z')
  })

  it('keeps structured location coordinates instead of a text summary', () => {
    const result = normalizeWhatsappMessage(
      message({
        type: 'location',
        location: {
          latitude: 51.1,
          longitude: 71.4,
          name: 'Office',
          address: 'Turan 37',
        },
      }),
    )
    expect(result.type).toBe('location')
    expect(result.content).toBeNull()
    expect(result.metadata.location).toEqual({
      kind: 'venue',
      latitude: 51.1,
      longitude: 71.4,
      name: 'Office',
      address: 'Turan 37',
    })
  })

  it('normalizes contact cards', () => {
    const result = normalizeWhatsappMessage(
      message({
        type: 'contacts',
        contacts: [
          {
            name: { formatted_name: 'Dana A' },
            phones: [{ phone: '+77015550001', wa_id: '77015550001' }],
            emails: [{ email: 'dana@example.com' }],
            org: { company: 'Rezzy' },
          },
        ],
      }),
    )
    expect(result.type).toBe('contact')
    expect(result.metadata.contacts).toEqual([
      expect.objectContaining({
        name: 'Dana A',
        phones: [{ phone: '+77015550001', wa_id: '77015550001' }],
        emails: [{ email: 'dana@example.com' }],
        company: 'Rezzy',
      }),
    ])
  })

  it('normalizes interactive button and list replies', () => {
    const button = normalizeWhatsappMessage(
      message({
        type: 'interactive',
        interactive: { type: 'button_reply', button_reply: { id: 'b1', title: 'Yes' } },
      }),
    )
    expect(button.type).toBe('interactive')
    expect(button.content).toBe('Yes')
    expect(button.metadata.interactive).toEqual({
      kind: 'button_reply',
      id: 'b1',
      title: 'Yes',
    })

    const list = normalizeWhatsappMessage(
      message({
        type: 'interactive',
        interactive: {
          type: 'list_reply',
          list_reply: { id: 'row2', title: 'Plan B', description: 'Second option' },
        },
      }),
    )
    expect(list.metadata.interactive).toEqual({
      kind: 'list_reply',
      id: 'row2',
      title: 'Plan B',
      description: 'Second option',
    })

    const legacyButton = normalizeWhatsappMessage(
      message({ type: 'button', button: { payload: 'PAY', text: 'Pay now' } }),
    )
    expect(legacyButton.type).toBe('interactive')
    expect(legacyButton.metadata.interactive).toEqual({
      kind: 'button_reply',
      id: 'PAY',
      title: 'Pay now',
    })
  })

  it('preserves referral (click-to-chat ad) metadata', () => {
    const result = normalizeWhatsappMessage(
      message({
        type: 'text',
        text: { body: 'came from ad' },
        referral: {
          source_type: 'ad',
          source_id: 'ad-1',
          source_url: 'https://fb.me/ad',
          ctwa_clid: 'clid-1',
        },
      }),
    )
    expect(result.metadata.referral).toEqual({
      source_type: 'ad',
      source_id: 'ad-1',
      source_url: 'https://fb.me/ad',
      ctwa_clid: 'clid-1',
    })
  })

  it('never emits empty text rows for unknown or unsupported payloads', () => {
    const order = normalizeWhatsappMessage(message({ type: 'order', order: {} }))
    expect(order.type).toBe('unsupported')
    expect(order.metadata.unsupported).toEqual({ kind: 'order' })

    const unsupported = normalizeWhatsappMessage(
      message({
        type: 'unsupported',
        errors: [
          {
            code: 131051,
            title: 'Message type unknown',
            error_data: { details: 'Message type is not currently supported.' },
          },
        ],
      }),
    )
    expect(unsupported.type).toBe('unsupported')
    expect(unsupported.metadata.unsupported).toEqual({
      kind: 'unsupported',
      provider_errors: [
        {
          code: '131051',
          title: 'Message type unknown',
          details: 'Message type is not currently supported.',
        },
      ],
    })

    const future = normalizeWhatsappMessage(message({ type: 'new_fancy_type' }))
    expect(future.type).toBe('unsupported')
    expect(future.metadata.unsupported).toEqual({ kind: 'new_fancy_type' })
  })

  it('keeps media checksum and voice flag', () => {
    const voice = normalizeWhatsappMessage(
      message({
        type: 'audio',
        audio: { id: 'media-1', voice: true, sha256: 'abc123', mime_type: 'audio/ogg' },
      }),
    )
    expect(voice.type).toBe('voice')
    expect(voice.media).toEqual(
      expect.objectContaining({ kind: 'voice', media_id: 'media-1', sha256: 'abc123' }),
    )
  })

  it('maps system events explicitly', () => {
    const result = normalizeWhatsappMessage(
      message({
        type: 'system',
        system: { type: 'user_changed_number', body: 'User changed number' },
      }),
    )
    expect(result.type).toBe('system')
    expect(result.metadata.system).toEqual({
      kind: 'user_changed_number',
      body: 'User changed number',
    })
  })
})

describe('normalizeWhatsappReaction', () => {
  it('maps add and remove semantics', () => {
    const added = normalizeWhatsappReaction(
      message({ type: 'reaction', reaction: { message_id: 'wamid.target', emoji: '👍' } }),
    )
    expect(added?.targetProviderMessageId).toBe('wamid.target')
    expect(added?.op).toEqual(
      expect.objectContaining({ emoji: '👍', action: 'added' }),
    )

    const removed = normalizeWhatsappReaction(
      message({ type: 'reaction', reaction: { message_id: 'wamid.target', emoji: '' } }),
    )
    expect(removed?.op).toBeNull()
  })

  it('rejects reactions without a target', () => {
    expect(
      normalizeWhatsappReaction(message({ type: 'reaction', reaction: {} })),
    ).toBeNull()
  })
})

describe('normalizeWhatsappStatus', () => {
  it('maps statuses and preserves conversation/pricing metadata', () => {
    const result = normalizeWhatsappStatus({
      id: 'wamid.out',
      status: 'delivered',
      timestamp: '1753262100',
      recipient_id: '77015550000',
      conversation: {
        id: 'conv-1',
        origin: { type: 'service' },
        expiration_timestamp: '1753348500',
      },
      pricing: { billable: true, category: 'service' },
    })
    expect(result).toEqual(
      expect.objectContaining({
        externalId: 'wamid.out',
        status: 'delivered',
        providerTimestamp: '2025-07-23T09:15:00.000Z',
      }),
    )
    expect(result?.metadata.conversation).toEqual(
      expect.objectContaining({ id: 'conv-1', origin: 'service' }),
    )
    expect(result?.metadata.pricing).toEqual({ category: 'service', billable: true })
  })

  it('extracts safe error diagnostics from failed statuses', () => {
    const result = normalizeWhatsappStatus({
      id: 'wamid.out',
      status: 'failed',
      errors: [
        {
          code: 131026,
          title: 'Message undeliverable',
          error_data: { details: 'Recipient cannot receive this message' },
        },
      ],
    })
    expect(result?.status).toBe('failed')
    expect(result?.errorCode).toBe('131026')
    expect(result?.errorDetail).toBe('Recipient cannot receive this message')
  })

  it('maps unknown provider statuses to unknown and rejects incomplete ones', () => {
    expect(
      normalizeWhatsappStatus({ id: 'wamid.out', status: 'warning' })?.status,
    ).toBe('unknown')
    expect(normalizeWhatsappStatus({ status: 'read' })).toBeNull()
    expect(normalizeWhatsappStatus({ id: 'wamid.out' })).toBeNull()
  })
})

describe('sanitizeWhatsappErrors / profile', () => {
  it('keeps only safe error fields', () => {
    expect(
      sanitizeWhatsappErrors([
        { code: 190, title: 'Auth', message: 'expired', error_data: { details: 'd' } },
      ]),
    ).toEqual([{ code: '190', title: 'Auth', message: 'expired', details: 'd' }])
  })

  it('builds the identity profile with referral', () => {
    expect(
      buildWhatsappProfile({
        waId: '77015550000',
        profileName: 'Dana',
        referral: { source_type: 'ad', source_id: 'ad-1', ctwa_clid: 'c1' },
      }),
    ).toEqual({
      wa_id: '77015550000',
      phone: '+77015550000',
      profile_name: 'Dana',
      referral: { source_type: 'ad', source_id: 'ad-1', ctwa_clid: 'c1' },
    })
  })
})
