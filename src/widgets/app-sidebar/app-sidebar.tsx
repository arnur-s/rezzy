import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  sidebarMenuButtonClasses,
} from '@/components/sidebar'
import { CreateWorkspaceModal } from '@/features/workspaces/components/create-workspace-modal'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import type { Workspace } from '@/features/workspaces/types'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import {
  Disclosure,
  Dropdown,
  Label,
  toast,
} from '@heroui/react'
import { cn } from '@heroui/styles'
import type { User } from '@supabase/supabase-js'
import { Link, useNavigate, useParams, useRouterState } from '@tanstack/react-router'
import {
  BarChart3,
  CheckIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  CircleHelpIcon,
  InboxIcon,
  LayoutDashboard,
  LogOutIcon,
  Plug,
  PlusIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

const HELP_DOCS_URL = 'https://heroui.com' as const

export function AppSidebar() {
  const { user } = useAuth()
  if (!user) return null
  return <AuthenticatedAppSidebar user={user} />
}

function AuthenticatedAppSidebar({ user }: { user: User }) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false)

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const params = useParams({ strict: false })
  const currentWorkspaceId = params.id

  const workspacesQuery = useWorkspaces(user.id)

  const currentWorkspace = useMemo(
    () =>
      workspacesQuery.data?.find((w) => w.id === currentWorkspaceId) ??
      workspacesQuery.data?.[0],
    [workspacesQuery.data, currentWorkspaceId],
  )

  async function handleSignOut() {
    try {
      setIsSigningOut(true)
      await signOut()
      await navigate({ to: '/sign-in' })
    } catch (error) {
      setIsSigningOut(false)
      toast.danger(m.app_sidebar_logout_error(), {
        description: getErrorMessage(error),
      })
    }
  }

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-sidebar-border/60 gap-0 border-b p-2">
          <Link
            to="/"
            aria-label={m.app_sidebar_home_label()}
            className={cn(
              'ring-sidebar-ring flex items-center gap-3 rounded-md px-1 py-2 outline-none transition-colors',
              'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              'focus-visible:ring-2',
            )}
          >
            <span className="bg-accent flex size-6 shrink-0 items-center justify-center rounded-md">
              <span className="text-sm font-bold text-white">
                {m.app_sidebar_brand_label().charAt(0)}
              </span>
            </span>
            <span
              className="text-foreground group-data-[collapsible=icon]:hidden text-sm font-semibold"
              data-sidebar="label"
            >
              {m.app_sidebar_brand_label()}
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <WorkspaceSwitcher
                    currentWorkspace={currentWorkspace}
                    workspaces={workspacesQuery.data ?? []}
                    isLoading={workspacesQuery.isPending}
                    isError={workspacesQuery.isError}
                    onCreateWorkspace={() => setIsCreateWorkspaceOpen(true)}
                    onSelect={(workspace) =>
                      navigate({
                        to: '/workspaces/$id/inbox',
                        params: { id: workspace.id },
                      })
                    }
                  />
                </SidebarMenuItem>
              </SidebarMenu>

              <div className="group-data-[collapsible=icon]:mx-1 mx-2 my-1 h-px bg-border/60" />

              {currentWorkspace && (
                <WorkspaceSidebarNav
                  workspaceId={currentWorkspace.id}
                  pathname={pathname}
                />
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter aria-label={m.app_sidebar_footer_actions_aria_label()}>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={m.app_sidebar_footer_help_label()}
              >
                <a
                  href={HELP_DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-2"
                >
                  <CircleHelpIcon className="size-4 shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden truncate">
                    {m.app_sidebar_footer_help_label()}
                  </span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={m.app_sidebar_logout()}
                disabled={isSigningOut}
                onClick={() => void handleSignOut()}
              >
                <LogOutIcon className="size-4 shrink-0" />
                <span className="group-data-[collapsible=icon]:hidden truncate">
                  {m.app_sidebar_logout()}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceOpen}
        onOpenChange={setIsCreateWorkspaceOpen}
      />
    </>
  )
}

function isOperationsPath(pathname: string, workspaceId: string) {
  const prefix = `/workspaces/${workspaceId}/`
  return (
    pathname.startsWith(`${prefix}inbox`) ||
    pathname.startsWith(`${prefix}contacts`) ||
    pathname.startsWith(`${prefix}settings/channels`)
  )
}

function isWorkspaceSettingsPath(pathname: string, workspaceId: string) {
  const base = `/workspaces/${workspaceId}/settings`
  if (!pathname.startsWith(base)) {
    return false
  }
  return !pathname.includes('/settings/channels')
}

