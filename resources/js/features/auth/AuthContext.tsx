import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, tokenStore } from '../../lib/api'
import type { LoginResponse, User } from '../../types/api'

interface AuthState {
  user: User | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Replace the cached user after a profile change. */
  setCurrentUser: (user: User) => void
  can: (...codes: string[]) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(() => tokenStore.get() !== null)

  useEffect(() => {
    if (!tokenStore.get()) return
    api<User>('/auth/me')
      .then(setUser)
      .catch(() => tokenStore.set(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await api<LoginResponse>('/auth/login', { method: 'POST', body: { identifier, password }, auth: false })
    tokenStore.set(res.token)
    setUser(res.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } finally {
      tokenStore.set(null)
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login,
      logout,
      setCurrentUser: setUser,
      can: (...codes) => !!user && codes.some((c) => user.permissions.includes(c)),
    }),
    [user, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
