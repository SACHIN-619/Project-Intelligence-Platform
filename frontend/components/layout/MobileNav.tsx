// components/layout/MobileNav.tsx
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const MOBILE_NAV = [
  { label: 'Dashboard', href: '/dashboard',    icon: 'dashboard'  },
  { label: 'Intel',     href: '/intelligence', icon: 'psychology' },
  { label: 'Recovery',  href: '/recovery',     icon: 'biotech'    },
  { label: 'AI',        href: '/assistant',    icon: 'smart_toy'  },
]

export function MobileNav() {
  const pathname = usePathname()
  const { user } = useAuth()

  if (!user) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center
                    border-t border-[#1a2235] bg-[#080d1a]/95 backdrop-blur-md
                    lg:hidden"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {MOBILE_NAV.map(item => {
        const isActive = pathname === item.href ||
          (item.href !== '/dashboard' && pathname.startsWith(item.href))

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1',
              'min-h-[44px] transition-all duration-150',
              isActive ? 'text-[#3B82F6]' : 'text-[#4B5563] hover:text-[#6B7280]'
            )}
          >
            {/* Icon — MUST use font-variation-settings for fill state */}
            <span
              className="material-symbols-outlined text-[24px]"
              style={{
                fontVariationSettings: isActive
                  ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
                  : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}
            >
              {item.icon}
            </span>

            {/* Label */}
            <span className={cn(
              'text-[10px] leading-none',
              isActive ? 'font-semibold text-[#3B82F6]' : 'text-[#4B5563]'
            )}>
              {item.label}
            </span>

            {/* Active dot indicator */}
            {isActive && (
              <span className="absolute bottom-1 h-0.5 w-6 rounded-full bg-[#3B82F6]" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}