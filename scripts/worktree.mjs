/**
 * Shared git-worktree helpers.
 *
 * A linked worktree has its own `.git` *file* pointing back at the main
 * checkout's `.git` directory, so `--git-dir` and `--git-common-dir` diverge.
 * That is also true inside a submodule, hence the superproject guard.
 */

import { execFileSync } from 'node:child_process'
import path from 'node:path'

/** Runs a git command in `cwd` and returns trimmed stdout, or null on failure. */
export function git(args, cwd = process.cwd()) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

/**
 * Describes the checkout containing `cwd`.
 *
 * Returns null when `cwd` is not inside a git repository at all, so callers can
 * no-op instead of throwing (the SessionStart hook relies on this).
 */
export function describeCheckout(cwd = process.cwd()) {
  const root = git(['rev-parse', '--show-toplevel'], cwd)
  if (!root) return null

  const gitDir = git(['rev-parse', '--absolute-git-dir'], cwd)
  const commonDir = git(
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    cwd,
  )
  const superproject = git(
    ['rev-parse', '--show-superproject-working-tree'],
    cwd,
  )

  // `git worktree list --porcelain` always lists the main checkout first.
  const listing = git(['worktree', 'list', '--porcelain'], cwd) ?? ''
  const mainLine = listing
    .split(/\r?\n/)
    .find((line) => line.startsWith('worktree '))
  const mainRoot = mainLine
    ? path.resolve(mainLine.slice('worktree '.length))
    : path.resolve(root)

  const isLinked =
    !superproject &&
    gitDir !== null &&
    commonDir !== null &&
    path.resolve(gitDir) !== path.resolve(commonDir)

  return {
    root: path.resolve(root),
    mainRoot,
    isLinked,
    branch: git(['branch', '--show-current'], cwd) || null,
    name: path.basename(path.resolve(root)),
  }
}
