// components/ui/MetricCard.tsx
// FIXED: Count-up animation, entrance animation, glow effects
// FIXED: Shows "—" instead of 0% when value is truly zero (not yet computed)
'use client'

import { useEffect, useState, useRef } from 'react'
import { cn, animateCountUp } from '@/lib/utils'

type MetricColour = 'red' | 'orange' | 'amber' | 'green' | 'purple' | 'teal' | 'cyan' | 'blue'

interface MetricCardProps {
  value?:        string | number
  numericValue?: number
  label:         string
  subtext?:      string
  colour:        MetricColour
  prefix?:       string
  suffix?:       string
  className?:    string
  animDelay?:    number   // stagger delay in ms
  showDashWhenZero?: boolean  // show — instead of 0
}

const COLOUR_MAP: Record<MetricColour, { text: string; border: string }> = {
  red:    { text: 'metric-red',    border: 'border-t-[#EF4444]' },
  orange: { text: 'metric-orange', border: 'border-t-[#F97316]' },
  amber:  { text: 'metric-amber',  border: 'border-t-[#EAB308]' },
  green:  { text: 'metric-green',  border: 'border-t-[#22C55E]' },
  purple: { text: 'metric-purple', border: 'border-t-[#A855F7]' },
  teal:   { text: 'metric-teal',   border: 'border-t-[#14B8A6]' },
  cyan:   { text: 'metric-cyan',   border: 'border-t-[#06B6D4]' },
  blue:   { text: 'metric-blue',   border: 'border-t-[#3B82F6]' },
}

export function MetricCard({
  value,
  numericValue,
  label,
  subtext,
  colour,
  prefix = '',
  suffix = '',
  className,
  animDelay = 0,
  showDashWhenZero = false,
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState<number>(0)
  const [isVisible, setIsVisible]       = useState(false)
  const hasAnimated                      = useRef(false)
  const cardRef                          = useRef<HTMLDivElement>(null)

  // Intersection observer — only animate when card enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.1 }
    )
    if (cardRef.current) observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [])

  // Count-up animation triggered by visibility
  useEffect(() => {
    if (!isVisible || numericValue === undefined || hasAnimated.current) return
    hasAnimated.current = true
    const cancel = animateCountUp(0, numericValue, 900, setDisplayValue)
    return cancel
  }, [isVisible, numericValue])

  const { text: textClass, border: borderClass } = COLOUR_MAP[colour]

  // Determine what to display
  const displayStr = (() => {
    if (numericValue !== undefined) {
      // Show dash if zero and flagged
      if (showDashWhenZero && numericValue === 0) return '—'
      return `${prefix}${Math.round(displayValue)}${suffix}`
    }
    return String(value ?? '—')
  })()

  return (
    <div
      ref={cardRef}
      className={cn(
        'card-panel border-t-2 p-4 animate-entrance',
        borderClass,
        className
      )}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      {/* Big metric number */}
      <p className={cn(
        'font-extrabold leading-none tracking-tight',
        textClass,
        'text-[36px] sm:text-[48px] lg:text-[52px]'
      )}>
        {displayStr}
      </p>

      {/* Label */}
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
        {label}
      </p>

      {/* Subtext */}
      {subtext && (
        <p className="mt-1 text-xs text-[#6B7280]">{subtext}</p>
      )}
    </div>
  )
}