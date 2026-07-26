import { setLocale } from '@/paraglide/runtime'
import { render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountMembership } from '../model/types'
import { WorkspaceMembershipList } from './workspace-membership-list'

const hoisted = vi.hoisted(() => ({
  query: {
    data: [] as Array<AccountMembership>,
    isPending: false,
    isError: false,
  },
}))

vi.mock('../hooks/use-my-memberships', () => ({
  useMyMemberships: () => hoisted.query,
}))

const MEMBERSHIP: AccountMembership = {
  id: 'membership-1',
  role: 'admin',
  joinedAt: '2026-03-04T10:00:00.000Z',
  workspaceId: 'workspace-1',
  workspaceName: 'Sales',
  workspaceIcon: 'briefcase',
}

describe('WorkspaceMembershipList', () => {
  beforeAll(() => {
    setLocale('en')
  })

  beforeEach(() => {
    hoisted.query.data = [MEMBERSHIP]
    hoisted.query.isPending = false
    hoisted.query.isError = false
  })

  it('shows the workspace, the role, and when membership started', () => {
    render(<WorkspaceMembershipList />)

    expect(screen.getByText('Sales')).toBeTruthy()
    expect(screen.getByText('Admin')).toBeTruthy()
    expect(screen.getByText(/Member since/)).toBeTruthy()
  })

  // Roles belong to workspace administration, which is not part of the
  // personal account area — so there is nothing here to press.
  it('offers no way to change the role', () => {
    render(<WorkspaceMembershipList />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(
      screen.getByText('Roles are managed by workspace administrators.'),
    ).toBeTruthy()
  })

  it('explains an empty membership list', () => {
    hoisted.query.data = []
    render(<WorkspaceMembershipList />)

    expect(
      screen.getByText('You don’t belong to a workspace yet.'),
    ).toBeTruthy()
  })

  it('explains a failed load without emptying the section', () => {
    hoisted.query.isError = true
    render(<WorkspaceMembershipList />)

    expect(screen.getByText('Couldn’t load your workspaces.')).toBeTruthy()
    expect(screen.getByText('Workspaces')).toBeTruthy()
  })
})
