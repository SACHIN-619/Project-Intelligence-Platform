// app/page.tsx — Project Impact Intelligence · Full Homepage
// Light mode, Framer Motion scroll-zoom portal, typing effects, all 10 scenes
'use client'

import {
  useCallback, useState, useEffect, useRef,
} from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
  AnimatePresence,
} from 'framer-motion'
import Link from 'next/link'

// ─── Typing Effect Hook ────────────────────────────────────────────────────
function useTypewriter(words: string[], speed = 65, pause = 2000) {
  const [text, setText] = useState('')
  const [wordIdx, setWordIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    const current = words[wordIdx]
    const delay = deleting ? speed / 2 : charIdx === current.length ? pause : speed
    const timer = setTimeout(() => {
      if (!deleting && charIdx < current.length) {
        setText(current.slice(0, charIdx + 1)); setCharIdx(c => c + 1)
      } else if (!deleting && charIdx === current.length) {
        setDeleting(true)
      } else if (deleting && charIdx > 0) {
        setText(current.slice(0, charIdx - 1)); setCharIdx(c => c - 1)
      } else {
        setDeleting(false); setWordIdx(w => (w + 1) % words.length)
      }
    }, delay)
    return () => clearTimeout(timer)
  }, [charIdx, deleting, wordIdx, words, speed, pause])
  return text
}

// ─── Counter Hook ─────────────────────────────────────────────────────────
function useCounter(target: number, duration = 1800) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  useEffect(() => {
    if (!isInView) return
    let start: number
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3) // ease-out cubic
      setVal(Math.floor(ease * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [isInView, target, duration])
  return { val, ref }
}

// ─── Scroll Reveal Wrapper ────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── NAV ─────────────────────────────────────────────────────────────────
function Navbar({ onDemo, loading }: { onDemo: () => void; loading: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  const scroll = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setOpen(false)
  }
  return (
    <motion.header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-white/90 backdrop-blur-2xl shadow-sm border-b border-slate-200/60' : 'bg-transparent'
      }`}
      initial={{ y: -80 }} animate={{ y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="max-w-7xl mx-auto px-5 lg:px-8 flex h-16 items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-400/30">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L18 6.5V13.5L10 18L2 13.5V6.5L10 2Z" stroke="white" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
              <circle cx="10" cy="10" r="2.5" fill="white"/>
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-black text-slate-900 leading-none tracking-tight">Project Impact Intelligence</div>
            <div className="text-[9px] font-bold text-sky-500 uppercase tracking-widest mt-0.5">Powered by Bright AI</div>
          </div>
        </div>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-0.5">
          {['capabilities','command-center','scenario','architecture','future'].map(id => (
            <button key={id} onClick={() => scroll(id)}
              className="px-3.5 py-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 capitalize transition-all">
              {id.replace('-', ' ')}
            </button>
          ))}
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden sm:flex items-center px-4 py-2 text-[13px] font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
            Sign In
          </Link>
          <motion.button
            onClick={onDemo} disabled={loading} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-bold text-white bg-gradient-to-r from-sky-500 to-blue-500 rounded-xl shadow-lg shadow-sky-500/25 disabled:opacity-60 transition-all"
          >
            {loading ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"/>Loading…</> : <>⚡ Explore Live</>}
          </motion.button>
          <button className="md:hidden p-2" onClick={() => setOpen(v => !v)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              {open ? <path d="M4 4L16 16M16 4L4 16" stroke="#334155" strokeWidth="1.5" strokeLinecap="round"/> : <path d="M3 5H17M3 10H17M3 15H17" stroke="#334155" strokeWidth="1.5" strokeLinecap="round"/>}
            </svg>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-100 overflow-hidden">
            <div className="px-5 py-3 flex flex-col gap-1">
              {['capabilities','command-center','scenario','architecture','future'].map(id => (
                <button key={id} onClick={() => scroll(id)} className="text-left px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg capitalize">
                  {id.replace('-', ' ')}
                </button>
              ))}
              <Link href="/login" className="text-center mt-1 px-3 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl">Sign In</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}

// ─── SCENE 1: SCROLL-ZOOM PORTAL HERO ────────────────────────────────────
function ScrollZoomHero({ onDemo, loading }: { onDemo: () => void; loading: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end start'] })

  // Text ZOOMS IN and flies past camera (Variation B portal)
  const scale = useTransform(scrollYProgress, [0, 0.6], [1, 28])
  const opacity = useTransform(scrollYProgress, [0, 0.05, 0.45, 0.6], [0.08, 0.25, 0.15, 0])
  const videoOpacity = useTransform(scrollYProgress, [0.3, 0.6], [0, 0.85])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const springScale = useSpring(scale, { stiffness: 80, damping: 20 })

  const typed = useTypewriter([
    'Specification Compliance',
    'Schedule Risk Prediction',
    'Supply Chain Intelligence',
    'Commissioning QA',
    'Knowledge Graph Queries',
  ])

  return (
    <div ref={containerRef} style={{ height: '300vh' }} className="relative">
      <div className="sticky top-0 h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-sky-50">

        {/* Animated grid background */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(59,130,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.05) 1px, transparent 1px)`,
            backgroundSize: '56px 56px',
          }}
          animate={{ backgroundPosition: ['0px 0px', '56px 56px'] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        />

        {/* Radial glows */}
        <div className="absolute top-1/4 -left-40 w-[700px] h-[700px] rounded-full bg-sky-300/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-sky-300/10 blur-3xl pointer-events-none" />

        {/* Background video — reveals as text zooms in */}
        <motion.div className="absolute inset-0 pointer-events-none" style={{ opacity: videoOpacity }}>
          <video
            autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'saturate(0.7) brightness(0.6)' }}
            src="https://cdn.coverr.co/videos/coverr-aerial-view-of-city-at-night-3573/1080p.mp4"
            onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-transparent" />
        </motion.div>

        {/* MEGA PORTAL TEXT — zooms into camera */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none translate-y-16">
          <motion.div
            style={{ scale: springScale, opacity, transformOrigin: 'center center' }}
            className="text-center select-none"
          >
            <div
              className="font-black uppercase text-transparent bg-clip-text leading-none"
              style={{
                fontSize: 'clamp(80px, 15vw, 200px)',
                background: 'linear-gradient(135deg, #0F172A 0%, #3B82F6 50%, #0EA5E9 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.04em',
              }}
            >
              INTELLIGENCE
            </div>
            <div
              className="font-black uppercase text-slate-300 leading-none"
              style={{ fontSize: 'clamp(24px, 4vw, 60px)', letterSpacing: '0.3em' }}
            >
              BEYOND GUESSWORK
            </div>
          </motion.div>
        </div>

        {/* Hero content — slides up as video reveals */}
        <motion.div
          className="absolute inset-0 flex flex-col items-start justify-center pointer-events-none"
          style={{ y: contentY, opacity: useTransform(scrollYProgress, [0, 0.15], [1, 0]) }}
        >
          <div className="max-w-7xl w-full mx-auto px-5 lg:px-8 pt-20">
            <div className="max-w-2xl pointer-events-auto">

              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 mb-6 px-3.5 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-[11px] font-bold text-sky-700 tracking-widest uppercase"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                ET AI Hackathon 2.0 · Data Centre EPC Intelligence
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }}
                className="text-5xl lg:text-7xl font-black text-slate-900 leading-[1.02] tracking-tight mb-6"
              >
                Deliver Data Centres<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-blue-500">
                  with Intelligence,
                </span><br />
                not Guesswork.
              </motion.h1>

              {/* Typing effect */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                className="flex flex-wrap items-center gap-2 mb-3 text-base font-medium text-slate-500"
              >
                <span>AI-powered</span>
                <span className="text-sky-600 font-bold min-w-[260px] inline-block">
                  {typed}<span className="animate-pulse text-sky-500 ml-0.5">|</span>
                </span>
              </motion.div>

              {/* Brand line */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }}
                className="flex items-center gap-3 mb-8"
              >
                <span className="text-sm font-semibold text-slate-400">Project Impact Intelligence (PII)</span>
                <span className="text-slate-300">·</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center">
                    <span className="text-[8px] font-black text-white">B</span>
                  </div>
                  <span className="text-sm font-bold text-sky-500">powered by Bright AI</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-[9px] font-black text-sky-600 uppercase tracking-widest">✦ Live</span>
                </div>
              </motion.div>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}
                className="flex flex-wrap gap-3"
              >
                <motion.button
                  onClick={onDemo} disabled={loading} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2.5 px-7 py-4 text-sm font-black text-white bg-gradient-to-r from-sky-500 to-blue-500 rounded-2xl shadow-2xl shadow-sky-500/30 disabled:opacity-60"
                >
                  {loading ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"/>Loading Demo…</> : <>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <circle cx="9" cy="9" r="7.5" stroke="white" strokeWidth="1.5"/>
                      <path d="M7 6.5L12 9L7 11.5V6.5Z" fill="white"/>
                    </svg>
                    Explore Live Project
                  </>}
                </motion.button>
                <Link href="/login">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 px-7 py-4 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-slate-300 hover:shadow cursor-pointer"
                  >
                    Sign In
                  </motion.div>
                </Link>
              </motion.div>

              {/* Scroll hint */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
                className="mt-10 flex items-center gap-2"
              >
                <motion.div
                  animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex flex-col items-center gap-1"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scroll to experience</span>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-sky-400">
                    <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Right panel — Live graph card */}
        <motion.div
          className="absolute right-12 top-[58%] -translate-y-1/2 hidden xl:block pointer-events-none opacity-90"
          initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, duration: 0.8 }}
          style={{ opacity: useTransform(scrollYProgress, [0, 0.2], [1, 0]) }}
        >
          <LiveGraphCard />
        </motion.div>
      </div>
    </div>
  )
}

