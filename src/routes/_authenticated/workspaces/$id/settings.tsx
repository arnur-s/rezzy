import { useWorkspace } from '@/features/workspaces/hooks/use-workspaces'
import { m } from '@/paraglide/messages'
import { paneStyle } from '@/components/pane'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import { cn } from '@/lib/cn'
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
    <div className={cn(paneStyle.surface, 'h-full w-full')}>
      {/* Attached to the pane's top edge, above its scroll region. */}
      <header className="border-border/60 shrink-0 border-b py-6">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-8">
          <p className="text-secondary text-xs font-medium">
            {m.workspace_settings_kicker()}
          </p>
          <h1 className="mt-1 text-base font-semibold">
            {workspaceQuery.data?.name ?? m.workspace_settings_loading_title()}
          </h1>
          <p className="text-secondary mt-1 max-w-2xl text-sm">
            {m.workspace_settings_description()}
          </p>
        </div>
      </header>

      <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6 sm:px-8 md:py-8">
        <TabList
          value={selectedKey}
          onChange={(key) => handleSectionChange(key)}
          aria-label={m.workspace_settings_sections_nav_aria_label()}
        >
          {navItems.map((item) => (
            <Tab key={item.key} value={item.key} label={item.label} />
          ))}
        </TabList>
        <div className="pt-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
