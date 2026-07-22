/**
 * components/upload/ProcessingSteps.tsx
 * =======================================
 * State 3 of 4 in the upload flow.
 *
 * Consumes WebSocket events from useWebSocket() hook and animates
 * each processing step as the backend job progresses.
 *
 * How it works:
 *   1. Backend job broadcasts "progress" events with { stage, pct }
 *   2. stageToIndex() maps the stage string → step array index
 *   3. All steps before current mark as "done", current marks "running"
 *   4. When "analysis_complete" fires → all done → call onComplete()
 *
 * BUG FIX 13: isMountedRef prevents setState after unmount.
 * The onComplete callback is only called once (completedRef guard).
 */
// components/upload/ProcessingSteps.tsx
// FIXED: Steps animate properly even without WebSocket
// FIXED: Added fallback simulation mode when WS not connected
// FIXED: Proper step-running and step-check-pop animations
// components/upload/ProcessingSteps.tsx
// FIXED: Steps animate properly even without WebSocket
// FIXED: Added fallback simulation mode when WS not connected
// FIXED: Proper step-running and step-check-pop animations
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { PROCESSING_STEPS } from '@/types'
import type { ProcessingStep, WSEvent } from '@/types'

interface ProcessingStepsProps {
  lastEvent:   WSEvent | null
  isConnected: boolean
  onComplete:  () => void
}

function stageToIndex(stage: string): number {
  const s = stage.toLowerCase()
  if (s.includes('reading'))                         return 0
  if (s.includes('schema') || s.includes('memory')) return 1
  if (s.includes('column') || s.includes('pars'))   return 2
  if (s.includes('saving') || s.includes('task'))   return 3
  if (s.includes('embed'))                           return 4
  if (s.includes('critical') || s.includes('graph'))return 5
  if (s.includes('risk'))                            return 6
  if (s.includes('monte') || s.includes('carlo'))   return 7
  if (s.includes('explain') || s.includes('ai'))    return 8
  return -1
}

