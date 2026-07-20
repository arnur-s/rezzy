/**
 * Meta WhatsApp Embedded Signup launcher.
 *
 * Loads the Facebook JS SDK on demand, opens the Embedded Signup popup, and
 * resolves with the OAuth `code` plus the `phone_number_id` / `waba_id` that
 * arrive out-of-band via a `postMessage`. The backend
 * (`whatsapp-connect-channel`) exchanges the code for a long-lived token.
 */

const FB_SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js'
const FB_SDK_SCRIPT_ID = 'facebook-jssdk'
// Kept env-overridable to mirror the functions' WHATSAPP_GRAPH_VERSION, so the
// version lives in config rather than in two hardcoded places.
const FB_SDK_VERSION = import.meta.env.VITE_WHATSAPP_GRAPH_VERSION ?? 'v23.0'
/** Reject if the SDK never initialises (blocked script, or a silent empty 200). */
const SDK_LOAD_TIMEOUT_MS = 15_000
/** Reject if the code arrives but the session-info postMessage never does. */
const SESSION_INFO_TIMEOUT_MS = 30_000

/**
 * The Embedded Signup popup posts session info from a facebook.com subdomain
 * that varies by flow (www, web, business, m), so an allowlist of exact origins
 * silently drops real messages. Matching on hostname rather than
 * `origin.endsWith('facebook.com')` avoids also trusting evilfacebook.com.
 */
function isFacebookOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin)
    if (protocol !== 'https:') return false
    return hostname === 'facebook.com' || hostname.endsWith('.facebook.com')
  } catch {
    return false
  }
}

export type EmbeddedSignupResult = {
  code: string
  phoneNumberId: string
  wabaId: string
}

export type EmbeddedSignupReason =
  | 'not_configured'
  | 'insecure_context'
  | 'sdk_load_failed'
  | 'cancelled'
  | 'login_failed'
  | 'missing_session_info'
  | 'timeout'

export class EmbeddedSignupError extends Error {
  readonly reason: EmbeddedSignupReason

  constructor(reason: EmbeddedSignupReason) {
    super(reason)
    this.name = 'EmbeddedSignupError'
    this.reason = reason
  }
}

interface FbLoginResponse {
  authResponse?: { code?: string } | null
  status?: string
}

interface FbSdk {
  init: (params: {
    appId: string
    version: string
    cookie?: boolean
    xfbml?: boolean
  }) => void
  login: (
    callback: (response: FbLoginResponse) => void,
    options: Record<string, unknown>,
  ) => void
}

declare global {
  interface Window {
    FB?: FbSdk
    fbAsyncInit?: () => void
  }
}

export function isWhatsappEmbeddedSignupConfigured(): boolean {
  return (
    !!import.meta.env.VITE_WHATSAPP_APP_ID &&
    !!import.meta.env.VITE_WHATSAPP_CONFIG_ID
  )
}

/**
 * Facebook refuses FB.login on http pages, and unlike most browser APIs it does
 * NOT exempt localhost — the popup can still render, but no code is ever handed
 * back, which otherwise looks like a silent hang.
 * https://developers.facebook.com/blog/post/2018/06/08/enforce-https-facebook-login/
 */
export function isSecureContextForFbLogin(): boolean {
  return window.location.protocol === 'https:'
}

let sdkPromise: Promise<FbSdk> | null = null

function loadFbSdk(appId: string): Promise<FbSdk> {
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<FbSdk>((resolve, reject) => {
    const initAndResolve = (fb: FbSdk) => {
      fb.init({ appId, version: FB_SDK_VERSION, cookie: true, xfbml: false })
      resolve(fb)
    }

    // Already loaded by an earlier launch in this session.
    if (window.FB) {
      initAndResolve(window.FB)
      return
    }

    let settled = false

    const succeed = (fb: FbSdk) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      initAndResolve(fb)
    }

    // Drop the cached promise *and* the script tag so a retry re-injects a
    // fresh one; leaving a dead tag behind would make every retry short-circuit
    // on the getElementById guard below and hang.
    const fail = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      sdkPromise = null
      document.getElementById(FB_SDK_SCRIPT_ID)?.remove()
      reject(new EmbeddedSignupError('sdk_load_failed'))
    }

    // onerror does not fire when a blocker serves an empty 200, so the SDK can
    // "load" without ever defining FB. Time out rather than wait forever.
    // Only ever read from the async callbacks below, so it is initialised first.
    const timeoutId = window.setTimeout(fail, SDK_LOAD_TIMEOUT_MS)

    // The SDK invokes fbAsyncInit once it has finished loading.
    window.fbAsyncInit = () => {
      if (window.FB) succeed(window.FB)
    }

    if (document.getElementById(FB_SDK_SCRIPT_ID)) {
      // Injected by an earlier attempt and still loading; fbAsyncInit will fire.
      return
    }

    const script = document.createElement('script')
    script.id = FB_SDK_SCRIPT_ID
    script.src = FB_SDK_SRC
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.onerror = fail
    document.body.appendChild(script)
  })

  return sdkPromise
}

