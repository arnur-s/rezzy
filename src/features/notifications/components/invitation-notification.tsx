import { workspaceMemberRoleLabel } from '@/entities/workspace'
import { membershipErrorMessage } from '@/features/workspaces/api/workspace-membership'
import type { WorkspaceInvitation } from '@/features/workspaces/api/workspace-membership'
import { useRespondToInvitation } from '@/features/workspaces/hooks/use-workspace-membership'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import type { ShowToastFn } from '@astryxdesign/core/Toast'
import { MailPlusIcon } from 'lucide-react'
import type { WorkspaceInvitationRow } from '../model/types'

/**
 * The presentation key for one invitation event.
 *
 * Not the row id. A re-invite is `ON CONFLICT DO UPDATE`, so it carries the
 * same primary key as the invitation it replaces, and both the deduper (500
 * ids per tab) and the tab coordinator (60s claims) would treat it as a
 * duplicate and present nothing. `created_at` is bumped by the upsert, which
 * makes this pair change exactly when there is something new to say.
 *
 * This couples to `invite_workspace_member`: if its DO UPDATE ever stops
 * setting `created_at = now()`, re-invite notifications go silent and nothing
 * fails. The migration header says so too.
 */
export function invitationPresentationKey(row: {
  id: string
  created_at: string
}): string {
  return `${row.id}:${row.created_at}`
}

/**
 * Whether a realtime `workspace_invitations` payload should be presented.
 *
 * Accept, reject and revoke all move status out of `'pending'` and must not
 * notify. The server already filters them — the SELECT policy carries `and
 * status = 'pending'` and realtime evaluates it against the new record — but a
 * policy predicate quietly doing double duty as presentation logic is how the
 * two drift apart, so the client checks too. Kept as its own pure predicate
 * (rather than an inline check in the subscription callback) so it can be
 * exercised directly, the same way `shouldPresentInApp` is for messages.
 */
export function shouldPresentInvitation(row: { status: string }): boolean {
  return row.status === 'pending'
}

/**
 * Picks the invited workspace's name out of a hydrated
 * `list_my_workspace_invitations` read.
 *
 * Null covers every miss the same way: `invitations` itself is null when the
 * hydrating fetch rejected (a race, a dropped connection), and `.find` comes
 * up empty when the fetch succeeded but this particular invitation is no
 * longer in it (already resolved or revoked between the realtime event and
 * the read). The caller cannot and need not tell these apart — both mean
 * "show the toast without a name" rather than "skip it."
 */
export function findInvitationWorkspaceName(
  invitations: Array<WorkspaceInvitation> | null,
  invitationId: string,
): string | null {
  return (
    invitations?.find((invitation) => invitation.id === invitationId)
      ?.workspaceName ?? null
  )
}

type InvitationNotificationProps = {
  row: WorkspaceInvitationRow
  /**
   * The invitee cannot read `public.workspaces` directly (RLS is
   * member-only), so this is hydrated by the caller from
   * `list_my_workspace_invitations`, the same RPC `InvitationResponseDialog`
   * already reads for the identical decision. Null when hydration missed —
   * a race with the invalidate, a failed refetch, or a row the RPC no longer
   * returns (already resolved or revoked by the time it ran) — in which case
   * the copy below falls back to a workspace-less sentence rather than
   * rendering `undefined`/`""`.
   */
  workspaceName: string | null
  showToast: ShowToastFn
  onOpen: (workspaceId: string) => void
  dismiss: () => void
}

/**
 * The toast body for one invitation event.
 *
 * Unlike the message toast, this has no title slot to omit: Astryx `Toast`
 * never had one, so `workspace_invitations_toast_title` is rendered here as
 * ordinary body text. And unlike the switcher's `DropdownMenu` row — which can
 * only carry one action and opens `InvitationResponseDialog` instead — the
 * toast body is arbitrary JSX, so Accept and Decline live inline.
 */
function InvitationNotification({
  row,
  workspaceName,
  showToast,
  onOpen,
  dismiss,
}: InvitationNotificationProps) {
  const respond = useRespondToInvitation()

  const roleLabel = workspaceMemberRoleLabel(row.role)
  const bodyText = workspaceName
    ? m.workspace_invitations_toast_body({ workspace: workspaceName, role: roleLabel })
    : m.workspace_invitations_toast_body_unknown_workspace({ role: roleLabel })
  const isAccepting = respond.isPending && respond.variables.accept === true
  const isDeclining = respond.isPending && respond.variables.accept === false

  function handleRespond(accept: boolean) {
    respond.mutate(
      { invitationId: row.id, accept },
      {
        onError: (error) => {
          showToast({ body: membershipErrorMessage(error), type: 'error' })
        },
        onSuccess: (workspaceId) => {
          dismiss()
          showToast({
            body: accept
              ? workspaceName
                ? m.workspace_invitations_accepted({ workspace: workspaceName })
                : m.workspace_invitations_accepted_unknown_workspace()
              : m.workspace_invitations_declined(),
            type: 'info',
          })
          // workspaceId is the accepted invitation's workspace, null on
          // decline (see respond_to_workspace_invitation).
          if (accept && workspaceId) onOpen(workspaceId)
        },
      },
    )
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="bg-muted text-secondary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <MailPlusIcon className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
          <span className="text-primary text-base font-semibold">
            {m.workspace_invitations_toast_title()}
          </span>
          <p className="text-secondary text-sm">{bodyText}</p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          label={m.workspace_invitations_decline()}
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => handleRespond(false)}
          isLoading={isDeclining}
          isDisabled={respond.isPending}
        />
        <Button
          label={m.workspace_invitations_accept()}
          type="button"
          variant="primary"
          size="sm"
          onClick={() => handleRespond(true)}
          isLoading={isAccepting}
          isDisabled={respond.isPending}
        />
      </div>
    </div>
  )
}

export type ShowInvitationNotificationOptions = {
  row: WorkspaceInvitationRow
  /** See {@link InvitationNotificationProps.workspaceName}. */
  workspaceName: string | null
  showToast: ShowToastFn
  /** Called with the joined workspace's id once Accept succeeds. */
  onOpen: (workspaceId: string) => void
}

/**
 * Show an invitation notification as an Astryx toast.
 *
 * Modelled on `showMessageNotificationToast`: same `uniqueID` + dedupe
 * discipline (here keyed by {@link invitationPresentationKey} rather than a
 * conversation id), same `holder` trick to let the body dismiss the very
 * toast it lives inside before `showToast` has returned.
 */
export function showInvitationNotificationToast({
  row,
  workspaceName,
  showToast,
  onOpen,
}: ShowInvitationNotificationOptions): void {
  const holder: { dismiss: () => void } = { dismiss: () => {} }

  holder.dismiss = showToast({
    body: (
      <InvitationNotification
        row={row}
        workspaceName={workspaceName}
        showToast={showToast}
        onOpen={onOpen}
        dismiss={() => holder.dismiss()}
      />
    ),
    type: 'info',
    uniqueID: invitationPresentationKey(row),
    autoHideDuration: 8000,
  })
}
