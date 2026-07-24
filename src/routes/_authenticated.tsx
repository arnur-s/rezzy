import { useAuth } from '@/providers/auth-provider'
import { NotificationsProvider } from '@/providers/notifications-provider'
import { Header } from '@/widgets/header'
import { Sidebar } from '@/widgets/sidebar'
import { Spinner } from '@heroui/react'
import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

const COLLAPSED_STORAGE_KEY = 'app:sidebar-collapsed'

export const Route = createFileRoute('/_authenticated')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isLoading, session } = useAuth()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true',
  )

  useEffect(() => {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(isCollapsed))
  }, [isCollapsed])

  function handleToggleSidebar() {
    if (window.matchMedia('(min-width: 768px)').matches) {
      setIsCollapsed((value) => !value)
    } else {
      setIsMobileSidebarOpen(true)
    }
  }

  return (
    <>
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner size="xl" />
        </div>
      ) : session ? (
        <NotificationsProvider>
          {/* App canvas. The sidebar and header sit directly on it; route
              content floats above it as inset panes (see components/pane). */}
          <div className="bg-background flex h-screen overflow-hidden">
            <Sidebar
              isCollapsed={isCollapsed}
              isMobileOpen={isMobileSidebarOpen}
              onMobileOpenChange={setIsMobileSidebarOpen}
            />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <Header onToggleSidebar={handleToggleSidebar} />
              {/* Workspace area. Padding is the breathing room between the
                  canvas edges and the panes; panes own their own scrolling. */}
              <main className="flex min-h-0 flex-1 flex-col p-1 pt-0 md:p-2 md:pt-0">
                <Outlet />
              </main>
            </div>
          </div>
        </NotificationsProvider>
      ) : (
        <Navigate to="/sign-in" />
      )}
    </>
  )
}
