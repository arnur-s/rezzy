import type { ChildProcess } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page } from 'playwright'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../src/api/types'
import en from '../messages/en.json'
import ru from '../messages/ru.json'
import { LOCAL_API, localRequestsOnly, startVite } from './server'

const PORT = 3215
const BASE_URL = `http://127.0.0.1:${PORT}`
type Account = { id: string; email: string; password: string }
let admin: SupabaseClient<Database>
let browser: Browser
let server: ChildProcess
let owner: Account
let member: Account
let newcomer: Account
let workspaceId: string
let conversationId: string
const accounts: Array<Account> = []
const contexts: Array<BrowserContext> = []

// Credentials exist only in memory, come from the local CLI, and are never
// logged or persisted. A hosted URL is rejected before any request or write.
function localConfig(): { anonKey: string; serviceKey: string } {
  const result = spawnSync('supabase status --output json', {
    shell: true,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0)
    throw new Error(
      'Browser workflows require pnpm supabase:start (local only).',
    )
  const value: Record<string, unknown> = JSON.parse(result.stdout)
  if (
    typeof value.API_URL !== 'string' ||
    !['127.0.0.1', 'localhost'].includes(new URL(value.API_URL).hostname)
  ) {
    throw new Error('Browser fixtures refuse a non-local Supabase target.')
  }
  if (
    typeof value.ANON_KEY !== 'string' ||
    typeof value.SERVICE_ROLE_KEY !== 'string'
  ) {
    throw new Error('Local Supabase did not expose fixture keys.')
  }
  return { anonKey: value.ANON_KEY, serviceKey: value.SERVICE_ROLE_KEY }
}

async function createAccount(name: string): Promise<Account> {
  const email = `browser-${randomUUID()}@example.invalid`
  const password = `${randomUUID()}Aa1!`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })
  if (error)
    throw new Error('Unable to create a local browser fixture account.')
  const account = { id: data.user.id, email, password }
  accounts.push(account)
  return account
}

beforeAll(async () => {
  const { anonKey, serviceKey } = localConfig()
  admin = createClient<Database>(LOCAL_API, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  owner = await createAccount('Audit Owner')
  member = await createAccount('Audit Member')
  newcomer = await createAccount('Audit Newcomer')
  const ownerClient = createClient<Database>(LOCAL_API, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const login = await ownerClient.auth.signInWithPassword(owner)
  if (login.error) throw new Error('Unable to sign in the local fixture owner.')
  const created = await ownerClient.rpc('complete_onboarding', {
    p_workspace_name: 'Browser audit workspace',
  })
  if (created.error || !created.data[0])
    throw new Error('Unable to seed the local fixture workspace.')
  workspaceId = created.data[0].workspace_id
  const membership = await admin
    .from('workspace_members')
    .insert({ workspace_id: workspaceId, user_id: member.id, role: 'member' })
  if (membership.error) throw new Error('Unable to seed local membership.')
  const contact = await admin
    .from('contacts')
    .insert({
      workspace_id: workspaceId,
      name: 'Browser Inbox Customer',
      source: 'manual',
    })
    .select('id')
    .single()
  const channel = await admin
    .from('channels')
    .insert({
      workspace_id: workspaceId,
      type: 'telegram',
      name: 'Local fixture channel',
      is_active: true,
    })
    .select('id')
    .single()
  if (!contact.data || !channel.data)
    throw new Error('Unable to seed the local inbox fixture.')
  const conversation = await admin
    .from('conversations')
    .insert({
      workspace_id: workspaceId,
      channel_id: channel.data.id,
      contact_id: contact.data.id,
      status: 'open',
      external_thread_id: randomUUID(),
    })
    .select('id')
    .single()
  if (!conversation.data)
    throw new Error('Unable to seed the local conversation fixture.')
  conversationId = conversation.data.id
  const message = await admin.from('messages').insert({
    workspace_id: workspaceId,
    conversation_id: conversationId,
    direction: 'inbound',
    type: 'text',
    content: 'Local browser regression message',
    external_id: randomUUID(),
    status: 'delivered',
  })
  if (message.error)
    throw new Error('Unable to seed the local message fixture.')
  server = await startVite(PORT, anonKey)
  browser = await chromium.launch()
})

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

afterAll(async () => {
  if (typeof browser !== 'undefined') await browser.close()
  if (typeof server !== 'undefined') server.kill('SIGTERM')
  if (accounts.length) {
    const owned = await admin
      .from('workspaces')
      .select('id')
      .in(
        'created_by',
        accounts.map((account) => account.id),
      )
    const ids = owned.data?.map((workspace) => workspace.id) ?? []
    // Composite workspace FKs deliberately use NO ACTION. Delete only this
    // run's fixtures in child-first order instead of resetting shared local DB.
    if (ids.length) {
      for (const table of [
        'messages',
        'conversations',
        'contact_channels',
        'contacts',
        'channels',
      ] as const) {
        const deleted = await admin.from(table).delete().in('workspace_id', ids)
        if (deleted.error)
          throw new Error(
            `Local fixture cleanup failed for ${table} (${deleted.error.code}).`,
          )
      }
    }
    const removed = await admin
      .from('workspaces')
      .delete()
      .in(
        'created_by',
        accounts.map((account) => account.id),
      )
    if (removed.error)
      throw new Error(
        `Local browser workspace cleanup failed (${removed.error.code}): ${removed.error.message}`,
      )
    for (const account of accounts) {
      const removedUser = await admin.auth.admin.deleteUser(account.id)
      if (removedUser.error)
        throw new Error('Local browser account cleanup failed.')
    }
  }
})

async function newPage(
  locale = 'en',
  mode: 'light' | 'dark' = 'light',
  width = 1280,
) {
  const context = await browser.newContext({
    locale,
    colorScheme: mode,
    viewport: { width, height: 900 },
  })
  contexts.push(context)
  await localRequestsOnly(context, PORT)
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  return page
}

async function signIn(page: Page, account: Account) {
  await page.goto(`${BASE_URL}/sign-in`)
  await page.getByLabel('Email', { exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  const response = page.waitForResponse(
    (result) => new URL(result.url()).pathname === '/auth/v1/token',
  )
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  expect((await response).status()).toBe(200)
  await page.waitForURL((url) => url.pathname !== '/sign-in')
}

async function assertNoOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1)
}

async function assertReadableText(page: Page) {
  const tooSmall = await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    )
    const failures: Array<string> = []
    let node = walker.nextNode()
    while (node) {
      const parent = node.parentElement
      if (
        node.textContent?.trim() &&
        parent instanceof HTMLElement &&
        parent.getClientRects().length
      ) {
        const style = getComputedStyle(parent)
        if (
          style.visibility !== 'hidden' &&
          Number.parseFloat(style.fontSize) < 12
        )
          failures.push(`${parent.tagName}: ${style.fontSize}`)
      }
      node = walker.nextNode()
    }
    return failures
  })
  expect(tooSmall).toEqual([])
}

