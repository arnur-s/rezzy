/**
 * Fake authenticated session for browser checks.
 *
 * The public routes are the only ones reachable without credentials, but the
 * routes users actually navigate between are behind the auth gate: the sidebar,
 * the workspace dashboard, the inbox, and settings. Those are exactly where the
 * workspace icons render and where the route gates run, so leaving them
 * unexercised would leave the riskiest paths unverified.
 *
 * Rather than require real credentials (and create real rows), this seeds the
 * session Supabase looks for in localStorage and stubs its REST and Realtime
 * endpoints with fixtures. Nothing leaves the machine and no account is needed.
 */

/** Matches the project ref in VITE_SUPABASE_URL. */
export const PROJECT_REF = 'duagwiwduywrmmhqvdly'
export const USER_ID = '00000000-0000-4000-8000-000000000001'
export const WORKSPACE_ID = '00000000-0000-4000-8000-000000000002'
export const CHANNEL_ID = '00000000-0000-4000-8000-000000000003'
/** Second workspace, seeded only when a check asks for it. */
export const WORKSPACE_ID_B = '00000000-0000-4000-8000-000000000005'

const FAR_FUTURE = Math.floor(Date.now() / 1000) + 60 * 60 * 24

export const SESSION = {
  access_token: 'fake-access-token',
  refresh_token: 'fake-refresh-token',
  token_type: 'bearer',
  expires_in: 86_400,
  expires_at: FAR_FUTURE,
  user: {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'smoke@example.test',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: 'Smoke Tester' },
    identities: [],
  },
}

const WORKSPACE = {
  id: WORKSPACE_ID,
  name: 'Smoke Workspace',
  description: 'Fixture workspace for the authenticated smoke check',
  icon: 'rocket',
  owner_id: USER_ID,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const CHANNEL = {
  id: CHANNEL_ID,
  workspace_id: WORKSPACE_ID,
  type: 'telegram',
  name: 'Smoke Channel',
  is_active: true,
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

/**
 * Fixtures keyed by the table each request targets. Anything unmatched returns
 * an empty list, which every list view in the app renders as an empty state.
 */
const SECOND_WORKSPACE = {
  ...WORKSPACE,
  id: WORKSPACE_ID_B,
  name: 'Second Workspace',
  description: 'Fixture for the multi-workspace home state',
}

const CONTACT = {
  id: '00000000-0000-4000-8000-000000000006',
  workspace_id: WORKSPACE_ID,
  name: 'Мария Иванова',
  avatar_url: null,
}

/**
 * One conversation assigned to the fake user with an unread message, so home's
 * attention queue has something to rank. Without it the section correctly
 * stays silent and a check of its visual rank has nothing to measure.
 */
const CONVERSATION = {
  id: '00000000-0000-4000-8000-000000000007',
  workspace_id: WORKSPACE_ID,
  contact_id: CONTACT.id,
  status: 'open',
  assigned_to: USER_ID,
  last_message_at: '2026-01-02T00:00:00Z',
  last_message_preview: 'Здравствуйте, когда будет доставка?',
  snoozed_until: null,
  channel: { id: CHANNEL_ID, type: CHANNEL.type, name: CHANNEL.name },
  contact: { id: CONTACT.id, name: CONTACT.name, avatar_url: null },
}

const tableFixtures = (language, workspaceCount, seedQueue) => ({
  workspaces:
    workspaceCount > 1 ? [WORKSPACE, SECOND_WORKSPACE] : [WORKSPACE],
  conversations: seedQueue ? [CONVERSATION] : [],
  contacts: seedQueue ? [CONTACT] : [],
  workspace_members: [
    {
      id: '00000000-0000-4000-8000-000000000004',
      workspace_id: WORKSPACE_ID,
      user_id: USER_ID,
      role: 'owner',
      created_at: '2026-01-01T00:00:00Z',
      workspaces: WORKSPACE,
    },
  ],
  channels: [CHANNEL],
  profiles: [
    {
      id: USER_ID,
      full_name: 'Smoke Tester',
      avatar_url: null,
      phone: null,
      // The app treats the profile row as authoritative for language and
      // reloads the page to reconcile the local cookie against it, so a caller
      // that wants a specific locale has to say so here — setting the cookie
      // alone gets overwritten on the first profile fetch.
      language,
    },
  ],
})

/**
 * Installs the fake session and API stubs on a Playwright page.
 *
 * Must run before the first navigation: the app reads the session during boot,
 * so seeding it afterwards would let the auth gate bounce to /sign-in first.
 *
 * `language` is the preference on the fake profile row: 'en', 'ru', or 'auto'.
 *
 * `workspaceCount` seeds a second workspace. Home's layout and its primary
 * action both branch on this count, so the multi-workspace shape is only
 * reachable in a browser check that asks for it.
 */
export async function installFakeAuth(
  page,
  baseUrl,
  { language = 'en', workspaceCount = 1, seedQueue = false } = {},
) {
  const fixtures = tableFixtures(language, workspaceCount, seedQueue)

  await page.addInitScript(
    ({ ref, session }) => {
      window.localStorage.setItem(
        `sb-${ref}-auth-token`,
        JSON.stringify({ ...session, currentSession: session }),
      )
    },
    { ref: PROJECT_REF, session: SESSION },
  )

  await page.route('**/*.supabase.co/**', async (route) => {
    const url = new URL(route.request().url())
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(body),
      })

    if (url.pathname.startsWith('/auth/v1/user')) return json(SESSION.user)
    if (url.pathname.startsWith('/auth/v1/token')) return json(SESSION)
    if (url.pathname.startsWith('/auth/v1/logout')) return json({})

    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      // Most RPCs here return counts or ids, where an empty list satisfies
      // every caller. The unread count is the exception: it is what makes a
      // seeded conversation qualify for home's attention queue.
      if (seedQueue && url.pathname.endsWith('get_unread_counts_for_workspaces')) {
        return json([{ conversation_id: CONVERSATION.id, unread_count: 2 }])
      }
      return json([])
    }

    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.replace('/rest/v1/', '').split('?')[0]
      return json(fixtures[table] ?? [])
    }

    if (url.pathname.startsWith('/storage/v1/')) return json({ signedUrl: '' })

    return json({})
  })

  // Realtime would retry a failing websocket forever and pollute the console.
  await page.route('**/realtime/v1/**', (route) => route.abort())

  return { baseUrl }
}
