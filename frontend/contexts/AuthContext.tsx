// contexts/AuthContext.tsx
'use client'

import {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { saveToken, getToken, removeToken, decodeJWT, isLoggedIn } from '@/lib/auth'
import { demoLogin, login as apiLogin } from '@/lib/api'
import type { User, UserRole } from '@/types'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  loginDemo: () => Promise<{ success: boolean; error?: string }>
  loginWithCredentials: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Mock user details for demo — in production these would come from a /me endpoint.
// We only have role/org_id/sub in the JWT, so we fill in display info for the demo account.
function buildUserFromToken(token: string): User {
  const payload = decodeJWT(token)
  return {
    id: payload.sub,
    org_id: payload.org_id,
    email: 'demo@pii.ai',
    full_name: 'Demo Manager',
    role: payload.role as UserRole,
    is_active: true,
    preferences: {
      answer_style: 'balanced',
      notifications: {
        risk_alerts: true,
        analysis_complete: true,
        approval_needed: true,
        weekly_digest: false,
      },
    },
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // ── Restore session on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (isLoggedIn()) {
      const token = getToken()
      if (token) {
        try {
          setUser(buildUserFromToken(token))
        } catch {
          removeToken()
        }
      }
    }
    setIsLoading(false)
  }, [])

  // ── Demo login ────────────────────────────────────────────────────────────
  const loginDemo = useCallback(async () => {
    const { data, error } = await demoLogin()
    if (error || !data) {
      return { success: false, error: error || 'Could not start demo session. Please try again.' }
    }
    saveToken(data.access_token)
    setUser(buildUserFromToken(data.access_token))
    return { success: true }
  }, [])

  // ── Email/password login ─────────────────────────────────────────────────
  const loginWithCredentials = useCallback(async (email: string, password: string) => {
    const { data, error } = await apiLogin(email, password)
    if (error || !data) {
      return { success: false, error: error || 'Login failed. Please try again.' }
    }
    saveToken(data.access_token)
    setUser(buildUserFromToken(data.access_token))
    return { success: true }
  }, [])

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    removeToken()
    setUser(null)
    router.push('/login')
  }, [router])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginDemo,
        loginWithCredentials,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
