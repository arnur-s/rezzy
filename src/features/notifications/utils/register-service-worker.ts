/**
 * Registers the notification service worker (`public/sw.js`). Safe no-op in
 * environments without service worker support. Registration alone requests no
 * notification permission — permission is only requested when the user enables
 * desktop notifications in settings.
 */
export function registerNotificationServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }
  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('[notifications] service worker registration failed', error)
    })
  }
  if (typeof document !== 'undefined' && document.readyState === 'complete') {
    register()
  } else {
    window.addEventListener('load', register, { once: true })
  }
}
