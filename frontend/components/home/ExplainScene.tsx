'use client'

import { useScrollReveal } from '@/components/home/utils'

export function ExplainScene() {
  const { ref, vis } = useScrollReveal(0.05)

  return (
    <section className="relative bg-[#070E1D] py-24 overflow-hidden">

      {/* Center glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div ref={ref} className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">

        {/* Section label */}
        <div className={`mb-4 transition-all duration-700 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="inline-flex items-center gap-2 text-xs font-bold text-purple-400 tracking-widest uppercase">
            <span className="w-6 h-px bg-purple-400" />
            Explainability
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left */}
          <div className={`transition-all duration-700 delay-100 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
              Bright AI doesn't just
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">
                recommend.
              </span>
              <br />
              It{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#14B8A6] to-[#0EA5E9]">
                explains.
              </span>
            </h2>

            <p className="text-lg text-slate-400 leading-relaxed mb-8">
              Every recommendation from Bright AI is backed by evidence — the exact documents, dependencies, and schedule data that led to the conclusion. No black box. No blind trust.
            </p>

            <div className="space-y-4">
              {[
                { icon: '📋', title: 'Every recommendation cites its source documents' },
                { icon: '🔗', title: 'Dependency chains are fully traceable' },
                { icon: '📊', title: 'Confidence scores are calibrated to actual data quality' },
                { icon: '💬', title: 'Reasoning is written in plain language, not model jargon' },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
                  <span className="text-sm text-slate-300">{item.title}</span>
                </div>
              ))}
            </div>

            <p className="mt-10 text-base font-semibold italic text-slate-400 border-l-2 border-purple-400 pl-4">
              "AI that explains its reasoning earns trust."
            </p>
          </div>

          {/* Right: AI recommendation card */}
          <div className={`transition-all duration-700 delay-200 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="relative rounded-2xl bg-[#0C1322] border border-purple-500/20 overflow-hidden shadow-2xl shadow-purple-500/5">

              {/* Top accent */}
              <div className="h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

              <div className="p-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#14B8A6] to-[#0EA5E9] flex items-center justify-center">
                    <span className="text-[11px] font-black text-white">B</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Bright AI Recommendation</div>
                    <div className="text-[10px] text-slate-500">BLR-DC-01 · Generated Jul 20, 2026</div>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                    <span className="text-[10px] font-semibold text-teal-400">Active</span>
                  </div>
                </div>

                {/* Recommendation */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-teal-500/10 to-blue-500/10 border border-teal-500/20 mb-5">
                  <div className="text-[10px] font-semibold text-teal-400 uppercase tracking-widest mb-2">Recommendation</div>
                  <div className="text-lg font-bold text-white">Reschedule Commissioning — Phase 2A</div>
                  <div className="text-sm text-slate-400 mt-1">Delay LV Switchgear commissioning by 6 days; parallel-track Generator ATS testing to recover 2 days net.</div>
                </div>

                {/* Confidence */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400">Confidence</span>
                    <span className="text-sm font-extrabold text-[#14B8A6]">94%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#1F2937] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#14B8A6] to-[#0EA5E9] transition-all duration-1000"
                      style={{ width: vis ? '94%' : '0%' }}
                    />
                  </div>
                </div>

                {/* Evidence */}
                <div className="mb-5">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Evidence Trail</div>
                  <div className="space-y-2">
                    {[
                      { doc: 'Vendor Delay Notice', ref: 'BHP-EMAIL-20240718', type: '📧' },
                      { doc: 'Schedule Dependency Map', ref: 'SCH-REV12-2024', type: '📅' },
                      { doc: 'LV Commissioning Spec', ref: 'SPEC-ELEC-4.2', type: '📄' },
                    ].map(e => (
                      <div key={e.ref} className="flex items-center gap-2.5 p-2 rounded-lg bg-[#111827] border border-[#1F2937]">
                        <span className="text-sm">{e.type}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium text-slate-300 truncate">{e.doc}</div>
                          <div className="text-[10px] font-mono text-slate-500">{e.ref}</div>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-teal-500 shrink-0">
                          <path d="M2 6H10M7 3L10 6L7 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Impact */}
                <div className="p-3 rounded-xl bg-[#111827] border border-[#1F2937]">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Impact Assessment</div>
                  <div className="flex items-center justify-between">
                    <div className="text-center">
                      <div className="text-lg font-extrabold text-green-400">-6 days</div>
                      <div className="text-[9px] text-slate-500">Net delay</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-extrabold text-[#14B8A6]">₹0</div>
                      <div className="text-[9px] text-slate-500">Penalty avoided</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-extrabold text-blue-400">Tier IV</div>
                      <div className="text-[9px] text-slate-500">Cert. preserved</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
