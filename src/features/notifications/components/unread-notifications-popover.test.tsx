import type { ConversationWithRelations } from '@/entities/conversation'
import { inboxQueryKeys } from '@/features/inbox/api/query-keys'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { QueryClient } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnreadNotificationsPopover } from './unread-notifications-popover'

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

function renderPopover({
  conversations,
  counts,
}: {
  conversations: Array<ConversationWithRelations>
  counts: Record<string, number>
}) {
  const queryClient = createSeededClient()
  queryClient.setQueryData(inboxQueryKeys.conversations('w1'), conversations)
  queryClient.setQueryData(inboxQueryKeys.unreadCounts('w1', 'u1'), counts)
  return renderWithQueryClient(<UnreadNotificationsPopover workspaceId="w1" />, {
    queryClient,
  })
}

describe('UnreadNotificationsPopover', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('hides the badge and shows the empty state when nothing is unread', () => {
    renderPopover({
      conversations: [conversationFixture('c1')],
      counts: { c1: 0 },
    })
    const trigger = screen.getByLabelText('Notifications')
    expect(screen.queryByText('0')).toBeNull()

    fireEvent.click(trigger)
    expect(screen.getByText("You're all caught up")).toBeTruthy()
    expect(screen.queryByText('Alice Johnson')).toBeNull()
  })

  it('caps the visible badge at 99+ while announcing the real count', () => {
    renderPopover({
      conversations: [
        conversationFixture('c1'),
        conversationFixture('c2', 'Bob'),
      ],
      counts: { c1: 70, c2: 50 },
    })
    expect(screen.getByText('99+')).toBeTruthy()
    expect(screen.getByLabelText('Notifications, 120 unread')).toBeTruthy()
  })

  it('closes and navigates to the conversation without marking it read', async () => {
    renderPopover({
      conversations: [conversationFixture('c1')],
      counts: { c1: 2 },
    })
    fireEvent.click(screen.getByLabelText('Notifications, 2 unread'))
    fireEvent.click(
      screen.getByRole('button', {
        name: /Open conversation with Alice Johnson/,
      }),
    )

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/workspaces/$id/inbox/$conversationId',
      params: { id: 'w1', conversationId: 'c1' },
    })
    await waitFor(() => {
      expect(screen.queryByText('Unread messages')).toBeNull()
    })
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })

  it('navigates to the workspace inbox from the view-all footer action', async () => {
    renderPopover({
      conversations: [conversationFixture('c1')],
      counts: { c1: 2 },
    })
    fireEvent.click(screen.getByLabelText('Notifications, 2 unread'))
    fireEvent.click(screen.getByRole('button', { name: 'View all messages' }))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/workspaces/$id/inbox',
      params: { id: 'w1' },
    })
    await waitFor(() => {
      expect(screen.queryByText('Unread messages')).toBeNull()
    })
  })

  it('updates the badge when the unread cache changes', async () => {
    const { queryClient } = renderPopover({
      conversations: [conversationFixture('c1')],
      counts: { c1: 2 },
    })
    expect(screen.getByText('2')).toBeTruthy()

    act(() => {
      queryClient.setQueryData(inboxQueryKeys.unreadCounts('w1', 'u1'), {
        c1: 5,
      })
    })
    // Query observers notify in a batched tick, not synchronously.
    expect(await screen.findByText('5')).toBeTruthy()
    expect(screen.getByLabelText('Notifications, 5 unread')).toBeTruthy()
  })

  it('opens a single realtime channel scoped to the workspace', () => {
    renderPopover({ conversations: [], counts: {} })
    expect(supabaseMock.channel).toHaveBeenCalledTimes(1)
    expect(supabaseMock.channel).toHaveBeenCalledWith('inbox:conversations:w1')
  })

  it('stays functional without a workspace: empty state, no footer, no subscription', () => {
    renderWithQueryClient(<UnreadNotificationsPopover workspaceId={undefined} />, {
      queryClient: createSeededClient(),
    })
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(screen.getByText("You're all caught up")).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'View all messages' }),
    ).toBeNull()
    expect(supabaseMock.channel).not.toHaveBeenCalled()
  })

  it('shows the error state with a retry action when loading fails', async () => {
    // No seeded cache: the queries run against the inert Supabase mock and reject.
    renderWithQueryClient(<UnreadNotificationsPopover workspaceId="w1" />, {
      queryClient: createSeededClient(),
    })
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Could not load notifications')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})