// ─── LIVE GRAPH CARD ─────────────────────────────────────────────────────
function LiveGraphCard() {
  const [tick, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick(v => v + 1), 1800); return () => clearInterval(t) }, [])
  const nodes = [
    { x: 50, y: 48, label: 'Project', color: '#3B82F6', active: true },
    { x: 80, y: 18, label: 'Specs',    color: '#3B82F6', active: tick >= 1 },
    { x: 82, y: 75, label: 'Schedule', color: '#3B82F6', active: tick >= 2 },
    { x: 20, y: 25, label: 'Vendors',  color: '#8B5CF6', active: tick >= 3 },
    { x: 18, y: 72, label: 'Risk AI',  color: '#EF4444', active: tick >= 4 },
    { x: 50, y: 88, label: 'Decision', color: '#22C55E', active: tick >= 5 },
  ]
  const edges = [[0,1],[0,2],[0,3],[0,4],[0,5],[1,2],[3,4]]
  return (
    <div className="w-80 rounded-3xl bg-white/80 backdrop-blur-xl border border-slate-200/80 shadow-2xl shadow-slate-300/40 p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Knowledge Graph</div>
          <div className="text-sm font-bold text-slate-800">BLR Data Centre · Phase 1</div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-50 border border-green-200">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>
          <span className="text-[10px] font-bold text-green-700">Live</span>
        </div>
      </div>
      <div className="h-44 relative mb-3">
        <svg viewBox="0 0 100 100" className="w-full h-full" style={{ overflow: 'visible' }}>
          {edges.map(([a,b], i) => nodes[a].active && nodes[b].active && (
            <motion.line key={i} x1={`${nodes[a].x}%`} y1={`${nodes[a].y}%`} x2={`${nodes[b].x}%`} y2={`${nodes[b].y}%`}
              stroke={nodes[a].color} strokeWidth="0.8" strokeOpacity="0.35"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }}/>
          ))}
          {nodes.map((n, i) => n.active && (
            <g key={i} transform={`translate(${n.x} ${n.y})`}>
              <motion.circle r="5" fill={n.color} fillOpacity="0.12" initial={{ r: 0 }} animate={{ r: 8 }}
                style={{ animationDuration: '2s', animationIterationCount: 'infinite' }}/>
              <motion.circle r="3" fill={n.color} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}/>
              <text textAnchor="middle" dy="-5.5" fontSize="4.5" fill={n.color} fontFamily="Inter, sans-serif" fontWeight="600">{n.label}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[{ l: 'Documents', v: '1,247', c: 'text-blue-500' }, { l: 'Risk Flags', v: '34', c: 'text-red-500' }, { l: 'AI Confidence', v: '94%', c: 'text-sky-500' }].map(m => (
          <div key={m.l} className="text-center py-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className={`text-lg font-black ${m.c}`}>{m.v}</div>
            <div className="text-[9px] text-slate-400 mt-0.5">{m.l}</div>
          </div>
        ))}
      </div>
      <div className="p-3 rounded-xl bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-100">
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shrink-0">
            <span className="text-[8px] font-black text-white">B</span>
          </div>
          <div>
            <div className="text-[9px] font-bold text-sky-700 mb-0.5">Bright AI · 94% confidence</div>
            <div className="text-[10px] text-slate-600">UPS delay detected. 6-day commissioning recovery plan ready.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SCENE 2: STATS BANNER ────────────────────────────────────────────────
function StatsBanner() {
  const stats = [
    { value: 15, suffix: 'B+', prefix: '$', label: 'Capital Deployed', sub: 'India DC Buildout 2025' },
    { value: 2700, suffix: ' MW', prefix: '', label: 'Capacity Target by 2027', sub: 'JLL India DC Report' },
    { value: 67, suffix: '%', prefix: '', label: 'Projects Behind Schedule', sub: 'Turner & Townsend 2024' },
    { value: 40000, suffix: '+', prefix: '', label: 'Equipment Items / Project', sub: 'Hyperscale Complexity' },
  ]
  return (
    <section className="bg-slate-900 py-12 border-y border-slate-800">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <Reveal className="mb-6 text-center">
          <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">The Scale of the Problem India Is Building</span>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => {
            const { val, ref } = useCounter(s.value, 1800)
            return (
              <Reveal key={s.label} delay={i * 0.1} className="text-center">
                <div className="text-3xl lg:text-4xl font-black text-white mb-1">
                  <span className="text-sky-400">{s.prefix}</span>
                  <span ref={ref}>{val.toLocaleString()}</span>
                  <span className="text-sky-400">{s.suffix}</span>
                </div>
                <div className="text-sm font-semibold text-slate-300">{s.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{s.sub}</div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── SCENE 3: PROBLEM ─────────────────────────────────────────────────────
const FRAGMENTS = [
  { label: 'Excel Trackers',   icon: '📊', delay: 0 },
  { label: 'PDF Specs',        icon: '📄', delay: 0.1 },
  { label: 'Email Threads',    icon: '📧', delay: 0.2 },
  { label: 'Vendor Portals',   icon: '🏭', delay: 0.3 },
  { label: 'Inspection Logs',  icon: '🔍', delay: 0.4 },
  { label: 'RFI Documents',    icon: '📋', delay: 0.5 },
  { label: 'Meeting Notes',    icon: '📝', delay: 0.6 },
  { label: 'Change Orders',    icon: '🔄', delay: 0.7 },
]

function ProblemSection() {
  return (
    <section className="bg-gradient-to-b from-white to-red-50/30 py-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <Reveal>
          <span className="inline-flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-widest mb-5">
            <span className="w-8 h-px bg-red-400"/>The Problem
          </span>
        </Reveal>
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <Reveal delay={0.1}>
              <h2 className="text-4xl lg:text-5xl font-black text-slate-900 leading-[1.08] tracking-tight mb-6">
                Projects don't fail because<br />
                of <span className="text-slate-300">missing data.</span><br />
                They fail because<br />
                knowledge is{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">scattered.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="text-lg text-slate-500 leading-relaxed mb-8">
                A single hyperscale facility involves <strong className="text-slate-700">15,000–40,000 equipment line items</strong>, 200 concurrent contractors, and thousands of commissioning tests — all with zero tolerance for error.
              </p>
            </Reveal>
            <div className="space-y-3">
              {[
                { s: '67%', d: 'Asia-Pacific EPC projects had schedule overruns >10%', src: 'Turner & Townsend 2024' },
                { s: '₹100Cr+', d: 'Average cost of a Tier IV commissioning failure', src: 'Industry estimate' },
                { s: '3 weeks', d: 'Typical delay from late procurement discovery', src: 'PII internal analysis' },
              ].map((item, i) => (
                <Reveal key={item.s} delay={0.3 + i * 0.1}>
                  <div className="flex gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-xl font-black text-red-500 w-24 shrink-0">{item.s}</div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{item.d}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{item.src}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.6}>
              <p className="mt-8 text-base font-bold italic text-slate-400 border-l-3 border-l-2 border-red-400 pl-4">
                "Delays begin long before deadlines are missed."
              </p>
            </Reveal>
          </div>

          {/* Fragmentation visualization */}
          <Reveal delay={0.15} className="relative">
            <div className="relative h-[480px] rounded-3xl bg-gradient-to-br from-red-50 to-orange-50/50 border border-red-100 overflow-hidden">
              {/* Center broken node */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-20 h-20 rounded-full border-4 border-dashed border-red-300 flex items-center justify-center bg-white shadow-xl"
                >
                  <span className="text-2xl">⚡</span>
                </motion.div>
              </div>
              {/* Floating fragments */}
              {FRAGMENTS.map((f, i) => {
                const angle = (i / FRAGMENTS.length) * Math.PI * 2
                const r = 160
                const cx = 50 + Math.cos(angle) * 38
                const cy = 50 + Math.sin(angle) * 38
                return (
                  <motion.div
                    key={f.label}
                    style={{ left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%, -50%)' }}
                    className="absolute"
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: f.delay, type: 'spring', stiffness: 150 }}
                    animate={{
                      y: [0, -8, 0],
                      rotate: [0, i % 2 === 0 ? 3 : -3, 0],
                    }}
                  >
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 3 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                      className="flex items-center gap-1.5 bg-white rounded-xl border border-red-100 shadow-md px-2.5 py-1.5 whitespace-nowrap"
                    >
                      <span className="text-sm">{f.icon}</span>
                      <span className="text-[10px] font-semibold text-slate-600">{f.label}</span>
                    </motion.div>
                  </motion.div>
                )
              })}
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Fragmented · Disconnected · Invisible</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ─── SCENE 4: TRANSFORM / KNOWLEDGE GRAPH FORMING ────────────────────────
function TransformSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['10%', '-10%'])

  const steps = ['Spec Document','Equipment List','Vendor Submittal','Inspection Record','Schedule Impact','Risk Analysis','AI Recommendation']
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={containerRef} className="relative min-h-screen bg-gradient-to-b from-slate-50 via-slate-900 to-[#0A0F1E] py-28 overflow-hidden">
      <motion.div className="absolute inset-0 opacity-20" style={{ y }}>
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(59,130,246,0.3) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(59,130,246,0.2) 0%, transparent 50%)',
        }}/>
      </motion.div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 lg:px-8">
        <Reveal className="mb-4">
          <span className="inline-flex items-center gap-2 text-[10px] font-black text-sky-400 uppercase tracking-widest">
            <span className="w-8 h-px bg-sky-400"/>The Transformation
          </span>
        </Reveal>
        <Reveal delay={0.1} className="mb-16 max-w-3xl">
          <h2 className="text-4xl lg:text-5xl font-black leading-tight">
            <span className="text-white">From fragmented files</span><br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-400">
              to connected intelligence.
            </span>
          </h2>
        </Reveal>

        {/* Connecting flow */}
        <div ref={ref} className="flex flex-wrap gap-3 items-center mb-16">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: i * 0.15, type: 'spring', stiffness: 200 }}
                className="px-4 py-2.5 rounded-xl border bg-white/10 backdrop-blur-sm text-sm font-semibold text-white"
                style={{ borderColor: `rgba(59,130,246,${0.2 + i * 0.1})`, boxShadow: `0 0 16px rgba(59,130,246,${0.05 + i * 0.04})` }}
              >
                {step}
              </motion.div>
              {i < steps.length - 1 && (
                <motion.svg
                  width="20" height="20" viewBox="0 0 20 20" fill="none"
                  initial={{ opacity: 0, x: -5 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: i * 0.15 + 0.1 }}
                >
                  <path d="M4 10H16M12 6L16 10L12 14" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </motion.svg>
              )}
            </div>
          ))}
        </div>

        <Reveal delay={0.5}>
          <p className="text-xl font-bold italic text-slate-300 border-l-2 border-sky-400 pl-6 max-w-xl">
            "Information becomes intelligence only when connected."
          </p>
        </Reveal>
      </div>
    </section>
  )
}

