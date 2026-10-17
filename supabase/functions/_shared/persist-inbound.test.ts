import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { persistInboundMessage } from './persist.ts'
import type { NormalizedMessageInput } from './types.ts'

type Row = Record<string, unknown>

function fixture() {
  const messages: Row[] = []
  const attachments: Row[] = []
  const children: Row[] = [
    {
      conversation_id: 'conversation-1',
      external_reply_to_id: 'provider-1',
      reply_to_message_id: null,
    },
  ]
  const reactions: Row[] = [
    {
      channel_id: 'channel-1',
      provider_message_id: 'provider-1',
      message_id: null,
    },
  ]
  const removed: string[] = []
  const controls = {
    attachmentFailure: false,
    attachmentResponseLost: false,
    replyFailure: false,
    reactionFailure: false,
  }
  const databaseError = { code: 'TEST', message: 'Temporary write failure' }
  const client = {
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          removed.push(...paths)
          return { error: null }
        },
      }),
    },
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = []
      let insert: Row | null = null
      let upsert: Row[] | null = null
      let update: Row | null = null
      const run = () => {
        if (table === 'messages' && insert) {
          if (
            messages.some(
              (row) =>
                row.conversation_id === insert?.conversation_id &&
                row.external_id === insert.external_id,
            )
          )
            return {
              data: null,
              error: { code: '23505', message: 'Duplicate' },
            }
          messages.push(insert)
          return { data: null, error: null }
        }
        if (table === 'message_attachments' && upsert) {
          if (controls.attachmentFailure)
            return { data: null, error: databaseError }
          const added = upsert.filter(
            (row) =>
              !attachments.some(
                (existing) =>
                  existing.message_id === row.message_id &&
                  existing.position === row.position,
              ),
          )
          attachments.push(...added)
          if (controls.attachmentResponseLost)
            return {
              data: null,
              error: { code: '', message: 'Response lost after commit' },
            }
          return { data: added, error: null }
        }
        const rows =
          table === 'messages' ? [...messages, ...children] : reactions
        const matched = rows.filter((row) =>
          filters.every((filter) => filter(row)),
        )
        if (update) {
          if (
            (table === 'messages' && controls.replyFailure) ||
            (table === 'message_reactions' && controls.reactionFailure)
          )
            return { data: null, error: databaseError }
          matched.forEach((row) => Object.assign(row, update))
        }
        return { data: matched, error: null }
      }
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value)
          return builder
        },
        is: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value)
          return builder
        },
        insert: (row: Row) => {
          insert = row
          return builder
        },
        upsert: (rows: Row[], options: unknown) => {
          expect(options).toEqual({
            onConflict: 'message_id,position',
            ignoreDuplicates: true,
          })
          upsert = rows
          return builder
        },
        update: (row: Row) => {
          update = row
          return builder
        },
        maybeSingle: async () => {
          const result = run()
          return { data: result.data?.[0] ?? null, error: result.error }
        },
        then: (resolve: (result: ReturnType<typeof run>) => unknown) =>
          Promise.resolve(run()).then(resolve),
      }
      return builder
    },
  }
  return {
    client: client as unknown as Parameters<typeof persistInboundMessage>[0],
    messages,
    attachments,
    children,
    reactions,
    removed,
    controls,
  }
}

function input(attempt: string): NormalizedMessageInput {
  return {
    workspaceId: 'workspace-1',
    conversationId: 'conversation-1',
    channelId: 'channel-1',
    externalId: 'provider-1',
    type: 'image',
    content: 'Two images',
    metadata: {},
    attachments: [0, 1].map((position) => ({
      position,
      kind: 'image',
      downloadStatus: 'stored',
      storagePath: `workspace-1/conversation-1/${attempt}/${position}.jpg`,
    })),
  }
}

describe('inbound partial persistence recovery', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('repairs failed attachment bookkeeping on duplicate retry without another message or lost legacy file', async () => {
    const state = fixture()
    state.controls.attachmentFailure = true
    expect(
      await persistInboundMessage(
        state.client,
        'attempt-1',
        input('attempt-1'),
      ),
    ).toMatchObject({ outcome: 'error' })
    expect(state.messages).toHaveLength(1)
    expect(state.attachments).toHaveLength(0)
    expect(state.removed).toEqual([
      'workspace-1/conversation-1/attempt-1/1.jpg',
    ])

    state.controls.attachmentFailure = false
    expect(
      await persistInboundMessage(
        state.client,
        'attempt-2',
        input('attempt-2'),
      ),
    ).toEqual({ outcome: 'duplicate' })
    expect(state.messages).toHaveLength(1)
    expect(state.attachments).toEqual([
      expect.objectContaining({
        message_id: 'attempt-1',
        position: 0,
        storage_path: 'workspace-1/conversation-1/attempt-1/0.jpg',
      }),
      expect.objectContaining({
        message_id: 'attempt-1',
        position: 1,
        storage_path: 'workspace-1/conversation-1/attempt-2/1.jpg',
      }),
    ])
    expect(state.children[0].reply_to_message_id).toBe('attempt-1')
    expect(state.reactions[0].message_id).toBe('attempt-1')
    expect(state.removed).toContain(
      'workspace-1/conversation-1/attempt-2/0.jpg',
    )
    expect(state.removed).not.toContain(
      'workspace-1/conversation-1/attempt-1/0.jpg',
    )

    expect(
      await persistInboundMessage(
        state.client,
        'attempt-3',
        input('attempt-3'),
      ),
    ).toEqual({ outcome: 'duplicate' })
    expect(state.attachments).toHaveLength(2)
    expect(state.removed).toEqual(
      expect.arrayContaining([
        'workspace-1/conversation-1/attempt-3/0.jpg',
        'workspace-1/conversation-1/attempt-3/1.jpg',
      ]),
    )
  })

  it.each(['replyFailure', 'reactionFailure'] as const)(
    'repairs %s after the message and attachments already committed',
    async (failure) => {
      const state = fixture()
      state.controls[failure] = true
      expect(
        await persistInboundMessage(
          state.client,
          'attempt-1',
          input('attempt-1'),
        ),
      ).toMatchObject({ outcome: 'error' })
      state.controls[failure] = false
      expect(
        await persistInboundMessage(
          state.client,
          'attempt-2',
          input('attempt-2'),
        ),
      ).toEqual({ outcome: 'duplicate' })
      expect(state.messages).toHaveLength(1)
      expect(state.attachments).toHaveLength(2)
      expect(state.children[0].reply_to_message_id).toBe('attempt-1')
      expect(state.reactions[0].message_id).toBe('attempt-1')
    },
  )

  it('does not delete attachment objects when the database committed but its HTTP response was lost', async () => {
    const state = fixture()
    state.controls.attachmentResponseLost = true
    expect(
      await persistInboundMessage(
        state.client,
        'attempt-1',
        input('attempt-1'),
      ),
    ).toMatchObject({ outcome: 'error' })
    expect(state.attachments).toHaveLength(2)
    expect(state.removed).toEqual([])
    state.controls.attachmentResponseLost = false
    expect(
      await persistInboundMessage(
        state.client,
        'attempt-2',
        input('attempt-2'),
      ),
    ).toEqual({ outcome: 'duplicate' })
    expect(state.attachments).toHaveLength(2)
    expect(state.removed).toEqual([
      'workspace-1/conversation-1/attempt-2/0.jpg',
      'workspace-1/conversation-1/attempt-2/1.jpg',
    ])
  })
})
