'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Traderra platform sub-nav — the (main) route group.
 * Shown via AppLayout's pageHeaderContent so every traderra page can reach
 * Dashboard, Trades, Journal, Calendar, Statistics, etc.
 */
const traderraPages = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Trades', href: '/trades' },
  { name: 'Journal', href: '/journal' },
  { name: 'Calendar', href: '/calendar' },
  { name: 'Statistics', href: '/statistics' },
  { name: 'Analytics', href: '/analytics' },
  { name: 'Research', href: '/research' },
  { name: 'Settings', href: '/settings' },
]

export function TraderraSubNav() {
  const pathname = usePathname()
  return (
    <div className="flex items-center gap-0.5 px-4 py-1.5">
      {traderraPages.map((page) => {
        const isActive = pathname === page.href || pathname.startsWith(page.href + '/')
        return (
          <a
            key={page.href}
            href={page.href}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
              isActive
                ? 'bg-primary/15 text-primary'
                : 'text-[#777] hover:text-[#bbb] hover:bg-[#222]'
            )}
          >
            {page.name}
          </a>
        )
      })}
    </div>
  )
}
