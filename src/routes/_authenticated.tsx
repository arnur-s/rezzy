import { SidebarInset, SidebarProvider } from '@/components/sidebar'
import { useAuth } from '@/providers/auth-provider'
import { AppHeader } from '@/widgets/app-header'
import { AppSidebar } from '@/widgets/app-sidebar'
import { Spinner } from '@heroui/react'
import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isLoading, session } = useAuth()

  return (
    <>
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner size="xl" />
        </div>
      ) : session ? (
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="text-foreground container mx-auto h-dvh overflow-hidden">
            <AppHeader />
            <div className="flex min-h-0 flex-1 flex-col overflow-auto">
              <Outlet />
            </div>
          </SidebarInset>
        </SidebarProvider>
      ) : (
        <Navigate to="/sign-in" />
      )}
    </>
  )
}
