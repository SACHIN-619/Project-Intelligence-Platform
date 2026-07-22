'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { RecoveryOption } from '@/types'

interface RecoveryOptionsProps {
  options: RecoveryOption[]
  isLoading: boolean
  selectedIndex: number | null
  onSelect: (i: number) => void
  onRunSimulation: (opt: RecoveryOption, days: number) => void
  isSimulating: boolean
}

const WINDOW_CONFIG: Record<string, { text: string; colour: string; icon: string }> = {
  now:            { text: 'Act now',         colour: 'text-[#EF4444]', icon: 'alarm' },
  within_7_days:  { text: 'Within 7 days',  colour: 'text-[#F97316]', icon: 'schedule' },
  within_30_days: { text: 'Within 30 days', colour: 'text-[#EAB308]', icon: 'event' },
  too_late:       { text: 'Window closed',  colour: 'text-[#6B7280]', icon: 'block' },
}

const COST_CONFIG: Record<string, { text: string; colour: string }> = {
  low:    { text: 'Low cost',    colour: 'text-[#22C55E]' },
  medium: { text: 'Medium cost', colour: 'text-[#EAB308]' },
  high:   { text: 'High cost',   colour: 'text-[#EF4444]' },
}

const ACTION_LABEL: Record<string, string> = {
  backup_vendor:       'Activate Backup Supplier',
  parallel_execution:  'Run Tasks in Parallel',
  add_crew:            'Add Crew / Night Shift',
  reschedule:          'Reschedule Task',
  accelerate:          'Accelerate Work Package',
  defer_non_critical:  'Defer Non-Critical Task',
}

const ACTION_ICON: Record<string, string> = {
  backup_vendor:       'storefront',
  parallel_execution:  'fork_right',
  add_crew:            'groups',
  reschedule:          'event_repeat',
  accelerate:          'speed',
  defer_non_critical:  'low_priority',
}

