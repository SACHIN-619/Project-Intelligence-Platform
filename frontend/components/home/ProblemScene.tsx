'use client'

import { useScrollReveal } from '@/components/home/utils'

const FRAGMENTS = [
  { label: 'Excel Trackers',   icon: '📊', x: '8%',   y: '20%' },
  { label: 'PDF Specs',        icon: '📄', x: '75%',  y: '12%' },
  { label: 'Email Threads',    icon: '📧', x: '55%',  y: '55%' },
  { label: 'Vendor Portals',   icon: '🏭', x: '20%',  y: '65%' },
  { label: 'Inspection Logs',  icon: '🔍', x: '80%',  y: '70%' },
  { label: 'RFI Documents',    icon: '📋', x: '38%',  y: '25%' },
  { label: 'Meeting Notes',    icon: '📝', x: '5%',   y: '80%' },
]

export function ProblemScene() {
  const { ref, vis } = useScrollReveal()

  return (
    <section className="relative min-h-screen flex items-center bg-gradient-to-b from-white to-slate-50 overflow-hidden py-24">

      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full">

        {/* Section label */}
        <div ref={ref} className={`mb-4 transition-all duration-700 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="inline-flex items-center gap-2 text-xs font-bold text-red-500 tracking-widest uppercase">
            <span className="w-6 h-px bg-red-400" />
            The Problem
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: headline */}
          <div className={`transition-all duration-700 delay-100 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight mb-6">
              Projects don't fail because
              of{' '}
              <span className="text-slate-400">missing data.</span>
              <br />
              They fail because critical knowledge
              is{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                scattered.
              </span>
            </h2>

            <p className="text-lg text-slate-500 leading-relaxed mb-8">
              A single hyperscale data centre involves <strong className="text-slate-700">15,000–40,000 equipment line items</strong>, 200 concurrent contractors, and thousands of commissioning test procedures — all with zero tolerance for errors.
            </p>

            <div className="space-y-4 mb-8">
              {[
                { stat: '67%',    desc: 'of Asia-Pacific data centre EPC projects experienced schedule overruns exceeding 10%', src: 'Turner & Townsend 2024' },
                { stat: '40,000', desc: 'equipment line items in a single hyperscale facility — no single team can track manually', src: 'JLL 2025 Report' },
                { stat: '₹100 Cr+', desc: 'average cost impact of a commissioning failure in a Tier IV facility', src: 'Industry Estimate' },
              ].map(item => (
                <div key={item.stat} className="flex items-start gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="text-2xl font-extrabold text-red-500 shrink-0 w-20">{item.stat}</div>
                  <div>
                    <p className="text-sm text-slate-600">{item.desc}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{item.src}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Closing line */}
            <p className="text-base font-semibold italic text-slate-500 border-l-2 border-red-400 pl-4">
              "Delays begin long before deadlines are missed."
            </p>
          </div>

          {/* Right: fragmented systems visualization */}
          <div className={`transition-all duration-700 delay-200 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="relative h-[480px] rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 overflow-hidden">

              {/* Center "no connection" icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-red-200 border-dashed flex items-center justify-center bg-white shadow-lg">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <circle cx="14" cy="14" r="12" stroke="#EF4444" strokeWidth="2"/>
                      <path d="M9 14H19M14 9V19" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M8 8L20 20" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[11px] font-bold text-red-500 whitespace-nowrap">
                    No Connection
                  </div>
                </div>
              </div>

              {/* Floating fragment tiles */}
              {FRAGMENTS.map((f, i) => (
                <div
                  key={f.label}
                  className="absolute bg-white rounded-xl border border-red-100 shadow-md px-3 py-2 flex items-center gap-2"
                  style={{
                    left: f.x,
                    top: f.y,
                    animation: `float-fragment ${3 + i * 0.4}s ease-in-out infinite alternate`,
                    animationDelay: `${i * 0.3}s`,
                  }}
                >
                  <span className="text-base">{f.icon}</span>
                  <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">{f.label}</span>
                </div>
              ))}

              {/* Red dashed lines to show disconnection */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.2 }}>
                <defs>
                  <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#EF4444"/>
                  </marker>
                </defs>
                <line x1="15%" y1="30%" x2="45%" y2="47%" stroke="#EF4444" strokeWidth="1" strokeDasharray="4,4"/>
                <line x1="82%" y1="25%" x2="55%" y2="47%" stroke="#EF4444" strokeWidth="1" strokeDasharray="4,4"/>
                <line x1="60%" y1="60%" x2="53%" y2="50%" stroke="#EF4444" strokeWidth="1" strokeDasharray="4,4"/>
              </svg>

              {/* Label */}
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <span className="text-xs font-semibold text-red-400 uppercase tracking-widest">
                  Fragmented · Disconnected · Invisible
                </span>
              </div>
            </div>

            {/* Bottom stat */}
            <div className="mt-4 p-4 rounded-xl bg-white border border-red-100 text-center">
              <p className="text-sm font-medium text-slate-600">
                Every delay begins with{' '}
                <strong className="text-red-500">disconnected information.</strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Float animation */}
      <style>{`
        @keyframes float-fragment {
          0%   { transform: translateY(0px) rotate(-1deg); }
          100% { transform: translateY(-10px) rotate(1deg); }
        }
      `}</style>
    </section>
  )
}
