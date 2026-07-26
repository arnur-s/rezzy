import { getUserDisplayName } from '@/entities/user'
import type { Workspace } from '@/entities/workspace'
import { resolveWorkspaceIcon } from '@/entities/workspace'
import { UnreadNotificationsNavItem } from '@/features/notifications'
import { CreateWorkspaceModal } from '@/features/workspaces/components/create-workspace-modal'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { Avatar } from '@astryxdesign/core/Avatar'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import type {
  DropdownMenuButtonProps,
  DropdownMenuOption,
} from '@astryxdesign/core/DropdownMenu'
import { NavHeadingMenu, NavHeadingMenuItem } from '@astryxdesign/core/NavMenu'
import {
  SideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
  useSideNavCollapse,
} from '@astryxdesign/core/SideNav'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { useToast } from '@astryxdesign/core/Toast'
import { useNavigate, useParams, useRouterState } from '@tanstack/react-router'
import {
  ChevronsUpDownIcon,
  HomeIcon,
  LayoutDashboard,
  LayoutGridIcon,
  LogOutIcon,
  MessageCircleIcon,
  SettingsIcon,
  UserRoundIcon,
} from 'lucide-react'
import { DynamicIcon } from 'lucide-react/dynamic'
import { useMemo, useState } from 'react'

export interface SidebarProps {
  isCollapsed: boolean
  onCollapsedChange: (isCollapsed: boolean) => void
  /** Called after a navigation is triggered (used to close the mobile drawer). */
  onNavigate?: () => void
}

/** Routes scoped to the person rather than to a workspace. */
const ACCOUNT_ROUTES = ['/settings', '/profile']

export function Sidebar({
  isCollapsed,
  onCollapsedChange,
  onNavigate,
}: SidebarProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false)

  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const params = useParams({ strict: false })
  const currentWorkspaceId = params.id
  const isHomeArea = pathname === '/' || ACCOUNT_ROUTES.includes(pathname)

  const workspacesQuery = useWorkspaces(user?.id ?? '')

  const currentWorkspace = useMemo(
    () =>
      isHomeArea
        ? undefined
        : (workspacesQuery.data?.find((w) => w.id === currentWorkspaceId) ??
          workspacesQuery.data?.[0]),
    [workspacesQuery.data, currentWorkspaceId, isHomeArea],
  )

  if (!user) return null

  return (
    <>
      <SideNav
        header={
          <SidebarHeading
            currentWorkspace={currentWorkspace}
            workspaces={workspacesQuery.data ?? []}
            isLoading={workspacesQuery.isPending}
            isError={workspacesQuery.isError}
            // onCreateWorkspace={() => setIsCreateWorkspaceOpen(true)}
            onSelect={(workspace) => {
              onNavigate?.()
              void navigate({
                to: '/workspaces/$id/inbox',
                params: { id: workspace.id },
              })
            }}
          />
        }
        collapsible={{
          isCollapsed,
          onCollapsedChange,
          buttonLabel: m.sidebar_toggle_label(),
        }}
        footer={<AccountMenu onNavigate={onNavigate} />}
      >
        <SideNavSection
          title={m.sidebar_workspace_nav_aria_label()}
          isHeaderHidden
        >
          {isHomeArea ? (
            <>
              <SideNavItem
                label={m.sidebar_home_nav_label()}
                icon={HomeIcon}
                href="/"
                isSelected={pathname === '/'}
                onClick={onNavigate}
              />
              <SideNavItem
                label={m.sidebar_settings_label()}
                icon={SettingsIcon}
                href="/settings"
                isSelected={pathname === '/settings'}
                onClick={onNavigate}
              />
            </>
          ) : currentWorkspace ? (
            <>
              <SideNavItem
                label={m.sidebar_dashboard_label()}
                icon={LayoutDashboard}
                href={`/workspaces/${currentWorkspace.id}`}
                isSelected={
                  pathname === `/workspaces/${currentWorkspace.id}` ||
                  pathname === `/workspaces/${currentWorkspace.id}/`
                }
                onClick={onNavigate}
              />
              <SideNavItem
                label={m.sidebar_inbox_label()}
                icon={MessageCircleIcon}
                href={`/workspaces/${currentWorkspace.id}/inbox`}
                isSelected={pathname.startsWith(
                  `/workspaces/${currentWorkspace.id}/inbox`,
                )}
                onClick={onNavigate}
              />
              <SideNavItem
                label={m.common_settings()}
                icon={SettingsIcon}
                href={`/workspaces/${currentWorkspace.id}/settings`}
                isSelected={pathname.startsWith(
                  `/workspaces/${currentWorkspace.id}/settings`,
                )}
                onClick={onNavigate}
              />
            </>
          ) : null}
        </SideNavSection>

        {/* Unread spans every workspace, so it sits apart from the nav items
            that only describe where you currently are. */}
        <SideNavSection
          title={m.sidebar_activity_nav_aria_label()}
          isHeaderHidden
        >
          <UnreadNotificationsNavItem workspaceId={currentWorkspaceId} />
        </SideNavSection>
      </SideNav>

      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceOpen}
        onOpenChange={setIsCreateWorkspaceOpen}
      />
    </>
  )
}

/**
 * Account row in the nav footer: profile, app settings, and sign-out, grouped
 * because all three are scoped to the person rather than to a workspace.
 */