// ─── SCENE 5: CAPABILITIES ───────────────────────────────────────────────
const CAPS = [
  { icon: '🔎', title: 'Spec & Quality Compliance', desc: 'Ingests 1000s of spec pages. Checks procurement orders, vendor submittals, and shop drawings for deviations before they reach site.', color: '#3B82F6', tag: 'Compliance Agent' },
  { icon: '📈', title: 'Predictive Schedule Risk', desc: 'Multi-agent analysis against real-time procurement, lead times, workforce — identifying critical path risks weeks in advance with mitigation options.', color: '#F97316', tag: 'Risk Engine' },
  { icon: '🌐', title: 'Supply Chain Visibility', desc: 'Geospatial AI tracking UPS systems, generators, cooling towers, switchgear across multi-tier suppliers — alerting before they become critical path issues.', color: '#8B5CF6', tag: 'Supply Tracker' },
  { icon: '⚡', title: 'Commissioning Intelligence', desc: 'Trained on TIA-942, BICSI, Uptime Institute Tier specs. Guides engineers through IST sequences, auto-generates test records, flags non-conformances.', color: '#3B82F6', tag: 'Commissioning Copilot' },
  { icon: '🧠', title: 'Knowledge & RFI Intelligence', desc: 'RAG over all project documents — specs, submittals, RFIs, minutes, change orders. Answers technical queries in seconds with citations and similarity matches.', color: '#22C55E', tag: 'Knowledge RAG' },
  { icon: '💡', title: 'Explainable AI Decisions', desc: 'Every recommendation backed by evidence trail. Confidence scores, source documents, dependency chains, and cascading impact — no black box.', color: '#EAB308', tag: 'Decision Intelligence' },
]

