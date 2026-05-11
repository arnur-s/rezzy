import { Toast } from '@heroui/react'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { AuthContextValue } from '@/providers/auth-provider'
import type { QueryClient } from '@tanstack/react-query'
import { NotFound } from '@/components/not-found'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  auth: AuthContextValue | null
}>()({
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  return (
    <>
      <Toast.Provider placement="top" />
      <Outlet />
    </>
  )
}
