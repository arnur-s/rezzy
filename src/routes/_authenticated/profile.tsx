import { m } from '@/paraglide/messages'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { createFileRoute } from '@tanstack/react-router'
import { UserRoundIcon } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/profile')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <h1 className="text-primary text-base font-semibold">
        {m.profile_page_title()}
      </h1>

      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={<UserRoundIcon className="text-secondary size-8" />}
          title={m.profile_empty_title()}
          description={m.profile_empty_description()}
        />
      </div>
    </div>
  )
}
