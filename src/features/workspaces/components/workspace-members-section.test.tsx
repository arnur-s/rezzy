import type { WorkspaceMember } from '@/entities/workspace'
import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceMembersSection } from './workspace-members-section'

// This harness mocks the two roster hooks directly (`useWorkspaceMemberDirectory`,
// `useIsWorkspaceAdmin`), the same level the retired stub's test mocked
// `useWorkspaceMembers` at, rather than going through the real hooks with a
// mocked `supabase.rpc` + `useAuth`: the roster query in the real hooks resolves
// asynchronously, and the assertions the brief specifies read synchronously
// right after render (no `await`/`findBy`), so the mock has to already reflect
// the "loaded" state on the first render.
const useWorkspaceMemberDirectoryMock = vi.hoisted(() => vi.fn())
const useIsWorkspaceAdminMock = vi.hoisted(() => vi.fn())
vi.mock('../hooks/use-workspaces', () => ({
  useWorkspaceMemberDirectory: useWorkspaceMemberDirectoryMock,
  useIsWorkspaceAdmin: useIsWorkspaceAdminMock,
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

// The id the mocked `useIsWorkspaceAdmin` treats as "the signed-in user" —
// matched by `OWNER_ONLY.userId` below, so the last-owner row under test is the
// viewer's own row.
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

function renderSection({
  role = 'owner',
  members,
}: {
  role?: string
  members?: Array<WorkspaceMember>
} = {}) {
  useIsWorkspaceAdminMock.mockReturnValue({
    isAdmin: role === 'owner' || role === 'admin',
    isLoaded: true,
  })
  useWorkspaceMemberDirectoryMock.mockReturnValue({
    data: members ?? [{ ...OWNER_ONLY, role }],
    isPending: false,
    isError: false,
  })

  return renderWithQueryClient(<WorkspaceMembersSection workspaceId="w1" />)
}

describe('WorkspaceMembersSection', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    useWorkspaceInvitationsMock.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    })
    useInviteMemberMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    })
    useRevokeInvitationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
    useUpdateMemberRoleMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
    useRemoveMemberMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  })

  it('shows the existing-account helper before anything is typed', () => {
    renderSection()

    // The standing constraint of the invite model, not a validation result:
    // it must be readable by an inviter who has typed nothing.
    //
    // `.toBeTruthy()` / `.toBeNull()` rather than jest-dom's
    // `toBeInTheDocument()`: this repo does not depend on `@testing-library/
    // jest-dom` (not in package.json, not wired into src/test/setup.ts), so
    // that matcher does not exist here. Matches the convention the retired
    // stub's test already used.
    expect(
      screen.getByText(m.workspace_settings_members_invite_help()),
    ).toBeTruthy()
  })

  it('does not render the invite form for a non-admin', () => {
    renderSection({ role: 'member' })

    expect(
      screen.queryByLabelText(m.workspace_settings_members_invite_email_label()),
    ).toBeNull()
  })

  // The role `Selector` and the remove `MoreMenu` both show the same hint for
  // the same last-owner row, so a plain `getByText` can no longer tell them
  // apart (see the "disables the remove action" test below for why). This one
  // is scoped to the `Selector`'s own wiring: `aria-describedby` is how a
  // disabled trigger's `disabledMessage` actually reaches an assistive-tech
  // user (confirmed against the installed Selector.js — see the report), not
  // just prose sitting somewhere nearby on the page.
  it('disables changing the role of the last owner and says why', () => {
    renderSection({ role: 'owner', members: [OWNER_ONLY] })

    // Named lookup: the invite form's own role `Selector` ("Role") is also a
    // combobox on this page, so an unqualified `getByRole('combobox')` matches
    // both.
    const roleControl = screen.getByRole('combobox', {
      name: m.workspace_settings_members_role_change_label({
        name: OWNER_ONLY.fullName,
      }),
    })
    expect(roleControl.getAttribute('aria-disabled')).toBe('true')

    const describedById = roleControl.getAttribute('aria-describedby')
    expect(describedById).toBeTruthy()
    const description = describedById
      ? document.getElementById(describedById)
      : null
    expect(description?.textContent).toBe(
      m.workspace_settings_members_remove_last_owner_hint(),
    )
  })

  // `DropdownMenuItemData` (the type `MoreMenu`'s `items` prop takes) has no
  // `disabledMessage`/tooltip slot — only `label`/`onClick`/`isDisabled` — so
  // a merely-greyed "Remove from workspace" item would explain nothing. The
  // fix makes the item's own label become the reason once it can no longer be
  // used, which this test pins directly: the actionable label must be gone,
  // and a `menuitem` bearing the reason must be there and disabled instead.
  //
  // `getByRole('menuitem', ...)` doesn't work here — Astryx's popover content
  // is excluded from the accessible-roles tree while the menu is closed (it
  // did not show up at all in a `getByRole` failure dump), unlike `Selector`'s
  // `disabledMessage`, which is wired to the trigger via `aria-describedby`
  // and stays discoverable regardless of open state. `getByText` still finds
  // it (it does not filter on visibility), so this disambiguates the two
  // same-text nodes by walking up to the nearest `role="menuitem"` ancestor.
  it('disables the remove action for the last owner and explains why in the menu', () => {
    renderSection({ role: 'owner', members: [OWNER_ONLY] })

    expect(screen.queryByText(m.workspace_settings_members_remove())).toBeNull()

    const hintNodes = screen.getAllByText(
      m.workspace_settings_members_remove_last_owner_hint(),
    )
    const menuItem = hintNodes
      .map((node) => node.closest('[role="menuitem"]'))
      .find((el): el is Element => el !== null)
    expect(menuItem).toBeTruthy()
    expect(menuItem?.getAttribute('aria-disabled')).toBe('true')
  })
})
