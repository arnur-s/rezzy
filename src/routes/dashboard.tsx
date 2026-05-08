import { useAuth } from '@/providers/auth-provider'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  useAuth()

  return <main className="min-h-dvh bg-background text-foreground"></main>
}
