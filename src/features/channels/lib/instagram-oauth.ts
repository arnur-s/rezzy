/**
 * Instagram API with Instagram Login (Business Login) OAuth launcher.
 *
 * Unlike WhatsApp Embedded Signup (Facebook JS SDK), Instagram Login uses the
 * classic redirect OAuth flow. We open a popup to instagram.com/oauth/authorize
 * with a server-issued one-time `state`, and a same-origin callback route posts
 * the returned `code` + `state` back to the opener. The backend
 * (`instagram-connect-channel`) exchanges the code for a long-lived token.
 */

const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize'
export const INSTAGRAM_SCOPES =
  'instagram_business_basic,instagram_business_manage_messages'
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000
const POPUP_FEATURES = 'popup=yes,width=600,height=760'

export type InstagramOAuthReason =
  | 'not_configured'
  | 'insecure_context'
  | 'popup_blocked'
  | 'cancelled'
  | 'state_mismatch'
  | 'timeout'
  | 'oauth_error'

export class InstagramOAuthError extends Error {
  readonly reason: InstagramOAuthReason

  constructor(reason: InstagramOAuthReason) {
    super(reason)
    this.name = 'InstagramOAuthError'
    this.reason = reason
  }
}

export type InstagramOAuthResult = {
  code: string
  state: string
}

/** Message the same-origin callback route posts back to the opener. */
export const INSTAGRAM_OAUTH_MESSAGE_TYPE = 'INSTAGRAM_OAUTH'

export function getInstagramRedirectUri(): string {
  const configured = import.meta.env.VITE_INSTAGRAM_REDIRECT_URI
  if (configured && configured.trim().length > 0) return configured.trim()
  return `${window.location.origin}/instagram-callback`
}

export function isInstagramOAuthConfigured(): boolean {
  return !!import.meta.env.VITE_INSTAGRAM_APP_ID
}

/**
 * Instagram requires an HTTPS redirect URI; on http the callback never returns.
 * The callback also relies on `window.opener`, so it must be same-origin.
 */
export function isSecureContextForInstagramLogin(): boolean {
  return window.location.protocol === 'https:'
}

function isSameOrigin(uri: string): boolean {
  try {
    return new URL(uri, window.location.origin).origin === window.location.origin
  } catch {
    return false
  }
}

export function buildInstagramAuthorizeUrl(params: {
  appId: string
  redirectUri: string
  state: string
}): string {
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set('client_id', params.appId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', INSTAGRAM_SCOPES)
  url.searchParams.set('state', params.state)
  return url.toString()
}

export type ParsedOAuthMessage = {
  code: string | null
  state: string | null
  error: string | null
}

/** Parses the callback route's postMessage payload. Pure + testable. */
export function parseOAuthMessage(data: unknown): ParsedOAuthMessage | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (record.type !== INSTAGRAM_OAUTH_MESSAGE_TYPE) return null
  return {
    code: typeof record.code === 'string' ? record.code : null,
    state: typeof record.state === 'string' ? record.state : null,
    error: typeof record.error === 'string' ? record.error : null,
  }
}

/** Maps Instagram's `error` / `error_reason` param to a launcher reason. */
export function mapOAuthErrorParam(error: string): InstagramOAuthReason {
  const normalized = error.toLowerCase()
  if (normalized.includes('denied') || normalized.includes('cancel')) {
    return 'cancelled'
  }
  return 'oauth_error'
}

function waitForResult(
  popup: Window,
  expectedState: string,
): Promise<InstagramOAuthResult> {
  return new Promise<InstagramOAuthResult>((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      window.clearInterval(pollId)
      window.clearTimeout(timeoutId)
    }
    const done = (result: InstagramOAuthResult) => {
      if (settled) return
      settled = true
      cleanup()
      try {
        popup.close()
      } catch {
        /* ignore */
      }
      resolve(result)
    }
    const fail = (reason: InstagramOAuthReason) => {
      if (settled) return
      settled = true
      cleanup()
      try {
        popup.close()
      } catch {
        /* ignore */
      }
      reject(new InstagramOAuthError(reason))
    }

    function onMessage(event: MessageEvent) {
      // The callback route is same-origin; reject anything else outright.
      if (event.origin !== window.location.origin) return
      const parsed = parseOAuthMessage(event.data)
      if (!parsed) return
      if (parsed.error) {
        fail(mapOAuthErrorParam(parsed.error))
        return
      }
      if (parsed.code && parsed.state) {
        if (parsed.state !== expectedState) {
          fail('state_mismatch')
          return
        }
        done({ code: parsed.code, state: parsed.state })
      }
    }

    window.addEventListener('message', onMessage)
    const pollId = window.setInterval(() => {
      if (popup.closed) fail('cancelled')
    }, 500)
    const timeoutId = window.setTimeout(() => fail('timeout'), OAUTH_TIMEOUT_MS)
  })
}

/**
 * Launches the Instagram authorization popup. Opens the popup synchronously
 * (inside the user gesture) so it is not blocked, then resolves the one-time
 * `state` via `getState` before navigating. If `getState` rejects, the
 * placeholder popup is closed and the error is rethrown.
 */
export async function launchInstagramOAuth({
  getState,
}: {
  getState: () => Promise<string>
}): Promise<InstagramOAuthResult> {
  const appId = import.meta.env.VITE_INSTAGRAM_APP_ID
  if (!appId) {
    throw new InstagramOAuthError('not_configured')
  }
  if (!isSecureContextForInstagramLogin()) {
    throw new InstagramOAuthError('insecure_context')
  }
  const redirectUri = getInstagramRedirectUri()
  if (!isSameOrigin(redirectUri)) {
    // A cross-origin redirect URI can't post back through window.opener.
    throw new InstagramOAuthError('not_configured')
  }

  const popup = window.open('about:blank', 'instagram_oauth', POPUP_FEATURES)
  if (!popup) {
    throw new InstagramOAuthError('popup_blocked')
  }

  let state: string
  try {
    state = await getState()
  } catch (error) {
    popup.close()
    throw error
  }
  if (!state) {
    popup.close()
    throw new InstagramOAuthError('oauth_error')
  }

  popup.location.href = buildInstagramAuthorizeUrl({ appId, redirectUri, state })
  return waitForResult(popup, state)
}
