/**
 * components/upload/CompleteCard.tsx
 * ====================================
 * State 4 of 4 in the upload flow.
 *
 * Shows after all processing steps complete (WebSocket analysis_complete event).
 * Displays: task count, risk count, delay days discovered.
 * Starts a 5-second countdown then auto-redirects to /intelligence.
 * User can cancel the redirect or click "View now" to go immediately.
 *
 * BUG FIX 13: uses isMountedRef so the setTimeout never fires setState
 * on an unmounted component (avoids React "memory leak" warning).
 */
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface CompleteCardProps {
  tasksAnalysed: number
  risksDetected: number
  delayDays:     number
}

const COUNTDOWN_SECONDS = 5

export function CompleteCard({ tasksAnalysed, risksDetected, delayDays }: CompleteCardProps) {
  const router        = useRouter()
  const [secs, setSecs] = useState(COUNTDOWN_SECONDS)
  const cancelledRef  = useRef(false)  // true = user clicked "Stay here"
  const isMountedRef  = useRef(true)   // BUG FIX 13: track mount state

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  // Countdown + auto-redirect
  useEffect(() => {
    const interval = setInterval(() => {
      // BUG FIX 13: only update state if still mounted
      if (!isMountedRef.current) { clearInterval(interval); return }

      setSecs(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          if (!cancelledRef.current) router.push('/intelligence')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [router])

  // Progress bar fills from 0% → 100% over COUNTDOWN_SECONDS
  const progressPct = ((COUNTDOWN_SECONDS - secs) / COUNTDOWN_SECONDS) * 100

  return (
    <div className="animate-slide-in-up space-y-3">

      {/* ── Success card with stats ─────────────────────────────────────── */}
      <div className="card-panel border-[#22C55E] p-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-xl text-[#22C55E]">
            check_circle
          </span>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#22C55E]">
            Analysis Ready
          </p>
        </div>

        {/* What was found */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-white">
            <strong className="font-bold">{tasksAnalysed}</strong> tasks analysed
          </span>
          <span className="text-[#374151]">·</span>
          <span className="text-white">
            <strong className="font-bold">{risksDetected}</strong>{' '}
            risk{risksDetected !== 1 ? 's' : ''} detected
          </span>
          {delayDays > 0 && (
            <>
              <span className="text-[#374151]">·</span>
              <span className="text-white">
                <strong className="font-bold metric-red">+{delayDays}</strong> days delay
              </span>
            </>
          )}
        </div>

        {/* CTA — manual navigate (faster than countdown) */}
        <button
          onClick={() => { cancelledRef.current = true; router.push('/intelligence') }}
          className="btn-primary mt-4 w-full justify-center"
        >
          View Intelligence Dashboard
          <span className="material-symbols-outlined text-base">arrow_forward</span>
        </button>
      </div>

      {/* ── Countdown bar ────────────────────────────────────────────────── */}
      {secs > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#6B7280]">
              Auto-redirecting to Intelligence in {secs} second{secs !== 1 ? 's' : ''}...
            </p>
            <button
              onClick={() => { cancelledRef.current = true }}
              className="text-xs text-[#6B7280] underline hover:text-white"
            >
              Stay here
            </button>
          </div>
          {/* Blue bar fills left-to-right over 5 seconds */}
          <div className="progress-track mt-1.5" style={{ height: 3 }}>
            <div
              className="progress-fill bg-[#3B82F6] transition-all duration-1000"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