export function ProcessingSteps({ lastEvent, isConnected, onComplete }: ProcessingStepsProps) {
  const [steps, setSteps] = useState<ProcessingStep[]>(
    PROCESSING_STEPS.map(s => ({ ...s }))
  )
  const [currentPct, setPct]    = useState(0)
  const [simStep, setSimStep]   = useState(-1) // fallback simulation index
  const startTimes               = useRef<Record<number, number>>({})
  const completedRef             = useRef(false)
  const isMountedRef             = useRef(true)
  const simTimerRef              = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (simTimerRef.current) clearInterval(simTimerRef.current)
    }
  }, [])

  // ── Fallback simulation when WebSocket not connected ───────────────────
  // Shows progress visually so user knows something is happening
  // even if ARQ worker isn't running or WS is blocked
  useEffect(() => {
    if (isConnected) return // real WS events will drive this

    let step = 0
    const STEP_DURATION = 2200 // ms per step

    simTimerRef.current = setInterval(() => {
      if (!isMountedRef.current) { clearInterval(simTimerRef.current); return }

      if (step >= PROCESSING_STEPS.length) {
        clearInterval(simTimerRef.current)
        return
      }

      setSteps(prev => {
        const next = [...prev]
        if (step > 0 && next[step - 1].status !== 'done') {
          next[step - 1] = {
            ...next[step - 1],
            status: 'done',
            duration: `${(STEP_DURATION / 1000).toFixed(1)}s`,
          }
        }
        if (next[step]) {
          if (!startTimes.current[step]) startTimes.current[step] = Date.now()
          next[step] = { ...next[step], status: 'running' }
        }
        return next
      })
      setPct(Math.round((step / PROCESSING_STEPS.length) * 100))
      step++
    }, STEP_DURATION)

    return () => { if (simTimerRef.current) clearInterval(simTimerRef.current) }
  }, [isConnected])

  // ── Real WebSocket events ──────────────────────────────────────────────
  useEffect(() => {
    if (!lastEvent || !isMountedRef.current) return

    if (lastEvent.type === 'progress' && lastEvent.stage) {
      // Clear fallback simulation since we have real events
      if (simTimerRef.current) { clearInterval(simTimerRef.current); simTimerRef.current = undefined }

      const idx = stageToIndex(lastEvent.stage)
      if (idx === -1) return

      setSteps(prev => {
        const next = [...prev]
        for (let i = 0; i < idx; i++) {
          if (next[i].status !== 'done') {
            const elapsed = startTimes.current[i]
              ? ((Date.now() - startTimes.current[i]) / 1000).toFixed(1)
              : '0.3'
            next[i] = { ...next[i], status: 'done', duration: `${elapsed}s` }
          }
        }
        if (next[idx] && next[idx].status !== 'done') {
          if (!startTimes.current[idx]) startTimes.current[idx] = Date.now()
          next[idx] = { ...next[idx], status: 'running' }
        }
        return next
      })
      setPct(lastEvent.pct ?? 0)
    }

    if (lastEvent.type === 'analysis_complete' && !completedRef.current) {
      completedRef.current = true
      if (simTimerRef.current) clearInterval(simTimerRef.current)
      setSteps(prev =>
        prev.map((s, i) => ({
          ...s,
          status: 'done' as const,
          duration: s.duration || `${(0.3 + i * 0.35).toFixed(1)}s`,
        }))
      )
      setPct(100)
      setTimeout(() => { if (isMountedRef.current) onComplete() }, 800)
    }
  }, [lastEvent, onComplete])

  const doneCount = steps.filter(s => s.status === 'done').length
  const allDone   = doneCount === steps.length

  return (
    <div className="animate-entrance">
      <div className="flex items-center gap-3 mb-1">
        <h3 className="text-base font-semibold text-white">Processing Your Project</h3>
        {!isConnected && (
          <span className="rounded-full bg-[#EAB308]/15 px-2 py-0.5 text-[10px] font-medium text-[#EAB308]">
            Offline mode
          </span>
        )}
      </div>
      <p className="mt-0.5 mb-4 text-sm text-[#6B7280]">
        {isConnected ? 'Real-time analysis in progress' : 'Processing (start ARQ worker for live updates)'}
      </p>

      <div className="card-panel p-5">
        <div className="flex flex-col gap-4">
          {steps.map((step, i) => (
            <div key={i}>
              <div className="flex items-center gap-3">

                {/* Status icon */}
                {step.status === 'done' ? (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22C55E] step-check-pop">
                    <span className="material-symbols-outlined text-[14px] text-white"
                      style={{ fontVariationSettings: "'FILL' 1" }}>
                      check
                    </span>
                  </span>
                ) : step.status === 'running' ? (
                  <span className="h-6 w-6 shrink-0 rounded-full bg-[#3B82F6] step-running" />
                ) : (
                  <span className="h-6 w-6 shrink-0 rounded-full border-2 border-[#2D3748]" />
                )}

                {/* Label */}
                <span className={cn(
                  'flex-1 text-sm transition-colors duration-300',
                  step.status === 'done'    ? 'text-white' :
                  step.status === 'running' ? 'text-[#3B82F6] font-medium' :
                  'text-[#4B5563]'
                )}>
                  {step.label}
                  {step.status === 'running' && (
                    <span className="ml-1 inline-flex gap-0.5">
                      {[0,150,300].map(d => (
                        <span key={d} className="inline-block h-1 w-1 rounded-full bg-[#3B82F6]"
                          style={{ animation: `pulse_dot 1.2s ${d}ms ease-in-out infinite` }} />
                      ))}
                    </span>
                  )}
                </span>

                {/* Duration */}
                {step.status === 'done' && step.duration && (
                  <span className="font-mono text-xs text-[#4B5563]">{step.duration}</span>
                )}
              </div>

              {/* Progress bar under running step */}
              {step.status === 'running' && (
                <div className="ml-9 mt-2">
                  <div className="progress-track" style={{ height: 4 }}>
                    <div
                      className="progress-fill bg-[#3B82F6] transition-all duration-700"
                      style={{ width: `${currentPct}%` }}
                    />
                  </div>
                  <p className="mt-1 flex justify-between text-[10px] text-[#4B5563]">
                    <span>Running...</span>
                    <span>{currentPct}%</span>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {allDone && (
          <div className="mt-5 flex items-center justify-center gap-2 border-t border-[#1F2937] pt-4 text-sm font-semibold text-[#22C55E]">
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
            All steps complete
          </div>
        )}
      </div>

      {!allDone && (
        <p className="mt-3 flex items-center gap-2 text-xs text-[#4B5563] italic">
          <span className="status-dot-blue" />
          Estimated time remaining: ~{Math.max(2, (steps.length - doneCount) * 2)} seconds
        </p>
      )}

      {/* ARQ Worker hint if not connected */}
      {!isConnected && (
        <div className="mt-3 rounded-md border border-[#EAB308]/20 bg-[#EAB308]/5 p-3">
          <p className="text-xs text-[#EAB308]">
            💡 For live step-by-step updates, start the ARQ worker in a new terminal:
          </p>
          <code className="mt-1 block text-[11px] text-[#6B7280]">
            cd backend && arq app.services.queue.jobs.WorkerSettings
          </code>
        </div>
      )}
    </div>
  )
}