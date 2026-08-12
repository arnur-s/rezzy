import { SettingsSectionHeader } from '@/components/settings-section'
import { getLocale } from '@/paraglide/runtime'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { Selector } from '@astryxdesign/core/Selector'
import { useToast } from '@astryxdesign/core/Toast'
import { getCountries, getCountryCallingCode } from 'libphonenumber-js'
import { useEffect, useMemo, useState } from 'react'
import {
  useSetWorkspacePhoneRegion,
  useWorkspacePhoneRegion,
} from '../hooks/use-workspace-phone-region'

/** "Kazakhstan (+7)", in the reader's language, sorted by that language. */
function useCountryOptions() {
  const locale = getLocale()

  return useMemo(() => {
    // Intl.DisplayNames is in every browser this app supports; a missing name
    // falls back to the ISO code rather than an empty row.
    const names =
      typeof Intl.DisplayNames === 'function'
        ? new Intl.DisplayNames([locale], { type: 'region' })
        : null

    return getCountries()
      .map((country) => ({
        value: country,
        label: `${names?.of(country) ?? country} (+${getCountryCallingCode(country)})`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale))
  }, [locale])
}

/**
 * The country used to read phone numbers written without a `+`.
 *
 * Its own section rather than a field of the general form: it is the one
 * setting here that changes how existing data is *interpreted* — set it wrong
 * and a shared contact card can match the wrong person — so it saves on its own
 * and says what it is for.
 *
 * Leaving it unset is a legitimate answer. Unset means numbers without a country
 * code are treated as ambiguous and are not matched against the CRM at all,
 * which is the safe reading for a team whose customers are not in one country.
 */
export function WorkspacePhoneRegionSection({
  workspaceId,
}: {
  workspaceId: string
}) {
  const showToast = useToast()
  const regionQuery = useWorkspacePhoneRegion(workspaceId)
  const setRegion = useSetWorkspacePhoneRegion(workspaceId)
  const options = useCountryOptions()

  const saved = regionQuery.data ?? ''
  const [value, setValue] = useState(saved)

  // Re-baseline when the stored value arrives or changes elsewhere, without
  // fighting an edit in progress.
  useEffect(() => {
    setValue(saved)
  }, [saved])

  const isDirty = value !== saved

  const handleSave = () => {
    setRegion.mutate(value === '' ? null : value, {
      onError: () =>
        showToast({ body: m.workspace_settings_phone_region_error(), type: 'error' }),
      onSuccess: () =>
        showToast({ body: m.workspace_settings_update_success(), type: 'info' }),
    })
  }

  return (
    <section className="border-border flex flex-col gap-3 border-t pt-6">
      <SettingsSectionHeader
        as="h3"
        title={m.workspace_settings_phone_region_title()}
        description={m.workspace_settings_phone_region_description()}
      />

      <Selector
        label={m.workspace_settings_phone_region_label()}
        value={value}
        onChange={(next) => setValue(String(next))}
        isDisabled={regionQuery.isPending || setRegion.isPending}
        options={[
          { value: '', label: m.workspace_settings_phone_region_none() },
          ...options,
        ]}
      />

      <div className="flex justify-end">
        <Button
          label={m.common_save_changes()}
          type="button"
          variant="secondary"
          isDisabled={!isDirty || setRegion.isPending}
          isLoading={setRegion.isPending}
          onClick={handleSave}
        />
      </div>
    </section>
  )
}
