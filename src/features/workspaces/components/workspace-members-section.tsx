import { SettingsSectionHeader } from '@/components/settings-section'
import {
  WORKSPACE_MEMBER_ROLES,
  workspaceMemberRoleLabel,
} from '@/entities/workspace'
import type { WorkspaceMember } from '@/entities/workspace'
import { useLocalizedSchema } from '@/hooks/use-localized-schema'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { MoreMenu } from '@astryxdesign/core/MoreMenu'
import { Selector } from '@astryxdesign/core/Selector'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { MailPlusIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { membershipErrorMessage } from '../api/workspace-membership'
import type { WorkspaceInvitationForAdmin } from '../api/workspace-membership'
import {
  useInviteMember,
  useRemoveMember,
  useRevokeInvitation,
  useUpdateMemberRole,
  useWorkspaceInvitations,
} from '../hooks/use-workspace-membership'
import {
  useIsWorkspaceAdmin,
  useWorkspaceMemberDirectory,
} from '../hooks/use-workspaces'
import type { InviteMemberFormValues } from '../schemas/invite-member-schema'
import {
  INVITE_MEMBER_ROLES,
  createInviteMemberSchema,
  inviteMemberDefaultValues,
} from '../schemas/invite-member-schema'

type Props = {
  workspaceId: string
}

export function WorkspaceMembersSection({ workspaceId }: Props) {
  const { isAdmin, isLoaded: isAdminLoaded } = useIsWorkspaceAdmin(workspaceId)
  const membersQuery = useWorkspaceMemberDirectory(workspaceId)
  const members = membersQuery.data ?? []

  // Before the roster arrives, `isAdmin` and "not known yet" are both `false`.
  // Gating on `isAdminLoaded` too keeps an admin's own controls from flashing
  // away from them for the length of the first fetch.
  const canManage = isAdminLoaded && isAdmin

  // Derived from the roster query the page already holds, so this costs no
  // extra request. It disables the affected controls and explains why;
  // update_workspace_member_role and remove_workspace_member enforce the same
  // rule, and they are what decides.
  const ownerCount = members.filter((member) => member.role === 'owner').length
  const isLastOwner = (member: WorkspaceMember) =>
    member.role === 'owner' && ownerCount <= 1

  return (
    <div className="flex flex-col gap-6">
      <SettingsSectionHeader
        title={m.workspace_settings_members_title()}
        description={m.workspace_settings_members_description()}
      />

      {canManage ? <InviteMemberForm workspaceId={workspaceId} /> : null}
      {canManage ? <PendingInvitationsList workspaceId={workspaceId} /> : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-secondary text-sm font-medium">
          {m.workspace_settings_members_list_title()}
        </h3>

        {membersQuery.isPending ? (
          <MembersSkeleton />
        ) : membersQuery.isError ? (
          <div className="text-error border-border/60 border-y py-6 text-sm">
            {m.workspace_settings_members_load_error()}
          </div>
        ) : members.length === 0 ? (
          <div className="text-secondary border-border/60 border-y py-10 text-center text-sm">
            {m.workspace_settings_members_empty()}
          </div>
        ) : (
          <div className="divide-border/60 border-border/60 divide-y border-y">
            {members.map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                workspaceId={workspaceId}
                canManage={canManage}
                isLastOwner={isLastOwner(member)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * The invite form. Rendered only for owners and admins; the RPC refuses
 * everyone else, so this hides an affordance rather than enforcing a rule.
 *
 * The helper text is permanent and sits on the field itself via `description`,
 * not in an error slot. Only registered users can be invited, which is a
 * standing property of the invite model — an inviter needs to know it before
 * they type, not after the attempt fails. `USER_NOT_FOUND` explains a failed
 * attempt; this prevents one.
 */
function InviteMemberForm({ workspaceId }: { workspaceId: string }) {
  const invite = useInviteMember(workspaceId)
  const showToast = useToast()
  const schema = useLocalizedSchema(createInviteMemberSchema)

  const { control, handleSubmit, reset } = useForm<InviteMemberFormValues>({
    defaultValues: inviteMemberDefaultValues,
    disabled: invite.isPending,
    resolver: standardSchemaResolver(schema),
  })

  function onSubmit(values: InviteMemberFormValues) {
    invite.mutate(values, {
      onSuccess: () => {
        // Reset to the defaults rather than clearing the email alone: the role
        // selector is part of the same form state, and leaving it on the last
        // pick makes the next invite silently inherit it.
        reset(inviteMemberDefaultValues)
        showToast({
          body: m.workspace_settings_members_invite_sent(),
          type: 'info',
        })
      },
    })
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="border-border/60 flex flex-col gap-3 border-y py-5"
    >
      <div className="flex items-center gap-2">
        <MailPlusIcon className="text-secondary size-4" />
        <h3 className="text-sm font-medium">
          {m.workspace_settings_members_invite_title()}
        </h3>
      </div>
      <p className="text-secondary text-xs">
        {m.workspace_settings_members_invite_description()}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
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
        </div>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Selector
              label={m.workspace_settings_members_invite_role_label()}
              value={field.value}
              onChange={(next) => field.onChange(next)}
              options={INVITE_MEMBER_ROLES.map((role) => ({
                value: role,
                label: workspaceMemberRoleLabel(role),
              }))}
              isDisabled={invite.isPending}
            />
          )}
        />
        <Button
          label={m.workspace_settings_members_invite_action()}
          type="submit"
          isLoading={invite.isPending}
        />
      </div>

      {invite.isError ? (
        <p className="text-error text-xs" role="alert">
          {membershipErrorMessage(invite.error)}
        </p>
      ) : null}
    </form>
  )
}

/** Pending invitations, owner/admin only, with a revoke action per row. */
function PendingInvitationsList({ workspaceId }: { workspaceId: string }) {
  const invitationsQuery = useWorkspaceInvitations(workspaceId)
  const revoke = useRevokeInvitation(workspaceId)
  const showToast = useToast()

  function handleRevoke(invitationId: string) {
    revoke.mutate(invitationId, {
      onError: (error) => {
        showToast({ body: membershipErrorMessage(error), type: 'error' })
      },
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-secondary text-sm font-medium">
        {m.workspace_settings_members_pending_title()}
      </h3>

      {invitationsQuery.isPending ? (
        <PendingInvitationsSkeleton />
      ) : invitationsQuery.isError ? (
        <div className="text-error border-border/60 border-y py-4 text-xs">
          {m.workspace_settings_members_load_error()}
        </div>
      ) : invitationsQuery.data.length === 0 ? (
        <p className="text-secondary text-xs">
          {m.workspace_settings_members_pending_empty()}
        </p>
      ) : (
        <div className="divide-border/60 border-border/60 divide-y border-y">
          {invitationsQuery.data.map((invitation) => (
            <PendingInvitationRow
              key={invitation.id}
              invitation={invitation}
              isRevoking={revoke.isPending && revoke.variables === invitation.id}
              onRevoke={() => handleRevoke(invitation.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function PendingInvitationRow({
  invitation,
  isRevoking,
  onRevoke,
}: {
  invitation: WorkspaceInvitationForAdmin
  isRevoking: boolean
  onRevoke: () => void
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {invitation.invitedName || invitation.invitedEmail}
        </p>
        {invitation.invitedByName ? (
          <p className="text-secondary truncate text-xs">
            {m.workspace_settings_members_pending_invited_by({
              name: invitation.invitedByName,
            })}
          </p>
        ) : null}
      </div>
      <Badge
        variant="neutral"
        label={workspaceMemberRoleLabel(invitation.role)}
      />
      <Button
        label={m.workspace_settings_members_pending_revoke()}
        variant="ghost"
        size="sm"
        isLoading={isRevoking}
        onClick={onRevoke}
      />
    </div>
  )
}

function MemberRow({
  member,
  workspaceId,
  canManage,
  isLastOwner,
}: {
  member: WorkspaceMember
  workspaceId: string
  canManage: boolean
  isLastOwner: boolean
}) {
  const updateRole = useUpdateMemberRole(workspaceId)
  const removeMember = useRemoveMember(workspaceId)
  const showToast = useToast()

  // Null when the row has no real name to show, so the placeholder can be kept
  // out of `Avatar`: it derives initials from whatever string it is handed, and
  // initialing "Без имени" printed "БИ" — a plausible-looking monogram for a
  // person who has none.
  const knownName = useMemo(() => {
    const trimmed = member.fullName.trim()
    return trimmed ? trimmed : null
  }, [member.fullName])

  const displayName = knownName ?? m.workspace_settings_members_unknown_user()
  const roleLabel = workspaceMemberRoleLabel(member.role)

  const lastOwnerHint = m.workspace_settings_members_remove_last_owner_hint()

  function handleRoleChange(role: string) {
    updateRole.mutate(
      { userId: member.userId, role },
      {
        onError: (error) => {
          showToast({ body: membershipErrorMessage(error), type: 'error' })
        },
      },
    )
  }

  function handleRemove() {
    removeMember.mutate(
      { userId: member.userId },
      {
        onError: (error) => {
          showToast({ body: membershipErrorMessage(error), type: 'error' })
        },
      },
    )
  }

  return (
    <div className="flex min-h-14 items-center gap-3 py-3">
      <Avatar
        name={knownName ?? undefined}
        src={member.avatarUrl ?? undefined}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-medium',
            // The placeholder is a statement about missing data, not a name.
            !knownName && 'text-secondary italic',
          )}
        >
          {displayName}
        </p>
      </div>

      {canManage ? (
        <>
          {/*
           * `disabledMessage` is the Astryx-documented way to explain a
           * disabled trigger (see the component's own guidance against
           * wrapping a disabled control in `Tooltip`), and its content turns
           * out to render into the DOM unconditionally — Astryx mounts the
           * tooltip's content div at all times via the native `popover`
           * attribute and toggles only its visibility; it does not wait for
           * hover/focus to mount it. Confirmed empirically while writing
           * workspace-members-section.test.tsx: an earlier version of this
           * row also rendered the hint in a permanent, always-visible `<p>`,
           * and the "disables removal of the last owner" test started
           * failing on "multiple elements found" for the same string — proof
           * the tooltip's own text was already in the DOM. So the hint is
           * reachable by `getByText` without simulating hover, and one copy
           * is enough.
           */}
          <Selector
            label={m.workspace_settings_members_role_change_label({
              name: displayName,
            })}
            isLabelHidden
            size="sm"
            value={member.role}
            onChange={handleRoleChange}
            options={WORKSPACE_MEMBER_ROLES.map((role) => ({
              value: role,
              label: workspaceMemberRoleLabel(role),
            }))}
            isDisabled={isLastOwner || updateRole.isPending}
            disabledMessage={isLastOwner ? lastOwnerHint : undefined}
          />
          <MoreMenu
            label={m.workspace_settings_members_row_actions_label({
              name: displayName,
            })}
            size="sm"
            items={[
              // `DropdownMenuItemData` has no message slot (no
              // `disabledMessage`, unlike `Selector`/`TextInput`), so a
              // greyed-out "Remove from workspace" item would explain
              // nothing once opened. For the last owner, the item's own
              // label *becomes* the reason instead of the action — the only
              // way this control can tell a user why it is inert.
              isLastOwner
                ? { label: lastOwnerHint, isDisabled: true }
                : {
                    label: m.workspace_settings_members_remove(),
                    onClick: handleRemove,
                    isDisabled: removeMember.isPending,
                  },
            ]}
          />
        </>
      ) : (
        <Badge variant="neutral" label={roleLabel} />
      )}
    </div>
  )
}

function MembersSkeleton() {
  return (
    <div className="divide-border/60 border-border/60 divide-y border-y">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex min-h-14 items-center gap-3 py-3">
          <Skeleton width={32} height={32} radius="rounded" />
          <div className="flex-1 space-y-1.5">
            <Skeleton width="33%" height={12} radius={2} />
            <Skeleton width="25%" height={12} radius={2} />
          </div>
          <Skeleton width={48} height={20} radius="rounded" />
        </div>
      ))}
    </div>
  )
}

function PendingInvitationsSkeleton() {
  return (
    <div className="divide-border/60 border-border/60 divide-y border-y">
      {[0, 1].map((i) => (
        <div key={i} className="flex min-h-14 items-center gap-3 py-3">
          <div className="flex-1 space-y-1.5">
            <Skeleton width="40%" height={12} radius={2} />
            <Skeleton width="30%" height={12} radius={2} />
          </div>
          <Skeleton width={48} height={20} radius="rounded" />
          <Skeleton width={56} height={20} radius="rounded" />
        </div>
      ))}
    </div>
  )
}
