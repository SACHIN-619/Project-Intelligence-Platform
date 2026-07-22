'use client'
import { useState, useEffect } from 'react'
import { useProjectContext } from '@/contexts/ProjectContext'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { generateReport, getReportDownloadUrl, listScenarios } from '@/lib/api'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn, timeAgo } from '@/lib/utils'
import type { ScenarioResult } from '@/types'

interface Section { id: string; label: string; description: string; checked: boolean }
const DEFAULT_SECTIONS: Section[] = [
  { id: 'executive_summary', label: 'Executive Summary', description: 'AI-written project narrative', checked: true },
  { id: 'project_health', label: 'Project Health KPIs', description: 'Delay days, risk level, confidence', checked: true },
  { id: 'risk_register', label: 'Risk Register', description: 'All detected risks with scores', checked: true },
  { id: 'recovery_scenarios', label: 'Recovery Scenarios', description: 'Simulated actions and outcomes', checked: true },
  { id: 'monte_carlo', label: 'Monte Carlo Forecast', description: 'P50 / P80 / P90 completion days', checked: true },
  { id: 'full_schedule', label: 'Full Task Schedule', description: 'All tasks with CPM values', checked: false },
  { id: 'audit_trail', label: 'Audit Trail', description: 'Who approved what and when', checked: true },
]

