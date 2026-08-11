import { accountQueryKeys } from '@/features/account'
import type { UserProfile } from '@/features/account'
import type * as UseWorkspaces from '@/features/workspaces/hooks/use-workspaces'
import type { Workspace } from '@/entities/workspace'
import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import { createTestQueryClient, renderWithQueryClient } from '@/test/render'
import type { User } from '@supabase/supabase-js'
import { screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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

// The switcher's invitation section and indicator dot read this query;
// InvitationResponseDialog (a sibling of the menu, always mounted) reads the
// mutation. Neither is under test here, so both default to an empty/idle
// state and individual tests override only what they need.
const myInvitationsMock = vi.hoisted(() => vi.fn())
const respondToInvitationMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/workspaces/hooks/use-workspace-membership', () => ({
  useMyInvitations: () => myInvitationsMock(),
  useRespondToInvitation: () => respondToInvitationMock(),
}))

const workspace: Workspace = {
  created_at: '2026-07-26T00:00:00.000Z',
  created_by: 'user-1',
  default_phone_region: null,
  deleted_at: null,
  description: null,
  icon: 'briefcase',
  id: 'workspace-1',
  is_main: true,
  name: 'Acme Sales',
  updated_at: '2026-07-26T00:00:00.000Z',
  updated_by: null,
}

function renderSidebar(
  profile?: UserProfile,
  { isCollapsed = false }: { isCollapsed?: boolean } = {},
) {
  const queryClient = createTestQueryClient()

  // Seeded rather than fetched: the account row reads the profile through the
  // shared cache, which is the coupling worth exercising here.
  if (profile) {
    queryClient.setQueryData(accountQueryKeys.profile('user-1'), profile)
  }

  return renderWithQueryClient(
    <Sidebar isCollapsed={isCollapsed} onCollapsedChange={() => {}} />,
    { queryClient },
  )
}

function profileFixture(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    fullName: 'Augusta King',
    email: 'ada@example.com',
    avatarUrl: null,
    jobTitle: null,
    phone: null,
    timezone: null,
    language: 'auto',
    ...overrides,
  }
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
    myInvitationsMock.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    })
    respondToInvitationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
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
    // Asserted against the catalogue, not a copy of the sentence: what matters
    // here is that the disabled item is described by the locked tooltip at all.
    // Pinning the wording made an ordinary copy edit look like a broken sidebar.
    expect(description?.textContent).toBe(m.sidebar_inbox_locked_tooltip())
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

/**
 * The account row is the one place the user sees themselves on every screen,
 * which is why it must not read auth metadata: that is frozen at sign-up, so
 * the rail went on addressing people by a name they had already changed and
 * showed initials over a picture they had already uploaded.
 */
describe('Sidebar account row', () => {
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
    myInvitationsMock.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    })
    respondToInvitationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    })
  })

  it('shows the saved profile name rather than the sign-up name', async () => {
    renderSidebar(profileFixture())

    await waitFor(() => {
      expect(screen.getByText('Augusta King')).toBeTruthy()
    })
    expect(screen.queryByText('Ada Lovelace')).toBeNull()
  })

  it('falls back to auth metadata before the profile row arrives', async () => {
    renderSidebar()

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeTruthy()
    })
  })

  it('renders the uploaded picture instead of initials', async () => {
    renderSidebar(
      profileFixture({ avatarUrl: 'https://cdn.example.com/me.png' }),
    )

    await waitFor(() => {
      const image = document.querySelector(
        'img[src="https://cdn.example.com/me.png"]',
      )
      expect(image).not.toBeNull()
    })
  })
})

/**
 * Astryx `Button` computes its own `aria-label` from the trigger's `label`
 * prop whenever it is icon-only (collapsed) or given custom `children`
 * (expanded), and that computed `aria-label` overrides whatever the badge
 * span nested inside contributes — a bare `aria-label` on a role-less `span`
 * has no effect on the accessible name either way. So these assert the
 * trigger's own accessible name via `getByRole`, the thing a screen reader
 * actually exposes, rather than probing the badge's DOM attributes: a version
 * of this that only checked the badge markup stayed green through the exact
 * regression the review caught.
 */
describe('Sidebar workspace switcher invitations indicator', () => {
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
    myInvitationsMock.mockReturnValue({
      data: [
        {
          id: 'inv-1',
          workspaceId: 'ws-2',
          workspaceName: 'Beta Inc',
          workspaceIcon: null,
          role: 'member',
          invitedByName: 'Alex',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'inv-2',
          workspaceId: 'ws-3',
          workspaceName: 'Gamma LLC',
          workspaceIcon: null,
          role: 'admin',
          invitedByName: 'Sam',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      isPending: false,
      isError: false,
    })
    respondToInvitationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    })
  })

  it('names the pending invitation count on the expanded trigger', async () => {
    renderSidebar()

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Acme Sales.*2 invitations/ }),
      ).toBeTruthy()
    })
  })

  it('names the pending invitation count on the collapsed trigger', async () => {
    renderSidebar(undefined, { isCollapsed: true })

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Acme Sales.*2 invitations/ }),
      ).toBeTruthy()
    })
  })

  // Russian takes three plural forms (one/few/many), and the whole sentence —
  // separator included — is composed inside the catalogue now rather than
  // joined with a literal in TypeScript. Pins the rendered accessible name
  // itself, not just the message function in isolation, so a regression in
  // how the trigger's `label` is built would fail here even if the catalogue
  // entry were still correct.
  describe('in Russian', () => {
    beforeAll(() => {
      setLocale('ru', { reload: false })
    })

    afterAll(() => {
      setLocale('en', { reload: false })
    })

    it.each([
      { count: 1, expected: 'Acme Sales: 1 приглашение' },
      { count: 2, expected: 'Acme Sales: 2 приглашения' },
      { count: 5, expected: 'Acme Sales: 5 приглашений' },
    ])('names $count as "$expected"', async ({ count, expected }) => {
      myInvitationsMock.mockReturnValue({
        data: Array.from({ length: count }, (_, index) => ({
          id: `inv-${index}`,
          workspaceId: `ws-${index}`,
          workspaceName: `Invite ${index}`,
          workspaceIcon: null,
          role: 'member',
          invitedByName: 'Alex',
          createdAt: '2026-01-01T00:00:00.000Z',
        })),
        isPending: false,
        isError: false,
      })

      renderSidebar()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: expected })).toBeTruthy()
      })
    })
  })
})
