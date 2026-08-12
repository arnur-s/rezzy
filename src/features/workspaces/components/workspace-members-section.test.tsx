import type { WorkspaceMember } from '@/entities/workspace'
import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceMembersSection } from './workspace-members-section'

// This harness mocks the roster hooks directly (`useWorkspaceMemberDirectory`,
// `useIsWorkspaceAdmin`, `useWorkspace`) rather than going through the real
// hooks with a mocked `supabase.rpc` + `useAuth`: the roster query in the real
// hooks resolves asynchronously, and the assertions below read synchronously
// right after render (no `await`/`findBy`), so the mock has to already reflect
// the "loaded" state on the first render.
const useWorkspaceMemberDirectoryMock = vi.hoisted(() => vi.fn())
const useIsWorkspaceAdminMock = vi.hoisted(() => vi.fn())
const useWorkspaceMock = vi.hoisted(() => vi.fn())
vi.mock('../hooks/use-workspaces', () => ({
  useWorkspaceMemberDirectory: useWorkspaceMemberDirectoryMock,
  useIsWorkspaceAdmin: useIsWorkspaceAdminMock,
  useWorkspace: useWorkspaceMock,
}))

const useWorkspaceInvitationsMock = vi.hoisted(() => vi.fn())
const useInviteMemberMock = vi.hoisted(() => vi.fn())
const useRevokeInvitationMock = vi.hoisted(() => vi.fn())
const useUpdateMemberRoleMock = vi.hoisted(() => vi.fn())
const useRemoveMemberMock = vi.hoisted(() => vi.fn())
vi.mock('../hooks/use-workspace-membership', () => ({
  useWorkspaceInvitations: useWorkspaceInvitationsMock,
  useInviteMember: useInviteMemberMock,
  useRevokeInvitation: useRevokeInvitationMock,
  useUpdateMemberRole: useUpdateMemberRoleMock,
  useRemoveMember: useRemoveMemberMock,
}))

const useAuthMock = vi.hoisted(() => vi.fn())
vi.mock('@/providers/auth-provider', () => ({ useAuth: useAuthMock }))

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))

// The id the mocked `useAuth` treats as "the signed-in user" — matched by
// `OWNER_ONLY.userId` below, so the last-owner row under test is the viewer's
// own row.
const CURRENT_USER_ID = 'user-1'

const OWNER_ONLY: WorkspaceMember = {
  userId: CURRENT_USER_ID,
  role: 'owner',
  fullName: 'Alice Owner',
  avatarUrl: null,
  jobTitle: null,
  phone: null,
  joinedAt: '2026-01-01T00:00:00.000Z',
}

const PLAIN_MEMBER: WorkspaceMember = {
  userId: 'user-2',
  role: 'member',
  fullName: 'Bob Member',
  avatarUrl: null,
  jobTitle: null,
  phone: null,
  joinedAt: '2026-02-01T00:00:00.000Z',
}

function renderSection({
  role = 'owner',
  members,
  currentUserId = CURRENT_USER_ID,
}: {
  role?: string
  members?: Array<WorkspaceMember>
  currentUserId?: string
} = {}) {
  useIsWorkspaceAdminMock.mockReturnValue({
    isAdmin: role === 'owner' || role === 'admin',
    isLoaded: true,
  })
  useWorkspaceMemberDirectoryMock.mockReturnValue({
    data: members ?? [{ ...OWNER_ONLY, role }],
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  })
  useAuthMock.mockReturnValue({ user: { id: currentUserId } })

  return renderWithQueryClient(<WorkspaceMembersSection workspaceId="w1" />)
}

