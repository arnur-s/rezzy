import { CreateWorkspaceModal } from '@/features/workspaces/components/create-workspace-modal'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import type { Workspace } from '@/features/workspaces/types'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import {
  Disclosure,
  Drawer,
  Dropdown,
  Label,
  ScrollShadow,
  Tooltip,
  toast,
} from '@heroui/react'
import { cn } from '@heroui/styles'
import type { User } from '@supabase/supabase-js'
import { Link, useNavigate, useParams, useRouterState } from '@tanstack/react-router'
import {
  BarChart3,
  CheckIcon,
  ChevronDownIcon,
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
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

const HELP_DOCS_URL = 'https://heroui.com' as const

const navItemBase =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring'
const navItemInactive =
  'text-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
const navItemActive = 'bg-sidebar-accent text-sidebar-accent-foreground'
const navItemCollapsed = 'justify-center gap-0 px-0'

const subItemBase =
  'flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring'
const subItemInactive =
  'text-foreground/50 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
const subItemActive = 'bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium'

export interface AppSidebarProps {
  isCollapsed: boolean
  isMobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
}

export function AppSidebar({
  isCollapsed,
  isMobileOpen,
  onMobileOpenChange,
}: AppSidebarProps) {
  const { user } = useAuth()
  if (!user) return null

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="bg-sidebar border-sidebar-border/60 hidden shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200 ease-out md:flex"
        style={{ width: isCollapsed ? '64px' : '260px' }}
        data-collapsed={isCollapsed || undefined}
      >
        <SidebarBody user={user} isCollapsed={isCollapsed} />
      </aside>

      {/* Mobile drawer — always full width */}
      <Drawer isOpen={isMobileOpen} onOpenChange={onMobileOpenChange}>
        <Drawer.Backdrop />
        <Drawer.Content placement="left">
          <Drawer.Dialog className="bg-sidebar h-full w-[260px] rounded-none">
            <SidebarBody
              user={user}
              isCollapsed={false}
              onNavigate={() => onMobileOpenChange(false)}
            />
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer>
    </>
  )
}

function SidebarBody({
  user,
  isCollapsed,
  onNavigate,
}: {
  user: User
  isCollapsed: boolean
  onNavigate?: () => void
}) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false)

  const pathname = useRouterState({ select: (s) => s.location.pathname })
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
      toast.danger(m.app_sidebar_logout_error(), { description: getErrorMessage(error) })
    }
  }

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Brand */}
        <div className={cn('border-sidebar-border/60 border-b', isCollapsed ? 'p-3' : 'p-4')}>
          <Link
            to="/"
            aria-label={m.app_sidebar_home_label()}
            className={cn(
              'flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              isCollapsed ? 'justify-center' : 'gap-2.5',
            )}
            onClick={onNavigate}
          >
            <span className="bg-accent flex size-8 shrink-0 items-center justify-center rounded-lg">
              <span className="text-sm font-bold text-white">
                {m.app_sidebar_brand_label().charAt(0)}
              </span>
            </span>
            {!isCollapsed && (
              <span className="text-foreground truncate text-sm font-semibold">
                {m.app_sidebar_brand_label()}
              </span>
            )}
          </Link>
        </div>

        {/* Workspace switcher */}
        <div className={cn('pt-3', isCollapsed ? 'px-2' : 'px-3')}>
          <WorkspaceSwitcher
            isCollapsed={isCollapsed}
            currentWorkspace={currentWorkspace}
            workspaces={workspacesQuery.data ?? []}
            isLoading={workspacesQuery.isPending}
            isError={workspacesQuery.isError}
            onCreateWorkspace={() => setIsCreateWorkspaceOpen(true)}
            onSelect={(workspace) => {
              onNavigate?.()
              void navigate({ to: '/workspaces/$id/inbox', params: { id: workspace.id } })
            }}
          />
        </div>

        <div className="bg-border/60 mx-3 my-2 h-px" />

        {/* Nav */}
        <ScrollShadow className={cn('flex-1 py-1', isCollapsed ? 'px-2' : 'px-3')}>
          {currentWorkspace && (
            <WorkspaceNav
              workspaceId={currentWorkspace.id}
              pathname={pathname}
              isCollapsed={isCollapsed}
              onNavigate={onNavigate}
            />
          )}
        </ScrollShadow>

        {/* Footer */}
        <div
          className={cn(
            'border-sidebar-border/60 space-y-0.5 border-t py-3',
            isCollapsed ? 'px-2' : 'px-3',
          )}
        >
          <CollapsibleNavTooltip
            isCollapsed={isCollapsed}
            label={m.app_sidebar_footer_help_label()}
          >
            <a
              href={HELP_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={m.app_sidebar_footer_help_label()}
              className={cn(navItemBase, navItemInactive, isCollapsed && navItemCollapsed)}
            >
              <CircleHelpIcon className="size-4 shrink-0" />
              {!isCollapsed && (
                <span className="truncate">{m.app_sidebar_footer_help_label()}</span>
              )}
            </a>
          </CollapsibleNavTooltip>
          <CollapsibleNavTooltip
            isCollapsed={isCollapsed}
            label={m.app_sidebar_logout()}
          >
            <button
              type="button"
              disabled={isSigningOut}
              onClick={() => void handleSignOut()}
              aria-label={m.app_sidebar_logout()}
              className={cn(
                navItemBase,
                navItemInactive,
                isCollapsed && navItemCollapsed,
                'disabled:pointer-events-none disabled:opacity-50',
              )}
            >
              <LogOutIcon className="size-4 shrink-0" />
              {!isCollapsed && (
                <span className="truncate">{m.app_sidebar_logout()}</span>
              )}
            </button>
          </CollapsibleNavTooltip>
        </div>
      </div>

      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceOpen}
        onOpenChange={setIsCreateWorkspaceOpen}
      />
    </>
  )
}

