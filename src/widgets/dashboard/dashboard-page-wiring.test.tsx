import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import { createTestQueryClient } from '@/test/render'
import { mockQueryBuilder, postgrestError } from '@/test/supabase-query-mock'
import { DashboardPage } from '@/widgets/dashboard/dashboard-page'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The sibling suite mocks all four data hooks, so it pins layout but cannot see
 * the page's actual wiring. These tests drive the real hooks against a mocked
 * Supabase, which is where the cross-section behaviour lives: the summary
 * suppressing the attention section, one section failing while the rest render,
 * and the reason ranking that decides what a user sees first.
 */

const supabaseMock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/utils/supabase', () => ({ supabase: supabaseMock }))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    createFileRoute: () => (options: Record<string, unknown>) => options,
    useNavigate: () => vi.fn(),
    Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
  }
})

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'kim@example.com', user_metadata: {} } }),
}))
vi.mock('@/features/workspaces/components/create-workspace-modal', () => ({
  CreateWorkspaceModal: () => null,
}))

const WORKSPACE = {
  id: 'w1',
  name: 'Acme Sales',
  description: null,
  icon: null,
  is_main: true,
  created_at: '',
  created_by: 'u1',
  updated_at: '',
  updated_by: null,
  deleted_at: null,
}

const hoursAgo = (n: number) =>
  new Date(Date.now() - n * 60 * 60 * 1000).toISOString()

type Conversation = Record<string, unknown>

/**
 * Routes each table to a builder. `conversations` is read by three different
 * queries with different filters, so it takes a resolver rather than one fixed
 * set of rows.
 */
function mockSupabase({
  conversations,
  unread = [],
  failConversations = false,
}: {
  conversations: Array<Conversation>
  unread?: Array<{ conversation_id: string; unread_count: number }>
  failConversations?: boolean
}) {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'workspaces') return mockQueryBuilder([WORKSPACE])
    if (table === 'conversations') {
      if (failConversations) {
        return mockQueryBuilder(null, postgrestError('boom'))
      }
      // The same table backs three queries. The unassigned list asks for
      // assigned_to IS NULL, and these fixtures are all assigned, so it must
      // come back empty rather than duplicating the attention rows.
      return mockQueryBuilder((calls) =>
        calls.some(([name]) => name === 'is') ? [] : conversations,
      )
    }
    return mockQueryBuilder([])
  })
  supabaseMock.rpc.mockResolvedValue({ data: unread, error: null })
}

function conversation(overrides: Conversation = {}): Conversation {
  return {
    id: 'c1',
    workspace_id: 'w1',
    contact_id: 'p1',
    assigned_to: 'u1',
    status: 'open',
    last_message_at: hoursAgo(1),
    last_message_preview: 'Latest message',
    snoozed_until: null,
    channel: { id: 'ch1', type: 'whatsapp', name: 'Sales WhatsApp' },
    contact: { id: 'p1', name: 'Jane Doe', avatar_url: null },
    ...overrides,
  }
}

function renderHome() {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  )
}

describe('home page wiring', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    supabaseMock.from.mockReset()
    supabaseMock.rpc.mockReset()
  })

  it('says the all-clear once, not twice, when there is nothing to do', async () => {
    // The summary and the attention list read the same data, so at zero both
    // would otherwise render an all-clear within 100px of each other.
    mockSupabase({ conversations: [] })
    renderHome()

    await waitFor(() => {
      expect(screen.getByText(m.home_summary_all_clear())).toBeTruthy()
    })
    expect(screen.queryByText(m.home_attention_title())).toBeNull()
    expect(screen.queryByText(m.home_attention_empty_title())).toBeNull()
  })

  it('shows the attention section when there is real work in it', async () => {
    mockSupabase({
      conversations: [conversation({ id: 'c1' })],
      unread: [{ conversation_id: 'c1', unread_count: 3 }],
    })
    renderHome()

    // The section heading renders during loading too, so wait for the row
    // itself rather than the heading.
    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeTruthy()
    })
    expect(screen.getByText(m.home_attention_title())).toBeTruthy()
    expect(screen.getByText(m.home_attention_reason_unread())).toBeTruthy()
  })

  it('ranks an overdue snooze above an unread thread', async () => {
    // Reason order is the page's core editorial judgement: what the agent is
    // late for outranks what merely arrived.
    mockSupabase({
      conversations: [
        conversation({
          id: 'unread-one',
          contact: { id: 'p1', name: 'Unread Person', avatar_url: null },
        }),
        conversation({
          id: 'snoozed-one',
          status: 'snoozed',
          snoozed_until: hoursAgo(2),
          contact: { id: 'p2', name: 'Snoozed Person', avatar_url: null },
        }),
      ],
      unread: [{ conversation_id: 'unread-one', unread_count: 1 }],
    })
    renderHome()

    await waitFor(() => {
      expect(screen.getByText('Snoozed Person')).toBeTruthy()
    })

    // Read the names in DOM order from the attention list itself, so the
    // assertion is about ranking rather than about how many places a name
    // happens to appear.
    const section = screen
      .getByText(m.home_attention_title())
      .closest('section')
    const names = Array.from(
      section?.querySelectorAll('p > span:first-child') ?? [],
    )
      .map((node) => node.textContent)
      .filter((text) => text === 'Snoozed Person' || text === 'Unread Person')
    expect(names).toEqual(['Snoozed Person', 'Unread Person'])
  })

  it('refreshes while open when a message arrives', async () => {
    // NotificationsProvider wraps the authenticated shell, so its realtime
    // handler invalidates ['dashboard'] while home is mounted. Home's queries
    // are active then, so invalidation refetches immediately rather than
    // waiting for a remount — this is what keeps the attention list live under
    // the agent's eyes.
    let rows: Array<Conversation> = []
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'workspaces') return mockQueryBuilder([WORKSPACE])
      if (table === 'conversations') {
        return mockQueryBuilder((calls) =>
          calls.some(([name]) => name === 'is') ? [] : rows,
        )
      }
      return mockQueryBuilder([])
    })
    supabaseMock.rpc.mockImplementation(() =>
      Promise.resolve({
        data: rows.map((r) => ({
          conversation_id: r.id as string,
          unread_count: 1,
        })),
        error: null,
      }),
    )

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText(m.home_summary_all_clear())).toBeTruthy()
    })

    // A message lands for a conversation assigned to this agent.
    rows = [conversation({ id: 'c-new' })]
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeTruthy()
    })
    expect(screen.queryByText(m.home_summary_all_clear())).toBeNull()
  })

  it('keeps the page usable when the conversation reads fail', async () => {
    // Each section owns its own failure; one failing query must not blank the
    // greeting or the workspace list, which come from a different query.
    mockSupabase({ conversations: [], failConversations: true })
    renderHome()

    await waitFor(() => {
      expect(screen.getByText(m.home_summary_error())).toBeTruthy()
    })
    // The workspace section still renders from its own healthy query.
    expect(screen.getByText(m.home_workspace_section_title())).toBeTruthy()
    // And the failure is not misreported as an all-clear.
    expect(screen.queryByText(m.home_summary_all_clear())).toBeNull()
  })
})
