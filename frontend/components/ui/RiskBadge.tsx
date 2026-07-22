// components/ui/RiskBadge.tsx
import { cn } from '@/lib/utils'
import { RISK_BADGE_CLASS } from '@/types'
import type { RiskLevel } from '@/types'

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        RISK_BADGE_CLASS[level],
        className
      )}
    >
      {level}
    </span>
  )
}
