// components/dashboard/ScenarioPanel.tsx
'use client'

import { StatusDot } from '@/components/ui/StatusDot'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { ScenarioResult } from '@/types'

interface ScenarioPanelProps {
  scenarios: ScenarioResult[]
  isLoading: boolean
  onViewLogs?: () => void
}

export function ScenarioPanel({ scenarios, isLoading, onViewLogs }: ScenarioPanelProps) {
  const active = scenarios[0]

  if (isLoading) {
    return <div className="skeleton h-64 w-full" />
  }

  if (!active) {
    return (
      <div className="card-panel flex flex-col items-center justify-center gap-2 p-8 text-center">
        <span className="material-symbols-outlined text-3xl text-[#374151]">science</span>
        <p className="text-sm text-[#6B7280]">No active scenarios yet</p>
        <p className="text-xs text-[#4B5563]">
          Visit Recovery Lab to simulate recovery options
        </p>
      </div>
    )
  }

  return (
    <div className="card-panel p-4">
      <div className="flex items-center gap-2">
        <StatusDot colour="blue" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3B82F6]">
          Running Simulation
        </span>
      </div>
      <h4 className="mt-1.5 text-sm font-semibold text-white">{active.name}</h4>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-[#6B7280]">
          Computation Progress
        </span>
        <span className="text-xs font-semibold text-white">
          {Math.min(100, Math.round((active.confidence || 0.5) * 100))}%
        </span>
      </div>
      <ProgressBar
        value={Math.min(100, Math.round((active.confidence || 0.5) * 100))}
        colour="#3B82F6"
        className="mt-1.5"
      />

      <div className="mt-4 flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[#6B7280]">Target Metric</span>
          <span className="text-[#dce2f7]">Days saved</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#6B7280]">Old Delay</span>
          <span className="text-[#dce2f7]">{active.old_delay_days} days</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#6B7280]">New Delay</span>
          <span className="metric-green font-semibold">{active.new_delay_days} days</span>
        </div>
      </div>

      {onViewLogs && (
        <button
          onClick={onViewLogs}
          className="btn-ghost mt-4 w-full justify-center border-[#3B82F6] text-[#3B82F6]"
        >
          View Scenario Logs
        </button>
      )}
    </div>
  )
}
