'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ═══════════════════════════════════════════════════════════════
// TAB LAB — Strategy Lab with full StrategyLab parity
// Two-store architecture: projects + flat entries (API-ready)
// ═══════════════════════════════════════════════════════════════

// ── Types ──

interface LabPhase {
  id: string
  phase: string
  label: string
  order: number
  _count: { entries: number }
}

interface LabProject {
  id: string
  name: string
  description: string
  type: 'setup' | 'scan' | 'strategy'
  status: 'idea' | 'active' | 'complete' | 'abandoned'
  tags: string
  linkedScanId: string | null
  createdAt: string
  updatedAt: string
  phases: LabPhase[]
  _count: { entries: number; phases: number }
}

interface LabEntry {
  id: string
  projectId: string
  phaseId: string
  parentId: string | null
  type: 'note' | 'capture' | 'trade' | 'signal'
  title: string
  content: string
  imageData: string | null
  createdAt: string
  updatedAt: string
}

// ── Constants ──

const PROJECTS_KEY = 'traderra-lab-projects'
const ENTRIES_KEY = 'traderra-lab-entries'
const STATE_KEY = 'traderra-lab-state'

const PHASE_DEFS = [
  { phase: 'scan', label: 'Scan', icon: '📡' },
  { phase: 'setup', label: 'Setup', icon: '🎯' },
  { phase: 'entry', label: 'Entry', icon: '🚀' },
  { phase: 'exit', label: 'Exit', icon: '🏁' },
  { phase: 'backtest', label: 'Backtest', icon: '📊' },
] as const

const STATUS_COLORS: Record<string, string> = {
  idea: '#c084fc',
  active: '#26a69a',
  complete: '#D4AF37',
  abandoned: '#6b7280',
}

const TYPE_LABELS: Record<string, string> = {
  setup: 'Setup',
  scan: 'Scan',
  strategy: 'Strategy',
}

const ENTRY_ICONS: Record<string, string> = {
  note: '📝',
  capture: '📷',
  trade: '💹',
  signal: '📡',
}

// ── Storage helpers (API-ready swap points) ──

function storeLoad(key: string): any[] {
  try { const d = JSON.parse(localStorage.getItem(key) || 'null'); return Array.isArray(d) ? d : [] } catch { return [] }
}
function storeSave(key: string, data: any[]) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch (e) { console.warn('Lab storage full:', e) }
}

function loadProjects(): LabProject[] { return storeLoad(PROJECTS_KEY) }
function loadEntries(): LabEntry[] { return storeLoad(ENTRIES_KEY) }
function saveProjects(p: LabProject[]) { storeSave(PROJECTS_KEY, p) }
function saveEntries(e: LabEntry[]) { storeSave(ENTRIES_KEY, e) }

function loadLabState(): { projectId: string | null; phaseId: string | null } {
  try {
    const d = JSON.parse(localStorage.getItem(STATE_KEY) || '{}')
    return { projectId: d.projectId ?? null, phaseId: d.phaseId ?? null }
  } catch { return { projectId: null, phaseId: null } }
}
function saveLabState(projectId: string | null, phaseId: string | null) {
  localStorage.setItem(STATE_KEY, JSON.stringify({ projectId, phaseId }))
}

// ── Helpers ──

function genId(prefix: string) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)
}

function makePhases(projId: string): LabPhase[] {
  return PHASE_DEFS.map((def, i) => ({
    id: `${projId}_${def.phase}`,
    phase: def.phase,
    label: def.label,
    order: i,
    _count: { entries: 0 },
  }))
}

function recountEntries(project: LabProject, entries: LabEntry[]): LabProject {
  const projEntries = entries.filter(e => e.projectId === project.id)
  const updated = { ...project, _count: { entries: projEntries.length, phases: project.phases.length } }
  updated.phases = project.phases.map(ph => ({
    ...ph,
    _count: { entries: entries.filter(e => e.phaseId === ph.id).length },
  }))
  return updated
}

