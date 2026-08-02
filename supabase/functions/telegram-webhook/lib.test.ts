import { describe, expect, it } from 'vitest'
import {
  buildTelegramProfile,
  classifyTelegramUpdate,
  normalizeTelegramMessage,
  normalizeTelegramReaction,
  resolveExternalName,
  telegramUpdateFingerprint,
  resolveTelegramMedia,
  type TelegramMessage,
  type TelegramUpdate,
} from './lib.ts'

const from = {
  id: 555,
  first_name: 'Aizhan',
  last_name: 'K',
  username: 'aizhan',
  language_code: 'ru',
  is_premium: true,
}

const privateChat = { id: 555, type: 'private' as const, first_name: 'Aizhan' }

function textMessage(overrides: Partial<TelegramMessage> = {}): TelegramMessage {
  return {
    message_id: 42,
    from,
    chat: privateChat,
    date: 1_753_262_000,
    text: 'hello',
    ...overrides,
  }
}

describe('classifyTelegramUpdate', () => {
  it('classifies private messages, edits, and reactions', () => {
    expect(
      classifyTelegramUpdate({ update_id: 1, message: textMessage() }).kind,
    ).toBe('message')
    expect(
      classifyTelegramUpdate({ update_id: 2, edited_message: textMessage() }).kind,
    ).toBe('edited_message')
    expect(
      classifyTelegramUpdate({
        update_id: 3,
        message_reaction: {
          chat: privateChat,
          message_id: 42,
          user: from,
          date: 1_753_262_100,
          old_reaction: [],
          new_reaction: [{ type: 'emoji', emoji: '👍' }],
        },
      }).kind,
    ).toBe('reaction')
  })

  it('ignores group/channel traffic as a deliberate product boundary', () => {
    const group = classifyTelegramUpdate({
      update_id: 4,
      message: textMessage({ chat: { id: -100, type: 'supergroup', title: 'G' } }),
    })
    expect(group).toEqual({
      kind: 'ignored',
      eventType: 'message',
      reason: 'non_private_chat',
    })
    const channelPost = classifyTelegramUpdate({
      update_id: 5,
      channel_post: textMessage({ chat: { id: -200, type: 'channel' } }),
    } as TelegramUpdate)
    expect(channelPost.kind).toBe('ignored')
  })

  it('ignores business and interaction updates with explicit reasons', () => {
    expect(
      classifyTelegramUpdate({
        update_id: 6,
        business_message: textMessage(),
      } as TelegramUpdate),
    ).toEqual(
      expect.objectContaining({
        kind: 'ignored',
        reason: 'business_messages_not_configured',
      }),
    )
    expect(
      classifyTelegramUpdate({ update_id: 7, callback_query: {} } as TelegramUpdate)
        .kind,
    ).toBe('ignored')
  })

  it('returns empty for unusable updates', () => {
    expect(classifyTelegramUpdate({ update_id: 8 }).kind).toBe('empty')
  })
})

describe('telegramUpdateFingerprint', () => {
  it('uses the update id and falls back to null', () => {
    expect(telegramUpdateFingerprint({ update_id: 99 })).toBe('update:99')
    expect(
      telegramUpdateFingerprint({} as TelegramUpdate),
    ).toBeNull()
  })
})

