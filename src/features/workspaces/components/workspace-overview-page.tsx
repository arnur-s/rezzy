import { AppButton } from '@/components/app-button'
import { m } from '@/paraglide/messages'
import { Alert, Card, Skeleton } from '@heroui/react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeftIcon,
  FolderKanbanIcon,
  SettingsIcon,
  UsersIcon,
  UsersRoundIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useWorkspace } from '../hooks/use-workspaces'
import type { Workspace } from '../types'

type WorkspaceOverviewPageProps = {
  workspaceId: string
}

export function WorkspaceOverviewPage({
  workspaceId,
}: WorkspaceOverviewPageProps) {
  const workspaceQuery = useWorkspace(workspaceId)
  const navigate = useNavigate()

  if (workspaceQuery.isPending) {
    return <WorkspaceOverviewSkeleton />
  }

  if (workspaceQuery.isError) {
    return (
      <WorkspaceOverviewShell>
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{m.workspace_overview_load_error_title()}</Alert.Title>
            <Alert.Description>
              {getErrorMessage(workspaceQuery.error)}
            </Alert.Description>
          </Alert.Content>
        </Alert>
        <Link to="/workspaces" className="link inline-flex items-center gap-2">
          <ArrowLeftIcon className="size-4" />
          {m.workspace_overview_back_to_workspaces()}
        </Link>
      </WorkspaceOverviewShell>
    )
  }

  return (
    <WorkspaceOverviewShell>
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <WorkspaceAvatar name={workspaceQuery.data.name} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              {m.workspace_overview_kicker()}
            </p>
            <h1 className="mt-2 truncate text-3xl font-semibold tracking-normal">
              {workspaceQuery.data.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {workspaceQuery.data.description ||
                m.workspaces_missing_description()}
            </p>
          </div>
        </div>

        <Link to="/workspaces" className="link inline-flex items-center gap-2">
          <ArrowLeftIcon className="size-4" />
          {m.workspace_overview_switch_workspace()}
        </Link>
      </header>

      <WorkspaceSummary workspace={workspaceQuery.data} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewAction
          icon={<FolderKanbanIcon className="size-5" />}
          title={m.workspace_overview_projects_title()}
          description={m.workspace_overview_projects_description()}
          actionLabel={m.workspace_overview_projects_action()}
          onPress={() =>
            navigate({
              params: { id: workspaceId },
              to: '/workspaces/$id/projects',
            })
          }
        />
        <OverviewAction
          icon={<UsersRoundIcon className="size-5" />}
          title={m.workspace_overview_members_title()}
          description={m.workspace_overview_members_description()}
          actionLabel={m.workspace_overview_members_action()}
          onPress={() =>
            navigate({
              params: { id: workspaceId },
              to: '/workspaces/$id/members',
            })
          }
        />
        <OverviewAction
          icon={<UsersIcon className="size-5" />}
          title={m.workspace_overview_teams_title()}
          description={m.workspace_overview_teams_description()}
          actionLabel={m.workspace_overview_teams_action()}
          onPress={() =>
            navigate({
              params: { id: workspaceId },
              to: '/workspaces/$id/teams',
            })
          }
        />
        <OverviewAction
          icon={<SettingsIcon className="size-5" />}
          title={m.workspace_overview_settings_title()}
          description={m.workspace_overview_settings_description()}
          actionLabel={m.workspace_overview_settings_action()}
          onPress={() =>
            navigate({
              params: { id: workspaceId },
              to: '/workspaces/$id/settings',
            })
          }
        />
      </section>
    </WorkspaceOverviewShell>
  )
}

function WorkspaceOverviewShell({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {children}
    </section>
  )
}

function WorkspaceOverviewSkeleton() {
  return (
    <WorkspaceOverviewShell>
      <div className="flex gap-4">
        <Skeleton className="size-12 rounded-lg" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-9 w-72 max-w-full rounded" />
          <Skeleton className="h-4 w-full max-w-2xl rounded" />
        </div>
      </div>
      <Skeleton className="h-44 rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </WorkspaceOverviewShell>
  )
}

function WorkspaceSummary({ workspace }: { workspace: Workspace }) {
  return (
    <Card className="border border-border bg-card text-card-foreground shadow-surface">
      <Card.Header>
        <Card.Title>{m.workspace_overview_summary_title()}</Card.Title>
        <Card.Description>
          {m.workspace_overview_summary_description()}
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryItem
            label={m.workspace_overview_summary_projects_label()}
            value={m.workspace_overview_summary_projects_value()}
          />
          <SummaryItem
            label={m.workspace_overview_summary_members_label()}
            value={m.workspace_overview_summary_members_value()}
          />
          <SummaryItem
            label={m.workspace_overview_summary_default_label()}
            value={
              workspace.is_main
                ? m.workspace_overview_summary_default_value()
                : m.workspace_overview_summary_selected_value()
            }
          />
        </div>
      </Card.Content>
    </Card>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  )
}

function OverviewAction({
  actionLabel,
  description,
  icon,
  onPress,
  title,
}: {
  actionLabel: string
  description: string
  icon: ReactNode
  onPress: () => void
  title: string
}) {
  return (
    <Card className="border border-border bg-card text-card-foreground shadow-surface">
      <Card.Header>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <Card.Title>{title}</Card.Title>
        <Card.Description>{description}</Card.Description>
      </Card.Header>
      <Card.Footer>
        <AppButton fullWidth variant="secondary" onPress={onPress}>
          {actionLabel}
        </AppButton>
      </Card.Footer>
    </Card>
  )
}

function WorkspaceAvatar({ name }: { name: string }) {
  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
      {name.trim().charAt(0).toUpperCase() || 'W'}
    </div>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : m.common_unknown_error()
}
