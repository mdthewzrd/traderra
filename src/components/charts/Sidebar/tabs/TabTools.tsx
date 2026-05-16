'use client'

import { useState } from 'react'
import { useIndicatorStore, IND_REGISTRY, type IndDef } from '@/stores/charts/indicatorStore'

/**
 * TabTools — Tool settings panel. Lists all available indicators to toggle on/off.
 * Pure React — no charts-engine.js dependency.
 */

export function TabTools() {
  const inds = useIndicatorStore((s) => s.inds)
  const toggle = useIndicatorStore((s) => s.toggle)
  const [search, setSearch] = useState('')

  // Group all indicators by group
  const groups: Record<string, { key: string; def: IndDef }[]> = {}
  for (const [key, def] of Object.entries(IND_REGISTRY)) {
    if (search && !def.label.toLowerCase().includes(search.toLowerCase()) && !key.toLowerCase().includes(search.toLowerCase())) continue
    const g = def.group || 'Other'
    if (!groups[g]) groups[g] = []
    groups[g].push({ key, def })
  }

  return (
    <div id="tab-tools">
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a1e2a', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37', letterSpacing: 1 }}>⚙ TOOLS</span>
        <input
          type="text"
          placeholder="SEARCH..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            marginLeft: 'auto', width: 100, background: '#1a1e2e', border: '1px solid #2a3050',
            color: '#dde3f0', fontSize: 10, padding: '3px 6px', borderRadius: 3, outline: 'none',
            fontWeight: 700, letterSpacing: 0.5,
          }}
        />
      </div>
      <div id="tools-body" style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} style={{ marginBottom: 8 }}>
            <div className="vg-title">{group.toUpperCase()}</div>
            {items.map(({ key, def }) => {
              const on = !!inds[key]
              return (
                <div
                  key={key}
                  onClick={() => toggle(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
                    cursor: 'pointer', borderRadius: 3, fontSize: 11,
                    color: on ? '#dde3f0' : '#4a6080',
                    background: on ? '#1a1e2e' : 'transparent',
                    border: `1px solid ${on ? '#2a3050' : 'transparent'}`,
                    marginBottom: 2, transition: 'all .1s',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = on ? '#222840' : '#0d1018' }}
                  onMouseOut={(e) => { e.currentTarget.style.background = on ? '#1a1e2e' : 'transparent' }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                    background: on ? '#D4AF37' : '#2a3050',
                    transition: 'background .1s',
                  }} />
                  <span style={{ fontWeight: on ? 700 : 500, flex: 1 }}>{def.label}</span>
                  {on && <span style={{ fontSize: 9, color: '#D4AF37', fontWeight: 800 }}>ON</span>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
