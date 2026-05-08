//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    rules: {
      'import-x/consistent-type-specifier-style': 'off',
      'import/order': 'on',
      'sort-imports': 'on',
    },
  },
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      'src/paraglide/**',
      'src/routeTree.gen.ts',
    ],
  },
]
