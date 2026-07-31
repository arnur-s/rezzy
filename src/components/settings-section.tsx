import type { ReactNode } from 'react'

type SettingsSectionProps = {
  children: ReactNode
}

/** A titled group of setting rows on a settings page. */
export function SettingsSection({ children }: SettingsSectionProps) {
  return (
    <section>
      <div className="flex flex-col">{children}</div>
    </section>
  )
}

type SettingRowProps = {
  label: string
  control: ReactNode
  description?: string
  /**
   * Where the setting applies — this device, this browser, or the account.
   * Settings pages mix all three, and a row that does not say which is a row
   * the reader has to guess about.
   */
  scope?: string
}

/** Label and description on the left, the control that changes it on the right. */
export function SettingRow({
  label,
  control,
  description,
  scope,
}: SettingRowProps) {
  return (
    // Stacks below `sm`: a control and a description competing for the same
    // row get cramped long before the viewport does.
    <div className="border-border/60 flex flex-col gap-3 border-t py-4 first:border-t-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-primary text-sm font-medium">{label}</p>
        {description && (
          <p className="text-secondary mt-0.5 text-sm">{description}</p>
        )}
        {/* No alpha step: `text-secondary/80` composites to 4.38:1 on the
            light page. Size already separates this from the description. */}
        {scope && <p className="text-secondary mt-1 text-xs">{scope}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}
