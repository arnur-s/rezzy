import {
  workspaceMemberRoleDescription,
  workspaceMemberRoleLabel,
} from '@/entities/workspace'
import { useLocalizedSchema } from '@/hooks/use-localized-schema'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { Controller, useForm } from 'react-hook-form'
import { membershipErrorMessage } from '../api/workspace-membership'
import { useInviteMember } from '../hooks/use-workspace-membership'
import type { InviteMemberFormValues } from '../schemas/invite-member-schema'
import {
  INVITE_MEMBER_ROLES,
  createInviteMemberSchema,
  inviteMemberDefaultValues,
} from '../schemas/invite-member-schema'

type Props = {
  workspaceId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Invite by email, in a dialog.
 *
 * It used to be a permanently expanded form above the roster, which made the
 * page open on a creation form for the rarer task — on a phone the entire first
 * screen was the invite, its 149-character constraint paragraph, and a heading
 * announcing that no invitations were pending, before a single colleague
 * appeared. Every other creation flow in this product is already a dialog
 * (`CreateWorkspaceModal`, `ConnectChannelModal`, `ContactFormDialog`); this now
 * matches them, and the roster gets the page back.
 *
 * The dialog is also what buys the roles enough room to explain themselves. As
 * a row of controls the role picker could only be a two-option `Selector`,
 * which Astryx's own guidance argues against; here it is a `RadioList` whose
 * options carry their permissions in a description.
 *
 * The helper text stays permanent and on the field itself via `description`,
 * not in an error slot: only registered users can be invited, which is a
 * standing property of the invite model. An inviter needs to know it before
 * they type, not after the attempt fails. `USER_NOT_FOUND` explains a failed
 * attempt; this prevents one.
 */
export function InviteMemberModal({ workspaceId, isOpen, onOpenChange }: Props) {
  const invite = useInviteMember(workspaceId)
  const showToast = useToast()
  const schema = useLocalizedSchema(createInviteMemberSchema)

  const { control, handleSubmit, reset } = useForm<InviteMemberFormValues>({
    defaultValues: inviteMemberDefaultValues,
    disabled: invite.isPending,
    resolver: standardSchemaResolver(schema),
  })

  function close() {
    // Reset to the defaults rather than clearing the email alone: the role is
    // part of the same form state, and leaving it on the last pick makes the
    // next invite silently inherit it.
    reset(inviteMemberDefaultValues)
    invite.reset()
    onOpenChange(false)
  }

  function onSubmit(values: InviteMemberFormValues) {
    invite.mutate(values, {
      onSuccess: () => {
        showToast({
          body: m.workspace_settings_members_invite_sent(),
          type: 'info',
        })
        close()
      },
    })
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => (open ? onOpenChange(true) : close())}
      purpose="form"
      width={480}
    >
      <DialogHeader
        title={m.workspace_settings_members_invite_modal_title()}
        onOpenChange={(open) => (open ? onOpenChange(true) : close())}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextInput
              label={m.workspace_settings_members_invite_email_label()}
              description={m.workspace_settings_members_invite_help()}
              type="email"
              placeholder={m.workspace_settings_members_invite_email_placeholder()}
              value={field.value}
              onChange={(next) => field.onChange(next)}
              isDisabled={invite.isPending}
              status={
                fieldState.error?.message
                  ? { type: 'error', message: fieldState.error.message }
                  : undefined
              }
            />
          )}
        />

        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <RadioList
              label={m.workspace_settings_members_invite_role_label()}
              value={field.value}
              onChange={(next) => field.onChange(next)}
              isDisabled={invite.isPending}
            >
              {INVITE_MEMBER_ROLES.map((role) => (
                <RadioListItem
                  key={role}
                  value={role}
                  label={workspaceMemberRoleLabel(role)}
                  // Non-null for every role in `INVITE_MEMBER_ROLES`; the
                  // helper only returns null for a role this app does not
                  // define.
                  description={workspaceMemberRoleDescription(role) ?? undefined}
                />
              ))}
            </RadioList>
          )}
        />

        {invite.isError ? (
          <p className="text-error text-sm" role="alert">
            {membershipErrorMessage(invite.error)}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            label={m.common_cancel()}
            variant="secondary"
            type="button"
            onClick={close}
            isDisabled={invite.isPending}
          />
          <Button
            label={m.workspace_settings_members_invite_action()}
            variant="primary"
            type="submit"
            isLoading={invite.isPending}
          />
        </div>
      </form>
    </Dialog>
  )
}
