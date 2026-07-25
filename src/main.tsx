import { registerNotificationServiceWorker } from '@/features/notifications'
import { AuthProvider, useAuth } from '@/providers/auth-provider'
import { ThemeProvider, useTheme } from '@/providers/theme-provider'
import { queryClient } from '@/utils/query-client'
import { RouterLink } from '@/components/router-link'
import { LayerProvider } from '@astryxdesign/core/Layer'
import { LinkProvider } from '@astryxdesign/core/Link'
import { Theme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'
import { setLocale } from './paraglide/runtime'
import './styles.css'
import { getRouter } from './utils/router'

setLocale('en')

// Register the notification service worker (enables Web Push handling and
// notification clicks). This does not request notification permission.
registerNotificationServiceWorker()

const router = getRouter()
const rootElement = document.getElementById('app')!

function App() {
  const auth = useAuth()
  // Bridge the app's stored light/dark preference into the Astryx theme so a
  // single control drives both the design system and any remaining app styles.
  const { theme } = useTheme()

  return (
    <Theme theme={neutralTheme} mode={theme}>
      <LayerProvider>
        <RouterProvider
          router={router}
          context={{ auth }}
          InnerWrap={({ children }) => (
            <LinkProvider component={RouterLink}>{children}</LinkProvider>
          )}
        />
      </LayerProvider>
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
