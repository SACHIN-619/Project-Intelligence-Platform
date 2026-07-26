'use client'
import { useState, useEffect } from 'react'
import { useProjectContext } from '@/contexts/ProjectContext'
import { useRouter } from 'next/navigation'
import { checkCompliance } from '@/lib/api'
import type { ComplianceData } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function CompliancePage() {
  const router = useRouter()
  const { activeProject } = useProjectContext()
  const [data, setData] = useState<ComplianceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCompliance = async (projId: string) => {
    setLoading(true)
    setError(null)
    const { data: res, error: err } = await checkCompliance(projId)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      setData(res)
    }
  }

  useEffect(() => {
    if (activeProject) {
      fetchCompliance(activeProject.id)
    }
  }, [activeProject])

  if (!activeProject) return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="material-symbols-outlined text-4xl text-[#374151]">folder_off</span>
      <h2 className="text-base font-semibold text-white">No project selected</h2>
      <button onClick={() => router.push('/dashboard')} className="btn-primary mt-2">Go to Dashboard</button>
    </div>
  )

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white lg:text-2xl">Compliance &amp; Quality Audit</h1>
          <p className="mt-0.5 text-xs text-[#9CA3AF]">
            Continuous Uptime Tier III and TIA-942 spec alignment checker
          </p>
        </div>
        <button
          onClick={() => fetchCompliance(activeProject.id)}
          disabled={loading}
          className="btn-ghost flex items-center gap-1.5 text-xs px-3 py-1.5"
        >
          <span className={cn("material-symbols-outlined text-sm", loading && "animate-spin")}>
            refresh
          </span>
          Re-Audit
        </button>
      </div>

      {loading ? (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1F2937] border-t-[#3B82F6]" />
          <p className="text-xs text-[#9CA3AF]">Executing deterministic TIA-942 ruleset...</p>
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-4 text-center text-xs text-red-400">
          <p>Failed to load compliance audit: {error}</p>
          <button onClick={() => fetchCompliance(activeProject.id)} className="text-[#3B82F6] hover:underline mt-2">Try again</button>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card-panel p-4 flex flex-col justify-between min-h-[110px]">
              <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Overall compliance</span>
              <div className="mt-2 flex items-center gap-2">
                {data.compliant ? (
                  <>
                    <span className="material-symbols-outlined text-emerald-500 text-3xl">check_circle</span>
                    <span className="text-lg font-black text-white">Compliant</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-rose-500 text-3xl">warning</span>
                    <span className="text-lg font-black text-white">NCRs Detected</span>
                  </>
                )}
              </div>
              <span className="text-[10px] text-[#9CA3AF] mt-2 block truncate">
                {data.summary}
              </span>
            </div>

            <div className="card-panel p-4 flex flex-col justify-between min-h-[110px]">
              <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Compliance score</span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-white">{data.compliance_score}</span>
                <span className="text-xs text-[#9CA3AF]">/100</span>
              </div>
              <span className="text-[10px] text-[#9CA3AF] mt-2 block">
                {data.parameters_passed} of {data.parameters_checked} requirements met
              </span>
            </div>

            <div className="card-panel p-4 col-span-1 md:col-span-2">
              <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider block mb-3">Standards validation</span>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(data.tier_compliance).map(([std, passed]) => (
                  <div key={std} className="bg-[#0C1322] border border-[#1F2937] p-2.5 rounded-lg text-center">
                    <span className="text-[9px] font-bold text-[#9CA3AF] uppercase block mb-1.5">{std}</span>
                    {passed ? (
                      <span className="badge-green rounded px-1.5 py-0.5 text-[10px] font-semibold">PASS</span>
                    ) : (
                      <span className="badge-red rounded px-1.5 py-0.5 text-[10px] font-semibold">FAIL</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* NCRs Checklist / Table */}
          <div className="card-panel p-0 overflow-hidden">
            <div className="border-b border-[#1F2937] p-4 flex items-center justify-between bg-[#0A0F1E]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-sky-400 text-lg">fact_check</span>
                Active Non-Conformance Reports (NCR)
              </h3>
              <span className="text-xs text-[#9CA3AF] font-medium bg-[#1F2937]/50 px-2 py-0.5 rounded-md">
                {data.ncrs.length} item(s) found
              </span>
            </div>

            {data.ncrs.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#9CA3AF] flex flex-col items-center gap-2 bg-[#0C1322]/20">
                <span className="material-symbols-outlined text-3xl text-emerald-500">verified</span>
                <p className="font-semibold text-white text-sm">Perfect Compliance</p>
                <p className="max-w-md">No parameter deviations detected from Uptime Tier III / TIA-942 engineering requirements.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1F2937] bg-[#0C1322]/20">
                {data.ncrs.map(ncr => (
                  <div key={ncr.ncr_id} className="p-4 flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex items-center md:flex-col md:items-start gap-2 shrink-0 md:w-28">
                      <span className="font-black text-xs text-white bg-[#1F2937] px-2 py-0.5 rounded">
                        {ncr.ncr_id}
                      </span>
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        ncr.severity === 'critical' ? 'badge-red' :
                        ncr.severity === 'major' ? 'badge-amber' : 'badge-grey'
                      )}>
                        {ncr.severity}
                      </span>
                    </div>

                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-white">
                        <span className="text-sky-400">{ncr.parameter.replace(/_/g, ' ').toUpperCase()}</span>
                        <span className="text-[#9CA3AF]">in</span>
                        <span className="truncate max-w-[200px]" title={ncr.source_document}>
                          {ncr.source_document}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {ncr.description}
                      </p>
                      {ncr.recommendation && (
                        <div className="mt-2 bg-[#0A0F1E] border border-sky-900/30 rounded-lg p-2.5 flex items-start gap-2">
                          <span className="material-symbols-outlined text-sky-400 text-sm mt-0.5">lightbulb</span>
                          <div>
                            <p className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">AI Recommendation</p>
                            <p className="text-xs text-slate-300 leading-tight mt-0.5">{ncr.recommendation}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="md:w-36 text-right shrink-0 mt-1">
                      <div className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider">Deviation Value</div>
                      <div className="text-sm font-black text-white mt-0.5">{ncr.actual_value}</div>
                      <div className="text-[10px] text-rose-400 font-semibold mt-0.5">{ncr.deviation_pct}% deviation</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center text-xs text-[#9CA3AF] py-16">
          No compliance check data matches.
        </div>
      )}
    </div>
  )
}
