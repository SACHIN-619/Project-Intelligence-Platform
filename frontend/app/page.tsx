// app/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function RootPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    router.replace(isAuthenticated ? '/dashboard' : '/login')
  }, [isAuthenticated, isLoading, router])

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0A0F1E]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#374151] border-t-[#3B82F6]" />
        <p className="text-sm text-[#6B7280]">Loading PII...</p>
      </div>
    </div>
  )
}
