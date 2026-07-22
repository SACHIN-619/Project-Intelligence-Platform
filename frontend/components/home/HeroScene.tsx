'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// ── Typing effect hook ────────────────────────────────────────────────────────
function useTypewriter(phrases: string[], speed = 60, pause = 2200) {
  const [displayed, setDisplayed] = useState('')
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [charIdx, setCharIdx]     = useState(0)
  const [deleting, setDeleting]   = useState(false)

  useEffect(() => {
    const current = phrases[phraseIdx]
    let timeout: ReturnType<typeof setTimeout>

    if (!deleting && charIdx <= current.length) {
      timeout = setTimeout(() => {
        setDisplayed(current.slice(0, charIdx))
        setCharIdx(i => i + 1)
      }, speed)
    } else if (!deleting && charIdx > current.length) {
      timeout = setTimeout(() => setDeleting(true), pause)
    } else if (deleting && charIdx > 0) {
      timeout = setTimeout(() => {
        setDisplayed(current.slice(0, charIdx - 1))
        setCharIdx(i => i - 1)
      }, speed / 2)
    } else if (deleting && charIdx === 0) {
      setDeleting(false)
      setPhraseIdx(i => (i + 1) % phrases.length)
    }

    return () => clearTimeout(timeout)
  }, [charIdx, deleting, phraseIdx, phrases, speed, pause])

  return displayed
}

// ── Scroll-reveal hook ────────────────────────────────────────────────────────
function useScrollReveal(threshold = 0.15) {
  const ref  = useRef<HTMLDivElement>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVis(true); obs.disconnect() }
    }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, vis }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene 1: Hero
// ─────────────────────────────────────────────────────────────────────────────
interface HeroSceneProps {
  onExploreDemo: () => void
  isDemoLoading: boolean
}

const TYPING_PHRASES = [
  'Specification Compliance',
  'Schedule Risk Prediction',
  'Supply Chain Visibility',
  'Commissioning Intelligence',
  'Knowledge Graph Queries',
]

