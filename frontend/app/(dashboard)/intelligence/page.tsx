'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useProjectContext } from '@/contexts/ProjectContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAnalysis } from '@/lib/api'
import { MetricCard } from '@/components/ui/MetricCard'
import { HealthScoreBadge } from '@/components/ui/HealthScoreGauge'
import { TabBar, type IntelligenceTab } from '@/components/intelligence/TabBar'
import { CriticalPathTab } from '@/components/intelligence/CriticalPathTab'
import { RiskRegisterTab } from '@/components/intelligence/RiskRegisterTab'
import { MonteCarloTab } from '@/components/intelligence/MonteCarloTab'
import { sortBySeverity } from '@/lib/utils'
import type { AnalysisResult } from '@/types'

function IntelligenceContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { activeProject } = useProjectContext()

  const [analysis, setAnalysis]   = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<IntelligenceTab>('critical_path')

  // Sync active tab with URL search params dynamically
  useEffect(() => {
    const tabParam = searchParams.get('tab') as IntelligenceTab | null
    if (tabParam && ['critical_path', 'risk_register', 'monte_carlo'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  const loadAnalysis = useCallback(async () => {
    if (!activeProject) { setIsLoading(false); return }
    setIsLoading(true); setError(null)
    const { data, error: err } = await getAnalysis(activeProject.id)
    if (err) {
      const isNoData = err.includes('missing') || err.includes('invalid') ||
                       err.includes('schedule') || err.includes('422') ||
                       err.includes('404')
      setError(isNoData ? 'no_tasks' : err)
    } else if (data) {
      data.risks = sortBySeverity(data.risks)
      setAnalysis(data)
    }
    setIsLoading(false)
  }, [activeProject])

  useEffect(() => { loadAnalysis() }, [loadAnalysis])

  // ── Guard states ──────────────────────────────────────────────────────────
  if (!isLoading && !activeProject) return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="material-symbols-outlined text-5xl text-[#374151]">folder_off</span>
      <p className="text-sm text-white">No project selected</p>
      <button onClick={() => router.push('/dashboard')} className="btn-primary text-sm">
        Go to Dashboard
      </button>
    </div>
  )

  if (!isLoading && error === 'no_tasks') return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl
                      border border-[#374151] bg-[#111827]">
        <span className="material-symbols-outlined text-3xl text-[#374151]">upload_file</span>
      </div>
      <div>
        <p className="text-base font-semibold text-white">No project data yet</p>
        <p className="mt-1.5 text-sm text-[#6B7280]">
          Upload a project schedule file to see intelligence insights,
          critical path analysis, and Monte Carlo forecasts.
        </p>
      </div>
      <button onClick={() => router.push('/upload')} className="btn-primary text-sm">
        <span className="material-symbols-outlined text-base">upload_file</span>
        Go to Upload Center
      </button>
    </div>
  )

  if (!isLoading && error && error !== 'no_tasks') return (
    <div className="p-4 lg:p-6">
      <div className="flex items-start gap-3 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 p-4">
        <span className="material-symbols-outlined text-base text-[#EF4444]">error</span>
        <div>
          <p className="text-sm font-semibold text-[#EF4444]">Could not load analysis</p>
          <p className="mt-1 text-xs text-[#9CA3AF]">{error}</p>
        </div>
      </div>
      <button onClick={loadAnalysis} className="btn-ghost mt-3 text-sm">
        <span className="material-symbols-outlined text-base">refresh</span>
        Try Again
      </button>
    </div>
  )

  const delay = analysis?.total_delay_days ?? 0

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-hidden">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col border-b border-[#1a2235] bg-[#0b0f19]">
        <div className="flex items-center justify-between px-4 py-3 lg:px-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white lg:text-xl">Intelligence</h1>
              {/* NEW — Phase 9: Project Health badge */}
              <HealthScoreBadge score={analysis?.health_score} isLoading={isLoading} />
            </div>
            <p className="text-xs text-[#4B5563]">{activeProject?.name}</p>
          </div>
          <button
            onClick={loadAnalysis}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs
                       text-[#6B7280] transition-colors hover:bg-[#111827] hover:text-white">
            <span className="material-symbols-outlined text-base">refresh</span>
            Refresh
          </button>
        </div>

        {/* NEW — Phase 20: Knowledge Graph summary strip */}
        {!isLoading && analysis?.knowledge_graph_summary && (
          <div className="flex items-center gap-3 border-t border-[#1a2235] bg-[#0d1424] px-4 py-1.5 text-[11px] text-[#6B7280] lg:px-6">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px] text-[#3B82F6]">hub</span>
              {analysis.knowledge_graph_summary.node_count} entities tracked
            </span>
            <span className="text-[#374151]">·</span>
            <span>{analysis.knowledge_graph_summary.relationship_count} relationships mapped</span>
          </div>
        )}
      </div>

      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 border-b border-[#1a2235] p-3
                      lg:grid-cols-4 lg:gap-3 lg:p-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-20 w-full rounded-md" />
            ))
          : analysis
          ? (
            <>
              <MetricCard
                numericValue={delay}
                prefix={delay > 0 ? '+' : ''}
                label="Days Late"
                colour={delay > 0 ? 'red' : 'green'}
                animDelay={0}
              />
              <MetricCard
                value={analysis.risk_level.toUpperCase()}
                label="Risk Level"
                colour={
                  analysis.risk_level === 'critical' ? 'red' :
                  analysis.risk_level === 'high'     ? 'orange' :
                  analysis.risk_level === 'medium'   ? 'amber' : 'green'
                }
                animDelay={100}
              />
              <MetricCard
                numericValue={Math.round(analysis.overall_confidence * 100)}
                suffix="%"
                label="AI Confidence"
                colour="purple"
                animDelay={200}
                showDashWhenZero={true}
              />
              <MetricCard
                value={analysis.mc_p80 ? `Day ${analysis.mc_p80}` : '—'}
                label="P80 Forecast"
                colour="cyan"
                animDelay={300}
              />
            </>
          )
          : null
        }
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <TabBar
        active={activeTab}
        onChange={setActiveTab}
        riskCount={analysis?.risks.length}
      />

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2
                            border-[#1F2937] border-t-[#3B82F6]" />
            <p className="text-sm text-[#6B7280]">Loading analysis...</p>
          </div>
        ) : analysis ? (
          <>
            {activeTab === 'critical_path' && (
              <CriticalPathTab analysis={analysis} />
            )}
            {activeTab === 'risk_register' && (
              <RiskRegisterTab risks={analysis.risks} />
            )}
            {activeTab === 'monte_carlo' && (
              <MonteCarloTab analysis={analysis} />
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}

// Wrap inside Suspense boundary to safeguard useSearchParams execution during Next build
export default function IntelligencePage() {
  return (
    <Suspense fallback={
      <div className="flex h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1F2937] border-t-[#3B82F6]" />
      </div>
    }>
      <IntelligenceContent />
    </Suspense>
  )
}