export function RecoveryOptions({
  options, isLoading, selectedIndex, onSelect,
  onRunSimulation, isSimulating,
}: RecoveryOptionsProps) {
  const [sliderValues, setSliderValues] = useState<Record<number, number>>({})

  // Update slider range fill progress dynamically via style bindings
  function handleSliderChange(index: number, value: number) {
    setSliderValues(prev => ({ ...prev, [index]: value }))
    const el = document.getElementById(`slider-${index}`) as HTMLInputElement
    if (el) {
      const pct = ((value - 1) / 9) * 100
      el.style.setProperty('--range-progress', `${pct}%`)
    }
  }

  function getSlider(i: number, opt: RecoveryOption): number {
    return sliderValues[i] ?? Math.min(10, Math.max(1, opt.estimated_days_saved))
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-32 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (options.length === 0) {
    return (
      <div className="card-panel flex flex-col items-center gap-4 p-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl
                        border border-[#374151] bg-[#1F2937]">
          <span className="material-symbols-outlined text-3xl text-[#374151]">biotech</span>
        </div>
        <div>
          <p className="text-sm font-medium text-white">No recovery options yet</p>
          <p className="mt-1 text-xs text-[#6B7280]">
            Upload a schedule with delayed tasks to generate AI-ranked recovery suggestions
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {options.map((opt, i) => {
        const isSelected = selectedIndex === i
        const isTooLate  = opt.opportunity_window === 'too_late'
        const win        = WINDOW_CONFIG[opt.opportunity_window] || WINDOW_CONFIG.too_late
        const cost       = COST_CONFIG[opt.estimated_cost] || COST_CONFIG.medium
        const sliderVal  = getSlider(i, opt)
        const icon       = ACTION_ICON[opt.action_type] || 'build'

        return (
          <div
            key={i}
            onClick={() => !isTooLate && onSelect(i)}
            className={cn(
              'card-panel overflow-hidden transition-all duration-200',
              !isTooLate && 'cursor-pointer',
              isSelected
                ? 'border-[#3B82F6] shadow-[0_0_0_1px_#3B82F6,0_4px_24px_rgba(59,130,246,0.15)]'
                : !isTooLate && 'hover:border-[#374151]',
              isTooLate && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="p-4">
              {/* Header row */}
              <div className="flex items-start gap-3">
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  isSelected ? 'bg-[#3B82F6]/15' : 'bg-[#1F2937]'
                )}>
                  <span
                    className={cn(
                      'material-symbols-outlined text-xl',
                      isSelected ? 'text-[#3B82F6]' : 'text-[#6B7280]'
                    )}
                  >
                    {icon}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  {i === 0 && !isTooLate && (
                    <div className="mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-[#3B82F6]"
                        style={{ fontVariationSettings: "'FILL' 1" }}>
                        star
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider
                                       text-[#3B82F6]">
                        Recommended
                      </span>
                    </div>
                  )}

                  <h4 className="text-sm font-semibold text-white">
                    {ACTION_LABEL[opt.action_type] || opt.title}
                  </h4>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#9CA3AF]">
                    {opt.description}
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                <span className="flex items-center gap-1 font-bold text-[#22C55E]">
                  <span className="material-symbols-outlined text-sm">trending_down</span>
                  +{opt.estimated_days_saved} days saved
                </span>
                <span className={cn('flex items-center gap-1', cost.colour)}>
                  <span className="material-symbols-outlined text-sm">payments</span>
                  {cost.text}
                </span>
                <span className="flex items-center gap-1 text-[#A855F7]">
                  <span className="material-symbols-outlined text-sm">psychology</span>
                  {Math.round(opt.confidence * 100)}% confidence
                </span>
              </div>

              {/* Opportunity window */}
              <div className="mt-2 flex items-center gap-1.5">
                <span className={cn('material-symbols-outlined text-sm', win.colour)}>
                  {win.icon}
                </span>
                <span className={cn('text-xs font-medium', win.colour)}>
                  {win.text}
                </span>
              </div>

              {/* NEW — Phase 19: AI Memory context — "used successfully before" */}
              {opt.memory_context && (
                <div className="mt-2 flex items-start gap-1.5 rounded-md bg-[#14B8A6]/10 px-2.5 py-1.5">
                  <span className="material-symbols-outlined text-sm text-[#14B8A6]">
                    history
                  </span>
                  <span className="text-[11px] leading-snug text-[#5EEAD4]">
                    {opt.memory_context}
                  </span>
                </div>
              )}
            </div>

            {/* Expanded Content Drawer Container */}
            {isSelected && !isTooLate && (
              <div
                className="border-t border-[#1F2937] bg-[#0d1424] p-4"
                onClick={e => e.stopPropagation()}
              >
                {/* Slider Input Block */}
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-medium text-[#9CA3AF]">
                      Target delay reduction
                    </label>
                    <span className="rounded-full bg-[#3B82F6]/15 px-3 py-1 font-mono
                                     text-sm font-bold text-[#3B82F6]">
                      {sliderVal} days
                    </span>
                  </div>
                  <input
                    id={`slider-${i}`}
                    type="range"
                    min={1}
                    max={10}
                    value={sliderVal}
                    onChange={e => handleSliderChange(i, Number(e.target.value))}
                    className="w-full"
                    style={{
                      '--range-progress': `${((sliderVal - 1) / 9) * 100}%`,
                    } as React.CSSProperties}
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-[#4B5563]">
                    <span>1 day</span>
                    <span>5 days</span>
                    <span>10 days</span>
                  </div>
                </div>

                {/* Simulation Metrics Impact Preview */}
                <div className="mb-4 rounded-lg bg-[#111827] p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#6B7280]">Estimated recovery</span>
                    <span className="font-bold text-[#22C55E]">
                      {sliderVal} days saved
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[#6B7280]">Confidence at this setting</span>
                    <span className="text-[#A855F7]">
                      {Math.round(Math.max(0.5, opt.confidence - (sliderVal > opt.estimated_days_saved ? 0.1 : 0)) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Simulation Trigger CTA Button */}
                <button
                  onClick={() => onRunSimulation(opt, sliderVal)}
                  disabled={isSimulating}
                  className="btn-primary w-full justify-center"
                >
                  {isSimulating ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2
                                       border-white/30 border-t-white" />
                      Running 1,000 simulations...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base"
                        style={{ fontVariationSettings: "'FILL' 1" }}>
                        play_arrow
                      </span>
                      Run Simulation
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Compound Scenario Information Alert Card */}
      {options.length >= 2 && (
        <div className="rounded-xl border border-[#14B8A6]/30 bg-[#14B8A6]/5 p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-[#14B8A6]"
              style={{ fontVariationSettings: "'FILL' 1" }}>
              merge
            </span>
            <p className="text-xs font-bold text-[#14B8A6]">Compound Scenario Available</p>
          </div>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            Combine Option 1 + Option 2 — synergy may recover more days than each alone
          </p>
        </div>
      )}
    </div>
  )
}