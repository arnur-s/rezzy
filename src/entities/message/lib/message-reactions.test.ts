import { normalizeReactionEmoji } from '@/lib/reaction-emoji'
import { describe, expect, it } from 'vitest'
import type { MessageReactionRow } from '../model/types'
import {
  applyReactionRow,
  displayReactionEmoji,
  groupMessageReactions,
} from './message-reactions'

function reactionRow(
  overrides: Partial<MessageReactionRow> = {},
): MessageReactionRow {
  return {
    id: 'reaction-1',
    workspace_id: 'workspace-1',
    channel_id: 'channel-1',
    conversation_id: 'conversation-1',
    message_id: 'msg-1',
    provider_message_id: '100',
    reactor_external_id: 'contact-555',
    is_from_contact: true,
    emoji: '❤️',
    action: 'added',
    provider_timestamp: null,
    metadata: {},
    created_at: '2026-08-03T10:00:00Z',
    updated_at: '2026-08-03T10:00:00Z',
    ...overrides,
  }
}

/** The rendered shape of a reaction row, which is all a bubble ever shows. */
function counters(reactions: Array<MessageReactionRow>) {
  return groupMessageReactions(reactions).map((group) => ({
    emoji: group.emoji,
    count: group.count,
  }))
}

describe('normalizeReactionEmoji', () => {
  it('treats the WhatsApp and Telegram spellings of one emoji as equal', () => {
    expect(normalizeReactionEmoji('❤️')).toBe(normalizeReactionEmoji('❤'))
  })

  it('leaves multi-code-point sequences intact', () => {
    // Stripping the joiner or a regional indicator would merge unrelated
    // reactions into one counter.
    expect(normalizeReactionEmoji('👩‍💻')).toBe('👩‍💻')
    expect(normalizeReactionEmoji('🇰🇿')).toBe('🇰🇿')
    expect(normalizeReactionEmoji('👍🏽')).not.toBe(normalizeReactionEmoji('👍'))
  })
})

describe('displayReactionEmoji', () => {
  it('re-qualifies an emoji that would otherwise render as text', () => {
    // ❤ without U+FE0F is a monochrome glyph on most platforms.
    expect(displayReactionEmoji('❤')).toBe('❤️')
    expect(displayReactionEmoji('❤️')).toBe('❤️')
  })

  it('leaves emoji that already default to emoji presentation alone', () => {
    expect(displayReactionEmoji('👍')).toBe('👍')
    expect(displayReactionEmoji('👩‍💻')).toBe('👩‍💻')
  })

  it('falls back to a glyph for opaque custom-emoji ids', () => {
    expect(displayReactionEmoji('custom:5309984423003823246')).toBe('💠')
  })
})

