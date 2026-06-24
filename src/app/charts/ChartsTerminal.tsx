'use client'

import { useEffect, useRef } from 'react'
import '../../styles/charts-terminal.css'
import { C, F } from '@/lib/charts/theme'

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

    // Apply saved theme mode (bg/axis/grid only — up/dn come from user cfg)
    const savedTheme = localStorage.getItem('traderra-theme')
    if (savedTheme === 'light') {
      document.body.classList.add('light')
      const overrides: Record<string, string> = { bg: '#e8e4d9', axisbg: '#ddd9cc', grid: '#d0cdc2', axisLabel: '#4a5580', axisMuted: '#6a7a9a', axisHighlight: '#3a4a6a', crossLabelBg: '#d8d4c8', crossLabelBd: '#b0a898' }
      Object.entries(overrides).forEach(([k, v]) => { (C as any)[k] = v })
      if (useUIStore.getState().theme !== 'light') useUIStore.setState({ theme: 'light' })
    }

    // Apply saved color cfg (up/dn + all customizations) — runs AFTER theme mode
    // so user's candle/vol colors are preserved on reload
    try {
      const raw = localStorage.getItem('traderra-cfg')
      if (raw) {
        const cfg = JSON.parse(raw)
        const { hexRgb: hrgb } = require('@/lib/charts/theme')
        if (cfg.up) { C.up = cfg.up; C.vol_up = `rgba(${hrgb(cfg.up).r},${hrgb(cfg.up).g},${hrgb(cfg.up).b},.5)` }
        if (cfg.dn) { C.dn = cfg.dn; C.vol_dn = `rgba(${hrgb(cfg.dn).r},${hrgb(cfg.dn).g},${hrgb(cfg.dn).b},.5)` }
        if (cfg.bg) C.bg = cfg.bg
        if (cfg.ax) C.axisbg = cfg.ax
        if (cfg.gr) C.grid = cfg.gr
        if (cfg.pre) C.pre = `rgba(${hrgb(cfg.pre).r},${hrgb(cfg.pre).g},${hrgb(cfg.pre).b},${(cfg.po||7)/100})`
        if (cfg.aft) C.after = `rgba(${hrgb(cfg.aft).r},${hrgb(cfg.aft).g},${hrgb(cfg.aft).b},${(cfg.ao||9)/100})`
        if (cfg.cr) C.cross = `rgba(${hrgb(cfg.cr).r},${hrgb(cfg.cr).g},${hrgb(cfg.cr).b},${(cfg.co||50)/100})`
        if (cfg.p) F.p = cfg.p
        if (cfg.t) F.t = cfg.t
        if (cfg.o) F.o = cfg.o
      }
    } catch {}

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

/** Profile icon — inline in TopBar flex layout */
export function ProfileIcon() {
  return (
    <div
      id="profile-icon"
      style={{
        cursor: 'pointer',
        width: 26, height: 26, borderRadius: '50%', background: '#2a3050',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: '#6a7a98', border: '1px solid #3a4a68',
        transition: 'all .15s', flexShrink: 0,
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
