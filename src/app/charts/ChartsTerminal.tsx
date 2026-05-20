'use client'

import { useEffect, useRef } from 'react'
import '../../styles/charts-terminal.css'

import { TopBar } from '@/components/charts/TopBar/TopBar'
import { LeftToolbar } from '@/components/charts/LeftToolbar/LeftToolbar'
import { AnnotationToolbar } from '@/components/charts/AnnotationToolbar/AnnotationToolbar'
import { MainArea } from '@/components/charts/MainArea/MainArea'
import { Sidebar } from '@/components/charts/Sidebar/Sidebar'
import { Overlays } from '@/components/charts/Overlays/Overlays'
import { useWatchlistStore } from '@/stores/charts/watchlistStore'
import { useUIStore } from '@/stores/charts/uiStore'

/**
 * ChartsTerminal — Pure React charts terminal.
 *
 * Legacy charts-engine.js is no longer loaded. React renders everything:
 * canvas (ReactChartPanel), layout, sidebar, overlays.
 *
 * charts-engine.js is kept in public/ as reference only.
 */
export default function ChartsTerminal({ userId, userName, userImage }: {
  userId: string
  userName: string
  userImage: string
}) {
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    // Set user context
    ;(window as any).__CHARTS_USER = { id: userId, name: userName, image: userImage }

    // Load persisted watchlist from localStorage
    useWatchlistStore.getState().load()

    // Hydrate client-only state from localStorage
    useUIStore.getState()._hydrateIndBtns()

    // Apply saved theme on mount
    const savedTheme = localStorage.getItem('traderra-theme')
    if (savedTheme === 'light' && useUIStore.getState().theme !== 'light') {
      useUIStore.getState().toggleTheme()
    }

    // Inject auth token
    fetch('/api/auth/token')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.token) localStorage.setItem('traderra-auth-token', data.token)
      })
      .catch(() => {})
  }, [userId, userName, userImage])

  return (
    <div style={{ display: 'contents' }}>
      <TopBar />
      <LeftToolbar />
      <AnnotationToolbar />
      <MainArea />
      <Sidebar />
      <Overlays />
    </div>
  )
}

/** Profile icon — lives inside the TopBar, absolute top-right */
export function ProfileIcon() {
  return (
    <div
      id="profile-icon"
      style={{
        position: 'absolute', top: 5, right: 8, cursor: 'pointer',
        width: 26, height: 26, borderRadius: '50%', background: '#2a3050',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: '#6a7a98', border: '1px solid #3a4a68',
        transition: 'all .15s', zIndex: 10,
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = '#D4AF37'
        e.currentTarget.style.color = '#D4AF37'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = '#3a4a68'
        e.currentTarget.style.color = '#6a7a98'
      }}
      title="Sign in to sync your data"
    >
      👤
    </div>
  )
}
