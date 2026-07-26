import type { ConversationWithRelations } from '@/entities/conversation'
import type { Workspace } from '@/entities/workspace'
import { inboxQueryKeys } from '@/features/inbox/api/query-keys'
import { workspaceQueryKeys } from '@/features/workspaces/api/workspaces'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { QueryClient } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnreadNotificationsNavItem } from './unread-notifications-nav-item'

const navigateMock = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return { ...actual, useNavigate: () => navigateMock }
})

const supabaseMock = vi.hoisted(() => {
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  }
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
  return {
    ...actual,
    PlatformIcon: () => <span data-testid="platform-icon" />,
  }
})

function workspaceFixture(id: string, name: string): Workspace {
  return {
    id,
    name,
    created_at: '2026-01-01T00:00:00Z',
    created_by: 'u1',
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
    channel: { id: 'ch1', type: 'telegram', name: 'Support' },
    contact: {
      id: 'ct1',
      name: contactName,
      phone: null,
      avatar_url: null,
      status: 'new',
    },
    assigned_profile: null,
    ...overrides,
  }
}

// Seeded caches stay fresh forever so the popover reads them instead of
// hitting the mocked (inert) Supabase client.
function createSeededClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  })
}

type Seed = {
  conversations: Array<ConversationWithRelations>
  counts: Record<string, number>
  workspaces?: Array<Workspace>
  /** The route's active workspace; undefined mimics the home page. */
  activeWorkspaceId?: string
}

function renderNavItem(seed: Seed) {
  const {
    conversations,
    counts,
    workspaces = [workspaceFixture('w1', 'Acme Support')],
  } = seed
  // `in` rather than a default parameter: an explicit `undefined` means "home
  // page", and a default would silently substitute a workspace instead.
  const activeWorkspaceId = 'activeWorkspaceId' in seed
    ? seed.activeWorkspaceId
    : 'w1'
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
  return renderWithQueryClient(
    <UnreadNotificationsNavItem workspaceId={activeWorkspaceId} />,
    { queryClient },
  )
}

describe('UnreadNotificationsNavItem', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('hides the badge and shows the empty state when nothing is unread', async () => {
    renderNavItem({
      conversations: [conversationFixture('c1')],
      counts: { c1: 0 },
    })
    const trigger = screen.getByRole('button', { name: 'Notifications' })
    expect(screen.queryByText('0')).toBeNull()

    fireEvent.click(trigger)
    expect(await screen.findByText("You're all caught up")).toBeTruthy()
    expect(screen.queryByText('Alice Johnson')).toBeNull()
  })

  it('caps the visible badge at 99+ while announcing the real count', async () => {
    renderNavItem({
      conversations: [
        conversationFixture('c1'),
        conversationFixture('c2', 'Bob'),
      ],
      counts: { c1: 70, c2: 50 },
    })
    expect(await screen.findByText('99+')).toBeTruthy()
    expect(screen.getByLabelText('120 unread')).toBeTruthy()
  })

  // The bug this feature shipped with: the header is global, but the data was
  // scoped to the route's workspace, so the bell was empty on the home page.
  it('shows notifications on routes without an active workspace', async () => {
    renderNavItem({
      conversations: [conversationFixture('c1')],
      counts: { c1: 3 },
      activeWorkspaceId: undefined,
    })
    expect(await screen.findByRole('button', { name: /Notifications/ })).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }))
    expect(await screen.findByText('Alice Johnson')).toBeTruthy()
    // No single inbox would show "all" of a cross-workspace list, so the
    // footer is withheld rather than silently picking one workspace.
    expect(
      screen.queryByRole('button', { name: 'View all messages' }),
    ).toBeNull()
  })

  it('offers view-all only on a workspace route', async () => {
    renderNavItem({
      conversations: [conversationFixture('c1')],
      counts: { c1: 3 },
      activeWorkspaceId: 'w1',
    })
    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'View all messages' }),
    )
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/workspaces/$id/inbox',
      params: { id: 'w1' },
    })
  })

  it('aggregates unread across every workspace and labels each row', async () => {
    renderNavItem({
      conversations: [
        conversationFixture('c1'),
        conversationFixture('c2', 'Bob', { workspace_id: 'w2' }),
      ],
      counts: { c1: 2, c2: 3 },
      workspaces: [
        workspaceFixture('w1', 'Acme Support'),
        workspaceFixture('w2', 'Globex'),
      ],
      activeWorkspaceId: undefined,
    })
    expect(await screen.findByRole('button', { name: /Notifications/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }))
    expect(await screen.findByText('Acme Support')).toBeTruthy()
    expect(screen.getByText('Globex')).toBeTruthy()
  })

  it('opens a conversation in its own workspace without marking it read', async () => {
    renderNavItem({
      conversations: [
        conversationFixture('c2', 'Bob', { workspace_id: 'w2' }),
      ],
      counts: { c2: 2 },
      workspaces: [
        workspaceFixture('w1', 'Acme Support'),
        workspaceFixture('w2', 'Globex'),
      ],
      activeWorkspaceId: 'w1',
    })
    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    fireEvent.click(
      await screen.findByRole('button', { name: /Open conversation with Bob/ }),
    )

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/workspaces/$id/inbox/$conversationId',
      params: { id: 'w2', conversationId: 'c2' },
    })
    await waitFor(() => {
      expect(screen.queryByText('Unread messages')).toBeNull()
    })
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })

  it('updates the badge when the unread cache changes', async () => {
    const { queryClient } = renderNavItem({
      conversations: [conversationFixture('c1')],
      counts: { c1: 2 },
    })
    expect(await screen.findByText('2')).toBeTruthy()

    act(() => {
      queryClient.setQueryData(inboxQueryKeys.unreadCounts('w1', 'u1'), {
        c1: 5,
      })
    })
    // Query observers notify in a batched tick, not synchronously.
    expect(await screen.findByText('5')).toBeTruthy()
    expect(screen.getByLabelText('5 unread')).toBeTruthy()
  })

  it('opens a single realtime channel scoped to the active workspace', () => {
    renderNavItem({ conversations: [], counts: {} })
    expect(supabaseMock.channel).toHaveBeenCalledTimes(1)
    expect(supabaseMock.channel).toHaveBeenCalledWith('inbox:conversations:w1')
  })

  it('shows the error state with a retry action when loading fails', async () => {
    // No seeded cache: the queries run against the inert Supabase mock and reject.
    renderWithQueryClient(<UnreadNotificationsNavItem workspaceId="w1" />, {
      queryClient: createSeededClient(),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(await screen.findByText('Could not load notifications')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})
