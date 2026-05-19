import { m } from '@/paraglide/messages'

export type CrumbLink = {
  to:
    | '/workspaces'
    | '/workspaces/$id'
    | '/workspaces/$id/settings'
    | '/workspaces/$id/settings/channels'
  params?: { id: string }
}

export type CrumbDescriptor = {
  label: string
  link?: CrumbLink
}

export type CrumbContext = {
  params: Record<string, string>
  workspaceName?: string
}

export type CrumbFn = (
  ctx: CrumbContext,
) => CrumbDescriptor | Array<CrumbDescriptor> | null

export function workspaceCrumbs(ctx: CrumbContext): Array<CrumbDescriptor> {
  const id = ctx.params.id
  return [
    { label: m.breadcrumbs_workspaces(), link: { to: '/workspaces' } },
    {
      label: ctx.workspaceName ?? m.breadcrumbs_workspace_fallback(),
      link: id ? { to: '/workspaces/$id', params: { id } } : undefined,
    },
  ]
}

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    crumb?: CrumbFn
  }
}
