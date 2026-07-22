'use client'

import { NodeCanvas } from './NodeCanvas'
import { useScrollReveal } from '@/components/home/utils'

const CONNECTION_STEPS = [
  { icon: '📄', label: 'Spec Document',     color: '#3B82F6' },
  { icon: '⚙️', label: 'Equipment List',    color: '#8B5CF6' },
  { icon: '🏭', label: 'Vendor Submittals', color: '#F97316' },
  { icon: '🔍', label: 'Inspection Record', color: '#EAB308' },
  { icon: '📅', label: 'Schedule Impact',   color: '#14B8A6' },
  { icon: '⚠️', label: 'Risk Flag',         color: '#EF4444' },
  { icon: '🤖', label: 'AI Recommendation', color: '#22C55E' },
]

export function TransformScene() {
  const { ref, vis } = useScrollReveal(0.1)

  return (
    <section id="transform" className="relative min-h-screen flex items-center overflow-hidden py-24 bg-gradient-to-b from-slate-50 to-slate-900">

      {/* Canvas fills the section */}
      <div className="absolute inset-0">
        <NodeCanvas mode="connecting" nodeCount={55} interactive={false} className="opacity-30" />
      </div>

      {/* Dark overlay gradient that increases downward */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/30 to-slate-900/70 pointer-events-none" />

      <div ref={ref} className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full">

        {/* Section label */}
        <div className={`mb-4 transition-all duration-700 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="inline-flex items-center gap-2 text-xs font-bold text-teal-400 tracking-widest uppercase">
            <span className="w-6 h-px bg-teal-400" />
            The Transformation
          </span>
        </div>

        <div className="max-w-3xl">
          <h2 className={`text-4xl lg:text-5xl font-extrabold leading-tight mb-6 transition-all duration-700 delay-100 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <span className="text-white">From fragmented files</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#14B8A6] to-[#3B82F6]">
              to connected project intelligence.
            </span>
          </h2>

          <p className={`text-lg text-slate-300 leading-relaxed mb-12 transition-all duration-700 delay-200 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            Watch as Project Impact Intelligence connects every document, vendor, equipment item, and inspection record — forming a living knowledge graph that sees what humans miss.
          </p>
        </div>

        {/* Connection flow */}
        <div className={`flex flex-wrap gap-3 items-center transition-all duration-700 delay-300 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {CONNECTION_STEPS.map((step, i) => (
            <div key={step.label} className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-white/5 backdrop-blur-sm"
                style={{ borderColor: `${step.color}40`, boxShadow: `0 0 12px ${step.color}20` }}
              >
                <span className="text-base">{step.icon}</span>
                <span className="text-sm font-semibold text-white">{step.label}</span>
              </div>
              {i < CONNECTION_STEPS.length - 1 && (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-teal-400 shrink-0">
                  <path d="M4 10H16M12 6L16 10L12 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          ))}
        </div>

        {/* Closing quote */}
        <div className={`mt-16 transition-all duration-700 delay-500 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-xl font-semibold italic text-slate-300 border-l-2 border-teal-400 pl-6">
            "Information becomes intelligence only when connected."
          </p>
        </div>
      </div>
    </section>
  )
}
