import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmojiPicker } from './emoji-picker'

// The picker reads the active theme to match emoji-mart's palette to the app's,
// and `useTheme` throws outside its provider. Stubbed rather than wrapped in the
// real ThemeProvider, which reads localStorage that this environment does not
// provide — and which would put this test's subject back behind a second
// moving part it is not meant to be testing.
vi.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ theme: 'light' }),
}))

/**
 * `EmojiPicker` is behind `React.lazy`, so a broken dynamic import fails at
 * runtime on first open rather than at build time. TypeScript cannot see
 * through `import()`, which makes this the only thing standing between a
 * bundling change and an empty panel in production.
 */
describe('EmojiPicker', () => {
  it('resolves the lazy import and renders emoji-mart', async () => {
    const { container } = render(<EmojiPicker onEmojiSelect={vi.fn()} />)

    // emoji-mart mounts a custom <em-emoji-picker> element. Asserting on it
    // proves both dynamic imports resolved and the component rendered, rather
    // than merely that Suspense settled.
    await waitFor(
      () => {
        expect(container.querySelector('em-emoji-picker')).not.toBeNull()
      },
      { timeout: 20_000 },
    )
  }, 30_000)
})

/**
 * `lazy-lottie` carries the same risk, with one extra hazard: `lottie-react` is
 * published as CJS, so a bundler may hand the component back as `mod.default`
 * or as `mod.default.default`. Picking the wrong one rejects the lazy boundary
 * and shows a permanent skeleton where a sticker should be.
 *
 * `lottie-web` acquires a canvas 2D context at module scope, which jsdom does
 * not implement, so the player cannot mount here. Stubbing the module lets the
 * unwrap logic — the part that is actually ours — be exercised against both
 * shapes it has to survive.
 */
describe('lazy-lottie default-export unwrap', () => {
  const StubPlayer = () => null

  it.each([
    ['single-wrapped (ESM interop)', { default: StubPlayer }],
    ['double-wrapped (CJS interop)', { default: { default: StubPlayer } }],
  ])('resolves the component when the module is %s', async (_label, mod) => {
    vi.resetModules()
    vi.doMock('lottie-react', () => mod)

    const { LazyLottie } = await import('./lazy-lottie')
    // `React.lazy` stores the loader on the payload; invoking it directly is
    // what a Suspense render would do, without needing the DOM the player wants.
    const resolved = await (
      LazyLottie as unknown as { _payload: { _result: () => Promise<unknown> } }
    )._payload._result()

    expect((resolved as { default: unknown }).default).toBe(StubPlayer)

    vi.doUnmock('lottie-react')
  })
})
