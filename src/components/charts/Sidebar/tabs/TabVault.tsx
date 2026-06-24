'use client'

import { useToolStore, IND_CATALOG, type ToolInstance } from '@/stores/charts/toolStore'
import { useUIStore } from '@/stores/charts/uiStore'

/**
 * TabVault — the INDICATOR LIBRARY. Renders from IND_CATALOG (the fixed catalog of
 * available indicators), NOT from the active-tools list — so the Vault is ALWAYS complete
 * regardless of what a template did to the tools list. Combos (combo:true — Lingua,
 * Trendline) are excluded; they live in the TOOLS tab.
 *
 * Each indicator reflects its on/off state from the matching tool instance; clicking
 * toggles it (creating an instance if none exists). This is the design split:
 *   Vault  = indicators (the library, always present)
 *   Tools  = custom combos / layouts
 */

export function TabVault() {
  const tools = useToolStore((s) => s.tools)
  const toggleTool = useToolStore((s) => s.toggleTool)
  const addTool = useToolStore((s) => s.addTool)

  // Indicator library = every non-combo catalog entry, grouped by catalog group.
  const groups: Record<string, { key: string; cat: any; inst?: ToolInstance }[]> = {}
  for (const [key, cat] of Object.entries(IND_CATALOG)) {
    if ((cat as any).combo) continue                          // combos → Tools tab only
    const g = cat.group || 'Other'
    if (!groups[g]) groups[g] = []
    groups[g].push({ key, cat, inst: tools.find(t => t.indKey === key) })
  }

  const toggle = (key: string, inst?: ToolInstance) => {
    if (inst) toggleTool(inst.id)
    else addTool(key)                                          // addTool creates on=true
  }

  return (
    <div id="tab-vault">
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: 1 }}>📦 INDICATOR VAULT</span>
        <span style={{ fontSize: 9, color: '#3a4a60' }}>{Object.values(groups).reduce((n, g) => n + g.length, 0)} available</span>
      </div>
      <div id="vault-list" style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className="vg">
            <div className="vg-title">{group.toUpperCase()}</div>
            {items.map(({ key, cat, inst }) => (
              <VaultRow
                key={key}
                name={cat.label || key}
                on={!!inst?.on}
                colorDot={cat.colors?.[0]?.def || '#a78bfa'}
                onToggle={() => toggle(key, inst)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function VaultRow({ name, on, colorDot, onToggle }: { name: string; on: boolean; colorDot: string; onToggle: () => void }) {
  const dotHex = typeof colorDot === 'string' && colorDot.startsWith('#') ? colorDot : '#a78bfa'
  return (
    <div className={`vi${on ? ' on' : ''}`} style={{ cursor: 'pointer', opacity: on ? 1 : 0.45 }} onClick={onToggle}>
      <span className="vi-dot" style={{ background: dotHex, color: dotHex }} />
      <span className="vi-name">{name}</span>
      <span className="vi-state" style={{ fontSize: 9, color: on ? '#22d3ee' : '#3a4a60', marginLeft: 'auto', paddingRight: 6 }}>
        {on ? 'ON' : 'OFF'}
      </span>
    </div>
  )
}