// Lightweight SVG graph for the right panel
function LiveGraphViz() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % 7), 900)
    return () => clearInterval(t)
  }, [])

  const nodes = [
    { x: 50,  y: 50,  label: 'Project',     color: '#14B8A6' },
    { x: 82,  y: 22,  label: 'Documents',   color: '#3B82F6' },
    { x: 82,  y: 78,  label: 'Schedule',    color: '#3B82F6' },
    { x: 50,  y: 15,  label: 'Vendors',     color: '#8B5CF6' },
    { x: 18,  y: 30,  label: 'Risk Engine', color: '#F97316' },
    { x: 18,  y: 70,  label: 'AI Layer',    color: '#14B8A6' },
    { x: 50,  y: 85,  label: 'Decision',    color: '#22C55E' },
  ]

  const edges = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 3], [2, 6], [4, 5], [5, 6]
  ]

  return (
    <div className="relative w-full h-full">
      <svg viewBox="0 0 100 100" className="w-full h-full" style={{ overflow: 'visible' }}>
        {/* Edges */}
        {edges.map(([a, b], i) => {
          const visible = i <= step * 1.5
          return (
            <line
              key={i}
              x1={`${nodes[a].x}%`} y1={`${nodes[a].y}%`}
              x2={`${nodes[b].x}%`} y2={`${nodes[b].y}%`}
              stroke={visible ? nodes[a].color : 'transparent'}
              strokeWidth="0.5"
              strokeOpacity={visible ? 0.4 : 0}
              style={{ transition: 'stroke-opacity 0.6s ease' }}
            />
          )
        })}

        {/* Nodes */}
        {nodes.map((n, i) => {
          const active = i <= step
          return (
            <g key={i} transform={`translate(${n.x} ${n.y})`}>
              {active && (
                <circle r="4" fill={n.color} opacity="0.15">
                  <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.15;0.05;0.15" dur="2s" repeatCount="indefinite"/>
                </circle>
              )}
              <circle
                r={active ? '3' : '1.5'}
                fill={active ? n.color : '#334155'}
                style={{ transition: 'all 0.5s ease' }}
              />
              {active && (
                <text
                  textAnchor="middle"
                  dy="-5"
                  fontSize="4"
                  fill={n.color}
                  opacity="0.9"
                  fontFamily="Inter, sans-serif"
                >
                  {n.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function HeroScene({ onExploreDemo, isDemoLoading }: HeroSceneProps) {
  const typed = useTypewriter(TYPING_PHRASES)
  const { ref: heroRef, vis } = useScrollReveal(0)

  return (
    <section className="relative min-h-screen flex items-center bg-gradient-to-br from-slate-50 via-white to-sky-50/30 overflow-hidden pt-16">

      {/* Subtle grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(20,184,166,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(20,184,166,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Radial soft glows */}
      <div className="absolute top-1/4 left-0 w-[600px] h-[600px] bg-teal-400/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-sky-400/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center min-h-[calc(100vh-4rem)]">

          {/* Left: copy */}
          <div ref={heroRef} className={`transition-all duration-1000 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-700 tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              ET AI Hackathon 2.0 · Data Centre EPC Intelligence
            </div>

            {/* Main headline */}
            <h1 className="text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.08] tracking-tight mb-6">
              Deliver Data Centres<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#14B8A6] to-[#0EA5E9]">
                with Intelligence,
              </span>
              <br />not Guesswork.
            </h1>

            {/* Typing subtitle */}
            <div className="mb-3 flex items-center gap-2 text-base font-medium text-slate-500">
              <span>AI-powered</span>
              <span className="text-[#14B8A6] font-semibold min-w-[280px]">
                {typed}
                <span className="animate-pulse text-[#14B8A6]">|</span>
              </span>
            </div>

            <p className="text-slate-500 text-lg leading-relaxed mb-2">
              The Enterprise Project Intelligence Platform for Data Centre EPC delivery.
            </p>

            {/* Branding line */}
            <div className="mb-10 flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-400">
                Project Impact Intelligence (PII)
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-sm font-bold text-[#14B8A6]">
                powered by Bright AI
              </span>
              <span className="inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-[10px] font-bold text-teal-600 tracking-widest uppercase">
                ✦ Live
              </span>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-x-8 gap-y-4 mb-10">
              {[
                { v: '$15B+', l: 'Capital Deployment' },
                { v: '2,700 MW', l: 'Capacity by 2027' },
                { v: '67%',  l: 'Projects Behind Schedule' },
              ].map(s => (
                <div key={s.v}>
                  <div className="text-2xl font-extrabold text-slate-900">{s.v}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onExploreDemo}
                disabled={isDemoLoading}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 text-sm font-bold text-white
                           bg-gradient-to-r from-[#14B8A6] to-[#0EA5E9] rounded-xl shadow-lg shadow-teal-500/25
                           hover:shadow-teal-500/40 hover:scale-[1.02] active:scale-[0.98]
                           transition-all duration-200 disabled:opacity-70"
              >
                {isDemoLoading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Loading Demo…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 1L15 8L8 15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M1 8H15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Explore Live Project
                  </>
                )}
              </button>

              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-slate-700
                           bg-white border border-slate-200 rounded-xl shadow-sm
                           hover:bg-slate-50 hover:border-slate-300 hover:shadow transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M7 4V7L9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Sign In
              </Link>
            </div>
          </div>

          {/* Right: live graph */}
          <div className={`transition-all duration-1000 delay-300 ${vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
            <div className="relative">
              {/* Card */}
              <div className="relative bg-white/60 backdrop-blur-sm rounded-3xl border border-slate-200/80 shadow-2xl shadow-slate-200/60 p-8 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Project Knowledge Graph</div>
                    <div className="text-sm font-semibold text-slate-700">Bangalore DC · Phase 1</div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[11px] font-semibold text-green-700">Live</span>
                  </div>
                </div>

                {/* Graph */}
                <div className="h-56 relative mb-6">
                  <LiveGraphViz />
                </div>

                {/* Metric row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Documents',  value: '1,247', color: 'text-[#3B82F6]' },
                    { label: 'Risks Found', value: '34',   color: 'text-[#F97316]' },
                    { label: 'AI Queries',  value: '892',   color: 'text-[#14B8A6]' },
                  ].map(m => (
                    <div key={m.label} className="text-center py-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className={`text-xl font-extrabold ${m.color}`}>{m.value}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Bright AI suggestion */}
                <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-teal-50 to-sky-50 border border-teal-100">
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#14B8A6] to-[#0EA5E9] flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] text-white font-bold">B</span>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-teal-700 mb-0.5">Bright AI · Confidence 94%</div>
                      <div className="text-xs text-slate-600">UPS delivery delay detected. Commissioning reschedule recommended — 6-day recovery possible.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge 1 */}
              <div className="absolute -top-4 -right-4 bg-white rounded-xl border border-slate-200 shadow-lg px-3 py-2">
                <div className="text-[10px] font-semibold text-slate-400 mb-0.5">Critical Path Risk</div>
                <div className="text-sm font-extrabold text-[#EF4444]">HIGH — 6 days</div>
              </div>

              {/* Floating badge 2 */}
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl border border-slate-200 shadow-lg px-3 py-2">
                <div className="text-[10px] font-semibold text-slate-400 mb-0.5">Schedule Confidence</div>
                <div className="text-sm font-extrabold text-[#14B8A6]">94% · On Track</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
        <div className="text-[10px] font-medium text-slate-400 tracking-widest uppercase">Scroll</div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6L8 10L12 6" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </section>
  )
}
