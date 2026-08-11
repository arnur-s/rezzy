import type { WorkspaceInvitation } from '@/features/workspaces/api/workspace-membership'
import type { WorkspaceInvitationRow } from '@/features/notifications/model/types'
import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import type { ShowToastFn, ToastOptions } from '@astryxdesign/core/Toast'
import { fireEvent, render, screen } from '@testing-library/react'
import { isValidElement } from 'react'
import type { ReactElement } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  findInvitationWorkspaceName,
  invitationPresentationKey,
  shouldPresentInvitation,
  showInvitationNotificationToast,
} from './invitation-notification'

const ROW = {
  id: 'inv-1',
  created_at: '2026-08-09T10:00:00Z',
}

const INVITATION_ROW: WorkspaceInvitationRow = {
  id: 'inv-1',
  created_at: '2026-08-09T10:00:00Z',
  workspace_id: 'ws-1',
  invited_user_id: 'user-1',
  invited_email: 'invitee@example.com',
  invited_by: 'inviter-1',
  role: 'member',
  status: 'pending',
  resolved_at: null,
  resolved_by: null,
}

const WORKSPACE_NAME = 'Gamma Ltd'

const useRespondToInvitationMock = vi.hoisted(() => vi.fn())
vi.mock('@/features/workspaces/hooks/use-workspace-membership', () => ({
  useRespondToInvitation: useRespondToInvitationMock,
}))

describe('invitationPresentationKey', () => {
  it('changes when the same invitation is re-sent', () => {
    // A re-invite is an ON CONFLICT DO UPDATE, so it carries the SAME primary
    // key as the row it replaces. NotificationDeduper keeps the last 500 ids
    // and the tab coordinator claims for 60s — keying on `id` alone would
    // swallow exactly the case where an admin tries again because the first
    // attempt went unnoticed. created_at is bumped by the upsert.
    const first = invitationPresentationKey(ROW)
    const reinvited = invitationPresentationKey({
      ...ROW,
      created_at: '2026-08-09T11:30:00Z',
    })

    expect(first).not.toBe(reinvited)
  })

  it('is stable for a duplicate delivery of one event', () => {
    expect(invitationPresentationKey(ROW)).toBe(
      invitationPresentationKey({ ...ROW }),
    )
  })
})

describe('shouldPresentInvitation', () => {
  it('presents nothing for a payload that has moved out of pending', () => {
    // Accept, reject and revoke all flip status away from 'pending'. The
    // server-side SELECT policy already filters these, but this is the
    // client-side check that must not silently stop matching it.
    expect(shouldPresentInvitation({ status: 'accepted' })).toBe(false)
  })

  it('presents a pending payload', () => {
    expect(shouldPresentInvitation({ status: 'pending' })).toBe(true)
  })
})

const INVITATIONS: Array<WorkspaceInvitation> = [
  {
    id: 'inv-1',
    workspaceId: 'ws-1',
    workspaceName: 'Gamma Ltd',
    workspaceIcon: null,
    role: 'member',
    invitedByName: null,
    createdAt: '2026-08-09T10:00:00Z',
  },
]

describe('findInvitationWorkspaceName', () => {
  it('finds the matching invitation by id', () => {
    expect(findInvitationWorkspaceName(INVITATIONS, 'inv-1')).toBe('Gamma Ltd')
  })

  it('is null when the fetch that hydrates the list failed', () => {
    // presentInvitation passes null here on a rejected fetchQuery — a race
    // with the invalidate, a dropped connection, etc.
    expect(findInvitationWorkspaceName(null, 'inv-1')).toBeNull()
  })

  it('is null when the invitation is no longer in the list', () => {
    // Already resolved or revoked between the realtime event and the read.
    expect(findInvitationWorkspaceName(INVITATIONS, 'inv-does-not-exist')).toBeNull()
  })
})

/** A `showToast` stub that records every call and returns a spy dismiss fn. */
function createFakeShowToast() {
  const calls: Array<ToastOptions> = []
  const dismiss = vi.fn()
  const showToast: ShowToastFn = (options) => {
    calls.push(options)
    return dismiss
  }
  return { showToast, calls, dismiss }
}

/** Mounts the toast's `body` element, the same way the real toast host would. */
function bodyElement(body: ToastOptions['body']): ReactElement {
  if (!isValidElement(body)) {
    throw new Error('expected the toast body to be a React element')
  }
  return body
}

