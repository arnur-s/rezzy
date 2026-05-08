import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/password-reset')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/password-reset"!</div>
}
