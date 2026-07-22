// app/(dashboard)/health/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useToast } from '@/components/ui/Toast'
import { getSystemHealth } from '@/lib/api'
import { cn, timeAgo } from '@/lib/utils'
import type { SystemHealth, ComponentHealth } from '@/types'

// FIXED — Names match exactly what backend /admin/health now returns;
// 'file_storage' removed since it's not a component the backend checks.
const COMPONENT_ICONS: Record<string, string> = {
  database:     'storage',
  pgvector:     'hub',
  redis:        'cached',
  gemini_ai:    'auto_awesome',
  embeddings:   'psychology',
}

const COMPONENT_LABELS: Record<string, string> = {
  database:     'PostgreSQL',
  pgvector:     'pgvector (RAG)',
  redis:        'Redis Queue',
  gemini_ai:    'Gemini AI',
  embeddings:   'BGE Embeddings',
}

const API_TIMES = [
  { endpoint: 'Upload commit',       ms: 210,  threshold: 1000 },
  { endpoint: 'Analysis CPM',        ms: 1200, threshold: 2000 },
  { endpoint: 'Run simulation',      ms: 890,  threshold: 2000 },
  { endpoint: 'RAG query',           ms: 2100, threshold: 3000 },
  { endpoint: 'Report generate',     ms: 4300, threshold: 6000 },
]

function timeColour(ms: number, threshold: number): string {
  if (ms < threshold * 0.5) return '#22C55E'
  if (ms < threshold)       return '#EAB308'
  return '#EF4444'
}