function CapabilitiesSection() {
  return (
    <section id="capabilities" className="bg-[#0A0F1E] py-28 overflow-hidden">
      <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-sky-500/20 to-transparent"/>
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <Reveal>
          <span className="inline-flex items-center gap-2 text-[10px] font-black text-sky-400 uppercase tracking-widest mb-5">
            <span className="w-8 h-px bg-sky-400"/>Platform Capabilities
          </span>
        </Reveal>
        <Reveal delay={0.1} className="mb-4">
          <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-3">
            Six capabilities.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-400">One platform.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.2} className="mb-6">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-sky-500/10 border border-sky-500/20">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center">
              <span className="text-[8px] font-black text-white">B</span>
            </div>
            <span className="text-sm font-bold text-sky-300">Project Impact Intelligence (PII) — powered by Bright AI · Gets smarter with every project</span>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
          {CAPS.map((c, i) => (
            <Reveal key={c.tag} delay={0.1 + i * 0.07}>
              <motion.div
                whileHover={{ y: -6, boxShadow: `0 20px 40px ${c.color}20` }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="group relative p-6 rounded-2xl bg-[#0C1322] border overflow-hidden cursor-default h-full"
                style={{ borderColor: `${c.color}20` }}
              >
                {/* Top accent line */}
                <div className="absolute top-0 left-8 right-8 h-px" style={{ background: `linear-gradient(90deg, transparent, ${c.color}80, transparent)` }}/>
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                  style={{ background: `radial-gradient(ellipse at top left, ${c.color}10, transparent 60%)` }}/>
                <div className="text-3xl mb-4">{c.icon}</div>
                <h3 className="text-base font-black text-white mb-2">{c.title}</h3>
                <p className="text-[13px] text-slate-400 leading-relaxed mb-5">{c.desc}</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: `linear-gradient(135deg, ${c.color}, #3B82F6)` }}/>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.color }}>Bright AI · {c.tag}</span>
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.5} className="text-center mt-12">
          <p className="text-base font-bold italic text-slate-500">"Six capabilities. One platform. Zero guesswork."</p>
        </Reveal>
      </div>
    </section>
  )
}

