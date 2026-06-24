'use client'

import { useState, Fragment } from 'react'
import { useToolStore, IND_CATALOG, type ToolInstance, type IndCatalogEntry } from '@/stores/charts/toolStore'
import { useUIStore } from '@/stores/charts/uiStore'

/**
 * TabTools — Tool settings panel with:
 * - Tool picker (active + inactive tools with toggle)
 * - Per-tool settings (params + colors + hot button config)
 * - Add new tool popup
 * - Duplicate / Delete / Reset
 */

export function TabTools() {
  const selectedToolId = useToolStore((s) => s.selectedToolId)
  const tools = useToolStore((s) => s.tools)
  const selectedTool = tools.find(t => t.id === selectedToolId) || null

  try {
    if (selectedTool) {
      return <ToolSettings tool={selectedTool} />
    }
    return <ToolPicker />
  } catch (e: any) {
    return (
      <div id="tab-tools">
        <div style={{ padding: 12, fontSize: 11, color: '#ff6b6b', fontFamily: 'JetBrains Mono, monospace' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠ TabTools Error</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 10 }}>{String(e?.message || e)}</pre>
          <button onClick={() => useToolStore.getState().selectTool(null)} style={{ marginTop: 8, background: '#1a2030', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 11 }}>← Back</button>
        </div>
      </div>
    )
  }
}

/** Tool list — shows active/inactive tools, click to open settings */
function ToolPicker() {
  const tools = useToolStore((s) => s.tools)
  const toggleTool = useToolStore((s) => s.toggleTool)
  const selectTool = useToolStore((s) => s.selectTool)
  const showAddPopup = useToolStore((s) => s.showAddPopup)
  const toggleShowAddPopup = useToolStore((s) => s.toggleShowAddPopup)
  const closeAddPopup = useToolStore((s) => s.closeAddPopup)

  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const activeTools = tools.filter(t => t.on && (!q || t.name.toLowerCase().includes(q)))
  const inactiveTools = tools.filter(t => !t.on && (!q || t.name.toLowerCase().includes(q)))

  return (
    <div id="tab-tools">
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a1e2a', display: 'flex', alignItems: 'center' }}>
        <span id="tools-ind-label" style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37', letterSpacing: 1 }}>⚙ TOOLS</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            id="reset-tools-btn"
            title="Restore default indicators"
            onClick={() => {
              const ok = window.confirm('Restore all default indicators?\nThis replaces your current tool list.')
              if (ok) { useToolStore.getState().resetTools(); useToolStore.getState().selectTool(null) }
            }}
            style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid #5a6a88', color: '#8a9ab8', background: 'transparent', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
          >↺</button>
          <button
            id="add-tool-btn"
            onClick={toggleShowAddPopup}
            style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid #D4AF37', color: '#D4AF37', background: 'transparent', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontWeight: 700 }}
          >＋</button>
        </div>
      </div>
      {/* Add tool popup */}
      {showAddPopup && <AddToolPopup onClose={closeAddPopup} />}
      <div style={{ padding: '0 12px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: '#5a6a88' }}>⌕</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools…"
          style={{ flex: 1, minWidth: 0, background: '#0a0c12', border: '1px solid #1e2535', color: '#dde3f0', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', padding: '4px 8px', borderRadius: 4, outline: 'none' }}
          onFocus={(e) => { e.target.style.borderColor = '#D4AF37' }}
          onBlur={(e) => { e.target.style.borderColor = '#1e2535' }}
        />
        {query && (
          <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: '#5a6a88', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
        )}
      </div>
      <div id="tools-body" style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
        {/* Active tools */}
        {activeTools.length > 0 && (
          <div style={{ padding: '6px 12px 3px', fontSize: 11, fontWeight: 700, color: '#22c55e', letterSpacing: 1 }}>● ACTIVE</div>
        )}
        {activeTools.map(tool => (
          <ToolRow key={tool.id} tool={tool} onToggle={() => toggleTool(tool.id)} onOpen={() => selectTool(tool.id)} />
        ))}
        {/* Inactive tools */}
        {inactiveTools.length > 0 && (
          <div style={{ padding: '8px 12px 3px', fontSize: 11, fontWeight: 700, color: '#5a6a88', letterSpacing: 1, borderTop: activeTools.length ? '1px solid #1e2535' : undefined, marginTop: activeTools.length ? 4 : 0 }}>○ INACTIVE</div>
        )}
        {inactiveTools.map(tool => (
          <ToolRow key={tool.id} tool={tool} dim onToggle={() => toggleTool(tool.id)} onOpen={() => selectTool(tool.id)} />
        ))}
        {tools.length === 0 && (
          <div style={{ padding: '20px 12px', fontSize: 11, color: '#3a4a60', textAlign: 'center', fontStyle: 'italic' }}>
            No tools yet. Tap + to add one.
          </div>
        )}
      </div>
    </div>
  )
}

function ToolRow({ tool, dim, onToggle, onOpen }: { tool: ToolInstance; dim?: boolean; onToggle: () => void; onOpen: () => void }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', padding: '5px 12px', cursor: 'pointer',
        borderRadius: 3, margin: '0 6px 1px', opacity: dim ? 0.75 : 1,
        background: dim ? 'transparent' : '#151925',
        transition: 'opacity .15s',
      }}
      onClick={onOpen}
      onMouseOver={(e) => { e.currentTarget.style.background = '#151925' }}
      onMouseOut={(e) => { e.currentTarget.style.background = dim ? 'transparent' : '#151925' }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        style={{
          width: 10, height: 10, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: tool.on ? '#22c55e' : '#2a3050', marginRight: 8, flexShrink: 0,
        }}
      />
      <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: dim ? '#8a9ab8' : '#dde3f0', fontFamily: 'JetBrains Mono, monospace' }}>
        {tool.name}
      </span>
      {tool.hot && tool.on && <span style={{ fontSize: 9, color: '#D4AF37', fontWeight: 800, marginRight: 4 }}>HOT</span>}
      <span style={{ fontSize: 11, color: '#D4AF37' }}>⚙</span>
    </div>
  )
}

