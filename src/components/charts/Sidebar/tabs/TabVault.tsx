'use client'

import { useToolStore, IND_CATALOG, type ToolInstance } from '@/stores/charts/toolStore'
import { useUIStore } from '@/stores/charts/uiStore'
import { C } from '@/lib/charts/theme'

/**
 * TabVault — Shows active indicator tools. Click opens settings in Tools tab.
 */

export function TabVault() {
  const tools = useToolStore((s) => s.tools)
  const selectTool = useToolStore((s) => s.selectTool)
  const setSidebarTab = useUIStore(s => s.setSidebarTab)
  const activeTools = tools.filter(t => t.on)

  // Group by catalog group
  const groups: Record<string, ToolInstance[]> = {}
  activeTools.forEach(t => {
    const cat = IND_CATALOG[t.indKey]
    const g = cat?.group || 'Other'
    if (!groups[g]) groups[g] = []
    groups[g].push(t)
  })

  return (
    <div id="tab-vault">
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: 1 }}>📦 INDICATOR VAULT</span>
      </div>
      <div id="vault-list" style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
        {activeTools.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#3a4a60', fontSize: 11, fontStyle: 'italic' }}>
            No indicators active.<br />Use TOOLS tab to add indicators.
          </div>
        )}
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className="vg">
            <div className="vg-title">{group.toUpperCase()}</div>
            {items.map(tool => (
              <VaultRow key={tool.id} tool={tool} onOpen={() => { selectTool(tool.id); setSidebarTab('tools') }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function VaultRow({ tool, onOpen }: { tool: ToolInstance; onOpen: () => void }) {
  const toggleTool = useToolStore((s) => s.toggleTool)
  const cat = IND_CATALOG[tool.indKey]
  const mainColor = cat?.colors?.[0]?.def || '#a78bfa'
  // Extract hex from rgba for the dot
  const dotHex = mainColor.startsWith('#') ? mainColor : '#a78bfa'

  return (
    <div className="vi on" style={{ cursor: 'pointer' }}>
      <span className="vi-dot" style={{ background: dotHex, color: dotHex }} />
      <span className="vi-name" onClick={onOpen}>{tool.name}</span>
      {cat?.colors && cat.colors.length > 0 && (
        <span className="vi-colors">
          {cat.colors.map((ck, i) => {
            const cv = tool.colors[ck.key] || ck.def
            const hex = cv.startsWith('#') ? cv : '#444'
            return <span key={i} className="vi-cdot" style={{ background: hex }} />
          })}
        </span>
      )}
      <button
        className="vi-gear"
        onClick={(e) => { e.stopPropagation(); onOpen() }}
        title="Settings"
        style={{ background: 'none', border: 'none', color: '#5a6a98', cursor: 'pointer', padding: 2 }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1l.5 2a3.5 3.5 0 011.5.9l1.9-.7.5 1.3-1.7.9a3.5 3.5 0 010 1.2l1.7.9-.5 1.3-1.9-.7a3.5 3.5 0 01-1.5.9L6 11l-.5-2a3.5 3.5 0 01-1.5-.9l-1.9.7-.5-1.3 1.7-.9a3.5 3.5 0 010-1.2l-1.7-.9.5-1.3 1.9.7a3.5 3.5 0 011.5-.9z" fill="none" stroke="currentColor" strokeWidth="1"/></svg>
      </button>
    </div>
  )
}
