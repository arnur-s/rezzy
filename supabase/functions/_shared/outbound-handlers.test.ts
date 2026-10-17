import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  vi.stubGlobal('Deno', {
    env: {
      get: (key: string) =>
        key.startsWith('SUPABASE_') ? 'local-test-value' : undefined,
    },
  })
  return { createClient: vi.fn(), fetch: vi.fn() }
})
vi.mock('jsr:@supabase/supabase-js@2', () => ({
  createClient: mocks.createClient,
}))

import telegram from '../send-telegram-message/index.ts'
import whatsapp from '../send-whatsapp-message/index.ts'
import instagram from '../send-instagram-message/index.ts'

type Row = Record<string, unknown>
type Provider = 'telegram' | 'whatsapp' | 'instagram'

/** Executes equality filters and mutations, while provider I/O stays fully mocked. */
function fixture(provider: Provider) {
  const message: Row = {
    id: 'message-1',
    workspace_id: 'workspace-1',
    conversation_id: 'conversation-1',
    direction: 'outbound',
    status: 'sent',
    external_id: null,
    content: 'Test reply',
    type: 'text',
    media_url: null,
    media_filename: null,
    media_mime_type: null,
    reply_to_message_id: null,
  }
  const tables: Record<string, Row[]> = {
    messages: [
      message,
      {
        id: 'inbound-1',
        conversation_id: 'conversation-1',
        direction: 'inbound',
        created_at: new Date().toISOString(),
      },
    ],
    workspace_members: [{ workspace_id: 'workspace-1', user_id: 'user-1' }],
    conversations: [
      {
        id: 'conversation-1',
        workspace_id: 'workspace-1',
        contact_id: 'contact-1',
        channel_id: 'channel-1',
      },
    ],
    channels: [
      {
        id: 'channel-1',
        workspace_id: 'workspace-1',
        type: provider,
        is_active: true,
      },
    ],
    contact_channels: [
      {
        contact_id: 'contact-1',
        channel_id: 'channel-1',
        channel_type: provider,
        external_id: '15551234567',
        metadata: {},
      },
      // A merged contact can have a second identity on another channel of the
      // same provider; it must not make this delivery ambiguous.
      {
        contact_id: 'contact-1',
        channel_id: 'channel-2',
        channel_type: provider,
        external_id: '15559876543',
        metadata: {},
      },
    ],
    message_status_events: [],
  }
  const fences = new Set<string>()
  const controls = { failConversationUpdate: false, failReconciliation: false }
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: 'https://media.example.test/signed' },
    error: null,
  })
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
    },
    storage: { from: () => ({ createSignedUrl }) },
    rpc: vi.fn(async (name: string, args: Row) => {
      if (name === 'get_channel_credentials')
        return {
          data: {
            bot_token: 'test-token',
            access_token: 'test-token',
            phone_number_id: 'phone-1',
            instagram_user_id: 'ig-1',
          },
          error: null,
        }
      const id = String(args.p_message_id)
      if (name === 'record_outbound_preflight_failure') {
        if (fences.has(id) || message.external_id || message.status !== 'sent')
          return { data: false, error: null }
        message.status = 'failed'
        tables.message_status_events.push({ message_id: id, status: 'failed' })
        return { data: true, error: null }
      }
      if (name === 'claim_outbound_message') {
        if (fences.has(id) || message.external_id || message.status !== 'sent')
          return { data: false, error: null }
        fences.add(id)
        return { data: true, error: null }
      }
      if (name === 'release_outbound_message') {
        if (fences.has(id) && !message.external_id) {
          fences.delete(id)
          message.status = 'failed'
        }
        return { data: null, error: null }
      }
      if (name === 'reconcile_outbound_receipts') {
        expect(message.external_id).toBeTruthy()
        return {
          data: controls.failReconciliation ? null : 0,
          error: controls.failReconciliation ? { code: 'TEST' } : null,
        }
      }
      throw new Error(`Unexpected RPC ${name}`)
    }),
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = []
      let values: Row | null = null
      let insert: Row | null = null
      let limit = Infinity
      const run = () => {
        if (
          values &&
          table === 'conversations' &&
          controls.failConversationUpdate
        )
          return {
            data: null,
            error: { code: 'TEST', message: 'Summary update failed' },
          }
        if (insert) (tables[table] ??= []).push(insert)
        const rows = (tables[table] ?? [])
          .filter((row) => filters.every((filter) => filter(row)))
          .slice(0, limit)
        if (values) rows.forEach((row) => Object.assign(row, values))
        return { data: rows.map((row) => ({ ...row })), error: null }
      }
      const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => {
          filters.push((row) => row[key] === value)
          return builder
        },
        is: (key: string, value: unknown) => {
          filters.push((row) => row[key] === value)
          return builder
        },
        order: () => builder,
        limit: (count: number) => {
          limit = count
          return builder
        },
        update: (next: Row) => {
          values = next
          return builder
        },
        insert: (next: Row) => {
          insert = next
          return builder
        },
        maybeSingle: async () => {
          const result = run()
          if (result.error) return result
          if (result.data.length > 1)
            return {
              data: null,
              error: { code: 'PGRST116', message: 'Multiple rows' },
            }
          return { data: result.data[0] ?? null, error: null }
        },
        then: (resolve: (result: ReturnType<typeof run>) => unknown) =>
          Promise.resolve(run()).then(resolve),
      }
      return builder
    },
  }
  mocks.createClient.mockReturnValue(client)
  return { message, tables, fences, controls, client, createSignedUrl }
}

