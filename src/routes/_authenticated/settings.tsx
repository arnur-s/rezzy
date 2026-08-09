import { AppPane } from '@/components/app-pane'
import { m } from '@/paraglide/messages'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import {
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

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

  const tabScrollRef = useRef<HTMLDivElement>(null)

  // The row scrolls, so a section whose tab sits past the right edge would
  // otherwise open with its own tab off-screen — on a phone that is every
  // deep link to Security, arriving on a strip that shows three other
  // sections and no sign of which one you are looking at. `nearest` leaves an
  // already-visible tab alone, and the jump is instant because this is the
  // page arriving rather than the user moving.
  //
  // `aria-current="page"` is how Astryx marks the selected tab. It renders a
  // `nav` of buttons rather than a `tablist`, so there is no `aria-selected`
  // to read; of the two attributes it does set, this is the standards-defined
  // one, where `data-selected="selected"` is its own internal spelling.
  useEffect(() => {
    const row = tabScrollRef.current
    if (!row) return

    let cancelled = false
    const reveal = () => {
      if (cancelled) return
      const selected = row.querySelector('[aria-current="page"]')
      if (selected instanceof HTMLElement) {
        selected.scrollIntoView({
          behavior: 'instant',
          block: 'nearest',
          inline: 'nearest',
        })
      }
    }

    reveal()
    // Golos Text swaps in after this effect first runs, and the Cyrillic
    // labels widen when it does — measured 17px on "Безопасность" at 390px.
    // The first pass therefore scrolls against fallback-font widths and lands
    // short, leaving the end of the label clipped. `fonts.ready` has already
    // resolved on every later navigation, so this costs nothing after the
    // first paint.
    void document.fonts.ready.then(reveal)

    return () => {
      cancelled = true
    }
  }, [selectedKey])

  return (
    // One pane on the canvas. The rule below the header is intra-pane, marking
    // the boundary between the fixed title and the region that scrolls under
    // it; the seam against the nav rail is the gutter, not a border.
    <AppPane>
      {/* 64px and a hairline — the shared pane-header contract. The inset
          matches the column below it, so the title and the fields share one
          axis instead of the title floating 16px inside them. */}
      <header className="border-border/60 flex h-16 shrink-0 items-center border-b">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-8">
          <h1 className="truncate text-base font-semibold">
            {m.account_settings_title()}
          </h1>
        </div>
      </header>

      {/* The pane owns the scroll edge-to-edge; the column inside it owns the
          measure, so the scrollbar rides the pane rather than the text.

          `px-4 sm:px-8` is the settings-column inset from DESIGN.md, and it is
          load-bearing rather than cosmetic: without it a phone renders every
          field flush against both screen edges, and the tab row's `-mx-4`
          bleed has nothing to bleed out of. `pb-8` is what the last row scrolls
          to, so it does not end against the pane's own edge. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pb-8 sm:px-8">
          {/*
            One nav for both breakpoints. TabList lays its tabs out in a row but
            does not scroll them: at 390px the Russian labels need 446px in a
            358px column, so "Безопасность" was clipped off the screen with no
            way to reach it. The scroll container is ours.

            This has now been lost twice — most recently to a mangled class
            string (`-mx-4px-4`) that dropped the overflow and both insets in
            one token, which re-broke a shipped fix without failing anything.
            `settings-shell-mobile.test.ts` pins it.

            Without `overflow-x-auto` here the overflow lands on the pane's own
            `overflow-y-auto` above, which per CSS scrolls sideways too: reaching
            the last tab panned the entire settings page 71px, heading and form
            fields going with it.

            `-mx-4 px-4` lets the row bleed to the pane edges while the first
            tab keeps the page's own inset. The trailing inset is not
            recoverable: browsers leave a scroll container's end padding out of
            the scroll extent, so the last tab ends flush with the edge once
            the row is scrolled fully right. A trailing spacer does not restore
            it either — measured, not assumed.

            `scroll-px-*` matches the padding, so a tab revealed by keyboard
            movement or by the effect below keeps that inset wherever there is
            scroll room left to give it.

            The 44px floor applies only to coarse pointers: a thumb needs it, a
            mouse does not, and raising it everywhere would coarsen Astryx's own
            32px density on the desktop the app is mostly used on.
          */}
          <div
            ref={tabScrollRef}
            className="-mx-4 scroll-px-4 overflow-x-auto px-4 pt-6 pointer-coarse:[&_button]:min-h-11 sm:-mx-8 sm:scroll-px-8 sm:px-8"
          >
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
