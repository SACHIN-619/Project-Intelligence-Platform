'use client'

import { useScrollReveal } from '@/components/home/utils'

const TRADITIONAL = [
  'Manual vendor follow-up calls',
  'Email chains across 8 teams',
  'Spreadsheet status updates',
  'Late discovery (2 weeks)',
  'Emergency re-sequencing meeting',
  'Commissioning delayed — 3 weeks',
]

const PII_STEPS = [
  'Detects UPS delivery slip (Day 1)',
  'Identifies 7 impacted systems',
  'Recalculates critical path',
  'Generates 3 recovery scenarios',
  'Auto-alerts stakeholders',
  '6-day delay recovered ✓',
]

export function ScenarioScene() {
  const { ref, vis } = useScrollReveal(0.05)

  return (
    <section id="scenario" className="relative bg-[#0A0F1E] py-24 overflow-hidden">

      {/* Side glow */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-64 h-96 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-64 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      <div ref={ref} className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">

        {/* Header */}
        <div className={`mb-4 transition-all duration-700 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="inline-flex items-center gap-2 text-xs font-bold text-orange-400 tracking-widest uppercase">
            <span className="w-6 h-px bg-orange-400" />
            Real Business Scenario
          </span>
        </div>

        <div className={`mb-12 transition-all duration-700 delay-100 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
            UPS vendor delays delivery.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
              What happens next?
            </span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl">
            This isn't a hypothetical. It's the most common commissioning failure in Data Centre EPC projects — and most teams discover it two weeks too late.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">

          {/* Traditional */}
          <div className={`transition-all duration-700 delay-200 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="rounded-2xl bg-[#0C1322] border border-red-500/20 overflow-hidden">
              <div className="px-6 py-4 border-b border-red-500/20 bg-red-500/5 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1L13 12H1L7 1Z" stroke="#EF4444" strokeWidth="1.5" fill="none"/>
                    <path d="M7 5V8M7 9.5V10" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-red-400 uppercase tracking-wide">Traditional Process</div>
                  <div className="text-[10px] text-slate-500">Without Project Impact Intelligence</div>
                </div>
              </div>
              <div className="p-6 space-y-3">
                {TRADITIONAL.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#0A0F1E] border border-[#1F2937]"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="w-5 h-5 rounded-full border border-red-500/40 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-red-400">{i + 1}</span>
                    </div>
                    <span className="text-sm text-slate-400">{step}</span>
                    {i === TRADITIONAL.length - 1 && (
                      <span className="ml-auto text-[10px] font-bold text-red-500 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30">
                        FAIL
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-red-500/20">
                <div className="text-center">
                  <div className="text-2xl font-extrabold text-red-400">+21 days</div>
                  <div className="text-xs text-slate-500 mt-0.5">Schedule overrun</div>
                </div>
              </div>
            </div>
          </div>

          {/* PII */}
          <div className={`transition-all duration-700 delay-300 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="rounded-2xl bg-[#0C1322] border border-teal-500/20 overflow-hidden">
              <div className="px-6 py-4 border-b border-teal-500/20 bg-teal-500/5 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#14B8A6] to-[#0EA5E9] flex items-center justify-center">
                  <span className="text-[10px] font-black text-white">B</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-teal-400 uppercase tracking-wide">Project Impact Intelligence</div>
                  <div className="text-[10px] text-slate-500">Powered by Bright AI</div>
                </div>
              </div>
              <div className="p-6 space-y-3">
                {PII_STEPS.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#0A0F1E] border border-teal-500/10"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="w-5 h-5 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center shrink-0">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4 7L8 3" stroke="#14B8A6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="text-sm text-slate-300">{step}</span>
                    {i === PII_STEPS.length - 1 && (
                      <span className="ml-auto text-[10px] font-bold text-teal-400 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30">
                        RECOVERED
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-teal-500/20">
                <div className="text-center">
                  <div className="text-2xl font-extrabold text-teal-400">6-day recovery</div>
                  <div className="text-xs text-slate-500 mt-0.5">Detected before it became critical</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Closing quote */}
        <div className={`mt-12 text-center transition-all duration-700 delay-500 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <p className="text-lg font-semibold italic text-slate-400">
            "Intelligence cannot exist in isolated systems."
          </p>
        </div>
      </div>
    </section>
  )
}
