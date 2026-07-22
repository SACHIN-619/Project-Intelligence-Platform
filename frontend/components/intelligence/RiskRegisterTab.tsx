'use client'
import { useState } from 'react'
import { cn, formatPct } from '@/lib/utils'
import { RISK_BORDER_CLASS, RISK_BADGE_CLASS } from '@/types'
import type { RiskSummary, RiskLevel } from '@/types'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useRouter } from 'next/navigation'

interface RiskRegisterTabProps { risks: RiskSummary[] }
type FilterLevel = 'all' | RiskLevel
const FILTERS: { id: FilterLevel; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'critical', label: 'Critical' },
  { id: 'high', label: 'High' }, { id: 'medium', label: 'Medium' }, { id: 'low', label: 'Low' },
]
const RISK_HEX: Record<RiskLevel, string> = { critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#22C55E' }

export function RiskRegisterTab({ risks }: RiskRegisterTabProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterLevel>('all')
  const [expandedId, setExpanded] = useState<string | null>(null)
  const filtered = filter === 'all' ? risks : risks.filter(r => r.severity === filter)
  const counts = risks.reduce<Record<string, number>>((acc, r) => { acc[r.severity] = (acc[r.severity] || 0) + 1; return acc }, {})
  return (
    <div className="p-4 lg:p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(f => {
          const count = f.id === 'all' ? risks.length : (counts[f.id] || 0)
          const isActive = filter === f.id
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors', isActive ? 'border border-[#3B82F6] bg-[#3B82F6]/15 text-[#3B82F6]' : 'border border-[#374151] text-[#9CA3AF] hover:border-[#4B5563] hover:text-white')}>
              {f.label}
              {count > 0 && <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', isActive ? 'bg-[#3B82F6]/20 text-[#3B82F6]' : 'bg-[#374151] text-[#6B7280]')}>{count}</span>}
            </button>
          )
        })}
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="material-symbols-outlined text-3xl text-[#374151]">check_circle</span>
          <p className="text-sm text-[#9CA3AF]">No {filter === 'all' ? '' : filter} risks detected</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(risk => {
            const isExpanded = expandedId === risk.id
            return (
              <div key={risk.id} className={cn('card-panel cursor-pointer transition-all duration-150', RISK_BORDER_CLASS[risk.severity], isExpanded && risk.severity === 'critical' && 'glow-red')} onClick={() => setExpanded(isExpanded ? null : risk.id)}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', RISK_BADGE_CLASS[risk.severity])}>{risk.severity}</span>
                      <span className="badge-grey rounded px-2 py-0.5 text-[10px] uppercase">{risk.risk_type}</span>
                    </div>
                    <span className="material-symbols-outlined shrink-0 text-base text-[#6B7280]">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                  </div>
                  <h4 className="mt-2 text-sm font-semibold text-white">{risk.task_name || risk.risk_type.replace('_', ' ')}</h4>
                  <p className={cn('mt-1 text-xs text-[#9CA3AF]', !isExpanded && 'line-clamp-2')}>{risk.explanation}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B7280]">
                    <span>Prob: <strong className="text-white">{formatPct(risk.probability)}</strong></span>
                    <span>Impact: <strong className="text-white">{risk.impact_days}d</strong></span>
                    <span>Score: <strong className="text-white">{risk.risk_score.toFixed(1)}</strong></span>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-[#1F2937] p-4" onClick={e => e.stopPropagation()}>
                    <div className="mb-3"><div className="flex items-center justify-between text-xs"><span className="text-[#6B7280]">Probability</span><span className="text-white">{formatPct(risk.probability)}</span></div><ProgressBar value={risk.probability * 100} colour={RISK_HEX[risk.severity]} className="mt-1.5" height={5} /></div>
                    <div className="mb-3"><div className="flex items-center justify-between text-xs"><span className="text-[#6B7280]">AI Confidence</span><span className="text-white">{formatPct(risk.confidence)}</span></div><ProgressBar value={risk.confidence * 100} colour="#A855F7" className="mt-1.5" height={5} /></div>
                    <div className="ai-insight-box mb-3"><div className="flex items-start gap-2"><span className="material-symbols-outlined text-sm text-[#14B8A6]">auto_awesome</span><p className="text-xs text-[#dce2f7]">{risk.impact_days > 0 ? `This risk can add up to ${risk.impact_days} day(s) to the project if unresolved.` : 'This risk requires monitoring but may not directly extend the schedule.'}</p></div></div>
                    <button onClick={() => router.push('/recovery')} className="btn-primary w-full justify-center text-xs"><span className="material-symbols-outlined text-sm">biotech</span>Create Recovery Action →</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {risks.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-[#374151] bg-[#111827] px-4 py-3 text-xs">
          {(counts['critical'] || 0) > 0 && <span className="metric-red font-bold">{counts['critical']} Critical</span>}
          {(counts['high'] || 0) > 0 && <span className="metric-orange font-bold">{counts['high']} High</span>}
          {(counts['medium'] || 0) > 0 && <span className="metric-amber font-bold">{counts['medium']} Medium</span>}
          {(counts['low'] || 0) > 0 && <span className="metric-green font-bold">{counts['low']} Low</span>}
          <span className="ml-auto text-[#6B7280]">Total Score: <strong className="text-white">{risks.reduce((a, r) => a + r.risk_score, 0).toFixed(1)}/100</strong></span>
        </div>
      )}
    </div>
  )
}
