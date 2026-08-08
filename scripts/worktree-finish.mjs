/**
 * Pushes the current worktree's branch and opens a pull request against main.
 *
 * The point is that finishing is one deterministic command rather than an agent
 * improvising git: the base branch is always `main`, the upstream is always set
 * on first push, and an existing PR is reused instead of duplicated.
 *
 * Refuses rather than guesses. A dirty tree, a detached HEAD, being on `main`,
 * or having nothing to propose are all reported and left alone — none of them
 * has a safe automatic answer, and committing on someone's behalf needs a
 * message only the author can write.
 *
 * Usage:
 *   pnpm worktree:finish                    push and open the PR
 *   pnpm worktree:finish --draft            extra flags go through to `gh pr create`
 */

import { describeCheckout, git } from './worktree.mjs'
import { spawnSync } from 'node:child_process'

const BASE_BRANCH = 'main'

const passthrough = process.argv.slice(2)

function log(message) {
  process.stdout.write(`[finish] ${message}\n`)
}

function fail(message) {
  process.stderr.write(`[finish] ${message}\n`)
  process.exit(1)
}

/** Runs a command through a shell, streaming output. Returns success. */
function run(command, cwd) {
  log(command)
  return spawnSync(command, { cwd, stdio: 'inherit', shell: true }).status === 0
}

/** Runs a command capturing stdout; returns null when it exits non-zero. */
function capture(command, cwd) {
  const result = spawnSync(command, { cwd, encoding: 'utf8', shell: true })
  return result.status === 0 ? result.stdout.trim() : null
}

/**
 * Builds the GitHub "open a pull request" URL from the origin remote, so the
 * branch is still usable when `gh` is missing or unauthenticated.
 */
function compareUrl(root, branch) {
  const remote = git(['remote', 'get-url', 'origin'], root)
  const match = remote?.match(
    /github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/,
  )
  if (!match?.groups) return null
  const { owner, repo } = match.groups
  return `https://github.com/${owner}/${repo}/compare/${BASE_BRANCH}...${branch}?expand=1`
}

const checkout = describeCheckout()
if (!checkout) fail('not inside a git repository')

const { root, branch, isLinked } = checkout

if (!isLinked) {
  fail(`${root} is the main checkout — run this from a worktree, not in place`)
}
if (!branch) {
  fail('HEAD is detached; check out a branch before opening a pull request')
}
if (branch === BASE_BRANCH) {
  fail(
    `this worktree is on ${BASE_BRANCH}; task work belongs on its own branch`,
  )
}

// Compare content against HEAD rather than reading `git status`. On Windows,
// `core.autocrlf` leaves generated files (src/routeTree.gen.ts after a build)
// reported as modified with an empty diff, and refusing to finish over a
// line-ending phantom would be exactly the wrong kind of strict.
const modified = git(['diff', '--name-only', 'HEAD'], root)
const untracked = git(['ls-files', '--others', '--exclude-standard'], root)
const dirty = [modified, untracked].filter(Boolean).join('\n')
if (dirty) {
  fail(`commit these first, then re-run:\n${dirty}`)
}

// Compare against the remote base so a stale local `main` cannot make an
// already-merged branch look like it still has something to propose.
git(['fetch', 'origin', BASE_BRANCH], root)
const ahead = git(['rev-list', '--count', `origin/${BASE_BRANCH}..HEAD`], root)
if (ahead === '0') {
  fail(
    `${branch} has no commits beyond origin/${BASE_BRANCH} — nothing to open a pull request with`,
  )
}
log(`${branch}: ${ahead} commit(s) ahead of origin/${BASE_BRANCH}`)

if (!run(`git push -u origin ${branch}`, root)) {
  fail('push failed; resolve the above and re-run')
}

if (capture('gh --version', root) === null) {
  const url = compareUrl(root, branch)
  fail(
    `branch pushed, but the GitHub CLI is not on PATH, so the pull request was not opened.\n` +
      (url
        ? `Open it here: ${url}`
        : 'Install gh, then run `gh pr create --fill --base main`.'),
  )
}

const existing = capture(`gh pr view ${branch} --json url --jq .url`, root)
if (existing) {
  log(`pull request already open, updated by the push: ${existing}`)
  process.exit(0)
}

const flags = ['--fill', `--base ${BASE_BRANCH}`, ...passthrough].join(' ')
if (!run(`gh pr create ${flags}`, root)) {
  const url = compareUrl(root, branch)
  fail(
    `branch pushed, but \`gh pr create\` failed (an unauthenticated gh needs \`gh auth login\`).\n` +
      (url ? `Open it here: ${url}` : ''),
  )
}

log(
  capture(`gh pr view ${branch} --json url --jq .url`, root) ??
    'pull request opened',
)
