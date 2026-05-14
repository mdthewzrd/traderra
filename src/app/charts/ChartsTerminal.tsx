'use client'

import { useEffect, useState, useCallback } from 'react'
import '../../styles/charts-terminal.css'
import { ChartCanvas } from '@/components/charts/ChartCanvas/ChartCanvas'
import { useChartStore } from '@/stores/charts/chartStore'
import { useUIStore as useUiStore } from '@/stores/charts/uiStore'

/**
 * ChartsTerminal — Pure React chart app.
 * No charts-engine.js. No legacy globals. No inline scripts.
 *
 * Architecture:
 *   Python indicators → /api/py/calc → useIndicator()
 *   Polygon data      → /api/chart-data/bars → useBars()
 *   Canvas rendering  → ChartCanvas (TS modules)
 *   State             → Zustand stores
 */
export default function ChartsTerminal({ userId, userName, userImage }: {
  userId: string
  userName: string
  userImage: string
}) {
  const symbol = useChartStore(s => s.symbol)
  const setSymbol = useChartStore(s => s.setSymbol)
  const tf = useChartStore(s => s.panels[0]?.tf || '5')
  const setTf = useChartStore(s => s.setPanelTf)
  const chartStyle = useUiStore(s => s.chartStyle)
  const setChartStyle = useUiStore(s => s.setChartStyle)
  const sidebarOpen = useUiStore(s => s.sidebarOpen)
  const toggleSidebar = useUiStore(s => s.toggleSidebar)

  const [symInput, setSymInput] = useState(symbol)
  const [styleDD, setStyleDD] = useState(false)

  const submitSymbol = useCallback(() => {
    const s = symInput.trim().toUpperCase()
    if (s && s !== symbol) setSymbol(s)
  }, [symInput, symbol, setSymbol])

  const TF_LIST = [
    { tf: '1', l: '1m' },
    { tf: '2', l: '2m' },
    { tf: '5', l: '5m' },
    { tf: '15', l: '15m' },
    { tf: '30', l: '30m' },
    { tf: '60', l: '1H' },
    { tf: 'D', l: '1D' },
    { tf: 'W', l: '1W' },
    { tf: 'M', l: '1M' },
  ]

  const STYLES = [
    { key: 'candles', label: '🕯 Candles' },
    { key: 'hollow', label: '◯ Hollow' },
    { key: 'ohlc', label: '┃ OHLC' },
    { key: 'line', label: '─ Line' },
    { key: 'area', label: '▓ Area' },
  ]

  return (
    <>
      {/* ── TOPBAR ── */}
      <div id="topbar">
        <div className="tbtn-row">
          <span id="logo" style={{ fontWeight: 900, fontSize: 13, color: '#D4AF37', letterSpacing: 1, marginRight: 6 }}>
            TRADEMAP
          </span>
          <input
            id="symbol-input"
            value={symInput}
            onChange={e => setSymInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitSymbol()}
            onBlur={submitSymbol}
            style={{
              background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0',
              borderRadius: 3, padding: '3px 8px', width: 72, fontSize: 12,
              fontWeight: 700, textTransform: 'uppercase' as const,
            }}
          />
          <div style={{ display: 'flex', gap: 2 }}>
            {TF_LIST.map(t => (
              <button
                key={t.tf}
                className={`tbtn ${tf === t.tf ? 'active' : ''}`}
                onClick={() => setTf(0, t.tf)}
              >
                {t.l}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 20, background: '#2a3050', margin: '0 3px' }} />
          <div style={{ position: 'relative' }}>
            <button className="tbtn" onClick={() => setStyleDD(!styleDD)}>
              {chartStyle === 'candles' ? '🕯' : chartStyle === 'line' ? '─' : chartStyle === 'area' ? '▓' : chartStyle === 'hollow' ? '◯' : '┃'} Style
            </button>
            {styleDD && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, background: '#1e222d',
                border: '1px solid #2a3050', borderRadius: 4, zIndex: 100, minWidth: 120,
              }}>
                {STYLES.map(s => (
                  <button
                    key={s.key}
                    className="tbtn"
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: chartStyle === s.key ? '#D4AF37' : undefined, color: chartStyle === s.key ? '#000' : undefined }}
                    onClick={() => { setChartStyle(s.key as any); setStyleDD(false) }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div className="tbtn-row">
          <button className="tbtn" onClick={() => toggleSidebar()}>
            {sidebarOpen ? '◀' : '▶'} Sidebar
          </button>
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        <ChartCanvas panelIdx={0} />
        {sidebarOpen && (
          <div style={{
            width: 340, flexShrink: 0, background: '#10131a',
            borderLeft: '2px solid #222840', overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
          }}>
            <SidebarContent />
          </div>
        )}
      </div>
    </>
  )
}

/** Sidebar with indicator list from Python API */
function SidebarContent() {
  const [indicators, setIndicators] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/py/indicators')
      .then(r => r.json())
      .then(data => { setIndicators(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 12, color: '#4a6080' }}>Loading indicators…</div>
  if (!indicators) return <div style={{ padding: 12, color: '#ef4444' }}>Failed to load indicators</div>

  const groups: Record<string, any[]> = {}
  for (const [key, schema] of Object.entries(indicators)) {
    const g = (schema as any).group || 'Other'
    if (!groups[g]) groups[g] = []
    groups[g].push({ key, ...(schema as any) })
  }

  return (
    <div style={{ padding: '8px 12px' }}>
      <div style={{ fontSize: 11, color: '#4a6080', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
        INDICATORS (Python)
      </div>
      {Object.entries(groups).map(([group, inds]) => (
        <div key={group} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#3a4a68', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{group}</div>
          {inds.map(ind => (
            <button
              key={ind.key}
              className="tbtn"
              style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 11, marginBottom: 2 }}
              title={ind.description}
            >
              {ind.name}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
