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

  it('disables removal of the last owner and says why', () => {
    renderSection({ role: 'owner', members: [OWNER_ONLY] })

    expect(
      screen.getByText(m.workspace_settings_members_remove_last_owner_hint()),
    ).toBeTruthy()
  })
})
