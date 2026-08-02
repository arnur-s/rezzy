import { describe, expect, it } from 'vitest'
import { applyReactionOps } from './persist.ts'
import { normalizeReactionEmoji } from './reaction-emoji.ts'
import {
  diffTelegramReactionSets,
  instagramReactionOp,
  whatsappReactionOp,
} from './reactions.ts'

// Reaction identity is invisible in a diff, so the sequences under test are
// spelled by code point. WhatsApp sends HEART + VS16; Telegram sends HEART.
const VS16 = String.fromCodePoint(0xfe0f)
const HEART = String.fromCodePoint(0x2764)
const FIRE = String.fromCodePoint(0x1f525)

const WORKSPACE = 'workspace-1'
const CHANNEL = 'channel-1'
const PROVIDER_MESSAGE = 'wamid.100'
const REACTOR = '77015550000'

type Row = Record<string, unknown>

/**
 * An in-memory stand-in for the slice of PostgREST `applyReactionOps` uses:
 * filtered select, filtered update with `select('id')`, and insert. It enforces
 * the reaction unique key and applies the normalizing trigger added in
 * 20260803100000_normalize_reaction_emoji.sql, so a test that passes here is a
 * test the database would agree with.
 */
function createFakeSupabase(seed: { messages?: Row[]; reactions?: Row[] } = {}) {
  const tables: Record<string, Array<Row>> = {
    messages: [...(seed.messages ?? [])],
    message_reactions: [...(seed.reactions ?? [])],
  }
  let nextId = 1

  const identity = (row: Row) =>
    [
      row.channel_id,
      row.provider_message_id,
      row.reactor_external_id,
      row.emoji,
    ].join('\t')

  /** `provider_timestamp.is.null,provider_timestamp.lte.<iso>` */
  const orFilter = (expression: string) => (row: Row) =>
    expression.split(',').some((clause) => {
      const [column, operator, ...rest] = clause.split('.')
      const value = rest.join('.')
      if (operator === 'is') return row[column] === null
      if (operator === 'lte') return String(row[column]) <= value
      throw new Error(`unsupported or() operator: ${operator}`)
    })

  function query(table: string, kind: 'select' | 'update' | 'insert', payload?: Row) {
    const filters: Array<(row: Row) => boolean> = []
    let returning = kind === 'select'
    let single = false
    let rowLimit: number | null = null

    const run = () => {
      if (kind === 'insert') {
        const row: Row = {
          id: `row-${nextId++}`,
          conversation_id: null,
          message_id: null,
          provider_timestamp: null,
          ...payload,
        }
        // The database normalizes on write, whatever the caller sent.
        if (typeof row.emoji === 'string') {
          row.emoji = normalizeReactionEmoji(row.emoji)
        }
        if (tables[table].some((item) => identity(item) === identity(row))) {
          return {
            data: null,
            error: { code: '23505', message: 'duplicate key value' },
          }
        }
        tables[table].push(row)
        const projection = { id: row.id }
        return {
          data: returning ? (single ? projection : [projection]) : null,
          error: null,
        }
      }

      const matched = tables[table].filter((row) =>
        filters.every((filter) => filter(row)),
      )

      if (kind === 'update') {
        for (const row of matched) {
          Object.assign(row, payload)
          if (typeof row.emoji === 'string') {
            row.emoji = normalizeReactionEmoji(row.emoji)
          }
        }
        return {
          data: returning ? matched.map((row) => ({ id: row.id })) : null,
          error: null,
        }
      }

      const rows = rowLimit === null ? matched : matched.slice(0, rowLimit)
      return { data: single ? (rows[0] ?? null) : rows, error: null }
    }

    const api = {
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value)
        return api
      },
      neq(column: string, value: unknown) {
        filters.push((row) => row[column] !== value)
        return api
      },
      is(column: string, value: unknown) {
        filters.push((row) => row[column] === value)
        return api
      },
      or(expression: string) {
        filters.push(orFilter(expression))
        return api
      },
      limit(count: number) {
        rowLimit = count
        return api
      },
      select() {
        returning = true
        return api
      },
      maybeSingle() {
        single = true
        return api
      },
      then<T>(onFulfilled: (value: unknown) => T) {
        return Promise.resolve(run()).then(onFulfilled)
      },
    }
    return api
  }

  const client = {
    from(table: string) {
      return {
        select: () => query(table, 'select'),
        update: (values: Row) => query(table, 'update', values),
        insert: (values: Row) => query(table, 'insert', values),
      }
    },
  }

  return {
    client: client as unknown as Parameters<typeof applyReactionOps>[0],
    reactions: tables.message_reactions,
  }
}