/** Add tool popup — catalog browser */
function AddToolPopup({ onClose }: { onClose: () => void }) {
  const addTool = useToolStore((s) => s.addTool)
  const groups: Record<string, { key: string; cat: IndCatalogEntry }[]> = {}
  for (const [k, cat] of Object.entries(IND_CATALOG)) {
    if (!cat.params && !cat.colors) continue
    const g = cat.group || 'Other'
    if (!groups[g]) groups[g] = []
    groups[g].push({ key: k, cat })
  }

  return (
    <div style={{ padding: '0 6px' }}>
      <div style={{ background: '#0d0f18', border: '1px solid #2a3050', borderRadius: 8, maxHeight: 400, overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.7)' }}>
        <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #1e2535' }}>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#D4AF37', letterSpacing: 1 }}>ADD NEW TOOL</span>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #2a3050', color: '#5a6a88', fontSize: 12, cursor: 'pointer', padding: '2px 8px', borderRadius: 4 }}>✕</button>
        </div>
        {Object.entries(groups).map(([gName, items]) => (
          <div key={gName}>
            <div style={{ padding: '6px 16px 2px', fontSize: 8, fontWeight: 700, color: '#3a4a60', letterSpacing: 1 }}>{gName.toUpperCase()}</div>
            {items.map(({ key, cat }) => (
              <div
                key={key}
                onClick={() => { addTool(key); useUIStore.getState().setSidebarTab('tools') }}
                style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', cursor: 'pointer', borderRadius: 4, margin: '0 8px 1px' }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#151925' }}
                onMouseOut={(e) => { e.currentTarget.style.background = '' }}
              >
                <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#dde3f0', fontFamily: 'JetBrains Mono, monospace' }}>{cat.label}</span>
                <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>+</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Per-tool settings editor */
function ToolSettings({ tool }: { tool: ToolInstance }) {
  const cat = IND_CATALOG[tool.indKey]
  // Split params into Parameters (core, group 'zones' or none) and Settings (secondary groups)
  const allParams = cat?.params || []
  const coreParams = allParams.filter(p => !p.group || p.group === 'zones')
  const settingsParams = allParams.filter(p => p.group && p.group !== 'zones')
  const hasParams = coreParams.length > 0
  const hasSettings = settingsParams.length > 0
  const hasColors = !!(cat?.colors?.length)
  const [tab, setTab] = useState<'inputs' | 'settings' | 'style'>(() => {
    if (hasParams) return 'inputs'
    if (hasSettings) return 'settings'
    return 'style'
  })
  const selectTool = useToolStore((s) => s.selectTool)
  const toggleTool = useToolStore((s) => s.toggleTool)
  const setToolParam = useToolStore((s) => s.setToolParam)
  const setPanelParam = useToolStore((s) => s.setPanelParam)
  const activePanel = useUIStore((s) => s.activePanel)
  // Per-panel params: edits below target the ACTIVE chart only. Reads merge the panel's
  // overrides on top of the global tool.params, so unedited charts keep showing defaults.
  const paramOverride = useToolStore((s) => s.panelParams[activePanel]?.[tool.indKey])
  const mergedParams = { ...tool.params, ...(paramOverride || {}) }
  const setToolColor = useToolStore((s) => s.setToolColor)
  const setToolName = useToolStore((s) => s.setToolName)
  const setToolHot = useToolStore((s) => s.setToolHot)
  const setToolHotLabel = useToolStore((s) => s.setToolHotLabel)
  const setToolHotColor = useToolStore((s) => s.setToolHotColor)
  const deleteTool = useToolStore((s) => s.deleteTool)
  const duplicateTool = useToolStore((s) => s.duplicateTool)

  if (!cat) {
    return (
      <div id="tab-tools">
        <div style={{ padding: '12px 16px', fontSize: 11, color: '#ff6b6b' }}>
          Unknown indicator: {tool.indKey}
          <button onClick={() => selectTool(null)} style={{ marginLeft: 8, color: '#8aa0c0', background: 'none', border: '1px solid #2a3050', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>← Back</button>
        </div>
      </div>
    )
  }

  // Param row renderer — handles number, toggle, and select types
  const renderParamRow = (prm: typeof allParams[number]) => {
    const val = mergedParams[prm.key] ?? prm.def
    return (
      <tr key={prm.key} style={{ borderBottom: '1px solid #111620' }}>
        <td style={{ padding: '6px 4px', fontSize: 11, color: '#8aa0c0', fontWeight: 700, whiteSpace: 'nowrap' }}>{prm.label}</td>
        <td style={{ padding: '6px 4px', textAlign: 'right' }}>
          {prm.type === 'toggle' ? (
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!val} onChange={(e) => setPanelParam(activePanel, tool.indKey, prm.key, e.target.checked ? 1 : 0)} style={{ width: 16, height: 16, accentColor: '#D4AF37', cursor: 'pointer' }} />
              <span style={{ fontSize: 11, color: val ? '#22c55e' : '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>{val ? 'ON' : 'OFF'}</span>
            </label>
          ) : prm.type === 'select' ? (
            <select
              value={String(val)}
              onChange={(e) => setPanelParam(activePanel, tool.indKey, prm.key, e.target.value)}
              style={{ background: '#0a0c12', border: '1px solid #1e2535', color: '#dde3f0', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, padding: '4px 6px', borderRadius: 4, outline: 'none', cursor: 'pointer', maxWidth: 120 }}
            >
              {(prm.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : (
            <input
              type="number"
              value={Number(val)}
              min={prm.min ?? 0}
              max={prm.max ?? 9999}
              step={prm.step ?? 1}
              onChange={(e) => setPanelParam(activePanel, tool.indKey, prm.key, parseFloat(e.target.value) || 0)}
              style={{ width: 64, background: '#0a0c12', border: '1px solid #1e2535', color: '#dde3f0', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, padding: '4px 6px', borderRadius: 4, textAlign: 'right', outline: 'none' }}
            />
          )}
        </td>
      </tr>
    )
  }

  return (
    <div id="tab-tools">
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #1e2535', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37', letterSpacing: 1 }}>⚙ EDITING TOOL</span>
        <span title="Params you edit apply to THIS chart only (the one with the gold outline)" style={{ marginLeft: 'auto', fontSize: 10, color: '#D4AF37', fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.5, opacity: 0.85 }}>▶ CHART {activePanel + 1}</span>
      </div>
      {/* Toggle + name */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #1e2535', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => toggleTool(tool.id)}
          style={{
            width: 14, height: 14, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
            background: tool.on ? '#22c55e' : '#2a3050',
          }}
        />
        <input
          type="text"
          value={tool.name}
          maxLength={30}
          onChange={(e) => setToolName(tool.id, e.target.value)}
          style={{
            flex: 1, minWidth: 0, background: 'none', border: '1px solid transparent',
            color: '#dde3f0', fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
            padding: '2px 4px', borderRadius: 3, outline: 'none', cursor: 'text',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#D4AF37'; e.target.select() }}
          onBlur={(e) => { e.target.style.borderColor = 'transparent' }}
        />
        <span style={{ fontSize: 11, color: tool.on ? '#22c55e' : '#5a6a88', fontWeight: 700 }}>{tool.on ? 'ON' : 'OFF'}</span>
      </div>

      {/* Tabs */}
      {(hasParams || hasSettings || hasColors) && (
        <div style={{ display: 'flex', borderBottom: '1px solid #1e2535' }}>
          {hasParams && (
            <div onClick={() => setTab('inputs')} style={{ flex: 1, textAlign: 'center', padding: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: tab === 'inputs' ? '#D4AF37' : '#5a6a88', borderBottom: tab === 'inputs' ? '2px solid #D4AF37' : 'none' }}>Parameters</div>
          )}
          {hasSettings && (
            <div onClick={() => setTab('settings')} style={{ flex: 1, textAlign: 'center', padding: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: tab === 'settings' ? '#D4AF37' : '#5a6a88', borderBottom: tab === 'settings' ? '2px solid #D4AF37' : 'none' }}>Settings</div>
          )}
          {hasColors && (
            <div onClick={() => setTab('style')} style={{ flex: 1, textAlign: 'center', padding: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: tab === 'style' ? '#D4AF37' : '#5a6a88', borderBottom: tab === 'style' ? '2px solid #D4AF37' : 'none' }}>Style</div>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Parameters tab */}
        {tab === 'inputs' && hasParams && (
          <div style={{ padding: '12px 16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
              {coreParams.map(prm => renderParamRow(prm))}
              </tbody>
            </table>
          </div>
        )}

        {/* Settings tab (secondary params, grouped) */}
        {tab === 'settings' && hasSettings && (
          <div style={{ padding: '12px 16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
              {(() => {
                const groupLabels: Record<string,string> = {
                  src:'Source & Display', detect:'Detection', patterns:'Candle Pattern Filters',
                  lookback:'Lookback (Breakouts)', tsi:'TSI Momentum',
                }
                let lastGroup = ''
                return settingsParams.map(prm => {
                  const g = prm.group || 'other'
                  const showHeader = g !== lastGroup
                  lastGroup = g
                  return (
                    <Fragment key={prm.key}>
                      {showHeader && (
                        <tr><td colSpan={2} style={{ padding: '10px 0 4px', fontSize: 8, fontWeight: 700, color: '#3a4a60', letterSpacing: 1, borderTop: '1px solid #1e2535' }}>{(groupLabels[g] || g).toUpperCase()}</td></tr>
                      )}
                      {renderParamRow(prm)}
                    </Fragment>
                  )
                })
              })()}
              </tbody>
            </table>
          </div>
        )}

        {/* Style tab */}
        {tab === 'style' && hasColors && (
          <div style={{ padding: '12px 16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
              {cat.colors!.map((clrDef) => {
                const val = tool.colors[clrDef.key] || clrDef.def
                // Parse rgba()/rgb() → #hex for the color input
                let hex = '#888888'
                let alpha = 100
                const am = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/)
                if (am) {
                  hex = '#' + [am[1], am[2], am[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
                  alpha = am[4] ? Math.round(parseFloat(am[4]) * 100) : 100
                } else if (val.startsWith('#')) {
                  hex = val
                }
                return (
                  <tr key={clrDef.key} style={{ borderBottom: '1px solid #111620' }}>
                    <td style={{ padding: '6px 4px', fontSize: 11, color: '#8aa0c0', fontWeight: 700 }}>{clrDef.label}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <input
                          type="color"
                          value={hex}
                          onChange={(e) => {
                            const r = parseInt(e.target.value.slice(1,3),16)
                            const g = parseInt(e.target.value.slice(3,5),16)
                            const b = parseInt(e.target.value.slice(5,7),16)
                            setToolColor(tool.id, clrDef.key, `rgba(${r},${g},${b},${alpha/100})`)
                          }}
                          style={{ width: 28, height: 22, border: '1px solid #2a3050', borderRadius: 4, cursor: 'pointer', padding: 1 }}
                        />
                        <input
                          type="range"
                          min={0} max={100} value={alpha}
                          onInput={(e) => {
                            const a = parseInt((e.target as HTMLInputElement).value) / 100
                            const r = parseInt(hex.slice(1,3),16)
                            const g = parseInt(hex.slice(3,5),16)
                            const b = parseInt(hex.slice(5,7),16)
                            setToolColor(tool.id, clrDef.key, `rgba(${r},${g},${b},${a})`)
                          }}
                          style={{ width: 48, height: 14, accentColor: '#D4AF37', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 11, color: '#5a6a88', fontFamily: 'JetBrains Mono, monospace', minWidth: 28, textAlign: 'right' }}>{alpha}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              </tbody>
            </table>
          </div>
        )}

        {/* Hot button toggle */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid #1e2535' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#8aa0c0', fontWeight: 700 }}>SHOW IN TOOLBAR</span>
            <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={tool.hot} onChange={(e) => setToolHot(tool.id, e.target.checked)} style={{ width: 16, height: 16, accentColor: '#D4AF37', cursor: 'pointer' }} />
              <span style={{ fontSize: 11, color: tool.hot ? '#D4AF37' : '#6b7280', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{tool.hot ? 'ON' : 'OFF'}</span>
            </label>
          </div>
          {tool.hot && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>Label</span>
              <input type="text" value={tool.hotLabel} maxLength={12} onChange={(e) => setToolHotLabel(tool.id, e.target.value)} style={{ flex: 1, padding: '3px 6px', background: '#0a0c12', border: '1px solid #1e2535', color: '#dde3f0', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', borderRadius: 3, outline: 'none' }} />
              <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0, marginLeft: 4 }}>Color</span>
              <input type="color" value={tool.hotColor} onChange={(e) => setToolHotColor(tool.id, e.target.value)} style={{ width: 24, height: 20, border: '1px solid #1e2535', background: '#0a0c12', cursor: 'pointer', borderRadius: 2, padding: 0 }} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom buttons */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid #1e2535', display: 'flex', gap: 6 }}>
        <button onClick={() => selectTool(null)} style={{ flex: 2, padding: 5, border: '1px solid #D4AF37', color: '#000', background: '#D4AF37', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}>💾 SAVE & CLOSE</button>
        <button onClick={() => duplicateTool(tool.id)} style={{ flex: 1, padding: 5, border: '1px solid #5a9ae6', color: '#5a9ae6', background: 'transparent', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}>⧉ DUPE</button>
        <button onClick={() => { deleteTool(tool.id) }} style={{ flex: 1, padding: 5, border: '1px solid #ef5350', color: '#ef5350', background: 'transparent', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}>✕ DEL</button>
      </div>
    </div>
  )
}
