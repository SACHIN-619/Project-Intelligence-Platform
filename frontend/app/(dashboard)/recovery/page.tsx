'use client'

import { useEffect, useState, useCallback } from 'react'
import { useProjectContext } from '@/contexts/ProjectContext'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { autoRecover, runSimulation, getDashboard } from '@/lib/api'
import { MetricCard } from '@/components/ui/MetricCard'
import { RecoveryOptions } from '@/components/recovery/RecoveryOptions'
import { SimulationResult } from '@/components/recovery/SimulationResult'
import { canSimulate } from '@/lib/auth'
import type { RecoveryOption, ScenarioResult, ProjectHealthDashboard } from '@/types'

const ACTION_LABEL: Record<string, string> = {
  backup_vendor:       'Activate Backup Supplier',
  parallel_execution:  'Run Tasks in Parallel',
  add_crew:            'Add Crew / Night Shift',
  reschedule:          'Reschedule Task',
  accelerate:          'Accelerate Work Package',
  defer_non_critical:  'Defer Non-Critical Task',
}

export default function RecoveryPage() {
  const router = useRouter()
  const { activeProject } = useProjectContext()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [options, setOptions]         = useState<RecoveryOption[]>([])
  const [dashboard, setDashboard]     = useState<ProjectHealthDashboard | null>(null)
  const [result, setResult]           = useState<ScenarioResult | null>(null)
  const [selectedIndex, setSelected]  = useState<number | null>(null)
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [isSimulating, setIsSimulating]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const userCanSimulate = user ? canSimulate(user.role) : false

  const loadData = useCallback(async () => {
    if (!activeProject) { setIsLoadingOptions(false); return }
    setIsLoadingOptions(true); setError(null)

    const [optRes, dashRes] = await Promise.all([
      autoRecover(activeProject.id),
      getDashboard(activeProject.id),
    ])

    if (optRes.error && optRes.status !== 422 && optRes.status !== 404) {
      setError(optRes.error)
    }
    setOptions(optRes.data || [])
    setDashboard(dashRes.data)
    setIsLoadingOptions(false)
  }, [activeProject])

  useEffect(() => { loadData() }, [loadData])

  async function handleRunSimulation(option: RecoveryOption, delayReduction: number) {
    if (!activeProject) return
    setIsSimulating(true); setResult(null)

    const { data, error: err } = await runSimulation({
      project_id:    activeProject.id,
      action_type:   option.action_type,
      action_params: { delay_reduction_days: delayReduction },
      name:          `${ACTION_LABEL[option.action_type] || option.title} — ${delayReduction}d recovery`,
    })
    setIsSimulating(false)

    if (err || !data) {
      showToast('error', err || 'Simulation failed. Please try again.')
      return
    }
    setResult(data)
    showToast('success', `Simulation complete — ${data.days_saved} days recovered`)
  }

  if (user && !userCanSimulate) return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="material-symbols-outlined text-4xl text-[#374151]">lock</span>
      <h2 className="text-base font-semibold text-white">Read-only access</h2>
      <p className="max-w-sm text-sm text-[#6B7280]">
        Your role cannot run simulations. Contact your project manager.
      </p>
    </div>
  )

  if (!activeProject) return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="material-symbols-outlined text-4xl text-[#374151]">folder_off</span>
      <p className="text-sm text-white">No project selected</p>
      <button onClick={() => router.push('/dashboard')} className="btn-primary text-sm">
        Go to Dashboard
      </button>
    </div>
  )

  const delay      = dashboard?.predicted_delay_days ?? 0
  const confidence = dashboard?.confidence ?? 0

  return (
    <div className="p-4 lg:p-6">

      {/* Page header */}
      <div className="mb-5 border-b border-[#1a2235] pb-4">
        <h1 className="text-xl font-bold text-white lg:text-2xl">Recovery Lab</h1>
        <p className="mt-0.5 text-sm text-[#6B7280]">
          Simulate recovery actions and see before vs. after impact on project schedule
        </p>
      </div>

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          numericValue={delay}
          prefix={delay > 0 ? '+' : ''}
          label="Days Late"
          subtext="current prediction"
          colour={delay > 0 ? 'red' : 'green'}
          animDelay={0}
        />
        <MetricCard
          numericValue={Math.round(confidence * 100)}
          suffix="%"
          label="On-Time Prob."
          subtext={confidence < 0.4 ? 'recovery needed' : 'acceptable range'}
          colour={confidence < 0.4 ? 'red' : confidence < 0.7 ? 'amber' : 'green'}
          animDelay={100}
          showDashWhenZero={true}
        />
        <MetricCard
          numericValue={options.length}
          label="Options Available"
          subtext="ranked by impact score"
          colour="blue"
          animDelay={200}
        />
        <MetricCard
          value={result ? `${result.days_saved}d saved` : '—'}
          label="Last Simulated"
          subtext={result ? result.name.slice(0, 20) + '...' : 'run a simulation'}
          colour="teal"
          animDelay={300}
        />
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#EF4444]/30
                        bg-[#EF4444]/10 p-3">
          <span className="material-symbols-outlined text-base text-[#EF4444]">error</span>
          <p className="text-sm text-[#EF4444]">{error}</p>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">

        {/* Recovery options */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Recovery Options
            </h3>
            <span className="text-[11px] text-[#4B5563]">
              Ranked by days recovered
            </span>
          </div>
          <RecoveryOptions
            options={options}
            isLoading={isLoadingOptions}
            selectedIndex={selectedIndex}
            onSelect={setSelected}
            onRunSimulation={handleRunSimulation}
            isSimulating={isSimulating}
          />
        </div>

        {/* Simulation result */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Simulation Result
            </h3>
            {result && (
              <span className="flex items-center gap-1 rounded-full bg-[#22C55E]/15
                               px-2.5 py-0.5 text-[11px] font-bold text-[#22C55E]">
                <span className="material-symbols-outlined text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                Complete
              </span>
            )}
          </div>
          <SimulationResult
            result={result}
            isLoading={isSimulating}
            onApproved={() => {
              showToast('success', 'Recovery plan approved — action created on board')
              router.push('/actions')
            }}
          />
        </div>
      </div>
    </div>
  )
}