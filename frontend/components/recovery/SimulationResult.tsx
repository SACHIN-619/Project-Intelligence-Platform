// components/dashboard/SimulationResult.tsx
'use client'
import { useEffect, useState } from 'react'
import { cn, animateCountUp } from '@/lib/utils'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useToast } from '@/components/ui/Toast'
import { approveScenario, rejectScenario } from '@/lib/api'
import type { ScenarioResult } from '@/types'

interface SimulationResultProps {
  result: ScenarioResult | null; isLoading: boolean; onApproved?: () => void
}
function AnimatedNumber({ from, to, colour }: { from: number; to: number; colour: string }) {
  const [display, setDisplay] = useState(from)
  useEffect(() => { const cancel = animateCountUp(from, to, 800, setDisplay); return cancel }, [from, to])
  return <span style={{ color: colour }} className="text-[40px] font-extrabold leading-none sm:text-[52px]">{display > 0 ? '+' : ''}{Math.round(display)}</span>
}
const REJECT_REASONS = ['Cost too high', 'Not feasible in current timeline', 'Wrong target task', 'Other reason']

export function SimulationResult({ result, isLoading, onApproved }: SimulationResultProps) {
  const { showToast } = useToast()
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0])
  const [rejectNotes, setRejectNotes] = useState('')
  const [actionStatus, setActionStatus] = useState<'idle'|'approving'|'rejecting'|'approved'|'rejected'>('idle')
  useEffect(() => { setActionStatus('idle') }, [result?.scenario_id])

  async function handleApprove() {
    if (!result) return
    setActionStatus('approving')
    const { error } = await approveScenario(result.scenario_id)
    if (error) { showToast('error', error); setActionStatus('idle'); return }
    setActionStatus('approved')
    showToast('success', `Recovery plan approved — "${result.name}"`)
    onApproved?.()
  }
  async function handleReject() {
    if (!result) return
    setActionStatus('rejecting')
    const reason = rejectNotes ? `${rejectReason}: ${rejectNotes}` : rejectReason
    const { error } = await rejectScenario(result.scenario_id, reason)
    if (error) { showToast('error', error); setActionStatus('idle'); return }
    setActionStatus('rejected'); setShowRejectModal(false)
    showToast('info', 'Scenario rejected — feedback saved for learning')
  }

  if (!result && !isLoading) return (
    <div className="card-panel flex h-64 flex-col items-center justify-center gap-3 text-center">
      <span className="material-symbols-outlined text-4xl text-[#374151]">target</span>
      <p className="text-sm text-[#9CA3AF]">Select a recovery option and run simulation</p>
      <p className="text-xs text-[#4B5563]">Results appear here showing before vs. after comparison</p>
    </div>
  )
  if (isLoading) return (
    <div className="card-panel flex h-64 flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#374151] border-t-[#3B82F6]" />
      <p className="text-sm text-[#6B7280]">Computing simulation...</p>
      <p className="text-xs text-[#4B5563]">Running 1,000 Monte Carlo scenarios</p>
    </div>
  )
  if (!result) return null

  const savedPct  = Math.round(result.days_saved_pct)
  const onTimePct = result.on_time_probability ? Math.round(result.on_time_probability * 100) : null
  // BUG FIX 9: derive before-probability from days_saved delta, not by subtracting 30
  const oldOnTime = onTimePct !== null ? Math.max(0, onTimePct - Math.round(result.days_saved * 4)) : null

  return (
    <div className="animate-fade-in space-y-4">
      <div><h4 className="text-sm font-semibold text-white">{result.name}</h4><p className="text-xs text-[#6B7280]">Simulation complete</p></div>

      {/* Before / After */}
      <div className="card-panel overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-[#1F2937]">
          <div className="p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Before</p>
            <p className="mt-2 text-[40px] font-extrabold leading-none text-[#EF4444] sm:text-[52px]">+{result.old_delay_days}</p>
            <p className="text-[11px] uppercase tracking-wider text-[#6B7280]">Days Late</p>
            {oldOnTime !== null && <p className="mt-0.5 text-xs text-[#EF4444]">{oldOnTime}% on-time</p>}
          </div>
          <div className="p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">After</p>
            <div className="mt-2"><AnimatedNumber from={result.old_delay_days} to={result.new_delay_days} colour={result.new_delay_days <= 0 ? '#22C55E' : '#EAB308'} /></div>
            <p className="text-[11px] uppercase tracking-wider text-[#6B7280]">Days Late</p>
            {onTimePct !== null && <p className="mt-0.5 text-xs text-[#22C55E]">{onTimePct}% on-time</p>}
          </div>
        </div>
      </div>

      {/* Days saved */}
      <div className="card-panel p-4 text-center">
        <p className="text-4xl font-extrabold text-[#22C55E] sm:text-5xl">{result.days_saved}</p>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Days Saved</p>
        <ProgressBar value={savedPct} colour="#22C55E" className="mx-auto mt-3 max-w-xs" height={6} />
        <p className="mt-1.5 text-xs text-[#9CA3AF]">{savedPct}% of total delay recovered</p>
      </div>

      {/* MC comparison */}
      {result.mc_p50 && (
        <div className="card-panel overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-[#1F2937]"><th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-[#9CA3AF]">Metric</th><th className="px-3 py-2.5 text-center text-[#9CA3AF]">Before</th><th className="px-3 py-2.5 text-center text-[#9CA3AF]">After</th></tr></thead>
            <tbody>
              {[
                { label: 'P50', before: result.mc_p50 + result.days_saved, after: result.mc_p50 },
                { label: 'P80', before: result.mc_p80 ? result.mc_p80 + result.days_saved : null, after: result.mc_p80 },
                { label: 'P90', before: result.mc_p90 ? result.mc_p90 + result.days_saved : null, after: result.mc_p90 },
              ].filter(r => r.before && r.after).map(r => (
                <tr key={r.label} className="border-t border-[#1F2937]">
                  <td className="px-3 py-2 text-[#9CA3AF]">P{r.label} completion</td>
                  <td className="px-3 py-2 text-center text-white">Day {r.before}</td>
                  <td className="px-3 py-2 text-center font-semibold text-[#22C55E]">Day {r.after} ✓</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AI explanation */}
      {result.explanation && (
        <div className="ai-insight-box">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-base text-[#14B8A6]">auto_awesome</span>
            <div className="flex-1">
              <p className="text-xs text-[#dce2f7]">{result.explanation}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-[#6B7280]">Confidence: {Math.round(result.confidence * 100)}%</span>
                <span className="text-[11px] text-[#6B7280]">Feasibility: {Math.round(result.feasibility_score * 100)}%</span>
              </div>
              {result.evidence.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.evidence.slice(0, 2).map((ev, i) => (
                    <span key={i} className="rounded bg-[#14B8A6]/10 px-2 py-0.5 text-[10px] text-[#14B8A6]">📄 {ev.source}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NEW — Phase 20: Knowledge Graph impact trace */}
      {result.knowledge_impact && (
        <div className="rounded-lg border border-[#3B82F6]/25 bg-[#3B82F6]/5 p-3">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-[#3B82F6]">hub</span>
            <p className="text-xs font-semibold text-[#93C5FD]">Knowledge Graph Trace</p>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#9CA3AF]">
            Reasoning path for <strong className="text-white">{result.knowledge_impact.entity}</strong>:
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            {result.knowledge_impact.root_cause_vendors.slice(0, 2).map((v, i) => (
              <span key={`v-${i}`} className="rounded bg-[#F97316]/15 px-2 py-0.5 text-[#FDBA74]">
                {v}
              </span>
            ))}
            {(result.knowledge_impact.root_cause_vendors.length > 0 &&
              result.knowledge_impact.impacted_tasks.length > 0) && (
              <span className="material-symbols-outlined text-xs text-[#4B5563]">arrow_forward</span>
            )}
            {result.knowledge_impact.impacted_tasks.slice(0, 3).map((t, i) => (
              <span key={`t-${i}`} className="rounded bg-[#3B82F6]/15 px-2 py-0.5 text-[#93C5FD]">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* NEW — Phase 19: AI Memory — similar past decisions */}
      {result.memory_similar_cases && result.memory_similar_cases.length > 0 && (
        <div className="rounded-lg border border-[#14B8A6]/25 bg-[#14B8A6]/5 p-3">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-[#14B8A6]">history</span>
            <p className="text-xs font-semibold text-[#5EEAD4]">Similar Past Decisions</p>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {result.memory_similar_cases.slice(0, 3).map((m, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="truncate pr-2 text-[#9CA3AF]">{m.description}</span>
                <span className="shrink-0 font-medium text-[#5EEAD4]">+{m.days_saved}d saved</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {actionStatus === 'approved' ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-[#22C55E] bg-[#22C55E]/10 p-3">
          <span className="material-symbols-outlined text-lg text-[#22C55E]">check_circle</span>
          <p className="text-sm font-semibold text-[#22C55E]">Scenario Approved ✓</p>
        </div>
      ) : actionStatus === 'rejected' ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-[#374151] bg-[#374151]/10 p-3">
          <span className="material-symbols-outlined text-lg text-[#6B7280]">cancel</span>
          <p className="text-sm text-[#6B7280]">Scenario Rejected</p>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => setShowRejectModal(true)} disabled={actionStatus !== 'idle'} className="btn-ghost flex-1 justify-center text-sm">Try Different Option</button>
          <button onClick={handleApprove} disabled={actionStatus !== 'idle'} className="btn-approve flex-1 justify-center">
            {actionStatus === 'approving' ? (<><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Approving...</>) : 'Approve & Execute →'}
          </button>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm animate-slide-in-up rounded-lg border border-[#374151] bg-[#111827] p-5">
            <h4 className="text-sm font-semibold text-white">Why are you rejecting this?</h4>
            <p className="mt-1 text-xs text-[#6B7280]">Your feedback helps improve future suggestions.</p>
            <div className="mt-4 flex flex-col gap-2">
              {REJECT_REASONS.map(r => (
                <label key={r} className="flex cursor-pointer items-center gap-2.5">
                  <input type="radio" checked={rejectReason === r} onChange={() => setRejectReason(r)} className="accent-[#3B82F6]" />
                  <span className="text-sm text-[#dce2f7]">{r}</span>
                </label>
              ))}
            </div>
            <textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} placeholder="Additional notes (optional)..." className="input-dark mt-3 h-20 resize-none" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowRejectModal(false)} className="btn-ghost text-sm" disabled={actionStatus === 'rejecting'}>Cancel</button>
              <button onClick={handleReject} disabled={actionStatus === 'rejecting'} className="btn-reject">{actionStatus === 'rejecting' ? 'Rejecting...' : 'Confirm Rejection'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}