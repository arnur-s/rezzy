import { SettingsSectionHeader } from '@/components/settings-section'
import type { WorkspaceMember } from '@/entities/workspace'
import {
  WORKSPACE_MEMBER_ROLES,
  workspaceMemberLabels,
  workspaceMemberRoleGroupLabel,
  workspaceMemberRoleLabel,
} from '@/entities/workspace'
import { formatDate } from '@/lib/format-date'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { MoreMenu } from '@astryxdesign/core/MoreMenu'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { useToast } from '@astryxdesign/core/Toast'
import { useNavigate } from '@tanstack/react-router'
import { UserPlusIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { WorkspaceInvitationForAdmin } from '../api/workspace-membership'
import { membershipErrorMessage } from '../api/workspace-membership'
import {
  useRemoveMember,
  useRevokeInvitation,
  useUpdateMemberRole,
  useWorkspaceInvitations,
} from '../hooks/use-workspace-membership'
import {
  useIsWorkspaceAdmin,
  useWorkspace,
  useWorkspaceMemberDirectory,
} from '../hooks/use-workspaces'
import { InviteMemberModal } from './invite-member-modal'

type Props = {
  workspaceId: string
}

/** The date a membership or invitation started. Day precision is the most this
 *  ever needs: nobody triages a roster by the hour. */
const DAY_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}

