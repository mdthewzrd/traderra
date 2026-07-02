import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import * as yaml from 'js-yaml'

/**
 * GET /api/scans/specs/[name]/params
 *
 * Parses a YAML scan spec into a structured manifest of TUNABLE parameters.
 *
 * A "param" = any threshold with a numeric right-hand side:
 *   - filters:        price_min: 1, volume_min: 1000000
 *   - preflight:      d1_pct_change >= 15   (recurses into or/and blocks)
 *   - signal conds:   momentum_ratio_1_2 >= 2
 *
 * Structural conditions (RHS is a column, e.g. `high >= pm_high_est`) are NOT
 * params — they're logic, not knobs — so they're excluded automatically.
 *
 * The YAML file is the single source of truth (no DB param copy → no drift).
 * Per-run edits are applied as line-level surgery on a temp copy (Phase 2).
 */

interface SpecParam {
  id: string
  section: string        // "Filters" | "Preflight" | "Signal: d2_pmh_break"
  signal: string | null  // signal name, or null for filters/preflight
  column: string         // momentum_ratio_1_2
  op: string             // >= | <= | == | != | > | <
  value: number          // 2
  type: 'number'
}

const COND_RE = /^([\w.]+)\s*(>=|<=|==|!=|>|<)\s*(.+)$/

function isNumeric(v: string): boolean {
  // A bare number (int/float, possibly negative). NOT a column name.
  return /^-?\d+(\.\d+)?$/.test(v.trim())
}

function parseCondition(raw: string): { column: string; op: string; rhs: string } | null {
  const s = raw.split('#')[0].trim() // strip trailing comments
  if (!s) return null
  const m = s.match(COND_RE)
  if (!m) return null
  return { column: m[1], op: m[2], rhs: m[3].trim() }
}

// Recurse preflight conditions (which may nest or/and blocks)
function walkConditions(
  node: any,
  out: SpecParam[],
  section: string,
  signal: string | null,
  prefix: string,
): void {
  if (!Array.isArray(node)) return
  node.forEach((item, i) => {
    if (typeof item === 'string') {
      const c = parseCondition(item)
      if (c && isNumeric(c.rhs)) {
        out.push({
          id: `${prefix}:${i}:${c.column}`,
          section, signal,
          column: c.column, op: c.op,
          value: parseFloat(c.rhs),
          type: 'number',
        })
      }
    } else if (item && typeof item === 'object') {
      // or: / and: block — recurse into the nested list
      for (const key of Object.keys(item)) {
        if (key === 'or' || key === 'and') walkConditions(item[key], out, section, signal, `${prefix}:${key}:${i}`)
      }
    }
  })
}

export async function GET(req: NextRequest, ctx: { params: { name: string } }) {
  const name = ctx.params.name
  const specPath = join(homedir(), '.wzrd-pi-dev', 'projects', 'edge-dev', 'assets', 'specs', `${name}.yaml`)

  let doc: any
  try {
    const raw = readFileSync(specPath, 'utf8')
    doc = yaml.load(raw)
  } catch (err: any) {
    if (err.code === 'ENOENT') return NextResponse.json({ error: `spec '${name}' not found` }, { status: 404 })
    return NextResponse.json({ error: `failed to parse spec: ${err.message}` }, { status: 500 })
  }

  const params: SpecParam[] = []

  // ── filters: list of single-key dicts (price_min: 1, volume_min: 1000000) ──
  if (Array.isArray(doc.filters)) {
    doc.filters.forEach((f: any, i: number) => {
      if (!f || typeof f !== 'object') return
      for (const [k, v] of Object.entries(f)) {
        if (typeof v === 'number' || typeof v === 'boolean') {
          params.push({
            id: `f:${i}:${k}`,
            section: 'Filters', signal: null,
            column: k, op: '>=',
            value: v as number,
            type: typeof v === 'boolean' ? 'number' : 'number',
          })
        }
      }
    })
  }

  // ── intraday_filter: dict of scalar knobs (start_hour, ema_period, …) ──
  if (doc.intraday_filter && typeof doc.intraday_filter === 'object') {
    for (const [k, v] of Object.entries(doc.intraday_filter)) {
      if (typeof v === 'number') {
        params.push({ id: `if:${k}`, section: 'Intraday Filter', signal: null, column: k, op: '=', value: v, type: 'number' })
      }
    }
  }

  // ── preflight: .lookback (scalar) + .conditions (may nest or/and) ──
  if (doc.preflight) {
    if (typeof doc.preflight.lookback === 'number') {
      params.push({ id: 'p:lookback', section: 'Preflight', signal: null, column: 'lookback', op: '=', value: doc.preflight.lookback, type: 'number' })
    }
    if (doc.preflight.conditions) walkConditions(doc.preflight.conditions, params, 'Preflight', null, 'p')
  }

  // ── top-level conditions: entry criteria shared by every signal (may nest or/and) ──
  if (Array.isArray(doc.conditions)) walkConditions(doc.conditions, params, 'Conditions', null, 'c')

  // ── params: per-feature threshold blocks (monolithic feature knobs) ──
  // e.g. params: { backside_mold_pass: { atr_mult: 0.9, vol_mult: 0.9 } }
  // Surfaces internal thresholds of monolithic features. Column names stay stable
  // (bare feature name) so condition references don't break on edit.
  if (doc.params && typeof doc.params === 'object') {
    for (const [featName, knobs] of Object.entries(doc.params)) {
      if (!knobs || typeof knobs !== 'object') continue
      for (const [k, v] of Object.entries(knobs)) {
        if (typeof v === 'number') {
          params.push({ id: `fp:${featName}:${k}`, section: `Feature: ${featName}`, signal: null, column: k, op: '=', value: v, type: 'number' })
        }
      }
    }
  }

  // ── signals: each has .conditions (list of strings) ──
  if (Array.isArray(doc.signals)) {
    doc.signals.forEach((sig: any) => {
      const sigName = sig.signal || 'unnamed'
      const section = `Signal: ${sigName}`
      if (Array.isArray(sig.conditions)) {
        walkConditions(sig.conditions, params, section, sigName, `s:${sigName}`)
      }
    })
  }

  return NextResponse.json({
    spec: name,
    name: doc.name || name,
    description: typeof doc.description === 'string' ? doc.description.trim() : '',
    paramCount: params.length,
    params,
  })
}

