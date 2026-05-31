'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useChartStore } from '@/stores/charts/chartStore'

/**
 * ChartDateNav — global date navigator for the charts TopBar.
 * Gold styling, range-capable calendar dropdown, inline typing.
 */

function stepTradingDay(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  const dir = days > 0 ? 1 : -1
  let remaining = Math.abs(days)
  while (remaining > 0) {
    d.setDate(d.getDate() + dir)
    if (d.getDay() !== 0 && d.getDay() !== 6) remaining--
  }
  return d.toISOString().slice(0, 10)
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${days[d.getDay()]} ${mm}/${dd}`
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

const QUICK_RANGES = [
  { label: '5D', days: 5 },
  { label: 'MTD', days: null },
  { label: '1M', days: 22 },
  { label: '3M', days: 66 },
  { label: 'YTD', days: null },
  { label: '1Y', days: 252 },
]

function getQuickRangeEndDate(): string {
  const d = new Date()
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function getQuickRangeStart(label: string): string {
  const end = new Date(getQuickRangeEndDate() + 'T12:00:00')
  const start = new Date(end)
  if (label === 'MTD') {
    start.setDate(1)
    while (start.getDay() === 0 || start.getDay() === 6) start.setDate(start.getDate() + 1)
    return start.toISOString().slice(0, 10)
  }
  if (label === 'YTD') {
    start.setMonth(0, 2)
    while (start.getDay() === 0 || start.getDay() === 6) start.setDate(start.getDate() + 1)
    return start.toISOString().slice(0, 10)
  }
  const range = QUICK_RANGES.find(r => r.label === label)
  if (range?.days) return stepTradingDay(getQuickRangeEndDate(), -range.days)
  return todayStr()
}

const GOLD = '#D4AF37'

/** Calendar with range selection — click once for start, twice for end */
function RangeCalendar({
  rangeStart,
  rangeEnd,
  onSelectRange,
}: {
  rangeStart: string
  rangeEnd: string
  onSelectRange: (start: string, end: string) => void
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const ref = rangeStart || todayStr()
    const d = new Date(ref + 'T12:00:00')
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [pendingStart, setPendingStart] = useState<string | null>(null)

  const today = todayStr()
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()

  const cells: { date: string; day: number; inMonth: boolean }[] = []
  for (let i = 0; i < firstDay; i++) {
    const d = new Date(year, month, -firstDay + i + 1)
    cells.push({ date: d.toISOString().slice(0, 10), day: d.getDate(), inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month, day).toISOString().slice(0, 10), day, inMonth: true })
  }
  const remaining = 42 - cells.length
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i)
    cells.push({ date: d.toISOString().slice(0, 10), day: d.getDate(), inMonth: false })
  }

  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const isWeekend = (ds: string) => { const d = new Date(ds + 'T12:00:00'); return d.getDay() === 0 || d.getDay() === 6 }
  const isFuture = (ds: string) => ds > today

  // Effective range for highlighting
  const effStart = pendingStart || rangeStart
  const effEnd = pendingStart ? null : rangeEnd
  const rangeMin = effStart && effEnd ? (effStart < effEnd ? effStart : effEnd) : effStart
  const rangeMax = effStart && effEnd ? (effStart < effEnd ? effEnd : effStart) : null

  const handleClick = (date: string) => {
    if (isFuture(date) || isWeekend(date)) return
    if (!pendingStart) {
      // First click — set start, clear end
      setPendingStart(date)
      onSelectRange(date, '')
    } else {
      // Second click — set end, commit
      const s = pendingStart < date ? pendingStart : date
      const e = pendingStart < date ? date : pendingStart
      setPendingStart(null)
      onSelectRange(s, e)
    }
  }

  return (
    <div style={{ padding: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button onClick={() => setViewMonth(new Date(year, month - 1, 1))} style={calNavBtn}>◂</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#dde3f0' }}>{monthLabel}</span>
        <button onClick={() => setViewMonth(new Date(year, month + 1, 1))} style={calNavBtn}>▸</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
          <div key={i} style={{ fontSize: 10, color: '#4a5580', textAlign: 'center', fontWeight: 600, height: 22, lineHeight: '22px' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((c, i) => {
          const isSel = c.date === effStart || c.date === effEnd
          const inRange = rangeMin && rangeMax && c.date >= rangeMin && c.date <= rangeMax
          const isTod = c.date === today
          const disabled = isFuture(c.date) || isWeekend(c.date)
          let bg = 'transparent'
          let color = '#4a5580'
          if (!c.inMonth) color = '#2a3050'
          else if (disabled) color = '#1a1e2a'
          else if (isSel || (pendingStart && c.date === pendingStart)) { bg = GOLD; color = '#000' }
          else if (inRange) { bg = `${GOLD}22`; color = GOLD }
          else if (isTod) { bg = '#1a2540'; color = '#dde3f0' }
          else color = '#8a9ab0'
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => handleClick(c.date)}
              style={{
                height: 26, fontSize: 12, border: 'none', borderRadius: 3,
                background: bg, color, cursor: disabled ? 'default' : 'pointer',
                fontWeight: (isSel || (pendingStart && c.date === pendingStart)) ? 800 : isTod ? 700 : 400,
                transition: 'background 0.1s',
              }}
            >{c.day}</button>
          )
        })}
      </div>
    </div>
  )
}

const calNavBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#6a7a98', cursor: 'pointer',
  fontSize: 14, padding: '4px 8px', borderRadius: 3,
}

export function ChartDateNav() {
  const chartSymbol = useChartStore(s => s.symbol)
  const focusDate = useChartStore(s => s.focusDate)
  const scanNavigate = useChartStore(s => s.scanNavigate)
  const [open, setOpen] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLDivElement>(null)
  const startInputRef = useRef<HTMLInputElement>(null)
  const endInputRef = useRef<HTMLInputElement>(null)
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })

  const displayDate = focusDate || todayStr()
  const dateLabel = formatDateLabel(displayDate)
  const hasRange = customStart && customEnd

  // Escape to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const handleStep = useCallback((days: number) => {
    if (!chartSymbol) return
    scanNavigate(chartSymbol, stepTradingDay(displayDate, days))
  }, [chartSymbol, displayDate, scanNavigate])

  const handleApplyRange = useCallback(() => {
    if (!chartSymbol || !customEnd) return
    scanNavigate(chartSymbol, customEnd)
    setOpen(false)
  }, [chartSymbol, customEnd, scanNavigate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleApplyRange()
  }, [handleApplyRange])

  const handleQuickRange = useCallback((label: string) => {
    if (!chartSymbol) return
    const s = getQuickRangeStart(label)
    const end = getQuickRangeEndDate()
    setCustomStart(s)
    setCustomEnd(end)
    scanNavigate(chartSymbol, end)
    setOpen(false)
  }, [chartSymbol, scanNavigate])

  const handleCalendarRange = useCallback((start: string, end: string) => {
    setCustomStart(start)
    setCustomEnd(end)
  }, [])

  const handleOpen = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPopupPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(v => !v)
  }, [])

  const jumpBtns = [3, 7, 14]

  return (
    <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4, position: 'relative' }}>
      {/* LIVE / HIST toggle */}
      <button
        onClick={() => {
          if (focusDate) {
            scanNavigate(chartSymbol, null)
          } else {
            scanNavigate(chartSymbol, todayStr())
          }
        }}
        style={{
          background: focusDate ? 'transparent' : `${GOLD}22`,
          border: `1px solid ${focusDate ? '#4a5580' : GOLD}`,
          borderRadius: 3, cursor: 'pointer',
          fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
          padding: '2px 7px',
          color: focusDate ? '#4a5580' : GOLD,
          letterSpacing: 0.5,
          transition: 'all 0.15s',
        }}
        title={focusDate ? 'Switch to live mode' : 'Currently in live mode'}
      >{focusDate ? 'LIVE' : '● LIVE'}</button>

      {/* Left arrow */}
      <button
        style={{ ...btnBase, borderColor: GOLD, color: GOLD }}
        onClick={() => handleStep(-1)}
        title="Previous trading day"
      >◀</button>

      {/* Date label — click to open dropdown */}
      <div
        ref={buttonRef}
        onClick={handleOpen}
        style={{
          fontSize: 11, fontWeight: 800, color: GOLD, fontFamily: 'monospace',
          minWidth: 76, textAlign: 'center', cursor: 'pointer',
          padding: '2px 6px', borderRadius: 3,
          background: open ? 'rgba(212,175,55,0.12)' : 'transparent',
          border: open ? `1px solid ${GOLD}` : '1px solid transparent',
          transition: 'all 0.15s',
        }}
        title={displayDate}
      >{dateLabel}</div>

      {/* Right arrow */}
      <button
        style={{ ...btnBase, borderColor: GOLD, color: GOLD }}
        onClick={() => handleStep(1)}
        title="Next trading day"
      >▶</button>

      {/* Jump buttons */}
      {jumpBtns.map(n => (
        <button
          key={n}
          style={{ ...btnBase, fontSize: 9, borderColor: 'rgba(212,175,55,0.4)', color: 'rgba(212,175,55,0.7)', padding: '2px 4px' }}
          onClick={() => handleStep(n)}
          title={`+${n} trading days`}
        >+{n}</button>
      ))}

      {/* Dropdown overlay */}
      {open && createPortal(
        <div
          data-date-dropdown
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 2147483647,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              position: 'absolute',
              top: popupPos.top,
              left: popupPos.left,
              background: '#0e1018',
              border: `1px solid ${GOLD}55`,
              borderRadius: 8,
              boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
              display: 'flex',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Range calendar */}
            <RangeCalendar
              rangeStart={customStart}
              rangeEnd={customEnd}
              onSelectRange={handleCalendarRange}
            />

            {/* Sidebar: quick ranges + custom range inputs */}
            <div style={{
              borderLeft: '1px solid #1e2535', padding: '10px 12px',
              display: 'flex', flexDirection: 'column', gap: 3, minWidth: 100,
            }}>
              <div style={{ fontSize: 10, color: '#4a5580', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>QUICK</div>
              {QUICK_RANGES.map(r => (
                <button
                  key={r.label}
                  onClick={() => handleQuickRange(r.label)}
                  style={{
                    background: 'transparent', border: '1px solid transparent',
                    color: '#8a9ab0', fontSize: 11, fontWeight: 600,
                    padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
                    textAlign: 'center',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.1)'; e.currentTarget.style.color = GOLD }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8a9ab0' }}
                >{r.label}</button>
              ))}

              {/* Custom range */}
              <div style={{ borderTop: '1px solid #1e2535', marginTop: 6, paddingTop: 8 }}>
                <div style={{ fontSize: 10, color: '#4a5580', fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>CUSTOM</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 9, color: '#4a5580', fontWeight: 600 }}>FROM</label>
                  <input
                    ref={startInputRef}
                    type="date"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={dateInputStyle}
                  />
                  <label style={{ fontSize: 9, color: '#4a5580', fontWeight: 600 }}>TO</label>
                  <input
                    ref={endInputRef}
                    type="date"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={dateInputStyle}
                  />
                  <button
                    onClick={handleApplyRange}
                    disabled={!hasRange}
                    style={{
                      marginTop: 4,
                      background: hasRange ? `${GOLD}22` : 'transparent',
                      border: `1px solid ${hasRange ? GOLD : '#2a3050'}`,
                      borderRadius: 3,
                      cursor: hasRange ? 'pointer' : 'default',
                      fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
                      padding: '5px 0',
                      color: hasRange ? GOLD : '#2a3050',
                      letterSpacing: 0.5,
                      transition: 'all 0.15s',
                    }}
                  >APPLY</button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

const btnBase: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 700,
  padding: '2px 6px',
  fontFamily: 'inherit',
}

const dateInputStyle: React.CSSProperties = {
  background: '#141820',
  border: '1px solid #2a3050',
  borderRadius: 3,
  color: '#dde3f0',
  fontSize: 11,
  fontFamily: 'monospace',
  padding: '3px 6px',
  width: '100%',
  outline: 'none',
}