function timeAgo(dateStr: string): string {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  if (s < 604800) return Math.floor(s / 86400) + 'd ago'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ═══════════════════════════════════════════════════════════════
// Components
// ═══════════════════════════════════════════════════════════════

// ── Create Project Modal ──

function CreateProjectModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (name: string, type: LabProject['type'], linkedScanId: string | null) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<LabProject['type']>('setup')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 2001, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 2002,
        background: '#141926', border: '1px solid #2a3050', borderRadius: 8, padding: '16px 18px',
        minWidth: 320, maxWidth: 440, display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ color: '#c084fc', fontWeight: 800, fontSize: 14 }}>🔬 New Strategy Project</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5a7090', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 10, color: '#4a6080', fontWeight: 700, letterSpacing: 0.8, marginBottom: 4, display: 'block' }}>PROJECT NAME</label>
            <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. VWAP Fade Setup"
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onCreate(name.trim(), type, null) }}
              style={{ width: '100%', background: '#0a0c12', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 12, padding: '8px 10px', borderRadius: 4, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#4a6080', fontWeight: 700, letterSpacing: 0.8, marginBottom: 4, display: 'block' }}>TYPE</label>
            <select value={type} onChange={e => setType(e.target.value as LabProject['type'])}
              style={{ width: '100%', background: '#0a0c12', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 12, padding: '8px 10px', borderRadius: 4, outline: 'none' }}>
              <option value="setup">Setup</option>
              <option value="scan">Scan</option>
              <option value="strategy">Strategy</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #2a3050', color: '#8aa0c0', fontSize: 11, fontWeight: 700, padding: '7px 14px', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => { if (name.trim()) onCreate(name.trim(), type, null) }}
            style={{ background: '#c084fc', color: '#000', border: 'none', fontSize: 11, fontWeight: 800, padding: '7px 14px', borderRadius: 4, cursor: 'pointer' }}>Create Project</button>
        </div>
      </div>
    </>
  )
}

// ── Inline Entry Editor ──

function InlineEditor({ project, phaseId, onSave, onCancel }: {
  project: LabProject
  phaseId: string
  onSave: (data: { type: LabEntry['type']; title: string; content: string; imageData: string | null }) => void
  onCancel: () => void
}) {
  const [entryType, setEntryType] = useState<LabEntry['type']>('note')
  const [title, setTitle] = useState('Note')
  const [content, setContent] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (entryType === 'idea') setTitle('Idea')
    else if (entryType === 'note') setTitle('Note')
    else setTitle('')
  }, [entryType])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleScreenshot = useCallback(() => {
    const data = (window as any).chartScreenshot?.()
    if (data && typeof data === 'string') setImageData(data)
  }, [])

  const save = () => {
    if (!content.trim() && !imageData) { onCancel(); return }
    onSave({ type: entryType, title: title || 'Note', content: content.trim(), imageData })
  }

  const accent = entryType === 'idea' ? '#fbbf24' : '#8aa0c0'

  return (
    <div style={{ padding: 10, background: '#0a0c12', border: `1px solid ${accent}33`, borderRadius: 4, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <select value={entryType} onChange={e => setEntryType(e.target.value as LabEntry['type'])}
          style={{ background: '#141926', border: '1px solid #2a3050', color: '#c084fc', fontSize: 10, fontWeight: 700, padding: '2px 4px', borderRadius: 3, outline: 'none', textTransform: 'uppercase' as const }}>
          <option value="note">📝 Note</option>
          <option value="capture">📷 Capture</option>
          <option value="trade">💹 Trade</option>
          <option value="signal">📡 Signal</option>
        </select>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
          style={{ flex: 1, background: 'transparent', border: 'none', color: '#dde3f0', fontSize: 12, fontWeight: 700, outline: 'none', padding: 0 }}
        />
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#4a6080', fontSize: 12, cursor: 'pointer', padding: '2px 4px' }}>✕</button>
      </div>

      <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)}
        placeholder={entryType === 'idea' ? 'Quick idea...' : 'Write your note...'}
        rows={3}
        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) save() }}
        style={{ width: '100%', background: 'transparent', border: 'none', color: accent, fontSize: 11, lineHeight: 1.5, outline: 'none', resize: 'vertical', minHeight: 60 }}
      />

      {imageData && (
        <div style={{ marginTop: 6, borderRadius: 4, overflow: 'hidden', border: '1px solid #1e2840', position: 'relative' }}>
          <img src={imageData} style={{ width: '100%', display: 'block', maxHeight: 120, objectFit: 'contain', background: '#0a0c12' }} />
          <button onClick={() => setImageData(null)}
            style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.7)', border: 'none', color: '#f87171', fontSize: 12, cursor: 'pointer', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <button onClick={handleScreenshot}
          style={{ background: 'none', border: '1px solid #2a3050', color: '#8aa0c0', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 3, cursor: 'pointer' }}>📷 Attach Screenshot</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: '#4a6080' }}>Ctrl+Enter to save</span>
          <button onClick={save}
            style={{ background: accent, color: '#000', border: 'none', fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 3, cursor: 'pointer' }}>Save</button>
        </div>
      </div>
    </div>
  )
}

