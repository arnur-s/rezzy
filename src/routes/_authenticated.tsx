import { useSyncLanguagePreference } from '@/features/account'
import {
  OnboardingStatusError,
  resolveAppGate,
  useOnboardingStatus,
} from '@/features/onboarding'
import { useAuth } from '@/providers/auth-provider'
import { NotificationsProvider } from '@/providers/notifications-provider'
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
  const status = useOnboardingStatus()
  // The account's language follows the user across browsers, so the server
  // value has to reconcile with the cache the app booted from.
  useSyncLanguagePreference()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true',
  )

  useEffect(() => {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(isCollapsed))
  }, [isCollapsed])

  const gate = resolveAppGate({
    isAuthLoading: isLoading,
    hasSession: Boolean(session),
    isStatusPending: status.isPending,
    isStatusError: status.isError,
    isOnboarded: status.isOnboarded,
  })

  if (gate === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (gate === 'sign-in') {
    return <Navigate to="/sign-in" />
  }

  if (gate === 'error') {
    return (
      <OnboardingStatusError
        onRetry={status.refetch}
        isRetrying={status.isRetrying}
      />
    )
  }

  // No workspace means onboarding never finished; the app has nothing to scope
  // to yet.
  if (gate === 'onboarding') {
    return <Navigate to="/onboarding" />
  }

  return (
    <NotificationsProvider>
      <AppShell
        height="fill"
        // 'section' rather than 'elevated': the elevated variant separates nav
        // from content by tone alone, and the current theme resolves the canvas
        // and the content surface to the same value, so nothing reads.
        variant="section"
        contentPadding={0}
        // No top bar: the nav rail carries identity, account, and notifications,
        // and each page owns its own title. Below the mobile breakpoint AppShell
        // renders the rail horizontally with a drawer toggle on its own.
        sideNav={
          <Sidebar
            isCollapsed={isCollapsed}
            onCollapsedChange={setIsCollapsed}
            onNavigate={() => setIsMobileNavOpen(false)}
          />
        }
        // No `content`: AppShell renders that slot raw, outside its drawer
        // chrome, so passing a second <Sidebar> laid a full copy of the rail
        // into the page flow below the inbox on every phone-width load — two
        // brand marks and two nav trees stacked down the screen. Left empty,
        // AppShell reuses the `sideNav` above and wraps it in the drawer
        // itself. `onNavigate` closes that drawer after a tap; on the desktop
        // rail it is a no-op.
        mobileNav={{
          isOpen: isMobileNavOpen,
          onOpenChange: setIsMobileNavOpen,
        }}
      >
        <Outlet />
      </AppShell>
    </NotificationsProvider>
  )
}
