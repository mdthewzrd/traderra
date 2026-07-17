'use client'

import React from 'react'
import { useChatContext } from '@/contexts/TraderraContext'

/**
 * Global right-gutter for the Renata request inbox.
 * Pushes ALL page content left when the inbox panel is open, so the fixed
 * 400px panel never overlays the page (dashboard, /gap-stats, standalone pages).
 * Single source of truth — AppLayout no longer applies its own gutter.
 */
export function InboxPush({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen } = useChatContext()
  return (
    <div className={`transition-[padding] duration-300 ${isSidebarOpen ? 'pr-[400px]' : ''}`}>
      {children}
    </div>
  )
}