// ── Entry Card ──

function EntryCard({ entry, onReply, onDelete }: {
  entry: LabEntry
  onReply: (parentId: string) => void
  onDelete: (id: string) => void
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(entry.title)
  const titleRef = useRef<HTMLSpanElement>(null)

  const handleTitleBlur = () => {
    setEditingTitle(false)
    if (title.trim() && title !== entry.title) {
      // Update entry title in storage
      const entries = loadEntries()
      const idx = entries.findIndex(e => e.id === entry.id)
      if (idx >= 0) {
        entries[idx] = { ...entries[idx], title: title.trim(), updatedAt: new Date().toISOString() }
        saveEntries(entries)
      }
    }
  }

  return (
    <div style={{ padding: '8px 10px', background: '#0d1220', border: '1px solid #1e2840', borderRadius: 4, fontSize: 11, marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>{ENTRY_ICONS[entry.type] || '📝'}</span>
          <span
            ref={titleRef}
            contentEditable={editingTitle}
            suppressContentEditableWarning
            onDoubleClick={() => setEditingTitle(true)}
            onBlur={handleTitleBlur}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur() }; if (e.key === 'Escape') { setTitle(entry.title); setEditingTitle(false) } }}
            style={{ color: '#dde3f0', fontWeight: 700, fontSize: 11, outline: 'none', cursor: editingTitle ? 'text' : 'default', borderBottom: editingTitle ? '1px solid #c084fc' : 'none' }}
          >
            {editingTitle ? undefined : escHtml(entry.title)}
          </span>
          {entry.parentId && <span style={{ fontSize: 9, color: '#4a6080', fontStyle: 'italic' }}>↩ reply</span>}
        </div>
        <span style={{ color: '#3a4560', fontSize: 10 }}>{timeAgo(entry.createdAt)}</span>
      </div>

      {/* Entry body */}
      {entry.content && entry.type !== 'capture' && (
        <div style={{ color: '#8aa0c0', whiteSpace: 'pre-wrap', marginBottom: entry.imageData ? 6 : 0 }}>{entry.content}</div>
      )}

      {entry.imageData && (
        <div style={{ marginTop: 4, borderRadius: 4, overflow: 'hidden', border: '1px solid #1e2840' }}>
          <img src={entry.imageData} style={{ width: '100%', display: 'block', maxHeight: 180, objectFit: 'contain', background: '#0a0c12', cursor: 'pointer' }}
            onClick={() => {
              // Simple expand: open in new tab
              const w = window.open('')
              w?.document.write(`<img src="${entry.imageData}" style="max-width:100%;background:#000;" />`)
            }}
          />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => onReply(entry.id)} style={{ background: 'none', border: 'none', color: '#4a6080', fontSize: 10, cursor: 'pointer', padding: 0 }}>↩ Reply</button>
        <button onClick={() => { if (confirm('Delete this entry?')) onDelete(entry.id) }} style={{ background: 'none', border: 'none', color: '#4a6080', fontSize: 10, cursor: 'pointer', padding: 0 }}>🗑 Delete</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Main TabLab Component
// ═══════════════════════════════════════════════════════════════

export function TabLab() {
  const [projects, setProjects] = useState<LabProject[]>([])
  const [entries, setEntries] = useState<LabEntry[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInlineEditor, setShowInlineEditor] = useState(false)
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [showDescription, setShowDescription] = useState(false)

  // ── Load on mount ──
  useEffect(() => {
    const p = loadProjects()
    const e = loadEntries()
    setProjects(p)
    setEntries(e)
    // Restore state
    const state = loadLabState()
    if (state.projectId && p.find(proj => proj.id === state.projectId)) {
      setActiveProjectId(state.projectId)
      setActivePhaseId(state.phaseId || p.find(proj => proj.id === state.projectId)?.phases?.[0]?.id || null)
    }
  }, [])

  // ── Persist state on change ──
  useEffect(() => { saveLabState(activeProjectId, activePhaseId) }, [activeProjectId, activePhaseId])

  const activeProject = projects.find(p => p.id === activeProjectId) || null

  // Recount helper
  const withCounts = useCallback((proj: LabProject): LabProject => {
    return recountEntries(proj, entries)
  }, [entries])

  // ── CRUD ──

  const handleCreateProject = useCallback((name: string, type: LabProject['type'], linkedScanId: string | null) => {
    const id = genId('lab')
    const now = new Date().toISOString()
    const proj: LabProject = {
      id, name, description: '', type, status: 'idea', tags: '[]', linkedScanId,
      createdAt: now, updatedAt: now,
      phases: makePhases(id),
      _count: { entries: 0, phases: 5 },
    }
    const next = [proj, ...projects]
    setProjects(next)
    saveProjects(next)
    setActiveProjectId(proj.id)
    setActivePhaseId(proj.phases[0].id)
    setShowCreateModal(false)
  }, [projects])

  const handleDeleteProject = useCallback((id: string) => {
    if (!confirm('Delete this project and all entries?')) return
    const nextP = projects.filter(p => p.id !== id)
    const nextE = entries.filter(e => e.projectId !== id)
    setProjects(nextP); saveProjects(nextP)
    setEntries(nextE); saveEntries(nextE)
    if (activeProjectId === id) { setActiveProjectId(null); setActivePhaseId(null) }
  }, [projects, entries, activeProjectId])

  const handleUpdateProject = useCallback((id: string, data: Partial<LabProject>) => {
    const next = projects.map(p => p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p)
    setProjects(next); saveProjects(next)
  }, [projects])

  const handleAddEntry = useCallback((data: { type: LabEntry['type']; title: string; content: string; imageData: string | null; parentId?: string | null }) => {
    if (!activeProjectId || !activePhaseId) return
    const entry: LabEntry = {
      id: genId('e'),
      projectId: activeProjectId,
      phaseId: activePhaseId,
      parentId: data.parentId || null,
      type: data.type,
      title: data.title || 'Note',
      content: data.content,
      imageData: data.imageData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const next = [entry, ...entries]
    setEntries(next); saveEntries(next)
    setShowInlineEditor(false)
    setReplyToId(null)
  }, [activeProjectId, activePhaseId, entries])

  const handleDeleteEntry = useCallback((id: string) => {
    const next = entries.filter(e => e.id !== id)
    setEntries(next); saveEntries(next)
  }, [entries])

  const handleCaptureScreenshot = useCallback(() => {
    if (!activeProjectId || !activePhaseId) return
    const dataUrl = (window as any).chartScreenshot?.()
    if (!dataUrl || typeof dataUrl !== 'string') {
      // Fallback: try to grab canvas directly
      const canvas = document.querySelector('canvas')
      if (canvas) {
        try {
          const url = canvas.toDataURL('image/png', 0.85)
          handleAddEntry({ type: 'capture', title: 'Chart Capture', content: '', imageData: url })
          return
        } catch {}
      }
      return
    }
    handleAddEntry({ type: 'capture', title: 'Chart Capture', content: '', imageData: dataUrl })
  }, [activeProjectId, activePhaseId, handleAddEntry])

  // ── Computed ──

  const phaseEntries = activeProjectId && activePhaseId
    ? entries.filter(e => e.projectId === activeProjectId && e.phaseId === activePhaseId)
    : []

  // Group: top-level + replies
  const topLevel = phaseEntries.filter(e => !e.parentId)
  const getReplies = (parentId: string) => phaseEntries.filter(e => e.parentId === parentId)

  // ── Render: Project List ──

  if (!activeProject) {
    return (
      <div id="tab-lab" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', letterSpacing: 1 }}>🔬 STRATEGY LAB</span>
          <span style={{ flex: 1 }} />
          <button onClick={() => setShowCreateModal(true)}
            style={{ background: '#c084fc', color: '#000', border: 'none', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 3, cursor: 'pointer' }}>+ NEW</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
          {projects.length === 0 && (
            <div style={{ padding: '10px 14px', fontSize: 11, color: '#4a6080' }}>
              No strategy projects yet. Click + NEW to start.
            </div>
          )}
          {projects.map(p => {
            const counted = withCounts(p)
            const sc = STATUS_COLORS[p.status] || '#4a6080'
            return (
              <div key={p.id}
                onClick={() => { setActiveProjectId(p.id); setActivePhaseId(p.phases[0]?.id || null) }}
                onMouseOver={e => (e.currentTarget.style.background = '#111820')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #111820', transition: 'background .1s' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#dde3f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: '#4a6080' }}>{TYPE_LABELS[p.type] || p.type} · {counted._count.entries} entries</div>
                </div>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, background: sc + '22', color: sc, fontWeight: 700, textTransform: 'uppercase' }}>{p.status}</span>
                <button onClick={e => { e.stopPropagation(); handleDeleteProject(p.id) }}
                  style={{ background: 'none', border: 'none', color: '#4a6080', fontSize: 12, cursor: 'pointer', opacity: 0.5 }}
                  title="Delete">✕</button>
              </div>
            )
          })}
        </div>

        {showCreateModal && (
          <CreateProjectModal
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateProject}
          />
        )}
      </div>
    )
  }

  // ── Render: Project Detail ──

  const counted = withCounts(activeProject)

  return (
    <div id="tab-lab" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e2840', display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => { setActiveProjectId(null); setActivePhaseId(null) }}
          style={{ background: 'none', border: 'none', color: '#4a6080', fontSize: 14, cursor: 'pointer' }}>←</button>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#c084fc', flex: 1, cursor: 'pointer' }}
          onDoubleClick={() => {
            const newName = prompt('Rename project:', activeProject.name)
            if (newName?.trim()) handleUpdateProject(activeProject.id, { name: newName.trim() })
          }}>
          {activeProject.name}
        </span>
        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, background: (STATUS_COLORS[activeProject.status] || '#4a6080') + '22', color: STATUS_COLORS[activeProject.status] || '#4a6080', fontWeight: 700 }}>
          {TYPE_LABELS[activeProject.type] || activeProject.type} · {activeProject.status}
        </span>
        <select value={activeProject.status}
          onChange={e => handleUpdateProject(activeProject.id, { status: e.target.value as LabProject['status'] })}
          style={{
            background: '#1a1e2e', border: `1px solid ${STATUS_COLORS[activeProject.status]}`,
            color: STATUS_COLORS[activeProject.status], fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
          }}>
          {(['idea', 'active', 'complete', 'abandoned'] as const).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
        </select>
        <button onClick={handleCaptureScreenshot}
          style={{ background: '#c084fc', color: '#000', border: 'none', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 3, cursor: 'pointer' }}
          title="Capture chart screenshot">📷</button>
      </div>

      {/* Description (collapsible) */}
      <div style={{ padding: showDescription ? '4px 12px 8px' : '0 12px', borderBottom: '1px solid #111620' }}>
        <button onClick={() => setShowDescription(!showDescription)}
          style={{ background: 'none', border: 'none', color: '#4a6080', fontSize: 10, cursor: 'pointer', padding: showDescription ? '0 0 4px' : '2px 0' }}>
          {showDescription ? '▾' : '▸'} Description
        </button>
        {showDescription && (
          <textarea
            value={activeProject.description}
            onChange={e => handleUpdateProject(activeProject.id, { description: e.target.value })}
            placeholder="Add project description..."
            rows={2}
            style={{ width: '100%', background: '#0a0c12', border: '1px solid #1e2840', color: '#8aa0c0', fontSize: 11, padding: '6px 8px', borderRadius: 3, outline: 'none', resize: 'vertical' }}
          />
        )}
      </div>

      {/* Phase tabs */}
      <div id="lab-phase-tabs" style={{ display: 'flex', borderBottom: '1px solid #1e2840', overflowX: 'auto' }}>
        {counted.phases.map(ph => {
          const def = PHASE_DEFS.find(d => d.phase === ph.phase)
          const active = ph.id === activePhaseId
          return (
            <div key={ph.id} onClick={() => setActivePhaseId(ph.id)}
              style={{
                padding: '6px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                borderBottom: active ? '2px solid #c084fc' : '2px solid transparent',
                color: active ? '#c084fc' : '#4a6080',
              }}>
              {def?.icon || '📁'} {ph.label} <span style={{ color: '#4a6080' }}>({ph._count.entries})</span>
            </div>
          )
        })}
      </div>

      {/* Entries */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {/* Inline editor for replies */}
        {replyToId && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#c084fc', marginBottom: 4 }}>↩ Replying to entry</div>
            <InlineEditor
              project={activeProject}
              phaseId={activePhaseId!}
              onSave={data => handleAddEntry({ ...data, parentId: replyToId })}
              onCancel={() => setReplyToId(null)}
            />
          </div>
        )}

        {/* Inline editor for new entries */}
        {showInlineEditor && !replyToId && (
          <InlineEditor
            project={activeProject}
            phaseId={activePhaseId!}
            onSave={data => handleAddEntry(data)}
            onCancel={() => setShowInlineEditor(false)}
          />
        )}

        {topLevel.length === 0 && !showInlineEditor && (
          <div style={{ textAlign: 'center', padding: 20, color: '#3a4560', fontSize: 11 }}>
            No entries in this phase yet. Add a note below.
          </div>
        )}

        {topLevel.map(entry => (
          <div key={entry.id}>
            <EntryCard entry={entry} onReply={setReplyToId} onDelete={handleDeleteEntry} />
            {getReplies(entry.id).map(reply => (
              <div key={reply.id} style={{ marginLeft: 16 }}>
                <EntryCard entry={reply} onReply={setReplyToId} onDelete={handleDeleteEntry} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Quick add bar */}
      <div style={{ padding: '6px 8px', borderTop: '1px solid #111620', display: 'flex', gap: 4 }}>
        <button onClick={() => { setShowInlineEditor(true); setReplyToId(null) }}
          style={{ background: 'none', border: '1px solid #2a3050', color: '#8aa0c0', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 3, cursor: 'pointer' }}>
          📝 Note
        </button>
        <button onClick={handleCaptureScreenshot}
          style={{ background: 'none', border: '1px solid #2a3050', color: '#8aa0c0', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 3, cursor: 'pointer' }}>
          📷 Capture
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: '#3a4560', alignSelf: 'center' }}>
          {counted._count.entries} entries · {counted._count.phases} phases
        </span>
      </div>
    </div>
  )
}
