// app/(dashboard)/dashboard/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useProjectContext } from '@/contexts/ProjectContext'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { getDashboard, getAnalysis, listScenarios, createProject } from '@/lib/api'
import { KPIStrip } from '@/components/dashboard/KPIStrip'
import { RiskCard } from '@/components/dashboard/RiskCard'
import { ScenarioPanel } from '@/components/dashboard/ScenarioPanel'
import { HealthScoreBadge } from '@/components/ui/HealthScoreGauge'
import { canUpload, canSimulate } from '@/lib/auth'
import { sortBySeverity } from '@/lib/utils'
import type { ProjectHealthDashboard, RiskSummary, ScenarioResult } from '@/types'

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { activeProject, refreshProjects } = useProjectContext()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [dashboard, setDashboard]   = useState<ProjectHealthDashboard | null>(null)
  const [risks, setRisks]           = useState<RiskSummary[]>([])
  const [scenarios, setScenarios]   = useState<ScenarioResult[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [showNewProject, setShowNewProject] = useState(searchParams.get('new') === 'true')
  const [newProjectName, setNewProjectName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const loadData = useCallback(async () => {
    if (!activeProject) { setIsLoading(false); return }
    setIsLoading(true); setError(null)
    const [dashRes, analysisRes, scenarioRes] = await Promise.all([
      getDashboard(activeProject.id),
      getAnalysis(activeProject.id),
      listScenarios(activeProject.id),
    ])
    if (dashRes.error && dashRes.status !== 404 && dashRes.status !== 422) setError(dashRes.error)
    setDashboard(dashRes.data)
    setRisks(analysisRes.data ? sortBySeverity(analysisRes.data.risks) : [])
    setScenarios(scenarioRes.data || [])
    setIsLoading(false)
  }, [activeProject])

  useEffect(() => { loadData() }, [loadData])

  async function handleCreateProject() {
    if (!newProjectName.trim()) return
    setIsCreating(true)
    const { data, error: err } = await createProject({ name: newProjectName.trim() })
    setIsCreating(false)
    if (err || !data) { showToast('error', err || 'Could not create project.'); return }
    showToast('success', `Project "${data.name}" created`)
    setShowNewProject(false); setNewProjectName('')
    await refreshProjects()
    router.push('/upload')
  }

  const delay           = dashboard?.predicted_delay_days ?? 0
  const isAtRisk        = delay > 0
  const topRisks        = risks.slice(0, 5)
  const userCanUpload   = user ? canUpload(user.role) : false
  const userCanSimulate = user ? canSimulate(user.role) : false

  // ── No project ────────────────────────────────────────────────────────────
  if (!isLoading && !activeProject) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-5 px-4 text-center">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-64 w-64 rounded-full bg-[#3B82F6]/5 blur-3xl" />
        </div>

        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-[#374151] bg-[#111827]">
          <span className="material-symbols-outlined text-4xl text-[#374151]">folder_open</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">No projects yet</h2>
          <p className="mt-2 text-sm text-[#6B7280]">
            Create your first project to start analysing schedules and risks
          </p>
        </div>
        <button onClick={() => setShowNewProject(true)} className="btn-primary text-sm">
          <span className="material-symbols-outlined text-base">add</span>
          Create Your First Project
        </button>

        {showNewProject && (
          <NewProjectModal
            value={newProjectName} onChange={setNewProjectName}
            onCancel={() => setShowNewProject(false)}
            onConfirm={handleCreateProject} isCreating={isCreating}
          />
        )}
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div
        className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between
                   border-b border-[#1F2937] pb-4"
      >
        <div>
          <p className="text-xs font-mono text-[#6B7280]">
            Project ID: {activeProject?.id.slice(0, 8).toUpperCase() || '—'}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-white lg:text-2xl">
              {activeProject?.name}
            </h1>
            {isAtRisk && (
              <span className="animate-badge-pulse flex items-center gap-1 rounded-full
                               bg-[#F97316]/15 px-3 py-1 text-[11px] font-bold
                               uppercase tracking-wide text-[#F97316]">
                <span className="material-symbols-outlined text-sm">warning</span>
                At Risk
              </span>
            )}
            {!isAtRisk && !isLoading && dashboard && (
              <span className="flex items-center gap-1 rounded-full bg-[#22C55E]/15
                               px-3 py-1 text-[11px] font-bold uppercase tracking-wide
                               text-[#22C55E]">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                On Track
              </span>
            )}
            {/* NEW — Phase 9: Project Health Engine badge */}
            <HealthScoreBadge
              score={dashboard?.health_score}
              isLoading={isLoading}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => router.push('/report')} className="btn-ghost text-sm">
            <span className="material-symbols-outlined text-base">download</span>
            Export
          </button>
          {userCanSimulate && (
            <button onClick={() => router.push('/recovery')} className="btn-primary text-sm">
              <span className="material-symbols-outlined text-base">play_arrow</span>
              Run Simulation
            </button>
          )}
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-[#EF4444]/30
                        bg-[#EF4444]/10 p-3">
          <span className="material-symbols-outlined text-base text-[#EF4444]">error</span>
          <p className="text-sm text-[#EF4444]">{error}</p>
        </div>
      )}

      {/* ── KPI Strip ────────────────────────────────────────────────────── */}
      <KPIStrip dashboard={dashboard} isLoading={isLoading} />

      {/* ── No data nudge ─────────────────────────────────────────────────── */}
      {!isLoading && !error && risks.length === 0 && (
        <div className="card-panel mt-5 animate-entrance" style={{ animationDelay: '0.5s' }}>
          <div className="flex flex-col items-center gap-4 p-10 text-center">
            {/* Animated upload icon */}
            <div className="relative flex h-16 w-16 items-center justify-center
                            rounded-2xl border border-[#374151] bg-[#1F2937]">
              <span className="material-symbols-outlined text-3xl text-[#3B82F6]">
                upload_file
              </span>
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center
                               justify-center rounded-full bg-[#3B82F6] text-[10px]
                               font-bold text-white">
                +
              </span>
            </div>
            <div>
              <p className="text-base font-semibold text-white">No project data yet</p>
              <p className="mt-1.5 text-sm text-[#6B7280]">
                Upload a project schedule CSV or XLSX to see AI-powered risk analysis,
                critical path mapping, and recovery simulations.
              </p>
            </div>
            {userCanUpload && (
              <button onClick={() => router.push('/upload')} className="btn-primary text-sm">
                <span className="material-symbols-outlined text-base">upload_file</span>
                Go to Upload Center →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Risks + Scenarios ─────────────────────────────────────────────── */}
      {(risks.length > 0 || scenarios.length > 0) && (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">

          {/* Top Active Risks */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF]">
                Top Active Risks
              </h3>
              {topRisks.length > 0 && (
                <button
                  onClick={() => router.push('/intelligence?tab=risk_register')}
                  className="text-xs text-[#3B82F6] hover:underline"
                >
                  View all →
                </button>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="skeleton h-24 w-full rounded-md" />
                  ))
                : topRisks.length > 0
                ? topRisks.map((risk, i) => (
                    <div
                      key={risk.id}
                      className="animate-entrance"
                      style={{ animationDelay: `${0.5 + i * 0.1}s` }}
                    >
                      <RiskCard
                        risk={risk}
                        onCreateAction={() => router.push('/actions')}
                      />
                    </div>
                  ))
                : (
                    <div className="card-panel flex flex-col items-center gap-2 p-6 text-center">
                      <span className="material-symbols-outlined text-2xl text-[#22C55E]"
                        style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                      <p className="text-sm text-[#9CA3AF]">No active risks detected</p>
                    </div>
                  )
              }
            </div>
          </div>

          {/* Active Scenarios */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Active Scenarios
            </h3>
            <div className="animate-entrance" style={{ animationDelay: '0.6s' }}>
              <ScenarioPanel
                scenarios={scenarios}
                isLoading={isLoading}
                onViewLogs={() => router.push('/recovery')}
              />
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewProject && (
        <NewProjectModal
          value={newProjectName} onChange={setNewProjectName}
          onCancel={() => setShowNewProject(false)}
          onConfirm={handleCreateProject} isCreating={isCreating}
        />
      )}
    </div>
  )
}

// ── New Project Modal ──────────────────────────────────────────────────────────
function NewProjectModal({
  value, onChange, onCancel, onConfirm, isCreating,
}: {
  value: string; onChange: (v: string) => void
  onCancel: () => void; onConfirm: () => void; isCreating: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4
                    backdrop-blur-sm">
      <div className="w-full max-w-md animate-slide-in-up rounded-xl border border-[#374151]
                      bg-[#111827] p-6 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl
                        bg-[#3B82F6]/15">
          <span className="material-symbols-outlined text-2xl text-[#3B82F6]">
            folder_open
          </span>
        </div>
        <h3 className="text-base font-bold text-white">New Project</h3>
        <p className="mt-1 text-sm text-[#9CA3AF]">
          Give your project a name to begin uploading data and generating intelligence.
        </p>
        <input
          autoFocus
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="e.g. Bangalore Data Center — Phase 1"
          className="input-dark mt-4"
          onKeyDown={e => e.key === 'Enter' && !isCreating && onConfirm()}
        />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="btn-ghost text-sm" disabled={isCreating}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!value.trim() || isCreating}
            className="btn-primary text-sm"
          >
            {isCreating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2
                                 border-white/30 border-t-white" />
                Creating...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">add</span>
                Create Project
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}