'use client'

import { useState, useRef } from 'react'
import { X, Upload, FileText, Loader2, CheckCircle2, AlertCircle, FolderOpen } from 'lucide-react'

interface ReviewImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
}

interface ParsedReview {
  filename: string
  date: string          // detected / editable YYYY-MM-DD
  dateConfident: boolean // did we find a real date?
  title: string
  contentMd: string
  size: number
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
      return { filename: f.name, date: date || '', dateConfident: confident, title: titleFromFilename(f.name), contentMd: text, size: f.size }
    }))
    parsed.sort((a, b) => (a.date < b.date ? 1 : -1))
    setItems(parsed)
  }

  const setItem = (idx: number, patch: Partial<ParsedReview>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const remove = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx))

  const doImport = async () => {
    const valid = items.filter((it) => /^\d{4}-\d{2}-\d{2}$/.test(it.date))
    if (valid.length === 0) { setError('Fix the dates first — each must be YYYY-MM-DD.') ; return }
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/calendar/reviews/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviews: valid.map((it) => ({
            date: it.date,
            title: it.title,
            content: mdToHtml(it.contentMd),
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
                    <div className="px-3 py-2 bg-[#0a0a0a] border-b border-[#1a1a1a] flex items-center justify-between">
                      <span className="text-xs studio-muted">{items.length} file{items.length !== 1 ? 's' : ''} · edit dates if the detection looks wrong</span>
                      <button onClick={() => setItems([])} className="text-xs studio-muted hover:text-red-400">clear all</button>
                    </div>
                    <div className="max-h-[40vh] overflow-y-auto divide-y divide-[#141414]">
                      {items.map((it, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center text-xs">
                          <div className="col-span-5 min-w-0">
                            <div className="font-medium studio-text truncate">{it.filename}</div>
                            <div className="studio-muted truncate">{it.title}</div>
                          </div>
                          <div className="col-span-3">
                            <input
                              value={it.date}
                              onChange={(e) => setItem(idx, { date: e.target.value, dateConfident: /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) })}
                              placeholder="YYYY-MM-DD"
                              className={`w-full bg-[#0a0a0a] border rounded px-2 py-1 text-xs studio-text focus:outline-none ${it.dateConfident ? 'border-[#2a2a2a]' : 'border-amber-700/60'}`}
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              value={it.title}
                              onChange={(e) => setItem(idx, { title: e.target.value })}
                              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 text-xs studio-text focus:outline-none"
                            />
                          </div>
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
                    {items.length > 0 ? `${items.filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.date)).length} ready` : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={close} className="px-4 py-2 rounded-lg text-sm studio-muted hover:studio-text hover:bg-[#141c2b]">Cancel</button>
                    <button
                      onClick={doImport}
                      disabled={busy || items.length === 0}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#D4AF37] text-[#0a0a0a] text-sm font-semibold hover:opacity-90 disabled:opacity-40"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {busy ? 'Importing…' : `Import ${items.length || ''}`}
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
