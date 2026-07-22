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
      <div className="mb-5"><h1 className="text-xl font-bold text-white lg:text-2xl">Report Builder</h1><p className="mt-0.5 text-sm text-[#6B7280]">Customise and download your project intelligence report</p></div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-4">
          <div className="card-panel p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Project</p>
            <div className="mt-2 flex items-center gap-2 rounded-md border border-[#374151] bg-[#0A0F1E] px-3 py-2.5"><span className="material-symbols-outlined text-base text-[#3B82F6]">folder_open</span><p className="text-sm text-white truncate">{activeProject.name}</p></div>
          </div>
          <div className="card-panel p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Sections to Include</p>
            <div className="flex flex-col gap-0.5">
              {sections.map(s => (
                <label key={s.id} className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-[#1F2937]">
                  <input type="checkbox" checked={s.checked} onChange={() => toggleSection(s.id)} className="mt-0.5 h-4 w-4 rounded accent-[#3B82F6]" />
                  <div><p className="text-sm font-medium text-white">{s.label}</p><p className="text-[11px] text-[#6B7280]">{s.description}</p></div>
                </label>
              ))}
            </div>
          </div>
          {scenarios.length > 0 && (
            <div className="card-panel p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Scenarios to Include</p>
              <div className="flex flex-col gap-2">
                {scenarios.slice(0,5).map(s => (
                  <label key={s.scenario_id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-[#1F2937]">
                    <input type="checkbox" checked={selectedScenarios.has(s.scenario_id)} onChange={() => toggleScenario(s.scenario_id)} className="h-4 w-4 accent-[#3B82F6]" />
                    <div className="flex-1 min-w-0"><p className="truncate text-xs font-medium text-white">{s.name}</p><p className="text-[11px] text-[#6B7280]">+{s.days_saved} days saved</p></div>
                    <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold', s.status==='approved'?'badge-green':s.status==='rejected'?'badge-grey':'badge-amber')}>{s.status||'draft'}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="card-panel p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Report Summary</p>
            <div className="flex flex-col gap-1.5 text-xs">
              {[['Sections selected',`${checkedCount} of ${sections.length}`],['Scenarios included',`${selectedScenarios.size} of ${scenarios.length}`],['Estimated pages',`~${estimatedPages}`],['AI narrative',checkedCount>0?'✓ Included':'—']].map(([l,v])=>(
                <div key={l} className="flex items-center justify-between"><span className="text-[#6B7280]">{l}</span><span className={cn('font-medium',v==='✓ Included'?'text-[#22C55E]':'text-white')}>{v}</span></div>
              ))}
            </div>
          </div>
          <button onClick={() => setShowPreview(v => !v)} className="btn-ghost w-full justify-center text-sm lg:hidden"><span className="material-symbols-outlined text-base">preview</span>{showPreview?'Hide Preview':'Preview Report'}</button>
          <button onClick={handleGenerate} disabled={isGenerating || checkedCount === 0} className="btn-primary w-full justify-center">
            {isGenerating ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Generating report...</>) : (<><span className="material-symbols-outlined text-base">download</span>Generate &amp; Download Report</>)}
          </button>
          {isGenerating && <div><ProgressBar value={60} colour="#3B82F6" className="mt-1" height={4} /><p className="mt-1.5 text-center text-xs text-[#6B7280]">Building AI narrative...</p></div>}
          {lastGenerated && <p className="text-center text-xs text-[#6B7280]">Last generated: {timeAgo(lastGenerated)}{reportId&&<>{' · '}<button onClick={()=>window.open(getReportDownloadUrl(reportId),'_blank')} className="text-[#3B82F6] hover:underline">Download again</button></>}</p>}
        </div>
        <div className={cn('hidden lg:block', showPreview && '!block')}>
          <div className="sticky top-4">
            <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF]">Preview</h3><span className="text-xs text-[#6B7280]">Updates as you select sections</span></div>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto rounded-lg border border-[#374151]">
              <div className="bg-white p-6 text-black">
                <div className="mb-4 border-b border-gray-200 pb-3"><div className="flex items-center gap-2 mb-1"><div className="flex h-5 w-5 items-center justify-center rounded bg-blue-600"><span className="text-[8px] font-bold text-white">PII</span></div><span className="text-xs text-gray-500">Project Intelligence Interface</span></div><h2 className="text-base font-bold">{activeProject.name}</h2><p className="text-[10px] text-gray-400">Generated: {new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})} · Confidential</p></div>
                {sections.filter(s=>s.checked).map(s => (
                  <div key={s.id} className="mb-4">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-black">{s.label}</p>
                    <div className="h-px bg-gray-200 mb-2" />
                    <div className="flex flex-col gap-1">{[80,90,60].map((w,i)=><div key={i} className="h-2 rounded bg-gray-100" style={{width:`${w}%`}} />)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-center gap-1.5">
              {Array.from({length:Math.min(estimatedPages,8)}).map((_,i)=><span key={i} className={cn('h-1.5 w-1.5 rounded-full',i===0?'bg-[#3B82F6]':'bg-[#374151]')} />)}
              <span className="ml-1 text-[10px] text-[#6B7280]">Page 1 of ~{estimatedPages}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
