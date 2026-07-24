import type { Workspace } from '@/entities/workspace'
import { resolveWorkspaceIcon } from '@/entities/workspace'
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
  Skeleton,
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
import { DynamicIcon } from 'lucide-react/dynamic'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

const navItemBase =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-focus active:scale-[0.98] motion-reduce:transition-none'
const navItemInactive =
  'text-foreground/60 hover:bg-accent/10 dark:hover:bg-accent/15 hover:text-accent'
const navItemActive = 'bg-accent/10 dark:bg-accent/15 text-accent'
const navLabel =
  'min-w-0 truncate transition-opacity duration-150 ease-out motion-reduce:transition-none'
const navLabelHidden = 'pointer-events-none opacity-0 w-0'

export interface SidebarProps {
  isCollapsed: boolean
  isMobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
}

export function Sidebar({
  isCollapsed,
  isMobileOpen,
  onMobileOpenChange,
}: SidebarProps) {
  const { user } = useAuth()
  if (!user) return null

  return (
    <>
      <aside
        // No right border: the sidebar is part of the canvas, and the
        // workspace gap does the separating.
        className="hidden w-65 shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-out data-collapsed:w-16 motion-reduce:transition-none md:flex"
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
            className="bg-surface-secondary h-full w-65 rounded-none p-0"
            aria-label={m.sidebar_workspace_nav_aria_label()}
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
  const isSettingsRoute = pathname === '/settings'

  const workspacesQuery = useWorkspaces(user.id)

  const currentWorkspace = useMemo(
    () =>
      isHomeRoute || isSettingsRoute
        ? undefined
        : (workspacesQuery.data?.find((w) => w.id === currentWorkspaceId) ??
          workspacesQuery.data?.[0]),
    [workspacesQuery.data, currentWorkspaceId, isHomeRoute, isSettingsRoute],
  )

  async function handleSignOut() {
    try {
      setIsSigningOut(true)
      await signOut()
      await navigate({ to: '/sign-in' })
    } catch (error) {
      setIsSigningOut(false)
      toast.danger(m.sidebar_logout_error(), {
        description: getErrorMessage(error),
      })
    }
  }

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Brand */}
        {/* Aligns with the header row across the canvas. Borderless, so the
            top strip reads as one continuous canvas band. */}
        <div className="flex h-16 shrink-0 items-center px-4">
          <Link
            to="/"
            aria-label={m.sidebar_home_label()}
            className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus"
            onClick={onNavigate}
          >
            <span className="bg-accent flex size-8 shrink-0 items-center justify-center rounded-lg">
              <span className="text-accent-foreground text-lg font-bold">
                {m.sidebar_brand_label().charAt(0)}
              </span>
            </span>
            <span
              className={cn(
                'text-foreground truncate text-sm font-semibold transition-opacity duration-150 ease-out motion-reduce:transition-none',
                isCollapsed && 'pointer-events-none opacity-0',
              )}
              aria-hidden={isCollapsed || undefined}
            >
              {m.sidebar_brand_label()}
            </span>
          </Link>
        </div>

        {/* Workspace switcher */}
        <div className="h-16 flex items-center px-3">
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

        {/* Nav */}
        <ScrollShadow className="flex-1 px-3 py-1">
          {isHomeRoute || isSettingsRoute ? (
            <HomeNav isCollapsed={isCollapsed} onNavigate={onNavigate} />
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
            label={m.sidebar_logout()}
          >
            <Button
              type="button"
              variant="ghost"
              isDisabled={isSigningOut}
              onPress={() => void handleSignOut()}
              aria-label={m.sidebar_logout()}
              aria-busy={isSigningOut || undefined}
              className={cn(
                navItemBase,
                navItemInactive,
                'h-auto min-h-0 justify-start font-[inherit] active:scale-100',
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
                {m.sidebar_logout()}
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
  isCollapsed,
  onNavigate,
}: {
  isCollapsed: boolean
  onNavigate?: () => void
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isHomeActive = pathname === '/'
  const isSettingsActive = pathname === '/settings'

  return (
    <nav
      aria-label={m.sidebar_workspace_nav_aria_label()}
      className="space-y-0.5"
    >
      {/* Home */}
      <CollapsibleNavTooltip
        isCollapsed={isCollapsed}
        label={m.sidebar_home_nav_label()}
      >
        <Link
          to="/"
          aria-label={m.sidebar_home_nav_label()}
          aria-current={isHomeActive ? 'page' : undefined}
          className={cn(
            navItemBase,
            isHomeActive ? navItemActive : navItemInactive,
          )}
          onClick={onNavigate}
        >
          <HomeIcon className="size-4 shrink-0" aria-hidden />
          <span
            className={cn(navLabel, isCollapsed && navLabelHidden)}
            aria-hidden={isCollapsed || undefined}
          >
            {m.sidebar_home_nav_label()}
          </span>
        </Link>
      </CollapsibleNavTooltip>

      {/* Settings */}
      <CollapsibleNavTooltip
        isCollapsed={isCollapsed}
        label={m.sidebar_settings_label()}
      >
        <Link
          to="/settings"
          aria-label={m.sidebar_settings_label()}
          aria-current={isSettingsActive ? 'page' : undefined}
          className={cn(
            navItemBase,
            isSettingsActive ? navItemActive : navItemInactive,
          )}
          onClick={onNavigate}
        >
          <SettingsIcon className="size-4 shrink-0" aria-hidden />
          <span
            className={cn(navLabel, isCollapsed && navLabelHidden)}
            aria-hidden={isCollapsed || undefined}
          >
            {m.sidebar_settings_label()}
          </span>
        </Link>
      </CollapsibleNavTooltip>
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
      aria-label={m.sidebar_workspace_nav_aria_label()}
      className="space-y-0.5"
    >
      {/* Dashboard */}
      <CollapsibleNavTooltip
        isCollapsed={isCollapsed}
        label={m.sidebar_dashboard_label()}
      >
        <Link
          to="/workspaces/$id"
          params={{ id: workspaceId }}
          aria-label={m.sidebar_dashboard_label()}
          aria-current={isDashboardActive ? 'page' : undefined}
          className={cn(
            navItemBase,
            isDashboardActive ? navItemActive : navItemInactive,
          )}
          onClick={onNavigate}
        >
          <LayoutDashboard className="size-4 shrink-0" aria-hidden />
          <span
            className={cn(navLabel, isCollapsed && navLabelHidden)}
            aria-hidden={isCollapsed || undefined}
          >
            {m.sidebar_dashboard_label()}
          </span>
        </Link>
      </CollapsibleNavTooltip>

      <CollapsibleNavTooltip
        isCollapsed={isCollapsed}
        label={m.sidebar_inbox_label()}
      >
        <Link
          to="/workspaces/$id/inbox"
          params={{ id: workspaceId }}
          aria-label={m.sidebar_inbox_label()}
          aria-current={isInboxActive ? 'page' : undefined}
          className={cn(
            navItemBase,
            isInboxActive ? navItemActive : navItemInactive,
          )}
          onClick={onNavigate}
        >
          <MessageCircleIcon className="size-4 shrink-0" aria-hidden />
          <span
            className={cn(navLabel, isCollapsed && navLabelHidden)}
            aria-hidden={isCollapsed || undefined}
          >
            {m.sidebar_inbox_label()}
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
          <SettingsIcon className="size-4 shrink-0" aria-hidden />
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
      <Skeleton
        className={cn('h-9 rounded-lg', isCollapsed ? 'mx-auto w-9' : 'w-full')}
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
    currentWorkspace?.name ?? m.sidebar_select_workspace_label()

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
        aria-label={m.sidebar_select_workspace_label()}
        selectedKey={currentWorkspace?.id ?? null}
        onSelectionChange={handleSelectionChange}
        variant="secondary"
        className="w-full"
        placeholder={m.sidebar_select_workspace_label()}
      >
        <Select.Trigger
          className={cn(
            navItemBase,
            navItemInactive,
            'h-auto min-h-0 w-full border-none shadow-none',
            isCollapsed && 'h-9 justify-center p-0',
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
                    <span
                      className={cn(
                        navLabel,
                        'text-muted text-left',
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
                    isCollapsed && 'justify-center gap-0',
                  )}
                >
                  <WorkspaceMark icon={currentWorkspace.icon} isActive />
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
              'text-foreground/40 size-3.5 shrink-0 transition-opacity duration-150 ease-out motion-reduce:transition-none',
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
                  icon={workspace.icon}
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
  icon,
  isActive,
}: {
  icon: Workspace['icon']
  isActive: boolean
}) {
  return (
    <span
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'bg-accent/10 text-accent',
      )}
    >
      <DynamicIcon
        name={resolveWorkspaceIcon(icon)}
        className="size-3.5"
        aria-hidden
      />
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