describe('local product workflows', () => {
  it('renders and validates auth in both languages, themes and viewport sizes', async () => {
    for (const locale of ['en', 'ru'])
      for (const mode of ['light', 'dark'] as const)
        for (const width of [375, 1280]) {
          const copy = locale === 'en' ? en : ru
          const page = await newPage(locale, mode, width)
          await page.goto(`${BASE_URL}/sign-in`)
          await page
            .getByRole('button', { name: copy.common_sign_in, exact: true })
            .click()
          await page
            .getByText(copy.auth_sign_in_email_invalid, { exact: true })
            .waitFor()
          expect(
            await page
              .getByLabel(copy.common_email, { exact: true })
              .evaluate((input) => input === document.activeElement),
          ).toBe(true)
          expect(await page.locator('html').getAttribute('lang')).toBe(locale)
          await assertNoOverflow(page)
          await assertReadableText(page)
          // Resolve theme variables through actual browser computed styles. This
          // catches cascade/layer mistakes a hex-only unit assertion cannot see.
          const ratios = await page.locator('form').evaluate((form) => {
            const probe = document.createElement('span')
            form.append(probe)
            function rgb(token: string) {
              probe.style.color = `var(${token})`
              return getComputedStyle(probe)
                .color.match(/[\d.]+/g)!
                .slice(0, 3)
                .map(Number)
            }
            function luminance(values: Array<number>) {
              const linear = values.map((value) => {
                const s = value / 255
                return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
              })
              return (
                linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
              )
            }
            function contrast(a: string, b: string) {
              const pair = [luminance(rgb(a)), luminance(rgb(b))].sort(
                (x, y) => x - y,
              )
              return (pair[1] + 0.05) / (pair[0] + 0.05)
            }
            const result = {
              text: contrast(
                '--color-text-secondary',
                '--color-background-muted',
              ),
              outline: contrast(
                '--color-border-emphasized',
                '--color-background-popover',
              ),
            }
            probe.remove()
            return result
          })
          expect(ratios.text).toBeGreaterThanOrEqual(4.5)
          expect(ratios.outline).toBeGreaterThanOrEqual(3)
          await page.context().close()
          contexts.splice(contexts.indexOf(page.context()), 1)
        }
  })

  it('reports rejected credentials, retries, and removes private access after sign-out', async () => {
    const page = await newPage()
    await page.goto(`${BASE_URL}/sign-in`)
    await page.getByLabel('Email', { exact: true }).fill(member.email)
    await page
      .getByLabel('Password', { exact: true })
      .fill('incorrect-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page
      .getByText(en.auth_sign_in_failed_to_sign_in, { exact: true })
      .waitFor()
    expect(new URL(page.url()).pathname).toBe('/sign-in')
    await signIn(page, member)
    await page.goto(`${BASE_URL}/settings/security`)
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Sign out', exact: true })
      .click()
    await page.waitForURL('**/sign-in')
    await page.goto(`${BASE_URL}/workspaces/${workspaceId}/contacts`)
    await page.waitForURL('**/sign-in')
    expect(
      await page.getByText('Browser Inbox Customer', { exact: true }).count(),
    ).toBe(0)
  })

  it('signs in a new account, completes onboarding, and persists one workspace', async () => {
    const page = await newPage()
    await signIn(page, newcomer)
    await page.waitForURL('**/onboarding')
    await page.getByLabel(/Workspace name/).fill('Created in browser')
    await page
      .getByRole('button', { name: 'Create workspace', exact: true })
      .click()
    await page.waitForURL('**/settings/channels')
    const result = await admin
      .from('workspaces')
      .select('id,name')
      .eq('created_by', newcomer.id)
    expect(result.data?.map((workspace) => workspace.name)).toEqual([
      'Created in browser',
    ])
    await page.reload()
    await page
      .getByText('Connect your first channel', { exact: true })
      .waitFor()
  })

  it('creates, edits and merges contacts through keyboard-accessible dialogs', async () => {
    const page = await newPage()
    await signIn(page, owner)
    await page.goto(`${BASE_URL}/workspaces/${workspaceId}/contacts`)
    const add = page
      .getByRole('button', { name: 'Add contact', exact: true })
      .first()
    await add.click()
    const dialog = page.getByRole('dialog')
    await dialog
      .getByLabel('Name', { exact: true })
      .fill('Browser Created Contact')
    await page.keyboard.press('Shift+Tab')
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true)
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await page.waitForURL(/\/contacts\/[\w-]+$/)
    await page
      .getByRole('button', { name: 'Edit contact', exact: true })
      .click()
    await dialog
      .getByLabel('Name', { exact: true })
      .fill('Browser Edited Contact')
    expect(await dialog.getByLabel('Name', { exact: true }).inputValue()).toBe(
      'Browser Edited Contact',
    )
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    const saved = await admin
      .from('contacts')
      .select('id,name')
      .eq('workspace_id', workspaceId)
      .eq('name', 'Browser Edited Contact')
      .single()
    expect(saved.data?.name).toBe('Browser Edited Contact')
    const other = await admin
      .from('contacts')
      .insert({
        workspace_id: workspaceId,
        name: 'Browser Merge Source',
        source: 'manual',
      })
      .select('id')
      .single()
    expect(other.error).toBeNull()
    await page.goto(`${BASE_URL}/workspaces/${workspaceId}/contacts`)
    await page
      .getByRole('checkbox', { name: 'Select Browser Edited Contact to merge' })
      .check()
    await page
      .getByRole('checkbox', { name: 'Select Browser Merge Source to merge' })
      .check()
    await page.getByRole('button', { name: 'Merge', exact: true }).click()
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click()
    await dialog.getByRole('button', { name: 'Merge', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    const merged = await admin
      .from('contacts')
      .select('id,merged_into_id,deleted_at')
      .in('id', [saved.data!.id, other.data!.id])
    expect(
      merged.data?.filter(
        (contact) => contact.merged_into_id && contact.deleted_at,
      ),
    ).toHaveLength(1)
    expect(merged.data?.filter((contact) => !contact.deleted_at)).toHaveLength(
      1,
    )
    await assertNoOverflow(page)
  })

  it('hides admin membership and merge controls from an ordinary member', async () => {
    const page = await newPage()
    await signIn(page, member)
    await page.goto(
      `${BASE_URL}/workspaces/${workspaceId}/contacts?archived=true`,
    )
    await page.getByRole('heading', { name: 'Contacts', exact: true }).waitFor()
    await expect
      .poll(() => new URL(page.url()).searchParams.get('archived'))
      .toBeNull()
    expect(await page.getByRole('checkbox', { name: /to merge/ }).count()).toBe(
      0,
    )
    await page.goto(`${BASE_URL}/workspaces/${workspaceId}/settings/members`)
    await page.getByText('Audit Owner', { exact: true }).waitFor()
    expect(
      await page.getByRole('button', { name: 'Invite', exact: true }).count(),
    ).toBe(0)
  })

  it('opens a real conversation, persists assignment, and navigates at phone width', async () => {
    const page = await newPage()
    await signIn(page, owner)
    await page.goto(
      `${BASE_URL}/workspaces/${workspaceId}/inbox/${conversationId}`,
    )
    await page
      .getByTestId('message-transcript')
      .getByText('Local browser regression message', { exact: true })
      .waitFor()
    await page.getByRole('button', { name: 'Assign', exact: true }).click()
    await page
      .getByRole('menuitem', { name: 'Assign to me', exact: true })
      .click()
    await expect
      .poll(
        async () =>
          (
            await admin
              .from('conversations')
              .select('assigned_to')
              .eq('id', conversationId)
              .single()
          ).data?.assigned_to,
      )
      .toBe(owner.id)
    await page.setViewportSize({ width: 375, height: 720 })
    await assertNoOverflow(page)
    await page
      .getByRole('button', { name: 'Back to conversations', exact: true })
      .click()
    await page.waitForURL(`**/workspaces/${workspaceId}/inbox`)
    await page.getByText('Browser Inbox Customer', { exact: true }).waitFor()
    await assertNoOverflow(page)
  })
})