export function WorkspaceMembersSection({ workspaceId }: Props) {
  const { user } = useAuth()
  const { isAdmin, isLoaded: isAdminLoaded } = useIsWorkspaceAdmin(workspaceId)
  const membersQuery = useWorkspaceMemberDirectory(workspaceId)
  const workspaceQuery = useWorkspace(workspaceId)
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data])

  const [isInviteOpen, setIsInviteOpen] = useState(false)

  // Before the roster arrives, `isAdmin` and "not known yet" are both `false`.
  // Gating on `isAdminLoaded` too keeps an admin's own controls from flashing
  // away from them for the length of the first fetch.
  const canManage = isAdminLoaded && isAdmin

  // Derived from the roster query the page already holds, so this costs no
  // extra request. It disables the affected controls and explains why;
  // update_workspace_member_role and remove_workspace_member enforce the same
  // rule, and they are what decides.
  const ownerCount = members.filter((member) => member.role === 'owner').length

  // Two colleagues sharing a display name is ordinary, and this is the page
  // where you pick which of them to remove — the one place a roster must not
  // render both as the same string. Every other picker in the product already
  // routes through this helper.
  const labels = useMemo(() => workspaceMemberLabels(members), [members])

  // The RPC already returns the roster ordered owner -> admin -> member, so the
  // grouping below preserves the server's order within each group rather than
  // imposing one. Roles the app does not define keep their raw value as a
  // heading rather than being dropped from the page.
  const groups = useMemo(() => {
    const byRole = new Map<string, Array<WorkspaceMember>>()
    for (const member of members) {
      const group = byRole.get(member.role)
      if (group) group.push(member)
      else byRole.set(member.role, [member])
    }

    const known = WORKSPACE_MEMBER_ROLES.filter((role) => byRole.has(role))
    const unknown = [...byRole.keys()].filter(
      (role) => !(WORKSPACE_MEMBER_ROLES as ReadonlyArray<string>).includes(role),
    )

    return [...known, ...unknown].map((role) => ({
      role,
      members: byRole.get(role) ?? [],
    }))
  }, [members])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <SettingsSectionHeader
          title={m.workspace_settings_members_title()}
          description={m.workspace_settings_members_description()}
        />
        {canManage ? (
          <Button
            label={m.workspace_settings_members_invite_open()}
            variant="primary"
            icon={<UserPlusIcon className="size-4" />}
            onClick={() => setIsInviteOpen(true)}
          />
        ) : null}
      </div>

      {canManage ? (
        <InviteMemberModal
          workspaceId={workspaceId}
          isOpen={isInviteOpen}
          onOpenChange={setIsInviteOpen}
        />
      ) : null}

      {canManage ? <PendingInvitationsList workspaceId={workspaceId} /> : null}

      {membersQuery.isPending ? (
        <MembersSkeleton />
      ) : membersQuery.isError ? (
        <div
          role="alert"
          className="border-border flex flex-col items-start gap-3 border-y py-6"
        >
          <p className="text-error text-sm">
            {m.workspace_settings_members_load_error()}
          </p>
          <Button
            label={m.common_retry()}
            variant="secondary"
            size="sm"
            onClick={() => void membersQuery.refetch()}
            isLoading={membersQuery.isFetching}
          />
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.role} className="flex flex-col gap-3">
            <h3 className="text-secondary text-sm font-medium">
              {workspaceMemberRoleGroupLabel(group.role)}
            </h3>
            <ul className="divide-border border-border divide-y border-y">
              {group.members.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  label={labels.get(member.userId) ?? member.fullName}
                  workspaceId={workspaceId}
                  workspaceName={workspaceQuery.data?.name ?? ''}
                  canManage={canManage}
                  isSelf={member.userId === user?.id}
                  isLastOwner={member.role === 'owner' && ownerCount <= 1}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

/** Pending invitations, owner/admin only, with a revoke action per row. */
function PendingInvitationsList({ workspaceId }: { workspaceId: string }) {
  const invitationsQuery = useWorkspaceInvitations(workspaceId)
  const revoke = useRevokeInvitation(workspaceId)
  const showToast = useToast()

  function handleRevoke(invitationId: string) {
    revoke.mutate(invitationId, {
      onSuccess: () => {
        showToast({
          body: m.workspace_settings_members_revoke_success(),
          type: 'info',
        })
      },
      onError: (error) => {
        showToast({ body: membershipErrorMessage(error), type: 'error' })
      },
    })
  }

  if (invitationsQuery.isPending) return <PendingInvitationsSkeleton />

  if (invitationsQuery.isError) {
    return (
      <p role="alert" className="text-error border-border border-y py-4 text-sm">
        {m.workspace_settings_members_load_error()}
      </p>
    )
  }

  // Nothing pending is the ordinary state of this list, and a heading plus a
  // sentence saying so was on screen on every visit to every workspace that had
  // none — spending the top of the page to report an absence. The section now
  // appears only when it has something to say.
  if (invitationsQuery.data.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-secondary text-sm font-medium">
        {m.workspace_settings_members_pending_title()}
      </h3>
      <ul className="divide-border border-border divide-y border-y">
        {invitationsQuery.data.map((invitation) => (
          <PendingInvitationRow
            key={invitation.id}
            invitation={invitation}
            isRevoking={revoke.isPending && revoke.variables === invitation.id}
            onRevoke={() => handleRevoke(invitation.id)}
          />
        ))}
      </ul>
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
  const sentOn = formatDate(invitation.createdAt, DAY_FORMAT)

  return (
    <li className="flex min-h-14 items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        {/*
          The email is always shown, never replaced by the name. Re-inviting the
          same address resends the invitation — the RPC upserts on the pending
          row — so the address is the one fact this row exists to make
          actionable, and hiding it behind a resolved name meant retyping an
          address the page was refusing to display.
        */}
        <p className="truncate text-base font-medium">
          {invitation.invitedName || invitation.invitedEmail}
        </p>
        {invitation.invitedName ? (
          <p className="text-secondary truncate text-sm">
            {invitation.invitedEmail}
          </p>
        ) : null}
        <p className="text-secondary truncate text-sm">
          {invitation.invitedByName
            ? `${m.workspace_settings_members_pending_invited_by({
                name: invitation.invitedByName,
              })} · ${m.workspace_settings_members_pending_sent({ date: sentOn })}`
            : m.workspace_settings_members_pending_sent({ date: sentOn })}
        </p>
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
    </li>
  )
}

/** What the row's confirmation dialog is currently asking about. */
type PendingAction =
  | { kind: 'remove' }
  | { kind: 'leave' }
  | { kind: 'demote'; role: string }

/**
 * The title, consequence and action label for one confirmation.
 *
 * Three actions share one dialog because they share one row, and each states
 * what is actually lost rather than asking "are you sure": removal and leaving
 * both revoke access to every conversation in the workspace, and giving up
 * ownership cannot be undone by the person doing it.
 */
function confirmationCopy(
  pending: PendingAction,
  subject: { name: string; workspace: string },
) {
  switch (pending.kind) {
    case 'leave':
      return {
        title: m.workspace_settings_members_leave_confirm_title(),
        description: m.workspace_settings_members_leave_confirm_description({
          workspace: subject.workspace,
        }),
        actionLabel: m.workspace_settings_members_leave(),
        actionVariant: 'destructive' as const,
      }
    case 'demote':
      return {
        title: m.workspace_settings_members_demote_self_confirm_title(),
        description:
          m.workspace_settings_members_demote_self_confirm_description({
            role: workspaceMemberRoleLabel(pending.role),
          }),
        actionLabel: m.workspace_settings_members_demote_self_action(),
        // A real loss, but not a deletion. DESIGN.md's destructive button is a
        // pastel well rather than a fill precisely so weight can live in copy.
        actionVariant: 'primary' as const,
      }
    case 'remove':
      return {
        title: m.workspace_settings_members_remove_confirm_title(),
        description: m.workspace_settings_members_remove_confirm_description({
          name: subject.name,
        }),
        actionLabel: m.workspace_settings_members_remove(),
        actionVariant: 'destructive' as const,
      }
  }
}

function MemberRow({
  member,
  label,
  workspaceId,
  workspaceName,
  canManage,
  isSelf,
  isLastOwner,
}: {
  member: WorkspaceMember
  label: string
  workspaceId: string
  workspaceName: string
  canManage: boolean
  isSelf: boolean
  isLastOwner: boolean
}) {
  const updateRole = useUpdateMemberRole(workspaceId)
  const removeMember = useRemoveMember(workspaceId)
  const showToast = useToast()
  const navigate = useNavigate()

  const [pending, setPending] = useState<PendingAction | null>(null)

  // Null when the row has no real name to show, so the placeholder can be kept
  // out of `Avatar`: it derives initials from whatever string it is handed, and
  // initialing "Без имени" printed "БИ" — a plausible-looking monogram for a
  // person who has none.
  const knownName = useMemo(() => {
    const trimmed = member.fullName.trim()
    return trimmed ? trimmed : null
  }, [member.fullName])

  const displayName = knownName
    ? label
    : m.workspace_settings_members_unknown_user()
  const lastOwnerHint = m.workspace_settings_members_remove_last_owner_hint()

  function applyRole(role: string) {
    updateRole.mutate(
      { userId: member.userId, role },
      {
        onSuccess: () => {
          showToast({
            body: m.workspace_settings_members_role_updated({
              name: displayName,
              role: workspaceMemberRoleLabel(role),
            }),
            type: 'info',
          })
        },
        onError: (error) => {
          showToast({ body: membershipErrorMessage(error), type: 'error' })
        },
      },
    )
  }

  function handleRoleSelect(role: string) {
    if (role === member.role) return
    // Dropping your own owner rights is not recoverable by you — only another
    // owner can hand them back — so it is confirmed even though changing
    // somebody else's role is not. The last-owner case never reaches here; that
    // row's role items are disabled.
    if (isSelf && member.role === 'owner') {
      setPending({ kind: 'demote', role })
      return
    }
    applyRole(role)
  }

  function confirmDestructive() {
    const leaving = pending?.kind === 'leave'
    removeMember.mutate(
      { userId: member.userId },
      {
        onSuccess: () => {
          setPending(null)
          if (leaving) {
            showToast({
              body: m.workspace_settings_members_leave_success(),
              type: 'info',
            })
            // RLS has already withdrawn this workspace; staying on its settings
            // page would leave the user looking at content they can no longer
            // read.
            void navigate({ to: '/' })
            return
          }
          showToast({
            body: m.workspace_settings_members_remove_success({
              name: displayName,
            }),
            type: 'info',
          })
        },
        onError: (error) => {
          setPending(null)
          showToast({ body: membershipErrorMessage(error), type: 'error' })
        },
      },
    )
  }

  // A member can always leave; only an owner or admin can act on anyone else.
  // The previous version gated the whole menu on `canManage`, which left a
  // plain member with no exit at all while an admin removed *themselves* under
  // a label that read as an action taken on somebody else.
  const hasMenu = canManage || isSelf

  const roleItems = WORKSPACE_MEMBER_ROLES.map((role) => ({
    label: workspaceMemberRoleLabel(role),
    icon:
      role === member.role ? <span aria-hidden>✓</span> : <span aria-hidden />,
    onClick: () => handleRoleSelect(role),
    isDisabled: isLastOwner || updateRole.isPending,
  }))

  const destructiveItem = isSelf
    ? {
        label: m.workspace_settings_members_leave(),
        onClick: () => setPending({ kind: 'leave' }),
        isDisabled: isLastOwner || removeMember.isPending,
      }
    : {
        label: m.workspace_settings_members_remove(),
        onClick: () => setPending({ kind: 'remove' }),
        isDisabled: isLastOwner || removeMember.isPending,
      }

  return (
    <li className="flex min-h-14 items-center gap-3 py-3">
      <Avatar
        name={knownName ?? undefined}
        src={member.avatarUrl ?? undefined}
        size="sm"
      />
      {/*
        The name column is the only part of this row that has to survive a
        320px viewport, and it now does: the role control that used to sit
        beside it — intrinsically sized, growing with the longest role label,
        taking its width out of the name — has moved into the menu below. The
        role is still visible, as the heading over this group.
      */}
      <div className="min-w-0 flex-1">
        {/*
          The name gets the line to itself. The "you" marker used to sit beside
          it and took 40px out of a column that has 196 at 320px — enough to
          push "Александр Верещагин" into an ellipsis. It is a fact *about* the
          person, so it reads correctly next to their title and start date, and
          the name keeps the full measure.
        */}
        <p
          className={
            knownName
              ? 'truncate text-base font-medium'
              : 'text-secondary truncate text-base font-medium italic'
          }
        >
          {displayName}
        </p>
        <p className="text-secondary flex items-center gap-2 text-sm">
          {isSelf ? (
            <Badge
              variant="neutral"
              label={m.workspace_settings_members_you()}
            />
          ) : null}
          <span className="truncate">
            {member.jobTitle
              ? `${member.jobTitle} · ${m.workspace_settings_members_joined({
                  date: formatDate(member.joinedAt, DAY_FORMAT),
                })}`
              : m.workspace_settings_members_joined({
                  date: formatDate(member.joinedAt, DAY_FORMAT),
                })}
          </span>
        </p>
      </div>

      {hasMenu ? (
        <MoreMenu
          label={m.workspace_settings_members_row_actions_label({
            name: displayName,
          })}
          size="sm"
          items={
            isLastOwner
              ? [
                  // `DropdownMenuItemData` has no message slot (no
                  // `disabledMessage`, unlike `Selector`/`TextInput`), so a
                  // greyed-out set of items would explain nothing once opened.
                  // For the last owner the item's own label *becomes* the
                  // reason instead of the action — the only way this control
                  // can tell a user why it is inert.
                  { label: lastOwnerHint, isDisabled: true },
                ]
              : [
                  ...(canManage
                    ? [
                        {
                          type: 'section' as const,
                          title: m.workspace_settings_members_role_menu_section(),
                          items: roleItems,
                        },
                        { type: 'divider' as const },
                      ]
                    : []),
                  destructiveItem,
                ]
          }
        />
      ) : null}

      {/* Mounted only while it is asking something. A roster of 40 people would
          otherwise carry 40 idle dialogs. */}
      {pending !== null ? (
        <AlertDialog
          isOpen
          onOpenChange={(open) => {
            if (!open) setPending(null)
          }}
          {...confirmationCopy(pending, {
            name: displayName,
            workspace: workspaceName,
          })}
          onAction={() => {
            if (pending.kind === 'demote') {
              const role = pending.role
              setPending(null)
              applyRole(role)
              return
            }
            confirmDestructive()
          }}
          cancelLabel={m.common_cancel()}
          isActionLoading={removeMember.isPending || updateRole.isPending}
        />
      ) : null}
    </li>
  )
}

function MembersSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label={m.workspace_settings_members_list_title()}
      className="divide-border border-border divide-y border-y"
    >
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
    <div
      aria-busy="true"
      aria-label={m.workspace_settings_members_pending_title()}
      className="divide-border border-border divide-y border-y"
    >
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