function WorkspaceNav({
  workspaceId,
  pathname,
  isCollapsed,
  onNavigate,
}: {
  workspaceId: string
  pathname: string
  isCollapsed: boolean
  onNavigate?: () => void
}) {
  const overviewPath = `/workspaces/${workspaceId}`
  const operationsOpen = isOperationsPath(pathname, workspaceId)

  const isDashboardActive = pathname === overviewPath || pathname === `${overviewPath}/`
  const isInboxActive =
    pathname === `${overviewPath}/inbox` || pathname.startsWith(`${overviewPath}/inbox/`)
  const isContactsActive =
    pathname === `${overviewPath}/contacts` ||
    pathname.startsWith(`${overviewPath}/contacts/`)
  const isChannelsActive = pathname.startsWith(`${overviewPath}/settings/channels`)
  const isSettingsActive = isWorkspaceSettingsPath(pathname, workspaceId)

  return (
    <nav
      aria-label={m.app_sidebar_workspace_nav_aria_label()}
      className="space-y-0.5"
    >
      {/* Dashboard */}
      <CollapsibleNavTooltip
        isCollapsed={isCollapsed}
        label={m.app_sidebar_dashboard_label()}
      >
        <Link
          to="/workspaces/$id"
          params={{ id: workspaceId }}
          aria-label={m.app_sidebar_dashboard_label()}
          aria-current={isDashboardActive ? 'page' : undefined}
          className={cn(
            navItemBase,
            isDashboardActive ? navItemActive : navItemInactive,
            isCollapsed && navItemCollapsed,
          )}
          onClick={onNavigate}
        >
          <LayoutDashboard className="size-4 shrink-0" />
          {!isCollapsed && (
            <span className="truncate">{m.app_sidebar_dashboard_label()}</span>
          )}
        </Link>
      </CollapsibleNavTooltip>

      {/* Operations group */}
      {isCollapsed ? (
        <CollapsibleNavTooltip
          isCollapsed
          label={m.app_sidebar_operations_group_label()}
        >
          <Link
            to="/workspaces/$id/inbox"
            params={{ id: workspaceId }}
            aria-label={m.app_sidebar_operations_group_label()}
            aria-current={operationsOpen ? 'page' : undefined}
            className={cn(
              navItemBase,
              operationsOpen ? navItemActive : navItemInactive,
              navItemCollapsed,
            )}
            onClick={onNavigate}
          >
            <BarChart3 className="size-4 shrink-0" />
          </Link>
        </CollapsibleNavTooltip>
      ) : (
        <Disclosure defaultExpanded={operationsOpen}>
          <Disclosure.Heading>
            <Disclosure.Trigger
              className={cn(
                navItemBase,
                'w-full justify-between',
                operationsOpen ? navItemActive : navItemInactive,
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                <BarChart3 className="size-4 shrink-0" />
                <span className="truncate">{m.app_sidebar_operations_group_label()}</span>
              </span>
              <Disclosure.Indicator>
                <ChevronDownIcon className="text-foreground/40 size-4 shrink-0 transition-transform data-[expanded=true]:rotate-180" />
              </Disclosure.Indicator>
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="p-0 pt-0.5">
              <div className="border-border/60 ml-3 space-y-0.5 border-l pl-3">
                <Link
                  to="/workspaces/$id/inbox"
                  params={{ id: workspaceId }}
                  aria-current={isInboxActive ? 'page' : undefined}
                  className={cn(subItemBase, isInboxActive ? subItemActive : subItemInactive)}
                  onClick={onNavigate}
                >
                  <InboxIcon className="size-4 shrink-0" />
                  <span className="truncate">{m.app_sidebar_inbox_label()}</span>
                </Link>
                <Link
                  to="/workspaces/$id/contacts"
                  params={{ id: workspaceId }}
                  aria-current={isContactsActive ? 'page' : undefined}
                  className={cn(
                    subItemBase,
                    isContactsActive ? subItemActive : subItemInactive,
                  )}
                  onClick={onNavigate}
                >
                  <UsersIcon className="size-4 shrink-0" />
                  <span className="truncate">{m.app_sidebar_contacts_label()}</span>
                </Link>
                <Link
                  to="/workspaces/$id/settings/channels"
                  params={{ id: workspaceId }}
                  aria-current={isChannelsActive ? 'page' : undefined}
                  className={cn(
                    subItemBase,
                    isChannelsActive ? subItemActive : subItemInactive,
                  )}
                  onClick={onNavigate}
                >
                  <Plug className="size-4 shrink-0" />
                  <span className="truncate">{m.app_sidebar_channels_nav_label()}</span>
                </Link>
              </div>
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      )}

      {/* Settings */}
      <CollapsibleNavTooltip isCollapsed={isCollapsed} label={m.common_settings()}>
        <Link
          to="/workspaces/$id/settings"
          params={{ id: workspaceId }}
          aria-label={m.common_settings()}
          aria-current={isSettingsActive ? 'page' : undefined}
          className={cn(
            navItemBase,
            isSettingsActive ? navItemActive : navItemInactive,
            isCollapsed && navItemCollapsed,
          )}
          onClick={onNavigate}
        >
          <SettingsIcon className="size-4 shrink-0" />
          {!isCollapsed && (
            <>
              <span className="flex-1 truncate">{m.common_settings()}</span>
              <ChevronRightIcon className="text-foreground/30 size-4 shrink-0" />
            </>
          )}
        </Link>
      </CollapsibleNavTooltip>
    </nav>
  )
}

function WorkspaceSwitcher({
  isCollapsed,
  currentWorkspace,
  workspaces,
  isLoading,
  isError,
  onSelect,
  onCreateWorkspace,
}: {
  isCollapsed: boolean
  currentWorkspace: Workspace | undefined
  workspaces: Array<Workspace>
  isLoading: boolean
  isError: boolean
  onSelect: (workspace: Workspace) => void
  onCreateWorkspace: () => void
}) {
  if (isLoading) {
    return (
      <div
        className={cn(
          'bg-sidebar-accent/50 animate-pulse rounded-lg',
          isCollapsed ? 'mx-auto h-9 w-9' : 'h-9 w-full',
        )}
      />
    )
  }

  if (isError) {
    if (isCollapsed) {
      return (
        <div className="bg-danger/10 text-danger mx-auto flex size-9 items-center justify-center rounded-lg text-xs font-semibold">
          !
        </div>
      )
    }
    return (
      <p className="text-danger bg-danger/5 rounded-lg px-3 py-2 text-xs">
        {m.workspaces_load_error_title()}
      </p>
    )
  }

  return (
    <Dropdown>
      <CollapsibleNavTooltip
        isCollapsed={isCollapsed}
        label={currentWorkspace?.name ?? m.app_sidebar_select_workspace_label()}
      >
        <Dropdown.Trigger
          aria-label={m.app_sidebar_select_workspace_label()}
          className={cn(
            navItemBase,
            navItemInactive,
            isCollapsed ? navItemCollapsed : 'justify-between',
          )}
        >
          {isCollapsed ? (
            currentWorkspace ? (
              <WorkspaceMark name={currentWorkspace.name} isActive />
            ) : (
              <span className="bg-muted size-5 shrink-0 rounded-md" />
            )
          ) : (
            <>
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                {currentWorkspace ? (
                  <WorkspaceMark name={currentWorkspace.name} isActive />
                ) : (
                  <span className="bg-muted size-5 shrink-0 rounded-md" />
                )}
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-left',
                    !currentWorkspace && 'text-muted-foreground',
                  )}
                >
                  {currentWorkspace
                    ? currentWorkspace.name
                    : m.app_sidebar_select_workspace_label()}
                </span>
              </span>
              <ChevronsUpDownIcon className="text-foreground/40 size-3.5 shrink-0" />
            </>
          )}
        </Dropdown.Trigger>
      </CollapsibleNavTooltip>

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
            <Dropdown.Item key={workspace.id} id={workspace.id} textValue={workspace.name}>
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
  )
}

function WorkspaceMark({ name, isActive }: { name: string; isActive: boolean }) {
  return (
    <span
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold',
        isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
      )}
    >
      {name.trim().charAt(0).toUpperCase() || 'W'}
    </span>
  )
}

function CollapsibleNavTooltip({
  isCollapsed,
  label,
  children,
}: {
  isCollapsed: boolean
  label: string
  children: ReactNode
}) {
  if (!isCollapsed) return <>{children}</>
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger className="block w-full">{children}</Tooltip.Trigger>
      <Tooltip.Content placement="right">{label}</Tooltip.Content>
    </Tooltip>
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
  if (!pathname.startsWith(base)) return false
  return !pathname.includes('/settings/channels')
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : m.common_unknown_error()
}
