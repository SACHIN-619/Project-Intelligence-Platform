// components/dashboard/RiskCard.tsx
'use client'

import { useState } from 'react'
import { RISK_BORDER_CLASS, RISK_BADGE_CLASS } from '@/types'
import type { RiskSummary } from '@/types'
import { cn, formatPct } from '@/lib/utils'

interface RiskCardProps {
  risk: RiskSummary
  onCreateAction?: () => void
}

const RISK_HEX: Record<string, string> = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#EAB308',
  low:      '#22C55E',
}

export function RiskCard({ risk, onCreateAction }: RiskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const colour = RISK_HEX[risk.severity] || '#6B7280'

  return (
    <div
      className={cn(
        'card-panel cursor-pointer overflow-hidden transition-all duration-200',
        RISK_BORDER_CLASS[risk.severity],
      )}
      style={expanded ? { boxShadow: `-4px 0 16px ${colour}25` } : undefined}
      onClick={() => setExpanded(v => !v)}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5',
              'text-[10px] font-bold uppercase tracking-wider',
              RISK_BADGE_CLASS[risk.severity]
            )}>
              {risk.severity}
            </span>
            <span className="rounded-full bg-[#1F2937] px-2 py-0.5
                             text-[10px] uppercase text-[#6B7280]">
              {risk.risk_type}
            </span>
          </div>
          <span className="material-symbols-outlined shrink-0 text-base text-[#4B5563]
                           transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}
          >
            keyboard_arrow_down
          </span>
        </div>

        {/* Task name */}
        <h4 className="mt-2 text-sm font-semibold leading-snug text-white">
          {risk.task_name || risk.risk_type.replace(/_/g, ' ')}
        </h4>

        {/* Explanation */}
        <p className={cn(
          'mt-1.5 text-xs leading-relaxed text-[#9CA3AF]',
          !expanded && 'line-clamp-2'
        )}>
          {risk.explanation}
        </p>

        {/* Quick stats */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          <span className="text-[#6B7280]">
            Prob: <strong className="text-white">{formatPct(risk.probability)}</strong>
          </span>
          <span className="text-[#6B7280]">
            Impact: <strong className="text-white">{risk.impact_days}d</strong>
          </span>
          <span className="text-[#6B7280]">
            Score: <strong style={{ color: colour }}>{risk.risk_score.toFixed(1)}</strong>
          </span>
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div
          className="border-t border-[#1F2937] bg-[#0d1424] p-4"
          onClick={e => e.stopPropagation()}
        >
          {/* Probability bar */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-[#6B7280]">Probability</span>
              <span className="font-medium text-white">{formatPct(risk.probability)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1F2937]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${risk.probability * 100}%`, background: colour }}
              />
            </div>
          </div>

          {/* Confidence bar */}
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-[#6B7280]">AI Confidence</span>
              <span className="font-medium text-[#A855F7]">{formatPct(risk.confidence)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1F2937]">
              <div
                className="h-full rounded-full bg-[#A855F7] transition-all duration-700"
                style={{ width: `${risk.confidence * 100}%` }}
              />
            </div>
          </div>

          {/* AI insight */}
          <div className="ai-insight-box mb-3">
            <div className="flex items-start gap-2">
              <span
                className="material-symbols-outlined shrink-0 text-sm text-[#14B8A6]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
              <p className="text-xs leading-relaxed text-[#dce2f7]">
                {risk.impact_days > 0
                  ? `Unresolved, this risk adds up to ${risk.impact_days} day${risk.impact_days !== 1 ? 's' : ''} to project completion.`
                  : 'This risk requires monitoring but may not directly extend the schedule.'}
              </p>
            </div>
          </div>

          {/* CTA */}
          {onCreateAction && (
            <button
              onClick={onCreateAction}
              className="btn-primary w-full justify-center text-xs"
            >
              <span className="material-symbols-outlined text-sm">biotech</span>
              Create Recovery Action →
            </button>
          )}
        </div>
      )}
    </div>
  )
}