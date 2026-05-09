import { UserProfilePage } from '@/features/users/components/user-profile-page'
import { useAuth } from '@/providers/auth-provider'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/profile')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return <UserProfilePage user={user} />
}
