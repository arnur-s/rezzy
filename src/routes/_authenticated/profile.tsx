import { m } from '@/paraglide/messages'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { createFileRoute } from '@tanstack/react-router'
import { UserRoundIcon } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/profile')({
  component: RouteComponent,
  staticData: {
    crumb: () => ({ label: m.breadcrumbs_profile() }),
  },
})

function RouteComponent() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <EmptyState
        icon={<UserRoundIcon className="text-secondary size-8" />}
        title={m.profile_empty_title()}
        description={m.profile_empty_description()}
      />
    </div>
  )
}
