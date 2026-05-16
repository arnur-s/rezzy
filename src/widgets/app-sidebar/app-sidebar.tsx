import { NumericUnreadChip } from '@/components/numeric-unread-chip'
import type { Workspace } from '@/entities/workspace'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { CreateWorkspaceModal } from '@/features/workspaces/components/create-workspace-modal'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import {
  Button,
  Drawer,
  Label,
  ListBox,
  ScrollShadow,
  Select,
  Separator,
  Tooltip,
  toast,
} from '@heroui/react'
import { cn } from '@heroui/styles'
import type { User } from '@supabase/supabase-js'
import {
  Link,
  useNavigate,
  useParams,
  useRouterState,
} from '@tanstack/react-router'
import {
  HomeIcon,
  LayoutDashboard,
  Loader2Icon,
  LogOutIcon,
  MessageCircleIcon,
  PlusIcon,
  SettingsIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

const navItemBase =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring'
const navItemInactive =
  'text-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
const navItemActive = 'bg-sidebar-accent text-sidebar-accent-foreground'
const navLabel = 'min-w-0 truncate transition-opacity duration-150 ease-out'
const navLabelHidden = 'pointer-events-none opacity-0'

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
      <aside
        className="hidden shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-out md:flex border-r border-border/60"
        style={{ width: isCollapsed ? '64px' : '260px' }}
        data-collapsed={isCollapsed || undefined}
      >
        <SidebarBody user={user} isCollapsed={isCollapsed} />
      </aside>

      <Drawer.Backdrop
        variant="blur"
        isOpen={isMobileOpen}
        onOpenChange={onMobileOpenChange}
      >
        <Drawer.Content placement="left">
          <Drawer.Dialog
            className="bg-sidebar h-full w-[260px] rounded-none p-0"
            aria-label={m.app_sidebar_workspace_nav_aria_label()}
          >
            <Drawer.Body>
              <SidebarBody
                user={user}
                isCollapsed={false}
                onNavigate={() => onMobileOpenChange(false)}
              />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
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
  const isHomeRoute = pathname === '/'

  const workspacesQuery = useWorkspaces(user.id)

  const currentWorkspace = useMemo(
    () =>
      isHomeRoute
        ? undefined
        : (workspacesQuery.data?.find((w) => w.id === currentWorkspaceId) ??
          workspacesQuery.data?.[0]),
    [workspacesQuery.data, currentWorkspaceId, isHomeRoute],
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
      <div className="flex h-full flex-col">
        {/* Brand */}
        <div className="flex h-[64px] shrink-0 items-center px-4 border-b border-border/60">
          <Link
            to="/"
            aria-label={m.app_sidebar_home_label()}
            className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            onClick={onNavigate}
          >
            <span className="bg-accent flex size-8 shrink-0 items-center justify-center rounded-lg">
              <span className="text-lg font-bold text-white">
                {m.app_sidebar_brand_label().charAt(0)}
              </span>
            </span>
            <span
              className={cn(
                'text-foreground truncate text-sm font-semibold transition-opacity duration-150 ease-out',
                isCollapsed && 'pointer-events-none opacity-0',
              )}
              aria-hidden={isCollapsed || undefined}
            >
              {m.app_sidebar_brand_label()}
            </span>
          </Link>
        </div>

        {/* Workspace switcher (workspace-scoped routes only) */}
        {!isHomeRoute && (
          <>
            <div className="h-[64px] flex items-center px-3">
              <WorkspaceSwitcher
                isCollapsed={isCollapsed}
                currentWorkspace={currentWorkspace}
                workspaces={workspacesQuery.data ?? []}
                isLoading={workspacesQuery.isPending}
                isError={workspacesQuery.isError}
                onCreateWorkspace={() => setIsCreateWorkspaceOpen(true)}
                onSelect={(workspace) => {
                  onNavigate?.()
                  void navigate({
                    to: '/workspaces/$id/inbox',
                    params: { id: workspace.id },
                  })
                }}
              />
            </div>
          </>
        )}

        {/* Nav */}
        <ScrollShadow className="flex-1 px-3 py-1">
          {isHomeRoute ? (
            <HomeNav
              workspaces={workspacesQuery.data ?? []}
              isCollapsed={isCollapsed}
              onNavigate={onNavigate}
            />
          ) : currentWorkspace ? (
            <WorkspaceNav
              workspaceId={currentWorkspace.id}
              pathname={pathname}
              isCollapsed={isCollapsed}
              onNavigate={onNavigate}
            />
          ) : null}
        </ScrollShadow>

        {/* Footer */}
        <div className="space-y-0.5 px-3 py-3">
          <CollapsibleNavTooltip
            isCollapsed={isCollapsed}
            label={m.app_sidebar_logout()}
          >
            <Button
              type="button"
              variant="ghost"
              isDisabled={isSigningOut}
              onPress={() => void handleSignOut()}
              aria-label={m.app_sidebar_logout()}
              aria-busy={isSigningOut || undefined}
              className={cn(
                navItemBase,
                navItemInactive,
                'h-auto min-h-0 justify-start font-[inherit] disabled:opacity-50',
              )}
            >
              {isSigningOut ? (
                <Loader2Icon
                  className="size-4 shrink-0 animate-spin"
                  aria-hidden
                />
              ) : (
                <LogOutIcon className="size-4 shrink-0" aria-hidden />
              )}
              <span
                className={cn(navLabel, isCollapsed && navLabelHidden)}
                aria-hidden={isCollapsed || undefined}
              >
                {m.app_sidebar_logout()}
              </span>
            </Button>
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

function HomeNav({
  workspaces,
  isCollapsed,
  onNavigate,
}: {
  workspaces: Array<Workspace>
  isCollapsed: boolean
  onNavigate?: () => void
}) {
  const workspaceIds = useMemo(() => workspaces.map((w) => w.id), [workspaces])
  const statsQuery = useDashboardStats(workspaceIds)
  const unreadById = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of statsQuery.data?.perWorkspace ?? []) {
      map.set(entry.workspaceId, entry.unread)
    }
    return map
  }, [statsQuery.data])

  return (
    <nav
      aria-label={m.app_sidebar_workspace_nav_aria_label()}
      className="space-y-0.5"
    >
      {/* Home */}
      <CollapsibleNavTooltip
        isCollapsed={isCollapsed}
        label={m.app_sidebar_home_nav_label()}
      >
        <Link
          to="/"
          aria-label={m.app_sidebar_home_nav_label()}
          aria-current="page"
          className={cn(navItemBase, navItemActive)}
          onClick={onNavigate}
        >
          <HomeIcon className="size-4 shrink-0" />
          <span
            className={cn(navLabel, isCollapsed && navLabelHidden)}
            aria-hidden={isCollapsed || undefined}
          >
            {m.app_sidebar_home_nav_label()}
          </span>
        </Link>
      </CollapsibleNavTooltip>

      {/* Workspaces section */}
      {workspaces.length > 0 && (
        <>
          {!isCollapsed && (
            <p className="text-foreground/45 px-3 pb-1 pt-3 text-xs font-medium">
              {m.app_sidebar_workspaces_section_label()}
            </p>
          )}
          {isCollapsed && (
            <div className="bg-border/60 mx-3 my-2 h-px" aria-hidden />
          )}

          {workspaces.map((workspace) => {
            const unread = unreadById.get(workspace.id) ?? 0
            const hasUnread = unread > 0
            const label = hasUnread
              ? `${workspace.name} (${unread})`
              : workspace.name

            return (
              <CollapsibleNavTooltip
                key={workspace.id}
                isCollapsed={isCollapsed}
                label={label}
              >
                <Link
                  to="/workspaces/$id"
                  params={{ id: workspace.id }}
                  aria-label={label}
                  className={cn(navItemBase, navItemInactive)}
                  onClick={onNavigate}
                >
                  <span className="relative inline-flex shrink-0">
                    <WorkspaceMark name={workspace.name} isActive={false} />
                    {isCollapsed && hasUnread && (
                      <span
                        aria-hidden="true"
                        className="bg-primary border-card absolute -right-0.5 -top-0.5 size-2 rounded-full border-2"
                      />
                    )}
                  </span>
                  <span
                    className={cn(navLabel, isCollapsed && navLabelHidden)}
                    aria-hidden={isCollapsed || undefined}
                  >
                    {workspace.name}
                  </span>
                  {!isCollapsed && hasUnread && (
                    <NumericUnreadChip
                      count={unread}
                      tone="primary"
                      capAt99
                      aria-label={m.app_sidebar_workspace_unread_dot_aria({
                        count: unread,
                      })}
                    />
                  )}
                </Link>
              </CollapsibleNavTooltip>
            )
          })}
        </>
      )}

      {/* Settings */}
      <div className="pt-2">
        <CollapsibleNavTooltip
          isCollapsed={isCollapsed}
          label={m.app_sidebar_settings_label()}
        >
          <Link
            to="/settings"
            aria-label={m.app_sidebar_settings_label()}
            className={cn(navItemBase, navItemInactive)}
            onClick={onNavigate}
          >
            <SettingsIcon className="size-4 shrink-0" />
            <span
              className={cn(navLabel, isCollapsed && navLabelHidden)}
              aria-hidden={isCollapsed || undefined}
            >
              {m.app_sidebar_settings_label()}
            </span>
          </Link>
        </CollapsibleNavTooltip>
      </div>
    </nav>
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

  const isDashboardActive =
    pathname === overviewPath || pathname === `${overviewPath}/`
  const isInboxActive =
    pathname === `${overviewPath}/inbox` ||
    pathname.startsWith(`${overviewPath}/inbox/`)
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
          )}
          onClick={onNavigate}
        >
          <LayoutDashboard className="size-4 shrink-0" />
          <span
            className={cn(navLabel, isCollapsed && navLabelHidden)}
            aria-hidden={isCollapsed || undefined}
          >
            {m.app_sidebar_dashboard_label()}
          </span>
        </Link>
      </CollapsibleNavTooltip>

      <CollapsibleNavTooltip
        isCollapsed={isCollapsed}
        label={m.app_sidebar_inbox_label()}
      >
        <Link
          to="/workspaces/$id/inbox"
          params={{ id: workspaceId }}
          aria-label={m.app_sidebar_inbox_label()}
          aria-current={isInboxActive ? 'page' : undefined}
          className={cn(
            navItemBase,
            isInboxActive ? navItemActive : navItemInactive,
          )}
          onClick={onNavigate}
        >
          <MessageCircleIcon className="size-4 shrink-0" />
          <span
            className={cn(navLabel, isCollapsed && navLabelHidden)}
            aria-hidden={isCollapsed || undefined}
          >
            {m.app_sidebar_inbox_label()}
          </span>
        </Link>
      </CollapsibleNavTooltip>

      {/* Settings */}
      <CollapsibleNavTooltip
        isCollapsed={isCollapsed}
        label={m.common_settings()}
      >
        <Link
          to="/workspaces/$id/settings"
          params={{ id: workspaceId }}
          aria-label={m.common_settings()}
          aria-current={isSettingsActive ? 'page' : undefined}
          className={cn(
            navItemBase,
            isSettingsActive ? navItemActive : navItemInactive,
          )}
          onClick={onNavigate}
        >
          <SettingsIcon className="size-4 shrink-0" />
          <span
            className={cn(navLabel, isCollapsed && navLabelHidden)}
            aria-hidden={isCollapsed || undefined}
          >
            {m.common_settings()}
          </span>
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

  const tooltipLabel =
    currentWorkspace?.name ?? m.app_sidebar_select_workspace_label()

  function handleSelectionChange(key: unknown) {
    if (key === 'create') {
      onCreateWorkspace()
      return
    }
    const workspace = workspaces.find((w) => w.id === key)
    if (workspace) onSelect(workspace)
  }

  return (
    <CollapsibleNavTooltip isCollapsed={isCollapsed} label={tooltipLabel}>
      <Select
        aria-label={m.app_sidebar_select_workspace_label()}
        value={currentWorkspace?.id}
        onChange={handleSelectionChange}
        variant="secondary"
        className={cn('w-full', isCollapsed && 'mx-auto w-auto')}
        placeholder={m.app_sidebar_select_workspace_label()}
      >
        <Select.Trigger
          className={cn(
            navItemBase,
            navItemInactive,
            'h-auto min-h-0 w-full border-none shadow-none',
            isCollapsed && 'mx-auto size-9 w-9 justify-center p-0',
          )}
        >
          <Select.Value>
            {({ defaultChildren, isPlaceholder }) => {
              if (isPlaceholder || !currentWorkspace) {
                return (
                  <span
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2.5',
                      isCollapsed && 'justify-center',
                    )}
                  >
                    <span aria-hidden className="size-5 shrink-0 rounded-md" />
                    <span
                      className={cn(
                        navLabel,
                        'text-muted-foreground text-left',
                        isCollapsed && navLabelHidden,
                      )}
                      aria-hidden={isCollapsed || undefined}
                    >
                      {defaultChildren}
                    </span>
                  </span>
                )
              }

              return (
                <span
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-2.5',
                    isCollapsed && 'justify-center',
                  )}
                >
                  <WorkspaceMark name={currentWorkspace.name} isActive />
                  <span
                    className={cn(
                      navLabel,
                      'text-left',
                      isCollapsed && navLabelHidden,
                    )}
                    aria-hidden={isCollapsed || undefined}
                  >
                    {currentWorkspace.name}
                  </span>
                </span>
              )
            }}
          </Select.Value>
          <Select.Indicator
            className={cn(
              'text-foreground/40 size-3.5 shrink-0 transition-opacity duration-150 ease-out',
              isCollapsed && 'pointer-events-none opacity-0',
            )}
          />
        </Select.Trigger>
        <Select.Popover className="min-w-56">
          <ListBox>
            {workspaces.map((workspace) => (
              <ListBox.Item
                key={workspace.id}
                id={workspace.id}
                textValue={workspace.name}
              >
                <WorkspaceMark
                  name={workspace.name}
                  isActive={workspace.id === currentWorkspace?.id}
                />
                <Label className="flex-1">{workspace.name}</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
            <Separator />
            <ListBox.Item id="create" textValue={m.workspaces_create_button()}>
              <span
                aria-hidden
                className="text-foreground/60 flex size-5 shrink-0 items-center justify-center"
              >
                <PlusIcon className="size-4" />
              </span>
              <Label className="flex-1">{m.workspaces_create_button()}</Label>
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
    </CollapsibleNavTooltip>
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
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-primary/10 text-primary',
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

function isWorkspaceSettingsPath(pathname: string, workspaceId: string) {
  return pathname.startsWith(`/workspaces/${workspaceId}/settings`)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : m.common_unknown_error()
}