describe('normalizeTelegramMessage', () => {
  it('normalizes text with entities and provider ids', () => {
    const result = normalizeTelegramMessage(
      textMessage({
        text: '@user check https://example.com',
        entities: [
          { type: 'mention', offset: 0, length: 5 },
          { type: 'url', offset: 12, length: 19 },
        ],
      }),
      1001,
    )
    expect(result.type).toBe('text')
    expect(result.content).toBe('@user check https://example.com')
    expect(result.metadata.telegram).toEqual({ message_id: 42, update_id: 1001 })
    expect(result.metadata.entities).toHaveLength(2)
    expect(result.providerTimestamp).toBe('2025-07-23T09:13:20.000Z')
  })

  it('keeps reply context as an external target plus quote preview', () => {
    const result = normalizeTelegramMessage(
      textMessage({
        reply_to_message: textMessage({ message_id: 30, text: 'original text' }),
      }),
      1002,
    )
    expect(result.externalReplyToId).toBe('30')
    expect(result.metadata.quote).toEqual(
      expect.objectContaining({
        external_id: '30',
        preview: 'original text',
        author_external_id: '555',
      }),
    )
  })

  it('preserves forward origin', () => {
    const result = normalizeTelegramMessage(
      textMessage({
        forward_origin: {
          type: 'user',
          date: 1_753_260_000,
          sender_user: { id: 777, first_name: 'Origin' },
        },
      }),
      1003,
    )
    expect(result.metadata.forward_origin).toEqual(
      expect.objectContaining({ type: 'user', sender_user_id: '777' }),
    )
  })

  it('normalizes contact cards without flattening to text', () => {
    const result = normalizeTelegramMessage(
      textMessage({
        text: undefined,
        contact: {
          phone_number: '+77015550000',
          first_name: 'Dana',
          user_id: 888,
        },
      }),
      1004,
    )
    expect(result.type).toBe('contact')
    expect(result.content).toBeNull()
    expect(result.metadata.contacts).toEqual([
      expect.objectContaining({ phone: '+77015550000', telegram_user_id: '888' }),
    ])
  })

  it('normalizes locations, live locations, and venues', () => {
    const point = normalizeTelegramMessage(
      textMessage({ text: undefined, location: { latitude: 51.1, longitude: 71.4 } }),
      1005,
    )
    expect(point.type).toBe('location')
    expect(point.metadata.location).toEqual(
      expect.objectContaining({ kind: 'point', latitude: 51.1, longitude: 71.4 }),
    )

    const live = normalizeTelegramMessage(
      textMessage({
        text: undefined,
        location: { latitude: 51.1, longitude: 71.4, live_period: 900 },
      }),
      1006,
    )
    expect(live.metadata.location).toEqual(
      expect.objectContaining({ kind: 'live', live_period_seconds: 900 }),
    )

    const venue = normalizeTelegramMessage(
      textMessage({
        text: undefined,
        venue: {
          location: { latitude: 51.09, longitude: 71.41 },
          title: 'Coffee Boom',
          address: 'Turan 37',
        },
      }),
      1007,
    )
    expect(venue.metadata.location).toEqual(
      expect.objectContaining({ kind: 'venue', name: 'Coffee Boom' }),
    )
  })

  it('marks polls and unknown payloads as unsupported, never empty text', () => {
    const poll = normalizeTelegramMessage(
      textMessage({ text: undefined, poll: { question: 'Lunch?' } }),
      1008,
    )
    expect(poll.type).toBe('unsupported')
    expect(poll.metadata.unsupported).toEqual({ kind: 'poll', preview: 'Lunch?' })

    const unknown = normalizeTelegramMessage(
      textMessage({ text: undefined }),
      1009,
    )
    expect(unknown.type).toBe('unsupported')
    expect(unknown.metadata.unsupported).toEqual({ kind: 'unknown_payload' })
  })

  it('keeps media resolution intact and records the media group', () => {
    const result = normalizeTelegramMessage(
      textMessage({
        text: undefined,
        caption: 'album caption',
        media_group_id: 'grp-1',
        photo: [
          { file_id: 'small', file_unique_id: 'u1', width: 90, height: 90 },
          { file_id: 'big', file_unique_id: 'u2', width: 800, height: 600 },
        ],
      }),
      1010,
    )
    expect(result.type).toBe('image')
    expect(result.content).toBe('album caption')
    expect(result.media).toEqual(
      expect.objectContaining({ file_id: 'big', file_unique_id: 'u2' }),
    )
    expect(result.metadata.media_group_id).toBe('grp-1')
  })

  it('maps service messages to system events', () => {
    const result = normalizeTelegramMessage(
      textMessage({ text: undefined, pinned_message: textMessage({ message_id: 7 }) }),
      1011,
    )
    expect(result.type).toBe('system')
    expect(result.metadata.system).toEqual({ kind: 'message_pinned' })
  })
})

describe('resolveTelegramMedia', () => {
  it('keeps file_id and file_unique_id for every media kind', () => {
    const sticker = resolveTelegramMedia(
      textMessage({
        text: undefined,
        sticker: {
          file_id: 'st1',
          file_unique_id: 'stu1',
          is_animated: true,
          emoji: '🔥',
          set_name: 'pack',
        },
      }),
    )
    expect(sticker).toEqual(
      expect.objectContaining({
        dbType: 'sticker',
        file_id: 'st1',
        file_unique_id: 'stu1',
        mime_type: 'application/x-tgsticker',
        emoji: '🔥',
      }),
    )
  })
})

describe('identity helpers', () => {
  it('resolves display names with fallbacks', () => {
    expect(resolveExternalName(textMessage())).toBe('Aizhan K')
    expect(
      resolveExternalName(
        textMessage({ from: undefined, chat: { id: 1, first_name: 'Chat' } }),
      ),
    ).toBe('Chat')
  })

  it('builds the official identity profile', () => {
    expect(buildTelegramProfile(from, 'biz-1')).toEqual({
      user_id: '555',
      first_name: 'Aizhan',
      last_name: 'K',
      username: 'aizhan',
      language_code: 'ru',
      is_premium: true,
      business_connection_id: 'biz-1',
    })
    expect(buildTelegramProfile(undefined)).toEqual({})
  })
})

describe('normalizeTelegramReaction', () => {
  it('diffs old/new sets including custom and paid reactions', () => {
    const normalized = normalizeTelegramReaction({
      chat: privateChat,
      message_id: 42,
      user: from,
      date: 1_753_262_100,
      old_reaction: [{ type: 'emoji', emoji: '👍' }],
      new_reaction: [
        { type: 'emoji', emoji: '❤️' },
        { type: 'custom_emoji', custom_emoji_id: 'ce9' },
        { type: 'paid' },
      ],
    })
    expect(normalized?.reactorExternalId).toBe('555')
    expect(normalized?.ops).toEqual([
      // Canonical: a presentation selector is not part of the identity.
      expect.objectContaining({ emoji: '❤', action: 'added' }),
      expect.objectContaining({ emoji: 'custom:ce9', action: 'added' }),
      expect.objectContaining({ emoji: '⭐', action: 'added' }),
      expect.objectContaining({ emoji: '👍', action: 'removed' }),
    ])
  })

  it('returns null without a reactor identity', () => {
    expect(
      normalizeTelegramReaction({
        chat: privateChat,
        message_id: 42,
        date: 1_753_262_100,
        old_reaction: [],
        new_reaction: [{ type: 'emoji', emoji: '👍' }],
      }),
    ).toBeNull()
  })
})
