import { useWorkspace } from '@/features/workspaces/hooks/use-workspaces'
import { workspaceCrumbs } from '@/lib/breadcrumbs'
import { m } from '@/paraglide/messages'
import { paneStyle } from '@/components/pane'
import { ScrollShadow, Tabs } from '@heroui/react'
import { cn } from '@heroui/styles'
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

const settingsTabIndicatorClassName =
  'dark:bg-foreground/15 dark:ring-1 dark:ring-foreground/10'

export const Route = createFileRoute('/_authenticated/workspaces/$id/settings')(
  {
    component: RouteComponent,
    staticData: {
      crumb: (ctx) => [
        ...workspaceCrumbs(ctx),
        {
          label: m.breadcrumbs_workspace_settings(),
          link: {
            to: '/workspaces/$id/settings',
            params: { id: ctx.params.id },
          },
        },
      ],
    },
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
          <p className="text-muted text-xs font-medium">
            {m.workspace_settings_kicker()}
          </p>
          <h1 className="mt-1 text-base font-semibold">
            {workspaceQuery.data?.name ?? m.workspace_settings_loading_title()}
          </h1>
          <p className="text-muted mt-1 max-w-2xl text-sm">
            {m.workspace_settings_description()}
          </p>
        </div>
      </header>

      <ScrollShadow className="mx-auto w-full max-w-3xl min-h-0 flex-1 px-4 py-6 sm:px-8 md:py-8">
        <Tabs
          className="w-full"
          selectedKey={selectedKey}
          onSelectionChange={(key) => handleSectionChange(key as string)}
        >
          <Tabs.ListContainer>
            <Tabs.List
              aria-label={m.workspace_settings_sections_nav_aria_label()}
            >
              {navItems.map((item) => (
                <Tabs.Tab key={item.key} id={item.key}>
                  {item.label}
                  <Tabs.Indicator className={settingsTabIndicatorClassName} />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel className="pt-8" id="general">
            <Outlet />
          </Tabs.Panel>
          <Tabs.Panel className="pt-8" id="channels">
            <Outlet />
          </Tabs.Panel>
          <Tabs.Panel className="pt-8" id="members">
            <Outlet />
          </Tabs.Panel>
        </Tabs>
      </ScrollShadow>
    </div>
  )
}
