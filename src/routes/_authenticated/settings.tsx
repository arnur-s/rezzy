import type { SettingsShellSection } from '@/components/settings-shell'
import { SettingsShell } from '@/components/settings-shell'
import { m } from '@/paraglide/messages'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  const sections: Array<SettingsShellSection> = [
    {
      key: 'profile',
      path: '/settings/profile',
      label: m.account_settings_profile_label(),
    },
    {
      key: 'appearance',
      path: '/settings/appearance',
      label: m.account_settings_appearance_label(),
    },
    {
      key: 'notifications',
      path: '/settings/notifications',
      label: m.account_settings_notifications_label(),
    },
    {
      key: 'security',
      path: '/settings/security',
      label: m.account_settings_security_label(),
    },
  ]

  return (
    <SettingsShell
      title={m.account_settings_title()}
      kicker={m.account_settings_kicker()}
      navLabel={m.account_settings_sections_nav_aria_label()}
      sections={sections}
    >
      <Outlet />
    </SettingsShell>
  )
}
