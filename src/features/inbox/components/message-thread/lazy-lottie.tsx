import type { LottieComponentProps } from 'lottie-react'
import { lazy } from 'react'

/**
 * Lottie player, loaded only when a Telegram animated sticker is actually
 * rendered.
 *
 * Vite resolves `lottie-web` to its expression-free light SVG player. Keep it
 * lazy so ordinary conversations do not load the sticker runtime.
 *
 * Some bundlers deliver this CJS-published default export wrapped as
 * `{ default: Component }`; the unwrap below keeps that defence, now applied
 * once at load time rather than on every render.
 */
type LottieComponent = (props: LottieComponentProps) => React.ReactElement

export const LazyLottie = lazy(async () => {
  const mod = await import('lottie-react')
  const resolved =
    (mod.default as unknown as { default?: LottieComponent }).default ??
    mod.default

  return { default: resolved }
})
