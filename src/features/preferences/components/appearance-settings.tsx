import { SettingRow, SettingsSection } from '@/components/settings-section'
import {
  applyLocalePreference,
  getLocalePreference,
} from '@/lib/locale'
import type { LocalePreference } from '@/lib/locale'
import { m } from '@/paraglide/messages'
import { useTheme } from '@/providers/theme-provider'
import type { Theme } from '@/providers/theme-provider'
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@astryxdesign/core/SegmentedControl'
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useState } from 'react'

const THEME_OPTIONS: Array<{
  value: Theme
  label: () => string
  icon: typeof SunIcon
}> = [
  { value: 'system', label: () => m.settings_appearance_mode_system(), icon: MonitorIcon },
  { value: 'light', label: () => m.settings_appearance_mode_light(), icon: SunIcon },
  { value: 'dark', label: () => m.settings_appearance_mode_dark(), icon: MoonIcon },
]

const LANGUAGE_OPTIONS: Array<{ value: LocalePreference; label: () => string }> =
  [
    { value: 'auto', label: () => m.settings_appearance_language_auto() },
    // Language names stay in their own language — a reader looking for Russian
    // should not have to already read English to find it.
    { value: 'en', label: () => 'English' },
    { value: 'ru', label: () => 'Русский' },
  ]

function isTheme(value: string): value is Theme {
  return value === 'system' || value === 'light' || value === 'dark'
}

function isLocalePreference(value: string): value is LocalePreference {
  return LANGUAGE_OPTIONS.some((option) => option.value === value)
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  // Changing the language reloads the page, so this state only has to survive
  // the moment between the click and the reload (or a no-op re-pin).
  const [language, setLanguage] = useState<LocalePreference>(getLocalePreference)

  function handleLanguageChange(next: string) {
    if (!isLocalePreference(next)) return
    setLanguage(next)
    applyLocalePreference(next)
  }

  return (
    <SettingsSection
      title={m.settings_appearance_title()}
      description={m.settings_appearance_description()}
    >
      <SettingRow
        label={m.settings_appearance_mode_label()}
        description={m.settings_appearance_mode_description()}
        control={
          <SegmentedControl
            size="sm"
            value={theme}
            onChange={(next) => {
              if (isTheme(next)) setTheme(next)
            }}
            label={m.settings_appearance_mode_label()}
          >
            {THEME_OPTIONS.map((option) => (
              <SegmentedControlItem
                key={option.value}
                value={option.value}
                label={option.label()}
                icon={<option.icon className="size-4" />}
              />
            ))}
          </SegmentedControl>
        }
      />

      <SettingRow
        label={m.settings_appearance_language_label()}
        description={m.settings_appearance_language_description()}
        control={
          <SegmentedControl
            size="sm"
            value={language}
            onChange={handleLanguageChange}
            label={m.settings_appearance_language_label()}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <SegmentedControlItem
                key={option.value}
                value={option.value}
                label={option.label()}
              />
            ))}
          </SegmentedControl>
        }
      />
    </SettingsSection>
  )
}
