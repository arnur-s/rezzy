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

export type WorkspaceSection = 'members' | 'projects' | 'settings' | 'teams'

type WorkspaceSectionPageProps = {
  section: WorkspaceSection
  workspaceId: string
}

export function WorkspaceSectionPage({
  section,
  workspaceId,
}: WorkspaceSectionPageProps) {
  const navigate = useNavigate()
  const workspaceQuery = useWorkspace(workspaceId)
  const sectionCopy = getSectionCopy(section)

  if (workspaceQuery.isPending) {
    return <WorkspaceSectionSkeleton />
  }

  if (workspaceQuery.isError) {
    return (
      <WorkspaceSectionShell>
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{m.workspace_overview_load_error_title()}</Alert.Title>
            <Alert.Description>
              {getErrorMessage(workspaceQuery.error)}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      </WorkspaceSectionShell>
    )
  }

  return (
    <WorkspaceSectionShell>
      <header className="flex flex-col gap-4">
        <Link
          to="/workspaces/$id"
          params={{ id: workspaceId }}
          className="link inline-flex w-fit items-center gap-2"
        >
          <ArrowLeftIcon className="size-4" />
          {m.workspace_section_back_to_overview()}
        </Link>
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {sectionCopy.icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              {workspaceQuery.data.name}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              {sectionCopy.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {sectionCopy.description}
            </p>
          </div>
        </div>
      </header>

      <Card className="border border-border bg-card text-card-foreground shadow-surface">
        <Card.Header>
          <Card.Title>{sectionCopy.emptyTitle}</Card.Title>
          <Card.Description>{sectionCopy.emptyDescription}</Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {sectionCopy.icon}
            </div>
            <p className="mt-4 text-sm font-medium">{sectionCopy.nextStep}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {sectionCopy.nextStepDescription}
            </p>
          </div>
        </Card.Content>
        <Card.Footer className="justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {m.workspace_section_foundation_note()}
          </span>
          <AppButton
            variant="secondary"
            onPress={() =>
              navigate({
                params: { id: workspaceId },
                to: '/workspaces/$id',
              })
            }
          >
            {m.workspace_section_return_button()}
          </AppButton>
        </Card.Footer>
      </Card>
    </WorkspaceSectionShell>
  )
}

function WorkspaceSectionShell({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {children}
    </section>
  )
}

function WorkspaceSectionSkeleton() {
  return (
    <WorkspaceSectionShell>
      <div className="space-y-3">
        <Skeleton className="h-4 w-36 rounded" />
        <Skeleton className="h-9 w-72 max-w-full rounded" />
        <Skeleton className="h-4 w-full max-w-2xl rounded" />
      </div>
      <Skeleton className="h-80 rounded-lg" />
    </WorkspaceSectionShell>
  )
}

function getSectionCopy(section: WorkspaceSection) {
  if (section === 'projects') {
    return {
      description: m.workspace_section_projects_description(),
      emptyDescription: m.workspace_section_projects_empty_description(),
      emptyTitle: m.workspace_section_projects_empty_title(),
      icon: <FolderKanbanIcon className="size-5" />,
      nextStep: m.workspace_section_projects_next_step(),
      nextStepDescription: m.workspace_section_projects_next_step_description(),
      title: m.workspace_section_projects_title(),
    }
  }

  if (section === 'members') {
    return {
      description: m.workspace_section_members_description(),
      emptyDescription: m.workspace_section_members_empty_description(),
      emptyTitle: m.workspace_section_members_empty_title(),
      icon: <UsersRoundIcon className="size-5" />,
      nextStep: m.workspace_section_members_next_step(),
      nextStepDescription: m.workspace_section_members_next_step_description(),
      title: m.workspace_section_members_title(),
    }
  }

  if (section === 'teams') {
    return {
      description: m.workspace_section_teams_description(),
      emptyDescription: m.workspace_section_teams_empty_description(),
      emptyTitle: m.workspace_section_teams_empty_title(),
      icon: <UsersIcon className="size-5" />,
      nextStep: m.workspace_section_teams_next_step(),
      nextStepDescription: m.workspace_section_teams_next_step_description(),
      title: m.workspace_section_teams_title(),
    }
  }

  return {
    description: m.workspace_section_settings_description(),
    emptyDescription: m.workspace_section_settings_empty_description(),
    emptyTitle: m.workspace_section_settings_empty_title(),
    icon: <SettingsIcon className="size-5" />,
    nextStep: m.workspace_section_settings_next_step(),
    nextStepDescription: m.workspace_section_settings_next_step_description(),
    title: m.workspace_section_settings_title(),
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : m.common_unknown_error()
}
