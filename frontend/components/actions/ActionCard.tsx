'use client'
import { useState } from 'react'
import { cn, timeAgo } from '@/lib/utils'
import type { Action, ActionPriority } from '@/types'
import { approveAction, rejectAction, completeAction } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'
import { canApprove } from '@/lib/auth'

interface ActionCardProps { action: Action; onStatusChange: () => void }
const PRIORITY_BORDER: Record<ActionPriority, string> = { critical: 'risk-border-critical', high: 'risk-border-high', medium: 'risk-border-medium', low: 'risk-border-low' }
const PRIORITY_BADGE: Record<ActionPriority, string> = { critical: 'badge-red', high: 'badge-orange', medium: 'badge-amber', low: 'badge-green' }
const REJECT_REASONS = ['Cost too high', 'Not feasible in current timeline', 'Wrong target task', 'Other reason']

export function ActionCard({ action, onStatusChange }: ActionCardProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0])
  const [actualDays, setActualDays] = useState(action.estimated_impact_days ?? 0)
  const userCanApprove = user ? canApprove(user.role) : false
  const priority = action.priority as ActionPriority

  async function handleApprove() {
    setIsBusy(true)
    const { error } = await approveAction(action.id)
    setIsBusy(false)
    if (error) { showToast('error', error); return }
    showToast('success', `Action approved`)
    onStatusChange()
  }
  async function handleReject() {
    setIsBusy(true)
    const { error } = await rejectAction(action.id, rejectReason)
    setIsBusy(false)
    if (error) { showToast('error', error); return }
    showToast('info', 'Action rejected — feedback saved')
    setShowReject(false); onStatusChange()
  }
  async function handleComplete() {
    setIsBusy(true)
    const { error } = await completeAction(action.id, actualDays)
    setIsBusy(false)
    if (error) { showToast('error', error); return }
    showToast('success', 'Action marked complete')
    setShowComplete(false); onStatusChange()
  }

  const isPending = action.status === 'pending'
  const isApproved = action.status === 'approved'
  const isCompleted = action.status === 'completed'
  const isRejected = action.status === 'rejected'

  return (
    <>
      <div className={cn('card-panel transition-all duration-150', PRIORITY_BORDER[priority], isRejected && 'opacity-60')}>
        <div className="cursor-pointer p-3.5" onClick={() => setExpanded(v => !v)}>
          <div className="flex items-center justify-between gap-2">
            <span className={cn('rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', PRIORITY_BADGE[priority])}>{action.priority}</span>
            {isApproved && <span className="badge-blue rounded px-1.5 py-0.5 text-[10px]">Approved</span>}
            {isCompleted && <span className="badge-green rounded px-1.5 py-0.5 text-[10px]">✓ Done</span>}
            {isRejected && <span className="badge-grey rounded px-1.5 py-0.5 text-[10px]">Rejected</span>}
          </div>
          <p className="mt-2 line-clamp-2 text-xs font-semibold leading-snug text-white">{action.description}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#6B7280]">
            {action.estimated_impact_days && <span className="metric-green font-medium">+{action.estimated_impact_days}d est.</span>}
            {action.confidence && <span className="text-[#A855F7]">{Math.round(action.confidence * 100)}% conf.</span>}
          </div>
          <p className="mt-2 flex items-center gap-1 text-[10px] text-[#6B7280]">
            <span className="material-symbols-outlined text-[12px] text-[#14B8A6]">auto_awesome</span>
            AI created · {timeAgo(action.created_at)}
          </p>
        </div>
        {expanded && (
          <div className="border-t border-[#1F2937] p-3.5 pt-3" onClick={e => e.stopPropagation()}>
            {isPending && userCanApprove && (
              <div className="flex gap-2">
                <button onClick={() => setShowReject(true)} disabled={isBusy} className="btn-reject flex-1 justify-center text-xs">Reject ✕</button>
                <button onClick={handleApprove} disabled={isBusy} className="btn-approve flex-1 justify-center text-xs">{isBusy ? 'Approving...' : 'Approve ✓'}</button>
              </div>
            )}
            {isPending && !userCanApprove && <p className="text-center text-xs text-[#6B7280]">Awaiting manager approval</p>}
            {isApproved && <button onClick={() => setShowComplete(true)} disabled={isBusy} className="btn-primary w-full justify-center text-xs">Mark Completed</button>}
          </div>
        )}
      </div>

      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm animate-slide-in-up rounded-lg border border-[#374151] bg-[#111827] p-5">
            <h4 className="text-sm font-semibold text-white">Why are you rejecting?</h4>
            <div className="mt-3 flex flex-col gap-2">
              {REJECT_REASONS.map(r => <label key={r} className="flex cursor-pointer items-center gap-2"><input type="radio" checked={rejectReason === r} onChange={() => setRejectReason(r)} className="accent-[#3B82F6]" /><span className="text-sm text-[#dce2f7]">{r}</span></label>)}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowReject(false)} className="btn-ghost text-sm">Cancel</button>
              <button onClick={handleReject} disabled={isBusy} className="btn-reject">{isBusy ? 'Rejecting...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {showComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm animate-slide-in-up rounded-lg border border-[#374151] bg-[#111827] p-5">
            <h4 className="text-sm font-semibold text-white">Record actual outcome</h4>
            <p className="mt-1 text-xs text-[#6B7280]">How many days were actually recovered?</p>
            <div className="mt-3">
              <label className="mb-1 block text-xs text-[#9CA3AF]">Actual days recovered</label>
              <input type="number" min={0} value={actualDays} onChange={e => setActualDays(Number(e.target.value))} className="input-dark" />
              {action.estimated_impact_days && <p className="mt-1 text-xs text-[#6B7280]">Estimated was: {action.estimated_impact_days} days</p>}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowComplete(false)} className="btn-ghost text-sm">Cancel</button>
              <button onClick={handleComplete} disabled={isBusy} className="btn-approve">{isBusy ? 'Saving...' : 'Save Outcome'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
