import { workspaceMemberRoleLabel } from '@/entities/workspace'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { useToast } from '@astryxdesign/core/Toast'
import type { WorkspaceInvitation } from '../api/workspace-membership'
import { membershipErrorMessage } from '../api/workspace-membership'
import { useRespondToInvitation } from '../hooks/use-workspace-membership'

type Props = {
  /** Null closes the dialog; an invitation opens it for that invitation. */
  invitation: WorkspaceInvitation | null
  onOpenChange: (open: boolean) => void
}

/**
 * Accept/decline for one pending invitation, opened from a row in the
 * workspace switcher's Invitations section.
 *
 * A `DropdownMenu` row is a single action, so Accept and Decline cannot both
 * live on the menu row itself — the row opens this dialog instead, which is
 * also the better home for the decision: it can show who invited the person
 * and to what role before they choose.
 */
export function InvitationResponseDialog({ invitation, onOpenChange }: Props) {
  const showToast = useToast()
  const respond = useRespondToInvitation()

  const roleLabel = invitation
    ? workspaceMemberRoleLabel(invitation.role)
    : ''

  // `invited_by` is `ON DELETE SET NULL`, so the inviter can be gone by the
  // time the invitee opens this dialog. Falls back to the unknown-inviter copy
  // rather than interpolating an empty name into the named-inviter sentence.
  const bodyText = invitation
    ? invitation.invitedByName
      ? m.workspace_invitations_dialog_body({
          inviter: invitation.invitedByName,
          workspace: invitation.workspaceName,
          role: roleLabel,
        })
      : m.workspace_invitations_dialog_body_unknown_inviter({
          workspace: invitation.workspaceName,
          role: roleLabel,
        })
    : ''

  function handleRespond(accept: boolean) {
    if (!invitation) return

    respond.mutate(
      { invitationId: invitation.id, accept },
      {
        onError: (error) => {
          showToast({ body: membershipErrorMessage(error), type: 'error' })
        },
        onSuccess: () => {
          showToast({
            body: accept
              ? m.workspace_invitations_accepted({
                  workspace: invitation.workspaceName,
                })
              : m.workspace_invitations_declined(),
            type: 'info',
          })
          onOpenChange(false)
        },
      },
    )
  }

  const isAccepting = respond.isPending && respond.variables.accept === true
  const isDeclining = respond.isPending && respond.variables.accept === false

  return (
    <Dialog
      isOpen={invitation !== null}
      onOpenChange={onOpenChange}
      purpose="info"
      width={400}
    >
      <DialogHeader
        title={m.workspace_invitations_dialog_title()}
        onOpenChange={onOpenChange}
      />
      <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
        <p className="text-secondary text-sm">{bodyText}</p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            label={m.workspace_invitations_decline()}
            type="button"
            variant="secondary"
            onClick={() => handleRespond(false)}
            isLoading={isDeclining}
            isDisabled={respond.isPending}
          />
          <Button
            label={m.workspace_invitations_accept()}
            type="button"
            variant="primary"
            onClick={() => handleRespond(true)}
            isLoading={isAccepting}
            isDisabled={respond.isPending}
          />
        </div>
      </div>
    </Dialog>
  )
}
