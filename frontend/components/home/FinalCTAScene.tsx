'use client'

import Link from 'next/link'
import { NodeCanvas } from './NodeCanvas'
import { useScrollReveal } from '@/components/home/utils'

interface FinalCTASceneProps {
  onExploreDemo: () => void
  isDemoLoading: boolean
}

export function FinalCTAScene({ onExploreDemo, isDemoLoading }: FinalCTASceneProps) {
  const { ref, vis } = useScrollReveal(0.05)

  return (
    <section className="relative min-h-[80vh] flex items-center bg-[#0A0F1E] overflow-hidden py-24">

      {/* Full-section connected canvas */}
      <div className="absolute inset-0">
        <NodeCanvas mode="connected" nodeCount={60} interactive className="opacity-40" />
      </div>

      {/* Dark overlay to keep text readable */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1E] via-[#0A0F1E]/60 to-transparent pointer-events-none" />

      <div ref={ref} className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">

        {/* Tag */}
        <div className={`mb-8 transition-all duration-700 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#14B8A6] to-[#0EA5E9] flex items-center justify-center">
              <span className="text-[9px] font-black text-white">B</span>
            </div>
            <span className="text-sm font-semibold text-teal-300">
              Project Impact Intelligence (PII) · powered by Bright AI
            </span>
          </div>
        </div>

        {/* Main message */}
        <h2
          className={`text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6 transition-all duration-700 delay-100 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          The future of project delivery
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#14B8A6] to-[#0EA5E9]">
            isn't more dashboards.
          </span>
          <br />
          It's{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]">
            better decisions.
          </span>
        </h2>

        <p className={`text-xl text-slate-400 leading-relaxed mb-12 max-w-2xl mx-auto transition-all duration-700 delay-200 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          Experience how enterprise intelligence transforms data centre EPC delivery.
          One click. No signup needed.
        </p>

        {/* CTAs */}
        <div className={`flex flex-wrap justify-center gap-4 transition-all duration-700 delay-300 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <button
            onClick={onExploreDemo}
            disabled={isDemoLoading}
            className="inline-flex items-center gap-3 px-8 py-4 text-base font-bold text-white
                       bg-gradient-to-r from-[#14B8A6] to-[#0EA5E9] rounded-2xl
                       shadow-2xl shadow-teal-500/30 hover:shadow-teal-500/50
                       hover:scale-[1.03] active:scale-[0.98]
                       transition-all duration-200 disabled:opacity-70"
          >
            {isDemoLoading ? (
              <>
                <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Loading Experience…
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="8" stroke="white" strokeWidth="1.5" fill="none"/>
                  <path d="M8 7L13 10L8 13V7Z" fill="white"/>
                </svg>
                Experience Project Impact Intelligence
              </>
            )}
          </button>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-slate-300
                       border border-slate-700 rounded-2xl hover:border-slate-500 hover:text-white
                       hover:bg-white/5 transition-all"
          >
            Sign In
          </Link>
        </div>

        {/* Final micro-copy */}
        <div className={`mt-12 flex justify-center gap-8 transition-all duration-700 delay-500 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {[
            '⚡ Instant demo — no signup',
            '🔒 No data required',
            '🏆 ET AI Hackathon 2.0',
          ].map(item => (
            <div key={item} className="text-xs text-slate-500 font-medium">{item}</div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-xs text-slate-600">
          Project Impact Intelligence © 2026
          <span className="mx-2">·</span>
          Built for ET AI Hackathon 2.0
          <span className="mx-2">·</span>
          <span className="text-teal-600">Powered by Bright AI</span>
        </p>
      </div>
    </section>
  )
}
