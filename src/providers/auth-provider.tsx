import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return
      }

      if (error) {
        console.error('Unable to load Supabase session', error)
      }

      setSession(data.session)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      session,
      signOut: async (scope?: SignOutScope) => {
        const { error } = await supabase.auth.signOut(
          scope ? { scope } : undefined,
        )

        if (error) {
          throw error
        }

        // 'others' leaves this session signed in, so clearing it here would
        // sign the user out of the device they are looking at.
        if (scope !== 'others') {
          setSession(null)
        }
      },
      user: session?.user ?? null,
    }),
    [isLoading, session],
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
