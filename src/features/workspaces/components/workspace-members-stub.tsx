import { SettingsSectionHeader } from '@/components/settings-section'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { TextInput } from '@astryxdesign/core/TextInput'
import { MailPlusIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useWorkspaceMembers } from '../hooks/use-workspaces'

type Props = {
  workspaceId: string
}

function getRoleLabel(role: string) {
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

export function WorkspaceMembersStub({ workspaceId }: Props) {
  const membersQuery = useWorkspaceMembers(workspaceId)

  return (
    <div className="flex flex-col gap-6">
      <SettingsSectionHeader
        title={m.workspace_settings_members_title()}
        description={m.workspace_settings_members_description()}
      />

      <InviteByEmailStub />

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
        ) : membersQuery.data.length === 0 ? (
          <div className="text-secondary border-border/60 border-y py-10 text-center text-sm">
            {m.workspace_settings_members_empty()}
          </div>
        ) : (
          <div className="divide-border/60 border-border/60 divide-y border-y">
            {membersQuery.data.map((member) => (
              <MemberRow
                key={member.id}
                profile={member.profile}
                role={member.role}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function InviteByEmailStub() {
  return (
    <section className="border-border/60 flex flex-col gap-3 border-y py-5">
      <div className="flex items-center gap-2">
        <MailPlusIcon className="text-secondary size-4" />
        <h3 className="text-sm font-medium">
          {m.workspace_settings_members_invite_title()}
        </h3>
        <Badge variant="warning" label={m.channels_coming_soon()} />
      </div>
      <p className="text-secondary text-xs">
        {m.workspace_settings_members_invite_description()}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextInput
            label={m.workspace_settings_members_invite_email_label()}
            isLabelHidden
            type="email"
            placeholder={m.workspace_settings_members_invite_email_placeholder()}
            value=""
            isDisabled
          />
        </div>
        <Button
          label={m.workspace_settings_members_invite_action()}
          isDisabled
        />
      </div>
    </section>
  )
}

type ProfileLite = {
  id?: string
  full_name?: string | null
  email?: string | null
  avatar_url?: string | null
} | null

function MemberRow({ profile, role }: { profile: ProfileLite; role: string }) {
  // Null when the row has no real name to show, so the placeholder can be kept
  // out of `Avatar`: it derives initials from whatever string it is handed, and
  // initialing "Без имени" printed "БИ" — a plausible-looking monogram for a
  // person who has none.
  const knownName = useMemo(() => {
    if (profile?.full_name?.trim()) return profile.full_name.trim()
    if (profile?.email?.trim()) return profile.email.trim()
    return null
  }, [profile])

  const displayName = knownName ?? m.workspace_settings_members_unknown_user()

  const email = profile?.email ?? ''
  const roleLabel = getRoleLabel(role)

  return (
    <div className="flex min-h-14 items-center gap-3 py-3">
      <Avatar
        name={knownName ?? undefined}
        src={profile?.avatar_url ?? undefined}
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
        {email && <p className="text-secondary truncate text-xs">{email}</p>}
      </div>
      <Badge variant="neutral" label={roleLabel} />
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
