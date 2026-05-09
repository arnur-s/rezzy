import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/sidebar'
import { useWorkspaceProjects } from '@/features/projects/hooks/use-projects'
import type { Project } from '@/features/projects/types'
import {
  getUserDisplayName,
  getUserInitials,
} from '@/features/users/utils/user-display'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import type { Workspace } from '@/features/workspaces/types'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { Avatar, Button, Dropdown, Label, toast } from '@heroui/react'
import type { User } from '@supabase/supabase-js'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  Building2Icon,
  ChevronRightIcon,
  FolderKanbanIcon,
  LogOutIcon,
  MoreVerticalIcon,
  UserRoundIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export function AppSidebar() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return <AuthenticatedAppSidebar user={user} />
}

function AuthenticatedAppSidebar({ user }: { user: User }) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<Set<string>>(
    () => new Set(),
  )
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const workspacesQuery = useWorkspaces(user.id)
  const workspaceIds = useMemo(
    () => workspacesQuery.data?.map((workspace) => workspace.id) ?? [],
    [workspacesQuery.data],
  )
  const projectsQuery = useWorkspaceProjects(workspaceIds)
  const projectsByWorkspaceId = useMemo(
    () => groupProjectsByWorkspaceId(projectsQuery.data ?? []),
    [projectsQuery.data],
  )
  const displayName = useMemo(
    () => getUserDisplayName(user, m.app_sidebar_unknown_user()),
    [user],
  )
  const email = user.email ?? m.app_sidebar_unknown_email()

  useEffect(() => {
    const activeWorkspace = workspacesQuery.data?.find((workspace) => {
      const workspacePath = `/workspaces/${workspace.id}`

      return (
        pathname === workspacePath || pathname.startsWith(`${workspacePath}/`)
      )
    })

    if (!activeWorkspace) {
      return
    }

    setExpandedWorkspaceIds((currentIds) => {
      if (currentIds.has(activeWorkspace.id)) {
        return currentIds
      }

      return new Set([...currentIds, activeWorkspace.id])
    })
  }, [pathname, workspacesQuery.data])

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

  function toggleWorkspace(workspaceId: string) {
    setExpandedWorkspaceIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(workspaceId)) {
        nextIds.delete(workspaceId)
      } else {
        nextIds.add(workspaceId)
      }

      return nextIds
    })
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={m.app_logo_placeholder()}
            >
              <Link
                aria-label={m.app_sidebar_home_label()}
                to="/workspaces"
                className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground group-data-[collapsible=icon]:size-7 group-data-[collapsible=icon]:rounded-md">
                  <Building2Icon className="size-5 group-data-[collapsible=icon]:size-4" />
                </span>
                <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">
                  {m.app_logo_placeholder()}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {m.app_sidebar_workspaces_label()}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {workspacesQuery.isPending ? (
              <WorkspacesLoadingSkeleton />
            ) : workspacesQuery.isError ? (
              <p className="rounded-md bg-danger/5 px-2 py-2 text-xs leading-5 text-danger group-data-[collapsible=icon]:hidden">
                {m.workspaces_load_error_title()}
              </p>
            ) : workspacesQuery.data.length > 0 ? (
              <SidebarMenu>
                {workspacesQuery.data.map((workspace) => (
                  <WorkspaceMenuItem
                    key={workspace.id}
                    workspace={workspace}
                    pathname={pathname}
                    isExpanded={expandedWorkspaceIds.has(workspace.id)}
                    projects={projectsByWorkspaceId.get(workspace.id) ?? []}
                    projectsLoading={projectsQuery.isPending}
                    projectsError={projectsQuery.isError}
                    onToggle={() => toggleWorkspace(workspace.id)}
                  />
                ))}
              </SidebarMenu>
            ) : (
              <p className="rounded-md bg-card/60 px-2 py-2 text-xs leading-5 text-muted-foreground group-data-[collapsible=icon]:hidden">
                {m.app_sidebar_no_workspaces()}
              </p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserMenuItem
          email={email}
          name={displayName}
          isSigningOut={isSigningOut}
          onOpenProfile={() => void navigate({ to: '/profile' })}
          onSignOut={() => void handleSignOut()}
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function WorkspaceMenuItem({
  workspace,
  pathname,
  isExpanded,
  projects,
  projectsLoading,
  projectsError,
  onToggle,
}: {
  workspace: Workspace
  pathname: string
  isExpanded: boolean
  projects: Array<Project>
  projectsLoading: boolean
  projectsError: boolean
  onToggle: () => void
}) {
  const workspacePath = `/workspaces/${workspace.id}`
  const isWorkspaceActive =
    pathname === workspacePath || pathname.startsWith(`${workspacePath}/`)
  const isWorkspaceCurrent =
    pathname === workspacePath || pathname === `${workspacePath}/`
  const projectRegionId = `workspace-projects-${workspace.id}`

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isWorkspaceActive}
        tooltip={workspace.name}
      >
        <Link
          aria-current={isWorkspaceCurrent ? 'page' : undefined}
          aria-label={workspace.name}
          params={{ id: workspace.id }}
          to="/workspaces/$id"
          className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
        >
          <WorkspaceMark isActive={isWorkspaceActive} name={workspace.name} />
          <span className="font-medium group-data-[collapsible=icon]:hidden">
            {workspace.name}
          </span>
        </Link>
      </SidebarMenuButton>

      <SidebarMenuAction
        aria-controls={projectRegionId}
        aria-expanded={isExpanded}
        aria-label={
          isExpanded
            ? m.app_sidebar_collapse_workspace({ workspace: workspace.name })
            : m.app_sidebar_expand_workspace({ workspace: workspace.name })
        }
        onClick={onToggle}
        showOnHover
      >
        <ChevronRightIcon
          className={`transition-transform duration-150 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </SidebarMenuAction>

      {isExpanded ? (
        <ProjectMenuList
          id={projectRegionId}
          projects={projects}
          projectsLoading={projectsLoading}
          projectsError={projectsError}
          workspaceId={workspace.id}
          pathname={pathname}
        />
      ) : null}
    </SidebarMenuItem>
  )
}

function ProjectMenuList({
  id,
  projects,
  projectsLoading,
  projectsError,
  workspaceId,
  pathname,
}: {
  id: string
  projects: Array<Project>
  projectsLoading: boolean
  projectsError: boolean
  workspaceId: string
  pathname: string
}) {
  if (projectsLoading) {
    return (
      <SidebarMenuSub id={id}>
        {Array.from({ length: 2 }).map((_, index) => (
          <SidebarMenuSubItem key={index}>
            <SidebarMenuSkeleton />
          </SidebarMenuSubItem>
        ))}
      </SidebarMenuSub>
    )
  }

  if (projectsError) {
    return (
      <SidebarMenuSub id={id}>
        <SidebarMenuSubItem>
          <p className="rounded-md bg-danger/5 px-2 py-1 text-xs leading-5 text-danger">
            {m.app_sidebar_projects_error()}
          </p>
        </SidebarMenuSubItem>
      </SidebarMenuSub>
    )
  }

  if (projects.length === 0) {
    return (
      <SidebarMenuSub id={id}>
        <SidebarMenuSubItem>
          <p className="px-2 py-1 text-xs leading-5 text-muted-foreground">
            {m.app_sidebar_projects_empty()}
          </p>
        </SidebarMenuSubItem>
      </SidebarMenuSub>
    )
  }

  const projectsPath = `/workspaces/${workspaceId}/projects`
  const isProjectsActive = pathname.startsWith(projectsPath)

  return (
    <SidebarMenuSub id={id}>
      {projects.map((project) => (
        <SidebarMenuSubItem key={project.id}>
          <SidebarMenuSubButton asChild isActive={isProjectsActive}>
            <Link
              aria-label={project.name}
              params={{ id: workspaceId }}
              to="/workspaces/$id/projects"
            >
              <FolderKanbanIcon />
              <span>{project.name}</span>
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  )
}

function WorkspacesLoadingSkeleton() {
  return (
    <SidebarMenu>
      {Array.from({ length: 4 }).map((_, index) => (
        <SidebarMenuItem key={index}>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

function UserMenuItem({
  email,
  name,
  isSigningOut,
  onOpenProfile,
  onSignOut,
}: {
  email: string
  name: string
  isSigningOut: boolean
  onOpenProfile: () => void
  onSignOut: () => void
}) {
  const { state, isMobile } = useSidebar()
  const isCollapsed = state === 'collapsed' && !isMobile

  return (
    <div className="flex items-center gap-2 rounded-md bg-card/60 p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
      <Avatar color="accent" size="sm" variant="soft">
        <Avatar.Fallback>{getUserInitials(name)}</Avatar.Fallback>
      </Avatar>

      <div className="min-w-0 flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>

      <Dropdown>
        <Button
          isIconOnly
          aria-label={m.app_sidebar_user_menu_label()}
          isDisabled={isSigningOut}
          size="sm"
          variant="tertiary"
          className={isCollapsed ? 'hidden' : undefined}
        >
          <MoreVerticalIcon className="size-4" />
        </Button>
        <Dropdown.Popover className="min-w-48">
          <Dropdown.Menu
            onAction={(key) => {
              if (key === 'profile') {
                onOpenProfile()
              }

              if (key === 'logout') {
                onSignOut()
              }
            }}
          >
            <Dropdown.Item id="profile" textValue={m.app_sidebar_profile()}>
              <UserRoundIcon className="size-4" />
              <Label>{m.app_sidebar_profile()}</Label>
            </Dropdown.Item>
            <Dropdown.Item
              id="logout"
              textValue={m.app_sidebar_logout()}
              variant="danger"
            >
              <LogOutIcon className="size-4" />
              <Label>{m.app_sidebar_logout()}</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  )
}

function WorkspaceMark({
  isActive,
  name,
}: {
  isActive: boolean
  name: string
}) {
  return (
    <span
      className={`flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold group-data-[collapsible=icon]:size-4 group-data-[collapsible=icon]:rounded-sm group-data-[collapsible=icon]:text-[10px] ${
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-primary/10 text-primary'
      }`}
    >
      {name.trim().charAt(0).toUpperCase() || 'W'}
    </span>
  )
}

function groupProjectsByWorkspaceId(projects: Array<Project>) {
  const projectsByWorkspaceId = new Map<string, Array<Project>>()

  for (const project of projects) {
    const workspaceProjects =
      projectsByWorkspaceId.get(project.workspace_id) ?? []

    workspaceProjects.push(project)
    projectsByWorkspaceId.set(project.workspace_id, workspaceProjects)
  }

  return projectsByWorkspaceId
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : m.common_unknown_error()
}
