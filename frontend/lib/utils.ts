// lib/utils.ts
// Small reusable helpers used across components

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes safely (handles conflicts) */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number with + sign for positive delays */
export function formatDelay(days: number): string {
  if (days === 0) return '0'
  return days > 0 ? `+${days}` : `${days}`
}

/** Format percentage from 0-1 float to "78%" */
export function formatPct(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/** Format a confidence dot string e.g. "●●●●○ 87%" */
export function confidenceDots(value: number): string {
  const filled = Math.round(value * 5)
  return '●'.repeat(filled) + '○'.repeat(5 - filled)
}

/** Relative time e.g. "2 hours ago" */
export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Format file size in human readable form */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Get initials from a full name for avatar fallback */
export function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Simple debounce for search inputs */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/** Animate a number counting up — returns intermediate values via callback */
export function animateCountUp(
  from: number,
  to: number,
  duration: number,
  onUpdate: (value: number) => void,
  onComplete?: () => void
): () => void {
  const startTime = performance.now()
  let frameId: number

  function tick(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3)
    const value = from + (to - from) * eased
    onUpdate(value)

    if (progress < 1) {
      frameId = requestAnimationFrame(tick)
    } else {
      onComplete?.()
    }
  }
  frameId = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(frameId)
}

/** Severity sort order — for sorting risk/action lists */
export const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function sortBySeverity<T extends { severity?: string; priority?: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const aKey = a.severity ?? a.priority ?? 'low'
    const bKey = b.severity ?? b.priority ?? 'low'
    return (SEVERITY_ORDER[aKey] ?? 9) - (SEVERITY_ORDER[bKey] ?? 9)
  })
}
