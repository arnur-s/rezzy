import type { WorkspaceInvitationRow } from '@/features/notifications/model/types'
import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import type { ShowToastFn, ToastOptions } from '@astryxdesign/core/Toast'
import { fireEvent, render, screen } from '@testing-library/react'
import { isValidElement } from 'react'
import type { ReactElement } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
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
      showToast,
      onOpen: vi.fn(),
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].uniqueID).toBe(invitationPresentationKey(INVITATION_ROW))
    expect(calls[0].type).toBe('info')
    expect(calls[0].autoHideDuration).toBe(8000)
  })

  it('renders the toast title, the role, and Accept/Decline', () => {
    const { showToast, calls } = createFakeShowToast()

    showInvitationNotificationToast({
      row: INVITATION_ROW,
      showToast,
      onOpen: vi.fn(),
    })
    render(bodyElement(calls[0].body))

    expect(screen.getByText(m.workspace_invitations_toast_title())).toBeTruthy()
    expect(
      screen.getByText(
        m.workspace_invitations_toast_body({
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

  it('accepts, dismisses the toast, and opens the joined workspace', () => {
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

    showInvitationNotificationToast({ row: INVITATION_ROW, showToast, onOpen })
    render(bodyElement(calls[0].body))

    fireEvent.click(
      screen.getByRole('button', { name: m.workspace_invitations_accept() }),
    )

    expect(mutate).toHaveBeenCalledWith(
      { invitationId: 'inv-1', accept: true },
      expect.anything(),
    )
    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith('ws-1')
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

    showInvitationNotificationToast({ row: INVITATION_ROW, showToast, onOpen })
    render(bodyElement(calls[0].body))

    fireEvent.click(
      screen.getByRole('button', { name: m.workspace_invitations_decline() }),
    )

    expect(mutate).toHaveBeenCalledWith(
      { invitationId: 'inv-1', accept: false },
      expect.anything(),
    )
    expect(dismiss).toHaveBeenCalledTimes(1)
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
