/**
 * components/intelligence/TabBar.tsx
 * =====================================
 * Tab switcher for the Intelligence screen.
 * Three tabs: Critical Path | Risk Register | Monte Carlo
 *
 * Shows a red badge count on Risk Register when risks exist.
 * Active tab has a 2px blue underline and white text.
 * Inactive tabs are grey and hover to light grey.
 */
'use client'

import { cn } from '@/lib/utils'

export type IntelligenceTab = 'critical_path' | 'risk_register' | 'monte_carlo'

interface TabBarProps {
  active:      IntelligenceTab
  onChange:    (tab: IntelligenceTab) => void
  riskCount?:  number   // shows badge on Risk Register tab
}

const TABS: { id: IntelligenceTab; label: string; icon: string }[] = [
  { id: 'critical_path', label: 'Critical Path',  icon: 'timeline'   },
  { id: 'risk_register', label: 'Risk Register',  icon: 'warning'    },
  { id: 'monte_carlo',   label: 'Monte Carlo',    icon: 'bar_chart'  },
]

export function TabBar({ active, onChange, riskCount }: TabBarProps) {
  return (
    <div className="flex border-b border-[#1F2937] bg-[#111827]">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-3 text-sm transition-colors',
            'relative focus:outline-none',
            active === tab.id ? 'tab-active' : 'tab-inactive'
          )}
        >
          <span className="material-symbols-outlined text-base">{tab.icon}</span>
          <span className="hidden sm:inline">{tab.label}</span>

          {/* Risk count badge — only shows on Risk Register when there are risks */}
          {tab.id === 'risk_register' && riskCount && riskCount > 0 && (
            <span className="badge-red ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {riskCount}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
