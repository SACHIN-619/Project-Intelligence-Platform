'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface HomeNavbarProps {
  onExploreDemo: () => void
  isDemoLoading: boolean
}

const NAV_LINKS = [
  { label: 'Platform',       href: '#capabilities' },
  { label: 'Intelligence',   href: '#scenario' },
  { label: 'Architecture',   href: '#architecture' },
  { label: 'Vision',         href: '#future' },
]

export function HomeNavbar({ onExploreDemo, isDemoLoading }: HomeNavbarProps) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navBg = scrolled
    ? 'bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm'
    : 'bg-transparent'

  function smoothScroll(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault()
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMobileOpen(false)
  }

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${navBg}`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#14B8A6] to-[#0891B2] shadow-md shadow-teal-500/20">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 1L16 5V13L9 17L2 13V5L9 1Z" stroke="white" strokeWidth="1.5" fill="none"/>
                <circle cx="9" cy="9" r="2.5" fill="white"/>
              </svg>
            </div>
            <span className="text-[15px] font-bold text-slate-900 tracking-tight leading-none">
              Project Impact Intelligence
              <span className="block text-[10px] font-medium text-[#14B8A6] tracking-widest uppercase mt-0.5">
                Powered by Bright AI
              </span>
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(l => (
              <a
                key={l.href}
                href={l.href}
                onClick={e => smoothScroll(e, l.href)}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-all"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* CTAs */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              Sign In
            </Link>
            <button
              onClick={onExploreDemo}
              disabled={isDemoLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#14B8A6] to-[#0EA5E9] rounded-lg shadow-md shadow-teal-500/20 hover:shadow-teal-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isDemoLoading ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <span className="text-xs">⚡</span>
                  Explore Live Project
                </>
              )}
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="md:hidden ml-1 p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                {mobileOpen ? (
                  <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                ) : (
                  <>
                    <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-200 px-6 py-4 flex flex-col gap-1">
          {NAV_LINKS.map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={e => smoothScroll(e, l.href)}
              className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/login"
            className="mt-2 block text-center px-3 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Sign In
          </Link>
        </div>
      )}
    </header>
  )
}