describe('WorkspaceMembersSection', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    useWorkspaceMock.mockReturnValue({ data: { id: 'w1', name: 'Acme' } })
    useWorkspaceInvitationsMock.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    })
    useInviteMemberMock.mockReturnValue({
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    })
    useRevokeInvitationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    })
    useUpdateMemberRoleMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    })
    useRemoveMemberMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  })

  // The invite moved out of the page and into a dialog, so what the roster
  // offers an admin is the button that opens it. `.toBeTruthy()` / `.toBeNull()`
  // rather than jest-dom's `toBeInTheDocument()`: this repo does not depend on
  // `@testing-library/jest-dom`, so that matcher does not exist here.
  it('offers the invite action to an admin', () => {
    renderSection()

    expect(
      screen.getByRole('button', {
        name: m.workspace_settings_members_invite_open(),
      }),
    ).toBeTruthy()
  })

  it('does not offer the invite action to a non-admin', () => {
    renderSection({ role: 'member' })

    expect(
      screen.queryByRole('button', {
        name: m.workspace_settings_members_invite_open(),
      }),
    ).toBeNull()
  })

  // The roster is grouped by role, which is what lets the row itself drop the
  // per-row role control that used to eat the name column at 320px. The role is
  // still on screen — as the heading over the group.
  it('groups the roster under a heading per role', () => {
    renderSection({ members: [OWNER_ONLY, PLAIN_MEMBER] })

    // Scoped to level 3: the page's own `h2` is "Members" too, which is the
    // role's plural noun as well as the section's name.
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: m.workspace_settings_members_group_owner(),
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: m.workspace_settings_members_group_member(),
      }),
    ).toBeTruthy()
  })

  // `DropdownMenuItemData` (the type `MoreMenu`'s `items` prop takes) has no
  // `disabledMessage`/tooltip slot — only `label`/`onClick`/`isDisabled` — so a
  // merely-greyed "Remove from workspace" item would explain nothing. The row
  // makes the item's own label become the reason once it can no longer be used,
  // which this pins directly: the actionable labels must be gone, and a
  // `menuitem` bearing the reason must be there and disabled instead.
  //
  // `getByRole('menuitem', ...)` doesn't work here — Astryx's popover content is
  // excluded from the accessible-roles tree while the menu is closed. `getByText`
  // still finds it (it does not filter on visibility), so this disambiguates by
  // walking up to the nearest `role="menuitem"` ancestor.
  it('offers the last owner no action at all, and says why', () => {
    renderSection({ role: 'owner', members: [OWNER_ONLY] })

    expect(screen.queryByText(m.workspace_settings_members_remove())).toBeNull()
    expect(screen.queryByText(m.workspace_settings_members_leave())).toBeNull()

    const hintNodes = screen.getAllByText(
      m.workspace_settings_members_remove_last_owner_hint(),
    )
    const menuItem = hintNodes
      .map((node) => node.closest('[role="menuitem"]'))
      .find((el): el is Element => el !== null)
    expect(menuItem).toBeTruthy()
    expect(menuItem?.getAttribute('aria-disabled')).toBe('true')
  })

  // A plain member has no management rights and used to get no menu at all,
  // which left them with no way out of a workspace — while the string for it sat
  // unused in both catalogues. Their own row now carries the exit, and only the
  // exit.
  it('lets a plain member leave, without offering them role controls', () => {
    renderSection({
      role: 'member',
      members: [{ ...PLAIN_MEMBER, userId: CURRENT_USER_ID }],
    })

    expect(screen.getByText(m.workspace_settings_members_leave())).toBeTruthy()
    expect(screen.queryByText(m.workspace_settings_members_remove())).toBeNull()
    expect(
      screen.queryByText(m.workspace_settings_members_role_menu_section()),
    ).toBeNull()
  })

  // Removing somebody else and leaving yourself are the same RPC, and the row
  // used to label both as "Remove from workspace" — an action read as taken on
  // another person, offered to a user about themselves.
  it('labels the destructive action as leaving on the viewer own row', () => {
    // The viewer is the admin, not the sole owner: an owner who is the last one
    // is offered no action at all, which the test above already pins.
    renderSection({
      role: 'admin',
      currentUserId: 'user-3',
      members: [
        OWNER_ONLY,
        PLAIN_MEMBER,
        { ...PLAIN_MEMBER, userId: 'user-3', role: 'admin' },
      ],
    })

    expect(screen.getByText(m.workspace_settings_members_leave())).toBeTruthy()
    expect(screen.getByText(m.workspace_settings_members_remove())).toBeTruthy()
  })
})
