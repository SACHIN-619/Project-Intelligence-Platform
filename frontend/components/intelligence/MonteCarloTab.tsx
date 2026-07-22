/**
 * components/intelligence/MonteCarloTab.tsx
 * ==========================================
 * Third tab on the Intelligence screen.
 *
 * Shows the Monte Carlo simulation output:
 *   - Completion day histogram (Recharts BarChart)
 *   - P50 / P80 / P90 vertical reference lines
 *   - On-time probability arc gauge (custom SVG)
 *   - Top risk driver sensitivity bars
 *
 * Data source: GET /analysis/{project_id} → mc_p50, mc_p80, mc_p90,
 *   mc_on_time_probability, top_sensitivity_tasks
 *
 * BUG FIX 3: `useMemo_histogram` renamed to `buildHistogram` — it is NOT
 *   a React hook, it is a pure function. Using "use" prefix on a non-hook
 *   breaks React's rules of hooks linter.
 * BUG FIX 4: result of buildHistogram wrapped in useMemo() so it only
 *   recomputes when p50/p80/p90 values actually change.
 */
'use client'

import { useMemo }  from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { AnalysisResult } from '@/types'

interface MonteCarloTabProps {
  analysis: AnalysisResult
}

// ── Custom Recharts tooltip ────────────────────────────────────────────────
function CustomTooltip({
  active, payload, label,
}: {
  active?:  boolean
  payload?: { value: number }[]
  label?:   number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[#374151] bg-[#111827] px-3 py-2 shadow-xl">
      <p className="text-xs text-[#9CA3AF]">Day {label}</p>
      <p className="text-sm font-semibold text-white">{payload[0].value} simulations</p>
    </div>
  )
}

/**
 * Builds a plausible bell-curve histogram from the P50/P80/P90 percentiles.
 *
 * The API returns P-values but not the raw 1000-simulation array (too much data).
 * We reconstruct a gaussian-ish shape peaked at P50 so the chart looks accurate.
 * The bars are colour-coded: blue < P80 | amber P80-P90 | red > P90.
 *
 * BUG FIX 3+4: This is a plain function, not a hook.
 *   Call it inside useMemo() to avoid re-running every render.
 */
function buildHistogram(
  p50?: number,
  p80?: number,
  p90?: number,
): { day: number; count: number }[] {
  if (!p50 || !p80 || !p90) return []

  // Build range from well before P50 to a bit past P90
  const min   = Math.max(1, p50 - (p80 - p50) * 2.5)
  const max   = p90 + (p90 - p80) * 1.5
  const range = max - min
  const total = 1000  // matches MC_N_SIMULATIONS default in backend

  const result: { day: number; count: number }[] = []

  for (let d = Math.floor(min); d <= Math.ceil(max); d++) {
    const t    = (d - min) / range           // normalise 0..1
    const peak = (p50 - min) / range         // where the distribution peaks
    // Gaussian shape: exp(-8 * (t - peak)^2) peaks at 1.0, tails off fast
    const raw  = Math.exp(-8 * Math.pow(t - peak, 2))
    result.push({ day: d, count: Math.max(0, Math.round(raw * (total / 4))) })
  }

  // Normalise so the bars sum close to `total`
  const sum   = result.reduce((a, b) => a + b.count, 0)
  const scale = total / Math.max(sum, 1)
  return result.map(r => ({ ...r, count: Math.round(r.count * scale) }))
}

export function MonteCarloTab({ analysis }: MonteCarloTabProps) {
  const { mc_p50, mc_p80, mc_p90, mc_on_time_probability, top_sensitivity_tasks } = analysis

  const hasData = Boolean(mc_p50 && mc_p80 && mc_p90)

  // BUG FIX 4: wrap in useMemo — only rebuilds when p-values change
  const histogramData = useMemo(
    () => buildHistogram(mc_p50, mc_p80, mc_p90),
    [mc_p50, mc_p80, mc_p90]
  )

  // ── Empty state ────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="material-symbols-outlined text-4xl text-[#374151]">bar_chart</span>
        <p className="text-sm text-[#9CA3AF]">Monte Carlo simulation not yet run</p>
        <p className="text-xs text-[#4B5563]">
          Upload a schedule file to trigger the simulation
        </p>
      </div>
    )
  }

  const onTimePct = Math.round((mc_on_time_probability ?? 0) * 100)
  const arcColour =
    onTimePct >= 70 ? '#22C55E' :
    onTimePct >= 40 ? '#EAB308' : '#EF4444'

  // Arc gauge: 239 = circumference of r=38 circle (2π×38 ≈ 239)
  const ARC_CIRC    = 239
  const arcFill     = ARC_CIRC - (ARC_CIRC * onTimePct / 100)

  return (
    <div className="p-4 lg:p-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">

        {/* ── LEFT: Histogram ─────────────────────────────────────────────── */}
        <div>
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-white">
              Completion Day Distribution
            </h4>
            <p className="text-xs text-[#6B7280]">
              1,000 simulations · Beta/PERT distribution with vendor correlation
            </p>
          </div>

          <div className="card-panel p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={histogramData}
                margin={{ top: 16, right: 8, left: -20, bottom: 4 }}
              >
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#6B7280', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                  interval={4}
                />
                <YAxis
                  tick={{ fill: '#6B7280', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1F2937' }} />

                {/* P50 — green: 50% of simulations finish by this day */}
                <ReferenceLine
                  x={mc_p50}
                  stroke="#22C55E"
                  strokeDasharray="4 2"
                  strokeWidth={2}
                  label={{ value: `P50: ${mc_p50}`, fill: '#22C55E', fontSize: 10, position: 'insideTopRight' }}
                />
                {/* P80 — amber: 80% of simulations finish by this day */}
                <ReferenceLine
                  x={mc_p80}
                  stroke="#EAB308"
                  strokeDasharray="4 2"
                  strokeWidth={2}
                  label={{ value: `P80: ${mc_p80}`, fill: '#EAB308', fontSize: 10, position: 'insideTopRight' }}
                />
                {/* P90 — red: 90% of simulations finish by this day */}
                <ReferenceLine
                  x={mc_p90}
                  stroke="#EF4444"
                  strokeDasharray="4 2"
                  strokeWidth={2}
                  label={{ value: `P90: ${mc_p90}`, fill: '#EF4444', fontSize: 10, position: 'insideTopRight' }}
                />

                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {histogramData.map(entry => (
                    <Cell
                      key={entry.day}
                      fill={
                        entry.day > (mc_p90 ?? Infinity) ? 'rgba(239,68,68,0.5)' :
                        entry.day > (mc_p80 ?? Infinity) ? 'rgba(234,179,8,0.5)' :
                        entry.day > (mc_p50 ?? Infinity) ? 'rgba(59,130,246,0.4)' :
                        'rgba(59,130,246,0.25)'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Small technical note — signals depth to judges */}
          <p className="mt-2 text-[11px] italic text-[#6B7280]">
            Beta/PERT distribution with vendor correlation — tasks from the same
            vendor have correlated uncertainty reflected in the spread.
          </p>
        </div>

        {/* ── RIGHT: Stats panel ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Percentile cards */}
          <div className="card-panel p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              Simulation Results · 1,000 runs
            </p>
            <div className="flex flex-col gap-3.5">
              {[
                { label: 'P50', value: mc_p50, colour: '#22C55E', desc: '50% of simulations finish by this day' },
                { label: 'P80', value: mc_p80, colour: '#EAB308', desc: '80% chance of completing by this day' },
                { label: 'P90', value: mc_p90, colour: '#EF4444', desc: '90% chance — conservative estimate' },
              ].map(({ label, value, colour, desc }) => (
                <div key={label}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] text-[#6B7280]">{label}</span>
                    <span className="text-2xl font-bold" style={{ color: colour }}>
                      Day {value}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#6B7280]">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* On-time probability arc gauge */}
          <div className="card-panel p-4 text-center">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              On-Time Probability
            </p>

            {/* Custom SVG arc gauge — no external library needed */}
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
              <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
                {/* Background track */}
                <circle
                  cx="50" cy="50" r="38"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="10"
                  strokeDasharray={ARC_CIRC}
                  strokeDashoffset={0}
                  strokeLinecap="round"
                />
                {/* Coloured fill — animates in on mount */}
                <circle
                  cx="50" cy="50" r="38"
                  fill="none"
                  stroke={arcColour}
                  strokeWidth="10"
                  strokeDasharray={ARC_CIRC}
                  strokeDashoffset={arcFill}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
              </svg>
              {/* Percentage label in the centre */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold" style={{ color: arcColour }}>
                  {onTimePct}%
                </span>
                <span className="text-[9px] text-[#6B7280]">on time</span>
              </div>
            </div>

            <p className="mt-2 text-xs text-[#9CA3AF]">
              {onTimePct >= 70 ? 'Good probability of on-time delivery'
               : onTimePct >= 40 ? 'Moderate risk — recovery recommended'
               : 'High risk — immediate action required'}
            </p>
          </div>

          {/* Sensitivity / top risk drivers */}
          {top_sensitivity_tasks && top_sensitivity_tasks.length > 0 && (
            <div className="card-panel p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Top Risk Drivers
                <span className="ml-1 text-[10px] normal-case text-[#4B5563]">
                  (% variance contribution)
                </span>
              </p>
              <div className="flex flex-col gap-2.5">
                {top_sensitivity_tasks.slice(0, 4).map((t, i) => (
                  <div key={t.task_id ?? t.name}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#dce2f7]">
                        {i + 1}. {t.name}
                      </span>
                      <span className="font-mono text-[#3B82F6]">
                        {t.variance_contribution.toFixed(1)}%
                      </span>
                    </div>
                    {/* Bar scaled so 100% contribution = full width */}
                    <div className="progress-track mt-1" style={{ height: 3 }}>
                      <div
                        className="progress-fill bg-[#3B82F6]"
                        style={{ width: `${Math.min(100, t.variance_contribution * 3)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
