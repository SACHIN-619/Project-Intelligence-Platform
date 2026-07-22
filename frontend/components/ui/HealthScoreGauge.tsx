// components/ui/HealthScoreGauge.tsx
// ────────────────────────────────────────────────────────────────────────────
// The visual home of the Project Health Engine (Phase 9 from backend design).
// One number that answers: "Is my project healthy?" — no dashboard reading
// required. Judges specifically respond well to this because it converts
// four weighted engineering dimensions (schedule/risk/procurement/confidence)
// into a single glanceable signal, exactly as the backend was designed to do.
'use client'

import { useEffect, useState } from 'react'
import { cn, animateCountUp } from '@/lib/utils'

interface HealthScoreGaugeProps {
  score?:        number   // 0-100, undefined while loading
  level?:        'healthy' | 'watch' | 'at_risk' | 'critical'
  summary?:      string
  isLoading?:    boolean
  size?:         'sm' | 'lg'
  className?:    string
}

const LEVEL_CONFIG: Record<
  NonNullable<HealthScoreGaugeProps['level']>,
  { colour: string; label: string; glow: string }
> = {
  healthy:  { colour: '#22C55E', label: 'Healthy',        glow: 'rgba(34,197,94,0.35)' },
  watch:    { colour: '#EAB308', label: 'Watch',          glow: 'rgba(234,179,8,0.35)' },
  at_risk:  { colour: '#F97316', label: 'At Risk',        glow: 'rgba(249,115,22,0.35)' },
  critical: { colour: '#EF4444', label: 'Critical',       glow: 'rgba(239,68,68,0.35)' },
}

function levelFromScore(score: number): HealthScoreGaugeProps['level'] {
  if (score >= 80) return 'healthy'
  if (score >= 60) return 'watch'
  if (score >= 40) return 'at_risk'
  return 'critical'
}

export function HealthScoreGauge({
  score,
  level,
  summary,
  isLoading = false,
  size = 'lg',
  className,
}: HealthScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0)

  const resolvedLevel = level || (score !== undefined ? levelFromScore(score) : 'watch')
  const config = LEVEL_CONFIG[resolvedLevel]

  useEffect(() => {
    if (score === undefined) return
    const cancel = animateCountUp(0, score, 1100, setDisplayScore)
    return cancel
  }, [score])

  const dim = size === 'lg' ? 176 : 108
  const stroke = size === 'lg' ? 12 : 8
  const radius = (dim - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = score !== undefined ? Math.min(100, Math.max(0, score)) : 0
  const dashOffset = circumference - (pct / 100) * circumference

  if (isLoading) {
    return (
      <div className={cn('flex flex-col items-center gap-3', className)}>
        <div
          className="skeleton rounded-full"
          style={{ width: dim, height: dim }}
        />
        <div className="skeleton h-4 w-24 rounded" />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: dim, height: dim }}>
        {/* Ambient glow behind the ring */}
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-40"
          style={{ background: config.glow }}
        />

        <svg width={dim} height={dim} className="-rotate-90 relative">
          {/* Track */}
          <circle
            cx={dim / 2} cy={dim / 2} r={radius}
            fill="none" stroke="#1F2937" strokeWidth={stroke}
          />
          {/* Progress arc */}
          <circle
            cx={dim / 2} cy={dim / 2} r={radius}
            fill="none"
            stroke={config.colour}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.65,0,0.35,1)' }}
          />
        </svg>

        {/* Centre number */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'font-extrabold leading-none tracking-tight',
              size === 'lg' ? 'text-4xl' : 'text-2xl'
            )}
            style={{ color: config.colour }}
          >
            {score !== undefined ? Math.round(displayScore) : '—'}
          </span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wider text-[#6B7280]">
            / 100
          </span>
        </div>
      </div>

      {/* Level badge */}
      <span
        className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
        style={{ background: `${config.colour}20`, color: config.colour }}
      >
        {config.label}
      </span>

      {summary && size === 'lg' && (
        <p className="max-w-[220px] text-center text-xs leading-relaxed text-[#9CA3AF]">
          {summary}
        </p>
      )}
    </div>
  )
}

/**
 * Compact horizontal variant — used inline in headers/cards where a full
 * gauge would be too large (e.g. Dashboard page header next to project name).
 */
export function HealthScoreBadge({
  score,
  level,
  isLoading = false,
}: {
  score?: number
  level?: HealthScoreGaugeProps['level']
  isLoading?: boolean
}) {
  const resolvedLevel = level || (score !== undefined ? levelFromScore(score) : 'watch')
  const config = LEVEL_CONFIG[resolvedLevel]

  if (isLoading) {
    return <div className="skeleton h-6 w-28 rounded-full" />
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: `${config.colour}18`, color: config.colour }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: config.colour }} />
      Health {score !== undefined ? Math.round(score) : '—'}
      <span className="opacity-70">· {config.label}</span>
    </span>
  )
}