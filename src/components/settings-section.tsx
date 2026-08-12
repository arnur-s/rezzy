import type { ReactNode } from 'react'

type SettingsSectionHeaderProps = {
  title: string
  description?: string
  /** Set when the surrounding `section` points here with `aria-labelledby`. */
  id?: string
  /**
   * `h2` for a top-level section of a settings page, `h3` for a group nested
   * inside one. Level only — both render at the same size.
   */
  as?: 'h2' | 'h3'
}

/**
 * The title and supporting line above a group of settings.
 *
 * One size, on purpose. Account settings set these at `text-base` and workspace
 * settings at `text-lg`, so the same role arrived two sizes depending on which
 * half of the app you were in. DESIGN.md's title tier is `text-base
 * font-semibold`, and a shell that needs a third size has failed at weight
 * first — so the heading escalates by weight, and the description recedes by
 * tone rather than by shrinking further.
 */
export function SettingsSectionHeader({
  title,
  description,
  id,
  as: Heading = 'h2',
}: SettingsSectionHeaderProps) {
  return (
    <div>
      <Heading id={id} className="text-primary text-base font-semibold">
        {title}
      </Heading>
      {description && (
        <p className="text-secondary mt-1 text-sm">{description}</p>
      )}
    </div>
  )
}

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
    <div className="border-border flex flex-col gap-3 border-t py-4 first:border-t-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-primary text-sm font-medium">{label}</p>
        {description && (
          <p className="text-secondary mt-0.5 text-sm">{description}</p>
        )}
        {/* No alpha step: `text-secondary/80` composites to 4.38:1 on the
            light page. Size already separates this from the description. */}
        {scope && <p className="text-secondary mt-1 text-sm">{scope}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}
