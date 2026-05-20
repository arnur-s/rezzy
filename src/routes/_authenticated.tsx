import { useAuth } from '@/providers/auth-provider'
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
        <div className="flex h-screen overflow-hidden">
          <Sidebar
            isCollapsed={isCollapsed}
            isMobileOpen={isMobileSidebarOpen}
            onMobileOpenChange={setIsMobileSidebarOpen}
          />
          <div className=" flex min-w-0 flex-1 flex-col overflow-hidden">
            <Header onToggleSidebar={handleToggleSidebar} />
            <main className="flex flex-1 overflow-auto z-1">
              <Outlet />
            </main>
          </div>
        </div>
      ) : (
        <Navigate to="/sign-in" />
      )}
    </>
  )
}
