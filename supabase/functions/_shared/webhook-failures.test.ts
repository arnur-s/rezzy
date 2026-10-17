import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test-secret' } })
  return { createClient: vi.fn() }
})
vi.mock('jsr:@supabase/supabase-js@2', () => ({
  createClient: mocks.createClient,
}))

import instagram from '../instagram-webhook/index.ts'
import whatsapp from '../whatsapp-webhook/index.ts'

type Row = Record<string, unknown>
type Failure =
  | 'claim'
  | 'read'
  | 'lookup'
  | 'status'
  | 'reaction'
  | 'delete'
  | null

function fixture(failure: Failure) {
  const recorded: Row[] = []
  const statuses: Row[] = []
  const messages: Row[] = [
    {
      id: 'other-message',
      workspace_id: 'workspace-1',
      external_id: 'provider-1',
      direction: 'outbound',
      'conversations.channel_id': 'other-channel',
    },
    {
      id: 'message-1',
      conversation_id: 'conversation-1',
      workspace_id: 'workspace-1',
      external_id: 'provider-1',
      direction: 'outbound',
      'conversations.channel_id': 'channel-1',
    },
  ]
  const client = {
    rpc: vi.fn(async (name: string) => {
      if (name === 'get_whatsapp_channel_by_phone')
        return {
          data: [
            {
              channel_id: 'channel-1',
              workspace_id: 'workspace-1',
              is_active: true,
            },
          ],
          error: null,
        }
      if (name === 'get_channel_credentials')
        return { data: { access_token: 'test-token' }, error: null }
      if (name === 'claim_provider_event')
        return failure === 'claim'
          ? { data: null, error: { message: 'Unavailable' } }
          : { data: [{ event_id: 'event-1', duplicate: false }], error: null }
      if (name === 'mark_outbound_message_read')
        return {
          data: null,
          error:
            failure === 'read'
              ? { code: 'TEST', message: 'Unavailable' }
              : null,
        }
      throw new Error(`Unexpected RPC ${name}`)
    }),
    from(table: string) {
      let values: Row | null = null
      let insert: Row | null = null
      const filters: Array<(row: Row) => boolean> = []
      const result = () => {
        if (table === 'messages') {
          const matched = messages.filter((row) =>
            filters.every((filter) => filter(row)),
          )
          if (values && failure !== 'delete')
            matched.forEach((row) => Object.assign(row, values))
          return failure === 'lookup' || (values && failure === 'delete')
            ? { data: null, error: { code: 'TEST', message: 'Unavailable' } }
            : {
                data: matched[0] ?? null,
                error: null,
              }
        }
        if (table === 'message_reactions' && failure === 'reaction')
          return { data: null, error: { code: 'TEST', message: 'Unavailable' } }
        if (table === 'message_status_events' && insert) {
          if (failure === 'status')
            return {
              data: null,
              error: { code: 'TEST', message: 'Unavailable' },
            }
          statuses.push(insert)
        }
        if (table === 'provider_events' && values) recorded.push(values)
        return {
          data:
            table === 'channels'
              ? {
                  id: 'channel-1',
                  workspace_id: 'workspace-1',
                  is_active: true,
                  workspaces: { deleted_at: null },
                }
              : [],
          error: null,
        }
      }
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value)
          return builder
        },
        neq: () => builder,
        or: () => builder,
        limit: () => builder,
        update: (next: Row) => {
          values = next
          return builder
        },
        insert: (next: Row) => {
          insert = next
          return builder
        },
        maybeSingle: async () => result(),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) =>
          Promise.resolve(result()).then(resolve),
      }
      return builder
    },
  }
  mocks.createClient.mockReturnValue(client)
  return { recorded, statuses, messages, client }
}

function signedRequest(payload: Row): Request {
  const body = JSON.stringify(payload)
  return new Request('https://webhook.example.test/', {
    method: 'POST',
    body,
    headers: {
      'x-hub-signature-256': `sha256=${createHmac('sha256', 'test-secret').update(body).digest('hex')}`,
    },
  })
}

function instagramPayload(event: Row): Row {
  return {
    object: 'instagram',
    entry: [
      {
        id: 'ig-1',
        messaging: [
          { sender: { id: 'person-1' }, timestamp: Date.now(), ...event },
        ],
      },
    ],
  }
}

function whatsappPayload(value: Row): Row {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: { metadata: { phone_number_id: 'phone-1' }, ...value },
          },
        ],
      },
    ],
  }
}

