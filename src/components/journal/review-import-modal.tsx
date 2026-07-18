'use client'

import { useState, useRef } from 'react'
import { X, Upload, FileText, Loader2, CheckCircle2, AlertCircle, FolderOpen, Check } from 'lucide-react'

interface ReviewImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
}

type ReviewKind = 'daily' | 'weekly' | 'trade-review' | 'setup-review' | 'unknown'

interface ParsedReview {
  filename: string
  date: string          // detected / editable YYYY-MM-DD
  dateConfident: boolean // did we find a real date?
  title: string
  contentMd: string
  size: number
  kind: ReviewKind       // auto-classified category
  selected: boolean      // include in this import?
}

const KIND_META: Record<ReviewKind, { label: string; badge: string; desc: string }> = {
  daily:         { label: 'Daily',   badge: 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30',       desc: 'Daily Report Card (DRC)' },
  weekly:        { label: 'Weekly',  badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',   desc: 'Weekly review / summary' },
  'trade-review':{ label: 'Trade',   badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',         desc: 'Trade review / analysis' },
  'setup-review':{ label: 'Setup',   badge: 'bg-teal-500/15 text-teal-300 border-teal-500/30',         desc: 'Setup / strategy review' },
  unknown:       { label: 'Unknown', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',       desc: 'Unclear — needs your call' },
}

/**
 * Classify a file into a review category based on filename + title + first
 * chunk of content. Conservative: if nothing clearly matches, returns
 * 'unknown' so the user can decide. This is deliberately title-driven
 * because Notion markdown bodies rarely self-identify type.
 */
function classifyReview(filename: string, title: string, contentHead: string): ReviewKind {
  const hay = `${filename} ${title} ${contentHead.slice(0, 300)}`.toLowerCase()
  // Daily Report Card — the user's canonical daily review. Match DRC as a
  // standalone token (not inside another word) plus the long form.
  if (/\bdrc\b|daily report card|mike'?s? drc/.test(hay)) return 'daily'
  if (/weekly review|weekly recap|week in review/.test(hay)) return 'weekly'
  if (/trade review|trade analysis|trader review|trade recap/.test(hay)) return 'trade-review'
  if (/setup review|setup analysis|strategy review|playbook review/.test(hay)) return 'setup-review'
  // Month-year-only titles ("January 25'") — ambiguous, ask the user.
  if (/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{2}'?$/.test(title.trim().toLowerCase())) return 'unknown'
  return 'unknown'
}

/**
 * Detects a YYYY-MM-DD date from a string (filename or doc content).
 * Tries ISO first, then "Jan 15, 2026" / "January 15 2026" forms.
 */
function detectDate(text: string): string | null {
  // ISO YYYY-MM-DD
  let m = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  // 2026/01/15
  m = text.match(/\b(20\d{2})\/(\d{2})\/(\d{2})\b/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  // Month name forms: January 15, 2026 / Jan 15 2026
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
    jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07', aug: '08',
    sep: '09', sept: '09', oct: '10', nov: '11', dec: '12',
  }
  const re = new RegExp(`\\b(${Object.keys(months).join('|')})\\s+(\\d{1,2}),?\\s*(20\\d{2})\\b`, 'i')
  m = text.match(re)
  if (m) {
    const mon = months[m[1].toLowerCase()]
    const day = m[2].padStart(2, '0')
    return `${m[3]}-${mon}-${day}`
  }
  return null
}

/**
 * Minimal Markdown → HTML converter tuned for clean Notion exports.
 * Handles: headings (#..######), hr (---), blockquotes, ul/ol lists,
 * bold/italic/code, links, and paragraphs. Passes through existing HTML tags.
 */
function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  const inline = (s: string) => s
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }

    // Headings
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const lvl = h[1].length
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`)
      i++; continue
    }
    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr />'); i++; continue }
    // Blockquote
    if (line.trim().startsWith('>')) {
      const block: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) { block.push(lines[i].replace(/^\s*>\s?/, '')); i++ }
      out.push(`<blockquote>${block.map(inline).join('<br />')}</blockquote>`)
      continue
    }
    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\s*[-*+]\s+/, ''))}</li>`); i++ }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }
    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`); i++ }
      out.push(`<ol>${items.join('')}</ol>`)
      continue
    }
    // Paragraph (collect consecutive non-blank, non-special lines)
    const para: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() !== '' &&
      !/^(#{1,6})\s/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) && !lines[i].trim().startsWith('>') &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])) {
      para.push(lines[i]); i++
    }
    out.push(`<p>${inline(para.join(' '))}</p>`)
  }
  return out.join('\n')
}

const titleFromFilename = (name: string) =>
  name.replace(/\.md$/i, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)

export function ReviewImportModal({ isOpen, onClose, onImported }: ReviewImportModalProps) {
  const [items, setItems] = useState<ParsedReview[]>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number; merged: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const reset = () => { setItems([]); setResult(null); setError(null) }
  const close = () => { reset(); onClose() }

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null); setResult(null)
    const arr = Array.from(files).filter((f) => /\.md$/i.test(f.name))
    if (arr.length === 0) { setError('No .md files found. Export your Notion database as Markdown & CSV.') ;return }
    const parsed: ParsedReview[] = await Promise.all(arr.map(async (f) => {
      const text = await f.text()
      let date = detectDate(f.name) || detectDate(text.slice(0, 500))
      let confident = !!date
      if (!date) {
        // Fallback: file's last-modified date.
        date = f.lastModified ? new Date(f.lastModified).toISOString().split('T')[0] : ''
        confident = false
      }
      const title = titleFromFilename(f.name)
      const kind = classifyReview(f.name, title, text.slice(0, 400))
      return {
        filename: f.name,
        date: date || '',
        dateConfident: confident,
        title,
        contentMd: text,
        size: f.size,
        kind,
        // Default: only daily reviews are pre-selected. Everything else stays
        // visible but unchecked so the user can opt in or assign.
        selected: kind === 'daily',
      }
    }))
    parsed.sort((a, b) => (a.date < b.date ? 1 : -1))
    setItems(parsed)
  }

  const setItem = (idx: number, patch: Partial<ParsedReview>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const remove = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx))

  const counts = items.reduce<Record<ReviewKind, number>>((acc, it) => {
    acc[it.kind] = (acc[it.kind] || 0) + 1; return acc
  }, { daily: 0, weekly: 0, 'trade-review': 0, 'setup-review': 0, unknown: 0 })

  const selectedCount = items.filter((i) => i.selected && /^\d{4}-\d{2}-\d{2}$/.test(i.date)).length
  const unknownCount = counts.unknown

  const setKindBulk = (kind: ReviewKind, target: ReviewKind) =>
    setItems((prev) => prev.map((it) => (it.kind === kind ? { ...it, kind: target, selected: target === 'daily' || target === 'weekly' } : it)))

  const selectAllOfKind = (kind: ReviewKind, val: boolean) =>
    setItems((prev) => prev.map((it) => (it.kind === kind ? { ...it, selected: val } : it)))

  const doImport = async () => {
    const valid = items.filter((it) => it.selected && /^\d{4}-\d{2}-\d{2}$/.test(it.date))
    if (valid.length === 0) { setError('No files selected. Tick the checkbox on the files you want to import.') ; return }
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/calendar/reviews/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviews: valid.map((it) => ({
            date: it.date,
            title: it.title,
            content: mdToHtml(it.contentMd),
            kind: it.kind,
          })),
        }),
      })
      const d = r.ok ? await r.json() : null
      if (!d) throw new Error('import failed')
      setResult({ created: d.created, updated: d.updated, merged: d.merged ?? 0, skipped: d.skipped })
      onImported()
    } catch (e: any) {
      setError(e?.message || 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
      <div className="relative min-h-full flex items-start justify-center p-4 py-10">
        <div className="relative bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl w-full max-w-3xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-[#D4AF37]" />
              <h2 className="text-lg font-bold studio-text">Import Daily Reviews</h2>
            </div>
            <button onClick={close} className="p-1.5 rounded-lg studio-muted hover:studio-text hover:bg-[#141c2b]"><X className="h-4 w-4" /></button>
          </div>

          <div className="p-5 space-y-4">
            {result ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-400 mb-3" />
                <h3 className="text-lg font-semibold studio-text mb-1">Import complete</h3>
                <p className="text-sm studio-muted">
                  {result.created} created · {result.updated} updated · {result.merged ? `${result.merged} merged · ` : ''}{result.skipped} skipped
                </p>
                <button onClick={close} className="mt-5 px-5 py-2 rounded-lg bg-[#D4AF37] text-[#0a0a0a] text-sm font-semibold hover:opacity-90">Done</button>
              </div>
            ) : (
              <>
                <p className="text-sm studio-muted">
                  Export your Notion database as <strong className="studio-text">Markdown &amp; CSV</strong>, then bring the <code className="text-[#D4AF37]">.md</code> files in. Pick individual files, or select the whole unzipped export folder — duplicates on the same date are <strong className="studio-text">merged</strong> (never lost), and anything with &quot;weekly&quot; in the title is tagged separately.
                </p>

                {/* Drop zone */}
                <div
                  onClick={() => inputRef.current?.click()}
                  className="border-2 border-dashed border-[#2a2a2a] rounded-lg p-8 text-center cursor-pointer hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/5 transition-colors"
                >
                  <FileText className="h-8 w-8 studio-muted mx-auto mb-2" />
                  <p className="text-sm studio-text font-medium">Click to select .md files</p>
                  <p className="text-xs studio-muted mt-1">or use the folder button below to import a whole export</p>
                  <input ref={inputRef} type="file" accept=".md,text/markdown" multiple className="hidden"
                    onChange={(e) => onFiles(e.target.files)} />
                </div>

                <div className="flex items-center justify-center">
                  <button type="button" onClick={() => folderRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2a2a2a] text-sm studio-text hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/5 transition-colors">
                    <FolderOpen className="h-4 w-4" /> Select entire folder
                  </button>
                  <input ref={folderRef} type="file" {...({ webkitdirectory: '', directory: '' } as any)} multiple className="hidden"
                    onChange={(e) => onFiles(e.target.files)} />
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/40 border border-red-900/50 text-sm text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                  </div>
                )}

                {/* Preview table */}
                {items.length > 0 && (
                  <div className="border border-[#1a1a1a] rounded-lg overflow-hidden">
                    {/* Category chips + bulk actions */}
                    <div className="px-3 py-2 bg-[#0a0a0a] border-b border-[#1a1a1a] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs studio-muted">{items.length} file{items.length !== 1 ? 's' : ''} · edit dates if detection looks wrong</span>
                        <button onClick={() => setItems([])} className="text-xs studio-muted hover:text-red-400">clear all</button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(['daily','weekly','trade-review','setup-review','unknown'] as ReviewKind[]).map((k) =>
                          counts[k] > 0 && (
                            <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border ${KIND_META[k].badge}`}>
                              {KIND_META[k].label} · {counts[k]}
                              {k === 'daily' && (
                                <button onClick={() => selectAllOfKind('daily', !items.some((i) => i.kind === 'daily' && i.selected))}
                                  className="ml-1 hover:opacity-80" title="toggle all daily">{items.some((i) => i.kind === 'daily' && i.selected) ? '☑' : '☐'}</button>
                              )}
                            </span>
                          )
                        )}
                      </div>
                      {unknownCount > 0 && (
                        <div className="flex items-start gap-2 px-2 py-1.5 rounded bg-amber-950/30 border border-amber-900/40 text-xs text-amber-200/90">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span>{unknownCount} file{unknownCount !== 1 ? 's' : ''} couldn&apos;t be auto-classified. Assign all as: </span>
                            <button onClick={() => setKindBulk('unknown','daily')} className="font-semibold text-[#D4AF37] hover:underline mx-1">Daily</button>·
                            <button onClick={() => setKindBulk('unknown','weekly')} className="font-semibold text-purple-300 hover:underline mx-1">Weekly</button>·
                            <button onClick={() => setKindBulk('unknown','trade-review')} className="font-semibold text-blue-300 hover:underline mx-1">Trade</button>·
                            <button onClick={() => setKindBulk('unknown','setup-review')} className="font-semibold text-teal-300 hover:underline mx-1">Setup</button>
                            <span className="block studio-muted mt-0.5">or set each one individually below.</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Rows */}
                    <div className="max-h-[42vh] overflow-y-auto divide-y divide-[#141414]">
                      {items.map((it, idx) => (
                        <div key={idx} className={`grid grid-cols-12 gap-2 px-3 py-2 items-center text-xs ${it.selected ? '' : 'opacity-60'}`}>
                          {/* Checkbox */}
                          <div className="col-span-1">
                            <button onClick={() => setItem(idx, { selected: !it.selected })}
                              className={`flex h-5 w-5 items-center justify-center rounded border ${it.selected ? 'bg-[#D4AF37] border-[#D4AF37] text-[#0a0a0a]' : 'border-[#333] text-transparent hover:border-[#D4AF37]/60'}`}>
                              <Check className="h-3 w-3" />
                            </button>
                          </div>
                          {/* Filename + title */}
                          <div className="col-span-4 min-w-0">
                            <div className="font-medium studio-text truncate">{it.filename}</div>
                            <div className="studio-muted truncate">{it.title}</div>
                          </div>
                          {/* Category dropdown */}
                          <div className="col-span-2">
                            <select
                              value={it.kind}
                              onChange={(e) => setItem(idx, { kind: e.target.value as ReviewKind, selected: e.target.value === 'daily' || e.target.value === 'weekly' })}
                              className={`w-full bg-[#0a0a0a] border rounded px-1.5 py-1 text-[11px] focus:outline-none ${KIND_META[it.kind].badge}`}
                            >
                              {(['daily','weekly','trade-review','setup-review','unknown'] as ReviewKind[]).map((k) => (
                                <option key={k} value={k} className="bg-[#0a0a0a] text-white">{KIND_META[k].label}</option>
                              ))}
                            </select>
                          </div>
                          {/* Date */}
                          <div className="col-span-2">
                            <input
                              value={it.date}
                              onChange={(e) => setItem(idx, { date: e.target.value, dateConfident: /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) })}
                              placeholder="YYYY-MM-DD"
                              className={`w-full bg-[#0a0a0a] border rounded px-2 py-1 text-xs studio-text focus:outline-none ${it.dateConfident ? 'border-[#2a2a2a]' : 'border-amber-700/60'}`}
                            />
                          </div>
                          {/* Title override */}
                          <div className="col-span-2">
                            <input
                              value={it.title}
                              onChange={(e) => setItem(idx, { title: e.target.value })}
                              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 text-xs studio-text focus:outline-none"
                            />
                          </div>
                          {/* Remove */}
                          <div className="col-span-1 flex justify-end">
                            <button onClick={() => remove(idx)} className="text-studio-muted/60 hover:text-red-400 p-1"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs studio-muted">
                    {items.length > 0 ? `${selectedCount} selected · ${items.filter((i) => i.selected && !/^\d{4}-\d{2}-\d{2}$/.test(i.date)).length} need a date` : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={close} className="px-4 py-2 rounded-lg text-sm studio-muted hover:studio-text hover:bg-[#141c2b]">Cancel</button>
                    <button
                      onClick={doImport}
                      disabled={busy || selectedCount === 0}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#D4AF37] text-[#0a0a0a] text-sm font-semibold hover:opacity-90 disabled:opacity-40"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {busy ? 'Importing…' : `Import ${selectedCount || ''}`}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
