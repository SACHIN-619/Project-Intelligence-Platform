// app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const router = useRouter()
  const { loginDemo, loginWithCredentials } = useAuth()

  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [isLoading, setIsLoading]       = useState(false)
  const [isDemoLoading, setIsDemoLoading] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  async function handleDemoLogin() {
    setError(null); setIsDemoLoading(true)
    const result = await loginDemo()
    setIsDemoLoading(false)
    if (result.success) { router.push('/dashboard') }
    else { setError(result.error || 'Could not start demo session.') }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Please enter both email and password.'); return }
    setError(null); setIsLoading(true)
    const result = await loginWithCredentials(email, password)
    setIsLoading(false)
    if (result.success) { router.push('/dashboard') }
    else { setError(result.error || 'Login failed.') }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center
                    overflow-hidden bg-[#0A0F1E] px-4">

      {/* Dot grid background */}
      <div className="absolute inset-0 bg-dot-grid opacity-60" />

      {/* Top centre blue glow */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[500px]
                   -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)' }}
      />

      {/* Bottom subtle glow */}
      <div
        className="pointer-events-none absolute -bottom-32 right-1/4 h-64 w-96
                   rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #14B8A6 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-md animate-entrance">

        {/* Logo block */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl
                          bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8]
                          shadow-xl shadow-[#3B82F6]/30">
            <span
              className="material-symbols-outlined text-3xl text-white"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              hub
            </span>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">PII</h1>
            <p className="mt-1 text-sm text-[#6B7280]">Project Intelligence Interface</p>
          </div>
        </div>

        {/* Card */}
        <div className="card-panel overflow-hidden">
          {/* Card top accent line */}
          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#3B82F6] to-transparent" />

          <div className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white">Welcome back</h2>
            <p className="mt-1 mb-6 text-sm text-[#6B7280]">
              Sign in to access your project intelligence dashboard
            </p>

            {/* ── Demo login — FIRST, most prominent ─────────────────────── */}
            <button
              onClick={handleDemoLogin}
              disabled={isLoading || isDemoLoading}
              className="group relative mb-5 flex w-full items-center justify-center
                         gap-2.5 overflow-hidden rounded-lg border border-[#3B82F6]/50
                         bg-[#3B82F6]/10 px-5 py-3.5 text-sm font-semibold
                         text-[#3B82F6] transition-all hover:border-[#3B82F6]
                         hover:bg-[#3B82F6]/20 disabled:opacity-50"
            >
              {/* Shimmer effect on hover */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r
                              from-transparent via-white/5 to-transparent
                              transition-transform duration-500 group-hover:translate-x-full" />

              {isDemoLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2
                                   border-[#3B82F6]/30 border-t-[#3B82F6]" />
                  Starting demo session...
                </>
              ) : (
                <>
                  <span
                    className="material-symbols-outlined text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    bolt
                  </span>
                  Try Demo — No Sign-up Needed
                </>
              )}
            </button>

            <p className="mb-5 text-center text-xs text-[#6B7280]">
              Instantly explore a sample Bangalore Data Centre project
            </p>

            {/* Divider */}
            <div className="mb-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#1F2937]" />
              <span className="text-[11px] font-medium text-[#4B5563]">OR SIGN IN</span>
              <div className="h-px flex-1 bg-[#1F2937]" />
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border
                              border-[#EF4444]/30 bg-[#EF4444]/10 p-3">
                <span className="material-symbols-outlined text-base text-[#EF4444]">
                  error
                </span>
                <p className="text-sm text-[#EF4444]">{error}</p>
              </div>
            )}

            {/* Login form */}
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#9CA3AF]">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input-dark"
                  disabled={isLoading || isDemoLoading}
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#9CA3AF]">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-dark pr-10"
                    disabled={isLoading || isDemoLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]
                               hover:text-[#9CA3AF]"
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined text-base">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || isDemoLoading}
                className="btn-primary mt-1 w-full justify-center"
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2
                                     border-white/30 border-t-white" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[#4B5563]">
          Project Impact Intelligence © 2026
          <span className="mx-2 text-[#2D3748]">·</span>
          Built for ET AI Hackathon 2.0
        </p>
      </div>
    </div>
  )
}