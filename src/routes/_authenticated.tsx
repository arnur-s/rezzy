import { SidebarInset, SidebarProvider } from '@/components/sidebar'
import { useAuth } from '@/providers/auth-provider'
import { AppSidebar } from '@/widgets/app-sidebar'
import { Spinner } from '@heroui/react'
import { createFileRoute, Navigate, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isLoading, session } = useAuth()

  return (
    <>
      {isLoading ? (
        <Spinner size="sm" />
      ) : session ? (
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="h-dvh overflow-hidden bg-background text-foreground">
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      ) : (
        <Navigate to="/sign-in" />
      )}
    </>
  )
}