// ── Write-back helpers ─────────────────────────────────────────────────────
// A param id encodes its location+column. We invert it to find the YAML line and
// rewrite ONLY the numeric RHS (comments + structure preserved — no js-yaml dump).
//   f:<i>:<col>        → filter list item      `  - <col>: <n>`
//   if:<col>           → intraday_filter scalar `  <col>: <n>`
//   p:lookback         → preflight scalar       `  lookback: <n>`
//   p|c|s:<…>:<col>    → condition              `  - <col> <op> <n>`
function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function decodeParamId(id: string): { kind: 'filter' | 'scalar' | 'condition' | 'feature' | 'featparam'; column: string; feature?: string } {
  const parts = id.split(':')
  const prefix = parts[0]
  const column = parts[parts.length - 1]
  if (prefix === 'f') return { kind: 'filter', column }
  if (prefix === 'if') return { kind: 'scalar', column }
  if (prefix === 'p' && column === 'lookback') return { kind: 'scalar', column: 'lookback' }
  if (prefix === 'fp') return { kind: 'featparam', feature: parts[1], column }
  if (prefix === 'feat') return { kind: 'feature', feature: parts[1], column }
  return { kind: 'condition', column }
}

/**
 * PATCH /api/scans/specs/[name]/params
 * body: { edits: Record<paramId, number> }  (paramId → new value)
 * Performs line-level surgery on the YAML spec file: each edit rewrites the numeric
 * RHS of the matched condition/filter line. The file stays the single source of truth
 * (git gives history). Returns { ok, applied, skipped }.
 */
export async function PATCH(req: NextRequest, ctx: { params: { name: string } }) {
  const name = ctx.params.name
  const specPath = join(homedir(), '.wzrd-pi-dev', 'projects', 'edge-dev', 'assets', 'specs', `${name}.yaml`)

  let text: string
  try { text = readFileSync(specPath, 'utf8') }
  catch (err: any) {
    if (err.code === 'ENOENT') return NextResponse.json({ error: `spec '${name}' not found` }, { status: 404 })
    return NextResponse.json({ error: `read failed: ${err.message}` }, { status: 500 })
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const edits: Record<string, number> = body.edits || {}
  if (!edits || typeof edits !== 'object') {
    return NextResponse.json({ error: 'body.edits {paramId: number} required' }, { status: 400 })
  }

  const lines = text.split('\n')
  const used = new Set<number>()
  const applied: string[] = []
  const skipped: string[] = []

  for (const [id, rawVal] of Object.entries(edits)) {
    const newVal = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal)
    if (!Number.isFinite(newVal)) { skipped.push(id); continue }
    const { kind, column } = decodeParamId(id)
    const feat = (decodeParamId(id) as any).feature
    const colRe = escapeRe(column)
    let found = false
    // feature: rewrite `arg=<n>` inside the matching `feature(...)` declaration line
    if (kind === 'feature') {
      const featRe = new RegExp(`^(\\s*-\\s*${escapeRe(feat)}\\([^)]*\\b${colRe}=)(-?[\\d.]+)(.*)$`)
      for (let i = 0; i < lines.length; i++) {
        if (used.has(i)) continue
        const m = lines[i].match(featRe)
        if (m) { lines[i] = m[1] + String(newVal) + (m[3] || ''); used.add(i); applied.push(id); found = true; break }
      }
    } else if (kind === 'featparam') {
      // rewrite `    arg: <n>` indented under the feature's params block (4-space indent)
      const fpRe = new RegExp(`^(\\s{4,}${colRe}\\s*:\\s*)(-?[\\d.]+)(.*)$`)
      for (let i = 0; i < lines.length; i++) {
        if (used.has(i)) continue
        const m = lines[i].match(fpRe)
        if (m) { lines[i] = m[1] + String(newVal) + (m[3] || ''); used.add(i); applied.push(id); found = true; break }
      }
    } else {
      const re = kind === 'condition'
        ? new RegExp(`^(\\s*-\\s*${colRe}\\s*(?:>=|<=|==|!=|>|<)\\s*)(-?[\\d.]+)(.*)$`)
        : new RegExp(`^(\\s*-?\\s*${colRe}\\s*:\\s*)(-?[\\d.]+)(.*)$`)
      for (let i = 0; i < lines.length; i++) {
        if (used.has(i)) continue
        const m = lines[i].match(re)
        if (m) {
          lines[i] = m[1] + String(newVal) + (m[3] || '')
          used.add(i); applied.push(id); found = true; break
        }
      }
    }
    if (!found) skipped.push(id)
  }

  if (applied.length) {
    try { writeFileSync(specPath, lines.join('\n')) }
    catch (err: any) { return NextResponse.json({ error: `write failed: ${err.message}` }, { status: 500 }) }
  }
  return NextResponse.json({ ok: true, spec: name, applied: applied.length, skipped })
}