// ─── SCENE 6: INTERACTIVE COMMAND CENTER ─────────────────────────────────
const TASKS = [
  { date: 'Jul 20', task: 'UPS Delivery — Bharat Power',    status: 'delayed',  risk: 'HIGH', ai: 'UPS delay (3 units, 6-day slip) creates cascade risk to LV Switchgear commissioning. Recommend parallel-tracking Generator ATS to recover 2 days net.' },
  { date: 'Jul 28', task: 'Cooling Tower Installation',     status: 'on-track', risk: 'LOW',  ai: 'Voltas confirmed site access Jul 28. No blocking dependencies. All pre-fab inspection clearances in place.' },
  { date: 'Aug 05', task: 'LV Switchgear Commissioning',   status: 'at-risk',  risk: 'MED',  ai: 'At risk due to UPS upstream dependency. Parallel Genset ATS commissioning can recover 2 days.' },
  { date: 'Aug 12', task: 'Tier IV Certification Audit',   status: 'on-track', risk: 'LOW',  ai: '847 of 892 pre-commissioning tests passed. 45 outstanding — projected completion Aug 09.' },
]
const STATUS: Record<string, string> = {
  delayed:  'bg-red-500/10 text-red-400 border-red-500/30',
  'on-track': 'bg-green-500/10 text-green-400 border-green-500/30',
  'at-risk':  'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
}
const RISK_C: Record<string, string> = { HIGH: 'text-red-400', MED: 'text-yellow-400', LOW: 'text-green-400' }

