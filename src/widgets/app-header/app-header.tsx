import { SidebarTrigger } from '@/components/sidebar'
import {
  getUserDisplayName,
  getUserInitials,
} from '@/features/users/utils/user-display'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import type { Workspace } from '@/features/workspaces/types'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { Avatar, Dropdown, Label } from '@heroui/react'
import { cn } from '@heroui/styles'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { ChevronRightIcon, SettingsIcon, UserRoundIcon } from 'lucide-react'
import { useMemo } from 'react'

type BreadcrumbLink = {
  to: '/workspaces' | '/workspaces/$id' | '/workspaces/$id/settings' | '/workspaces/$id/settings/channels'
  params?: { id: string }
}

type BreadcrumbItem = {
  label: string
  link?: BreadcrumbLink
  current?: boolean
}

function buildBreadcrumbs({
  pathname,
  workspaces,
}: {
  pathname: string
  workspaces: Array<Workspace> | undefined
}): Array<BreadcrumbItem> {
  if (pathname === '/profile') {
    return [{ label: m.app_breadcrumbs_profile(), current: true }]
  }

  if (pathname === '/settings') {
    return [{ label: m.app_breadcrumbs_app_settings(), current: true }]
  }

  if (pathname === '/workspaces' || pathname === '/workspaces/') {
    return [{ label: m.app_breadcrumbs_workspaces(), current: true }]
  }

  const match = pathname.match(/^\/workspaces\/([^/]+)(?:\/(.*))?$/)
  if (!match) {
    return []
  }

  const id = match[1]
  const tail = match[2].replace(/\/$/, '')
  const parts = tail ? tail.split('/').filter(Boolean) : []
  const workspaceName =
    workspaces?.find((w) => w.id === id)?.name ??
    m.app_breadcrumbs_workspace_fallback()

  const crumbs: Array<BreadcrumbItem> = [
    {
      label: m.app_breadcrumbs_workspaces(),
      link: { to: '/workspaces' },
    },
    {
      label: workspaceName,
      link: { to: '/workspaces/$id', params: { id } },
    },
  ]

  if (parts.length === 0) {
    crumbs.push({
      label: m.app_breadcrumbs_dashboard(),
      current: true,
    })
    return crumbs
  }

  if (parts[0] === 'inbox' && parts.length === 1) {
    crumbs.push({ label: m.app_breadcrumbs_inbox(), current: true })
    return crumbs
  }

  if (parts[0] === 'contacts' && parts.length === 1) {
    crumbs.push({ label: m.app_breadcrumbs_contacts(), current: true })
    return crumbs
  }

  if (parts[0] === 'settings') {
    if (parts[1] === 'channels' && parts[2] === 'new') {
      crumbs.push(
        {
          label: m.app_breadcrumbs_workspace_settings(),
          link: { to: '/workspaces/$id/settings', params: { id } },
        },
        {
          label: m.app_breadcrumbs_channels(),
          link: { to: '/workspaces/$id/settings/channels', params: { id } },
        },
        { label: m.app_breadcrumbs_connect_channel(), current: true },
      )
      return crumbs
    }

    if (parts[1] === 'channels' && parts.length === 2) {
      crumbs.push(
        {
          label: m.app_breadcrumbs_workspace_settings(),
          link: { to: '/workspaces/$id/settings', params: { id } },
        },
        { label: m.app_breadcrumbs_channels(), current: true },
      )
      return crumbs
    }

    if (parts[1] === 'members' && parts.length === 2) {
      crumbs.push(
        {
          label: m.app_breadcrumbs_workspace_settings(),
          link: { to: '/workspaces/$id/settings', params: { id } },
        },
        { label: m.app_breadcrumbs_members(), current: true },
      )
      return crumbs
    }

    if (parts.length === 1) {
      crumbs.push({
        label: m.app_breadcrumbs_workspace_settings(),
        current: true,
      })
      return crumbs
    }

    crumbs.push({
      label: m.app_breadcrumbs_workspace_settings(),
      current: true,
    })
    return crumbs
  }

  crumbs.push({
    label: tail || m.app_breadcrumbs_workspace_fallback(),
    current: true,
  })
  return crumbs
}

export function AppHeader({ className }: { className?: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const workspacesQuery = useWorkspaces(user?.id ?? '')

  const items = useMemo(
    () =>
      buildBreadcrumbs({
        pathname,
        workspaces: workspacesQuery.data,
      }),
    [pathname, workspacesQuery.data],
  )

  const displayName = user
    ? getUserDisplayName(user, m.app_sidebar_unknown_user())
    : ''

  return (
    <header
      className={cn(
        'flex shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 p-4 backdrop-blur',
        className,
      )}
    >
      <SidebarTrigger />
      <nav
        aria-label={m.app_breadcrumbs_aria_label()}
        data-slot="breadcrumbs"
        className="text-muted-foreground flex min-w-0 flex-1 items-center gap-1 text-sm"
      >
        <ol className="flex min-w-0 flex-wrap items-center gap-1">
          {items.map((item, index) => {
            const isLast = index === items.length - 1
            return (
              <li key={index} className="flex min-w-0 items-center gap-1">
                {index > 0 ? (
                  <ChevronRightIcon
                    className="size-3.5 shrink-0"
                    aria-hidden
                  />
                ) : null}
                {item.link && !isLast ? (
                  <Link
                    to={item.link.to}
                    params={item.link.params}
                    className="hover:text-foreground min-w-0 truncate transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      'min-w-0 truncate',
                      isLast && 'text-foreground font-semibold',
                    )}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
      {user ? (
        <Dropdown>
          <Dropdown.Trigger
            aria-label={m.app_sidebar_user_menu_label()}
            className="ring-offset-background ml-auto shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar color="accent" size="sm" variant="soft">
              <Avatar.Fallback>{getUserInitials(displayName)}</Avatar.Fallback>
            </Avatar>
          </Dropdown.Trigger>
          <Dropdown.Popover className="min-w-48">
            <Dropdown.Menu
              onAction={(key) => {
                if (key === 'profile') {
                  void navigate({ to: '/profile' })
                }
                if (key === 'app-settings') {
                  void navigate({ to: '/settings' })
                }
              }}
            >
              <Dropdown.Item id="profile" textValue={m.app_sidebar_profile()}>
                <UserRoundIcon className="size-4" />
                <Label>{m.app_sidebar_profile()}</Label>
              </Dropdown.Item>
              <Dropdown.Item
                id="app-settings"
                textValue={m.app_sidebar_app_settings_label()}
              >
                <SettingsIcon className="size-4" />
                <Label>{m.app_sidebar_app_settings_label()}</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      ) : null}
    </header>
  )
}