export default function ReportPage() {
  const router = useRouter()
  const { activeProject } = useProjectContext()
  const { showToast } = useToast()
  const [sections, setSections] = useState<Section[]>(DEFAULT_SECTIONS)
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([])
  const [selectedScenarios, setSelectedScenarios] = useState<Set<string>>(new Set())
  const [format, setFormat] = useState<'pdf'|'text'>('pdf')
  const [isGenerating, setIsGenerating] = useState(false)
  const [reportId, setReportId] = useState<string | null>(null)
  const [lastGenerated, setLastGenerated] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    if (!activeProject) return
    listScenarios(activeProject.id).then(({ data }) => {
      setScenarios(data || [])
      const approved = new Set((data || []).filter(s => s.status === 'approved').map(s => s.scenario_id))
      setSelectedScenarios(approved)
    })
  }, [activeProject])

  function toggleSection(id: string) { setSections(prev => prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s)) }
  function toggleScenario(id: string) { setSelectedScenarios(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  async function handleGenerate() {
    if (!activeProject) return
    setIsGenerating(true); setReportId(null)
    const { data, error } = await generateReport({ project_id: activeProject.id, include_monte_carlo: sections.find(s => s.id === 'monte_carlo')?.checked, include_evidence: sections.find(s => s.id === 'audit_trail')?.checked, scenario_ids: Array.from(selectedScenarios) })
    setIsGenerating(false)
    if (error || !data) { showToast('error', error || 'Report generation failed.'); return }
    setReportId(data.report_id); setLastGenerated(data.generated_at)
    showToast('success', 'Report generated — ready to download')
    window.open(getReportDownloadUrl(data.report_id), '_blank')
  }

  const checkedCount = sections.filter(s => s.checked).length
  const estimatedPages = checkedCount + Math.ceil(selectedScenarios.size * 0.5)

  if (!activeProject) return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="material-symbols-outlined text-4xl text-[#374151]">folder_off</span>
      <p className="text-sm text-white">No project selected</p>
      <button onClick={() => router.push('/dashboard')} className="btn-primary text-sm">Go to Dashboard</button>
    </div>
  )

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-5"><h1 className="text-xl font-bold text-white lg:text-2xl">Report Builder</h1><p className="mt-0.5 text-sm text-[#9CA3AF]">Customise and download your project intelligence report</p></div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-4">
          <div className="card-panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Project</p>
            <div className="mt-2 flex items-center gap-2 rounded-md border border-[#374151] bg-[#0A0F1E] px-3 py-2.5"><span className="material-symbols-outlined text-base text-[#3B82F6]">folder_open</span><p className="text-sm text-white truncate">{activeProject.name}</p></div>
          </div>
          <div className="card-panel p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Sections to Include</p>
            <div className="flex flex-col gap-0.5">
              {sections.map(s => (
                <label key={s.id} className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-[#1F2937]">
                  <input type="checkbox" checked={s.checked} onChange={() => toggleSection(s.id)} className="mt-0.5 h-4 w-4 rounded accent-[#3B82F6]" />
                  <div><p className="text-sm font-medium text-white">{s.label}</p><p className="text-xs text-[#9CA3AF]">{s.description}</p></div>
                </label>
              ))}
            </div>
          </div>
          {scenarios.length > 0 && (
            <div className="card-panel p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Scenarios to Include</p>
              <div className="flex flex-col gap-2">
                {scenarios.slice(0,5).map(s => (
                  <label key={s.scenario_id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-[#1F2937]">
                    <input type="checkbox" checked={selectedScenarios.has(s.scenario_id)} onChange={() => toggleScenario(s.scenario_id)} className="h-4 w-4 accent-[#3B82F6]" />
                    <div className="flex-1 min-w-0"><p className="truncate text-xs font-medium text-white">{s.name}</p><p className="text-xs text-[#9CA3AF]">+{s.days_saved} days saved</p></div>
                    <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold', s.status==='approved'?'badge-green':s.status==='rejected'?'badge-grey':'badge-amber')}>{s.status||'draft'}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="card-panel p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Report Summary</p>
            <div className="flex flex-col gap-1.5 text-xs">
              {[['Sections selected',`${checkedCount} of ${sections.length}`],['Scenarios included',`${selectedScenarios.size} of ${scenarios.length}`],['Estimated pages',`~${estimatedPages}`],['AI narrative',checkedCount>0?'✓ Included':'—']].map(([l,v])=>(
                <div key={l} className="flex items-center justify-between"><span className="text-[#9CA3AF]">{l}</span><span className={cn('font-medium',v==='✓ Included'?'text-[#22C55E]':'text-white')}>{v}</span></div>
              ))}
            </div>
          </div>
          <button onClick={() => setShowPreview(v => !v)} className="btn-ghost w-full justify-center text-sm lg:hidden"><span className="material-symbols-outlined text-base">preview</span>{showPreview?'Hide Preview':'Preview Report'}</button>
          <button onClick={handleGenerate} disabled={isGenerating || checkedCount === 0} className="btn-primary w-full justify-center">
            {isGenerating ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Generating report...</>) : (<><span className="material-symbols-outlined text-base">download</span>Generate &amp; Download Report</>)}
          </button>
          {isGenerating && <div><ProgressBar value={60} colour="#3B82F6" className="mt-1" height={4} /><p className="mt-1.5 text-center text-xs text-[#9CA3AF]">Building AI narrative...</p></div>}
          {lastGenerated && <p className="text-center text-xs text-[#9CA3AF]">Last generated: {timeAgo(lastGenerated)}{reportId&&<>{' · '}<button onClick={()=>window.open(getReportDownloadUrl(reportId),'_blank')} className="text-[#3B82F6] hover:underline">Download again</button></>}</p>}
        </div>
        <div className={cn('hidden lg:block', showPreview && '!block')}>
          <div className="sticky top-4">
            <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF]">Preview</h3><span className="text-xs text-[#9CA3AF]">Updates as you select sections</span></div>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto rounded-lg border border-[#1F2937]">
              <div className="bg-[#0C1322] p-5 text-slate-300">
                <div className="mb-4 border-b border-[#1F2937] pb-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-[#3B82F6]">
                      <span className="text-[8px] font-black text-white">PII</span>
                    </div>
                    <span className="text-xs text-slate-500">Project Intelligence Interface</span>
                  </div>
                  <h2 className="text-sm font-bold text-white">{activeProject.name}</h2>
                  <p className="text-xs text-slate-500">Generated: {new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})} · Confidential</p>
                </div>
                {sections.filter(s=>s.checked).map(s => {
                  const previewText: Record<string, string> = {
                    executive_summary: "High-level overview of project health, timeline deviations, critical risks, and recovery decisions compiled by Bright AI.",
                    project_health: "Composite Health Index: 88/100 · Schedule: Healthy · Risk: Medium · Procurement: Active",
                    risk_register: "Active Risks: 34 · Weather alerts (2) · Critical path delays (4) · Vendor delivery slippage (1)",
                    recovery_scenarios: "Simulated Options: 3 approved scenarios synced to Kanban board · Recovered time estimate: 6 days",
                    monte_carlo: "PERT Probability milestone: P50 (24 Aug) · P80 (29 Aug) · P90 (03 Sep) forecast targets",
                    full_schedule: "Critical Path: 18 tasks identified · Free float margins calculated per CPM scheduler",
                    audit_trail: "Immutable decision records: 12 PM approvals logged in audit_events history database"
                  }
                  return (
                    <div key={s.id} className="mb-4">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-sky-400">{s.label}</p>
                      <div className="h-px bg-[#1F2937] mb-2" />
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {previewText[s.id] || "Section content summary preview..."}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-center gap-1.5">
              {Array.from({length:Math.min(estimatedPages,8)}).map((_,i)=><span key={i} className={cn('h-1.5 w-1.5 rounded-full',i===0?'bg-[#3B82F6]':'bg-[#374151]')} />)}
              <span className="ml-1 text-xs text-[#9CA3AF]">Page 1 of ~{estimatedPages}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
