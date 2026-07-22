import { defineConfig } from 'vitest/config'

/**
 * Browser-level scroll regression tests (Playwright driving a real Vite dev
 * server). Kept separate from the unit config: `pnpm test` never runs these;
 * use `pnpm test:e2e`.
 */
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
})
