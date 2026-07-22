// components/ui/ProgressBar.tsx
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number          // 0-100
  colour?: string        // hex colour, defaults to blue
  gradient?: boolean      // blue→green gradient (data quality bars)
  className?: string
  height?: number
}

export function ProgressBar({
  value, colour = '#3B82F6', gradient = false, className, height = 6,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className={cn('progress-track', className)} style={{ height }}>
      <div
        className="progress-fill"
        style={{
          width: `${clamped}%`,
          background: gradient
            ? 'linear-gradient(90deg, #3B82F6, #22C55E)'
            : colour,
        }}
      />
    </div>
  )
}
