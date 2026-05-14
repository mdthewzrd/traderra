'use client'

import { useUIStore, useChartStore, useWatchlistStore } from '@/stores/charts'
import { useEffect, useRef, useMemo } from 'react'
import { SIDEBAR_TABS_HTML } from './sidebar-tabs-html'

/**
 * Sidebar — the right-side panel with watchlist, tabs, and settings.
 * 
 * Strategy:
 * - Watchlist section: fully React/Zustand (interactive)
 * - Tab bar: React controls active tab via Zustand
 * - Tab content: original HTML via dangerouslySetInnerHTML (contains all element IDs 
 *   that charts-engine.js needs for settingsSync, vaultRender, scan panels, etc.)
 * - React applies `tab-active` class based on Zustand sidebarTab to control visibility
 */

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const sidebarTab = useUIStore((s) => s.sidebarTab)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const setSidebarTab = useUIStore((s) => s.setSidebarTab)

  // Watchlist state
  const wlLists = useWatchlistStore((s) => s.lists)
  const wlActiveIdx = useWatchlistStore((s) => s.activeIdx)
  const wlAddSymbol = useWatchlistStore((s) => s.addSymbol)
  const wlSwitchList = useWatchlistStore((s) => s.switchList)
  const wlDeleteList = useWatchlistStore((s) => s.deleteList)
  const wlRenameList = useWatchlistStore((s) => s.renameList)
  const wlCreateList = useWatchlistStore((s) => s.createList)
  const wlRemoveSymbol = useWatchlistStore((s) => s.removeSymbol)
  const setChartSymbol = useChartStore((s) => s.setSymbol)
  const sbRef = useRef<HTMLDivElement>(null)

  // Sync sidebar open/close + bridge sbOpen/sbClose for charts-engine.js
  useEffect(() => {
    const el = sbRef.current
    if (!el) return
    if (sidebarOpen) el.classList.add('open')
    else el.classList.remove('open')
    ;(window as any).sbOpen = (tab?: string) => {
      setSidebarOpen(true)
      if (tab) setSidebarTab(tab)
    }
    ;(window as any).sbClose = () => setSidebarOpen(false)
  }, [sidebarOpen, setSidebarOpen, setSidebarTab])

  // Apply tab-active class to the correct tab content div
  useEffect(() => {
    const content = sbRef.current?.querySelector('#sidebar-content')
    if (!content) return
    content.querySelectorAll(':scope > div').forEach((d: HTMLDivElement) => {
      d.classList.toggle('tab-active', d.id === `tab-${sidebarTab}`)
    })
  }, [sidebarTab])

  return (
    <div id="sidebar" ref={sbRef} className={sidebarOpen ? 'open' : ''}>
      {/* Watchlist — fully React */}
      <div id="wl-section">
        <div id="wl-head" onClick={() => document.getElementById('wl-section')?.classList.toggle('collapsed')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span id="wl-chevron" style={{ color: '#4a5580', fontSize: 11 }}>▼</span>
            <select
              id="wl-picker"
              value={wlActiveIdx}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => wlSwitchList(parseInt(e.target.value))}
            >
              {wlLists.map((l, i) => (
                <option key={i} value={i}>{l.name}</option>
              ))}
            </select>
            <button onClick={(e) => { e.stopPropagation(); const name = prompt('Watchlist name:'); if (name) wlCreateList(name) }} title="New Watchlist" style={{ background: 'none', border: '1px solid #2a3050', color: '#4a6080', fontSize: 11, padding: '1px 4px', borderRadius: 2, cursor: 'pointer' }}>+</button>
            <button onClick={(e) => { e.stopPropagation(); wlDeleteList() }} title="Delete Watchlist" style={{ background: 'none', border: '1px solid #2a3050', color: '#4a6080', fontSize: 11, padding: '1px 4px', borderRadius: 2, cursor: 'pointer' }}>🗑</button>
            <button onClick={(e) => { e.stopPropagation(); const name = prompt('New name:', wlLists[wlActiveIdx]?.name); if (name) wlRenameList(name) }} title="Rename" style={{ background: 'none', border: '1px solid #2a3050', color: '#4a6080', fontSize: 11, padding: '1px 4px', borderRadius: 2, cursor: 'pointer' }}>✏</button>
            <button onClick={(e) => { e.stopPropagation(); (window as any).wlColSettings?.() }} title="Columns" style={{ background: 'none', border: '1px solid #2a3050', color: '#4a6080', fontSize: 11, padding: '1px 4px', borderRadius: 2, cursor: 'pointer' }}>⚙</button>
          </div>
          <span id="wl-count" style={{ color: '#4a5580', fontSize: 11 }}>{wlLists[wlActiveIdx]?.syms?.length || 0}</span>
        </div>
        <div id="wl-body">
          <div id="wl-col-header" />
          <div id="wl-list">
            {wlLists[wlActiveIdx]?.syms?.map((sym) => (
              <div
                key={sym}
                className={`wl-row${(window as any).symbol === sym ? ' active' : ''}`}
                onClick={() => {
                  setChartSymbol(sym)
                  ;(window as any).symbol = sym
                  ;(window as any).renderAll?.()
                }}
              >
                <span className="wl-sym">{sym}</span>
                <span className="wl-del" onClick={(e) => { e.stopPropagation(); wlRemoveSymbol(sym) }}>✕</span>
              </div>
            ))}
          </div>
          <div id="wl-add">
            <input
              id="wl-add-input"
              type="text"
              placeholder="+ symbol"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value
                  if (val.trim()) {
                    wlAddSymbol(val)
                    ;(e.target as HTMLInputElement).value = ''
                  }
                }
              }}
            />
            <button onClick={() => {
              const inp = document.getElementById('wl-add-input') as HTMLInputElement
              if (inp?.value.trim()) { wlAddSymbol(inp.value); inp.value = '' }
            }}>+</button>
          </div>
        </div>
      </div>

      {/* Tab Bar — React controlled */}
      <div id="sidebar-tabs">
        {['look', 'tools', 'settings', 'vault', 'scan', 'bt', 'lab'].map(tab => (
          <div
            key={tab}
            className={`sb-tab${sidebarTab === tab ? ' active' : ''}`}
            data-tab={tab}
            onClick={() => { setSidebarTab(tab); (window as any).sbTab?.(tab) }}
          >
            {tab.toUpperCase()}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div className="sb-tab" onClick={() => setSidebarOpen(false)} style={{ color: '#4a5580', paddingRight: 10 }}>✕</div>
      </div>

      {/* Tab Content — original HTML for charts-engine.js interop */}
      {/* React applies tab-active class via useEffect above */}
      <div id="sidebar-content" dangerouslySetInnerHTML={{ __html: SIDEBAR_TABS_HTML }} />
    </div>
  )
}
