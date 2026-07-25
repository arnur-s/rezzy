import type { Workspace } from '@/entities/workspace'
import { resolveWorkspaceIcon } from '@/entities/workspace'
import { CreateWorkspaceModal } from '@/features/workspaces/components/create-workspace-modal'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { NavHeadingMenu, NavHeadingMenuItem } from '@astryxdesign/core/NavMenu'
import {
  SideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
} from '@astryxdesign/core/SideNav'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { useToast } from '@astryxdesign/core/Toast'
import {
  useNavigate,
  useParams,
  useRouterState,
} from '@tanstack/react-router'
import type { SVGProps } from 'react'
import {
  HomeIcon,
  LayoutDashboard,
  LayoutGridIcon,
  Loader2Icon,
  LogOutIcon,
  MessageCircleIcon,
  PlusIcon,
  SettingsIcon,
} from 'lucide-react'
import { DynamicIcon } from 'lucide-react/dynamic'
import { useMemo, useState } from 'react'

export interface SidebarProps {
  isCollapsed: boolean
  onCollapsedChange: (isCollapsed: boolean) => void
  /** Called after a navigation is triggered (used to close the mobile drawer). */
  onNavigate?: () => void
}

export function Sidebar({
  isCollapsed,
  onCollapsedChange,
  onNavigate,
}: SidebarProps) {
  const navigate = useNavigate()
  const showToast = useToast()
  const { user, signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false)

  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const params = useParams({ strict: false })
  const currentWorkspaceId = params.id
  const isHomeArea = pathname === '/' || pathname === '/settings'

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

  async function handleSignOut() {
    try {
      setIsSigningOut(true)
      await signOut()
      await navigate({ to: '/sign-in' })
    } catch (error) {
      setIsSigningOut(false)
      showToast({ body: getErrorMessage(error), type: 'error' })
    }
  }

  return (
    <>
      <SideNav
        header={
          <SidebarHeading
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
        }
        collapsible={{
          isCollapsed,
          onCollapsedChange,
          buttonLabel: m.sidebar_toggle_label(),
        }}
        footer={
          <SideNavItem
            label={m.sidebar_logout()}
            icon={isSigningOut ? SpinnerIcon : LogOutIcon}
            isDisabled={isSigningOut}
            onClick={() => void handleSignOut()}
          />
        }
      >
        {isHomeArea ? (
          <SideNavSection title={m.sidebar_workspace_nav_aria_label()} isHeaderHidden>
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
          </SideNavSection>
        ) : currentWorkspace ? (
          <SideNavSection title={m.sidebar_workspace_nav_aria_label()} isHeaderHidden>
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
          </SideNavSection>
        ) : null}
      </SideNav>

      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceOpen}
        onOpenChange={setIsCreateWorkspaceOpen}
      />
    </>
  )
}

function SidebarHeading({
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
          <NavHeadingMenuItem
            label={m.workspaces_create_button()}
            icon={<PlusIcon className="size-4" />}
            onClick={onCreateWorkspace}
          />
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

function SpinnerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Loader2Icon
      {...props}
      className={cn('animate-spin', props.className)}
      aria-hidden
    />
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : m.common_unknown_error()
}
