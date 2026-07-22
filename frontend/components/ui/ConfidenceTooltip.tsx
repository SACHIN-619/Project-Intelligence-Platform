// components/ui/ConfidenceTooltip.tsx
// Shows when AI confidence is 0% or very low
// Explains what's happening and how to fix it
'use client'

import { useState } from 'react'

export function ConfidenceTooltip({ confidence }: { confidence: number }) {
  const [open, setOpen] = useState(false)

  if (confidence > 0.1) return null  // Only show when confidence is suspiciously low

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className="ml-1.5 flex items-center gap-0.5 rounded text-[10px]
                   text-[#EAB308] hover:underline"
      >
        <span className="material-symbols-outlined text-xs">help</span>
        Why 0%?
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-6 z-40 w-72 rounded-xl border
                          border-[#EAB308]/30 bg-[#111827] p-4 shadow-2xl">
            <p className="mb-2 text-xs font-bold text-[#EAB308]">
              Why is AI Confidence 0%?
            </p>
            <div className="flex flex-col gap-2 text-xs text-[#9CA3AF]">
              <p>Confidence is 0% when embeddings haven't been generated yet. This happens when:</p>
              <div className="rounded-lg bg-[#0A0F1E] p-3">
                <p className="font-medium text-white">Most likely cause:</p>
                <p className="mt-1">The BGE embedding model is downloading for the first time (~130MB). This takes 1-2 minutes on first run.</p>
              </div>
              <div className="rounded-lg bg-[#0A0F1E] p-3">
                <p className="font-medium text-white">Fix:</p>
                <code className="mt-1 block text-[10px] text-[#3B82F6]">
                  cd backend{'\n'}
                  arq app.services.queue.jobs.WorkerSettings
                </code>
                <p className="mt-1">Re-upload the file after the worker starts.</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="mt-3 text-xs text-[#3B82F6] hover:underline"
            >
              Got it ✓
            </button>
          </div>
        </>
      )}
    </div>
  )
}