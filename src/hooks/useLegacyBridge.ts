'use client'

import { useEffect } from 'react'
import { useUIStore } from '@/stores/charts'

/**
 * Bridge hook that syncs Zustand stores to the legacy JS globals.
 * This is the integration layer between React state and the old inline scripts.
 * As we extract more JS into stores, this bridge shrinks.
 */
export function useLegacyBridge() {
  const theme = useUIStore((s) => s.theme)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  // Sync theme → body.light class
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light')
    } else {
      document.body.classList.remove('light')
    }
  }, [theme])

  // Sync sidebar open state → #sidebar class
  useEffect(() => {
    const sb = document.getElementById('sidebar')
    if (sb) {
      if (sidebarOpen) {
        sb.classList.add('open')
      } else {
        sb.classList.remove('open')
      }
    }
  }, [sidebarOpen])
}
