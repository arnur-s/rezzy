import { AuthProvider, useAuth } from '@/providers/auth-provider'
import { queryClient } from '@/utils/query-client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'
import { getRouter } from './utils/router'

const router = getRouter()
const rootElement = document.getElementById('app')!

function App() {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ auth }} />
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>,
  )
}
