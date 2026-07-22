// lib/auth.ts
// JWT storage and role permission utilities

import type { UserRole } from '@/types'

const TOKEN_KEY = 'pii_access_token'
const USER_KEY  = 'pii_user'

// ── Token storage ─────────────────────────────────────────────────────────
export function saveToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token)
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function removeToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }
}

export function isLoggedIn(): boolean {
  const token = getToken()
  if (!token) return false
  try {
    const payload = decodeJWT(token)
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

// ── JWT decode (no verify — server validates) ─────────────────────────────
export function decodeJWT(token: string): {
  sub: string
  role: UserRole
  org_id: string
  exp: number
} {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT')
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
  return payload
}

// ── Role permission checks ────────────────────────────────────────────────
const PERMISSIONS: Record<UserRole, Set<string>> = {
  admin:        new Set(['upload','analyse','simulate','approve','manage_users','configure']),
  manager:      new Set(['upload','analyse','simulate','approve']),
  engineer:     new Set(['upload','analyse','simulate']),
  quality:      new Set(['upload','analyse']),
  procurement:  new Set(['upload','analyse']),
  executive:    new Set(['analyse']),
}

export function hasPermission(role: UserRole, permission: string): boolean {
  return PERMISSIONS[role]?.has(permission) ?? false
}

export function canUpload(role: UserRole):   boolean { return hasPermission(role, 'upload') }
export function canApprove(role: UserRole):  boolean { return hasPermission(role, 'approve') }
export function canSimulate(role: UserRole): boolean { return hasPermission(role, 'simulate') }
export function isAdmin(role: UserRole):     boolean { return role === 'admin' }

// ── Role display ──────────────────────────────────────────────────────────
export const ROLE_LABELS: Record<UserRole, string> = {
  admin:       'System Admin',
  manager:     'Project Manager',
  engineer:    'Project Engineer',
  quality:     'Quality / Commissioning',
  procurement: 'Procurement / Supply',
  executive:   'Executive / Client',
}

export const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  admin:       'badge-red',
  manager:     'badge-blue',
  engineer:    'badge-teal',
  quality:     'badge-purple',
  procurement: 'badge-orange',
  executive:   'badge-grey',
}