describe('reaction counters', () => {
  it('adds the first reaction as a group of one', () => {
    const after = applyReactionRow([], reactionRow())
    expect(counters(after)).toEqual([{ emoji: '❤', count: 1 }])
  })

  it("counts another reactor's reaction in the same group", () => {
    const first = applyReactionRow([], reactionRow())
    const after = applyReactionRow(
      first,
      reactionRow({ id: 'reaction-2', reactor_external_id: 'contact-556' }),
    )
    expect(counters(after)).toEqual([{ emoji: '❤', count: 2 }])
  })

  it('shares one counter between provider spellings of the same emoji', () => {
    // WhatsApp sends ❤️ (U+2764 U+FE0F), Telegram sends ❤ (U+2764).
    const whatsapp = reactionRow({ emoji: '❤️' })
    const telegram = reactionRow({
      id: 'reaction-2',
      reactor_external_id: 'contact-556',
      emoji: '❤',
    })
    expect(counters([whatsapp, telegram])).toEqual([{ emoji: '❤', count: 2 }])
  })

  it('keeps distinct emoji in distinct groups', () => {
    expect(
      counters([
        reactionRow(),
        reactionRow({ id: 'reaction-2', emoji: '🔥' }),
        reactionRow({
          id: 'reaction-3',
          emoji: '🔥',
          reactor_external_id: 'contact-556',
        }),
      ]),
    ).toEqual([
      { emoji: '❤', count: 1 },
      { emoji: '🔥', count: 2 },
    ])
  })

  it('does not count a re-delivered event twice', () => {
    const row = reactionRow()
    const once = applyReactionRow([], row)
    const twice = applyReactionRow(once, row)
    expect(counters(twice)).toEqual([{ emoji: '❤', count: 1 }])
  })

  it('does not count one reactor twice when the provider respells the emoji', () => {
    // Two rows survive the database's (channel, message, reactor, emoji) key
    // because the emoji column differs; the reactor still reacted once.
    const after = applyReactionRow(
      [reactionRow({ emoji: '❤️' })],
      reactionRow({ id: 'reaction-2', emoji: '❤' }),
    )
    expect(counters(after)).toEqual([{ emoji: '❤', count: 1 }])
  })

  it('reconciles an optimistic reaction with its realtime confirmation', () => {
    const optimistic = reactionRow({ id: 'optimistic-1', is_from_contact: false })
    const confirmed = reactionRow({
      id: 'db-generated-uuid',
      is_from_contact: false,
    })
    const after = applyReactionRow(
      applyReactionRow([], optimistic),
      confirmed,
    )
    expect(counters(after)).toEqual([{ emoji: '❤', count: 1 }])
    // The confirmed row replaces the placeholder rather than joining it.
    expect(after.map((row) => row.id)).toEqual(['db-generated-uuid'])
  })

  it('holds a group position when a row is replaced', () => {
    const seed = [reactionRow(), reactionRow({ id: 'reaction-2', emoji: '🔥' })]
    const after = applyReactionRow(seed, reactionRow({ updated_at: 'later' }))
    expect(counters(after)).toEqual([
      { emoji: '❤', count: 1 },
      { emoji: '🔥', count: 1 },
    ])
  })

  it('decrements when a reaction is removed', () => {
    const seed = [
      reactionRow(),
      reactionRow({ id: 'reaction-2', reactor_external_id: 'contact-556' }),
    ]
    const after = applyReactionRow(
      seed,
      reactionRow({ id: 'reaction-2', reactor_external_id: 'contact-556', action: 'removed' }),
    )
    expect(counters(after)).toEqual([{ emoji: '❤', count: 1 }])
  })

  it('removes the group instead of rendering a zero counter', () => {
    const after = applyReactionRow(
      [reactionRow()],
      reactionRow({ action: 'removed' }),
    )
    expect(counters(after)).toEqual([])
  })

  it('removes by identity when the removal respells the emoji', () => {
    const after = applyReactionRow(
      [reactionRow({ emoji: '❤️' })],
      reactionRow({ id: 'reaction-2', emoji: '❤', action: 'removed' }),
    )
    expect(counters(after)).toEqual([])
  })

  it('never produces a negative counter', () => {
    const removal = reactionRow({ action: 'removed' })
    const once = applyReactionRow([reactionRow()], removal)
    const twice = applyReactionRow(once, removal)
    const thrice = applyReactionRow(twice, removal)
    expect(counters(thrice)).toEqual([])
    expect(groupMessageReactions(thrice).every((g) => g.count > 0)).toBe(true)
  })

  it('marks a group our side reacted to', () => {
    const groups = groupMessageReactions([
      reactionRow(),
      reactionRow({
        id: 'reaction-2',
        reactor_external_id: 'business-account',
        is_from_contact: false,
      }),
      reactionRow({ id: 'reaction-3', emoji: '🔥' }),
    ])
    expect(
      groups.map((group) => [group.emoji, group.reactedByCurrentUser]),
    ).toEqual([
      ['❤', true],
      ['🔥', false],
    ])
  })

  it('derives the count from the records rather than tracking it separately', () => {
    const groups = groupMessageReactions([
      reactionRow(),
      reactionRow({ id: 'reaction-2', reactor_external_id: 'contact-556' }),
    ])
    expect(groups[0].count).toBe(groups[0].reactions.length)
  })

  it('groups reactions that arrived before their message by provider id', () => {
    const pending = reactionRow({ message_id: null, conversation_id: null })
    const duplicate = { ...pending, id: 'reaction-2' }
    expect(counters([pending, duplicate])).toEqual([{ emoji: '❤', count: 1 }])
  })
})
