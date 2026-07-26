import { SettingRow, SettingsSection } from '@/components/settings-section'
import { m } from '@/paraglide/messages'
import { Selector } from '@astryxdesign/core/Selector'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { Switch } from '@astryxdesign/core/Switch'
import { useToast } from '@astryxdesign/core/Toast'
import { cn } from '@/lib/cn'
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../hooks/use-notification-preferences'
import { usePushSubscription } from '../hooks/use-push-subscription'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  MESSAGE_PREVIEW_MODES,
  isMessagePreviewMode,
} from '../model/types'
import type {
  MessagePreviewMode,
  NotificationPermissionState,
  NotificationPreferences,
} from '../model/types'

function errorDescription(error: unknown): string {
  return error instanceof Error ? error.message : m.common_unknown_error()
}

const PREVIEW_MODE_LABELS: Record<MessagePreviewMode, () => string> = {
  full: () => m.settings_notifications_preview_full_label(),
  sender_only: () => m.settings_notifications_preview_sender_label(),
  hidden: () => m.settings_notifications_preview_hidden_label(),
}

const PERMISSION_LABELS: Record<NotificationPermissionState, () => string> = {
  default: () => m.settings_notifications_permission_default(),
  granted: () => m.settings_notifications_permission_granted(),
  denied: () => m.settings_notifications_permission_denied(),
  unsupported: () => m.settings_notifications_permission_unsupported(),
}

function ToggleSwitch({
  isSelected,
  onChange,
  isDisabled,
  ariaLabel,
}: {
  isSelected: boolean
  onChange: (value: boolean) => void
  isDisabled?: boolean
  ariaLabel: string
}) {
  return (
    <Switch
      label={ariaLabel}
      isLabelHidden
      value={isSelected}
      onChange={(checked) => onChange(checked)}
      isDisabled={isDisabled}
    />
  )
}

function NotificationSettingsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex items-center justify-between gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Skeleton width={160} height={16} radius={2} />
            <Skeleton width={256} height={12} radius={2} />
          </div>
          <Skeleton width={44} height={24} radius="rounded" />
        </div>
      ))}
    </div>
  )
}

export function NotificationSettings() {
  const showToast = useToast()
  const preferencesQuery = useNotificationPreferences()
  const updatePreferences = useUpdateNotificationPreferences()
  const push = usePushSubscription()

  const preferences: NotificationPreferences =
    preferencesQuery.data ?? DEFAULT_NOTIFICATION_PREFERENCES

  function save(next: NotificationPreferences) {
    updatePreferences.mutate(next, {
      onError: (error) => {
        showToast({ body: errorDescription(error), type: 'error' })
      },
    })
  }

  async function handleDesktopChange(value: boolean) {
    if (value) {
      try {
        const subscribed = await push.subscribe()
        if (!subscribed) return
        save({ ...preferences, desktopEnabled: true })
      } catch (error) {
        showToast({ body: errorDescription(error), type: 'error' })
      }
      return
    }
    await push.unsubscribe().catch(() => {})
    save({ ...preferences, desktopEnabled: false })
  }

  function handlePreviewChange(next: string) {
    if (!isMessagePreviewMode(next)) return
    save({ ...preferences, previewMode: next })
  }

  if (preferencesQuery.isError) {
    return (
      <p className="text-error text-sm">
        {m.settings_notifications_load_error()}
      </p>
    )
  }

  if (preferencesQuery.isPending) {
    return <NotificationSettingsSkeleton />
  }

  const permissionGranted = push.permission === 'granted'
  const desktopOn = preferences.desktopEnabled && permissionGranted
  const desktopDisabled =
    !push.isSupported || push.permission === 'denied' || push.isBusy

  return (
    <SettingsSection
      title={m.settings_notifications_title()}
      description={m.settings_notifications_description()}
    >
      <SettingRow
        label={m.settings_notifications_in_app_label()}
        description={m.settings_notifications_in_app_description()}
        control={
          <ToggleSwitch
            isSelected={preferences.inAppEnabled}
            onChange={(value) => save({ ...preferences, inAppEnabled: value })}
            ariaLabel={m.settings_notifications_in_app_label()}
          />
        }
      />

      <SettingRow
        label={m.settings_notifications_desktop_label()}
        description={m.settings_notifications_desktop_description()}
        control={
          <ToggleSwitch
            isSelected={desktopOn}
            onChange={handleDesktopChange}
            isDisabled={desktopDisabled}
            ariaLabel={m.settings_notifications_desktop_label()}
          />
        }
      />

      <div className="flex items-center justify-between gap-4 pl-0 text-sm">
        <span className="text-secondary">
          {m.settings_notifications_permission_label()}
        </span>
        <span
          className={cn(
            'font-medium',
            push.permission === 'granted' && 'text-success',
            push.permission === 'denied' && 'text-error',
            (push.permission === 'default' ||
              push.permission === 'unsupported') &&
              'text-primary/70',
          )}
        >
          {PERMISSION_LABELS[push.permission]()}
        </span>
      </div>

      {push.permission === 'denied' ? (
        <p className="text-secondary mt-1 text-xs">
          {m.settings_notifications_permission_denied_help()}
        </p>
      ) : null}
      {push.permission === 'unsupported' ? (
        <p className="text-secondary mt-1 text-xs">
          {m.settings_notifications_permission_unsupported_help()}
        </p>
      ) : null}

      <SettingRow
        label={m.settings_notifications_sound_label()}
        description={m.settings_notifications_sound_description()}
        control={
          <ToggleSwitch
            isSelected={preferences.soundEnabled}
            onChange={(value) => save({ ...preferences, soundEnabled: value })}
            ariaLabel={m.settings_notifications_sound_label()}
          />
        }
      />

      <SettingRow
        label={m.settings_notifications_preview_label()}
        description={m.settings_notifications_preview_description()}
        control={
          <div className="w-48">
            <Selector
              label={m.settings_notifications_preview_label()}
              isLabelHidden
              value={preferences.previewMode}
              onChange={handlePreviewChange}
              options={MESSAGE_PREVIEW_MODES.map((mode) => ({
                value: mode,
                label: PREVIEW_MODE_LABELS[mode](),
              }))}
            />
          </div>
        }
      />
    </SettingsSection>
  )
}
