import type { ChildProcess } from 'node:child_process'
import type { Browser } from 'playwright'
import type { LottiePlayer } from 'lottie-react'
import { chromium } from 'playwright'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { localRequestsOnly, startVite } from './server'

const PORT = 3216
let server: ChildProcess | undefined
let browser: Browser | undefined

beforeAll(async () => {
  server = await startVite(PORT)
  browser = await chromium.launch()
})
afterAll(async () => {
  await browser?.close()
  server?.kill('SIGTERM')
})

it('renders sticker vectors without executing embedded expressions', async () => {
  if (!browser) throw new Error('Browser fixture has not started')
  const context = await browser.newContext()
  await localRequestsOnly(context, PORT)
  try {
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:${PORT}/sign-in`)
    await page.addScriptTag({
      type: 'module',
      content:
        "import { LottiePlayer } from '/e2e/fixtures/lottie-player.ts'; globalThis.__rezzyLottiePlayer = LottiePlayer;",
    })
    await page.waitForFunction(() =>
      Boolean(Reflect.get(globalThis, '__rezzyLottiePlayer')),
    )
    const result = await page.evaluate(async () => {
      // Vite resolves this installed entry exactly as the lazy sticker import,
      // including the lottie-web alias. No mocked canvas or player behavior.
      const player = Reflect.get(
        globalThis,
        '__rezzyLottiePlayer',
      ) as typeof LottiePlayer
      const container = document.createElement('div')
      document.body.append(container)
      const animation = player.loadAnimation({
        container,
        renderer: 'svg',
        autoplay: false,
        loop: false,
        animationData: {
          v: '5.7.4',
          fr: 30,
          ip: 0,
          op: 30,
          w: 64,
          h: 64,
          assets: [],
          layers: [
            {
              ty: 4,
              ind: 1,
              st: 0,
              ip: 0,
              op: 30,
              nm: 'Sticker',
              ks: {
                o: {
                  a: 0,
                  k: 100,
                  x: 'globalThis.__rezzyStickerExpression = true; $bm_rt = 100;',
                },
                r: { a: 0, k: 0 },
                p: { a: 0, k: [32, 32, 0] },
                a: { a: 0, k: [0, 0, 0] },
                s: { a: 0, k: [100, 100, 100] },
              },
              shapes: [
                {
                  ty: 'rc',
                  d: 1,
                  s: { a: 0, k: [24, 24] },
                  p: { a: 0, k: [0, 0] },
                  r: { a: 0, k: 3 },
                },
                {
                  ty: 'fl',
                  c: { a: 0, k: [1, 0, 0, 1] },
                  o: { a: 0, k: 100 },
                  r: 1,
                },
              ],
            },
          ],
        },
      })
      await new Promise<void>((resolve, reject) => {
        animation.addEventListener('DOMLoaded', () => resolve())
        animation.addEventListener('data_failed', () =>
          reject(new Error('Sticker did not load')),
        )
      })
      const outcome = {
        rendered: container.querySelector('svg path') !== null,
        expressionExecuted:
          Reflect.get(globalThis, '__rezzyStickerExpression') === true,
      }
      animation.destroy()
      container.remove()
      return outcome
    })
    expect(result).toEqual({ rendered: true, expressionExecuted: false })
  } finally {
    await context.close()
  }
})
