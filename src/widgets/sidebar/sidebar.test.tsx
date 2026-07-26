import type * as UseWorkspaces from '@/features/workspaces/hooks/use-workspaces'
import type { Workspace } from '@/entities/workspace'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import type { User } from '@supabase/supabase-js'
import { screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from './sidebar'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'workspace-1' }),
    useRouterState: () => '/workspaces/workspace-1',
  }
})

const authMock = vi.hoisted(() => ({
  user: null as User | null,
  signOut: vi.fn(),
}))

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => authMock }))

vi.mock('@/features/notifications', () => ({
  UnreadNotificationsNavItem: () => null,
}))

const workspacesMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/workspaces/hooks/use-workspaces', async () => {
  const actual = await vi.importActual<typeof UseWorkspaces>(
    '@/features/workspaces/hooks/use-workspaces',
  )
  return { ...actual, useWorkspaces: () => workspacesMock() }
})

vi.mock('@/features/workspaces/components/create-workspace-modal', () => ({
  CreateWorkspaceModal: () => null,
}))

const readinessMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/channels/hooks/use-channels', () => ({
  useWorkspaceReadiness: () => readinessMock(),
}))

const workspace: Workspace = {
  created_at: '2026-07-26T00:00:00.000Z',
  created_by: 'user-1',
  deleted_at: null,
  description: null,
  icon: 'briefcase',
  id: 'workspace-1',
  is_main: true,
  name: 'Acme Sales',
  updated_at: '2026-07-26T00:00:00.000Z',
  updated_by: null,
}

function renderSidebar() {
  return renderWithQueryClient(
    <Sidebar isCollapsed={false} onCollapsedChange={() => {}} />,
  )
}

/** Present only while the inbox is reachable; the disabled item is a button. */
function inboxLink() {
  return screen.queryByRole('link', { name: /Inbox/ })
}

describe('Sidebar inbox item', () => {
  // The project's base locale is ru; these assertions read the English copy.
  beforeAll(() => {
    setLocale('en')
  })

  beforeEach(() => {
    authMock.user = {
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2026-07-26T00:00:00.000Z',
      id: 'user-1',
      user_metadata: { full_name: 'Ada Lovelace' },
    }
    workspacesMock.mockReturnValue({
      data: [workspace],
      isPending: false,
      isError: false,
    })
    readinessMock.mockReturnValue({
      hasActiveChannel: true,
      isError: false,
      isPending: false,
      isRetrying: false,
      refetch: vi.fn(),
    })
  })

  it('is available once the workspace has an active channel', async () => {
    renderSidebar()

    await waitFor(() => {
      expect(inboxLink()).not.toBeNull()
    })
  })

  it('is disabled when the workspace has no active channel', async () => {
    readinessMock.mockReturnValue({
      hasActiveChannel: false,
      isError: false,
      isPending: false,
      isRetrying: false,
      refetch: vi.fn(),
    })

    renderSidebar()

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: /Inbox/ })
          .getAttribute('aria-disabled'),
      ).toBe('true')
    })
    expect(inboxLink()).toBeNull()
  })

  // Walks the aria-describedby wiring out from the item rather than searching the
  // page for the copy: Astryx renders the tooltip element whether or not it is
  // enabled, so a plain text query would pass even with the tooltip attached to
  // the wrong item, or to nothing. Hover visibility itself is popover behaviour
  // jsdom does not implement, so it is not covered here.
  it('describes the disabled item with the reason it is unavailable', async () => {
    readinessMock.mockReturnValue({
      hasActiveChannel: false,
      isError: false,
      isPending: false,
      isRetrying: false,
      refetch: vi.fn(),
    })

    renderSidebar()

    const item = await screen.findByRole('button', { name: /Inbox/ })
    const trigger = item.closest('[aria-describedby]')
    expect(trigger).not.toBeNull()

    const description = document.getElementById(
      trigger?.getAttribute('aria-describedby') ?? '',
    )
    expect(description?.textContent).toBe('Connect a channel to open the inbox.')
  })

  // Disabling on an unresolved query would flicker the item on every workspace
  // switch. The route guard is the enforcement; this is only the explanation.
  it('stays available while readiness is still unknown', async () => {
    readinessMock.mockReturnValue({
      hasActiveChannel: false,
      isError: false,
      isPending: true,
      isRetrying: false,
      refetch: vi.fn(),
    })

    renderSidebar()

    await waitFor(() => {
      expect(inboxLink()).not.toBeNull()
    })
  })

  it('stays available when the readiness check fails', async () => {
    readinessMock.mockReturnValue({
      hasActiveChannel: false,
      isError: true,
      isPending: false,
      isRetrying: false,
      refetch: vi.fn(),
    })

    renderSidebar()

    await waitFor(() => {
      expect(inboxLink()).not.toBeNull()
    })
  })
})
