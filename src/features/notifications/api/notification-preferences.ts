import { supabase } from '@/utils/supabase'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  
  
  isMessagePreviewMode
} from '../model/types'
import type {NotificationPreferences, NotificationPreferencesRow} from '../model/types';

const PREFERENCES_SELECT =
  'user_id, in_app_enabled, desktop_enabled, sound_enabled, preview_mode, created_at, updated_at' as const

function rowToPreferences(
  row: NotificationPreferencesRow,
): NotificationPreferences {
  return {
    inAppEnabled: row.in_app_enabled,
    desktopEnabled: row.desktop_enabled,
    soundEnabled: row.sound_enabled,
    previewMode: isMessagePreviewMode(row.preview_mode)
      ? row.preview_mode
      : DEFAULT_NOTIFICATION_PREFERENCES.previewMode,
  }
}

export async function getMyNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select(PREFERENCES_SELECT)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return DEFAULT_NOTIFICATION_PREFERENCES
  return rowToPreferences(data)
}

export async function upsertMyNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: userId,
        in_app_enabled: preferences.inAppEnabled,
        desktop_enabled: preferences.desktopEnabled,
        sound_enabled: preferences.soundEnabled,
        preview_mode: preferences.previewMode,
      },
      { onConflict: 'user_id' },
    )
    .select(PREFERENCES_SELECT)
    .single()

  if (error) throw error
  return rowToPreferences(data)
}
