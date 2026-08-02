import { OUTBOUND_REACTOR_ID } from '@/entities/message'
import { normalizeReactionEmoji } from '@/lib/reaction-emoji'
import { describe, expect, it } from 'vitest'
// The edge runtime's copies. Deno cannot import from `src/`, so the constants
// both runtimes rely on are duplicated on purpose; this file is what keeps them
// from drifting apart. (The pinning lives here rather than beside the edge
// module because the `@/` alias does not resolve from `supabase/`.)
import {
  OUTBOUND_REACTOR_ID as EDGE_OUTBOUND_REACTOR_ID,
  SUPPORTED_REACTION_EMOJI,
} from '../../../../supabase/functions/_shared/reaction-send.ts'
import {
  REACTION_CAPABILITIES,
  SUPPORTED_REACTIONS,
  getReactionCapabilities,
  supportsReactionEmoji,
} from './reaction-capabilities'

/**
 * What each provider will accept, and the two constants the browser and the
 * edge function have to agree on. A drift here does not fail loudly: it shows
 * up as a reaction the picker offers and the server refuses, or as an
 * optimistic chip that never reconciles.
 */

const HEART = String.fromCodePoint(0x2764)
const VS16 = String.fromCodePoint(0xfe0f)

describe('cross-runtime constants', () => {
  it('offers the same reaction set to the server as to the picker', () => {
    // The server revalidates rather than trusting the browser, so a set that
    // drifts would reject exactly the reactions the picker offers.
    expect([...SUPPORTED_REACTION_EMOJI]).toEqual([...SUPPORTED_REACTIONS])
  })

  it('agrees on the reactor id a workspace reaction is recorded under', () => {
    // Disagree and the confirming row lands beside the optimistic entry rather
    // than replacing it, and one reaction reads as two.
    expect(EDGE_OUTBOUND_REACTOR_ID).toBe(OUTBOUND_REACTOR_ID)
  })

  it('namespaces the reactor id so it cannot collide with a provider identity', () => {
    // Provider identities are numeric (Telegram, IGSID) or E.164 (wa_id).
    expect(OUTBOUND_REACTOR_ID).toContain(':')
    expect(OUTBOUND_REACTOR_ID).not.toMatch(/^\+?\d+$/)
  })
})

describe('the supported reaction set', () => {
  it('is stored canonical, so grouping and removal match', () => {
    for (const emoji of SUPPORTED_REACTIONS) {
      expect(normalizeReactionEmoji(emoji)).toBe(emoji)
    }
  })

  it('holds no duplicates once canonicalized', () => {
    expect(new Set(SUPPORTED_REACTIONS).size).toBe(SUPPORTED_REACTIONS.length)
  })
})

describe('provider capabilities', () => {
  it('lets every messaging provider add, replace, and remove', () => {
    for (const channelType of ['telegram', 'whatsapp', 'instagram'] as const) {
      expect(getReactionCapabilities(channelType)).toMatchObject({
        canSend: true,
        canRemove: true,
        canReplace: true,
      })
      expect(
        getReactionCapabilities(channelType).supportedEmoji.length,
      ).toBeGreaterThan(0)
    }
  })

  it('offers nothing on providers that cannot send reactions', () => {
    expect(getReactionCapabilities('email')).toEqual({
      canSend: false,
      canRemove: false,
      canReplace: false,
      supportedEmoji: [],
    })
  })

  it('covers every channel type, so a new provider cannot be forgotten', () => {
    // Record<ChannelType, …> makes this a type error too; the runtime check
    // catches a stub added to satisfy the compiler and never filled in.
    for (const capabilities of Object.values(REACTION_CAPABILITIES)) {
      expect(typeof capabilities.canSend).toBe('boolean')
      expect(capabilities.canSend || capabilities.supportedEmoji.length === 0)
        .toBe(true)
    }
  })
})

describe('supportsReactionEmoji', () => {
  it('compares canonically, so either spelling of one emoji is accepted', () => {
    const telegram = getReactionCapabilities('telegram')
    expect(supportsReactionEmoji(telegram, HEART)).toBe(true)
    // WhatsApp's spelling of the same reaction.
    expect(supportsReactionEmoji(telegram, HEART + VS16)).toBe(true)
  })

  it('rejects an emoji outside the offered set', () => {
    const telegram = getReactionCapabilities('telegram')
    expect(supportsReactionEmoji(telegram, String.fromCodePoint(0x1f680))).toBe(
      false,
    )
  })

  it('rejects everything on a provider that cannot send reactions', () => {
    expect(supportsReactionEmoji(getReactionCapabilities('email'), HEART)).toBe(
      false,
    )
  })
})
