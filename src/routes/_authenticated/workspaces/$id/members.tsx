import { WorkspaceSectionPage } from '@/features/workspaces/components/workspace-section-page'
import { useAuth } from '@/providers/auth-provider'
import { Spinner } from '@heroui/react'
import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/$id/members')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  const { isLoading, session } = useAuth()

  if (isLoading) {
    return <Spinner size="sm" />
  }

  if (!session) {
    return <Navigate to="/sign-in" />
  }

  return <WorkspaceSectionPage section="members" workspaceId={id} />
}
