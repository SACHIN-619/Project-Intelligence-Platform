'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const MOBILE_NAV = [
  { label: 'Dashboard', href: '/dashboard',    icon: 'dashboard'  },
  { label: 'Intel',     href: '/intelligence', icon: 'psychology' },
  { label: 'Recovery',  href: '/recovery',     icon: 'biotech'    },
  { label: 'AI',        href: '/assistant',    icon: 'smart_toy'  },
]

const ALL_LINKS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard', desc: 'Project oversight and key KPIs' },
  { label: 'Upload Center', href: '/upload', icon: 'cloud_upload', desc: 'Ingest schedule, spec, and procurement files' },
  { label: 'Intelligence Graph', href: '/intelligence', icon: 'psychology', desc: 'Critical Path Method and float analytics' },
  { label: 'Recovery Lab', href: '/recovery', icon: 'biotech', desc: 'Simulate delay mitigation scenarios' },
  { label: 'Action Tracker', href: '/actions', icon: 'assignment_turned_in', desc: 'Approve actions and track execution' },
  { label: 'AI Assistant', href: '/assistant', icon: 'smart_toy', desc: 'Ask natural language project queries' },
  { label: 'Report Builder', href: '/report', icon: 'description', desc: 'Export executive summaries and metric PDFs' },
  { label: 'Admin Panel', href: '/admin', icon: 'admin_panel_settings', desc: 'System health and global parameters' },
]

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  if (!user) return null

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center
                      border-t border-[#1a2235] bg-[#080d1a]/95 backdrop-blur-md
                      lg:hidden"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {MOBILE_NAV.map(item => {
          const isActive = !isMenuOpen && (pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href)))

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMenuOpen(false)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1',
                'min-h-[44px] transition-all duration-150 relative',
                isActive ? 'text-[#3B82F6]' : 'text-[#4B5563] hover:text-[#6B7280]'
              )}
            >
              <span
                className="material-symbols-outlined text-[24px]"
                style={{
                  fontVariationSettings: isActive
                    ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
                    : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                }}
              >
                {item.icon}
              </span>
              <span className={cn(
                'text-[10px] leading-none',
                isActive ? 'font-semibold text-[#3B82F6]' : 'text-[#4B5563]'
              )}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 h-0.5 w-6 rounded-full bg-[#3B82F6]" />
              )}
            </Link>
          )
        })}

        {/* Menu Tab Button */}
        <button
          onClick={() => setIsMenuOpen(p => !p)}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1',
            'min-h-[44px] transition-all duration-150 relative',
            isMenuOpen ? 'text-[#3B82F6]' : 'text-[#4B5563] hover:text-[#6B7280]'
          )}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={{
              fontVariationSettings: isMenuOpen
                ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
                : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
            }}
          >
            menu
          </span>
          <span className={cn(
            'text-[10px] leading-none',
            isMenuOpen ? 'font-semibold text-[#3B82F6]' : 'text-[#4B5563]'
          )}>
            Menu
          </span>
          {isMenuOpen && (
            <span className="absolute bottom-1 h-0.5 w-6 rounded-full bg-[#3B82F6]" />
          )}
        </button>
      </nav>

      {/* Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-20 bg-[#060B16] pt-16 pb-20 px-6 overflow-y-auto lg:hidden">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Project Navigation</h2>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111827] text-slate-400 hover:text-white"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
          <div className="grid gap-3">
            {ALL_LINKS.map(link => {
              const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
              return (
                <button
                  key={link.href}
                  onClick={() => {
                    setIsMenuOpen(false)
                    router.push(link.href)
                  }}
                  className={cn(
                    'flex items-center gap-4 rounded-xl p-3 text-left transition-colors border',
                    isActive 
                      ? 'bg-[#1F2937]/35 border-[#3B82F6]/50' 
                      : 'bg-[#111827]/40 border-[#1F2937] hover:border-slate-800'
                  )}
                >
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    isActive ? 'bg-[#3B82F6]/10 text-[#3B82F6]' : 'bg-[#111827] text-slate-400'
                  )}>
                    <span className="material-symbols-outlined">{link.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-semibold', isActive ? 'text-[#3B82F6]' : 'text-white')}>{link.label}</p>
                    <p className="text-[11px] text-[#9CA3AF] truncate mt-0.5">{link.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}