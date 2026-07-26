import { NotFound } from '@/components/not-found'
import type { AuthContextValue } from '@/providers/auth-provider'
import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  auth: AuthContextValue | null
}>()({
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  return <Outlet />
}
