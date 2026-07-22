// components/dashboard/KPIStrip.tsx
'use client'

import { MetricCard } from '@/components/ui/MetricCard'
import type { ProjectHealthDashboard } from '@/types'

interface KPIStripProps {
  dashboard: ProjectHealthDashboard | null
  isLoading: boolean
}

const RISK_COLOUR_MAP: Record<string, 'red' | 'orange' | 'amber' | 'green'> = {
  critical: 'red',
  high:     'orange',
  medium:   'amber',
  low:      'green',
}

export function KPIStrip({ dashboard, isLoading }: KPIStripProps) {
  if (isLoading || !dashboard) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28 w-full rounded-md" />
        ))}
      </div>
    )
  }

  const riskColour = RISK_COLOUR_MAP[dashboard.risk_level] || 'amber'
  const delay = dashboard.predicted_delay_days

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard
        numericValue={Math.abs(delay)}
        prefix={delay > 0 ? '+' : delay < 0 ? '-' : ''}
        label="Delay Days"
        subtext={delay > 0 ? 'behind baseline' : delay < 0 ? 'ahead of schedule' : 'on schedule'}
        colour={delay > 0 ? 'red' : 'green'}
        animDelay={100}
      />
      <MetricCard
        value={dashboard.risk_level.toUpperCase()}
        label="Risk Level"
        subtext={`${dashboard.active_risks} active risk${dashboard.active_risks !== 1 ? 's' : ''}`}
        colour={riskColour}
        animDelay={200}
      />
      <MetricCard
        numericValue={Math.round(dashboard.confidence * 100)}
        suffix="%"
        label="AI Confidence"
        subtext="predictive model stability"
        colour="purple"
        animDelay={300}
        showDashWhenZero={true}
      />
      <MetricCard
        numericValue={Math.round(dashboard.hours_saved_estimate)}
        label="Hours Saved"
        subtext="vs. manual review process"
        colour="teal"
        animDelay={400}
      />
    </div>
  )
}