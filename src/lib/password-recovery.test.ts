import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The recovery-link snapshot reads `window.location` at module evaluation, so
 * each case has to set the URL and then import the module fresh.
 */
async function loadWith(url: string) {
  vi.resetModules()
  const target = new URL(url)
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      ...window.location,
      href: target.href,
      hash: target.hash,
      search: target.search,
      pathname: target.pathname,
    },
  })
  return import('./password-recovery')
}

describe('isPasswordRecoveryLink', () => {
  const original = window.location

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: original,
    })
  })

  /**
   * Supabase consumes the recovery fragment during boot and emits
   * `PASSWORD_RECOVERY` from a `setTimeout(…, 0)`. `/password-reset` is
   * code-split, so its component subscribes strictly after that fires: relying
   * on the event alone left someone who had just clicked the emailed link
   * staring at the "email me a link" form. This snapshot is what closes the
   * race, so these pin the shapes it has to recognize.
   */
  it('recognizes the implicit-grant recovery fragment', async () => {
    const { isPasswordRecoveryLink } = await loadWith(
      'https://app.test/password-reset#access_token=abc&refresh_token=def&type=recovery',
    )
    expect(isPasswordRecoveryLink()).toBe(true)
  })

  it('recognizes a recovery marker in the query string', async () => {
    const { isPasswordRecoveryLink } = await loadWith(
      'https://app.test/password-reset?code=abc&type=recovery',
    )
    expect(isPasswordRecoveryLink()).toBe(true)
  })

  it('does not claim recovery for a plain visit', async () => {
    const { isPasswordRecoveryLink } = await loadWith(
      'https://app.test/password-reset',
    )
    expect(isPasswordRecoveryLink()).toBe(false)
  })

  it('does not mistake a sign-in callback for a recovery', async () => {
    // Same fragment shape, different type: this one must fall through to the
    // request form rather than asking for a new password.
    const { isPasswordRecoveryLink } = await loadWith(
      'https://app.test/password-reset#access_token=abc&type=signup',
    )
    expect(isPasswordRecoveryLink()).toBe(false)
  })
})
