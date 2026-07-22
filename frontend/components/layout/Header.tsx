'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useProjectContext } from '@/contexts/ProjectContext'
import { timeAgo, cn, getInitials } from '@/lib/utils'
import { SettingsPanel } from './SettingsPanel'

interface NotificationItem {
  id: string
  type: 'critical' | 'success' | 'ai' | 'info'
  title: string
  description: string
  createdAt: string
  isRead: boolean
}

const DEMO_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1', type: 'critical', isRead: false,
    title: 'Critical risk detected',
    description: 'Cooling tower delay now CRITICAL',
    createdAt: new Date(Date.now() - 2 * 60000).toISOString(),
  },
  {
    id: '2', type: 'success', isRead: false,
    title: 'Analysis complete',
    description: '25 tasks processed, 3 risks found',
    createdAt: new Date(Date.now() - 60 * 60000).toISOString(),
  },
  {
    id: '3', type: 'ai', isRead: true,
    title: 'AI insight available',
    description: 'Recovery simulation ready to review',
    createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
]

const DOT_COLOUR: Record<NotificationItem['type'], string> = {
  critical: 'bg-[#EF4444]',
  success:  'bg-[#22C55E]',
  ai:       'bg-[#14B8A6]',
  info:     'bg-[#3B82F6]',
}

function NotificationList({
  notifications,
  onClose,
}: {
  notifications: NotificationItem[]
  onClose: () => void
}) {
  return (
    <>
      {notifications.map(n => (
        <div
          key={n.id}
          onClick={onClose}
          className={cn(
            'flex gap-3 border-b border-[#1a2235] px-4 py-3.5',
            'transition-colors hover:bg-[#111827] cursor-pointer last:border-0',
            !n.isRead && 'bg-[#1F2937]/30'
          )}
        >
          <div className="relative mt-1.5 shrink-0">
            <span className={cn('h-2 w-2 rounded-full block', DOT_COLOUR[n.type])} />
            {!n.isRead && n.type === 'critical' && (
              <span className={cn(
                'absolute inset-0 rounded-full animate-ping opacity-75',
                DOT_COLOUR[n.type]
              )} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn(
              'text-sm text-white leading-tight',
              !n.isRead && 'font-semibold'
            )}>
              {n.title}
            </p>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">{n.description}</p>
            <p className="mt-1 text-[10px] text-[#4B5563]">{timeAgo(n.createdAt)}</p>
          </div>
          {!n.isRead && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#3B82F6]" />
          )}
        </div>
      ))}
    </>
  )
}

