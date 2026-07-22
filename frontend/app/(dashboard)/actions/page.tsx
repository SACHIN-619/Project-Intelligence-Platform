'use client'

import { useEffect, useState, useCallback } from 'react'
import { useProjectContext } from '@/contexts/ProjectContext'
import { useRouter } from 'next/navigation'
import { getActionBoard } from '@/lib/api'
import { KanbanBoard } from '@/components/actions/KanbanBoard'
import type { KanbanColumn } from '@/lib/api'

export default function ActionsPage() {
  const router = useRouter()
  const { activeProject } = useProjectContext()
  const [columns, setColumns]     = useState<KanbanColumn[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const loadBoard = useCallback(async () => {
    if (!activeProject) { setIsLoading(false); return }
    setIsLoading(true); setError(null)
    const { data, error: err } = await getActionBoard(activeProject.id)
    if (err) setError(err)
    setColumns(data || [])
    setIsLoading(false)
  }, [activeProject])

  useEffect(() => { loadBoard() }, [loadBoard])

  if (!isLoading && !activeProject) return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="material-symbols-outlined text-4xl text-[#374151]">folder_off</span>
      <p className="text-sm text-white">No project selected</p>
      <button onClick={() => router.push('/dashboard')} className="btn-primary text-sm">
        Go to Dashboard
      </button>
    </div>
  )

  const pending   = columns.find(c => c.status === 'pending')?.count   || 0
  const approved  = columns.find(c => c.status === 'approved')?.count  || 0
  const completed = columns.find(c => c.status === 'completed')?.count || 0
  const rejected  = columns.find(c => c.status === 'rejected')?.count  || 0

  return (
    <div className="p-4 lg:p-6">

      {/* Header */}
      <div className="mb-5 flex items-center justify-between border-b border-[#1a2235] pb-4">
        <div>
          <h1 className="text-xl font-bold text-white lg:text-2xl">Actions Board</h1>
          <p className="mt-0.5 text-sm text-[#6B7280]">
            Track, approve, and complete recovery actions
          </p>
        </div>
        <button onClick={() => router.push('/recovery')} className="btn-primary text-sm">
          <span className="material-symbols-outlined text-base">add</span>
          New Simulation
        </button>
      </div>

      {/* Count strip */}
      {!isLoading && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Pending Approval', value: pending,   colour: '#EAB308', icon: 'pending' },
            { label: 'Approved',         value: approved,  colour: '#3B82F6', icon: 'thumb_up' },
            { label: 'Completed',        value: completed, colour: '#22C55E', icon: 'check_circle' },
            { label: 'Rejected',         value: rejected,  colour: '#6B7280', icon: 'cancel' },
          ].map(({ label, value, colour, icon }, i) => (
            <div
              key={label}
              className="card-panel animate-entrance flex items-center gap-3 p-4"
              style={{ borderTop: `2px solid ${colour}`, animationDelay: `${i * 80}ms` }}
            >
              <span
                className="material-symbols-outlined text-2xl"
                style={{ color: colour, fontVariationSettings: "'FILL' 1" }}
              >
                {icon}
              </span>
              <div>
                <p className="text-2xl font-extrabold" style={{ color: colour }}>{value}</p>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#6B7280]">
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#EF4444]/30
                        bg-[#EF4444]/10 p-3">
          <span className="material-symbols-outlined text-base text-[#EF4444]">error</span>
          <p className="text-sm text-[#EF4444]">{error}</p>
        </div>
      )}

      {/* Kanban board */}
      <KanbanBoard columns={columns} isLoading={isLoading} onRefresh={loadBoard} />
    </div>
  )
}