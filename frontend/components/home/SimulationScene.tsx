'use client'

import { useState, useEffect } from 'react'
import { useScrollReveal } from '@/components/home/utils'

function AnimatedCounter({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0)
  const { ref, vis } = useScrollReveal()
  useEffect(() => {
    if (!vis) return
    let start: number
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setVal(Math.floor(p * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [vis, target, duration])
  return <span ref={ref}>{val}</span>
}

const METRICS = [
  { label: 'Documents Indexed',    value: 1247, suffix: '',   color: '#3B82F6' },
  { label: 'Risk Flags Today',     value: 34,   suffix: '',   color: '#EF4444' },
  { label: 'Schedule Confidence',  value: 94,   suffix: '%',  color: '#14B8A6' },
  { label: 'Bright AI Queries',    value: 892,  suffix: '',   color: '#8B5CF6' },
]

const TIMELINE = [
  { date: 'Jul 20', task: 'UPS Delivery — Vendor Bharat Power',  status: 'delayed',   risk: 'HIGH' },
  { date: 'Jul 28', task: 'Cooling Tower Installation',           status: 'on-track',  risk: 'LOW'  },
  { date: 'Aug 05', task: 'LV Switchgear Commissioning Test',    status: 'at-risk',   risk: 'MED'  },
  { date: 'Aug 12', task: 'Tier IV Certification Audit',          status: 'on-track',  risk: 'LOW'  },
]

const STATUS_STYLES: Record<string, string> = {
  'delayed':  'bg-red-500/10 text-red-400 border-red-500/30',
  'on-track': 'bg-green-500/10 text-green-400 border-green-500/30',
  'at-risk':  'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
}

const RISK_STYLES: Record<string, string> = {
  HIGH: 'text-red-400',
  MED:  'text-yellow-400',
  LOW:  'text-green-400',
}

export function SimulationScene() {
  const { ref, vis } = useScrollReveal(0.05)
  const [activeRow, setActiveRow] = useState<number | null>(null)

  return (
    <section id="command-center" className="relative bg-[#070E1D] py-24 overflow-hidden">

      {/* Grid bg */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(20,184,166,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(20,184,166,0.06) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div ref={ref} className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">

        {/* Header */}
        <div className={`mb-4 transition-all duration-700 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="inline-flex items-center gap-2 text-xs font-bold text-teal-400 tracking-widest uppercase">
            <span className="w-6 h-px bg-teal-400" />
            Command Center Preview
          </span>
        </div>

        <div className={`mb-12 transition-all duration-700 delay-100 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
            This is what the{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#14B8A6] to-[#3B82F6]">
              Command Center
            </span>
            {' '}feels like.
          </h2>
          <p className="text-slate-400 text-lg">
            Not a dashboard. A mission-critical operations interface. Hover the timeline to see Bright AI respond.
          </p>
        </div>

        {/* Simulated Command Center UI */}
        <div className={`rounded-2xl bg-[#0C1322] border border-[#1F2937] overflow-hidden shadow-2xl transition-all duration-700 delay-200 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* Window chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1F2937] bg-[#0A0F1E]">
            <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#EAB308]/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E]/70" />
            <div className="ml-4 flex-1">
              <div className="mx-auto w-64 h-5 rounded bg-[#111827] flex items-center justify-center">
                <span className="text-[10px] text-slate-500 font-mono">pii.ai / command-center / BLR-DC-01</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-slate-500">Live</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-0">

            {/* Metrics */}
            <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-px border-b border-[#1F2937]">
              {METRICS.map(m => (
                <div key={m.label} className="p-5 bg-[#0C1322] text-center hover:bg-[#111827] transition-colors cursor-default">
                  <div className="text-3xl font-extrabold mb-1" style={{ color: m.color }}>
                    <AnimatedCounter target={m.value} />
                    {m.suffix}
                  </div>
                  <div className="text-[11px] text-slate-500">{m.label}</div>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="lg:col-span-2 p-6 border-r border-[#1F2937]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">Project Schedule — Critical Path</h3>
                <span className="text-[10px] text-slate-500 font-mono">BLR-DC-01 · Phase 1</span>
              </div>
              <div className="space-y-3">
                {TIMELINE.map((row, i) => (
                  <div
                    key={i}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                      activeRow === i ? 'border-teal-500/40 bg-teal-500/5' : 'border-[#1F2937] bg-[#0A0F1E] hover:border-[#374151]'
                    }`}
                    onMouseEnter={() => setActiveRow(i)}
                    onMouseLeave={() => setActiveRow(null)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-slate-500 shrink-0 w-12">{row.date}</span>
                        <span className="text-sm font-medium text-slate-300">{row.task}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <span className={`text-[10px] font-bold ${RISK_STYLES[row.risk]}`}>{row.risk}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[row.status]}`}>
                          {row.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bright AI panel */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#14B8A6] to-[#0EA5E9] flex items-center justify-center">
                  <span className="text-[9px] text-white font-black">B</span>
                </div>
                <span className="text-sm font-bold text-white">Bright AI</span>
                <span className="ml-auto text-[10px] text-teal-400 font-semibold">94% confidence</span>
              </div>

              {activeRow !== null ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
                    <div className="text-[10px] font-semibold text-teal-400 mb-1">⚡ Analysis</div>
                    <p className="text-xs text-slate-300">
                      {activeRow === 0 && 'UPS delay from Bharat Power (3 units, 6-day slip) creates cascade risk to LV Switchgear commissioning. Critical path impact confirmed.'}
                      {activeRow === 1 && 'Cooling Tower installation is on schedule. Vendor Voltas confirmed site access for Jul 28. No blocking dependencies detected.'}
                      {activeRow === 2 && 'LV Switchgear test at risk due to UPS delay dependency. Recommend parallel commissioning of Genset ATS first to recover 2 days.'}
                      {activeRow === 3 && 'Tier IV audit on track. 847 of 892 pre-commissioning tests passed. 45 outstanding — completion by Aug 09 projected.'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#111827] border border-[#1F2937]">
                    <div className="text-[10px] font-semibold text-slate-400 mb-1">Evidence</div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-500">📄 UPS-PO-2024-089.pdf</div>
                      <div className="text-[10px] text-slate-500">📧 Vendor delay notice (Jul 18)</div>
                      <div className="text-[10px] text-slate-500">📅 Schedule Rev.12 (Jul 20)</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <div className="text-2xl mb-3">🤖</div>
                  <p className="text-sm text-slate-500">Hover a task to see</p>
                  <p className="text-sm font-semibold text-teal-400">Bright AI analysis</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Closing line */}
        <div className={`mt-10 text-center transition-all duration-700 delay-500 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <p className="text-lg font-semibold italic text-slate-400">
            "Better decisions begin before problems happen."
          </p>
        </div>
      </div>
    </section>
  )
}
