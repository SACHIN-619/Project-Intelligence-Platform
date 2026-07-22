'use client'

import { useScrollReveal } from '@/components/home/utils'

const LAYERS = [
  {
    id: 'users',
    label: 'Project Teams',
    sub: 'EPC Managers · Engineers · QA · Commissioning',
    icon: '👤',
    color: '#60A5FA',
  },
  {
    id: 'knowledge',
    label: 'Knowledge Layer',
    sub: 'Specs · RFIs · Submittals · Meeting Notes · Change Orders',
    icon: '🗂️',
    color: '#14B8A6',
  },
  {
    id: 'decision',
    label: 'Decision Layer',
    sub: 'Risk Engine · Schedule Analyser · Compliance Checker',
    icon: '⚡',
    color: '#8B5CF6',
  },
  {
    id: 'ai',
    label: 'Bright AI Layer',
    sub: 'RAG · Multi-Agent · Knowledge Graph · Reasoning Engine',
    icon: '🤖',
    color: '#14B8A6',
  },
  {
    id: 'workflow',
    label: 'Workflow Layer',
    sub: 'Alerts · Approvals · Escalations · Notifications',
    icon: '🔄',
    color: '#F97316',
  },
  {
    id: 'analytics',
    label: 'Analytics & Reporting',
    sub: 'Dashboards · Audit Trail · Commissioning Packages · Insights',
    icon: '📊',
    color: '#22C55E',
  },
]

export function ArchitectureScene() {
  const { ref, vis } = useScrollReveal(0.05)

  return (
    <section id="architecture" className="relative bg-[#0A0F1E] py-24 overflow-hidden">

      <div ref={ref} className="relative z-10 max-w-5xl mx-auto px-6 lg:px-8">

        {/* Section label */}
        <div className={`mb-4 text-center transition-all duration-700 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="inline-flex items-center gap-2 text-xs font-bold text-blue-400 tracking-widest uppercase">
            <span className="w-6 h-px bg-blue-400" />
            Platform Architecture
            <span className="w-6 h-px bg-blue-400" />
          </span>
        </div>

        <div className={`mb-12 text-center transition-all duration-700 delay-100 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
            Built to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              scale
            </span>
            {' '}with the project.
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Six architectural layers, each with a single purpose. Together they form the intelligence layer India's data centre projects need.
          </p>
        </div>

        {/* Layer stack */}
        <div className="space-y-2">
          {LAYERS.map((layer, i) => (
            <div
              key={layer.id}
              className={`flex items-center gap-5 p-4 rounded-xl border bg-[#0C1322] transition-all duration-500 hover:-translate-x-1 hover:shadow-lg ${vis ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
              style={{
                transitionDelay: `${150 + i * 100}ms`,
                borderColor: `${layer.color}25`,
                boxShadow: vis ? `inset -3px 0 0 ${layer.color}50` : 'none',
              }}
            >
              {/* Layer number */}
              <div className="w-6 text-center text-xs font-mono text-slate-600 shrink-0">
                L{i + 1}
              </div>

              {/* Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
                style={{ background: `${layer.color}15`, border: `1px solid ${layer.color}25` }}
              >
                {layer.icon}
              </div>

              {/* Labels */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">{layer.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">{layer.sub}</div>
              </div>

              {/* Color indicator */}
              <div className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: `${layer.color}60` }} />
            </div>
          ))}
        </div>

        {/* Judging criteria match */}
        <div className={`mt-12 p-6 rounded-2xl bg-[#0C1322] border border-[#1F2937] transition-all duration-700 delay-700 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Evaluation Criteria Coverage</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Innovation',          pct: '25%', color: '#14B8A6' },
              { label: 'Business Impact',     pct: '25%', color: '#3B82F6' },
              { label: 'Technical Excellence',pct: '20%', color: '#8B5CF6' },
              { label: 'Scalability',         pct: '15%', color: '#F97316' },
              { label: 'User Experience',     pct: '15%', color: '#22C55E' },
            ].map(c => (
              <div key={c.label} className="text-center">
                <div className="text-xl font-extrabold mb-1" style={{ color: c.color }}>{c.pct}</div>
                <div className="text-[10px] text-slate-500">{c.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Closing quote */}
        <div className={`mt-10 text-center transition-all duration-700 delay-800 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <p className="text-lg font-semibold italic text-slate-400">
            "Enterprise intelligence starts with trustworthy foundations."
          </p>
        </div>
      </div>
    </section>
  )
}
