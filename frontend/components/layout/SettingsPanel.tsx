'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ROLE_LABELS } from '@/lib/auth'
import { getInitials, cn } from '@/lib/utils'

interface SettingsPanelProps {
  onClose: () => void
}

function Toggle({
  isOn,
  onToggle,
  disabled = false,
}: {
  isOn: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      onClick={!disabled ? onToggle : undefined}
      className={cn('toggle-track', isOn ? 'on' : 'off')}
      disabled={disabled}
    >
      <span className="toggle-thumb" />
    </button>
  )
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { user, logout } = useAuth()

  const [answerStyle, setAnswerStyle] = useState<'concise' | 'balanced' | 'technical'>(
    user?.preferences.answer_style || 'balanced'
  )
  const [notifications, setNotifications] = useState(
    user?.preferences.notifications || {
      risk_alerts:       true,
      analysis_complete: true,
      approval_needed:   true,
      weekly_digest:     false,
    }
  )
  const [activeSection, setActiveSection] = useState<'profile' | 'preferences' | 'security'>('profile')

  if (!user) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — slides in from right on desktop, full screen on mobile */}
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0d1424]
                      lg:inset-auto lg:right-0 lg:top-0 lg:h-screen lg:w-[380px]
                      lg:border-l lg:border-[#1a2235] lg:shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between
                        border-b border-[#1a2235] bg-[#0d1424] px-5 py-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            Settings &amp; Profile
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg
                       text-[#6B7280] transition-colors hover:bg-[#1F2937] hover:text-white"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-[#1a2235]">
          {[
            { id: 'profile' as const,     label: 'Profile',     icon: 'person' },
            { id: 'preferences' as const, label: 'Preferences', icon: 'tune' },
            { id: 'security' as const,    label: 'Security',    icon: 'lock' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-3 text-xs',
                'font-medium transition-colors',
                activeSection === tab.id
                  ? 'border-b-2 border-[#3B82F6] text-[#3B82F6]'
                  : 'text-[#6B7280] hover:text-[#9CA3AF]'
              )}
            >
              <span className="material-symbols-outlined text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ── PROFILE SECTION ────────────────────────────────────────────── */}
          {activeSection === 'profile' && (
            <div className="flex flex-col gap-4 animate-entrance">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3 rounded-xl border
                              border-[#1F2937] bg-[#111827] py-6">
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full
                                  bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8]
                                  text-2xl font-bold text-white shadow-lg">
                    {getInitials(user.full_name)}
                  </div>
                  <button className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center
                                     justify-center rounded-full border border-[#374151]
                                     bg-[#1F2937] text-[#6B7280] transition-colors
                                     hover:text-white">
                    <span className="material-symbols-outlined text-sm">photo_camera</span>
                  </button>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-white">{user.full_name}</p>
                  <p className="mt-0.5 text-xs text-[#6B7280]">{user.email}</p>
                </div>
              </div>

              {/* Form fields */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#9CA3AF]">
                  Full Name
                </label>
                <input
                  defaultValue={user.full_name}
                  className="input-dark"
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#9CA3AF]">
                  Email Address
                </label>
                <input
                  defaultValue={user.email}
                  disabled
                  className="input-dark cursor-not-allowed opacity-50"
                />
                <p className="mt-1 flex items-center gap-1 text-[11px] text-[#6B7280]">
                  <span className="material-symbols-outlined text-xs">info</span>
                  Contact admin to change your email
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#9CA3AF]">Role</label>
                <div className="flex items-center gap-2 rounded-lg border border-[#374151]
                                bg-[#0A0F1E] px-3 py-2.5 opacity-70">
                  <span className="material-symbols-outlined text-sm text-[#3B82F6]">
                    badge
                  </span>
                  <span className="text-sm text-[#dce2f7]">{ROLE_LABELS[user.role]}</span>
                </div>
              </div>

              <button className="btn-primary w-full justify-center">
                <span className="material-symbols-outlined text-base">save</span>
                Save Profile Changes
              </button>
            </div>
          )}

          {/* ── PREFERENCES SECTION ─────────────────────────────────────────── */}
          {activeSection === 'preferences' && (
            <div className="flex flex-col gap-5 animate-entrance">

              {/* Answer Style */}
              <div>
                <p className="mb-1 text-sm font-semibold text-white">Answer Style</p>
                <p className="mb-3 text-xs text-[#6B7280]">
                  How AI responds to your questions in the assistant
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    { id: 'concise' as const,   label: 'Concise',   desc: 'Short, direct answers' },
                    { id: 'balanced' as const,  label: 'Balanced',  desc: 'Detail with clarity' },
                    { id: 'technical' as const, label: 'Technical', desc: 'Full technical depth' },
                  ].map(style => (
                    <label
                      key={style.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3',
                        'transition-all',
                        answerStyle === style.id
                          ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                          : 'border-[#374151] hover:border-[#4B5563]'
                      )}
                    >
                      <input
                        type="radio"
                        checked={answerStyle === style.id}
                        onChange={() => setAnswerStyle(style.id)}
                        className="accent-[#3B82F6]"
                      />
                      <div>
                        <p className="text-sm font-medium text-white">{style.label}</p>
                        <p className="text-xs text-[#6B7280]">{style.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notifications */}
              <div>
                <p className="mb-1 text-sm font-semibold text-white">Notifications</p>
                <p className="mb-3 text-xs text-[#6B7280]">
                  Choose what alerts you receive
                </p>
                <div className="flex flex-col gap-0.5 rounded-xl border border-[#1F2937]
                                bg-[#111827] overflow-hidden">
                  {[
                    { key: 'risk_alerts' as const,       label: 'Risk alerts',       icon: 'warning' },
                    { key: 'analysis_complete' as const, label: 'Analysis complete', icon: 'auto_awesome' },
                    { key: 'approval_needed' as const,   label: 'Approval needed',   icon: 'approval' },
                    { key: 'weekly_digest' as const,     label: 'Weekly digest',     icon: 'mail' },
                  ].map(({ key, label, icon }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between border-b border-[#1F2937]
                                 px-4 py-3 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-base text-[#6B7280]">
                          {icon}
                        </span>
                        <span className="text-sm text-[#dce2f7]">{label}</span>
                      </div>
                      <Toggle
                        isOn={notifications[key]}
                        onToggle={() =>
                          setNotifications(prev => ({ ...prev, [key]: !prev[key] }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── SECURITY SECTION ────────────────────────────────────────────── */}
          {activeSection === 'security' && (
            <div className="flex flex-col gap-4 animate-entrance">
              <div>
                <p className="mb-1 text-sm font-semibold text-white">Change Password</p>
                <p className="mb-3 text-xs text-[#6B7280]">
                  Choose a strong password with at least 8 characters
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#9CA3AF]">
                  Current password
                </label>
                <input type="password" placeholder="••••••••" className="input-dark" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#9CA3AF]">
                  New password
                </label>
                <input type="password" placeholder="••••••••" className="input-dark" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#9CA3AF]">
                  Confirm new password
                </label>
                <input type="password" placeholder="••••••••" className="input-dark" />
              </div>
              <button className="btn-primary w-full justify-center">
                <span className="material-symbols-outlined text-base">lock_reset</span>
                Update Password
              </button>

              {/* Active sessions */}
              <div>
                <p className="mb-2 text-sm font-semibold text-white">Active Sessions</p>
                <div className="flex items-center gap-3 rounded-lg border border-[#1F2937]
                                bg-[#111827] px-4 py-3">
                  <span className="status-dot-green" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-white">Chrome · Current session</p>
                    <p className="text-[11px] text-[#6B7280]">Hyderabad, India · Just now</p>
                  </div>
                  <span className="rounded-full bg-[#22C55E]/15 px-2 py-0.5 text-[10px]
                                   font-semibold text-[#22C55E]">
                    Active
                  </span>
                </div>
              </div>

              {/* Danger zone */}
              <div className="rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/5 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#EF4444]">
                  Danger Zone
                </p>
                <button
                  onClick={logout}
                  className="btn-reject w-full justify-center"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}