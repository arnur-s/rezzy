import { dirname, resolve } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
let bash = 'bash'
if (process.platform === 'win32') {
  // Windows' system bash.exe invokes WSL, which cannot use Docker Desktop's
  // Windows CLI. Git Bash runs the same local-container suite used by Linux CI.
  const gitPaths = execFileSync('where.exe', ['git'], { encoding: 'utf8' })
    .trim()
    .split(/\r?\n/)
  const candidate = gitPaths
    .map((gitPath) => resolve(dirname(gitPath), '../bin/bash.exe'))
    .find(existsSync)
  if (!candidate)
    throw new Error('Database race tests require Git Bash on Windows.')
  bash = candidate
}

const result = spawnSync(bash, ['supabase/tests/concurrency/race.sh'], {
  cwd: root,
  stdio: 'inherit',
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
