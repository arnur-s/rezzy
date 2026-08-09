import type { SettingsShellSection } from '@/components/settings-shell'
import { SettingsShell } from '@/components/settings-shell'
import { useWorkspace } from '@/features/workspaces/hooks/use-workspaces'
import { m } from '@/paraglide/messages'
import { Outlet, createFileRoute, useParams } from '@tanstack/react-router'

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

  const workspaceQuery = useWorkspace(workspaceId)

  const basePath = `/workspaces/${workspaceId}/settings`
  const sections: Array<SettingsShellSection> = [
    {
      key: 'general',
      path: basePath,
      label: m.workspace_settings_general_label(),
    },
    {
      key: 'channels',
      path: `${basePath}/channels`,
      label: m.workspace_settings_channels_label(),
    },
    {
      key: 'members',
      path: `${basePath}/members`,
      label: m.workspace_settings_members_label(),
    },
  ]

  return (
    <SettingsShell
      // The name is what this pane is about, so it holds the title slot and the
      // fallback carries the loading state rather than a skeleton pushing the
      // header around.
      title={workspaceQuery.data?.name ?? m.workspace_settings_loading_title()}
      kicker={m.workspace_settings_kicker()}
      navLabel={m.workspace_settings_sections_nav_aria_label()}
      sections={sections}
    >
      <Outlet />
    </SettingsShell>
  )
}
