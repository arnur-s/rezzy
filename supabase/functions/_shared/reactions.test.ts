import { describe, expect, it } from 'vitest'
import {
  diffTelegramReactionSets,
  instagramReactionOp,
  whatsappReactionOp,
} from './reactions.ts'

describe('diffTelegramReactionSets', () => {
  const base = {
    reactorExternalId: '42',
    isFromContact: true,
    providerTimestamp: '2026-07-23T10:00:00Z',
  }

  it('emits added ops for new emojis and removed for dropped ones', () => {
    const ops = diffTelegramReactionSets({
      ...base,
      oldEmojis: ['👍'],
      newEmojis: ['❤️', '🔥'],
    })
    // Emoji leave canonicalized, so the unique key cannot split one reaction
    // into two rows over a variation selector.
    expect(ops).toEqual([
      expect.objectContaining({ emoji: '❤', action: 'added' }),
      expect.objectContaining({ emoji: '🔥', action: 'added' }),
      expect.objectContaining({ emoji: '👍', action: 'removed' }),
    ])
  })

  it('sees no change when the provider respells an unchanged reaction', () => {
    // Telegram re-sending ❤ as ❤️ is not "removed ❤, added ❤️".
    expect(
      diffTelegramReactionSets({
        ...base,
        oldEmojis: ['❤️'],
        newEmojis: ['❤'],
      }),
    ).toEqual([])
  })

  it('emits nothing for an unchanged set (duplicate callback)', () => {
    expect(
      diffTelegramReactionSets({ ...base, oldEmojis: ['👍'], newEmojis: ['👍'] }),
    ).toEqual([])
  })

  it('clears every reaction when the new set is empty', () => {
    const ops = diffTelegramReactionSets({
      ...base,
      oldEmojis: ['👍', '❤️'],
      newEmojis: [],
    })
    expect(ops).toHaveLength(2)
    expect(ops.every((op) => op.action === 'removed')).toBe(true)
  })
})

describe('whatsappReactionOp', () => {
  it('maps a reaction to an added op', () => {
    expect(
      whatsappReactionOp({
        reactorExternalId: '77015550000',
        emoji: '😂',
        providerTimestamp: null,
      }),
    ).toEqual(
      expect.objectContaining({ emoji: '😂', action: 'added', isFromContact: true }),
    )
  })

  it('maps an empty emoji (remove) to null — handled via replaceOthers', () => {
    expect(
      whatsappReactionOp({
        reactorExternalId: '77015550000',
        emoji: '',
        providerTimestamp: null,
      }),
    ).toBeNull()
    expect(
      whatsappReactionOp({
        reactorExternalId: '77015550000',
        emoji: undefined,
        providerTimestamp: null,
      }),
    ).toBeNull()
  })
})

describe('instagramReactionOp', () => {
  it('maps react/unreact with emoji or named reaction', () => {
    expect(
      instagramReactionOp({
        reactorExternalId: 'IGSID1',
        action: 'react',
        emoji: '❤️',
        reactionName: 'love',
        providerTimestamp: '2026-07-23T10:00:00Z',
      }),
    ).toEqual(expect.objectContaining({ emoji: '❤', action: 'added' }))
    expect(
      instagramReactionOp({
        reactorExternalId: 'IGSID1',
        action: 'unreact',
        emoji: null,
        reactionName: 'love',
        providerTimestamp: null,
      }),
    ).toEqual(expect.objectContaining({ emoji: 'love', action: 'removed' }))
  })

  it('drops events with no usable reaction identity', () => {
    expect(
      instagramReactionOp({
        reactorExternalId: 'IGSID1',
        action: 'react',
        emoji: '  ',
        reactionName: undefined,
        providerTimestamp: null,
      }),
    ).toBeNull()
  })
})
