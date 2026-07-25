//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

export default [
  ...tanstackConfig,
  {
    rules: {
      'import-x/consistent-type-specifier-style': 'off',
      'import/order': 'off',
      'sort-imports': 1,
    },
  },
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      'src/api/types.ts',
      'src/paraglide/**',
      'src/routeTree.gen.ts',
      'supabase/functions/**',
      'public/**',
    ],
  },
  // Disable ESLint rules that conflict with Prettier; keep this last.
  eslintConfigPrettier,
]