function AccountMenu({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate()
  const showToast = useToast()
  const { user, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  // The rail's own collapse state, not the prop: SideNav drops this context in
  // drawer and topbar modes, so the mobile drawer keeps the expanded row even
  // while the desktop rail is collapsed.
  const { isCollapsed } = useSideNavCollapse()

  if (!user) return null

  const displayName = getUserDisplayName(user, m.sidebar_unknown_user())

  function go(to: '/profile' | '/settings') {
    setIsOpen(false)
    onNavigate?.()
    void navigate({ to })
  }

  async function handleSignOut() {
    setIsOpen(false)
    try {
      setIsSigningOut(true)
      await signOut()
      await navigate({ to: '/sign-in' })
    } catch (error) {
      setIsSigningOut(false)
      showToast({ body: getErrorMessage(error), type: 'error' })
    }
  }

  const items: Array<DropdownMenuOption> = [
    {
      label: m.sidebar_profile(),
      icon: <UserRoundIcon className="size-4" />,
      onClick: () => go('/profile'),
    },
    {
      label: m.sidebar_settings_label(),
      icon: <SettingsIcon className="size-4" />,
      onClick: () => go('/settings'),
    },
    // Signing out ends the session rather than moving you inside it, so it is
    // set apart from the two routes above.
    { type: 'divider' },
    {
      label: m.sidebar_logout(),
      icon: <LogOutIcon className="size-4" />,
      onClick: () => void handleSignOut(),
    },
  ]

  const button: DropdownMenuButtonProps = isCollapsed
    ? {
        label: displayName,
        variant: 'ghost',
        icon: <Avatar size="xsm" name={displayName} />,
        isIconOnly: true,
        tooltip: displayName,
        isDisabled: isSigningOut,
        isLoading: isSigningOut,
      }
    : {
        label: displayName,
        variant: 'ghost',
        isDisabled: isSigningOut,
        isLoading: isSigningOut,
        // Button centers its content, pads to 12px, and sets medium weight.
        // The account row has to read as the last nav row instead: 8px inset,
        // normal weight, and a label that grows so the chevron pins to the
        // trailing edge. Button's label span is the only handle it exposes for
        // that last part — it is the first child of the content wrapper here
        // because this row passes `children` rather than `icon`.
        className: 'px-2 font-normal [&>span>span:first-child]:grow',
        children: (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar size="xsm" name={displayName} />
            <span className="truncate">{displayName}</span>
          </span>
        ),
        endContent: (
          <ChevronsUpDownIcon className="text-secondary size-4" aria-hidden />
        ),
      }

  return (
    <DropdownMenu
      button={button}
      items={items}
      isMenuOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="above"
      // Expanded, the menu inherits the trigger's width so it reads as the row
      // unfolding. Collapsed, the trigger is a 32px square and needs a floor.
      menuWidth={isCollapsed ? 200 : undefined}
      hasChevron={false}
    />
  )
}

function SidebarHeading({
  currentWorkspace,
  workspaces,
  isLoading,
  isError,
  onSelect,
  // onCreateWorkspace,
}: {
  currentWorkspace: Workspace | undefined
  workspaces: Array<Workspace>
  isLoading: boolean
  isError: boolean
  onSelect: (workspace: Workspace) => void
  // onCreateWorkspace: () => void
}) {
  if (isLoading) {
    return <Skeleton width="100%" height={48} radius={3} />
  }

  if (isError) {
    return (
      <p className="text-error bg-error/5 rounded-lg px-3 py-2 text-xs">
        {m.workspaces_load_error_title()}
      </p>
    )
  }

  return (
    <SideNavHeading
      // The product name rides above the workspace switcher rather than in its
      // own row: one identity block, and the only route back to the home area
      // now that the top bar is gone.
      superheading={m.sidebar_brand_label()}
      superheadingHref="/"
      heading={currentWorkspace?.name ?? m.sidebar_select_workspace_label()}
      icon={
        currentWorkspace ? (
          <WorkspaceMark icon={currentWorkspace.icon} isActive />
        ) : (
          <WorkspacesMark />
        )
      }
      menu={
        <NavHeadingMenu>
          {workspaces.map((workspace) => (
            <NavHeadingMenuItem
              key={workspace.id}
              label={workspace.name}
              icon={
                <WorkspaceMark
                  icon={workspace.icon}
                  isActive={workspace.id === currentWorkspace?.id}
                />
              }
              onClick={() => onSelect(workspace)}
            />
          ))}
          {/* <NavHeadingMenuItem
            label={m.workspaces_create_button()}
            icon={<PlusIcon className="size-4" />}
            onClick={onCreateWorkspace}
          /> */}
        </NavHeadingMenu>
      }
    />
  )
}

/** Neutral mark for the switcher before a workspace is chosen. */
function WorkspacesMark() {
  return (
    <span className="bg-accent-bg/10 text-accent flex size-6 shrink-0 items-center justify-center rounded-md">
      <LayoutGridIcon className="size-3.5" aria-hidden />
    </span>
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
        'flex size-6 shrink-0 items-center justify-center rounded-md font-semibold',
        isActive
          ? 'bg-accent-bg text-on-accent'
          : 'bg-accent-bg/10 text-accent',
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : m.common_unknown_error()
}
