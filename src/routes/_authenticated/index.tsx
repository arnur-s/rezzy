import { Loader } from '@/components/loader'
import { AttentionList } from '@/features/dashboard/components/attention-list'
import { GreetingHeader } from '@/features/dashboard/components/greeting-header'
import { HomePageSurface } from '@/features/dashboard/components/home-page-surface'
import { PersonalStatStrip } from '@/features/dashboard/components/personal-stat-strip'
import { QuickAccessPanel } from '@/features/dashboard/components/quick-access-panel'
import { WorkspaceGrid } from '@/features/dashboard/components/workspace-grid'
import { useAttentionQueue } from '@/features/dashboard/hooks/use-attention-queue'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { useHomeStats } from '@/features/dashboard/hooks/use-home-stats'
import { CreateWorkspaceModal } from '@/features/workspaces/components/create-workspace-modal'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { Button } from '@heroui/react'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

export const Route = createFileRoute('/_authenticated/')({
  component: RouteComponent,
})

const EMPTY_HOME_STATS = {
  unreadAssigned: 0,
  openAssigned: 0,
  snoozedWaking: 0,
  staleAssigned: 0,
}

function RouteComponent() {
  const { user } = useAuth()
  const userId = user?.id

  const workspacesQuery = useWorkspaces(userId)
  const workspaceIds = useMemo(
    () => workspacesQuery.data?.map((w) => w.id) ?? [],
    [workspacesQuery.data],
  )
  const dashboardStatsQuery = useDashboardStats(workspaceIds)
  const homeStatsQuery = useHomeStats(userId, workspaceIds)
  const attentionQuery = useAttentionQueue(userId, workspaceIds)

  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const workspaces = workspacesQuery.data ?? []
  const perWorkspaceStats = dashboardStatsQuery.data?.perWorkspace ?? []
  const homeStats = homeStatsQuery.data ?? EMPTY_HOME_STATS
  const attentionItems = attentionQuery.data ?? []
  const isLoading = workspacesQuery.isPending || dashboardStatsQuery.isPending
  const isError = workspacesQuery.isError || dashboardStatsQuery.isError

  return (
    <div className="flex justify-center flex-1 w-full px-3 pb-3 md:px-4 md:pb-4">
      {isError ? (
        <p className="flex-1 text-danger bg-danger/5 rounded-lg px-4 py-3 text-sm">
          {m.dashboard_load_error_title()}
        </p>
      ) : isLoading ? (
        <Loader size="xl" />
      ) : workspaces.length === 0 ? (
        <EmptyState onCreate={() => setIsCreateOpen(true)} />
      ) : user ? (
        <HomePageSurface>
          <GreetingHeader user={user} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-8">
              <PersonalStatStrip stats={homeStats} />
            </div>
            <div className="lg:col-span-4">
              <QuickAccessPanel />
            </div>
          </div>

          <AttentionList
            items={attentionItems}
            workspaces={workspaces}
            isLoading={attentionQuery.isPending}
          />

          <section
            aria-labelledby="home-workspaces-title"
            className="space-y-3"
          >
            <h2
              id="home-workspaces-title"
              className="text-foreground text-sm font-semibold"
            >
              {m.home_workspaces_section_title()}
            </h2>
            <WorkspaceGrid workspaces={workspaces} stats={perWorkspaceStats} />
          </section>
        </HomePageSurface>
      ) : null}

      <CreateWorkspaceModal
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">{m.dashboard_empty_title()}</h2>
      <p className="text-foreground/60 text-sm">
        {m.dashboard_empty_description()}
      </p>
      <Button onPress={onCreate} className="mt-2">
        {m.dashboard_empty_cta()}
      </Button>
    </div>
  )
}
