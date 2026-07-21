import { m } from '@/paraglide/messages'
import { Label, ListBox, Select, Skeleton, Switch, toast } from '@heroui/react'
import { cn } from '@heroui/styles'
import type { ReactNode } from 'react'
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../hooks/use-notification-preferences'
import { usePushSubscription } from '../hooks/use-push-subscription'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  MESSAGE_PREVIEW_MODES,
  
  
  
  isMessagePreviewMode
} from '../model/types'
import type {MessagePreviewMode, NotificationPermissionState, NotificationPreferences} from '../model/types';

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

type SettingRowProps = {
  label: string
  description: string
  control: ReactNode
}

function SettingRow({ label, description, control }: SettingRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border/60 py-4 first:border-t-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
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
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      aria-label={ariaLabel}
    >
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  )
}

function NotificationSettingsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex items-center justify-between gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function NotificationSettings() {
  const preferencesQuery = useNotificationPreferences()
  const updatePreferences = useUpdateNotificationPreferences()
  const push = usePushSubscription()

  const preferences: NotificationPreferences =
    preferencesQuery.data ?? DEFAULT_NOTIFICATION_PREFERENCES

  function save(next: NotificationPreferences) {
    updatePreferences.mutate(next, {
      onError: (error) => {
        toast.danger(m.settings_notifications_save_error(), {
          description: errorDescription(error),
        })
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
        toast.danger(m.settings_notifications_permission_error(), {
          description: errorDescription(error),
        })
      }
      return
    }
    await push.unsubscribe().catch(() => {})
    save({ ...preferences, desktopEnabled: false })
  }

  function handlePreviewChange(next: unknown) {
    if (typeof next !== 'string' || !isMessagePreviewMode(next)) return
    save({ ...preferences, previewMode: next })
  }

  if (preferencesQuery.isError) {
    return (
      <p className="text-sm text-danger">
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
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          {m.settings_notifications_title()}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {m.settings_notifications_description()}
        </p>
      </div>

      <div className="flex flex-col">
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
          <span className="text-muted">
            {m.settings_notifications_permission_label()}
          </span>
          <span
            className={cn(
              'font-medium',
              push.permission === 'granted' && 'text-success',
              push.permission === 'denied' && 'text-danger',
              (push.permission === 'default' ||
                push.permission === 'unsupported') &&
                'text-foreground/70',
            )}
          >
            {PERMISSION_LABELS[push.permission]()}
          </span>
        </div>

        {push.permission === 'denied' ? (
          <p className="mt-1 text-xs text-muted">
            {m.settings_notifications_permission_denied_help()}
          </p>
        ) : null}
        {push.permission === 'unsupported' ? (
          <p className="mt-1 text-xs text-muted">
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

        <div className="flex items-start justify-between gap-4 border-t border-border/60 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {m.settings_notifications_preview_label()}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {m.settings_notifications_preview_description()}
            </p>
          </div>
          <Select
            value={preferences.previewMode}
            onChange={handlePreviewChange}
            variant="secondary"
            className="w-48 shrink-0"
          >
            <Label className="sr-only">
              {m.settings_notifications_preview_label()}
            </Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {MESSAGE_PREVIEW_MODES.map((mode) => (
                  <ListBox.Item
                    key={mode}
                    id={mode}
                    textValue={PREVIEW_MODE_LABELS[mode]()}
                  >
                    {PREVIEW_MODE_LABELS[mode]()}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      </div>
    </div>
  )
}
