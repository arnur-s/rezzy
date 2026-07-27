/**
 * Snapshots whether this page load arrived from a password-recovery link.
 *
 * Supabase puts the recovery tokens in the URL fragment and, on boot, consumes
 * them: it saves the session, strips the fragment, and emits
 * `PASSWORD_RECOVERY` from a `setTimeout(…, 0)`. All of that happens while the
 * app is still starting, and the `/password-reset` route is code-split, so its
 * component subscribes to the auth events strictly after the one it cares about
 * has already fired. Subscribing alone therefore never sees it — the reset page
 * sat on its "email me a link" form for a user who had just clicked the link.
 *
 * This module reads the fragment at import time and is imported first in
 * `main.tsx`, before the Supabase client is constructed, so the answer is
 * captured before anything can erase it.
 */

function readRecoveryIntent(): boolean {
  if (typeof window === 'undefined') return false

  // Implicit grant: `#access_token=…&type=recovery`.
  const hash = window.location.hash.replace(/^#/, '')
  if (new URLSearchParams(hash).get('type') === 'recovery') return true

  // PKCE: `?code=…`, with the recovery marker stored beside the verifier.
  // Supabase reports the type through the event in that flow, so the query
  // string only has to be recognized, not decoded.
  const search = new URLSearchParams(window.location.search)
  return search.get('type') === 'recovery'
}

const arrivedFromRecoveryLink = readRecoveryIntent()

/** True when this page load came from a password-recovery link. */
export function isPasswordRecoveryLink(): boolean {
  return arrivedFromRecoveryLink
}