export function Header() {
  const { user } = useAuth()
  const { activeProject } = useProjectContext()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSettings, setShowSettings]           = useState(false)
  const [notifications, setNotifications]         = useState(DEMO_NOTIFICATIONS)

  if (!user) return null

  const unreadCount = notifications.filter(n => !n.isRead).length
  const delay       = activeProject
    ? (activeProject.predicted_completion_day ?? 0) - (activeProject.baseline_completion_day ?? 0)
    : 0

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between
                         border-b border-[#1a2235] bg-[#080d1a]/95 px-4 backdrop-blur-md
                         lg:px-6">

        {/* ── Left: Search (desktop) / Project name (mobile) ─────────────── */}
        <div className="flex flex-1 items-center gap-3">

          {/* Desktop search */}
          <div className="relative hidden max-w-xs flex-1 md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2
                             -translate-y-1/2 text-[18px] text-[#4B5563]">
              search
            </span>
            <input
              type="text"
              placeholder="Search insights..."
              className="w-full rounded-lg border border-transparent bg-[#111827]/80
                         py-1.5 pl-9 pr-3 text-sm text-[#dce2f7] outline-none
                         transition-all placeholder:text-[#4B5563]
                         hover:border-[#1F2937] focus:border-[#3B82F6] focus:bg-[#0A0F1E]"
            />
          </div>

          {/* Mobile: project name + status */}
          <div className="flex items-center gap-2 md:hidden">
            <span className="truncate text-sm font-semibold text-white">
              {activeProject?.name || 'PII'}
            </span>
            {delay > 0 && (
              <span className="animate-badge-pulse flex items-center gap-1 rounded-full
                               bg-[#F97316]/15 px-2 py-0.5 text-[10px] font-bold
                               text-[#F97316]">
                <span className="material-symbols-outlined text-xs">warning</span>
                Risk
              </span>
            )}
          </div>
        </div>

        {/* ── Right: Actions ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">

          {/* Notification bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(v => !v)}
              className={cn(
                'relative flex h-9 w-9 items-center justify-center rounded-lg',
                'text-[#6B7280] transition-colors hover:bg-[#111827] hover:text-white',
                showNotifications && 'bg-[#111827] text-white'
              )}
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>

              {/* Unread badge */}
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping
                                   rounded-full bg-[#EF4444] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#EF4444]" />
                </span>
              )}
            </button>

            {/* Notifications Menu Panels */}
            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowNotifications(false)}
                />

                {/* Desktop: dropdown panel */}
                <div className="absolute right-0 z-40 mt-2 hidden w-[360px]
                                animate-slide-in-up overflow-hidden rounded-xl
                                border border-[#1F2937] bg-[#0d1424] shadow-2xl
                                lg:block">
                  <div className="flex items-center justify-between border-b
                                  border-[#1a2235] px-4 py-3">
                    <span className="text-sm font-semibold text-white">
                      Notifications
                      {unreadCount > 0 && (
                        <span className="ml-2 rounded-full bg-[#EF4444] px-1.5 py-0.5
                                         text-[10px] font-bold text-white">
                          {unreadCount}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={markAllRead}
                      className="text-xs text-[#3B82F6] hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    <NotificationList
                      notifications={notifications}
                      onClose={() => setShowNotifications(false)}
                    />
                  </div>
                  <div className="border-t border-[#1a2235] px-4 py-2.5 text-center">
                    <button className="text-xs text-[#3B82F6] hover:underline">
                      View All Notifications →
                    </button>
                  </div>
                </div>

                {/* Mobile: full screen takeover */}
                <div className="fixed inset-0 z-50 flex flex-col bg-[#080d1a] lg:hidden">
                  <div className="flex items-center justify-between border-b
                                  border-[#1a2235] px-4 py-4">
                    <span className="text-sm font-semibold text-white">
                      Notifications
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={markAllRead}
                        className="text-xs text-[#3B82F6]"
                      >
                        Mark all read
                      </button>
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-[#6B7280] hover:text-white"
                      >
                        <span className="material-symbols-outlined text-xl">close</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <NotificationList
                      notifications={notifications}
                      onClose={() => setShowNotifications(false)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Settings icon (desktop gear) */}
          <button
            onClick={() => setShowSettings(true)}
            className="hidden h-9 w-9 items-center justify-center rounded-lg
                       text-[#6B7280] transition-colors hover:bg-[#111827]
                       hover:text-white md:flex"
            title="Open Settings"
          >
            <span className="material-symbols-outlined text-[22px]">settings</span>
          </button>

          {/* Structural Pipeline Separator Divider */}
          <span className="hidden h-5 w-px bg-[#1a2235] md:block" />

          {/* User Profile Avatar Summary Link */}
          <div className="flex items-center gap-2.5 pl-1">
            <div className="hidden flex-col text-right sm:flex">
              <p className="text-xs font-semibold text-white leading-tight">{user.full_name}</p>
              <p className="text-[10px] text-[#6B7280] tracking-wider uppercase mt-0.5">
                {user.role}
              </p>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full
                         bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-xs
                         font-bold text-white shadow-md ring-2 ring-transparent transition-all
                         hover:ring-[#3B82F6]/50"
            >
              {getInitials(user.full_name)}
            </button>
          </div>

        </div>
      </header>

      {/* Slide-over Settings Side Panel */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  )
}