describe('showInvitationNotificationToast', () => {
  beforeAll(() => {
    setLocale('en', { reload: false })
  })

  beforeEach(() => {
    useRespondToInvitationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    })
  })

  it('keys the toast on id + created_at, not the row id alone', () => {
    const { showToast, calls } = createFakeShowToast()

    showInvitationNotificationToast({
      row: INVITATION_ROW,
      workspaceName: WORKSPACE_NAME,
      showToast,
      onOpen: vi.fn(),
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].uniqueID).toBe(invitationPresentationKey(INVITATION_ROW))
    expect(calls[0].type).toBe('info')
    expect(calls[0].autoHideDuration).toBe(8000)
  })

  it('names the workspace, the role, and offers Accept/Decline', () => {
    const { showToast, calls } = createFakeShowToast()

    showInvitationNotificationToast({
      row: INVITATION_ROW,
      workspaceName: WORKSPACE_NAME,
      showToast,
      onOpen: vi.fn(),
    })
    render(bodyElement(calls[0].body))

    expect(screen.getByText(m.workspace_invitations_toast_title())).toBeTruthy()
    // Exact string, not a regex/substring: pins that the sentence actually
    // carries the workspace name, not just the role.
    expect(
      screen.getByText(
        m.workspace_invitations_toast_body({
          workspace: WORKSPACE_NAME,
          role: m.workspace_settings_members_role_member(),
        }),
      ),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: m.workspace_invitations_accept() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: m.workspace_invitations_decline() }),
    ).toBeTruthy()
  })

  it('falls back to a workspace-less sentence when the name failed to hydrate', () => {
    // Null means a race with the invalidate, a failed refetch, or a row the
    // RPC no longer returns — not "found and empty". Must not render
    // undefined/"" into the body.
    const { showToast, calls } = createFakeShowToast()

    showInvitationNotificationToast({
      row: INVITATION_ROW,
      workspaceName: null,
      showToast,
      onOpen: vi.fn(),
    })
    render(bodyElement(calls[0].body))

    expect(
      screen.getByText(
        m.workspace_invitations_toast_body_unknown_workspace({
          role: m.workspace_settings_members_role_member(),
        }),
      ),
    ).toBeTruthy()
    expect(
      screen.queryByText(
        m.workspace_invitations_toast_body({
          workspace: WORKSPACE_NAME,
          role: m.workspace_settings_members_role_member(),
        }),
      ),
    ).toBeNull()
  })

  it('accepts, dismisses the toast, confirms by name, and opens the joined workspace', () => {
    const mutate = vi.fn(
      (
        _variables: { invitationId: string; accept: boolean },
        options: { onSuccess: (workspaceId: string | null) => void },
      ) => {
        options.onSuccess('ws-1')
      },
    )
    useRespondToInvitationMock.mockReturnValue({
      mutate,
      isPending: false,
      variables: undefined,
    })
    const { showToast, calls, dismiss } = createFakeShowToast()
    const onOpen = vi.fn()

    showInvitationNotificationToast({
      row: INVITATION_ROW,
      workspaceName: WORKSPACE_NAME,
      showToast,
      onOpen,
    })
    render(bodyElement(calls[0].body))

    fireEvent.click(
      screen.getByRole('button', { name: m.workspace_invitations_accept() }),
    )

    expect(mutate).toHaveBeenCalledWith(
      { invitationId: 'inv-1', accept: true },
      expect.anything(),
    )
    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(calls).toHaveLength(2)
    expect(calls[1].body).toBe(
      m.workspace_invitations_accepted({ workspace: WORKSPACE_NAME }),
    )
    expect(onOpen).toHaveBeenCalledWith('ws-1')
  })

  it('confirms acceptance without a name when hydration missed', () => {
    const mutate = vi.fn(
      (
        _variables: { invitationId: string; accept: boolean },
        options: { onSuccess: (workspaceId: string | null) => void },
      ) => {
        options.onSuccess('ws-1')
      },
    )
    useRespondToInvitationMock.mockReturnValue({
      mutate,
      isPending: false,
      variables: undefined,
    })
    const { showToast, calls } = createFakeShowToast()

    showInvitationNotificationToast({
      row: INVITATION_ROW,
      workspaceName: null,
      showToast,
      onOpen: vi.fn(),
    })
    render(bodyElement(calls[0].body))

    fireEvent.click(
      screen.getByRole('button', { name: m.workspace_invitations_accept() }),
    )

    expect(calls[1].body).toBe(m.workspace_invitations_accepted_unknown_workspace())
  })

  it('declines without opening a workspace', () => {
    const mutate = vi.fn(
      (
        _variables: { invitationId: string; accept: boolean },
        options: { onSuccess: (workspaceId: string | null) => void },
      ) => {
        options.onSuccess(null)
      },
    )
    useRespondToInvitationMock.mockReturnValue({
      mutate,
      isPending: false,
      variables: undefined,
    })
    const { showToast, calls, dismiss } = createFakeShowToast()
    const onOpen = vi.fn()

    showInvitationNotificationToast({
      row: INVITATION_ROW,
      workspaceName: WORKSPACE_NAME,
      showToast,
      onOpen,
    })
    render(bodyElement(calls[0].body))

    fireEvent.click(
      screen.getByRole('button', { name: m.workspace_invitations_decline() }),
    )

    expect(mutate).toHaveBeenCalledWith(
      { invitationId: 'inv-1', accept: false },
      expect.anything(),
    )
    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(calls[1].body).toBe(m.workspace_invitations_declined())
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('shows a localized error and leaves the toast open when the RPC fails', () => {
    const mutate = vi.fn(
      (
        _variables: { invitationId: string; accept: boolean },
        options: { onError: (error: unknown) => void },
      ) => {
        options.onError({ message: 'LAST_OWNER' })
      },
    )
    useRespondToInvitationMock.mockReturnValue({
      mutate,
      isPending: false,
      variables: undefined,
    })
    const { showToast, calls, dismiss } = createFakeShowToast()

    showInvitationNotificationToast({
      row: INVITATION_ROW,
      workspaceName: WORKSPACE_NAME,
      showToast,
      onOpen: vi.fn(),
    })
    render(bodyElement(calls[0].body))

    fireEvent.click(
      screen.getByRole('button', { name: m.workspace_invitations_accept() }),
    )

    expect(calls).toHaveLength(2)
    expect(calls[1].body).toBe(m.workspace_settings_members_error_last_owner())
    expect(calls[1].type).toBe('error')
    expect(dismiss).not.toHaveBeenCalled()
  })
})
