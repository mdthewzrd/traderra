'use client'

/**
 * TabScan — Scan panel with CSV upload, results display, and scan list.
 * Basic version: CSV upload + results table.
 */

import { useState, useCallback } from 'react'

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
}

export function TabScan() {
  const [scans, setScans] = useState<ScanDef[]>([])
  const [activeScan, setActiveScan] = useState<ScanDef | null>(null)
  const [results, setResults] = useState<ScanResult[]>([])
  const [mode, setMode] = useState<'live' | 'historical'>('live')

  const handleCSVUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseScanCSV(text)
      const scan: ScanDef = {
        id: 'scan_' + Date.now(),
        name: file.name.replace('.csv', ''),
        type: 'csv',
        results: parsed,
      }
      setScans(prev => [...prev, scan])
      setActiveScan(scan)
      setResults(parsed)
    }
    reader.readAsText(file)
  }, [])

  const handleResultClick = useCallback((result: ScanResult) => {
    // Load the symbol into the chart
    const { useChartStore } = require('@/stores/charts/chartStore')
    useChartStore.getState().setSymbol(result.symbol)
  }, [])

  const deleteScan = useCallback((id: string) => {
    setScans(prev => prev.filter(s => s.id !== id))
    if (activeScan?.id === id) {
      setActiveScan(null)
      setResults([])
    }
  }, [activeScan])

  return (
    <div id="tab-scan">
      <div id="scan-panel-header" style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #111620' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', letterSpacing: 1 }}>📡 SCANS</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8aa0c0', fontWeight: 700 }}>{scans.length} scan{scans.length !== 1 ? 's' : ''}</span>
        <label
          title="Upload CSV scan"
          style={{
            marginLeft: 6, background: 'none', border: '1px solid #4ade80', color: '#4ade80',
            fontSize: 14, width: 22, height: 22, borderRadius: 3, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          +
          <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSVUpload} />
        </label>
      </div>

      {/* Scan List */}
      <div style={{ maxHeight: 120, overflowY: 'auto', borderBottom: '1px solid #111620' }}>
        {scans.map(scan => (
          <div
            key={scan.id}
            style={{
              display: 'flex', alignItems: 'center', padding: '4px 10px', cursor: 'pointer',
              background: activeScan?.id === scan.id ? '#1a2040' : 'transparent',
              borderBottom: '1px solid #0a0c14',
            }}
            onClick={() => { setActiveScan(scan); setResults(scan.results || []) }}
          >
            <span style={{ fontSize: 10, color: scan.type === 'csv' ? '#4ade80' : '#38bdf8', fontWeight: 700, marginRight: 6 }}>
              {scan.type === 'csv' ? 'CSV' : scan.type === 'builtin' ? 'BT' : 'PY'}
            </span>
            <span style={{ flex: 1, fontSize: 11, color: '#dde3f0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {scan.name}
            </span>
            <span style={{ fontSize: 10, color: '#4a6080', marginRight: 6 }}>
              {scan.results?.length || 0}
            </span>
            <button
              style={{ background: 'none', border: 'none', color: '#4a6080', cursor: 'pointer', fontSize: 10 }}
              onClick={(e) => { e.stopPropagation(); deleteScan(scan.id) }}
            >✕</button>
          </div>
        ))}
        {scans.length === 0 && (
          <div style={{ padding: '12px 10px', fontSize: 11, color: '#3a4560', textAlign: 'center' }}>
            Upload a CSV file to start scanning
          </div>
        )}
      </div>

      {/* Mode Toggle */}
      {activeScan && (
        <div style={{ display: 'flex', gap: 4, padding: '6px 10px', borderBottom: '1px solid #111620' }}>
          <button
            style={{
              flex: 1, padding: '3px 0', borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              border: mode === 'live' ? '1px solid #4ade80' : '1px solid #2a3050',
              background: mode === 'live' ? '#4ade8018' : 'none',
              color: mode === 'live' ? '#4ade80' : '#4a6080',
            }}
            onClick={() => setMode('live')}
          >LIVE</button>
          <button
            style={{
              flex: 1, padding: '3px 0', borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              border: mode === 'historical' ? '1px solid #a855f7' : '1px solid #2a3050',
              background: mode === 'historical' ? '#a855f718' : 'none',
              color: mode === 'historical' ? '#a855f7' : '#4a6080',
            }}
            onClick={() => setMode('historical')}
          >HIST</button>
        </div>
      )}

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {results.map((r, i) => (
          <div
            key={i}
            onClick={() => handleResultClick(r)}
            style={{
              padding: '4px 10px',
              display: 'grid',
              gridTemplateColumns: '55px 65px 1fr 60px',
              gap: 6,
              fontSize: 10,
              alignItems: 'center',
              cursor: 'pointer',
              background: i % 2 === 0 ? 'transparent' : '#0a0c12',
              borderBottom: '1px solid #0a0c14',
            }}
          >
            <span style={{ color: '#dde3f0', fontWeight: 700 }}>{r.symbol}</span>
            <span style={{ color: '#8aa0c0' }}>{r.date?.slice(0, 10)}</span>
            <span style={{ color: '#6a80a0' }}>{r.signal || '—'}</span>
            <span style={{ color: '#8aa0c0', textAlign: 'right' }}>{r.close?.toFixed(2) || '—'}</span>
          </div>
        ))}
        {activeScan && results.length === 0 && (
          <div style={{ padding: '20px 10px', textAlign: 'center', fontSize: 11, color: '#3a4560' }}>
            No results in this scan
          </div>
        )}
      </div>
    </div>
  )
}

function parseScanCSV(text: string): ScanResult[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const results: ScanResult[] = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim())
    if (vals.length < 2) continue
    const row: any = {}
    headers.forEach((h, j) => { row[h] = vals[j] || '' })
    results.push({
      symbol: (row.symbol || row.ticker || row.sym || '').toUpperCase(),
      date: row.date || row.d || '',
      signal: row.signal || row.type || '',
      close: parseFloat(row.close || row.price || row.c || '0'),
      volume: parseInt(row.volume || row.vol || row.v || '0') || 0,
    })
  }
  return results
}