function WorkspaceSidebarNav({
  workspaceId,
  pathname,
}: {
  workspaceId: string
  pathname: string
}) {
  const operationsOpen = isOperationsPath(pathname, workspaceId)

  const overviewPath = `/workspaces/${workspaceId}`
  const isDashboardActive =
    pathname === overviewPath || pathname === `${overviewPath}/`

  const isInboxActive =
    pathname === `${overviewPath}/inbox` ||
    pathname.startsWith(`${overviewPath}/inbox/`)

  const isContactsActive =
    pathname === `${overviewPath}/contacts` ||
    pathname.startsWith(`${overviewPath}/contacts/`)

  const isChannelsActive = pathname.startsWith(
    `${overviewPath}/settings/channels`,
  )

  const isSettingsActive = isWorkspaceSettingsPath(pathname, workspaceId)

  const disclosureKey = `ops-${workspaceId}-${operationsOpen ? 'x' : 'y'}`

  return (
    <SidebarMenu aria-label={m.app_sidebar_workspace_nav_aria_label()}>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isDashboardActive}
          tooltip={m.app_sidebar_dashboard_label()}
        >
          <Link
            to="/workspaces/$id"
            params={{ id: workspaceId }}
            aria-current={isDashboardActive ? 'page' : undefined}
            className="flex w-full items-center gap-2"
          >
            <LayoutDashboard className="size-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden truncate">
              {m.app_sidebar_dashboard_label()}
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <Disclosure
          key={disclosureKey}
          defaultExpanded={operationsOpen}
          className="w-full"
        >
          <Disclosure.Heading>
            <Disclosure.Trigger
              className={cn(
                sidebarMenuButtonClasses({ size: 'default' }),
                'text-sidebar-foreground w-full justify-between font-medium',
                operationsOpen &&
                  'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <BarChart3 className="size-4 shrink-0" />
                <span className="group-data-[collapsible=icon]:hidden truncate">
                  {m.app_sidebar_operations_group_label()}
                </span>
              </span>
              <Disclosure.Indicator>
                <ChevronRightIcon className="text-muted-foreground size-4 shrink-0 transition-transform data-[expanded=true]:rotate-90" />
              </Disclosure.Indicator>
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="p-0">
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isInboxActive}
                    size="md"
                  >
                    <Link
                      to="/workspaces/$id/inbox"
                      params={{ id: workspaceId }}
                      aria-current={isInboxActive ? 'page' : undefined}
                    >
                      <InboxIcon className="size-4 shrink-0" />
                      <span className="truncate">{m.app_sidebar_inbox_label()}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isContactsActive}
                    size="md"
                  >
                    <Link
                      to="/workspaces/$id/contacts"
                      params={{ id: workspaceId }}
                      aria-current={isContactsActive ? 'page' : undefined}
                    >
                      <UsersIcon className="size-4 shrink-0" />
                      <span className="truncate">
                        {m.app_sidebar_contacts_label()}
                      </span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isChannelsActive}
                    size="md"
                  >
                    <Link
                      to="/workspaces/$id/settings/channels"
                      params={{ id: workspaceId }}
                      aria-current={isChannelsActive ? 'page' : undefined}
                    >
                      <Plug className="size-4 shrink-0" />
                      <span className="truncate">
                        {m.app_sidebar_channels_nav_label()}
                      </span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isSettingsActive}
          tooltip={m.common_settings()}
        >
          <Link
            to="/workspaces/$id/settings"
            params={{ id: workspaceId }}
            aria-current={isSettingsActive ? 'page' : undefined}
            className="flex w-full items-center gap-2"
          >
            <SettingsIcon className="size-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden truncate">
              {m.common_settings()}
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function WorkspaceSwitcher({
  currentWorkspace,
  workspaces,
  isLoading,
  isError,
  onSelect,
  onCreateWorkspace,
}: {
  currentWorkspace: Workspace | undefined
  workspaces: Array<Workspace>
  isLoading: boolean
  isError: boolean
  onSelect: (workspace: Workspace) => void
  onCreateWorkspace: () => void
}) {
  if (isLoading) {
    return <SidebarMenuSkeleton showIcon />
  }

  if (isError) {
    return (
      <p className="text-danger group-data-[collapsible=icon]:hidden rounded-md bg-danger/5 px-2 py-2 text-xs">
        {m.workspaces_load_error_title()}
      </p>
    )
  }

  return (
    <div className="group-data-[collapsible=icon]:justify-center flex w-full items-center gap-1 px-1">
      <Dropdown>
        <Dropdown.Trigger
          aria-label={m.app_sidebar_select_workspace_label()}
          className={cn(
            sidebarMenuButtonClasses({ variant: 'default', size: 'default' }),
            'text-sidebar-foreground font-medium',
          )}
        >
          {currentWorkspace ? (
            <WorkspaceMark name={currentWorkspace.name} isActive />
          ) : (
            <span className="bg-muted flex size-5 shrink-0 items-center justify-center rounded-md" />
          )}
          <span
            className={cn(
              'group-data-[collapsible=icon]:hidden min-w-0 flex-1 truncate text-left text-sm',
              !currentWorkspace && 'text-muted-foreground',
            )}
          >
            {currentWorkspace
              ? currentWorkspace.name
              : m.app_sidebar_select_workspace_label()}
          </span>
          <ChevronsUpDownIcon className="text-muted-foreground group-data-[collapsible=icon]:hidden ml-auto size-3.5 shrink-0" />
        </Dropdown.Trigger>

        <Dropdown.Popover className="min-w-56">
          <Dropdown.Menu
            onAction={(key) => {
              if (key === 'create') {
                onCreateWorkspace()
                return
              }
              const workspace = workspaces.find((w) => w.id === key)
              if (workspace) onSelect(workspace)
            }}
          >
            {workspaces.map((workspace) => (
              <Dropdown.Item
                key={workspace.id}
                id={workspace.id}
                textValue={workspace.name}
              >
                <WorkspaceMark
                  name={workspace.name}
                  isActive={workspace.id === currentWorkspace?.id}
                />
                <Label className="flex-1">{workspace.name}</Label>
                {workspace.id === currentWorkspace?.id && (
                  <CheckIcon className="text-primary ml-auto size-3.5" />
                )}
              </Dropdown.Item>
            ))}

            <Dropdown.Item id="create" textValue={m.workspaces_create_button()}>
              <PlusIcon className="size-4" />
              <Label>{m.workspaces_create_button()}</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  )
}

function WorkspaceMark({
  name,
  isActive,
}: {
  name: string
  isActive: boolean
}) {
  return (
    <span
      className={`flex size-5 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-primary/10 text-primary'
      }`}
    >
      {name.trim().charAt(0).toUpperCase() || 'W'}
    </span>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : m.common_unknown_error()
}
