import { AuthProvider, useAuth } from '@/providers/auth-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import { queryClient } from '@/utils/query-client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'
import { setLocale } from './paraglide/runtime'
import './styles.css'
import { getRouter } from './utils/router'

setLocale('en')

const router = getRouter()
const rootElement = document.getElementById('app')!

function App() {
  const auth = useAuth()

  return <RouterProvider router={router} context={{ auth }} />
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
