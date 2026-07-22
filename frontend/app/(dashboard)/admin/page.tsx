// admin/page.tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useProjectContext } from '@/contexts/ProjectContext'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { getMetrics, getAuditTrail, getSchemaMemory, toggleFeatureFlag, getFeatureFlags, getVendorScores } from '@/lib/api'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn, timeAgo } from '@/lib/utils'
import { isAdmin } from '@/lib/auth'
import type { BusinessMetrics, AuditRow, VendorScore } from '@/types'

type AdminTab = 'impact' | 'vendors' | 'audit' | 'schema' | 'flags'
const FLAGS = [
  { id: 'rag', label: 'RAG / AI Search', desc: 'Enable document Q&A with source citations' },
  { id: 'monte_carlo', label: 'Monte Carlo Simulation', desc: '1,000-run probabilistic forecast' },
  { id: 'pdf_export', label: 'PDF Export', desc: 'Generate downloadable PDF reports' },
  { id: 'weather_agent', label: 'Weather Agent', desc: 'Open-Meteo weather risk factor' },
  { id: 'vendor_scoring', label: 'Vendor Reliability Scoring', desc: 'Cross-project vendor history adjusts risk scores' },
  { id: 'ai_memory', label: 'AI Memory', desc: 'Learn from approved/rejected decisions over time' },
]
const COMPARISON = [
  { task: 'Risk identification', manual: '4.0 hrs', ai: '8 min', saved: 97 },
  { task: 'Schedule analysis', manual: '3.0 hrs', ai: '3 min', saved: 98 },
  { task: 'Document search', manual: '2.0 hrs', ai: '12 sec', saved: 99 },
  { task: 'Report generation', manual: '1.5 hrs', ai: '45 sec', saved: 99 },
  { task: 'Scenario modelling', manual: '3.0 hrs', ai: '30 sec', saved: 99 },
]

const VENDOR_RISK_COLOUR: Record<string, string> = {
  low: '#22C55E', medium: '#EAB308', high: '#F97316', critical: '#EF4444',
}

function Toggle({ isOn, onToggle, disabled }: { isOn: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button onClick={!disabled ? onToggle : undefined} disabled={disabled} className={cn('toggle-track shrink-0', isOn ? 'on' : 'off', disabled && 'cursor-not-allowed opacity-50')}>
      <span className="toggle-thumb" />
    </button>
  )
}

