'use client'

import { useScrollReveal } from '@/components/home/utils'

const CAPABILITIES = [
  {
    id: 'spec',
    icon: '🔎',
    title: 'Specification & Quality Compliance',
    desc: 'Ingests thousands of pages of equipment specifications, design standards, and client requirements. Automatically checks procurement orders, vendor submittals, and shop drawings for deviations.',
    color: '#3B82F6',
    bright: 'Spec Compliance Agent',
  },
  {
    id: 'risk',
    icon: '📈',
    title: 'Predictive Schedule Risk Engine',
    desc: 'Multi-agent system analysing project schedules against real-time procurement status, equipment lead times, and workforce availability — identifying critical path risks weeks in advance.',
    color: '#F97316',
    bright: 'Risk Prediction Engine',
  },
  {
    id: 'supply',
    icon: '🌐',
    title: 'Supply Chain Visibility Agent',
    desc: 'Geospatial AI that tracks critical equipment shipments (UPS systems, generators, cooling towers) across multi-tier suppliers — alerting teams before they become critical path issues.',
    color: '#8B5CF6',
    bright: 'Supply Chain Tracker',
  },
  {
    id: 'commissioning',
    icon: '⚡',
    title: 'Commissioning Intelligence',
    desc: 'AI agent trained on TIA-942, BICSI, and Uptime Institute Tier specifications. Guides engineers through integrated system testing, auto-generates test records, flags non-conformances.',
    color: '#14B8A6',
    bright: 'Commissioning Copilot',
  },
  {
    id: 'knowledge',
    icon: '🧠',
    title: 'Project Knowledge & RFI Intelligence',
    desc: 'RAG-powered conversational layer over all project documents — specifications, submittals, RFIs, meeting minutes, change orders — answers technical queries in seconds with citations.',
    color: '#22C55E',
    bright: 'Knowledge Graph RAG',
  },
  {
    id: 'decisions',
    icon: '🤝',
    title: 'AI Decision Support',
    desc: 'Explainable AI recommendations backed by evidence trails. Every suggestion includes confidence score, supporting documents, and cascading impact analysis for enterprise trust.',
    color: '#EAB308',
    bright: 'Decision Intelligence',
  },
]

export function CapabilitiesScene() {
  const { ref, vis } = useScrollReveal(0.05)

  return (
    <section id="capabilities" className="relative bg-[#0A0F1E] py-24 overflow-hidden">

      {/* Subtle glow background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      <div ref={ref} className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">

        {/* Header */}
        <div className={`mb-4 transition-all duration-700 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="inline-flex items-center gap-2 text-xs font-bold text-teal-400 tracking-widest uppercase">
            <span className="w-6 h-px bg-teal-400" />
            Platform Capabilities
          </span>
        </div>

        <div className={`mb-4 transition-all duration-700 delay-100 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
            Six Capabilities.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#14B8A6] to-[#3B82F6]">
              One Platform.
            </span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl">
            Built specifically for Data Centre EPC complexity. Every capability is powered by
            {' '}<span className="text-teal-400 font-semibold">Bright AI</span>
            {' '}— the learning intelligence layer that gets smarter with every project.
          </p>
        </div>

        {/* Bright AI branding pill */}
        <div className={`mb-12 transition-all duration-700 delay-150 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full bg-teal-500/10 border border-teal-500/20">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#14B8A6] to-[#0EA5E9]">
              <span className="text-[10px] text-white font-black">B</span>
            </div>
            <span className="text-sm font-semibold text-teal-300">
              Project Impact Intelligence (PII) — powered by Bright AI
            </span>
            <span className="text-xs text-teal-500">· Learning with every project</span>
          </div>
        </div>

        {/* Capability cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {CAPABILITIES.map((cap, i) => (
            <div
              key={cap.id}
              className={`group relative p-6 rounded-2xl bg-[#111827] border border-[#1F2937] hover:border-opacity-60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{
                transitionDelay: `${200 + i * 80}ms`,
                borderColor: `${cap.color}20`,
              }}
            >
              {/* Color accent line */}
              <div className="absolute top-0 left-6 right-6 h-px" style={{ background: `linear-gradient(90deg, transparent, ${cap.color}60, transparent)` }} />

              {/* Top glow on hover */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at top, ${cap.color}08 0%, transparent 60%)` }}
              />

              {/* Icon */}
              <div className="text-3xl mb-4">{cap.icon}</div>

              {/* Title */}
              <h3 className="text-base font-bold text-white mb-2 leading-snug">{cap.title}</h3>

              {/* Description */}
              <p className="text-sm text-slate-400 leading-relaxed mb-4">{cap.desc}</p>

              {/* Bright AI tag */}
              <div className="flex items-center gap-1.5 mt-auto">
                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-[#14B8A6] to-[#0EA5E9]" />
                <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider">
                  Bright AI · {cap.bright}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Closing line */}
        <div className={`mt-12 text-center transition-all duration-700 delay-700 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <p className="text-lg font-semibold italic text-slate-400">
            "Six capabilities. One platform. Zero guesswork."
          </p>
        </div>
      </div>
    </section>
  )
}
