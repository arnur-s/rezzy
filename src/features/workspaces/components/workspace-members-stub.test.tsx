import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceMembersStub } from './workspace-members-stub'

const useWorkspaceMembersMock = vi.hoisted(() => vi.fn())
vi.mock('../hooks/use-workspaces', () => ({
  useWorkspaceMembers: useWorkspaceMembersMock,
}))

type Row = {
  id: string
  role: string
  profile: {
    id?: string
    full_name?: string | null
    email?: string | null
    avatar_url?: string | null
  } | null
}

function mockMembers(data: Array<Row>) {
  useWorkspaceMembersMock.mockReturnValue({
    data,
    isPending: false,
    isError: false,
  })
}

describe('WorkspaceMembersStub', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    useWorkspaceMembersMock.mockReset()
  })

  it('shows the member name and role', () => {
    mockMembers([
      {
        id: 'm1',
        role: 'owner',
        profile: { id: 'u1', full_name: 'Alice Johnson', email: 'a@example.com' },
      },
    ])

    renderWithQueryClient(<WorkspaceMembersStub workspaceId="w1" />)

    expect(screen.getByText('Alice Johnson')).toBeTruthy()
    expect(
      screen.getByText(m.workspace_settings_members_role_owner()),
    ).toBeTruthy()
  })

  /**
   * `Avatar` derives initials from whatever string it is handed, so passing it
   * the "no name on file" placeholder produced a plausible-looking monogram
   * ("BI" / "БИ") for a person who has no name at all — the one row where the
   * avatar should stay anonymous.
   */
  it('does not initial the placeholder when a member has no name', () => {
    mockMembers([
      { id: 'm1', role: 'member', profile: { id: 'u1', full_name: null, email: null } },
    ])

    renderWithQueryClient(<WorkspaceMembersStub workspaceId="w1" />)

    const placeholder = m.workspace_settings_members_unknown_user()
    expect(screen.getByText(placeholder)).toBeTruthy()
    // Astryx's Avatar exposes its accessible name via aria-label; with no name
    // there should be nothing labelled with the placeholder text.
    expect(screen.queryByRole('img', { name: placeholder })).toBeNull()
  })

  it('falls back to the email when the name is missing', () => {
    mockMembers([
      {
        id: 'm1',
        role: 'member',
        profile: { id: 'u1', full_name: null, email: 'bob@example.com' },
      },
    ])

    renderWithQueryClient(<WorkspaceMembersStub workspaceId="w1" />)

    expect(screen.getAllByText('bob@example.com').length).toBeGreaterThan(0)
    expect(
      screen.queryByText(m.workspace_settings_members_unknown_user()),
    ).toBeNull()
  })
})
