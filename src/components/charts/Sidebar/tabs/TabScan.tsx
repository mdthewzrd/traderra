'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useChartStore } from '@/stores/charts/chartStore'

/**
 * TabScan — Scan panel with CSV upload, saved scans, results table.
 * Scans persist to localStorage. CSV upload parses and stores results.
 */

interface ScanResult {
  symbol: string
  date: string
  signal: string
  close: number
  volume: number
  [key: string]: any
}

interface ScanDef {
  id: string
  name: string
  type: 'csv' | 'builtin' | 'code'
  results?: ScanResult[]
  createdAt: number
}

const STORAGE_KEY = 'traderra-scans'

function loadScans(): ScanDef[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch { return [] }
}

function saveScans(scans: ScanDef[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scans))
}

export function TabScan() {
  const [scans, setScans] = useState<ScanDef[]>(loadScans)
  const [activeScan, setActiveScan] = useState<ScanDef | null>(null)
  const [results, setResults] = useState<ScanResult[]>([])
  const [mode, setMode] = useState<'live' | 'historical'>('live')
  const [status, setStatus] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const setChartSymbol = useChartStore(s => s.setSymbol)

  // Reload on mount
  useEffect(() => { setScans(loadScans()) }, [])

  // CSV parsing
  const parseCSV = useCallback((text: string): ScanResult[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const symIdx = headers.findIndex(h => ['symbol', 'sym', 'ticker'].includes(h))
    const dateIdx = headers.findIndex(h => ['date', 'time', 'datetime'].includes(h))
    const sigIdx = headers.findIndex(h => ['signal', 'type', 'action', 'side'].includes(h))
    const closeIdx = headers.findIndex(h => ['close', 'price', 'last'].includes(h))
    const volIdx = headers.findIndex(h => ['volume', 'vol'].includes(h))

    return lines.slice(1).filter(l => l.trim()).map(line => {
      const cols = line.split(',').map(c => c.trim())
      return {
        symbol: symIdx >= 0 ? cols[symIdx]?.toUpperCase() : '',
        date: dateIdx >= 0 ? cols[dateIdx] : '',
        signal: sigIdx >= 0 ? cols[sigIdx] : '',
        close: closeIdx >= 0 ? parseFloat(cols[closeIdx]) || 0 : 0,
        volume: volIdx >= 0 ? parseFloat(cols[volIdx]) || 0 : 0,
      }
    }).filter(r => r.symbol)
  }, [])

  const handleFileUpload = useCallback(() => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    const name = file.name.replace(/\.(csv|json)$/i, '')
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (!parsed.length) { setStatus('No valid results found in file'); return }

      const newScan: ScanDef = {
        id: 'scan-' + Date.now(),
        name,
        type: 'csv',
        results: parsed,
        createdAt: Date.now(),
      }
      const next = [...scans, newScan]
      setScans(next)
      saveScans(next)
      setActiveScan(newScan)
      setResults(parsed)
      setStatus(`Loaded ${parsed.length} results from ${file.name}`)
    }
    reader.readAsText(file)
  }, [scans, parseCSV])

  const deleteScan = useCallback((id: string) => {
    const next = scans.filter(s => s.id !== id)
    setScans(next)
    saveScans(next)
    if (activeScan?.id === id) { setActiveScan(null); setResults([]) }
  }, [scans, activeScan])

  const handleResultClick = useCallback((r: ScanResult) => {
    if (r.symbol) {
      setChartSymbol(r.symbol)
      ;(window as any).symbol = r.symbol
      ;(window as any).loadChart?.(r.symbol)
    }
  }, [setChartSymbol])

  return (
    <div id="tab-scan">
      <div id="scan-panel-header" style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #111620' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', letterSpacing: 1 }}>📡 SCANS</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8aa0c0', fontWeight: 700 }}>{results.length > 0 ? `${results.length} results` : ''}</span>
        <label style={{
          marginLeft: 6, background: 'none', border: '1px solid #4ade80', color: '#4ade80',
          fontSize: 14, width: 22, height: 22, borderRadius: 3, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }} title="Upload CSV">
          +
          <input ref={fileRef} type="file" accept=".csv,.json" style={{ display: 'none' }} onChange={handleFileUpload} />
        </label>
      </div>
      <div id="scan-panel-body" style={{ flex: 1, overflowY: 'auto', padding: 8 }}>

        {/* Saved scan list */}
        {scans.length > 0 && (
          <div id="scan-list" style={{ marginBottom: 8 }}>
            {scans.map(scan => (
              <div key={scan.id} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
                background: activeScan?.id === scan.id ? '#1a2030' : 'transparent',
                borderRadius: 3, cursor: 'pointer', marginBottom: 2,
                border: activeScan?.id === scan.id ? '1px solid #4ade80' : '1px solid transparent',
              }}
                onClick={() => { setActiveScan(scan); setResults(scan.results || []) }}
              >
                <span style={{ fontSize: 11, color: '#dde3f0', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {scan.type === 'csv' ? '📂' : '📡'} {scan.name}
                </span>
                <span style={{ fontSize: 10, color: '#4a6080' }}>{scan.results?.length || 0}</span>
                <span style={{ fontSize: 10, color: '#ff3d57', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); deleteScan(scan.id) }}>✕</span>
              </div>
            ))}
          </div>
        )}

        {/* Status */}
        {status && <div style={{ fontSize: 11, color: '#8aa0c0', marginBottom: 6, minHeight: 14 }}>{status}</div>}

        {/* No scans message */}
        {scans.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: '#4a6080', fontSize: 11 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📡</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>No scans yet</div>
            <div>Upload a CSV file to get started</div>
            <div style={{ marginTop: 8, fontSize: 10, color: '#3a4560' }}>
              CSV columns: symbol, date, signal, close, volume
            </div>
          </div>
        )}

        {/* Results table */}
        {results.length > 0 && (
          <div id="scan-results" style={{ fontSize: 11 }}>
            {/* Live/Historical toggle */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <button style={{
                flex: 1, padding: '4px 10px', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: '1px solid #2a3050', background: mode === 'live' ? '#1a2030' : 'none', color: mode === 'live' ? '#4ade80' : '#4a6080',
              }} onClick={() => setMode('live')}>LIVE</button>
              <button style={{
                flex: 1, padding: '4px 10px', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: '1px solid #2a3050', background: mode === 'historical' ? '#1a2030' : 'none', color: mode === 'historical' ? '#a855f7' : '#4a6080',
              }} onClick={() => setMode('historical')}>HIST</button>
            </div>

            {/* Results list */}
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {results.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px',
                  borderBottom: '1px solid #111620', cursor: 'pointer',
                }} onClick={() => handleResultClick(r)}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#1a2030')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ color: '#dde3f0', fontWeight: 700, width: 55, flexShrink: 0 }}>{r.symbol}</span>
                  <span style={{ color: '#4a6080', width: 70, flexShrink: 0 }}>{r.date}</span>
                  <span style={{ color: r.signal?.toLowerCase()?.includes('long') ? '#26a69a' : r.signal?.toLowerCase()?.includes('short') ? '#ef5350' : '#8aa0c0', fontWeight: 700, width: 50, flexShrink: 0 }}>{r.signal}</span>
                  <span style={{ color: '#8aa0c0', flex: 1, textAlign: 'right' }}>{r.close?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scan watchlist — clickable symbols */}
        {results.length > 0 && (
          <div id="scan-watchlist" style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, color: '#4a6080', fontWeight: 700, marginBottom: 4 }}>QUICK LOAD</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {[...new Set(results.map(r => r.symbol))].slice(0, 30).map(sym => (
                <button key={sym} style={{
                  background: '#1a1e2a', border: '1px solid #2a3050', color: '#dde3f0',
                  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
                }} onClick={() => handleResultClick({ symbol: sym } as ScanResult)}>{sym}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
