'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useChartStore, useDrawingStore, useUIStore } from '@/stores/charts'

/**
 * Bridge hook that syncs Zustand stores ↔ charts-engine.js global state.
 *
 * During the migration, charts-engine.js reads/writes global variables like:
 *   (window).symbol, (window)._magnetSnap, (window)._stayDraw, etc.
 *
 * This hook:
 * 1. Exposes store state to the window object so charts-engine.js can read it
 * 2. Listens for legacy mutation events and syncs back to Zustand
 * 3. Provides bridge functions that both update Zustand AND call legacy handlers
 *
 * Once charts-engine.js is fully replaced, this hook becomes unnecessary.
 */
export function useLegacyBridge() {
  const chartSymbol = useChartStore((s) => s.symbol)
  const setChartSymbol = useChartStore((s) => s.setSymbol)
  const activeTool = useDrawingStore((s) => s.activeTool)
  const setActiveTool = useDrawingStore((s) => s.setActiveTool)
  const magnetSnap = useDrawingStore((s) => s.magnetSnap)
  const setMagnetSnap = useDrawingStore((s) => s.setMagnetSnap)
  const stayDraw = useDrawingStore((s) => s.stayDraw)
  const setStayDraw = useDrawingStore((s) => s.setStayDraw)
  const lockAll = useDrawingStore((s) => s.lockAll)
  const setLockAll = useDrawingStore((s) => s.setLockAll)
  const hideAll = useDrawingStore((s) => s.hideAll)
  const setHideAll = useDrawingStore((s) => s.setHideAll)
  const theme = useUIStore((s) => s.theme)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const sidebarTab = useUIStore((s) => s.sidebarTab)

  const w = useRef(typeof window !== 'undefined' ? (window as any) : null)

  // ── Zustand → Window (one-way sync) ──
  useEffect(() => {
    if (!w.current) return
    const win = w.current

    // Expose current Zustand values on window for charts-engine.js to read
    win.__zustand_symbol = chartSymbol
    win.__zustand_activeTool = activeTool
    win.__zustand_magnetSnap = magnetSnap
    win.__zustand_stayDraw = stayDraw
    win.__zustand_lockAll = lockAll
    win.__zustand_hideAll = hideAll
    win.__zustand_theme = theme
    win.__zustand_sidebarOpen = sidebarOpen
    win.__zustand_sidebarTab = sidebarTab
  }, [chartSymbol, activeTool, magnetSnap, stayDraw, lockAll, hideAll, theme, sidebarOpen, sidebarTab])

  // ── Symbol input bridge ──
  useEffect(() => {
    if (!w.current) return
    const win = w.current
    // When charts-engine.js sets window.symbol, sync to Zustand
    const origSet = Object.getOwnPropertyDescriptor(win, 'symbol')?.set
    let _symbol = chartSymbol
    Object.defineProperty(win, 'symbol', {
      get() { return _symbol },
      set(v: string) {
        _symbol = v
        if (v && v !== chartSymbol) setChartSymbol(v)
        origSet?.call(win, v)
      },
      configurable: true,
    })
    return () => {
      // Cleanup - restore normal property
      delete win.symbol
      win.symbol = _symbol
    }
  }, [chartSymbol, setChartSymbol])

  // ── Tool selection bridge ──
  // Override window.setActiveTool to also update Zustand
  useEffect(() => {
    if (!w.current) return
    const win = w.current
    const origFn = win.setActiveTool
    win.setActiveTool = (tool: string | null) => {
      setActiveTool(tool)
      origFn?.(tool)
    }
    return () => { win.setActiveTool = origFn }
  }, [setActiveTool])

  // ── Magnet/stay/lock/hide bridge ──
  useEffect(() => {
    if (!w.current) return
    const win = w.current
    win._magnetSnap = magnetSnap
    win._stayDraw = stayDraw
    win._lockAll = lockAll
    win._hideAll = hideAll
  }, [magnetSnap, stayDraw, lockAll, hideAll])

  // ── Expose helper functions for React components to call legacy code ──
  const bridgeLoadSymbol = useCallback((sym: string) => {
    setChartSymbol(sym)
    if (w.current) {
      w.current.symbol = sym
      w.current.loadChart?.(sym)
    }
  }, [setChartSymbol])

  const bridgeToggleTool = useCallback((tool: string) => {
    setActiveTool(tool)
    if (w.current) w.current.setActiveTool?.(tool)
  }, [setActiveTool])

  const bridgeRenderAll = useCallback(() => {
    if (w.current) w.current.renderAll?.()
  }, [])

  return { bridgeLoadSymbol, bridgeToggleTool, bridgeRenderAll }
}
