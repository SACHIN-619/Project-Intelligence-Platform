// components/ui/Toast.tsx
'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const ICON: Record<ToastType, string> = {
  success: 'check_circle',
  error:   'error',
  info:    'info',
}

const COLOUR_CLASS: Record<ToastType, string> = {
  success: 'border-[#22C55E] bg-[#22C55E]/10 text-[#22C55E]',
  error:   'border-[#EF4444] bg-[#EF4444]/10 text-[#EF4444]',
  info:    'border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6]',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed right-4 top-16 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              'flex animate-slide-in-right items-center gap-2.5 rounded-md border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur',
              COLOUR_CLASS[t.type]
            )}
          >
            <span className="material-symbols-outlined text-base">{ICON[t.type]}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
