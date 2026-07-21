import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    // Serves the dev server over https. The Facebook SDK refuses FB.login on
    // http pages (localhost included), so WhatsApp Embedded Signup cannot be
    // exercised without it. Self-signed: the browser warns once per cert.
    // basicSsl(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
    }),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: [
        'dist/**',
        'src/paraglide/**',
        'src/routeTree.gen.ts',
        'src/vite-env.d.ts',
      ],
    },
  },
})

export default config
