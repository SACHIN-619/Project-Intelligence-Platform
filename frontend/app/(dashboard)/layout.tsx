// app/(dashboard)/layout.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { MobileNav } from '@/components/layout/MobileNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0A0F1E]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#374151] border-t-[#3B82F6]" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-[#0A0F1E] bg-dot-grid">
      <Sidebar />
      <div className="flex min-h-screen flex-col lg:pl-[240px]">
        <Header />
        <main className="flex-1 pb-20 lg:pb-6">{children}</main>
      </div>
      <MobileNav />
    </div>
  )
}