type SessionInfo = { phoneNumberId: string; wabaId: string }

function parseSessionInfo(data: unknown): SessionInfo | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const phoneNumberId = record.phone_number_id
  const wabaId = record.waba_id
  if (typeof phoneNumberId === 'string' && typeof wabaId === 'string') {
    return { phoneNumberId, wabaId }
  }
  return null
}

/**
 * Warms the SDK before the user clicks. Browsers block popups opened after a
 * long await, so FB.login must not be sitting behind a cold script fetch.
 */
export function preloadWhatsappSdk(): Promise<void> {
  const appId = import.meta.env.VITE_WHATSAPP_APP_ID
  if (!appId) return Promise.resolve()
  return loadFbSdk(appId).then(() => undefined)
}

export async function launchWhatsappEmbeddedSignup(): Promise<EmbeddedSignupResult> {
  const appId = import.meta.env.VITE_WHATSAPP_APP_ID
  const configId = import.meta.env.VITE_WHATSAPP_CONFIG_ID
  if (!appId || !configId) {
    throw new EmbeddedSignupError('not_configured')
  }

  // Fail fast: on http the SDK opens the popup but never returns a code, so
  // without this the flow just spins until the session-info timeout fires.
  if (!isSecureContextForFbLogin()) {
    throw new EmbeddedSignupError('insecure_context')
  }

  const fb = await loadFbSdk(appId)

  return new Promise<EmbeddedSignupResult>((resolve, reject) => {
    let code: string | null = null
    let sessionInfo: SessionInfo | null = null
    let timeoutId: number | undefined
    let settled = false
    // Only an explicit CANCEL from the signup popup counts as a user cancel;
    // anything else that yields no code is a real failure worth surfacing.
    let sawExplicitCancel = false

    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
    const done = (result: EmbeddedSignupResult) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }
    const fail = (reason: EmbeddedSignupReason) => {
      if (settled) return
      settled = true
      cleanup()
      reject(new EmbeddedSignupError(reason))
    }
    const tryComplete = () => {
      if (code && sessionInfo) {
        done({ code, ...sessionInfo })
      }
    }

    function onMessage(event: MessageEvent) {
      if (!isFacebookOrigin(event.origin)) return
      let parsed: unknown
      try {
        parsed =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        return
      }
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        (parsed as { type?: unknown }).type !== 'WA_EMBEDDED_SIGNUP'
      ) {
        return
      }
      const message = parsed as { event?: string; data?: unknown }
      // The signup popup is the only source of waba_id/phone_number_id, so log
      // what it reports — a timeout here is otherwise impossible to diagnose.
      console.info(
        'WhatsApp embedded signup event:',
        message.event ?? 'unknown',
        message.data ?? {},
      )
      if (message.event === 'CANCEL') {
        sawExplicitCancel = true
        fail('cancelled')
        return
      }
      const info = parseSessionInfo(message.data)
      if (info) {
        sessionInfo = info
        tryComplete()
      } else if (message.event === 'FINISH') {
        // Finished without ids — the config is not a WhatsApp Embedded Signup
        // configuration, so there is nothing to connect.
        console.error(
          'WhatsApp embedded signup: FINISH carried no phone_number_id/waba_id',
        )
        fail('missing_session_info')
      }
    }

    window.addEventListener('message', onMessage)

    fb.login(
      (response) => {
        const receivedCode = response.authResponse?.code
        if (!receivedCode) {
          // No code and no CANCEL event means the login genuinely failed
          // (popup blocked, bad config_id, app misconfigured) — do not swallow it.
          if (!sawExplicitCancel) {
            console.error(
              'WhatsApp embedded signup: FB.login returned no code',
              response.status ?? 'no status',
            )
          }
          fail(sawExplicitCancel ? 'cancelled' : 'login_failed')
          return
        }
        code = receivedCode
        // Guard against the session-info postMessage never arriving.
        timeoutId = window.setTimeout(() => {
          fail(sessionInfo ? 'missing_session_info' : 'timeout')
        }, SESSION_INFO_TIMEOUT_MS)
        tryComplete()
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
      },
    )
  })
}
