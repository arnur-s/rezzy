import { useAuth } from '@/providers/auth-provider'
import { NotificationsProvider } from '@/providers/notifications-provider'
import { Header } from '@/widgets/header'
import { Sidebar } from '@/widgets/sidebar'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

const COLLAPSED_STORAGE_KEY = 'app:sidebar-collapsed'

export const Route = createFileRoute('/_authenticated')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isLoading, session } = useAuth()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true',
  )

  useEffect(() => {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(isCollapsed))
  }, [isCollapsed])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/sign-in" />
  }

  return (
    <NotificationsProvider>
      <AppShell
        height="fill"
        variant="elevated"
        contentPadding={0}
        topNav={<Header />}
        sideNav={
          <Sidebar
            isCollapsed={isCollapsed}
            onCollapsedChange={setIsCollapsed}
          />
        }
        mobileNav={{
          isOpen: isMobileNavOpen,
          onOpenChange: setIsMobileNavOpen,
          content: (
            <Sidebar
              isCollapsed={false}
              onCollapsedChange={() => {}}
              onNavigate={() => setIsMobileNavOpen(false)}
            />
          ),
        }}
      >
        <Outlet />
      </AppShell>
    </NotificationsProvider>
  )
}
