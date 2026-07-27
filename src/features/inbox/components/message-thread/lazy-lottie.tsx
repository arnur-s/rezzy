import type { LottieComponentProps } from 'lottie-react'
import { lazy } from 'react'

/**
 * Lottie player, loaded only when a Telegram animated sticker is actually
 * rendered.
 *
 * `lottie-react` bundles `lottie-web`, a full SVG/canvas animation runtime
 * (~250 kB raw). A static import put it in the conversation chunk, so every
 * thread paid for it whether or not it contained a `.tgs` sticker, which most
 * do not.
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
