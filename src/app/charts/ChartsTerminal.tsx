'use client'

import { useEffect, useRef } from 'react'
import '../../styles/charts-terminal.css'

import { TopBar } from '@/components/charts/TopBar/TopBar'
import { LeftToolbar } from '@/components/charts/LeftToolbar/LeftToolbar'
import { AnnotationToolbar } from '@/components/charts/AnnotationToolbar/AnnotationToolbar'
import { MainArea } from '@/components/charts/MainArea/MainArea'
import { Sidebar } from '@/components/charts/Sidebar/Sidebar'
import { Overlays } from '@/components/charts/Overlays/Overlays'
import { useLegacyBridge } from '@/hooks/useLegacyBridge'
import { useUIStore } from '@/stores/charts/uiStore'

/**
 * ChartsTerminal — React component composition with charts-engine.js interop.
 *
 * Phase 1 complete: HTML is now real React components, not dangerouslySetInnerHTML.
 * charts-engine.js is still loaded for canvas rendering, events, and state.
 * Elements preserve the same IDs so charts-engine.js can find them via getElementById.
 *
 * Gradual migration path:
 * - Phase 2: Wire state to components (replace DOM manipulation with Zustand)
 * - Phase 3: Canvas engine → React (ChartCanvas component + TS render modules)
 * - Phase 4: Indicators → Python API
 * - Phase 5: Kill charts-engine.js entirely
 */
export default function ChartsTerminal({ userId, userName, userImage }: {
  userId: string
  userName: string
  userImage: string
}) {
  const loaded = useRef(false)

  // Bridge Zustand ↔ charts-engine.js global state
  useLegacyBridge()

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    // Set user context for charts-engine.js
    ;(window as any).__CHARTS_USER = { id: userId, name: userName, image: userImage }

    // Inject auth token for CloudStore
    fetch('/api/auth/token')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.token) localStorage.setItem('traderra-auth-token', data.token)
      })
      .catch(() => {})
      .then(() => {
        // Load scripts in order — same as the original HTML
        const load = (src: string) => new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = src
          s.onload = () => resolve()
          s.onerror = () => reject(new Error('Failed: ' + src))
          document.body.appendChild(s)
        })
        return load('/indicators/vault.js')
          .then(() => load('/charts-engine.js'))
          .then(() => load('/charts-engine-footer.js'))
      })
      .then(() => {
        console.log('[Charts] loaded')
        window.dispatchEvent(new CustomEvent('charts-user-ready', {
          detail: (window as any).__CHARTS_USER,
        }))
        // After engine loads, trigger active tab content population
        // (vaultRender, openSingleIndSettings, ScanManager, etc.)
        setTimeout(() => {
          const activeTab = useUIStore.getState().sidebarTab
          ;(window as any).sbTab?.(activeTab)
        }, 200)
      })
      .catch(err => console.error('[Charts] script load failed:', err))
  }, [userId, userName, userImage])

  return (
    <div style={{ display: 'contents' }}>
      {/* Profile icon — fixed top right */}
      <ProfileIcon />

      {/* Structured layout components — preserve IDs for charts-engine.js interop */}
      <TopBar />
      <LeftToolbar />
      <AnnotationToolbar />
      <MainArea />
      <Sidebar />
      <Overlays />
    </div>
  )
}

/** Profile icon — fixed top right corner */
function ProfileIcon() {
  return (
    <div
      id="profile-icon"
      style={{
        position: 'fixed', top: 6, right: 12, zIndex: 9999, cursor: 'pointer',
        width: 28, height: 28, borderRadius: '50%', background: '#2a3050',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: '#6a7a98', border: '1px solid #3a4a68',
        transition: 'all .15s',
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
