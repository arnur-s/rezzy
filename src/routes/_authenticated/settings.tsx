import { NotificationSettings } from '@/features/notifications'
import { AppearanceSettings } from '@/features/preferences'
import { m } from '@/paraglide/messages'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-primary text-base font-semibold">
          {m.settings_page_title()}
        </h1>
        <p className="text-secondary mt-1 text-sm">
          {m.settings_page_description()}
        </p>
      </header>

      {/* No bordered section: the shell's content surface is the container. */}
      <div className="flex flex-col gap-10">
        <AppearanceSettings />
        <NotificationSettings />
      </div>
    </div>
  )
}
