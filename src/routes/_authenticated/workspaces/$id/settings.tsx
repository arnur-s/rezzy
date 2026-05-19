import { useWorkspace } from '@/features/workspaces/hooks/use-workspaces'
import { workspaceCrumbs } from '@/lib/breadcrumbs'
import { m } from '@/paraglide/messages'
import { Tabs } from '@heroui/react'
import {
  Outlet,
  createFileRoute,
  useNavigate,
  useParams,
  useRouterState,
} from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { MailIcon, PlugIcon, UsersIcon } from 'lucide-react'

type SettingsNavItem = {
  key: 'general' | 'channels' | 'members'
  to:
    | '/workspaces/$id/settings'
    | '/workspaces/$id/settings/channels'
    | '/workspaces/$id/settings/members'
  icon: LucideIcon
  label: string
}

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
      icon: MailIcon,
      label: m.workspace_settings_general_label(),
    },
    {
      key: 'channels',
      to: '/workspaces/$id/settings/channels',
      icon: PlugIcon,
      label: m.workspace_settings_channels_label(),
    },
    {
      key: 'members',
      to: '/workspaces/$id/settings/members',
      icon: UsersIcon,
      label: m.workspace_settings_members_label(),
    },
  ]

  let selectedKey: SettingsNavItem['key'] = 'general'
  for (const item of navItems) {
    const fullPath = item.to.replace('$id', workspaceId).replace(/\/$/, '')
    if (pathname === fullPath || pathname === `${fullPath}/`) {
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
    <div className="flex h-full w-full flex-col overflow-y-auto">
      <header className="border-b border-border/60 px-4 py-6 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {m.workspace_settings_kicker()}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {workspaceQuery.data?.name ?? m.workspace_settings_loading_title()}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {m.workspace_settings_description()}
        </p>
      </header>

      <div className="container px-4 py-6 sm:px-8 md:flex-row md:gap-10 md:py-10">
        <Tabs
          variant="secondary"
          selectedKey={selectedKey}
          onSelectionChange={(key) => handleSectionChange(key as string)}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Options">
              <Tabs.Tab id="general">
                {m.workspace_settings_general_label()}
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="channels">
                {m.workspace_settings_channels_label()}
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="members">
                {m.workspace_settings_members_label()}
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="general">
            <Outlet />
          </Tabs.Panel>
          <Tabs.Panel id="channels">
            <Outlet />
          </Tabs.Panel>
          <Tabs.Panel id="members">
            <Outlet />
          </Tabs.Panel>
        </Tabs>
      </div>

      {/* <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-8 md:flex-row md:gap-10 md:py-10">
        <nav className="md:w-56 md:shrink-0">
          <ListBox
            aria-label={m.workspace_settings_sections_nav_aria_label()}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([selectedKey])}
            onSelectionChange={handleSectionChange}
            className="flex gap-1 overflow-x-auto md:flex-col md:gap-0.5"
          >
            {navItems.map((item) => {
              const Icon = item.icon

              return (
                <ListBox.Item
                  key={item.key}
                  id={item.key}
                  textValue={item.label}
                  className="aria-selected:bg-primary/10 aria-selected:text-primary"
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </ListBox.Item>
              )
            })}
          </ListBox>
        </nav>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div> */}
    </div>
  )
}
