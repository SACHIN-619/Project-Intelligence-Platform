// app/layout.tsx
// CRITICAL FIX: Material Symbols must be loaded via <link> tags in <head>
// NOT via @import in globals.css — Next.js doesn't guarantee CSS @import
// order which causes icons to render as text instead of symbols.

import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProjectProvider } from '@/contexts/ProjectContext'
import { ToastProvider } from '@/components/ui/Toast'

export const metadata: Metadata = {
  title: 'PII — Project Intelligence Interface',
  description: 'AI-powered EPC project intelligence platform for data centre construction.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0A0F1E',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Preconnect for faster font loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Inter + JetBrains Mono — UI text fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />

        {/* Material Symbols Outlined — ALL icons across every page
            This MUST be a <link> tag, not @import in CSS.
            Variable font supports all weights and fill states. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0A0F1E] text-[#dce2f7] antialiased">
        <AuthProvider>
          <ProjectProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </ProjectProvider>
        </AuthProvider>
      </body>
    </html>
  )
}