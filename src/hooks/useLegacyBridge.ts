'use client'

import { useEffect } from 'react'
import { useUIStore, useDrawingStore } from '@/stores/charts'

/**
 * Bridge hook that syncs Zustand stores to the legacy JS globals.
 * This is the integration layer between React state and the old inline scripts.
 * As we extract more JS into stores, this bridge shrinks.
 */
export function useLegacyBridge() {
  const theme = useUIStore((s) => s.theme)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const liveMode = useUIStore((s) => s.liveMode)
  const showPriceLine = useUIStore((s) => s.showPriceLine)
  const useAdjusted = useUIStore((s) => s.useAdjusted)
  const cleanPrints = useUIStore((s) => s.cleanPrints)
  const barsVisible = useUIStore((s) => s.barsVisible)
  const activeLayout = useUIStore((s) => s.activeLayout)
  const activeTool = useDrawingStore((s) => s.activeTool)

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

  // Sync UI toggles → legacy globals
  useEffect(() => { (window as any).liveMode = liveMode }, [liveMode])
  useEffect(() => { (window as any).showPriceLine = showPriceLine }, [showPriceLine])
  useEffect(() => { (window as any).useAdjusted = useAdjusted }, [useAdjusted])
  useEffect(() => { (window as any).cleanPrints = cleanPrints }, [cleanPrints])
  useEffect(() => { (window as any).barsVisible = barsVisible }, [barsVisible])

  // Sync layout → update grid CSS
  useEffect(() => {
    const grid = document.getElementById('grid')
    if (!grid) return
    if (activeLayout === 1) {
      grid.style.gridTemplateColumns = '1fr'
      grid.style.gridTemplateRows = '1fr'
    } else if (activeLayout === 2) {
      grid.style.gridTemplateColumns = '1fr 1fr'
      grid.style.gridTemplateRows = '1fr'
    } else {
      grid.style.gridTemplateColumns = '1fr 1fr'
      grid.style.gridTemplateRows = '1fr 1fr'
    }
  }, [activeLayout])

  // Sync active tool → update left toolbar button states
  useEffect(() => {
    document.querySelectorAll('#left-toolbar .lt-btn, #left-toolbar .lt-fo-item').forEach((el) => {
      const elTool = el.getAttribute('data-tool')
      el.classList.toggle('active', elTool === activeTool || (!activeTool && elTool === ''))
    })
  }, [activeTool])
}