function ComponentCard({ comp }: { comp: ComponentHealth }) {
  const [expanded, setExpanded] = useState(false)

  // FIXED — Added missing '#' on the degraded color string which broke inline properties
  const colour =
    comp.status === 'ok'       ? '#22C55E' :
    comp.status === 'degraded' ? '#F97316' : '#EF4444'

  const statusLabel =
    comp.status === 'ok'       ? 'HEALTHY' :
    comp.status === 'degraded' ? 'DEGRADED' : 'DOWN'

  const dotColour =
    comp.status === 'ok'       ? 'status-dot-green' :
    comp.status === 'degraded' ? 'status-dot-orange' : 'status-dot-red'

  return (
    <div
      className="card-panel overflow-hidden transition-all duration-200"
      style={{ borderTop: `3px solid ${colour}` }}
    >
      <div
        className="flex cursor-pointer items-start justify-between p-4"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start gap-3">
          {/* Icon with colour glow */}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${colour}15` }}
          >
            <span
              className="material-symbols-outlined text-xl"
              style={{
                color: colour,
                fontVariationSettings: "'FILL' 1",
              }}
            >
              {COMPONENT_ICONS[comp.name] || 'settings'}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={cn('block', dotColour)} />
              <p className="text-sm font-bold" style={{ color: colour }}>
                {statusLabel}
              </p>
            </div>
            <p className="mt-0.5 text-xs font-medium text-[#9CA3AF]">
              {COMPONENT_LABELS[comp.name] || comp.name.replace(/_/g, ' ')}
            </p>
          </div>
        </div>

        <span
          className="material-symbols-outlined text-base text-[#4B5563] transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}
        >
          keyboard_arrow_down
        </span>
      </div>

      {expanded && (
        <div className="border-t border-[#1a2235] bg-[#0d1424] px-4 py-3">
          <p className="text-xs leading-relaxed text-[#9CA3AF]">{comp.detail}</p>
          {comp.status === 'degraded' && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-[#F97316]">
              <span className="material-symbols-outlined text-sm">warning</span>
              System running in degraded fallback mode
            </div>
          )}
          <button className="mt-2 text-xs text-[#3B82F6] hover:underline">
            View Logs →
          </button>
        </div>
      )}
    </div>
  )
}

export default function SystemHealthPage() {
  const { showToast } = useToast()
  const [health, setHealth]           = useState<SystemHealth | null>(null)
  const [isLoading, setIsLoading]     = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastChecked, setLastChecked] = useState<string | null>(null)

  const loadHealth = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true)
    else setIsLoading(true)

    const { data, error } = await getSystemHealth()
    if (error) showToast('error', error)
    else if (data) { setHealth(data); setLastChecked(data.checked_at) }

    setIsLoading(false)
    setIsRefreshing(false)
  }, [showToast])

  useEffect(() => {
    loadHealth()
    const interval = setInterval(() => loadHealth(), 30000)
    return () => clearInterval(interval)
  }, [loadHealth])

  const healthyCount  = health?.components.filter(c => c.status === 'ok').length ?? 0
  const degradedCount = health?.components.filter(c => c.status === 'degraded').length ?? 0
  const downCount     = health?.components.filter(c => c.status === 'down').length ?? 0
  const total         = health?.components.length ?? 0

  const overallColour =
    health?.overall === 'ok'       ? '#22C55E' :
    health?.overall === 'degraded' ? '#F97316' : '#EF4444'

  const overallBg =
    health?.overall === 'ok'       ? 'border-[#22C55E] bg-[#22C55E]/8' :
    health?.overall === 'degraded' ? 'border-[#F97316] bg-[#F97316]/8' :
                                     'border-[#EF4444] bg-[#EF4444]/8'

  const overallText =
    health?.overall === 'ok'       ? 'ALL SYSTEMS OPERATIONAL' :
    health?.overall === 'degraded' ? 'PARTIAL DEGRADATION' : 'SYSTEM DOWN'

  return (
    <div className="p-4 lg:p-6">

      {/* Header */}
      <div className="mb-5 flex items-center justify-between border-b border-[#1a2235] pb-4">
        <div>
          <h1 className="text-xl font-bold text-white lg:text-2xl">System Health</h1>
          <p className="mt-0.5 text-sm text-[#6B7280]">
            Real-time component status
            {lastChecked && ` · Last checked ${timeAgo(lastChecked)}`}
          </p>
        </div>
        <button
          onClick={() => loadHealth(true)}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs
                     text-[#6B7280] transition-colors hover:bg-[#111827] hover:text-white
                     disabled:opacity-50"
        >
          <span className={cn('material-symbols-outlined text-base', isRefreshing && 'animate-spin')}>
            refresh
          </span>
          {isRefreshing ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="skeleton h-20 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Overall status banner */}
          {health && (
            <div className={cn(
              'mb-5 flex items-center gap-4 rounded-xl border p-5',
              overallBg
            )}>
              {/* Animated status dot */}
              <div className="relative flex h-4 w-4 items-center justify-center">
                <span
                  className={cn(
                    'absolute inline-flex h-full w-full rounded-full opacity-60',
                    health.overall === 'ok' ? 'animate-ping bg-[#22C55E]' :
                    health.overall === 'degraded' ? 'animate-ping bg-[#F97316]' :
                    'bg-[#EF4444]'
                  )}
                />
                <span
                  className="relative inline-flex h-3 w-3 rounded-full"
                  style={{ background: overallColour }}
                />
              </div>
              <div>
                <p className="text-base font-bold" style={{ color: overallColour }}>
                  {overallText}
                </p>
                <p className="mt-0.5 text-xs text-[#9CA3AF]">
                  {healthyCount} healthy
                  {degradedCount > 0 && ` · ${degradedCount} degraded`}
                  {downCount > 0 && ` · ${downCount} down`}
                  {' '} of {total} components
                  {health.overall === 'degraded' && (
                    <span className="ml-2 text-[#F97316]">
                      · AI falling back to Groq
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Component grid */}
          {health && (
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {health.components.map(comp => (
                <ComponentCard key={comp.name} comp={comp} />
              ))}
            </div>
          )}

          {/* Performance + Jobs */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

            {/* API response times */}
            <div className="card-panel p-5">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                API Response Times
              </p>
              <div className="flex flex-col gap-3">
                {API_TIMES.map(({ endpoint, ms, threshold }) => {
                  const colour = timeColour(ms, threshold)
                  const pct    = Math.min(100, (ms / threshold) * 100)
                  return (
                    <div key={endpoint}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-[#9CA3AF]">{endpoint}</span>
                        <span className="font-mono font-semibold" style={{ color: colour }}>
                          {ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1F2937]">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: colour }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Background jobs */}
            <div className="card-panel p-5">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                Background Jobs (ARQ)
              </p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Queued',    value: 0,  colour: '#9CA3AF', icon: 'hourglass_empty' },
                  { label: 'Running',   value: 0,  colour: '#3B82F6', icon: 'sync' },
                  { label: 'Completed', value: 12, colour: '#22C55E', icon: 'check_circle' },
                  { label: 'Failed',    value: 0,  colour: '#EF4444', icon: 'error' },
                ].map(({ label, value, colour, icon }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-lg bg-[#0A0F1E] p-3"
                  >
                    <span
                      className="material-symbols-outlined text-xl"
                      style={{ color: colour, fontVariationSettings: "'FILL' 1" }}
                    >
                      {icon}
                    </span>
                    <div>
                      <p className="text-xl font-bold" style={{ color: colour }}>{value}</p>
                      <p className="text-[10px] uppercase tracking-wider text-[#6B7280]">{label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Last job */}
              <div className="mt-4 flex items-center gap-3 rounded-lg border
                              border-[#1F2937] bg-[#0A0F1E] px-3 py-3">
                <span className="status-dot-green" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white">job_run_analysis</p>
                  <p className="text-[10px] text-[#6B7280]">Completed 3 min ago · 20 tasks</p>
                </div>
                <span
                  className="material-symbols-outlined text-sm text-[#22C55E]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
              </div>

              {/* ARQ worker hint */}
              <div className="mt-3 rounded-lg border border-[#374151] bg-[#0A0F1E] p-3">
                <p className="text-[11px] font-medium text-[#9CA3AF]">Start ARQ worker:</p>
                <code className="mt-1 block text-[11px] text-[#3B82F6]">
                  arq app.services.queue.jobs.WorkerSettings
                </code>
              </div>
            </div>
          </div>

          {/* AI Layer status */}
          <div className="mt-4 card-panel p-5">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              AI Provider Chain
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { layer: 'Layer 1', name: 'Google Gemini Flash', status: 'primary',  icon: 'auto_awesome', colour: '#3B82F6', desc: 'Best quality · 60 req/min free' },
                { layer: 'Layer 2', name: 'Groq LLaMA-3.3-70B', status: 'fallback', icon: 'swap_horiz',   colour: '#14B8A6', desc: 'Fallback · Very fast · Free tier' },
                { layer: 'Layer 3', name: 'Graceful Degrade',    status: 'safety',   icon: 'shield',       colour: '#22C55E', desc: 'Zero crashes · Partial data returned' },
              ].map(({ layer, name, status, icon, colour, desc }) => (
                <div
                  key={layer}
                  className="flex items-start gap-3 rounded-xl border border-[#1F2937]
                             bg-[#0A0F1E] p-4"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${colour}15` }}
                  >
                    <span
                      className="material-symbols-outlined text-lg"
                      style={{ color: colour, fontVariationSettings: "'FILL' 1" }}
                    >
                      {icon}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider"
                       style={{ color: colour }}>
                      {layer} · {status}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-white">{name}</p>
                    <p className="mt-0.5 text-[10px] text-[#6B7280]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}