import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './dashboard-page'

/**
 * The dashboard's layout is decided by the workspace count, so these tests pin
 * the three shapes (zero, one, many) plus the loading gate that must not flash
 * the wrong one.
 */

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    createFileRoute: () => (options: Record<string, unknown>) => options,
    useNavigate: () => navigateMock,
    Link: ({
      children,
      params,
      to,
      ...rest
    }: {
      children: React.ReactNode
      params?: Record<string, string>
      to?: string
      'aria-label'?: string
    }) => (
      <a
        href="#"
        data-to={to}
        data-params={JSON.stringify(params)}
        aria-label={rest['aria-label']}
      >
        {children}
      </a>
    ),
  }
})

const workspacesQuery = vi.hoisted(() => ({ current: {} }))
const dashboardStatsQuery = vi.hoisted(() => ({
  current: {},
}))

vi.mock('@/features/workspaces/hooks/use-workspaces', () => ({
  useWorkspaces: () => workspacesQuery.current,
}))
vi.mock('@/features/workspaces/components/create-workspace-modal', () => ({
  CreateWorkspaceModal: () => null,
}))
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'kim@example.com', user_metadata: {} },
  }),
}))

const resolvedHomeQuery = {
  data: {
    unreadAssigned: 0,
    openAssigned: 0,
    snoozedWaking: 0,
    staleAssigned: 0,
  },
  isPending: false,
  isError: false,
  isRefetching: false,
  refetch: vi.fn(),
}

const resolvedAttentionQuery = {
  data: { items: [], total: 0 },
  isPending: false,
  isError: false,
  isRefetching: false,
  refetch: vi.fn(),
}

const resolvedUnassignedQuery = {
  data: [],
  isPending: false,
  isError: false,
  isRefetching: false,
  refetch: vi.fn(),
}

vi.mock('@/features/dashboard/hooks/use-dashboard-stats', () => ({
  useDashboardStats: () => dashboardStatsQuery.current,
}))
vi.mock('@/features/dashboard/hooks/use-home-stats', () => ({
  useHomeStats: () => resolvedHomeQuery,
}))
vi.mock('@/features/dashboard/hooks/use-attention-queue', () => ({
  useAttentionQueue: () => resolvedAttentionQuery,
  useUnassignedQueue: () => resolvedUnassignedQuery,
}))

function workspace(id: string, name: string) {
  return {
    id,
    name,
    description: null,
    icon: null,
    is_main: true,
    created_at: '',
    created_by: 'u1',
    updated_at: '',
    updated_by: null,
    deleted_at: null,
  }
}

function renderRoute() {
  return renderWithQueryClient(<DashboardPage />)
}

describe('dashboard home route', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    navigateMock.mockClear()
    dashboardStatsQuery.current = {
      data: { perWorkspace: [] },
      isPending: false,
      isError: false,
      isRefetching: false,
      refetch: vi.fn(),
    }
  })

  it('shows only a loader while workspaces are pending — no premature layout', () => {
    workspacesQuery.current = { data: undefined, isPending: true, isError: false }
    renderRoute()
    expect(screen.queryByText(m.dashboard_empty_title())).toBeNull()
    expect(screen.queryByText(m.home_workspace_section_title())).toBeNull()
    expect(screen.queryByText(m.home_workspaces_section_title())).toBeNull()
  })

  it('surfaces a workspace query failure instead of an empty state', () => {
    workspacesQuery.current = {
      data: undefined,
      isPending: false,
      isError: true,
      isRefetching: false,
      refetch: vi.fn(),
    }
    renderRoute()
    expect(screen.getByText(m.dashboard_load_error_title())).toBeTruthy()
    expect(screen.queryByText(m.dashboard_empty_title())).toBeNull()
  })

  it('offers create-workspace as the primary action at zero workspaces', () => {
    workspacesQuery.current = { data: [], isPending: false, isError: false }
    renderRoute()
    expect(screen.getByText(m.dashboard_empty_title())).toBeTruthy()
    expect(
      screen.getByRole('button', { name: m.dashboard_empty_cta() }),
    ).toBeTruthy()
  })

  it('renders the compact summary and Open inbox for exactly one workspace', () => {
    workspacesQuery.current = {
      data: [workspace('w1', 'Acme Sales')],
      isPending: false,
      isError: false,
      // Previously loaded data remains authoritative during a background
      // refetch, so the page must not flash the zero or grid layouts.
      isRefetching: true,
    }
    renderRoute()
    expect(
      screen.getByRole('button', { name: m.home_open_inbox() }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: m.home_open_inbox() }))
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/workspaces/$id/inbox',
      params: { id: 'w1' },
    })
    expect(screen.getByText(m.home_workspace_section_title())).toBeTruthy()
    // The compact summary replaces the grid: no grid heading, and creating
    // another workspace is a quiet button, not the big dashed card.
    expect(screen.queryByText(m.home_workspaces_section_title())).toBeNull()
    const create = screen.getByRole('button', { name: m.dashboard_empty_cta() })
    expect(create).toBeTruthy()
    expect(document.querySelector('.border-dashed')).toBeNull()
    // The summary itself navigates to the workspace.
    const link = screen.getByRole('link', { name: 'Acme Sales' })
    expect(link.dataset.params).toBe(JSON.stringify({ id: 'w1' }))
    // The link must not contain the create button — no nested controls.
    expect(link.querySelector('button')).toBeNull()
    const manage = screen.getByRole('link', {
      name: m.home_workspace_manage(),
    })
    expect(manage.dataset.to).toBe('/workspaces/$id/settings')
    expect(manage.dataset.params).toBe(JSON.stringify({ id: 'w1' }))
    expect(link.contains(manage)).toBe(false)
  })

  it('keeps the workspace grid and create card for two workspaces', () => {
    workspacesQuery.current = {
      data: [workspace('w1', 'Acme Sales'), workspace('w2', 'EU Accounts')],
      isPending: false,
      isError: false,
    }
    renderRoute()
    expect(screen.getByText(m.home_workspaces_section_title())).toBeTruthy()
    expect(screen.queryByText(m.home_workspace_section_title())).toBeNull()
    // No single inbox exists, so no Open inbox button either.
    expect(
      screen.queryByRole('button', { name: m.home_open_inbox() }),
    ).toBeNull()
    // The dashed create card is back.
    const create = screen.getByRole('button', { name: m.dashboard_empty_cta() })
    expect(create.querySelector('.border-dashed')).toBeTruthy()
  })
})
