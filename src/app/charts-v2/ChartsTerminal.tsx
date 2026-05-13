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
import { shareTemplate, shareScan, importSharedItem, checkAutoImport } from '@/lib/charts/sharing'
import { useWatchlistStore } from '@/stores/charts'

interface ChartsTerminalProps {
  userId: string
  userName: string
  userImage: string
}

/**
 * Phase 2: React component shell for the charts app.
 * HTML structure is now React components. JS logic still loaded from static file.
 * Future phases will extract JS into Zustand stores + React hooks.
 */
export default function ChartsTerminal({ userId, userName, userImage }: ChartsTerminalProps) {
  const scriptsLoaded = useRef(false)

  // Bridge Zustand → legacy JS globals
  useLegacyBridge()

  useEffect(() => {
    // Inject user context
    ;(window as any).__CHARTS_USER = { id: userId, name: userName, image: userImage }

    if (scriptsLoaded.current) return
    scriptsLoaded.current = true

    // Expose sharing functions as globals (bridge for inline scripts)
    ;(window as any).shareTemplate = shareTemplate
    ;(window as any).shareScan = shareScan
    ;(window as any).importSharedItem = importSharedItem

    // Expose watchlist store as legacy globals
    const wl = useWatchlistStore.getState
    ;(window as any).wlGet = () => useWatchlistStore.getState().getSymbols()
    ;(window as any).wlAdd = () => {
      const inp = document.getElementById('wl-add-input') as HTMLInputElement
      if (inp?.value.trim()) { useWatchlistStore.getState().addSymbol(inp.value); inp.value = '' }
    }
    ;(window as any).wlRemove = (sym: string) => useWatchlistStore.getState().removeSymbol(sym)
    ;(window as any).wlSwitchList = (idx: string) => useWatchlistStore.getState().switchList(parseInt(idx))
    ;(window as any).wlGetData = () => ({ lists: useWatchlistStore.getState().lists, active: useWatchlistStore.getState().activeIdx })

    // Load watchlist from localStorage
    useWatchlistStore.getState().load()

    // Check for auto-import from URL
    checkAutoImport()

    // Load the JS logic from the static file
    const loadScripts = async () => {
      try {
        const resp = await fetch('/charts-terminal.html')
        const html = await resp.text()
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')

        // Load vault.js
        if (!document.querySelector('script[src="/indicators/vault.js"]')) {
          const vaultScript = document.createElement('script')
          vaultScript.src = '/indicators/vault.js'
          document.body.appendChild(vaultScript)
        }

        // Extract and execute inline scripts in order
        const scripts = doc.querySelectorAll('script')
        scripts.forEach(oldScript => {
          if (oldScript.src) return // already handled vault.js
          const newScript = document.createElement('script')
          newScript.textContent = oldScript.textContent || ''
          document.body.appendChild(newScript)
        })

        // Fire user-ready event
        window.dispatchEvent(new CustomEvent('charts-user-ready', {
          detail: (window as any).__CHARTS_USER,
        }))
      } catch (err) {
        console.error('Failed to load charts scripts:', err)
      }
    }

    loadScripts()
  }, [userId, userName, userImage])

  return (
    <>
      {/* Profile icon */}
      <div id="profile-icon" style={{
        position: 'fixed', top: 6, right: 12, zIndex: 9999, cursor: 'pointer',
        width: 28, height: 28, borderRadius: '50%', background: '#2a3050',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: '#6a7a98', border: '1px solid #3a4a68',
        transition: 'all .15s',
      }} title="Sign in to sync your data">👤</div>

      <TopBar />
      <LeftToolbar />
      <AnnotationToolbar />
      <MainArea />
      <Sidebar />
      <Overlays />
    </>
  )
}
