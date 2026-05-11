import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/')({
  component: RouteComponent,
})

function RouteComponent() {
  return null
}
