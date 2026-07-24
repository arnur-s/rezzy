import { paneStyle } from '@/components/pane'
import { NotificationSettings } from '@/features/notifications'
import { m } from '@/paraglide/messages'
import { ScrollShadow } from '@heroui/react'
import { cn } from '@heroui/styles'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings')({
  component: RouteComponent,
  staticData: {
    crumb: () => ({ label: m.breadcrumbs_settings() }),
  },
})

function RouteComponent() {
  return (
    <div className={cn(paneStyle.surface, 'h-full w-full')}>
      <ScrollShadow className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          <header className="mb-8">
            <h1 className="text-foreground text-base font-semibold">
              {m.settings_page_title()}
            </h1>
            <p className="text-muted mt-1 text-sm">
              {m.settings_page_description()}
            </p>
          </header>

          {/* No bordered section: the pane is already the container. */}
          <NotificationSettings />
        </div>
      </ScrollShadow>
    </div>
  )
}
