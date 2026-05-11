//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

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
    ],
  },
]
