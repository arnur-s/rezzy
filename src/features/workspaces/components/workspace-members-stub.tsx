import { getUserInitials } from '@/entities/user'
import { m } from '@/paraglide/messages'
import {
  Avatar,
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  Skeleton,
  TextField,
} from '@heroui/react'
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
    case 'viewer':
      return m.workspace_settings_members_role_viewer()
    default:
      return role
  }
}

export function WorkspaceMembersStub({ workspaceId }: Props) {
  const membersQuery = useWorkspaceMembers(workspaceId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">
          {m.workspace_settings_members_title()}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {m.workspace_settings_members_description()}
        </p>
      </div>

      <InviteByEmailStub />

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-muted">
          {m.workspace_settings_members_list_title()}
        </h3>

        {membersQuery.isPending ? (
          <MembersSkeleton />
        ) : membersQuery.isError ? (
          <div className="border-y border-border/60 py-6 text-sm text-danger">
            {m.workspace_settings_members_load_error()}
          </div>
        ) : membersQuery.data.length === 0 ? (
          <div className="border-y border-border/60 py-10 text-center text-sm text-muted">
            {m.workspace_settings_members_empty()}
          </div>
        ) : (
          <div className="divide-y divide-border/60 border-y border-border/60">
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
    <section className="flex flex-col gap-3 border-y border-border/60 py-5">
      <div className="flex items-center gap-2">
        <MailPlusIcon className="size-4 text-muted" />
        <h3 className="text-sm font-medium">
          {m.workspace_settings_members_invite_title()}
        </h3>
        <Chip color="warning" size="sm" variant="soft">
          <Chip.Label>
            {m.workspace_settings_members_invite_coming_soon()}
          </Chip.Label>
        </Chip>
      </div>
      <p className="text-xs text-muted">
        {m.workspace_settings_members_invite_description()}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <TextField className="flex-1" isDisabled>
          <Label className="sr-only">
            {m.workspace_settings_members_invite_email_label()}
          </Label>
          <Input
            placeholder={m.workspace_settings_members_invite_email_placeholder()}
            type="email"
          />
          <FieldError />
        </TextField>
        <Button isDisabled>
          {m.workspace_settings_members_invite_action()}
        </Button>
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
  const displayName = useMemo(() => {
    if (profile?.full_name?.trim()) return profile.full_name.trim()
    if (profile?.email?.trim()) return profile.email.trim()
    return m.workspace_settings_members_unknown_user()
  }, [profile])

  const email = profile?.email ?? ''
  const roleLabel = getRoleLabel(role)

  return (
    <div className="flex min-h-16 items-center gap-3 py-3">
      <Avatar size="sm" variant="soft">
        <Avatar.Fallback>{getUserInitials(displayName)}</Avatar.Fallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{displayName}</p>
        {email && (
          <p className="truncate text-xs text-muted">{email}</p>
        )}
      </div>
      <Chip color="default" size="sm" variant="soft">
        <Chip.Label>{roleLabel}</Chip.Label>
      </Chip>
    </div>
  )
}

function MembersSkeleton() {
  return (
    <div className="divide-y divide-border/60 border-y border-border/60">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex min-h-16 items-center gap-3 py-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3 rounded" />
            <Skeleton className="h-3 w-1/4 rounded" />
          </div>
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  )
}
