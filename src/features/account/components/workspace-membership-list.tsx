import { SettingsSectionHeader } from '@/components/settings-section'
import { WorkspaceIcon } from '@/entities/workspace'
import { formatDate } from '@/lib/format-date'
import { m } from '@/paraglide/messages'
import { Badge } from '@astryxdesign/core/Badge'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { useMyMemberships } from '../hooks/use-my-memberships'
import type { AccountMembership } from '../model/types'

function roleLabel(role: string) {
  switch (role) {
    case 'owner':
      return m.workspace_settings_members_role_owner()
    case 'admin':
      return m.workspace_settings_members_role_admin()
    case 'member':
      return m.workspace_settings_members_role_member()
    default:
      return role
  }
}

function formatJoinedAt(value: string) {
  return formatDate(value, { year: 'numeric', month: 'long' })
}

/**
 * Read-only by construction: `workspace_members` RLS returns only the caller's
 * own rows, and nothing here can change a role — that is an administrator's
 * job, which the supporting copy says out loud.
 */
export function WorkspaceMembershipList() {
  const membershipsQuery = useMyMemberships()

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="account-workspaces"
    >
      <SettingsSectionHeader
        id="account-workspaces"
        title={m.profile_workspaces_title()}
        description={m.profile_workspaces_description()}
      />

      {membershipsQuery.isPending ? (
        <MembershipsSkeleton />
      ) : membershipsQuery.isError ? (
        <p className="text-error border-border/60 border-y py-6 text-sm">
          {m.profile_workspaces_load_error()}
        </p>
      ) : membershipsQuery.data.length === 0 ? (
        <p className="text-secondary border-border/60 border-y py-8 text-center text-sm">
          {m.profile_workspaces_empty()}
        </p>
      ) : (
        <ul className="divide-border/60 border-border/60 divide-y border-y">
          {membershipsQuery.data.map((membership) => (
            <MembershipRow key={membership.id} membership={membership} />
          ))}
        </ul>
      )}

      <p className="text-secondary text-xs">
        {m.profile_workspaces_managed_note()}
      </p>
    </section>
  )
}

function MembershipRow({ membership }: { membership: AccountMembership }) {
  const joinedAt = formatJoinedAt(membership.joinedAt)

  return (
    <li className="flex min-h-14 items-center gap-3 py-3">
      <span className="bg-accent-bg/10 text-accent flex size-8 shrink-0 items-center justify-center rounded-md">
        <WorkspaceIcon name={membership.workspaceIcon} className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-primary truncate text-sm font-medium">
          {membership.workspaceName}
        </p>
        {joinedAt ? (
          <p className="text-secondary truncate text-xs">
            {m.profile_workspaces_joined({ date: joinedAt })}
          </p>
        ) : null}
      </div>

      <Badge variant="neutral" label={roleLabel(membership.role)} />
    </li>
  )
}

function MembershipsSkeleton() {
  return (
    <div
      className="divide-border/60 border-border/60 divide-y border-y"
      aria-hidden
    >
      {[0, 1].map((row) => (
        <div key={row} className="flex min-h-14 items-center gap-3 py-3">
          <Skeleton width={32} height={32} radius={3} />
          <div className="flex-1 space-y-1.5">
            <Skeleton width="40%" height={12} radius={2} />
            <Skeleton width="25%" height={12} radius={2} />
          </div>
          <Skeleton width={56} height={20} radius="rounded" />
        </div>
      ))}
    </div>
  )
}
