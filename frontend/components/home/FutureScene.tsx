'use client'

import { useScrollReveal } from '@/components/home/utils'

const TIMELINE = [
  {
    phase: 'Today',
    title: 'Project Knowledge Intelligence',
    desc: 'RAG over all project documents, spec compliance, schedule risk prediction, and RFI resolution.',
    status: 'live',
    color: '#14B8A6',
  },
  {
    phase: 'Q4 2026',
    title: 'Digital Twin Integration',
    desc: 'Live BIM model synchronisation with as-built reality capture, commissioning status overlays.',
    status: 'planned',
    color: '#3B82F6',
  },
  {
    phase: 'Q1 2027',
    title: 'IoT & Sensor Intelligence',
    desc: 'Real-time sensor data from site — power, temperature, access — feeding into risk models.',
    status: 'planned',
    color: '#8B5CF6',
  },
  {
    phase: 'Q3 2027',
    title: 'Predictive Maintenance Pre-commissioning',
    desc: 'Failure mode analysis on equipment before it enters service, trained on pan-India EPC data.',
    status: 'future',
    color: '#F97316',
  },
  {
    phase: 'Q1 2028',
    title: 'Autonomous Project Intelligence',
    desc: 'AI agents that don\'t just recommend — they act. Vendor escalation, re-sequencing, milestone reporting — automated.',
    status: 'future',
    color: '#EAB308',
  },
]

export function FutureScene() {
  const { ref, vis } = useScrollReveal(0.05)

  return (
    <section id="future" className="relative bg-[#070E1D] py-24 overflow-hidden">

      {/* Subtle diagonal gradient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none" />

      <div ref={ref} className="relative z-10 max-w-5xl mx-auto px-6 lg:px-8">

        {/* Section label */}
        <div className={`mb-4 transition-all duration-700 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="inline-flex items-center gap-2 text-xs font-bold text-yellow-400 tracking-widest uppercase">
            <span className="w-6 h-px bg-yellow-400" />
            Future Vision
          </span>
        </div>

        <div className={`mb-12 transition-all duration-700 delay-100 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
            Today's foundation.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
              Tomorrow's ambition.
            </span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl">
            India's ₹1,25,000 Cr data centre buildout deserves intelligence that grows with it. This is our roadmap.
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[22px] top-0 bottom-0 w-px bg-gradient-to-b from-[#14B8A6] via-[#8B5CF6] to-transparent" />

          <div className="space-y-8">
            {TIMELINE.map((item, i) => (
              <div
                key={item.phase}
                className={`flex gap-6 transition-all duration-700 ${vis ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
                style={{ transitionDelay: `${200 + i * 120}ms` }}
              >
                {/* Node */}
                <div className="relative shrink-0">
                  <div
                    className="w-11 h-11 rounded-full border-2 flex items-center justify-center text-sm font-black"
                    style={{
                      borderColor: item.color,
                      backgroundColor: `${item.color}15`,
                      color: item.color,
                    }}
                  >
                    {item.status === 'live' ? '✓' : i + 1}
                  </div>
                  {item.status === 'live' && (
                    <div
                      className="absolute inset-0 rounded-full animate-ping"
                      style={{ backgroundColor: `${item.color}20` }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-1.5">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-mono font-bold" style={{ color: item.color }}>
                      {item.phase}
                    </span>
                    {item.status === 'live' && (
                      <span className="text-[10px] font-bold text-teal-400 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 uppercase tracking-wide">
                        Live
                      </span>
                    )}
                    {item.status === 'planned' && (
                      <span className="text-[10px] font-bold text-blue-400 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 uppercase tracking-wide">
                        Planned
                      </span>
                    )}
                    {item.status === 'future' && (
                      <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 uppercase tracking-wide">
                        Future
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">{item.title}</h3>
                  <p className="text-sm text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Closing quote */}
        <div className={`mt-14 text-center transition-all duration-700 delay-800 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <p className="text-lg font-semibold italic text-slate-400">
            "Today's projects deserve tomorrow's intelligence."
          </p>
        </div>
      </div>
    </section>
  )
}
