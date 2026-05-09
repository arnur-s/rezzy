import { CreateWorkspaceForm } from '@/features/workspaces/components/create-workspace-form'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/create')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <section className="flex min-h-full items-center justify-center px-4 py-10 lg:py-16">
      <CreateWorkspaceForm />
    </section>
  )
}
