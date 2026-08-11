import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceInvitation } from '../api/workspace-membership'
import { InvitationResponseDialog } from './invitation-response-dialog'

const useRespondToInvitationMock = vi.hoisted(() => vi.fn())
vi.mock('../hooks/use-workspace-membership', () => ({
  useRespondToInvitation: useRespondToInvitationMock,
}))

const INVITATION: WorkspaceInvitation = {
  id: 'inv-1',
  workspaceId: 'ws-1',
  workspaceName: 'Gamma Ltd',
  workspaceIcon: null,
  role: 'admin',
  invitedByName: 'Анна Петрова',
  createdAt: '2026-08-09T10:00:00Z',
}

function renderDialog(invitation: WorkspaceInvitation | null) {
  return renderWithQueryClient(
    <InvitationResponseDialog invitation={invitation} onOpenChange={() => {}} />,
  )
}

describe('InvitationResponseDialog', () => {
  beforeAll(() => {
    // jsdom does not implement the native <dialog> API that Astryx's Dialog
    // renders on; polyfilled the same way as the other Dialog-based tests in
    // this repo (see contact-notes-section.test.tsx).
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true
    }
    HTMLDialogElement.prototype.close = function close() {
      this.open = false
    }
  })

  beforeEach(() => {
    setLocale('en', { reload: false })
    useRespondToInvitationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    })
  })

  // `.toBeTruthy()` rather than jest-dom's `toBeInTheDocument()`: this repo
  // does not depend on `@testing-library/jest-dom` (not in package.json, not
  // wired into src/test/setup.ts), so that matcher does not exist here. Same
  // convention as workspace-members-section.test.tsx.
  it('names the inviter, the workspace and the role', () => {
    renderDialog(INVITATION)

    expect(screen.getByText(/Gamma Ltd/)).toBeTruthy()
    expect(screen.getByText(/Анна Петрова/)).toBeTruthy()
  })

  it('falls back to a localized string when the inviter is unknown', () => {
    // invited_by is ON DELETE SET NULL, so the inviter can be gone.
    renderDialog({ ...INVITATION, invitedByName: null })

    expect(
      screen.getByText(
        m.workspace_invitations_dialog_body_unknown_inviter({
          workspace: 'Gamma Ltd',
          role: m.workspace_settings_members_role_admin(),
        }),
      ),
    ).toBeTruthy()
  })

  it('offers accept and decline', () => {
    renderDialog(INVITATION)

    expect(
      screen.getByRole('button', { name: m.workspace_invitations_accept() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: m.workspace_invitations_decline() }),
    ).toBeTruthy()
  })
})