function request() {
  return new Request('https://functions.example.test/send', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer local-test-jwt',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messageId: 'message-1' }),
  })
}

function accepted(provider: Provider): Response {
  return Response.json(
    provider === 'telegram'
      ? { ok: true, result: { message_id: 123 } }
      : provider === 'whatsapp'
        ? { messages: [{ id: 'provider-123' }] }
        : { message_id: 'provider-123' },
  )
}

function rejected(provider: Provider): Response {
  return Response.json(
    provider === 'telegram'
      ? { ok: false, error_code: 400, description: 'Test rejection' }
      : { error: { code: 400, message: 'Test rejection' } },
    { status: 400 },
  )
}

describe.each([
  ['telegram', telegram],
  ['whatsapp', whatsapp],
  ['instagram', instagram],
] as const)('%s outbound handler', (provider, handler) => {
  beforeEach(() => {
    mocks.fetch.mockReset()
    vi.stubGlobal('fetch', mocks.fetch)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => vi.restoreAllMocks())

  it('sends through the matching channel for a merged contact with multiple identities', async () => {
    const state = fixture(provider)
    mocks.fetch.mockResolvedValue(accepted(provider))
    const response = await handler.fetch(request())
    expect(response.status).toBe(200)
    expect(state.message.external_id).toBeTruthy()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body) as Row
    expect(
      provider === 'telegram'
        ? body.chat_id
        : provider === 'whatsapp'
          ? body.to
          : (body.recipient as Row).id,
    ).toBe('15551234567')
  })

  it('refuses cross-workspace attachments before privileged signing or provider delivery', async () => {
    const state = fixture(provider)
    Object.assign(state.message, {
      type: 'image',
      media_url: 'other-workspace/conversation-1/message-1/photo.jpg',
    })
    const response = await handler.fetch(request())
    expect(response.status).toBe(400)
    expect(state.createSignedUrl).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('makes one provider call when two requests race for the same outbound row', async () => {
    const state = fixture(provider)
    let complete: (response: Response) => void = () => {
      throw new Error('Provider not called')
    }
    let started: () => void = () => {}
    const providerStarted = new Promise<void>((resolve) => {
      started = resolve
    })
    mocks.fetch.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve
          started()
        }),
    )
    const first = handler.fetch(request())
    await providerStarted
    const second = await handler.fetch(request())
    expect(second.status).toBe(409)
    complete(accepted(provider))
    expect((await first).status).toBe(200)
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(state.fences.has('message-1')).toBe(true)
  })

  it('retains the fence after an ambiguous transport failure so retry cannot duplicate delivery', async () => {
    const state = fixture(provider)
    mocks.fetch.mockRejectedValue(new Error('Response lost'))
    expect((await handler.fetch(request())).status).toBe(502)
    expect(state.message.status).toBe('sent')
    const retry = await handler.fetch(request())
    expect(retry.status).toBe(409)
    expect(await retry.json()).toEqual({ code: 'delivery_unconfirmed' })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('does not let another request preflight failure corrupt an in-flight send', async () => {
    const state = fixture(provider)
    let complete: (response: Response) => void = () => {}
    let started: () => void = () => {}
    const providerStarted = new Promise<void>((resolve) => {
      started = resolve
    })
    mocks.fetch.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve
          started()
        }),
    )
    const first = handler.fetch(request())
    await providerStarted
    state.tables.channels[0].is_active = false
    expect((await handler.fetch(request())).status).toBeGreaterThanOrEqual(400)
    expect(state.message.status).toBe('sent')
    expect(state.tables.message_status_events).toEqual([])
    complete(accepted(provider))
    expect((await first).status).toBe(200)
    expect(state.message.status).not.toBe('failed')
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('records a preflight rejection when no dispatch owns the message', async () => {
    const state = fixture(provider)
    state.tables.channels[0].is_active = false
    expect((await handler.fetch(request())).status).toBeGreaterThanOrEqual(400)
    expect(state.message.status).toBe('failed')
    expect(state.tables.message_status_events).toContainEqual({
      message_id: 'message-1',
      status: 'failed',
    })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it.each([null, {}, { messages: [{ id: {} }] }])(
    'retains the fence for malformed provider confirmation %j',
    async (body) => {
      const state = fixture(provider)
      mocks.fetch.mockResolvedValue(Response.json(body))
      const response = await handler.fetch(request())
      expect(response.status).toBe(502)
      expect(await response.json()).toEqual({ code: 'delivery_unconfirmed' })
      expect(state.fences.has('message-1')).toBe(true)
      expect(state.message.status).toBe('sent')
    },
  )

  it('releases a definitive provider rejection and permits a deliberate retry', async () => {
    const state = fixture(provider)
    mocks.fetch
      .mockResolvedValueOnce(rejected(provider))
      .mockResolvedValueOnce(accepted(provider))
    expect((await handler.fetch(request())).status).toBe(502)
    expect(state.message.status).toBe('failed')
    expect(state.fences.has('message-1')).toBe(false)
    state.message.status = 'sent'
    expect((await handler.fetch(request())).status).toBe(200)
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })

  it('reports success if the provider accepted delivery but the conversation summary failed', async () => {
    const state = fixture(provider)
    state.controls.failConversationUpdate = true
    mocks.fetch.mockResolvedValue(accepted(provider))
    const response = await handler.fetch(request())
    expect(response.status).toBe(200)
    expect((await response.json()).ok).toBe(true)
    expect(state.message.external_id).toBeTruthy()
  })

  it('never sends an already accepted message again even if its status is stale', async () => {
    const state = fixture(provider)
    Object.assign(state.message, {
      status: 'failed',
      external_id: 'provider-123',
    })
    expect((await handler.fetch(request())).status).toBe(200)
    expect(mocks.fetch).not.toHaveBeenCalled()
    if (provider !== 'telegram')
      expect(state.client.rpc).toHaveBeenCalledWith(
        'reconcile_outbound_receipts',
        { p_message_id: 'message-1' },
      )
  })

  if (provider !== 'telegram') {
    it('preserves acceptance through a receipt replay outage and replays on a safe repeated request', async () => {
      const state = fixture(provider)
      state.controls.failReconciliation = true
      mocks.fetch.mockResolvedValue(accepted(provider))
      expect((await handler.fetch(request())).status).toBe(200)
      state.controls.failReconciliation = false
      expect((await handler.fetch(request())).status).toBe(200)
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
      expect(
        state.client.rpc.mock.calls.filter(
          ([name]) => name === 'reconcile_outbound_receipts',
        ),
      ).toHaveLength(2)
    })
  }

  if (provider === 'whatsapp') {
    it('retains the fence when the canonical recipient is rejected but the fallback response is lost', async () => {
      const state = fixture(provider)
      state.tables.contact_channels[0].external_id = '77015550000'
      mocks.fetch
        .mockResolvedValueOnce(
          Response.json(
            { error: { code: 131030, message: 'Test recipient not allowed' } },
            { status: 400 },
          ),
        )
        .mockRejectedValueOnce(new Error('Fallback response lost'))
      const response = await handler.fetch(request())
      expect(response.status).toBe(502)
      expect(await response.json()).toEqual({ code: 'delivery_unconfirmed' })
      expect(mocks.fetch).toHaveBeenCalledTimes(2)
      expect(state.message.status).toBe('sent')
      expect(state.fences.has('message-1')).toBe(true)
    })

    it('caches the accepted fallback only on the matching merged-contact channel', async () => {
      const state = fixture(provider)
      state.tables.contact_channels[0].external_id = '77015550000'
      mocks.fetch
        .mockResolvedValueOnce(
          Response.json(
            { error: { code: 131030, message: 'Test recipient not allowed' } },
            { status: 400 },
          ),
        )
        .mockResolvedValueOnce(accepted(provider))
      expect((await handler.fetch(request())).status).toBe(200)
      expect(state.tables.contact_channels[0].metadata).toEqual({
        whatsapp_dial_id: '787015550000',
      })
      expect(state.tables.contact_channels[1].metadata).toEqual({})
    })
  }
})
