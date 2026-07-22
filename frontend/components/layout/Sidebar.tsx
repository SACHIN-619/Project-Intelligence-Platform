'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useProjectContext } from '@/contexts/ProjectContext'
import { NAV_ITEMS } from '@/types'
import { ROLE_LABELS, ROLE_BADGE_CLASS } from '@/lib/auth'
import { getInitials, cn } from '@/lib/utils'
import { SettingsPanel } from './SettingsPanel'

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user } = useAuth()
  const { projects, activeProject, setActiveProjectId } = useProjectContext()
  const [showSwitcher, setShowSwitcher]   = useState(false)
  const [showSettings, setShowSettings]   = useState(false)

  if (!user) return null

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(user.role))

  return (
    <>
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[240px] flex-col
                        border-r border-[#1a2235] bg-[#080d1a] lg:flex">

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 pb-4 pt-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl
                          bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] shadow-lg
                          shadow-[#3B82F6]/20">
            <span
              className="material-symbols-outlined text-lg text-white"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              hub
            </span>
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-white tracking-wide">PII</p>
            <p className="text-[10px] leading-tight text-[#4B5563] tracking-wider uppercase">
              Intelligence Cockpit
            </p>
          </div>
        </div>

        {/* Project switcher */}
        <div className="px-3 pb-3">
          <button
            onClick={() => setShowSwitcher(v => !v)}
            className="flex w-full items-center gap-2.5 rounded-lg border border-[#1F2937]
                       bg-[#111827] px-3 py-2.5 text-left transition-all
                       hover:border-[#3B82F6]/40 hover:bg-[#1a2235]"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#3B82F6]" />
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-[#dce2f7]">
              {activeProject?.name || 'No project selected'}
            </p>
            <span className="material-symbols-outlined shrink-0 text-[18px] text-[#6B7280]">
              {showSwitcher ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* Dropdown */}
          {showSwitcher && (
            <div className="mt-1 overflow-hidden rounded-lg border border-[#1F2937]
                            bg-[#111827] shadow-xl">
              {projects.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-[#6B7280]">No projects yet</p>
              ) : (
                <div className="max-h-44 overflow-y-auto py-1">
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setActiveProjectId(p.id); setShowSwitcher(false) }}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs',
                        'transition-colors hover:bg-[#1F2937]',
                        p.id === activeProject?.id ? 'text-[#3B82F6]' : 'text-[#9CA3AF]'
                      )}
                    >
                      <span className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        p.id === activeProject?.id ? 'bg-[#3B82F6]' : 'bg-[#374151]'
                      )} />
                      <span className="truncate">{p.name}</span>
                      {p.id === activeProject?.id && (
                        <span className="material-symbols-outlined ml-auto text-sm text-[#3B82F6]">
                          check
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="border-t border-[#1F2937] p-1.5">
                <button
                  onClick={() => { router.push('/dashboard?new=true'); setShowSwitcher(false) }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2
                             text-xs text-[#3B82F6] transition-colors hover:bg-[#1F2937]"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span>
                  New Project
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-1">
          <ul className="flex flex-col gap-0.5">
            {visibleItems.map(item => {
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href))

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                      'transition-all duration-150',
                      isActive
                        ? 'bg-gradient-to-r from-[#3B82F6]/15 to-transparent border-l-[3px] border-[#3B82F6] text-white font-semibold shadow-[inset_3px_0_8px_rgba(59,130,246,0.1)]'
                        : 'border-l-[3px] border-transparent text-[#9CA3AF] hover:bg-[#111827] hover:text-[#dce2f7]'
                    )}
                  >
                    <span
                      className={cn(
                        'material-symbols-outlined text-[20px] transition-colors',
                        isActive ? 'text-[#3B82F6]' : 'text-[#6B7280] group-hover:text-[#9CA3AF]'
                      )}
                      style={isActive
                        ? { fontVariationSettings: "'FILL' 1, 'wght' 500" }
                        : { fontVariationSettings: "'FILL' 0, 'wght' 400" }
                      }
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>

                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User profile section link */}
        <div className="border-t border-[#1a2235] p-3">
          <button
            onClick={() => setShowSettings(true)}
            className="group flex w-full items-center gap-3 rounded-lg p-2.5 text-left
                       transition-all hover:bg-[#111827]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                            bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-xs
                            font-bold text-white shadow-md shadow-[#3B82F6]/20">
              {getInitials(user.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                {user.full_name}
              </p>
              <span className={cn(
                'mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium',
                ROLE_BADGE_CLASS[user.role]
              )}>
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <span className="material-symbols-outlined text-base text-[#4B5563]
                             transition-colors group-hover:text-[#9CA3AF]">
              settings
            </span>
          </button>
        </div>
      </aside>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  )
}