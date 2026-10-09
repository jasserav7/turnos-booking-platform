import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loginRequest, logoutRequest, registerRequest } from '../api/auth'
import { refreshSession, setSession, subscribeSession } from '../api/client'
import type { LoginIn, RegisterIn, TokenOut } from '../api/types'
import { AuthContext, type AuthContextValue, type AuthStatus } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSessionState] = useState<TokenOut | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    const unsubscribe = subscribeSession((next) => {
      setSessionState(next)
      setStatus(next ? 'authenticated' : 'anonymous')
      if (!next) queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'services' })
    })
    // Restore the session from the refresh cookie on first load.
    void refreshSession()
    return unsubscribe
  }, [queryClient])

  const login = useCallback(async (data: LoginIn) => {
    const next = await loginRequest(data)
    setSession(next)
    return next.user
  }, [])

  const register = useCallback((data: RegisterIn) => registerRequest(data), [])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      setSession(null)
      queryClient.clear()
    }
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      accessToken: session?.access_token ?? null,
      login,
      register,
      logout,
    }),
    [status, session, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
