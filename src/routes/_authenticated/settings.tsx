import { NotificationSettings } from '@/features/notifications'
import { m } from '@/paraglide/messages'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings')({
  component: RouteComponent,
  staticData: {
    crumb: () => ({ label: m.breadcrumbs_settings() }),
  },
})

function RouteComponent() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">
          {m.settings_page_title()}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {m.settings_page_description()}
        </p>
      </header>

      <section className="rounded-2xl border border-border/60 p-6">
        <NotificationSettings />
      </section>
    </div>
  )
}
