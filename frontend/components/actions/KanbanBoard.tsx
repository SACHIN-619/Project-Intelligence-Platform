'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ActionCard } from './ActionCard'
import type { KanbanColumn } from '@/lib/api'

interface KanbanBoardProps { columns: KanbanColumn[]; isLoading: boolean; onRefresh: () => void }
const COL_STYLE: Record<string, { dot: string; text: string }> = {
  pending:   { dot: 'bg-[#EAB308]', text: 'text-[#EAB308]' },
  approved:  { dot: 'bg-[#3B82F6]', text: 'text-[#3B82F6]' },
  completed: { dot: 'bg-[#22C55E]', text: 'text-[#22C55E]' },
  rejected:  { dot: 'bg-[#6B7280]', text: 'text-[#6B7280]' },
}

// BUG FIX 12: proper top-level component — useState legal here
function MobileKanban({ columns, onRefresh }: { columns: KanbanColumn[]; onRefresh: () => void }) {
  const [active, setActive] = useState('pending')
  const actions = columns.find(c => c.status === active)?.actions || []
  return (
    <div className="lg:hidden">
      <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {columns.map(col => {
          const s = COL_STYLE[col.status] || COL_STYLE['pending']
          return (
            <button key={col.status} onClick={() => setActive(col.status)} className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors', active === col.status ? 'bg-[#1F2937] text-white' : 'text-[#6B7280] hover:text-white')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
              {col.label}
              <span className="badge-grey ml-0.5 rounded px-1 text-[10px]">{col.count}</span>
            </button>
          )
        })}
      </div>
      <div className="flex flex-col gap-2.5">
        {actions.length === 0
          ? <div className="card-panel p-6 text-center"><p className="text-sm text-[#6B7280]">No {active} actions</p></div>
          : actions.map(a => <ActionCard key={a.id} action={a} onStatusChange={onRefresh} />)
        }
      </div>
    </div>
  )
}

export function KanbanBoard({ columns, isLoading, onRefresh }: KanbanBoardProps) {
  if (isLoading) return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="skeleton h-8 w-32 rounded" />
          <div className="skeleton h-28 w-full rounded-md" />
          <div className="skeleton h-20 w-full rounded-md" />
        </div>
      ))}
    </div>
  )
  const total = columns.reduce((a, c) => a + c.count, 0)
  if (total === 0) return (
    <div className="card-panel flex flex-col items-center gap-3 py-16 text-center">
      <span className="material-symbols-outlined text-4xl text-[#374151]">view_kanban</span>
      <div>
        <p className="text-sm font-medium text-white">No actions yet</p>
        <p className="mt-1 text-xs text-[#6B7280]">Run a recovery simulation to generate action items</p>
      </div>
    </div>
  )
  return (
    <>
      <div className="hidden grid-cols-4 gap-3 lg:grid">
        {columns.map(col => {
          const s = COL_STYLE[col.status] || COL_STYLE['pending']
          return (
            <div key={col.status} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', s.dot)} />
                <h3 className={cn('text-xs font-semibold uppercase tracking-wider', s.text)}>{col.label}</h3>
                <span className="ml-auto rounded-full bg-[#1F2937] px-1.5 py-0.5 text-[10px] text-[#9CA3AF]">{col.count}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {col.actions.length === 0
                  ? <div className="rounded-md border border-dashed border-[#374151] p-4 text-center"><p className="text-[11px] text-[#6B7280]">Empty</p></div>
                  : col.actions.map(a => <ActionCard key={a.id} action={a} onStatusChange={onRefresh} />)
                }
              </div>
            </div>
          )
        })}
      </div>
      <MobileKanban columns={columns} onRefresh={onRefresh} />
    </>
  )
}
