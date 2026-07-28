import { AppPane } from '@/components/app-pane'
import { m } from '@/paraglide/messages'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import {
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'

type AccountSection = 'profile' | 'appearance' | 'notifications' | 'security'

type SettingsNavItem = {
  key: AccountSection
  path: string
  label: string
}

export const Route = createFileRoute('/_authenticated/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const navItems: Array<SettingsNavItem> = [
    {
      key: 'profile',
      path: '/settings/profile',
      label: m.account_settings_profile_label(),
    },
    {
      key: 'appearance',
      path: '/settings/appearance',
      label: m.account_settings_appearance_label(),
    },
    {
      key: 'notifications',
      path: '/settings/notifications',
      label: m.account_settings_notifications_label(),
    },
    {
      key: 'security',
      path: '/settings/security',
      label: m.account_settings_security_label(),
    },
  ]

  const selectedKey =
    navItems.find(
      (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
    )?.key ?? 'profile'

  return (
    // One pane on the canvas. The rule below the header is intra-pane, marking
    // the boundary between the fixed title and the region that scrolls under
    // it; the seam against the nav rail is the gutter, not a border.
    <AppPane>
      {/* 64px and a hairline — the shared pane-header contract. */}
      <header className="border-border/60 flex h-16 shrink-0 items-center border-b">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-8">
          <h1 className="truncate text-base font-semibold">
            {m.account_settings_title()}
          </h1>
        </div>
      </header>

      {/* The pane owns the scroll edge-to-edge; the column inside it owns the
          measure, so the scrollbar rides the pane rather than the text. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 md:py-8">
          <p className="text-secondary max-w-2xl text-sm">
            {m.account_settings_description()}
          </p>

          {/*
            One nav for both breakpoints. TabList lays its tabs out in a row but
            does not scroll them: at 390px the Russian labels need 421px in a
            358px column, so "Безопасность" was clipped off the screen with no
            way to reach it. The scroll container is ours.

            `-mx-4 px-4` lets the row bleed to the pane edges while its first
            and last tabs keep the page's own inset, so a scrolled tab does not
            sit flush against the viewport edge.
          */}
          <div className="-mx-4 overflow-x-auto px-4 pt-6 sm:-mx-8 sm:px-8">
            <TabList
              value={selectedKey}
              onChange={(key) => {
                const target = navItems.find((item) => item.key === key)
                if (target) void navigate({ to: target.path })
              }}
              aria-label={m.account_settings_sections_nav_aria_label()}
            >
              {navItems.map((item) => (
                <Tab key={item.key} value={item.key} label={item.label} />
              ))}
            </TabList>
          </div>

          <div className="pt-8">
            <Outlet />
          </div>
        </div>
      </div>
    </AppPane>
  )
}
