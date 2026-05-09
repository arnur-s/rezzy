import {
  TypographyHeading3,
  TypographyHeading4,
  TypographyMuted,
} from '@/components/typography'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import type { Workspace } from '@/features/workspaces/types'
import { useAuth } from '@/providers/auth-provider'
import { Surface } from '@heroui/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/workspaces/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session } = useAuth()
  const userId = session?.user.id

  const workspacesQuery = useWorkspaces(userId)

  return (
    <div className="grid grid-cols-1 gap-4 px-4 py-8 md:grid-cols-3 lg:grid-cols-5 lg:px-8 lg:py-10 auto-rows-fr">
      {workspacesQuery.data?.map((workspace) =>
        workspace.is_main ? (
          <WorkSpaceMainItem key={workspace.id} workspace={workspace} />
        ) : (
          <WorkSpaceItem key={workspace.id} workspace={workspace} />
        ),
      )}

      <WorkSpaceCreateItem />
    </div>
  )
}

function WorkSpaceCreateItem() {
  return (
    <Link to="/workspaces/create" className="block h-full">
      <Surface className="flex flex-col gap-3 rounded-3xl p-6 h-full items-center justify-center">
        <TypographyMuted>
          <TypographyHeading4 className="flex items-center gap-2">
            Create Workspace <ExternalLink />
          </TypographyHeading4>
        </TypographyMuted>
      </Surface>
    </Link>
  )
}

function WorkSpaceMainItem({ workspace }: { workspace: Workspace }) {
  return (
    <Surface className="flex h-full flex-col gap-3 rounded-3xl p-6">
      <TypographyHeading3>{workspace.name}</TypographyHeading3>
      <TypographyMuted>{workspace.description}</TypographyMuted>
    </Surface>
  )
}

function WorkSpaceItem({ workspace }: { workspace: Workspace }) {
  return (
    <Surface
      className="flex h-full flex-col gap-3 rounded-3xl p-6"
      variant="tertiary"
    >
      <TypographyHeading3>{workspace.name}</TypographyHeading3>
      <TypographyMuted>{workspace.description}</TypographyMuted>
    </Surface>
  )
}
