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
  build: {
    rollupOptions: {
      output: {
        // Keep all of lucide-react (its `createLucideIcon` factory and every
        // icon) in a single chunk. Otherwise Rollup splits the factory into the
        // entry chunk while icons get their own chunks that import it back,
        // creating a circular dependency: the entry chunk evaluates an icon
        // module before `createLucideIcon` is initialized, throwing
        // "t is not a function" at runtime.
        manualChunks(id) {
          if (id.includes('node_modules/lucide-react')) return 'lucide-react'
        },
      },
    },
  },
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
