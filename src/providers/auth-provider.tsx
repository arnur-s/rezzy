import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session, User } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { supabase } from '@/utils/supabase'

/**
 * `'others'` ends every session except this one, so the local session survives
 * it. The default stays Supabase's own `'global'`, which is what the sidebar
 * logout has always done.
 */
export type SignOutScope = 'global' | 'local' | 'others'

export type AuthContextValue = {
  isLoading: boolean
  session: Session | null
  signOut: (scope?: SignOutScope) => Promise<void>
  user: User | null
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const currentUserId = useRef<string | null>(null)
  const sessionRevision = useRef(0)

  const acceptSession = useCallback(
    (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null
      if (currentUserId.current !== nextUserId) {
        // Most workspace queries are keyed by resource, not by user. Cancel
        // pending reads and discard private results before exposing a different
        // identity, including a cross-tab sign-out or sign-in.
        queryClient.clear()
        currentUserId.current = nextUserId
      }
      sessionRevision.current += 1
      setSession(nextSession)
      setIsLoading(false)
    },
    [queryClient],
  )

  useEffect(() => {
    let isMounted = true
    const initialRevision = sessionRevision.current

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted || sessionRevision.current !== initialRevision) {
          return
        }

        if (error) {
          console.error('Unable to load Supabase session', error)
        }

        acceptSession(error ? null : data.session)
      })
      .catch(() => {
        // A storage/network failure must not leave the application spinner up
        // forever, nor overwrite an auth event that already resolved the session.
        if (isMounted && sessionRevision.current === initialRevision) {
          acceptSession(null)
        }
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) acceptSession(nextSession)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [acceptSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      session,
      signOut: async (scope?: SignOutScope) => {
        const revision = sessionRevision.current
        const { error } = await supabase.auth.signOut(
          scope ? { scope } : undefined,
        )

        if (error) {
          throw error
        }

        // 'others' leaves this session signed in, so clearing it here would
        // sign the user out of the device they are looking at.
        if (scope !== 'others' && sessionRevision.current === revision) {
          acceptSession(null)
        }
      },
      user: session?.user ?? null,
    }),
    [acceptSession, isLoading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return value
}
