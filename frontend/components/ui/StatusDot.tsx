// components/ui/StatusDot.tsx
import { cn } from '@/lib/utils'

type StatusColour = 'green' | 'orange' | 'red' | 'blue' | 'grey'

const DOT_CLASS: Record<StatusColour, string> = {
  green:  'status-dot-green',
  orange: 'status-dot-orange',
  red:    'status-dot-red',
  blue:   'status-dot-blue',
  grey:   'bg-[#6B7280] h-2 w-2 rounded-full',
}

export function StatusDot({ colour, className }: { colour: StatusColour; className?: string }) {
  return <span className={cn(DOT_CLASS[colour], className)} />
}

// ── Confidence dots e.g. ●●●●○ ──────────────────────────────────────────
export function ConfidenceDots({ value }: { value: number }) {
  const filled = Math.round(value * 5)
  return (
    <span className="font-mono text-xs tracking-wider">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < filled ? 'text-[#3B82F6]' : 'text-[#374151]'}>
          ●
        </span>
      ))}
    </span>
  )
}
