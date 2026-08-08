import { describe, expect, it } from 'vitest'
import { resolveOutboundRoute } from './outbound-route.ts'

// The send functions run as service_role, so RLS is not in the picture: every
// filter that keeps a send inside its workspace has to be written here. Before
// this helper existed each of them loaded the conversation by id and the
// channel by conversations.channel_id, with no workspace comparison anywhere --
// so a conversation repointed at another workspace's channel would send on that
// workspace's credentials.

const WORKSPACE_A = 'workspace-a'
const WORKSPACE_B = 'workspace-b'

type Row = Record<string, unknown>

/**
 * The slice of PostgREST this helper uses: `select(...).eq(...).maybeSingle()`,
 * with every eq() applied as an equality filter. Filters are what is under
 * test, so the fake applies them literally rather than special-casing id.
 */
function createFakeSupabase(tables: Record<string, Array<Row>>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? []
      const filters: Array<[string, unknown]> = []
      const builder = {
        select() {
          return builder
        },
        eq(column: string, value: unknown) {
          filters.push([column, value])
          return builder
        },
        maybeSingle() {
          const match = rows.find((row) =>
            filters.every(([column, value]) => row[column] === value),
          )
          return Promise.resolve({ data: match ?? null, error: null })
        },
      }
      return builder
    },
  }
}

function fixture({
  conversationChannelId = 'channel-a',
  conversationWorkspaceId = WORKSPACE_A,
}: {
  conversationChannelId?: string
  conversationWorkspaceId?: string
} = {}) {
  return createFakeSupabase({
    conversations: [
      {
        id: 'conversation-1',
        workspace_id: conversationWorkspaceId,
        contact_id: 'contact-a',
        channel_id: conversationChannelId,
      },
    ],
    channels: [
      {
        id: 'channel-a',
        workspace_id: WORKSPACE_A,
        type: 'whatsapp',
        is_active: true,
      },
      {
        id: 'channel-b',
        workspace_id: WORKSPACE_B,
        type: 'whatsapp',
        is_active: true,
      },
    ],
  })
}

describe('resolveOutboundRoute', () => {
  it('resolves the contact and channel of a conversation in the message workspace', async () => {
    const result = await resolveOutboundRoute(
      // deno-lint-ignore no-explicit-any -- fake client, see createFakeSupabase
      fixture() as any,
      { workspaceId: WORKSPACE_A, conversationId: 'conversation-1' },
    )

    expect(result).toEqual({
      ok: true,
      route: {
        contactId: 'contact-a',
        channelId: 'channel-a',
        channelType: 'whatsapp',
        channelIsActive: true,
      },
    })
  })

  it('refuses a channel in another workspace, even when the conversation points at it', async () => {
    const result = await resolveOutboundRoute(
      // deno-lint-ignore no-explicit-any -- fake client, see createFakeSupabase
      fixture({ conversationChannelId: 'channel-b' }) as any,
      { workspaceId: WORKSPACE_A, conversationId: 'conversation-1' },
    )

    expect(result).toEqual({ ok: false, reason: 'channel_not_found' })
  })

  it('refuses a conversation outside the message workspace', async () => {
    const result = await resolveOutboundRoute(
      // deno-lint-ignore no-explicit-any -- fake client, see createFakeSupabase
      fixture({ conversationWorkspaceId: WORKSPACE_B }) as any,
      { workspaceId: WORKSPACE_A, conversationId: 'conversation-1' },
    )

    expect(result).toEqual({ ok: false, reason: 'conversation_not_found' })
  })
})
