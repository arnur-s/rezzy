/**
 * Renders every status surface the product actually draws — banners, inline
 * error wells, badges, destructive buttons, status text — in both color modes,
 * on one page, so the palette can be judged as a set rather than hunted for
 * across sixteen routes.
 *
 * `pnpm i18n:shots` photographs real routes, which is the right check for copy
 * and layout. It is the wrong check for a palette: most routes show no status at
 * all in a healthy fixture, and the ones that do show a single banner in
 * isolation, where "too dark" is invisible. Judging a status ramp needs the
 * three hues side by side, at every weight the code uses, against the page they
 * sit on.
 *
 * Drives the real bundle, so the tokens are the shipped ones.
 *
 * Usage: pnpm build && node scripts/status-shots.mjs
 * Output: .screenshots/status/<mode>.png
 */
import { hasBuild, serveDist } from './serve-dist.mjs'
import { mkdirSync, rmSync } from 'node:fs'
import { chromium } from 'playwright'
import path from 'node:path'
import process from 'node:process'

const PORT = 4177
const BASE = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`
const OWNS_SERVER = !process.env.BASE_URL
const OUT_DIR = path.join('.screenshots', 'status')

if (OWNS_SERVER && !hasBuild()) {
  console.error('No dist/ build found. Run `pnpm build` first.')
  process.exit(1)
}

/**
 * The specimen sheet. Built from raw tokens rather than Astryx components on
 * purpose: this has to render without a router, a query client, or a session,
 * and every surface below is a faithful copy of a real one in `src/`.
 */
const SHEET = `
<style>
  body {
    margin: 0;
    padding: 24px;
    background: var(--color-background-body);
    color: var(--color-text-primary);
    font-family: var(--font-family-body);
    font-size: var(--font-size-sm);
  }
  h2 {
    font-size: var(--font-size-base);
    font-weight: 600;
    margin: 24px 0 8px;
  }
  h2:first-of-type { margin-top: 0; }
  .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
  .col { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
  .caption {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    margin-bottom: 4px;
  }
  /* Inline query error — src/features/dashboard/components/section-error.tsx */
  .inline-error {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    background: color-mix(in srgb, var(--color-error) 10%, transparent);
    color: var(--color-error);
    border-radius: 12px; padding: 8px 12px;
  }
  /* Banner well — src/themes/gothic/gothicTheme.ts banner overrides */
  .banner {
    border-radius: var(--radius-element);
    padding: 12px 16px;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
  }
  .banner-success { background: var(--color-success-muted); color: var(--color-text-green); }
  .banner-error   { background: var(--color-error-muted);   color: var(--color-text-red); }
  .banner-warning { background: var(--color-warning-muted); color: var(--color-text-yellow); }
  .banner-info    { background: light-dark(#d5e0f4, #a3b5d6); color: var(--color-text-blue); }
  .banner strong { display: block; font-weight: 600; }
  .banner span { font-size: var(--font-size-sm); opacity: 0.9; }
  .banner .action {
    border: 0; border-radius: 4px; padding: 8px 12px;
    font-family: inherit; font-size: var(--font-size-sm); font-weight: 500;
    white-space: nowrap;
  }
  .banner-success .action { background: var(--color-text-green);  color: var(--color-success-muted); }
  .banner-error   .action { background: var(--color-text-red);    color: var(--color-error-muted); }
  .banner-warning .action { background: var(--color-text-yellow); color: var(--color-warning-muted); }
  .banner-info    .action { background: var(--color-text-blue);   color: light-dark(#d5e0f4, #a3b5d6); }
  /* Badge — theme badge variants */
  .badge {
    border-radius: var(--radius-element); padding: 2px 6px;
    font-size: var(--font-size-xs); font-weight: 500;
  }
  .badge-success { background: var(--color-background-green);  color: var(--color-text-green); }
  .badge-warning { background: var(--color-background-yellow); color: var(--color-text-yellow); }
  .badge-error   { background: var(--color-background-red);    color: var(--color-text-red); }
  .badge-info    { background: var(--color-background-blue);   color: var(--color-text-blue); }
  .badge-neutral { background: var(--color-background-gray);   color: var(--color-text-gray); }
  /* Destructive button — theme button override */
  .btn-destructive {
    background: var(--color-error); color: var(--color-on-error);
    border: 0; border-radius: 4px; padding: 8px 12px;
    font-family: inherit; font-size: var(--font-size-sm); font-weight: 500;
  }
  .btn-primary {
    background: var(--color-accent); color: var(--color-on-accent);
    border: 0; border-radius: 4px; padding: 8px 12px;
    font-family: inherit; font-size: var(--font-size-sm); font-weight: 500;
  }
  .btn-secondary {
    background: var(--color-background-gray); color: var(--color-text-gray);
    border: 0; border-radius: 4px; padding: 8px 12px;
    font-family: inherit; font-size: var(--font-size-sm); font-weight: 500;
  }
  /* Failed message bubble — message-bubble.tsx */
  .bubble-failed {
    background: color-mix(in srgb, var(--color-error) 12%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-error) 70%, transparent);
    border-radius: 12px; padding: 12px; max-width: 320px;
  }
  .bubble-meta { font-size: var(--font-size-xs); color: var(--color-error); margin-top: 6px; }
  /* Status text on the page and on a card */
  .card {
    background: var(--color-background-card); box-shadow: var(--shadow-low);
    border-radius: 12px; padding: 16px; max-width: 420px;
  }
  .status-text-success { color: var(--color-success); }
  .status-text-error   { color: var(--color-error); }
  .status-text-warning { color: var(--color-warning); }
  /* Warning note — connect-*-form.tsx */
  .warning-note {
    border: 1px dashed color-mix(in srgb, var(--color-warning) 40%, transparent);
    background: color-mix(in srgb, var(--color-warning) 10%, transparent);
    color: var(--color-text-secondary);
    border-radius: 12px; padding: 16px; font-size: var(--font-size-xs);
  }
  /* Success confirmation — profile-form.tsx / attention-list.tsx */
  .success-line { color: var(--color-success); display: flex; align-items: center; gap: 6px; }
  .success-dot {
    width: 32px; height: 32px; border-radius: 9999px;
    background: color-mix(in srgb, var(--color-success) 12%, transparent);
    color: var(--color-success);
    display: flex; align-items: center; justify-content: center;
  }
  .chip-outline {
    border: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
    border-radius: 12px; padding: 4px 8px; font-size: var(--font-size-xs);
  }
</style>

<h2>Banners (full-measure status surfaces)</h2>
<div class="col">
  <div class="banner banner-info"><div><strong>Информация</strong><span>Сессия истекла. Войдите снова.</span></div><button class="action">Войти</button></div>
  <div class="banner banner-success"><div><strong>Канал подключён</strong><span>Telegram готов принимать сообщения.</span></div><button class="action">Открыть</button></div>
  <div class="banner banner-warning"><div><strong>Требуется внимание</strong><span>Токен канала истекает через 3 дня.</span></div><button class="action">Обновить</button></div>
  <div class="banner banner-error"><div><strong>Не удалось загрузить</strong><span>Проверьте соединение и попробуйте снова.</span></div><button class="action">Повторить</button></div>
</div>

<h2>Inline query errors (bg-error/10)</h2>
<div class="col">
  <div class="inline-error"><span>Не удалось загрузить диалоги</span><span>Повторить</span></div>
  <div class="warning-note">Instagram требует HTTPS. Настройте домен перед подключением канала.</div>
</div>

<h2>Status text on the page / on a card</h2>
<div class="row">
  <span class="status-text-success">Пароль обновлён</span>
  <span class="status-text-warning">Ожидает подтверждения</span>
  <span class="status-text-error">Введите корректный адрес</span>
</div>
<div class="card">
  <div class="caption">Карточка (auth / диалог)</div>
  <div class="row">
    <span class="status-text-success">Сохранено</span>
    <span class="status-text-warning">Проверьте данные</span>
    <span class="status-text-error">Неверный пароль</span>
  </div>
</div>

<h2>Badges (categorical chips)</h2>
<div class="row">
  <span class="badge badge-info">12 новых</span>
  <span class="badge badge-neutral">Черновик</span>
  <span class="badge badge-success">Решено</span>
  <span class="badge badge-warning">Ожидает</span>
  <span class="badge badge-error">Ошибка</span>
  <span class="chip-outline">Telegram · активен</span>
</div>

<h2>Buttons</h2>
<div class="row">
  <button class="btn-primary">Сохранить</button>
  <button class="btn-secondary">Отмена</button>
  <button class="btn-destructive">Удалить рабочее пространство</button>
</div>

<h2>Failed message bubble</h2>
<div class="bubble-failed">
  Привет! Отправляю договор на согласование.
  <div class="bubble-meta">14:22 · Не отправлено · Повторить</div>
</div>

<h2>Success affordances</h2>
<div class="row">
  <div class="success-dot">✓</div>
  <span class="success-line">Все диалоги обработаны</span>
</div>
`

rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })

const server = OWNS_SERVER ? await serveDist(PORT) : null
const browser = await chromium.launch()

try {
  for (const mode of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 900, height: 1400 },
      colorScheme: mode,
      deviceScaleFactor: 2,
    })
    const page = await context.newPage()

    // Load the real app first so its stylesheet (tokens, fonts, layers) is in
    // the document, then replace the body with the specimen sheet. Injecting
    // the CSS by hand would be a copy of the theme rather than the theme.
    await page.goto(BASE + '/sign-in', { waitUntil: 'networkidle' })
    await page.evaluate(
      ([html, m]) => {
        document.documentElement.classList.remove('light', 'dark')
        document.documentElement.classList.add(m)
        document.documentElement.setAttribute('data-theme', m)
        document.documentElement.style.colorScheme = m
        // Replacing the app body removes Astryx's runtime <Theme> wrapper.
        // Restore the generated gothic theme scope on the new root so the
        // specimen exercises the shipped tokens rather than Astryx defaults.
        document.body.setAttribute('data-astryx-theme', 'gothic')
        document.body.innerHTML = html
      },
      [SHEET, mode],
    )
    await page.waitForTimeout(400)
    await page.screenshot({
      path: path.join(OUT_DIR, `${mode}.png`),
      fullPage: true,
    })
    console.log(`${mode}: ${path.join(OUT_DIR, `${mode}.png`)}`)
    await context.close()
  }
} finally {
  await browser.close()
  server?.close()
}