export default function AdminPage() {
  const { activeProject } = useProjectContext()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<AdminTab>('impact')
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null)
  const [auditRows, setAuditRows] = useState<AuditRow[]>([])
  const [schemaRows, setSchemaRows] = useState<any[]>([])
  const [vendorScores, setVendorScores] = useState<VendorScore[]>([])
  const [flagStates, setFlagStates] = useState({
    rag: true, monte_carlo: true, pdf_export: true,
    weather_agent: false, vendor_scoring: true, ai_memory: true,
  })
  const [isLoading, setIsLoading] = useState(true)
  const userIsAdmin = user ? isAdmin(user.role) : false

  const loadData = useCallback(async () => {
    if (!activeProject) { setIsLoading(false); return }
    setIsLoading(true)
    const [mRes, aRes, sRes, vRes, fRes] = await Promise.all([
      getMetrics(activeProject.id),
      getAuditTrail(activeProject.id, 20),
      getSchemaMemory(),
      getVendorScores(),
      getFeatureFlags(),
    ])
    if (mRes.data) setMetrics(mRes.data)
    if (aRes.data) setAuditRows(aRes.data)
    if (sRes.data) setSchemaRows(sRes.data)
    if (vRes.data) setVendorScores(vRes.data.vendors)
    if (fRes.data) setFlagStates(fRes.data)
    setIsLoading(false)
  }, [activeProject])

  useEffect(() => { loadData() }, [loadData])

  async function handleToggle(flagId: string) {
    const newState = !flagStates[flagId as keyof typeof flagStates]
    setFlagStates(prev => ({ ...prev, [flagId]: newState }))
    const { error } = await toggleFeatureFlag(flagId, newState)
    if (error) { showToast('error', error); setFlagStates(prev => ({ ...prev, [flagId]: !newState })); return }
    showToast('success', `${flagId.replace('_', ' ')} ${newState ? 'enabled' : 'disabled'}`)
  }

  function auditIcon(t: string) {
    if (t.includes('approv')) return { icon: 'check_circle', colour: '#22C55E' }
    if (t.includes('reject')) return { icon: 'cancel', colour: '#EF4444' }
    if (t.includes('upload')) return { icon: 'upload', colour: '#3B82F6' }
    if (t.includes('analys')) return { icon: 'auto_awesome', colour: '#14B8A6' }
    return { icon: 'info', colour: '#9CA3AF' }
  }

  const TABS = [
    { id: 'impact' as AdminTab, label: 'Impact', icon: 'insights' },
    { id: 'vendors' as AdminTab, label: 'Vendors', icon: 'storefront' },
    { id: 'audit' as AdminTab, label: 'Audit', icon: 'history' },
    { id: 'schema' as AdminTab, label: 'Schema', icon: 'schema' },
    { id: 'flags' as AdminTab, label: 'Flags', icon: 'toggle_on' },
  ]

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-white lg:text-2xl">Admin &amp; Analytics</h1><p className="mt-0.5 text-sm text-[#6B7280]">Measure value · manage team · configure system</p></div>
        <button onClick={loadData} className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-white"><span className="material-symbols-outlined text-base">refresh</span>Refresh</button>
      </div>
      <div className="mb-5 flex border-b border-[#1F2937]">
        {TABS.map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors', activeTab === t.id ? 'tab-active' : 'tab-inactive')}><span className="material-symbols-outlined text-base">{t.icon}</span><span className="hidden sm:inline">{t.label}</span></button>)}
      </div>

      {activeTab === 'impact' && (
        <div className="space-y-5">
          {isLoading ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{Array.from({length:12}).map((_,i)=><div key={i} className="skeleton h-20 rounded-md"/>)}</div> : (
            <>
              {[
                { title: 'Time Saved', cards: [{ v: metrics ? `${metrics.hours_saved_estimate.toFixed(1)}` : '—', l: 'Hours Saved', c: '#22C55E' }, { v: metrics ? `${metrics.ai_hours_actual.toFixed(1)}` : '—', l: 'Hours Actual (AI)', c: '#3B82F6' }, { v: metrics ? `${Math.round((1 - metrics.ai_hours_actual / Math.max(metrics.manual_hours_baseline, 1)) * 100)}%` : '—', l: 'Time Reduction', c: '#14B8A6' }] },
                { title: 'Intelligence', cards: [{ v: metrics?.tasks_analysed ?? '—', l: 'Tasks Analysed', c: '#3B82F6' }, { v: metrics?.documents_indexed ?? '—', l: 'Chunks Indexed', c: '#A855F7' }, { v: metrics ? `${Math.round(metrics.avg_confidence * 100)}%` : '—', l: 'Avg Confidence', c: '#A855F7' }] },
                { title: 'Risk & Recovery', cards: [{ v: metrics?.risks_detected ?? '—', l: 'Risks Detected', c: '#EF4444' }, { v: metrics ? `${Math.round(metrics.scenarios_approved_pct)}%` : '—', l: 'Approval Rate', c: '#22C55E' }, { v: metrics?.actions_completed ?? '—', l: 'Actions Done', c: '#22C55E' }] },
                { title: 'AI Memory & Learning', cards: [{ v: metrics?.ai_memory_events ?? '—', l: 'Memory Events', c: '#14B8A6' }, { v: metrics ? `${Math.round(metrics.ai_prediction_accuracy)}%` : '—', l: 'Prediction Accuracy', c: '#14B8A6' }, { v: metrics?.documents_indexed ?? '—', l: 'Chunks Indexed', c: '#A855F7' }] },
              ].map(row => (
                <div key={row.title}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">{row.title}</p>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                    {row.cards.map(card => (
                      <div key={card.l} className="card-panel p-3 text-center" style={{ borderTop: `2px solid ${card.c}` }}>
                        <p className="text-2xl font-extrabold lg:text-3xl" style={{ color: card.c }}>{String(card.v)}</p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">{card.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="card-panel overflow-hidden">
                <div className="bg-[#1F2937] px-4 py-2.5"><p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Manual vs AI — Time Comparison</p></div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-xs">
                    <thead><tr className="border-b border-[#1F2937]"><th className="px-4 py-2.5 text-left text-[#9CA3AF]">Task</th><th className="px-4 py-2.5 text-center text-[#9CA3AF]">Manual</th><th className="px-4 py-2.5 text-center text-[#9CA3AF]">AI</th><th className="px-4 py-2.5 text-right text-[#9CA3AF]">Saved</th></tr></thead>
                    <tbody>
                      {COMPARISON.map((r, i) => <tr key={r.task} className={cn('border-b border-[#1F2937]', i % 2 === 1 && 'bg-[#1F2937]/30')}><td className="px-4 py-2.5 text-[#dce2f7]">{r.task}</td><td className="px-4 py-2.5 text-center text-[#9CA3AF]">{r.manual}</td><td className="px-4 py-2.5 text-center font-medium text-[#22C55E]">{r.ai}</td><td className="px-4 py-2.5 text-right font-bold text-[#22C55E]">{r.saved}% ✓</td></tr>)}
                      <tr className="border-t-2 border-[#374151] bg-[#1F2937]"><td className="px-4 py-2.5 font-bold text-white">TOTAL</td><td className="px-4 py-2.5 text-center font-bold text-white">13.5 hrs</td><td className="px-4 py-2.5 text-center font-bold text-[#22C55E]">~22 min</td><td className="px-4 py-2.5 text-right font-extrabold text-[#22C55E]">97% ✓</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'vendors' && (
        <div>
          <div className="mb-4 flex items-start gap-2 rounded-md border border-[#3B82F6]/30 bg-[#3B82F6]/10 p-3">
            <span className="material-symbols-outlined text-base text-[#3B82F6]">info</span>
            <p className="text-sm text-[#9CA3AF]">
              Reliability scores are computed across <strong className="text-white">every project</strong> in
              your organisation — not just this one. Vendors below 40% reliability automatically receive
              a risk score penalty on future tasks.
            </p>
          </div>
          {isLoading ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-14 w-full rounded-md" />)}</div>
          ) : vendorScores.length === 0 ? (
            <div className="card-panel flex flex-col items-center gap-2 py-12 text-center">
              <span className="material-symbols-outlined text-3xl text-[#374151]">storefront</span>
              <p className="text-sm text-[#9CA3AF]">No vendor delivery history yet</p>
            </div>
          ) : (
            <div className="card-panel overflow-hidden">
              <div className="bg-[#1F2937] px-4 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                  Vendor Reliability · {vendorScores.length} vendor{vendorScores.length !== 1 ? 's' : ''} tracked
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-xs">
                  <thead>
                    <tr className="border-b border-[#1F2937]">
                      <th className="px-4 py-2.5 text-left text-[#9CA3AF]">Vendor</th>
                      <th className="px-4 py-2.5 text-center text-[#9CA3AF]">On-Time %</th>
                      <th className="px-4 py-2.5 text-center text-[#9CA3AF]">Avg Delay</th>
                      <th className="px-4 py-2.5 text-center text-[#9CA3AF]">Tasks</th>
                      <th className="px-4 py-2.5 text-right text-[#9CA3AF]">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorScores.map((v, i) => {
                      const colour = VENDOR_RISK_COLOUR[v.risk_level] || '#9CA3AF'
                      return (
                        <tr key={v.vendor_name} className={cn('border-b border-[#1F2937]', i % 2 === 1 && 'bg-[#1F2937]/30')}>
                          <td className="px-4 py-2.5 font-medium text-[#dce2f7]">{v.vendor_name}</td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#1F2937]">
                                <div className="h-full rounded-full" style={{ width: `${v.reliability_score}%`, background: colour }} />
                              </div>
                              <span style={{ color: colour }}>{v.reliability_score.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center text-[#9CA3AF]">{v.avg_delay_days.toFixed(1)}d</td>
                          <td className="px-4 py-2.5 text-center text-[#6B7280]">{v.on_time}/{v.total_tasks}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: `${colour}20`, color: colour }}>
                              {v.risk_level}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div>
          {isLoading ? <div className="flex flex-col gap-2">{Array.from({length:6}).map((_,i)=><div key={i} className="skeleton h-14 w-full rounded-md"/>)}</div>
          : auditRows.length === 0 ? <div className="card-panel flex flex-col items-center gap-2 py-12 text-center"><span className="material-symbols-outlined text-3xl text-[#374151]">history</span><p className="text-sm text-[#9CA3AF]">No audit events yet</p></div>
          : <div className="card-panel overflow-hidden">{auditRows.map((row, i) => { const { icon, colour } = auditIcon(row.event_type); return (<div key={row.id || i} className="flex items-center gap-3 border-b border-[#1F2937] px-4 py-3 last:border-0 hover:bg-[#1F2937]"><span className="material-symbols-outlined shrink-0 text-base" style={{ color: colour }}>{icon}</span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-white">{row.event_type.replace(/_/g, ' ')}</p>{row.entity_type && <p className="text-[10px] text-[#6B7280]">{row.entity_type}</p>}</div><p className="shrink-0 text-[10px] text-[#6B7280]">{timeAgo(row.created_at)}</p></div>) })}</div>}
        </div>
      )}

      {activeTab === 'schema' && (
        <div>
          {isLoading ? <div className="skeleton h-64 w-full rounded-md"/> : schemaRows.length === 0
            ? <div className="card-panel flex flex-col items-center gap-2 py-12 text-center"><span className="material-symbols-outlined text-3xl text-[#374151]">schema</span><p className="text-sm text-[#9CA3AF]">No schema mappings learned yet</p></div>
            : <div className="card-panel overflow-hidden"><div className="bg-[#1F2937] px-4 py-2.5"><p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Learned Column Mappings · {schemaRows.length} entries</p></div><div className="overflow-x-auto"><table className="w-full min-w-[480px] text-xs"><thead><tr className="border-b border-[#1F2937]">{['Source Column','Detected As','Method','Confidence','Used'].map(h=><th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-[#9CA3AF]">{h}</th>)}</tr></thead><tbody>{schemaRows.map((row, i) => { const mc = row.mapping_method==='exact'?'#22C55E':row.mapping_method==='fuzzy'?'#3B82F6':'#A855F7'; return (<tr key={i} className="border-b border-[#1F2937] last:border-0 hover:bg-[#1F2937]"><td className="px-4 py-2.5 font-mono text-[#dce2f7]">{row.source_column}</td><td className="px-4 py-2.5 text-[#3B82F6]">{row.canonical_column}</td><td className="px-4 py-2.5"><span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{background:`${mc}30`,color:mc}}>{row.mapping_method}</span></td><td className="px-4 py-2.5"><div className="flex items-center gap-2"><ProgressBar value={row.confidence*100} colour={mc} className="w-16" height={4}/><span className="text-[#9CA3AF]">{Math.round(row.confidence*100)}%</span></div></td><td className="px-4 py-2.5 text-[#6B7280]">{row.usage_count}×</td></tr>) })}</tbody></table></div></div>
          }
        </div>
      )}

      {activeTab === 'flags' && (
        <div>
          {!userIsAdmin && <div className="mb-4 flex items-center gap-2 rounded-md border border-[#EAB308]/30 bg-[#EAB308]/10 p-3"><span className="material-symbols-outlined text-base text-[#EAB308]">info</span><p className="text-sm text-[#EAB308]">Feature flags can only be toggled by system admins.</p></div>}
          <div className="card-panel divide-y divide-[#1F2937]">
            {FLAGS.map(flag => (
              <div key={flag.id} className="flex items-center justify-between px-4 py-4">
                <div className="min-w-0 flex-1 pr-4"><p className="text-sm font-semibold text-white">{flag.label}</p><p className="mt-0.5 text-xs text-[#9CA3AF]">{flag.desc}</p></div>
                <div className="flex shrink-0 items-center gap-3"><span className={cn('text-xs font-medium', flagStates[flag.id as keyof typeof flagStates] ? 'text-[#22C55E]' : 'text-[#6B7280]')}>{flagStates[flag.id as keyof typeof flagStates] ? 'ON' : 'OFF'}</span><Toggle isOn={flagStates[flag.id as keyof typeof flagStates]} onToggle={() => handleToggle(flag.id)} disabled={!userIsAdmin} /></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}