describe('webhook transient failures', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it.each([
    { read: { mid: 'provider-1' } },
    { reaction: { mid: 'provider-1', action: 'react', emoji: '👍' } },
    { message: { mid: 'provider-1', is_echo: true } },
    { message: { mid: 'provider-1', is_deleted: true } },
  ])('does not acknowledge an Instagram claim outage for %j', async (event) => {
    const state = fixture('claim')
    expect(
      (await instagram.fetch(signedRequest(instagramPayload(event)))).status,
    ).toBe(500)
    expect(state.recorded).toEqual([])
  })

  it.each(['read', 'lookup', 'status'] as const)(
    'keeps Instagram read receipts retryable when %s fails',
    async (failure) => {
      const state = fixture(failure)
      expect(
        (
          await instagram.fetch(
            signedRequest(instagramPayload({ read: { mid: 'provider-1' } })),
          )
        ).status,
      ).toBe(500)
      expect(state.recorded).toContainEqual(
        expect.objectContaining({ status: 'failed', error_kind: 'temporary' }),
      )
      expect(state.recorded.some((row) => row.status === 'processed')).toBe(
        false,
      )
    },
  )

  it.each(['lookup', 'status'] as const)(
    'keeps WhatsApp status callbacks retryable when %s fails',
    async (failure) => {
      const state = fixture(failure)
      const payload = whatsappPayload({
        statuses: [
          {
            id: 'provider-1',
            status: 'delivered',
            timestamp: String(Math.floor(Date.now() / 1000)),
          },
        ],
      })
      expect((await whatsapp.fetch(signedRequest(payload))).status).toBe(500)
      expect(state.recorded).toContainEqual(
        expect.objectContaining({ status: 'failed', error_kind: 'temporary' }),
      )
      expect(state.recorded.some((row) => row.status === 'processed')).toBe(
        false,
      )
    },
  )

  it('does not acknowledge a reaction whose database write failed', async () => {
    const state = fixture('reaction')
    const payload = instagramPayload({
      reaction: { mid: 'provider-1', action: 'react', emoji: '👍' },
    })
    expect((await instagram.fetch(signedRequest(payload))).status).toBe(500)
    expect(state.recorded).toContainEqual(
      expect.objectContaining({ status: 'failed', error_kind: 'temporary' }),
    )
    expect(state.recorded.some((row) => row.status === 'processed')).toBe(false)
  })

  it.each(['lookup', 'delete', 'status'] as const)(
    'keeps Instagram deletion retryable when %s fails',
    async (failure) => {
      const state = fixture(failure)
      const payload = instagramPayload({
        message: { mid: 'provider-1', is_deleted: true },
      })
      expect((await instagram.fetch(signedRequest(payload))).status).toBe(500)
      expect(state.recorded).toContainEqual(
        expect.objectContaining({ status: 'failed', error_kind: 'temporary' }),
      )
      expect(state.recorded.some((row) => row.status === 'processed')).toBe(
        false,
      )
    },
  )

  it('deletes only the Instagram target on the routed channel', async () => {
    const state = fixture(null)
    const payload = instagramPayload({
      message: { mid: 'provider-1', is_deleted: true },
    })
    expect((await instagram.fetch(signedRequest(payload))).status).toBe(200)
    expect(state.messages[0].deleted_at).toBeUndefined()
    expect(state.messages[1].deleted_at).toEqual(expect.any(String))
    expect(state.statuses[0].message_id).toBe('message-1')
  })

  it('records WhatsApp status only on the routed outbound channel', async () => {
    const state = fixture(null)
    const payload = whatsappPayload({
      statuses: [{ id: 'provider-1', status: 'read' }],
    })
    expect((await whatsapp.fetch(signedRequest(payload))).status).toBe(200)
    expect(state.statuses[0].message_id).toBe('message-1')
  })

  it('acknowledges a read receipt only after persistence succeeds', async () => {
    const state = fixture(null)
    expect(
      (
        await instagram.fetch(
          signedRequest(instagramPayload({ read: { mid: 'provider-1' } })),
        )
      ).status,
    ).toBe(200)
    expect(state.statuses).toHaveLength(1)
    expect(state.statuses[0].message_id).toBe('message-1')
    expect(state.recorded).toContainEqual(
      expect.objectContaining({ status: 'processed' }),
    )
  })
})
