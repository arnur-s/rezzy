import type { MessageRow } from '@/entities/message'
import { describe, expect, it } from 'vitest'
import { getReactionAvailability } from './reaction-eligibility'

/**
 * The reaction affordance answers to the provider first and the message
 * second. Hiding and disabling are different claims: hidden means "not a thing
 * here", disabled means "not right now", and showing the wrong one either
 * promises something the provider cannot do or hides something that would work
 * a second later.
 */

type MessageShape = Pick<MessageRow, 'type' | 'deleted_at' | 'external_id'>

function message(overrides: Partial<MessageShape> = {}): MessageShape {
  return {
    type: 'text',
    deleted_at: null,
    external_id: '100',
    ...overrides,
  }
}

describe('getReactionAvailability', () => {
  it('offers the action on a provider that can send reactions', () => {
    for (const channelType of ['telegram', 'whatsapp', 'instagram'] as const) {
      expect(
        getReactionAvailability({
          channelType,
          message: message(),
          isChannelActive: true,
        }),
      ).toEqual({ status: 'available' })
    }
  })

  it('hides the action on a provider that cannot send reactions', () => {
    // Email has no reaction concept. This is not a disabled state: there is
    // nothing the agent could do to make it work.
    expect(
      getReactionAvailability({
        channelType: 'email',
        message: message(),
        isChannelActive: true,
      }),
    ).toEqual({ status: 'hidden' })
  })

  it('hides the action on a message type that cannot carry a reaction', () => {
    for (const type of ['system', 'unsupported']) {
      expect(
        getReactionAvailability({
          channelType: 'telegram',
          message: message({ type }),
          isChannelActive: true,
        }),
      ).toEqual({ status: 'hidden' })
    }
  })

  it('keeps the action for media and structured messages', () => {
    // Providers accept reactions against any real message, not only text.
    for (const type of ['image', 'video', 'document', 'location', 'contact']) {
      expect(
        getReactionAvailability({
          channelType: 'telegram',
          message: message({ type }),
          isChannelActive: true,
        }).status,
      ).toBe('available')
    }
  })

  it('disables rather than hides a deleted message', () => {
    expect(
      getReactionAvailability({
        channelType: 'telegram',
        message: message({ deleted_at: '2026-08-03T10:00:00Z' }),
        isChannelActive: true,
      }),
    ).toEqual({ status: 'blocked', reason: 'message_deleted' })
  })

  it('disables a message the provider has not acknowledged yet', () => {
    // No external_id means nothing to address the reaction to. This resolves on
    // its own the moment delivery lands, which is why it disables.
    for (const externalId of [null, '', '   ']) {
      expect(
        getReactionAvailability({
          channelType: 'telegram',
          message: message({ external_id: externalId }),
          isChannelActive: true,
        }),
      ).toEqual({ status: 'blocked', reason: 'missing_provider_id' })
    }
  })

  it('disables the action on a disconnected channel', () => {
    expect(
      getReactionAvailability({
        channelType: 'telegram',
        message: message(),
        isChannelActive: false,
      }),
    ).toEqual({ status: 'blocked', reason: 'channel_disconnected' })
  })

  it('reports the provider limitation ahead of the message state', () => {
    // A deleted message on email is hidden, not disabled: explaining that this
    // particular message cannot be reacted to would imply another could.
    expect(
      getReactionAvailability({
        channelType: 'email',
        message: message({ deleted_at: '2026-08-03T10:00:00Z' }),
        isChannelActive: false,
      }),
    ).toEqual({ status: 'hidden' })
  })
})