function CommandCenterSection() {
  const [active, setActive] = useState<number | null>(null)
  return (
    <section id="command-center" className="bg-[#070E1D] py-28 overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}/>
      <div className="max-w-7xl mx-auto px-5 lg:px-8 relative z-10">
        <Reveal>
          <span className="inline-flex items-center gap-2 text-[10px] font-black text-sky-400 uppercase tracking-widest mb-5">
            <span className="w-8 h-px bg-sky-400"/>Command Center Preview
          </span>
        </Reveal>
        <Reveal delay={0.1} className="mb-3">
          <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-3">
            This is what the{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-400">Command Center</span>
            {' '}feels like.
          </h2>
        </Reveal>
        <Reveal delay={0.15} className="mb-10">
          <p className="text-slate-400 text-lg">Not a dashboard. A mission operations interface. <strong className="text-sky-400">Hover a task</strong> to see Bright AI respond instantly.</p>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="rounded-2xl bg-[#0C1322] border border-[#1F2937] overflow-hidden shadow-2xl">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#0A0F1E] border-b border-[#1F2937]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60"/><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60"/><div className="w-2.5 h-2.5 rounded-full bg-green-500/60"/>
              <div className="ml-4 flex-1 flex justify-center">
                <div className="w-60 h-5 rounded bg-[#111827] flex items-center justify-center">
                  <span className="text-[10px] text-slate-500 font-mono">pii.ai / command-center / BLR-DC-01</span>
                </div>
              </div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/><span className="text-[10px] text-slate-500">Live</span></div>
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-2 md:grid-cols-4 border-b border-[#1F2937]">
              {[
                { l: 'Documents Indexed', v: 1247, c: '#3B82F6' },
                { l: 'Risk Flags', v: 34, c: '#EF4444' },
                { l: 'Schedule Confidence', v: 94, suffix: '%', c: '#3B82F6' },
                { l: 'Bright AI Queries', v: 892, c: '#8B5CF6' },
              ].map(m => {
                const { val, ref } = useCounter(m.v, 1800)
                return (
                  <div key={m.l} className="p-5 text-center border-r border-[#1F2937] last:border-0 hover:bg-[#111827] transition-colors">
                    <div className="text-3xl font-black mb-1" style={{ color: m.c }}>
                      <span ref={ref}>{val.toLocaleString()}</span>{m.suffix || ''}
                    </div>
                    <div className="text-[11px] text-slate-500">{m.l}</div>
                  </div>
                )
              })}
            </div>

            <div className="grid lg:grid-cols-3">
              {/* Timeline */}
              <div className="lg:col-span-2 p-6 border-r border-[#1F2937]">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-black text-white">Critical Path — BLR-DC-01 Phase 1</h3>
                  <span className="text-[10px] text-slate-500 font-mono">Updated 2 min ago</span>
                </div>
                <div className="space-y-3">
                  {TASKS.map((t, i) => (
                    <motion.div
                      key={i}
                      onHoverStart={() => setActive(i)}
                      onHoverEnd={() => setActive(null)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${active === i ? 'border-sky-500/40 bg-sky-500/5' : 'border-[#1F2937] bg-[#0A0F1E] hover:border-[#374151]'}`}
                      whileHover={{ x: 4 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-mono text-slate-500 w-12 shrink-0">{t.date}</span>
                          <span className="text-sm font-medium text-slate-300">{t.task}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className={`text-[10px] font-black ${RISK_C[t.risk]}`}>{t.risk}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS[t.status]}`}>{t.status}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Bright AI panel */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center">
                    <span className="text-[10px] font-black text-white">B</span>
                  </div>
                  <span className="text-sm font-black text-white">Bright AI</span>
                  <span className="ml-auto text-[10px] font-bold text-sky-400">94% confidence</span>
                </div>
                <AnimatePresence mode="wait">
                  {active !== null ? (
                    <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
                        <div className="text-[10px] font-bold text-sky-400 mb-1.5">⚡ Analysis</div>
                        <p className="text-xs text-slate-300 leading-relaxed">{TASKS[active].ai}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#111827] border border-[#1F2937]">
                        <div className="text-[10px] font-bold text-slate-400 mb-2">Evidence Trail</div>
                        <div className="space-y-1.5">
                          {['📄 UPS-PO-2024-089.pdf', '📧 Vendor delay notice (Jul 18)', '📅 Schedule Rev.12 (Jul 20)'].map(e => (
                            <div key={e} className="text-[10px] text-slate-500">{e}</div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-40 text-center">
                      <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                        <div className="text-3xl mb-3">🤖</div>
                      </motion.div>
                      <p className="text-sm text-slate-500">Hover a task</p>
                      <p className="text-sm font-bold text-sky-400">to see Bright AI respond</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.4} className="text-center mt-10">
          <p className="text-base font-bold italic text-slate-500">"Better decisions begin before problems happen."</p>
        </Reveal>
      </div>
    </section>
  )
}

// ─── SCENE 7: UPS SCENARIO ────────────────────────────────────────────────
const OLD = ['Manual vendor follow-ups','Email chains across 8 teams','Spreadsheet status updates','Late discovery (2 weeks)','Emergency re-sequence meeting','Commissioning delayed 3 weeks']
const NEW_ = ['Detects UPS slip (Day 1)','Identifies 7 impacted systems','Recalculates critical path','Generates 3 recovery options','Auto-alerts all stakeholders','6-day delay recovered ✓']

function ScenarioSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  return (
    <section id="scenario" className="bg-[#0A0F1E] py-28 relative overflow-hidden">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl pointer-events-none"/>
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none"/>
      <div className="max-w-7xl mx-auto px-5 lg:px-8 relative z-10">
        <Reveal><span className="inline-flex items-center gap-2 text-[10px] font-black text-orange-400 uppercase tracking-widest mb-5"><span className="w-8 h-px bg-orange-400"/>Real Business Scenario</span></Reveal>
        <Reveal delay={0.1} className="mb-12">
          <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight">
            UPS vendor delays delivery.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">What happens next?</span>
          </h2>
        </Reveal>
        <div ref={ref} className="grid lg:grid-cols-2 gap-8">
          {[
            { title: 'Traditional Process', sub: 'Without Project Impact Intelligence', items: OLD, ok: false, result: '+21 days delay', resultC: 'text-red-400' },
            { title: 'Project Impact Intelligence', sub: 'Powered by Bright AI', items: NEW_, ok: true, result: '6-day recovery', resultC: 'text-sky-400' },
          ].map((col, ci) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, x: ci === 0 ? -30 : 30 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: ci * 0.15, duration: 0.6 }}
              className={`rounded-2xl bg-[#0C1322] border overflow-hidden ${col.ok ? 'border-sky-500/20' : 'border-red-500/20'}`}
            >
              <div className={`px-6 py-4 border-b flex items-center gap-3 ${col.ok ? 'bg-sky-500/5 border-sky-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                {col.ok ? (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center">
                    <span className="text-[9px] font-black text-white">B</span>
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-xl bg-red-500/15 flex items-center justify-center">
                    <span className="text-red-400 text-sm">⚠</span>
                  </div>
                )}
                <div>
                  <div className={`text-xs font-black uppercase tracking-wide ${col.ok ? 'text-sky-400' : 'text-red-400'}`}>{col.title}</div>
                  <div className="text-[10px] text-slate-500">{col.sub}</div>
                </div>
              </div>
              <div className="p-6 space-y-2.5">
                {col.items.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: ci * 0.15 + i * 0.08 }}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border ${col.ok ? 'bg-[#0A0F1E] border-sky-500/10' : 'bg-[#0A0F1E] border-[#1F2937]'}`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${col.ok ? 'border-sky-500/40 bg-sky-500/10' : 'border-red-500/40'}`}>
                      {col.ok ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : <span className="text-[9px] font-bold text-red-400">{i+1}</span>}
                    </div>
                    <span className="text-[13px] text-slate-300">{step}</span>
                    {i === col.items.length - 1 && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${col.ok ? 'text-sky-400 bg-sky-500/10 border-sky-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'}`}>
                        {col.ok ? 'RECOVERED' : 'FAIL'}
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
              <div className={`px-6 py-4 border-t text-center ${col.ok ? 'border-sky-500/20' : 'border-red-500/20'}`}>
                <div className={`text-2xl font-black ${col.resultC}`}>{col.result}</div>
              </div>
            </motion.div>
          ))}
        </div>
        <Reveal delay={0.4} className="text-center mt-10">
          <p className="text-base font-bold italic text-slate-500">"Intelligence cannot exist in isolated systems."</p>
        </Reveal>
      </div>
    </section>
  )
}

// ─── SCENE 8: EXPLAINABILITY ──────────────────────────────────────────────
function ExplainSection() {
  const barRef = useRef<HTMLDivElement>(null)
  const barInView = useInView(barRef, { once: true })
  return (
    <section className="bg-[#070E1D] py-28 overflow-hidden relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl"/>
      </div>
      <div className="max-w-7xl mx-auto px-5 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <Reveal><span className="inline-flex items-center gap-2 text-[10px] font-black text-purple-400 uppercase tracking-widest mb-5"><span className="w-8 h-px bg-purple-400"/>AI Explainability</span></Reveal>
            <Reveal delay={0.1}>
              <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
                Bright AI doesn't just<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">recommend.</span><br/>
                It <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-400">explains.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="text-lg text-slate-400 leading-relaxed mb-8">Every recommendation is backed by evidence — the exact documents, dependencies, and schedule data that led to the conclusion. Enterprise AI that earns trust.</p>
            </Reveal>
            <div className="space-y-4">
              {[
                { i: '📋', t: 'Every recommendation cites its source documents' },
                { i: '🔗', t: 'Dependency chains are fully traceable' },
                { i: '📊', t: 'Confidence scores calibrated to data quality' },
                { i: '💬', t: 'Reasoning in plain language, not model jargon' },
              ].map((item, idx) => (
                <Reveal key={item.t} delay={0.3 + idx * 0.1}>
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0C1322] border border-[#1F2937]">
                    <span className="text-xl">{item.i}</span>
                    <span className="text-sm text-slate-300">{item.t}</span>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.7}>
              <p className="mt-8 text-base font-bold italic text-slate-400 border-l-2 border-purple-400 pl-5">"AI that explains its reasoning earns trust."</p>
            </Reveal>
          </div>

          {/* AI Recommendation Card */}
          <Reveal delay={0.2}>
            <div className="rounded-2xl bg-[#0C1322] border border-purple-500/20 overflow-hidden shadow-2xl shadow-purple-500/5">
              <div className="h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"/>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center">
                    <span className="text-[11px] font-black text-white">B</span>
                  </div>
                  <div>
                    <div className="text-sm font-black text-white">Bright AI Recommendation</div>
                    <div className="text-[10px] text-slate-500">BLR-DC-01 · Jul 20, 2026 · 14:32 IST</div>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"/>
                    <span className="text-[10px] font-bold text-sky-400">Active</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-r from-sky-500/10 to-blue-500/10 border border-sky-500/20 mb-5">
                  <div className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-2">Recommendation</div>
                  <div className="text-lg font-black text-white mb-1">Reschedule Commissioning — Phase 2A</div>
                  <div className="text-sm text-slate-400">Delay LV Switchgear by 6 days; parallel-track Generator ATS to recover 2 days net.</div>
                </div>
                <div className="mb-5" ref={barRef}>
                  <div className="flex justify-between mb-2"><span className="text-xs font-semibold text-slate-400">Confidence</span><span className="text-sm font-black text-sky-400">94%</span></div>
                  <div className="h-2 rounded-full bg-[#1F2937] overflow-hidden">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-400"
                      initial={{ width: '0%' }} animate={barInView ? { width: '94%' } : {}} transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}/>
                  </div>
                </div>
                <div className="mb-5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Evidence Trail</div>
                  <div className="space-y-2">
                    {[{ d: 'Vendor Delay Notice', r: 'BHP-EMAIL-20240718', t: '📧' }, { d: 'Schedule Dependency Map', r: 'SCH-REV12-2024', t: '📅' }, { d: 'LV Commissioning Spec', r: 'SPEC-ELEC-4.2', t: '📄' }].map(e => (
                      <div key={e.r} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#111827] border border-[#1F2937]">
                        <span>{e.t}</span>
                        <div className="flex-1 min-w-0"><div className="text-[11px] font-medium text-slate-300 truncate">{e.d}</div><div className="text-[10px] font-mono text-slate-500">{e.r}</div></div>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-sky-500 shrink-0"><path d="M2 6H10M7 3L10 6L7 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#111827] border border-[#1F2937]">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Impact Assessment</div>
                  <div className="grid grid-cols-3 text-center">
                    {[{ v: '-6 days', l: 'Net delay', c: 'text-green-400' }, { v: '₹0', l: 'Penalty avoided', c: 'text-sky-400' }, { v: 'Tier IV', l: 'Cert. preserved', c: 'text-blue-400' }].map(m => (
                      <div key={m.l}><div className={`text-lg font-black ${m.c}`}>{m.v}</div><div className="text-[9px] text-slate-500">{m.l}</div></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ─── SCENE 9: ARCHITECTURE ────────────────────────────────────────────────
const LAYERS = [
  { label: 'Project Teams', sub: 'EPC Managers · Engineers · QA · Commissioning', icon: '👤', color: '#60A5FA' },
  { label: 'Knowledge Layer', sub: 'Specs · RFIs · Submittals · Meeting Notes · Change Orders', icon: '🗂️', color: '#3B82F6' },
  { label: 'Decision Layer', sub: 'Risk Engine · Schedule Analyser · Compliance Checker', icon: '⚡', color: '#8B5CF6' },
  { label: 'Bright AI Layer', sub: 'RAG · Multi-Agent · Knowledge Graph · Reasoning Engine', icon: '🤖', color: '#3B82F6' },
  { label: 'Workflow Layer', sub: 'Alerts · Approvals · Escalations · Notifications', icon: '🔄', color: '#F97316' },
  { label: 'Analytics Layer', sub: 'Dashboards · Audit Trail · Commissioning Packages', icon: '📊', color: '#22C55E' },
]
function ArchitectureSection() {
  return (
    <section id="architecture" className="bg-[#0A0F1E] py-28 overflow-hidden">
      <div className="max-w-5xl mx-auto px-5 lg:px-8">
        <Reveal className="text-center mb-4">
          <span className="inline-flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest">
            <span className="w-8 h-px bg-blue-400"/>Platform Architecture<span className="w-8 h-px bg-blue-400"/>
          </span>
        </Reveal>
        <Reveal delay={0.1} className="text-center mb-12">
          <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-4">Built to scale with India's DC boom.</h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">Six architectural layers, each with a single purpose. Together they form the intelligence India's projects need.</p>
        </Reveal>
        <div className="space-y-2.5">
          {LAYERS.map((l, i) => (
            <Reveal key={l.label} delay={i * 0.08}>
              <motion.div
                whileHover={{ x: -4 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="flex items-center gap-5 p-4 rounded-2xl bg-[#0C1322] border cursor-default"
                style={{ borderColor: `${l.color}25`, boxShadow: `inset -4px 0 0 ${l.color}50` }}
              >
                <div className="w-6 text-center text-[10px] font-mono text-slate-600 shrink-0">L{i+1}</div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `${l.color}15`, border: `1px solid ${l.color}25` }}>{l.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-white">{l.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">{l.sub}</div>
                </div>
                <div className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: `${l.color}60` }}/>
              </motion.div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.6} className="mt-10">
          <div className="p-6 rounded-2xl bg-[#0C1322] border border-[#1F2937]">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Judging Criteria Coverage</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[{ l: 'Innovation', p: '25%', c: '#3B82F6' }, { l: 'Business Impact', p: '25%', c: '#3B82F6' }, { l: 'Technical Excellence', p: '20%', c: '#8B5CF6' }, { l: 'Scalability', p: '15%', c: '#F97316' }, { l: 'User Experience', p: '15%', c: '#22C55E' }].map(c => (
                <div key={c.l} className="text-center">
                  <div className="text-2xl font-black mb-1" style={{ color: c.c }}>{c.p}</div>
                  <div className="text-[10px] text-slate-500">{c.l}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.7} className="text-center mt-10">
          <p className="text-base font-bold italic text-slate-500">"Enterprise intelligence starts with trustworthy foundations."</p>
        </Reveal>
      </div>
    </section>
  )
}

// ─── SCENE 10: FUTURE VISION ──────────────────────────────────────────────
const ROADMAP = [
  { phase: 'Today', title: 'Project Knowledge Intelligence', desc: 'RAG, spec compliance, schedule risk, RFI resolution — live now.', status: 'live', color: '#3B82F6' },
  { phase: 'Q4 2026', title: 'Digital Twin Integration', desc: 'Live BIM sync with as-built capture, commissioning overlays.', status: 'planned', color: '#3B82F6' },
  { phase: 'Q1 2027', title: 'IoT & Sensor Intelligence', desc: 'Real-time site sensor data feeding into risk models.', status: 'planned', color: '#8B5CF6' },
  { phase: 'Q3 2027', title: 'Predictive Maintenance Pre-commissioning', desc: 'Failure mode analysis before equipment enters service.', status: 'future', color: '#F97316' },
  { phase: 'Q1 2028', title: 'Autonomous Project Intelligence', desc: 'AI agents that don\'t just recommend — they act.', status: 'future', color: '#EAB308' },
]
function FutureSection() {
  return (
    <section id="future" className="bg-[#070E1D] py-28 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none"/>
      <div className="max-w-5xl mx-auto px-5 lg:px-8 relative z-10">
        <Reveal><span className="inline-flex items-center gap-2 text-[10px] font-black text-yellow-400 uppercase tracking-widest mb-5"><span className="w-8 h-px bg-yellow-400"/>Future Vision</span></Reveal>
        <Reveal delay={0.1} className="mb-12">
          <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-4">
            Today's foundation.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">Tomorrow's ambition.</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl">India's ₹1,25,000 Cr data centre buildout deserves intelligence that grows with it.</p>
        </Reveal>
        <div className="relative pl-8">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-sky-400 via-purple-500 to-transparent"/>
          <div className="space-y-10">
            {ROADMAP.map((item, i) => (
              <Reveal key={item.phase} delay={i * 0.12}>
                <div className="flex gap-6">
                  <div className="relative shrink-0" style={{ marginLeft: '-1.25rem' }}>
                    <motion.div
                      whileInView={{ scale: [0.8, 1.1, 1] }} transition={{ duration: 0.4, delay: i * 0.1 }}
                      className="w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-black"
                      style={{ borderColor: item.color, backgroundColor: `${item.color}15`, color: item.color }}
                    >
                      {item.status === 'live' ? '✓' : i + 1}
                    </motion.div>
                    {item.status === 'live' && (
                      <motion.div className="absolute inset-0 rounded-full" style={{ backgroundColor: `${item.color}20` }}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }}/>
                    )}
                  </div>
                  <div className="pt-1.5">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-mono font-black" style={{ color: item.color }}>{item.phase}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${item.status === 'live' ? 'text-sky-400 bg-sky-500/10 border-sky-500/20' : item.status === 'planned' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : 'text-slate-500 bg-slate-500/10 border-slate-500/20'}`}>{item.status}</span>
                    </div>
                    <h3 className="text-base font-black text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-500">{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal delay={0.7} className="text-center mt-12">
          <p className="text-base font-bold italic text-slate-500">"Today's projects deserve tomorrow's intelligence."</p>
        </Reveal>
      </div>
    </section>
  )
}

// ─── SCENE 11: FINAL CTA ─────────────────────────────────────────────────
function FinalCTA({ onDemo, loading }: { onDemo: () => void; loading: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start end', 'end end'] })
  const nodeScale = useTransform(scrollYProgress, [0, 1], [0.8, 1.2])

  return (
    <section ref={containerRef} className="relative min-h-[85vh] flex items-center bg-[#0A0F1E] overflow-hidden py-24">
      {/* Animated concentric rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[1, 2, 3, 4].map(i => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-sky-500/10"
            style={{ width: `${i * 25}vw`, height: `${i * 25}vw` }}
            animate={{ scale: [1, 1.02, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.8 }}
          />
        ))}
      </div>
      {/* Teal center glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div style={{ scale: nodeScale }} className="w-[500px] h-[500px] rounded-full bg-sky-500/5 blur-3xl"/>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-5 lg:px-8 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-500/10 border border-sky-500/20 mb-8">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center">
              <span className="text-[8px] font-black text-white">B</span>
            </div>
            <span className="text-sm font-bold text-sky-300">Project Impact Intelligence (PII) · powered by Bright AI</span>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="text-5xl lg:text-6xl font-black text-white leading-[1.05] mb-6">
            The future of project delivery<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-400">isn't more dashboards.</span><br/>
            It's <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">better decisions.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.2} className="mb-12">
          <p className="text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Experience how enterprise intelligence transforms data centre EPC delivery. One click. No signup needed.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <div className="flex flex-wrap justify-center gap-4">
            <motion.button
              onClick={onDemo} disabled={loading}
              whileHover={{ scale: 1.04, y: -3 }} whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-3 px-8 py-4 text-base font-black text-white bg-gradient-to-r from-sky-500 to-blue-500 rounded-2xl shadow-2xl shadow-sky-500/30 disabled:opacity-60"
            >
              {loading ? <><span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"/>Loading…</> : <>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="white" strokeWidth="1.5"/><path d="M8 7L13 10L8 13V7Z" fill="white"/></svg>
                Experience Project Impact Intelligence
              </>}
            </motion.button>
            <Link href="/login">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-slate-300 border border-slate-700 rounded-2xl hover:border-slate-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >Sign In</motion.div>
            </Link>
          </div>
        </Reveal>
        <Reveal delay={0.5} className="mt-10">
          <div className="flex justify-center gap-8">
            {['⚡ Instant demo — no signup', '🔒 No data required', '🏆 ET AI Hackathon 2.0'].map(item => (
              <div key={item} className="text-xs text-slate-500 font-medium">{item}</div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-[11px] text-slate-600">
          Project Impact Intelligence © 2026
          <span className="mx-2">·</span>
          Built for ET AI Hackathon 2.0
          <span className="mx-2">·</span>
          <span className="text-sky-600">Powered by Bright AI</span>
        </p>
      </div>
    </section>
  )
}

// ─── ROOT PAGE ────────────────────────────────────────────────────────────
export default function RootPage() {
  const { isAuthenticated, isLoading, loginDemo } = useAuth()
  const router = useRouter()
  const [demoLoading, setDemoLoading] = useState(false)

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/dashboard')
  }, [isAuthenticated, isLoading, router])

  const handleDemo = useCallback(async () => {
    setDemoLoading(true)
    const r = await loginDemo()
    setDemoLoading(false)
    router.push(r.success ? '/dashboard' : '/login')
  }, [loginDemo, router])

  if (isLoading) return (
    <div className="flex h-screen w-full items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500"/>
        <p className="text-sm text-slate-400 font-medium">Loading…</p>
      </div>
    </div>
  )
  if (isAuthenticated) return null

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      <Navbar onDemo={handleDemo} loading={demoLoading} />
      <main>
        <ScrollZoomHero onDemo={handleDemo} loading={demoLoading} />
        <StatsBanner />
        <ProblemSection />
        <TransformSection />
        <CapabilitiesSection />
        <CommandCenterSection />
        <ScenarioSection />
        <ExplainSection />
        <ArchitectureSection />
        <FutureSection />
        <FinalCTA onDemo={handleDemo} loading={demoLoading} />
      </main>
    </div>
  )
}
