import { RouterLink } from '@/components/router-link'
import { registerNotificationServiceWorker } from '@/features/notifications'
import { initLocale } from '@/lib/locale'
// Imported before the Supabase client is constructed: it reads the recovery
// marker out of the URL, and Supabase strips the fragment as it boots.
import '@/lib/password-recovery'
import { AppLayerProvider } from '@/providers/app-layer-provider'
import { AuthProvider, useAuth } from '@/providers/auth-provider'
import { ThemeProvider, useTheme } from '@/providers/theme-provider'
import { queryClient } from '@/utils/query-client'
import { LinkProvider } from '@astryxdesign/core/Link'
import { Theme } from '@astryxdesign/core/theme'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
// Pre-built theme (tokens + component overrides already compiled into
// `themes/gothic/theme.css`, imported from styles.css). Importing the built
// module instead of the `defineTheme` source avoids runtime style injection.
// import { gothicTheme } from './themes/gothic/gothic'
// import { theme } from './themes/neutral/theme'
import { stoneTheme } from './themes/stone/stoneTheme'
import { getRouter } from './utils/router'

// Explicit choice (cookie) wins, then the browser's language, then English.
initLocale()

// Register the notification service worker (enables Web Push handling and
// notification clicks). This does not request notification permission.
registerNotificationServiceWorker()

const router = getRouter()
const rootElement = document.getElementById('app')!

// Hoisted, not inlined into the `InnerWrap` prop below: an arrow defined during
// render is a new component *type* on every render, so React unmounts the whole
// route tree and mounts a fresh one. `App` re-renders on every Supabase
// `onAuthStateChange` (the tab regaining visibility, another tab broadcasting a
// session), and each of those was blowing away the app — losing the inbox
// transcript's scroll position, which re-pins to the newest message on mount.
function InnerWrap({ children }: { children: ReactNode }) {
  return <LinkProvider component={RouterLink}>{children}</LinkProvider>
}

function App() {
  const auth = useAuth()
  // Bridge the app's stored light/dark preference into the Astryx theme so a
  // single control drives both the design system and any remaining app styles.
  const { theme: themeMode } = useTheme()

  return (
    <Theme theme={stoneTheme} mode={themeMode}>
      <AppLayerProvider>
        <RouterProvider
          router={router}
          context={{ auth }}
          InnerWrap={InnerWrap}
        />
      </AppLayerProvider>
    </Theme>
  )
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}
