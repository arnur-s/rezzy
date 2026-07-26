import type { ReactNode } from 'react'

type SettingsSectionProps = {
  title: string
  description: string
  children: ReactNode
}

/** A titled group of setting rows on a settings page. */
export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-primary text-base font-semibold">{title}</h2>
        <p className="text-secondary mt-1 text-sm">{description}</p>
      </div>

      <div className="flex flex-col">{children}</div>
    </section>
  )
}

type SettingRowProps = {
  label: string
  description: string
  control: ReactNode
}

/** Label and description on the left, the control that changes it on the right. */
export function SettingRow({ label, description, control }: SettingRowProps) {
  return (
    <div className="border-border/60 flex items-start justify-between gap-4 border-t py-4 first:border-t-0">
      <div className="min-w-0">
        <p className="text-primary text-sm font-medium">{label}</p>
        <p className="text-secondary mt-0.5 text-sm">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}
