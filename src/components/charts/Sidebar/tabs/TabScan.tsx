'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useChartStore } from '@/stores/charts/chartStore'
import { useUIStore } from '@/stores/charts/uiStore'

/**
 * TabScan — Full scan panel matching original HTML design.
 * Features: saved scan list, run controls, date range with presets,
 * filter modes, CSV upload, results table, quick-load watchlist.
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
  type: 'csv' | 'builtin' | 'code' | 'spec'
  results?: ScanResult[]
  createdAt: number
}

const STORAGE_KEY = 'traderra-scans'

const BUILTIN_SCANS: ScanDef[] = [
  { id: 'builtin-backside-b', name: 'Backside B', type: 'builtin', createdAt: Date.now() },
  { id: 'builtin-gap-up', name: 'Gap Up', type: 'builtin', createdAt: Date.now() },
  { id: 'builtin-high-tight-flag', name: 'High Tight Flag', type: 'builtin', createdAt: Date.now() },
  { id: 'builtin-aparascan', name: 'Aparascan', type: 'builtin', createdAt: Date.now() },
]

function loadScans(): ScanDef[] {
  // Only show built-in scans, clear all old accumulated runs
  localStorage.removeItem(STORAGE_KEY)
  return [...BUILTIN_SCANS]
}

function cleanupScans(scans: ScanDef[]): ScanDef[] {
  // Keep built-ins + deduplicate by name (keep latest only)
  const map = new Map<string, ScanDef>()
  for (const s of BUILTIN_SCANS) map.set(s.name.toLowerCase(), s)
  for (const s of scans) {
    if (s.type === 'builtin') continue // already added
    map.set(s.name.toLowerCase(), s)
  }
  return Array.from(map.values())
}

function saveScans(scans: ScanDef[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scans))
}

export function TabScan() {
  const [scans, setScans] = useState<ScanDef[]>(loadScans)
  const [activeScan, setActiveScan] = useState<ScanDef | null>(null)
  const [results, setResults] = useState<ScanResult[]>([])
  const [scanMode, setScanMode] = useState<'live' | 'historical'>('live')
  const [filterMode, setFilterMode] = useState<'1' | '2' | '3'>('3')
  const [status, setStatus] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addTab, setAddTab] = useState<'upload' | 'builtin' | 'code'>('upload')
  const [addName, setAddName] = useState('')
  const [addCode, setAddCode] = useState('')
  const [scanFrom, setScanFrom] = useState('')
  const [scanTo, setScanTo] = useState('')
  const [scanning, setScanning] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const scanNavigate = useChartStore(s => s.scanNavigate)

  // Reload on mount
  useEffect(() => { setScans(loadScans()) }, [])

  // Handle incoming scan
  const receiveScan = useCallback((scan: ScanDef) => {
    const existing = loadScans()
    // Replace existing scan with same name, or append
    const updated = [...existing.filter(s => s.name.toLowerCase() !== scan.name.toLowerCase()), scan]
    saveScans(updated)
    setScans(updated)
    setActiveScan(scan)
    setResults(scan.results || [])
    setStatus(`✅ ${scan.results?.length || 0} signals from ${scan.name}`)
    const ui = useUIStore.getState()
    ui.setAgentChatOpen(false)
    ui.setSidebarTab('scan')
  }, [])

  // Listen for scans from local agent chat
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as ScanDef
      receiveScan(detail)
    }
    window.addEventListener('traderra-scans-update', handler)
    return () => window.removeEventListener('traderra-scans-update', handler)
  }, [receiveScan])

  // Poll DB for pushed scans
  useEffect(() => {
    let lastCount = 0
    let interval: ReturnType<typeof setInterval>
    const fetchDBScans = async () => {
      try {
        const res = await fetch('/api/scans')
        if (!res.ok) return
        const data = await res.json()
        const dbScans: any[] = data.scans || []
        if (dbScans.length <= lastCount && lastCount > 0) return
        lastCount = dbScans.length
        const local = loadScans()
        const localIds = new Set(local.map(s => s.id))
        const newScans: ScanDef[] = []
        for (const dbs of dbScans) {
          if (localIds.has(dbs.id)) continue
          const detailRes = await fetch(`/api/scans/${dbs.id}`)
          if (!detailRes.ok) continue
          const detail = await detailRes.json()
          newScans.push({
            id: dbs.id,
            name: dbs.name || 'DB Scan',
            type: dbs.type || 'code',
            results: Array.isArray(detail.results) ? detail.results : [],
            createdAt: new Date(dbs.createdAt).getTime(),
          })
        }
        if (newScans.length > 0) {
          // Merge: replace by name, don't duplicate
          const merged = [...local]
          for (const ns of newScans) {
            const idx = merged.findIndex(s => s.name.toLowerCase() === ns.name.toLowerCase())
            if (idx >= 0) merged[idx] = ns
            else merged.push(ns)
          }
          saveScans(merged)
          setScans(merged)
          const latest = newScans[newScans.length - 1]
          setActiveScan(latest)
          setResults(latest.results || [])
          setStatus(`✅ ${latest.results?.length || 0} signals from ${latest.name}`)
          const ui = useUIStore.getState()
          ui.setAgentChatOpen(false)
          ui.setSidebarTab('scan')
        }
      } catch {}
    }
    fetchDBScans()
    interval = setInterval(fetchDBScans, 5000)
    return () => clearInterval(interval)
  }, [])

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
    const name = addName || file.name.replace(/\.(csv|json)$/i, '')
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (!parsed.length) { setStatus('No valid results found in file'); return }
      const newScan: ScanDef = { id: 'scan-' + Date.now(), name, type: 'csv', results: parsed, createdAt: Date.now() }
      const next = [...scans, newScan]
      setScans(next)
      saveScans(next)
      setActiveScan(newScan)
      setResults(parsed)
      setStatus(`Loaded ${parsed.length} results from ${file.name}`)
      setShowAddModal(false)
    }
    reader.readAsText(file)
  }, [scans, parseCSV, addName])

  // Drop zone handler
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (!file) return
    const name = addName || file.name.replace(/\.(csv|json|py|js)$/i, '')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'csv') {
        const parsed = parseCSV(text)
        if (!parsed.length) { setStatus('No valid results found'); return }
        const newScan: ScanDef = { id: 'scan-' + Date.now(), name, type: 'csv', results: parsed, createdAt: Date.now() }
        const next = [...scans, newScan]
        setScans(next)
        saveScans(next)
        setActiveScan(newScan)
        setResults(parsed)
        setStatus(`Loaded ${parsed.length} results`)
        setShowAddModal(false)
      } else {
        // Store as code scan
        const newScan: ScanDef = { id: 'scan-' + Date.now(), name, type: 'code', createdAt: Date.now() }
        const next = [...scans, newScan]
        setScans(next)
        saveScans(next)
        setActiveScan(newScan)
        setStatus(`Code file loaded: ${file.name}`)
        setShowAddModal(false)
      }
    }
    reader.readAsText(file)
  }, [scans, parseCSV, addName])

  // Run scan via API
  const handleRunScan = useCallback(async () => {
    if (!activeScan) return
    setScanning(true)
    setStatus('Running scan...')
    try {
      const res = await fetch('/api/scans/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spec: activeScan.name.toLowerCase().replace(/\s+/g, '-'),
          from: scanFrom || undefined,
          to: scanTo || undefined,
          filterMode,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setStatus(`❌ ${data.error}`)
      } else {
        const signals = data.signals || []
        const updated = { ...activeScan, results: signals }
        const nextScans = scans.map(s => s.id === activeScan.id ? updated : s)
        setScans(nextScans)
        saveScans(nextScans)
        setActiveScan(updated)
        setResults(signals)
        setStatus(`✅ ${signals.length} signals`)
      }
    } catch (err: any) {
      setStatus(`❌ ${err.message}`)
    } finally {
      setScanning(false)
    }
  }, [activeScan, scanFrom, scanTo, filterMode, scans])

  const deleteScan = useCallback((id: string) => {
    const next = scans.filter(s => s.id !== id)
    setScans(next)
    saveScans(next)
    if (activeScan?.id === id) { setActiveScan(null); setResults([]) }
  }, [scans, activeScan])

  const handleResultClick = useCallback((r: ScanResult) => {
    if (r.symbol) {
      ;(window as any).symbol = r.symbol
      ;(window as any).loadChart?.(r.symbol)
      if (r.date) {
        // Normalize to plain date string (strip time component)
        const day = r.date.length > 10 ? r.date.slice(0, 10) : r.date
        scanNavigate(r.symbol, day)
      } else {
        scanNavigate(r.symbol, null)
      }
    }
  }, [scanNavigate])

  // Date presets
  const setDatePreset = useCallback((days: number) => {
    const to = new Date()
    const from = new Date(to.getTime() - days * 86400000)
    setScanFrom(from.toISOString().slice(0, 10))
    setScanTo(to.toISOString().slice(0, 10))
  }, [])

  const btnStyle = (active: boolean, color = '#4ade80') => ({
    flex: 1, padding: '4px 10px', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${active ? color : '#2a3050'}`,
    background: active ? `${color}18` : 'none',
    color: active ? color : '#4a6080',
  })

  return (
    <div id="tab-scan">
      {/* Header */}
      <div id="scan-panel-header" style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #111620' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', letterSpacing: 1 }}>📡 SCANS</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8aa0c0', fontWeight: 700 }}>{results.length > 0 ? `${results.length} results` : ''}</span>
        {/* Column settings cog */}
        <button title="Column settings" style={{ marginLeft: 6, background: 'none', border: '1px solid #3a4a68', color: '#5a7090', fontSize: 13, width: 22, height: 22, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>⚙</button>
        {/* Add scan button */}
        <button title="Add scan" onClick={() => setShowAddModal(true)} style={{ marginLeft: 4, background: 'none', border: '1px solid #4ade80', color: '#4ade80', fontSize: 14, width: 22, height: 22, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
      </div>

      <div id="scan-panel-body" style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {/* Saved scan list */}
        {scans.length > 0 && (
          <div id="scan-list" style={{ marginBottom: 8 }}>
            {scans.map(scan => (
              <div key={scan.id} className="scan-list-item"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', marginBottom: 2,
                  background: activeScan?.id === scan.id ? '#12201a' : '#0d1220',
                  border: activeScan?.id === scan.id ? '1px solid #4ade80' : '1px solid #1e2840',
                  borderRadius: 4, cursor: 'pointer', transition: 'border-color .15s, background .15s',
                }}
                onClick={() => { setActiveScan(scan); setResults(scan.results || []) }}
                onMouseOver={(e) => { if (activeScan?.id !== scan.id) { e.currentTarget.style.borderColor = '#4ade80'; e.currentTarget.style.background = '#111a28' } }}
                onMouseOut={(e) => { if (activeScan?.id !== scan.id) { e.currentTarget.style.borderColor = '#1e2840'; e.currentTarget.style.background = '#0d1220' } }}
              >
                <span style={{ fontSize: 11, color: '#dde3f0', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {scan.type === 'csv' ? '📂' : scan.type === 'spec' ? '📡' : '📡'} {scan.name}
                </span>
                <span className="scan-meta" style={{ fontSize: 11, color: '#4a6080', whiteSpace: 'nowrap' }}>{scan.results?.length || 0}</span>
                <span className="scan-del" style={{ background: 'none', border: 'none', color: '#4a6080', fontSize: 14, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }} onClick={(e) => { e.stopPropagation(); deleteScan(scan.id) }} onMouseOver={(e) => (e.currentTarget.style.color = '#ef5350')} onMouseOut={(e) => (e.currentTarget.style.color = '#4a6080')}>✕</span>
              </div>
            ))}
          </div>
        )}

        {/* Run controls (shown when a scan is selected) */}
        {activeScan && (
          <div id="scan-run-controls" style={{ marginBottom: 6 }}>
            {/* Active scan label + run button */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
              <div style={{ flex: 1, background: '#1a1e2e', border: '1px solid #4ade80', color: '#4ade80', fontSize: 11, fontWeight: 700, padding: '4px 6px', borderRadius: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeScan.name}
              </div>
              <button onClick={handleRunScan} disabled={scanning} style={{ background: scanning ? '#2a3050' : '#4ade80', color: scanning ? '#4a6080' : '#000', border: 'none', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 3, cursor: scanning ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                {scanning ? '⏳' : '▶ SCAN'}
              </button>
            </div>

            {/* LIVE / HIST toggle */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <button className={`scan-tab${scanMode === 'live' ? ' active' : ''}`} style={btnStyle(scanMode === 'live')} onClick={() => setScanMode('live')}>LIVE</button>
              <button className={`scan-tab${scanMode === 'historical' ? ' active' : ''}`} style={btnStyle(scanMode === 'historical', '#a855f7')} onClick={() => setScanMode('historical')}>HIST</button>
            </div>

            {/* Date range (shown in HIST mode) */}
            {scanMode === 'historical' && (
              <div id="scan-date-range" style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#6a80a0', fontWeight: 700 }}>FROM</span>
                  <input type="date" value={scanFrom} onChange={e => setScanFrom(e.target.value)} style={{ flex: 1, background: '#1a1e2e', border: '1px solid #a855f7', color: '#a855f7', fontSize: 11, padding: '3px 5px', borderRadius: 3, outline: 'none' }} />
                  <span style={{ fontSize: 11, color: '#6a80a0', fontWeight: 700 }}>TO</span>
                  <input type="date" value={scanTo} onChange={e => setScanTo(e.target.value)} style={{ flex: 1, background: '#1a1e2e', border: '1px solid #a855f7', color: '#a855f7', fontSize: 11, padding: '3px 5px', borderRadius: 3, outline: 'none' }} />
                </div>
                {/* Date presets */}
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  {[{ label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '6M', days: 180 }, { label: '1Y', days: 365 }, { label: '2Y', days: 730 }].map(p => (
                    <button key={p.days} onClick={() => setDatePreset(p.days)} style={{ flex: 1, background: 'none', border: '1px solid #2a3050', color: '#4a6080', fontSize: 11, fontWeight: 700, padding: 4, borderRadius: 3, cursor: 'pointer' }}>{p.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Filter modes */}
            <div id="scan-filters" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#6a80a0', fontWeight: 700 }}>FILTER:</span>
              <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                {[
                  { value: '1' as const, label: 'F1', color: '#4ade80' },
                  { value: '2' as const, label: 'F2', color: '#38bdf8' },
                  { value: '3' as const, label: 'Both', color: '#f59e0b' },
                ].map(f => (
                  <label key={f.value} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: filterMode === f.value ? f.color : '#4a6080', cursor: 'pointer', border: `1px solid ${filterMode === f.value ? f.color : '#1e2840'}`, padding: '2px 6px', borderRadius: 3, background: filterMode === f.value ? `${f.color}18` : 'transparent' }}>
                    <input type="radio" name="scan-filter" value={f.value} checked={filterMode === f.value} onChange={() => setFilterMode(f.value)} style={{ accentColor: f.color }} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Status */}
        {status && <div id="scan-status" style={{ fontSize: 11, color: '#8aa0c0', marginBottom: 6, minHeight: 14 }}>{status}</div>}

        {/* No scans message */}
        {scans.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: '#4a6080', fontSize: 11 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📡</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>No scans yet</div>
            <div>Upload a CSV or ask Renata to push scans</div>
            <div style={{ marginTop: 8, fontSize: 10, color: '#3a4560' }}>
              CSV columns: symbol, date, signal, close, volume
            </div>
          </div>
        )}

        {/* Results table */}
        {results.length > 0 && (
          <div id="scan-results" style={{ fontSize: 11 }}>
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

        {/* Quick-load watchlist */}
        {results.length > 0 && (
          <div id="scan-watchlist" style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, color: '#4a6080', fontWeight: 700, marginBottom: 4 }}>QUICK LOAD</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {[...new Set(results.map(r => r.symbol))].slice(0, 30).map(sym => {
                const latestResult = results.find(r => r.symbol === sym)
                return (
                <button key={sym} className="scan-item" style={{
                  background: '#1a1e2a', border: '1px solid #2a3050', color: '#dde3f0',
                  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
                  transition: 'transform .1s',
                }} onClick={() => handleResultClick({ symbol: sym, date: latestResult?.date || '' } as ScanResult)}>{sym}</button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Scan Modal */}
      {showAddModal && (
        <div id="scan-add-modal" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, background: 'rgba(0,0,0,.7)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          onClick={() => setShowAddModal(false)}>
          <div id="scan-add-box" style={{ background: '#0c0e14', border: '1px solid #2a3050', borderRadius: 8, width: 440, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, padding: '14px 16px', fontSize: 13, fontWeight: 700, color: '#4ade80', letterSpacing: 1, borderBottom: '1px solid #1e2840' }}>＋ ADD SCAN</h3>
            <div style={{ padding: '0 16px', overflowY: 'auto', flex: 1 }}>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, margin: '10px 0 8px' }}>
                {(['upload', 'builtin', 'code'] as const).map(tab => (
                  <button key={tab} onClick={() => setAddTab(tab)} style={{
                    flex: 1, padding: 6, borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: '1px solid #2a3050',
                    background: addTab === tab ? '#1a2030' : 'none',
                    color: addTab === tab ? '#4ade80' : '#4a6080',
                  }}>{tab === 'upload' ? '📤 UPLOAD' : tab === 'builtin' ? '📡 BUILT-IN' : '💻 CODE'}</button>
                ))}
              </div>
              {/* Name input */}
              <input type="text" placeholder="Scan name" value={addName} onChange={e => setAddName(e.target.value)} style={{ width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 12, padding: '6px 10px', borderRadius: 4, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />

              {/* Upload tab */}
              {addTab === 'upload' && (
                <div ref={dropRef} onDragOver={e => { e.preventDefault(); e.stopPropagation(); dropRef.current?.classList.add('dragover') }} onDragLeave={() => dropRef.current?.classList.remove('dragover')} onDrop={handleDrop}
                  style={{ border: '2px dashed #2a3050', borderRadius: 6, padding: 28, textAlign: 'center', cursor: 'pointer', margin: '12px 0' }}>
                  <div style={{ fontSize: 28, color: '#4ade80', marginBottom: 6 }}>📂</div>
                  <p style={{ color: '#dde3f0', fontWeight: 700, fontSize: 12, margin: '4px 0' }}>Drop file or click to upload</p>
                  <p style={{ color: '#6a80a0', fontSize: 11, margin: '4px 0' }}>CSV, JSON, or Python scan files</p>
                  <input ref={fileRef} type="file" accept=".csv,.json,.py,.js" style={{ display: 'none' }} onChange={handleFileUpload} />
                  <button onClick={() => fileRef.current?.click()} style={{ marginTop: 8, background: '#4ade80', color: '#000', border: 'none', padding: '4px 12px', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Browse</button>
                </div>
              )}

              {/* Built-in tab */}
              {addTab === 'builtin' && (
                <div>
                  <select style={{ width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 12, padding: '6px 10px', borderRadius: 4, margin: '4px 0' }}>
                    <option value="gap_up">Gap Up</option>
                    <option value="backside_b">Backside B</option>
                    <option value="high_tight_flag">High Tight Flag</option>
                    <option value="aparascan">Aparascan</option>
                  </select>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: '#4a6080' }}>FROM</label>
                      <input type="date" value={scanFrom} onChange={e => setScanFrom(e.target.value)} style={{ width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#a855f7', fontSize: 11, padding: '4px 6px', borderRadius: 3, outline: 'none' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: '#4a6080' }}>TO</label>
                      <input type="date" value={scanTo} onChange={e => setScanTo(e.target.value)} style={{ width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#a855f7', fontSize: 11, padding: '4px 6px', borderRadius: 3, outline: 'none' }} />
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: '#4a6080', marginTop: 6 }}>Creates a saved scan and runs it. Results are stored.</p>
                </div>
              )}

              {/* Code tab */}
              {addTab === 'code' && (
                <div>
                  <textarea value={addCode} onChange={e => setAddCode(e.target.value)} placeholder="// Paste scan code here...&#10;// Must export: function scan(dayMaps, dates, filterMode) → results[]" style={{ width: '100%', height: 140, background: '#0a0c12', border: '1px solid #2a3050', color: '#dde3f0', fontFamily: 'monospace', fontSize: 11, padding: 8, borderRadius: 4, resize: 'vertical', outline: 'none' }} />
                  <p style={{ fontSize: 11, color: '#4a6080', marginTop: 4 }}>Python code receives date range and returns results[].</p>
                </div>
              )}
            </div>
            {/* Modal buttons */}
            <div style={{ display: 'flex', gap: 6, padding: '12px 16px', borderTop: '1px solid #1e2840' }}>
              <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: 8, border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#1a1e2e', color: '#6a80a0' }}>Cancel</button>
              <button style={{ flex: 1, padding: 8, border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#a855f7', color: '#fff' }}>🤖 Validate & Fix</button>
              <button onClick={() => { if (addTab === 'upload') handleFileUpload(); else setShowAddModal(false) }} style={{ flex: 1, padding: 8, border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#4ade80', color: '#000' }}>Save Scan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