function storedReaction(overrides: Row = {}): Row {
  return {
    id: 'existing-1',
    workspace_id: WORKSPACE,
    channel_id: CHANNEL,
    conversation_id: 'conversation-1',
    message_id: 'message-1',
    provider_message_id: PROVIDER_MESSAGE,
    reactor_external_id: REACTOR,
    is_from_contact: true,
    emoji: HEART,
    action: 'added',
    provider_timestamp: '2026-08-03T10:00:00Z',
    ...overrides,
  }
}

const target = {
  workspaceId: WORKSPACE,
  channelId: CHANNEL,
  providerMessageId: PROVIDER_MESSAGE,
}

describe('applyReactionOps emoji identity', () => {
  it('does not add a second reaction when a provider respells one already stored', async () => {
    // Telegram delivered the bare heart; WhatsApp now sends the qualified one
    // for the same reactor on the same message.
    const { client, reactions } = createFakeSupabase({
      reactions: [storedReaction()],
    })
    const op = whatsappReactionOp({
      reactorExternalId: REACTOR,
      emoji: HEART + VS16,
      providerTimestamp: '2026-08-03T10:01:00Z',
    })

    const affected = await applyReactionOps(client, target, op ? [op] : [])

    expect(reactions).toHaveLength(1)
    expect(reactions[0]).toMatchObject({
      id: 'existing-1',
      emoji: HEART,
      action: 'added',
    })
    expect(affected).toEqual(['existing-1'])
  })

  it('removes a reaction whose removal event respells the emoji', async () => {
    // The row was stored from a bare heart; Telegram now reports the reactor's
    // old set as the qualified heart and the new set as empty.
    const { client, reactions } = createFakeSupabase({
      reactions: [storedReaction()],
    })
    const ops = diffTelegramReactionSets({
      reactorExternalId: REACTOR,
      isFromContact: true,
      oldEmojis: [HEART + VS16],
      newEmojis: [],
      providerTimestamp: '2026-08-03T10:02:00Z',
    })

    await applyReactionOps(client, target, ops)

    expect(reactions).toHaveLength(1)
    expect(reactions[0]).toMatchObject({ emoji: HEART, action: 'removed' })
  })

  it('stores one canonical reaction whichever provider reported it', async () => {
    const whatsapp = createFakeSupabase()
    const instagram = createFakeSupabase()

    const whatsappOp = whatsappReactionOp({
      reactorExternalId: REACTOR,
      emoji: HEART + VS16,
      providerTimestamp: null,
    })
    const instagramOp = instagramReactionOp({
      reactorExternalId: REACTOR,
      action: 'react',
      emoji: HEART + VS16,
      reactionName: 'love',
      providerTimestamp: null,
    })

    await applyReactionOps(whatsapp.client, target, whatsappOp ? [whatsappOp] : [])
    await applyReactionOps(
      instagram.client,
      target,
      instagramOp ? [instagramOp] : [],
    )

    expect(whatsapp.reactions[0].emoji).toBe(HEART)
    expect(instagram.reactions[0].emoji).toBe(HEART)
  })

  it('links a new reaction to the message it targets', async () => {
    const { client, reactions } = createFakeSupabase({
      messages: [
        {
          id: 'message-1',
          workspace_id: WORKSPACE,
          conversation_id: 'conversation-1',
          external_id: PROVIDER_MESSAGE,
        },
      ],
    })
    const op = whatsappReactionOp({
      reactorExternalId: REACTOR,
      emoji: HEART + VS16,
      providerTimestamp: null,
    })

    await applyReactionOps(client, target, op ? [op] : [])

    expect(reactions).toHaveLength(1)
    expect(reactions[0]).toMatchObject({
      emoji: HEART,
      message_id: 'message-1',
      conversation_id: 'conversation-1',
      workspace_id: WORKSPACE,
    })
  })

  it('keeps the reaction WhatsApp is replacing others with, respelled or not', async () => {
    // WhatsApp replace semantics: everything else this reactor had goes, the
    // incoming emoji stays — and "the same emoji" has to survive a respelling.
    const { client, reactions } = createFakeSupabase({
      reactions: [
        storedReaction(),
        storedReaction({ id: 'existing-2', emoji: FIRE }),
      ],
    })
    const op = whatsappReactionOp({
      reactorExternalId: REACTOR,
      emoji: HEART + VS16,
      providerTimestamp: '2026-08-03T10:03:00Z',
    })

    await applyReactionOps(client, target, op ? [op] : [], {
      replaceOthers: { reactorExternalId: REACTOR, keepEmoji: op?.emoji },
    })

    expect(reactions).toEqual([
      expect.objectContaining({ emoji: HEART, action: 'added' }),
      expect.objectContaining({ emoji: FIRE, action: 'removed' }),
    ])
  })
})
