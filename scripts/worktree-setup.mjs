/**
 * Seeds a linked git worktree so the repository can actually build and run in it.
 *
 * `git worktree add` checks out tracked files only, so a fresh worktree is
 * missing everything git ignores: `.env`, `node_modules/`, and the paraglide
 * output under `src/paraglide/` (which paraglide generates along with its own
 * .gitignore, so not one byte of it is committed). Until those exist, every
 * script in package.json fails.
 *
 * Each step is skipped when already satisfied, so re-running is cheap. In the
 * main checkout the whole thing is a no-op, which is what lets the SessionStart
 * hook call it unconditionally.
 *
 * Usage:
 *   node scripts/worktree-setup.mjs              seed the worktree containing cwd
 *   node scripts/worktree-setup.mjs --cwd <dir>  seed the worktree containing <dir>
 *   node scripts/worktree-setup.mjs --force      re-run every step
 *   node scripts/worktree-setup.mjs --strict     exit non-zero when a step fails
 */

import { describeCheckout, git } from './worktree.mjs'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const argv = process.argv.slice(2)
const force = argv.includes('--force')
const strict = argv.includes('--strict')

// The SessionStart hook passes its own working directory, because a hook's cwd
// is not guaranteed to be the worktree the session actually sits in.
const cwdFlag = argv.indexOf('--cwd')
const cwd =
  cwdFlag !== -1 && argv[cwdFlag + 1]
    ? path.resolve(argv[cwdFlag + 1])
    : process.cwd()

const failures = []

function log(message) {
  process.stdout.write(`[worktree] ${message}\n`)
}

/**
 * Runs a pnpm script, streaming output so a slow install does not look hung.
 *
 * pnpm is a `.cmd` shim on Windows, so it needs a shell. The command is passed
 * as one string rather than an argv array because Node deprecated the
 * array-plus-shell combination (DEP0190); every argument here is a literal.
 */
function run(label, args, cwd) {
  log(`${label}: pnpm ${args.join(' ')}`)
  const result = spawnSync(`pnpm ${args.join(' ')}`, {
    cwd,
    stdio: 'inherit',
    shell: true,
  })
  if (result.status !== 0) {
    failures.push(
      `${label} failed (pnpm ${args.join(' ')} exited ${result.status ?? 'null'})`,
    )
    return false
  }
  return true
}

const checkout = describeCheckout(cwd)

if (!checkout) {
  log(`${cwd} is not inside a git repository — nothing to do`)
  process.exit(0)
}

if (!checkout.isLinked && !force) {
  // The main checkout is seeded by whoever cloned it. Stay quiet unless someone
  // ran this by hand, so the SessionStart hook adds nothing to normal sessions.
  if (strict)
    log(`${checkout.root} is the main checkout, not a worktree — nothing to do`)
  process.exit(0)
}

const { root, mainRoot, name, branch } = checkout
log(`seeding ${name}${branch ? ` (branch ${branch})` : ''}`)

// 1. Ignored env files. They hold the Supabase keys, are never committed, and
//    the app cannot boot without them.
for (const entry of fs.readdirSync(mainRoot)) {
  if (!entry.startsWith('.env')) continue
  const source = path.join(mainRoot, entry)
  if (!fs.statSync(source).isFile()) continue
  // `check-ignore` exits 0 (and echoes the path) only for ignored files, so
  // this skips `.env.example`, which is tracked and already in the checkout.
  if (git(['check-ignore', entry], mainRoot) === null) continue

  const target = path.join(root, entry)
  if (fs.existsSync(target) && !force) continue
  fs.copyFileSync(source, target)
  log(`copied ${entry} from the main checkout`)
}

// 2. Dependencies. pnpm links from a global store, so a per-worktree
//    node_modules is cheap, but it still has to be created once. The stamp lets
//    a later session skip the install when the lockfile has not moved.
const lockfile = path.join(root, 'pnpm-lock.yaml')
const stampFile = path.join(root, 'node_modules', '.rezzy-worktree-stamp')
const lockHash = fs.existsSync(lockfile)
  ? createHash('sha256').update(fs.readFileSync(lockfile)).digest('hex')
  : null
const stamp = fs.existsSync(stampFile)
  ? fs.readFileSync(stampFile, 'utf8').trim()
  : null

if (
  force ||
  !fs.existsSync(path.join(root, 'node_modules')) ||
  stamp !== lockHash
) {
  if (
    run('installing dependencies', ['install', '--frozen-lockfile'], root) &&
    lockHash
  ) {
    fs.writeFileSync(stampFile, `${lockHash}\n`)
  }
} else {
  log('dependencies already match the lockfile')
}

// 3. Paraglide output. Generated, fully ignored, and imported all over `src`,
//    so typecheck and build both fail without it.
if (
  force ||
  !fs.existsSync(path.join(root, 'src', 'paraglide', 'messages.js'))
) {
  run('compiling messages', ['i18n:compile'], root)
} else {
  log('paraglide output already present')
}

if (failures.length > 0) {
  for (const failure of failures) log(`FAILED — ${failure}`)
  log(
    'this worktree is not ready; fix the above and re-run `pnpm worktree:setup`',
  )
  process.exit(strict ? 1 : 0)
}

log(`ready at ${root}`)
