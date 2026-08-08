/**
 * Starts the Vite dev server on a port that does not collide with other worktrees.
 *
 * The main checkout keeps port 3000, so nothing about the normal workflow
 * changes. A linked worktree gets a port derived from its directory name, which
 * means the same worktree always lands on the same port across restarts —
 * important when an agent has already handed the URL to a browser or to you.
 *
 * Vite is not started with `strictPort`, so if the derived port is taken it
 * still steps to the next free one.
 *
 * Overrides, in order of precedence: an explicit `--port` in the arguments,
 * then the `PORT` environment variable, then the derived value.
 */

import { createHash } from 'node:crypto'
import { describeCheckout } from './worktree.mjs'
import { spawnSync } from 'node:child_process'

const MAIN_PORT = 3000
// 3100–3499. The gap above 3000 matters: when the main checkout finds its port
// busy, Vite walks 3001, 3002, … upward, and a band starting at 3001 would put
// it straight onto a worktree's port.
const WORKTREE_PORT_BASE = 3100
const WORKTREE_PORT_RANGE = 400

const passthrough = process.argv.slice(2)

function derivePort() {
  const explicit = passthrough.findIndex(
    (arg) => arg === '--port' || arg.startsWith('--port='),
  )
  if (explicit !== -1) return null // Caller already chose; leave the args alone.

  if (process.env.PORT) {
    const parsed = Number.parseInt(process.env.PORT, 10)
    if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) return parsed
  }

  const checkout = describeCheckout()
  if (!checkout || !checkout.isLinked) return MAIN_PORT

  const digest = createHash('sha256').update(checkout.name).digest()
  return WORKTREE_PORT_BASE + (digest.readUInt16BE(0) % WORKTREE_PORT_RANGE)
}

const port = derivePort()
const args = [
  'exec',
  'vite',
  'dev',
  ...(port === null ? [] : ['--port', String(port)]),
  ...passthrough,
]

if (port !== null && port !== MAIN_PORT) {
  process.stdout.write(`[dev] worktree dev server on port ${port}\n`)
}

// pnpm is a `.cmd` shim on Windows, so it needs a shell. Node deprecated
// passing an argv array alongside `shell: true` (DEP0190), hence the joined
// string; anything with whitespace is quoted on the way in.
const command = args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ')

const result = spawnSync(`pnpm ${command}`, {
  stdio: 'inherit',
  shell: true,
})

process.exit(result.status ?? 1)
