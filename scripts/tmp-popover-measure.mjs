import { chromium } from 'playwright'

const OUT =
  '/private/tmp/claude-501/-Users-arnurkupanov-cms/23f5b0b2-74dd-42b4-878a-5b7ce6e55b61/scratchpad'
const BASE = 'http://localhost:3201'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle' })
await page.getByPlaceholder(/email/i).fill('ncase01@gmail.com')
await page.locator('input[type="password"]').fill('123456789')
await page.locator('input[type="password"]').press('Enter')
await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
await page.waitForTimeout(4000)

await page.getByRole('link', { name: /notifications/i }).first().click().catch(async () => {
  await page.getByText(/notifications/i).first().click()
})
await page.waitForTimeout(1500)

const surface = page.locator('.astryx-popover, [class*="popover"]').first()
const info = await page.evaluate(() => {
  const dialog =
    document.querySelector('[popover]:popover-open') ??
    document.querySelector('[role="dialog"]')
  if (!dialog) return { error: 'no popover' }
  const inner = dialog.querySelector('div')
  const box = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      x: Math.round(r.x),
      w: Math.round(r.width),
      h: Math.round(r.height),
      pad: cs.padding,
      radius: cs.borderRadius,
      overflow: cs.overflow,
      cls: el.className?.toString().slice(0, 90),
    }
  }
  const title = dialog.querySelector('p')
  const row = dialog.querySelector('li button')
  const avatar = row?.querySelector('div')
  const rule = dialog.querySelector('.border-t')
  return {
    dialog: box(dialog),
    inner: box(inner),
    title: title
      ? { x: Math.round(title.getBoundingClientRect().x), pad: getComputedStyle(title).padding }
      : null,
    row: row
      ? {
          x: Math.round(row.getBoundingClientRect().x),
          h: Math.round(row.getBoundingClientRect().height),
          pad: getComputedStyle(row).padding,
        }
      : null,
    avatarX: avatar ? Math.round(avatar.getBoundingClientRect().x) : null,
    rule: rule
      ? {
          x: Math.round(rule.getBoundingClientRect().x),
          w: Math.round(rule.getBoundingClientRect().width),
        }
      : null,
    rowCount: dialog.querySelectorAll('li').length,
  }
})
console.log(JSON.stringify(info, null, 2))

await surface.screenshot({ path: `${OUT}/pop-before.png` }).catch(async () => {
  await page.screenshot({ path: `${OUT}/pop-before.png` })
})

await browser.close()
