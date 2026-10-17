import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { BrowserContext } from 'playwright'

export const LOCAL_API = 'http://127.0.0.1:54321'

export async function startVite(
  port: number,
  anonKey = 'local-browser-fixture',
): Promise<ChildProcess> {
  const server = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL('../node_modules/vite/bin/vite.js', import.meta.url),
      ),
      'dev',
      '--port',
      String(port),
      '--strictPort',
      '--host',
      '127.0.0.1',
    ],
    {
      cwd: process.cwd(),
      stdio: 'ignore',
      env: {
        ...process.env,
        // A copied worktree .env may point at a hosted project. Browser fixtures
        // must never inherit that target, including the existing cache harnesses.
        VITE_SUPABASE_URL: LOCAL_API,
        VITE_SUPABASE_PUBLISHABLE_KEY: anonKey,
      },
    },
  )
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error(`Fixture Vite exited (${server.exitCode})`)
    try {
      if ((await fetch(`http://127.0.0.1:${port}`)).ok) return server
    } catch {
      /* Wait until Vite is listening. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  server.kill()
  throw new Error('Fixture Vite did not start within 120 seconds')
}

export async function localRequestsOnly(context: BrowserContext, port: number) {
  const allowed = new Set([`http://127.0.0.1:${port}`, LOCAL_API])
  await context.route('**/*', (route) => {
    return allowed.has(new URL(route.request().url()).origin)
      ? route.continue()
      : route.abort('blockedbyclient')
  })
}
