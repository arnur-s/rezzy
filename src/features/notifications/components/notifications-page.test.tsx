import type { ConversationWithRelations } from '@/entities/conversation'
import type { Workspace } from '@/entities/workspace'
import { inboxQueryKeys } from '@/features/inbox/api/query-keys'
import { workspaceQueryKeys } from '@/features/workspaces/api/workspaces'
import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { QueryClient } from '@tanstack/react-query'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationsPage } from './notifications-page'

const navigateMock = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return { ...actual, useNavigate: () => navigateMock }
})

const supabaseMock = vi.hoisted(() => {
  const channel = { on: vi.fn(), subscribe: vi.fn() }
  channel.on.mockReturnValue(channel)
  channel.subscribe.mockReturnValue(channel)
  return {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
    rpc: vi.fn(),
    from: vi.fn(),
  }
})
vi.mock('@/utils/supabase', () => ({ supabase: supabaseMock }))

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}))

vi.mock('@/entities/channel', async () => {
  const actual = await vi.importActual('@/entities/channel')
  return { ...actual, PlatformIcon: () => <span data-testid="platform-icon" /> }
})

function workspaceFixture(id: string, name: string): Workspace {
  return {
    id,
    name,
    created_at: '2026-01-01T00:00:00Z',
    created_by: 'u1',
    default_phone_region: null,
    deleted_at: null,
    description: null,
    icon: null,
    is_main: true,
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: null,
  }
}

function conversationFixture(
  id: string,
  contactName: string | null = 'Alice Johnson',
  overrides: Partial<ConversationWithRelations> = {},
): ConversationWithRelations {
  return {
    id,
    workspace_id: 'w1',
    channel_id: 'ch1',
    contact_id: 'ct1',
    assigned_to: null,
    status: 'open',
    unread_count: 0,
    last_message_at: '2026-05-15T10:00:00Z',
    last_message_preview: 'See you tomorrow',
    snoozed_until: null,
    external_thread_id: null,
    last_inbound_at: null,
    created_at: '2026-05-01T10:00:00Z',
    updated_at: '2026-05-15T10:00:00Z',
    deleted_at: null,
    channel: { id: 'ch1', type: 'telegram', name: 'Support' },
    contact: {
      id: 'ct1',
      name: contactName,
      phone: null,
      avatar_url: null,
      status: 'new',
    },
    ...overrides,
  }
}

// Seeded caches stay fresh forever so the page reads them instead of hitting
// the mocked (inert) Supabase client.
function createSeededClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
}

type Seed = {
  conversations: Array<ConversationWithRelations>
  counts: Record<string, number>
  workspaces?: Array<Workspace>
}

function renderPage(seed: Seed) {
  const {
    conversations,
    counts,
    workspaces = [workspaceFixture('w1', 'Acme Support')],
  } = seed
  const queryClient = createSeededClient()
  queryClient.setQueryData(workspaceQueryKeys.list('u1'), workspaces)
  for (const workspace of workspaces) {
    queryClient.setQueryData(
      inboxQueryKeys.conversations(workspace.id),
      conversations.filter((row) => row.workspace_id === workspace.id),
    )
    queryClient.setQueryData(
      inboxQueryKeys.unreadCounts(workspace.id, 'u1'),
      Object.fromEntries(
        Object.entries(counts).filter(([conversationId]) =>
          conversations.some(
            (row) =>
              row.id === conversationId && row.workspace_id === workspace.id,
          ),
        ),
      ),
    )
  }
  return renderWithQueryClient(<NotificationsPage />, { queryClient })
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('lists unread conversations from every workspace under one heading', async () => {
    renderPage({
      conversations: [
        conversationFixture('c1'),
        conversationFixture('c2', 'Bob', { workspace_id: 'w2' }),
      ],
      counts: { c1: 2, c2: 3 },
      workspaces: [
        workspaceFixture('w1', 'Acme Support'),
        workspaceFixture('w2', 'Globex'),
      ],
    })

    expect(
      await screen.findByRole('heading', { name: 'Notifications' }),
    ).toBeTruthy()
    expect(screen.getByText('Alice Johnson')).toBeTruthy()
    expect(screen.getByText('Bob')).toBeTruthy()
    // The page has no workspace of its own, so each row names where it lives.
    expect(screen.getByText('Acme Support')).toBeTruthy()
    expect(screen.getByText('Globex')).toBeTruthy()
    expect(
      screen.getByLabelText(m.notifications_unread_count_aria({ count: 5 })),
    ).toBeTruthy()
  })

  it('opens a conversation in its own workspace', async () => {
    renderPage({
      conversations: [conversationFixture('c2', 'Bob', { workspace_id: 'w2' })],
      counts: { c2: 2 },
      workspaces: [
        workspaceFixture('w1', 'Acme Support'),
        workspaceFixture('w2', 'Globex'),
      ],
    })

    fireEvent.click(
      await screen.findByRole('button', { name: /Open conversation with Bob/ }),
    )
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/workspaces/$id/inbox/$conversationId',
      params: { id: 'w2', conversationId: 'c2' },
    })
  })

  it('shows the caught-up state when nothing is unread', async () => {
    renderPage({
      conversations: [conversationFixture('c1')],
      counts: { c1: 0 },
    })

    expect(await screen.findByText(m.notifications_empty_title())).toBeTruthy()
    expect(screen.queryByText('Alice Johnson')).toBeNull()
  })

  it('shows the error state with a retry action when loading fails', async () => {
    // No seeded cache: the queries run against the inert Supabase mock and reject.
    renderWithQueryClient(<NotificationsPage />, {
      queryClient: createSeededClient(),
    })

    expect(await screen.findByText(m.notifications_error())).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})
