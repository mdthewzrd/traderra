'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * TabLab — Strategy Lab with project CRUD, phases, captures, notes.
 * Projects persist to localStorage.
 */

interface LabEntry {
  id: string
  type: 'note' | 'capture'
  text: string
  imageData?: string
  createdAt: number
}

interface LabPhase {
  name: string
  entries: LabEntry[]
}

interface LabProject {
  id: string
  name: string
  status: 'idea' | 'active' | 'complete' | 'abandoned'
  phases: Record<string, LabPhase>
  createdAt: number
}

const STORAGE_KEY = 'traderra-lab-projects'
const PHASE_NAMES = ['Idea', 'Setup', 'Execution', 'Review']

function loadProjects(): LabProject[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter(p => p && p.phases && typeof p.phases === 'object')
  } catch { return [] }
}

function saveProjects(projects: LabProject[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

export function TabLab() {
  const [projects, setProjects] = useState<LabProject[]>(loadProjects)
  const [activeProject, setActiveProject] = useState<LabProject | null>(null)
  const [activePhase, setActivePhase] = useState('Idea')
  const [noteText, setNoteText] = useState('')

  useEffect(() => { setProjects(loadProjects()) }, [])

  const createProject = useCallback(() => {
    const name = prompt('Project name:')
    if (!name) return
    const phases: Record<string, LabPhase> = {}
    for (const p of PHASE_NAMES) phases[p] = { name: p, entries: [] }
    const proj: LabProject = { id: 'lab-' + Date.now(), name, status: 'idea', phases, createdAt: Date.now() }
    const next = [...projects, proj]
    setProjects(next)
    saveProjects(next)
    setActiveProject(proj)
    setActivePhase('Idea')
  }, [projects])

  const deleteProject = useCallback((id: string) => {
    const next = projects.filter(p => p.id !== id)
    setProjects(next)
    saveProjects(next)
    if (activeProject?.id === id) setActiveProject(null)
  }, [projects, activeProject])

  const updateProject = useCallback((proj: LabProject) => {
    const next = projects.map(p => p.id === proj.id ? proj : p)
    setProjects(next)
    saveProjects(next)
    setActiveProject(proj)
  }, [projects])

  const addNote = useCallback(() => {
    if (!noteText.trim() || !activeProject) return
    const entry: LabEntry = { id: 'e-' + Date.now(), type: 'note', text: noteText, createdAt: Date.now() }
    const phase = activeProject.phases[activePhase]
    if (!phase) return
    const updated = { ...activeProject, phases: { ...activeProject.phases, [activePhase]: { ...phase, entries: [...phase.entries, entry] } } }
    updateProject(updated)
    setNoteText('')
  }, [noteText, activeProject, activePhase, updateProject])

  const captureScreenshot = useCallback(() => {
    if (!activeProject) return
    const dataUrl = (window as any).chartScreenshot?.()
    // chartScreenshot returns void but saves to clipboard, so we'll just add a note
    const entry: LabEntry = { id: 'e-' + Date.now(), type: 'capture', text: '📷 Chart capture', createdAt: Date.now() }
    const phase = activeProject.phases[activePhase]
    if (!phase) return
    const updated = { ...activeProject, phases: { ...activeProject.phases, [activePhase]: { ...phase, entries: [...phase.entries, entry] } } }
    updateProject(updated)
    // Also trigger the actual screenshot
    ;(window as any).chartScreenshot?.()
  }, [activeProject, activePhase, updateProject])

  const statusColors: Record<string, string> = { idea: '#c084fc', active: '#26a69a', complete: '#D4AF37', abandoned: '#4a6080' }

  // Project list view
  if (!activeProject) {
    return (
      <div id="tab-lab">
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', letterSpacing: 1 }}>🔬 STRATEGY LAB</span>
          <span style={{ flex: 1 }} />
          <button onClick={createProject} style={{ background: '#c084fc', color: '#000', border: 'none', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 3, cursor: 'pointer' }}>+ NEW</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
          {projects.length === 0 && (
            <div style={{ padding: '10px 14px', fontSize: 11, color: '#4a6080' }}>No strategy projects yet.</div>
          )}
          {projects.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 3, cursor: 'pointer', marginBottom: 2 }}
              onClick={() => { setActiveProject(p); setActivePhase('Idea') }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#1a1e2e')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 10, padding: '2px 5px', borderRadius: 3, fontWeight: 700, background: (statusColors[p.status] || '#4a6080') + '20', color: statusColors[p.status] || '#4a6080', border: `1px solid ${statusColors[p.status] || '#4a6080'}` }}>{(p.status || 'idea').toUpperCase()}</span>
              <span style={{ fontSize: 11, color: '#dde3f0', fontWeight: 700, flex: 1 }}>{p.name}</span>
              <span style={{ fontSize: 10, color: '#4a6080' }}>{Object.values(p.phases || {}).reduce((s: number, ph: any) => s + (ph?.entries?.length || 0), 0)} entries</span>
              <span style={{ fontSize: 10, color: '#ff3d57', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); deleteProject(p.id) }}>✕</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Project detail view
  const phase = activeProject.phases[activePhase]
  const entries = phase?.entries || []

  return (
    <div id="tab-lab" >
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e2840', display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => setActiveProject(null)} style={{ background: 'none', border: 'none', color: '#4a6080', fontSize: 14, cursor: 'pointer' }}>←</button>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#c084fc', flex: 1 }}>{activeProject.name}</span>
        <select value={activeProject.status} style={{ background: '#1a1e2e', border: `1px solid ${statusColors[activeProject.status]}`, color: statusColors[activeProject.status], fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, cursor: 'pointer' }}
          onChange={(e) => updateProject({ ...activeProject, status: e.target.value as any })}>
          {['idea', 'active', 'complete', 'abandoned'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
        </select>
        <button onClick={captureScreenshot} style={{ background: '#c084fc', color: '#000', border: 'none', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 3, cursor: 'pointer' }} title="Capture chart screenshot">📷</button>
      </div>

      {/* Phase tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e2840', overflowX: 'auto' }}>
        {PHASE_NAMES.map(p => (
          <button key={p} style={{
            padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            border: 'none', borderBottom: activePhase === p ? '2px solid #c084fc' : '2px solid transparent',
            background: activePhase === p ? '#c084fc10' : 'transparent',
            color: activePhase === p ? '#c084fc' : '#4a6080',
          }} onClick={() => setActivePhase(p)}>{p}</button>
        ))}
      </div>

      {/* Entries */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: '#3a4560', fontSize: 11 }}>
            No entries in this phase yet. Add a note below.
          </div>
        )}
        {entries.map(e => (
          <div key={e.id} style={{ padding: '6px 8px', background: '#0d1220', border: '1px solid #1e2840', borderRadius: 4, fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#4a6080', fontSize: 10 }}>{e.type === 'capture' ? '📷 Capture' : '📝 Note'}</span>
              <span style={{ color: '#3a4560', fontSize: 10 }}>{new Date(e.createdAt).toLocaleString()}</span>
            </div>
            <div style={{ color: '#dde3f0' }}>{e.text}</div>
          </div>
        ))}
      </div>

      {/* Add note */}
      <div style={{ padding: '6px 8px', borderTop: '1px solid #111620', display: 'flex', gap: 4 }}>
        <input
          type="text" placeholder="+ Add note..." value={noteText}
          style={{ flex: 1, background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 11, padding: '4px 8px', borderRadius: 3, outline: 'none' }}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addNote()}
        />
        <button onClick={addNote} style={{ background: '#c084fc', color: '#000', border: 'none', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 3, cursor: 'pointer' }}>+</button>
      </div>
    </div>
    </div>
  )
}
