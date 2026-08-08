import { useAuth } from '@/providers/auth-provider'
import { useCallback, useEffect, useState } from 'react'
import {
  deletePushSubscriptionByEndpoint,
  upsertPushSubscription,
} from '../api/push-subscriptions'
import type { NotificationPermissionState } from '../model/types'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

function readPermission(): NotificationPermissionState {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const buffer = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i)
  return buffer
}

export type UsePushSubscription = {
  isSupported: boolean
  permission: NotificationPermissionState
  isBusy: boolean
  /** Request permission (if needed) and register a push subscription. */
  subscribe: () => Promise<boolean>
  /** Remove this browser's push subscription. */
  unsubscribe: () => Promise<void>
}

export function usePushSubscription(): UsePushSubscription {
  const { user } = useAuth()
  const supported = isPushSupported()
  const [permission, setPermission] = useState<NotificationPermissionState>(
    () => readPermission(),
  )
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    setPermission(readPermission())
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported || !user) return false
    if (!VAPID_PUBLIC_KEY) throw new Error('MISSING_VAPID_PUBLIC_KEY')

    setIsBusy(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') return false

      // Register directly (idempotent — returns the existing registration if
      // already registered) instead of awaiting `serviceWorker.ready`, which
      // never resolves if registration failed or never happened.
      const registration = await navigator.serviceWorker.register('/sw.js')
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
        }))

      const json = subscription.toJSON()
      const keys = json.keys ?? {}
      if (!json.endpoint || !keys.p256dh || !keys.auth) {
        throw new Error('INVALID_PUSH_SUBSCRIPTION')
      }

      await upsertPushSubscription({
        endpoint: json.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent:
          typeof navigator !== 'undefined' ? navigator.userAgent : null,
      })
      return true
    } finally {
      setIsBusy(false)
    }
  }, [supported, user])

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!supported) return
    setIsBusy(true)
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) return
      const { endpoint } = subscription
      await subscription.unsubscribe().catch(() => {})
      await deletePushSubscriptionByEndpoint(endpoint).catch(() => {})
    } finally {
      setIsBusy(false)
    }
  }, [supported])

  return { isSupported: supported, permission, isBusy, subscribe, unsubscribe }
}
