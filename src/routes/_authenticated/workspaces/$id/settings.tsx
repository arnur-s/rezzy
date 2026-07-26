import { useWorkspace } from '@/features/workspaces/hooks/use-workspaces'
import { m } from '@/paraglide/messages'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import {
  Outlet,
  createFileRoute,
  useNavigate,
  useParams,
  useRouterState,
} from '@tanstack/react-router'

type SettingsNavItem = {
  key: 'general' | 'channels' | 'members'
  to:
    | '/workspaces/$id/settings'
    | '/workspaces/$id/settings/channels'
    | '/workspaces/$id/settings/members'
  label: string
}


export const Route = createFileRoute('/_authenticated/workspaces/$id/settings')(
  {
    component: RouteComponent,
  },
)

function RouteComponent() {
  const params = useParams({
    from: '/_authenticated/workspaces/$id/settings',
  })
  const workspaceId = params.id
  const navigate = useNavigate()

  const workspaceQuery = useWorkspace(workspaceId)

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const navItems: Array<SettingsNavItem> = [
    {
      key: 'general',
      to: '/workspaces/$id/settings',
      label: m.workspace_settings_general_label(),
    },
    {
      key: 'channels',
      to: '/workspaces/$id/settings/channels',
      label: m.workspace_settings_channels_label(),
    },
    {
      key: 'members',
      to: '/workspaces/$id/settings/members',
      label: m.workspace_settings_members_label(),
    },
  ]

  let selectedKey: SettingsNavItem['key'] = 'general'
  for (const item of [...navItems].reverse()) {
    const fullPath = item.to.replace('$id', workspaceId).replace(/\/$/, '')
    if (pathname === fullPath || pathname.startsWith(`${fullPath}/`)) {
      selectedKey = item.key
      break
    }
  }

  const handleSectionChange = (key: string) => {
    const basePath = `/workspaces/${workspaceId}/settings`
    const to = key === 'general' ? basePath : `${basePath}/${key}`
    navigate({
      to,
      params: { id: workspaceId },
    })
  }

  return (
    // Flat and full-bleed, like every other pane: AppShell's `section` variant
    // already draws the seam against the rail, and the theme resolves surface
    // to the same value as the canvas, so a fill here would paint nothing while
    // a radius would notch a corner out of the content area.
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden">
      {/* 64px and a hairline — the shared pane-header contract, matching the
          conversation list, the thread, and the contact panel. */}
      <header className="border-border/60 flex h-16 shrink-0 items-center border-b">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-8">
          <h1 className="truncate text-base font-semibold">
            {workspaceQuery.data?.name ?? m.workspace_settings_loading_title()}
          </h1>
        </div>
      </header>

      {/* The pane owns the scroll edge-to-edge; the column inside it owns the
          measure, so the scrollbar rides the pane rather than the text. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 md:py-8">
          <p className="text-secondary text-xs font-medium">
            {m.workspace_settings_kicker()}
          </p>
          <p className="text-secondary mt-1 max-w-2xl text-sm">
            {m.workspace_settings_description()}
          </p>

          <div className="pt-6">
            <TabList
              value={selectedKey}
              onChange={(key) => handleSectionChange(key)}
              aria-label={m.workspace_settings_sections_nav_aria_label()}
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
    </div>
  )
}
