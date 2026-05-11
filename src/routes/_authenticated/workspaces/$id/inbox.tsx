import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/$id/inbox')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/workspaces/$id/inbox"!</div>
}
