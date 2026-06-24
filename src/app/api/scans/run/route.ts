import { NextRequest, NextResponse } from 'next/server'
import { execFile, spawn } from 'child_process'
import { writeFile, mkdir, unlink, readFile } from 'fs/promises'
import path from 'path'
import os from 'os'

// Background scan job tracking
interface ScanJob {
  id: string
  strategy: string
  label: string
  status: 'running' | 'done' | 'error'
  startedAt: number
  finishedAt?: number
  stdout: string
  stderr: string
  signalCount?: number
  error?: string
  pid?: number
  params: Record<string, any>
  from: string
  to: string
  logFile?: string
}
const SCAN_JOBS = new Map<string, ScanJob>()

// Persist jobs to disk (survives dev hot reloads) — path defined after SCRIPTS_DIR below
async function loadJobs(): Promise<Record<string, ScanJob>> {
  try {
    const raw = await readFile(JOBS_FILE, 'utf-8')
    console.log(`[SCAN] loadJobs: read ${raw.length} bytes from ${JOBS_FILE}`)
    return JSON.parse(raw)
  } catch (e: any) { console.log(`[SCAN] loadJobs ERROR: ${e.message}`); return {} }
}
async function saveJobs(jobs: Record<string, ScanJob>) {
  try { await writeFile(JOBS_FILE, JSON.stringify(jobs)) } catch {}
}

// POST /api/scans/run — execute Python scan code or run a named spec
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { code, from, to, filterMode = '3', name = 'custom_scan', spec, runner, params } = body

  // Mode 0: Run named scan script with params (non-blocking, returns jobId)
  if (runner) {
    return await runNamedScan(runner, params || {}, from, to)
  }

  // Mode 1: Run a named spec through the scan engine (non-blocking)
  if (spec) {
    return await runSpecJob(spec, from, to)
  }

  // Mode 2: Run raw Python code
  if (!code) {
    return NextResponse.json({ error: 'No code or spec provided' }, { status: 400 })
  }
  if (!from || !to) {
    return NextResponse.json({ error: 'Date range required (from, to)' }, { status: 400 })
  }

  // Detect language: if it has Python syntax, run with Python. Otherwise JS eval.
  const isPython = detectPython(code)

  if (isPython) {
    return await runPythonScan(code, from, to, filterMode, name)
  } else {
    return NextResponse.json({ error: 'JavaScript scan execution not supported on server. Use browser sandbox.' }, { status: 400 })
  }
}

function detectPython(code: string): boolean {
  const indicators = [
    /^from\s+\w+/m,
    /^import\s+\w+/m,
    /def\s+\w+\s*\(/,
    /if\s+__name__\s*==\s*['"]__main__['"]/,
    /print\s*\(/,
    /self\.\w+/,
    /^\s*class\s+\w+/m,
    /#.*python/i,
    /\.py\b/,
    /multiprocessing/,
    /pandas|numpy|vectorbt|pandas_ta/,
    /\basync\s+def\b/,
    /\byield\b/,
    /\bexcept\s+\w*/,
    /\belif\b/,
    /\bNone\b/,
    /\bTrue\b/,
    /\bFalse\b/,
    /\blambda\b/,
    /\bglobal\b/,
  ]
  // Need at least 1 strong indicator or 2 weak ones
  let hits = 0
  for (const re of indicators) {
    if (re.test(code)) hits++
  }
  return hits >= 1
}

async function runPythonScan(
  code: string,
  from: string,
  to: string,
  filterMode: string,
  name: string,
): Promise<Response> {
  // Write code to a temp file
  const tmpDir = path.join(os.tmpdir(), 'traderra-scans')
  await mkdir(tmpDir, { recursive: true })
  const tmpFile = path.join(tmpDir, `scan_${Date.now()}.py`)

  // Wrap user code: inject date range + filter as globals, capture output
  // Strip hardcoded date overrides so injected globals take effect
  const cleanCode = code
    .replace(/^\s*START_DATE\s*=\s*['"].*?['"].*$/gm, '# START_DATE removed — using injected value')
    .replace(/^\s*END_DATE\s*=\s*['"].*?['"].*$/gm, '# END_DATE removed — using injected value')

  const wrappedCode = buildWrapper(cleanCode, from, to, filterMode)

  try {
    await writeFile(tmpFile, wrappedCode, 'utf-8')

    const pythonPath = path.join(os.homedir(), 'edge.dev', '.venv', 'bin', 'python')
    const envPath = path.join(os.homedir(), 'edge.dev', '.env')
    const cwd = path.join(os.homedir(), 'edge.dev')

    const result = await execFileAsync(pythonPath, [tmpFile], {
      cwd,
      env: {
        ...process.env,
        PYTHONPATH: 'src',
        DOTENV_PATH: envPath,
      },
      maxBuffer: 50 * 1024 * 1024,
      timeout: 300000, // 5 min max
    })

    // Parse JSON from stdout
    const stdout = result.stdout.trim()
    const jsonLine = stdout.split('\n').find(l => l.trim().startsWith('{') || l.trim().startsWith('['))
    
    if (jsonLine) {
      const parsed = JSON.parse(jsonLine)
      // Generate the trading days that were scanned
      const scannedDates: string[] = []
      const d = new Date(from + 'T12:00:00')
      const endDate = new Date(to + 'T12:00:00')
      while (d <= endDate) {
        const day = d.getDay()
        if (day !== 0 && day !== 6) scannedDates.push(d.toISOString().slice(0, 10))
        d.setDate(d.getDate() + 1)
      }
      return NextResponse.json({
        signals: parsed.signals || parsed.results || (Array.isArray(parsed) ? parsed : []),
        count: parsed.count || (Array.isArray(parsed) ? parsed.length : (parsed.signals || parsed.results || []).length),
        raw: stdout,
        stderr: result.stderr,
        language: 'python',
        scannedDates,
      })
    }

    // No JSON found — return raw output
    return NextResponse.json({
      signals: [],
      count: 0,
      raw: stdout,
      stderr: result.stderr,
      language: 'python',
    })
  } catch (error: any) {
    const stderr = error.stderr || ''
    const message = error.message || 'Unknown error'
    // Extract the actual Python traceback
    const tbMatch = stderr.match(/(?:Traceback[\s\S]*?)$/m)
    const cleanError = tbMatch ? tbMatch[0] : message
    return NextResponse.json({
      error: cleanError,
      stderr,
      language: 'python',
    }, { status: 500 })
  } finally {
    // Cleanup temp file
    try { await unlink(tmpFile) } catch {}
  }
}

async function runSpecScan(specName: string, from?: string, to?: string): Promise<Response> {
  const assetsDir = path.join(os.homedir(), '.wzrd-pi-dev', 'projects', 'edge-dev', 'assets')
  const scanScript = path.join(assetsDir, 'traderra_scan.py')
  const pythonPath = path.join(os.homedir(), 'edge.dev', '.venv', 'bin', 'python')
  const envPath = path.join(os.homedir(), 'edge.dev', '.env')
  const cwd = path.join(os.homedir(), 'edge.dev')

  const args: string[] = [scanScript, '--spec', specName]
  if (from && to) {
    args.push('--start', from, '--end', to)
  } else {
    args.push('--live')
  }

  try {
    const result = await execFileAsync(pythonPath, args, {
      cwd,
      env: {
        ...process.env,
        PYTHONPATH: 'src',
        DOTENV_PATH: envPath,
      },
      maxBuffer: 50 * 1024 * 1024,
      timeout: 300000,
    })

    const stdout = result.stdout.trim()
    const jsonLine = stdout.split('\n').find(l => l.trim().startsWith('{'))
    if (jsonLine) {
      const parsed = JSON.parse(jsonLine)
      return NextResponse.json({
        signals: parsed.signals || [],
        count: parsed.count || 0,
        raw: stdout,
        stderr: result.stderr,
        language: 'python',
        spec: specName,
      })
    }
    return NextResponse.json({ signals: [], count: 0, raw: stdout, stderr: result.stderr, language: 'python', spec: specName })
  } catch (error: any) {
    const stderr = error.stderr || ''
    const message = error.message || 'Unknown error'
    const tbMatch = stderr.match(/(?:Traceback[\s\S]*?)$/m)
    return NextResponse.json({ error: tbMatch ? tbMatch[0] : message, stderr, spec: specName }, { status: 500 })
  }
}

function buildWrapper(code: string, from: string, to: string, filterMode: string): string {
  return `#!/usr/bin/env python3
"""Auto-generated scan wrapper — injects date range + captures output as JSON."""
import sys, os, json, io

# Suppress print() output from user code — capture only JSON at the end
_orig_stdout = sys.stdout
sys.stdout = io.StringIO()

# Load .env
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.expanduser('~'), 'edge.dev', '.env'))
except: pass

# Inject scan parameters as globals (multiple names for compatibility)
SCAN_FROM = "${from}"
SCAN_TO = "${to}"
SCAN_FILTER_MODE = "${filterMode}"
START_DATE = "${from}"
END_DATE = "${to}"

# ── User code below ──
${code}

# ── Capture output ──
import types
import decimal
import datetime
import pandas as pd

def _encoder(obj):
    if hasattr(obj, 'item'): return obj.item()
    if isinstance(obj, (datetime.date, datetime.datetime)): return str(obj)
    if isinstance(obj, decimal.Decimal): return float(obj)
    if isinstance(obj, pd.Timestamp): return str(obj)
    if pd.isna(obj): return None
    return str(obj)

def _capture_output():
    g = globals()
    
    # Case 1: scan() function
    if 'scan' in g and callable(g['scan']):
        try:
            results = g['scan'](SCAN_FROM, SCAN_TO, SCAN_FILTER_MODE)
            if results is not None: return results
        except TypeError:
            pass
    
    # Case 2: run_scan() function
    if 'run_scan' in g and callable(g['run_scan']):
        try:
            results = g['run_scan'](SCAN_FROM, SCAN_TO, SCAN_FILTER_MODE)
            if results is not None: return results
        except TypeError:
            pass
    
    # Case 3: results variable already set
    if 'results' in g: return g['results']
    
    # Case 4: signals variable
    if 'signals' in g: return g['signals']
    
    # Case 5: df_lc or df_sc DataFrame (common in MDR scans)
    for dfname in ['df_lc', 'df_sc', 'df_results', 'df2']:
        if dfname in g and isinstance(g[dfname], pd.DataFrame):
            df = g[dfname]
            if df.empty: return []
            # Convert DataFrame to list of dicts
            out = df.to_dict(orient='records')
            # Sanitize values
            for row in out:
                for k, v in list(row.items()):
                    try:
                        if pd.isna(v): row[k] = None
                        elif hasattr(v, 'item'): row[k] = v.item()
                        elif isinstance(v, (datetime.date, datetime.datetime, pd.Timestamp)): row[k] = str(v)
                    except: pass
            return out
    
    return None

_output = _capture_output()
if _output is None:
    _output = []
if hasattr(_output, 'to_dict'):
    _output = _output.to_dict(orient='records')
elif hasattr(_output, '__iter__') and not isinstance(_output, (str, dict)):
    _output = list(_output)

for row in (list(_output) if isinstance(_output, list) else []):
    if isinstance(row, dict):
        for k, v in list(row.items()):
            try:
                if hasattr(v, 'item'): row[k] = v.item()
                elif isinstance(v, (datetime.date, datetime.datetime, pd.Timestamp)): row[k] = str(v)
                elif isinstance(v, decimal.Decimal): row[k] = float(v)
                elif pd.isna(v): row[k] = None
            except: pass

sys.stdout = _orig_stdout
print(json.dumps({"signals": _output, "count": len(_output)}, default=_encoder))
`
}

function execFileAsync(
  file: string,
  args: string[],
  options: any,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stderr = typeof stderr === 'string' ? stderr : stderr?.toString('utf-8')
        error.stdout = typeof stdout === 'string' ? stdout : stdout?.toString('utf-8')
        reject(error)
      } else {
        resolve({ stdout: typeof stdout === 'string' ? stdout : stdout.toString('utf-8'), stderr: typeof stderr === 'string' ? stderr : stderr.toString('utf-8') })
      }
    })
  })
}

// ── Named scan runner ──
const PYTHON = '/home/mdwzrd/edge.dev/.venv/bin/python'
const SCRIPTS_DIR = '/home/mdwzrd/.wzrd-pi-dev/projects/edge-dev/uploads'
const JOBS_FILE = `${SCRIPTS_DIR}/.scan_jobs.json`

const SCAN_SCRIPTS: Record<string, {
  script: string
  label: string
  params: Record<string, { label: string; type: 'number' | 'boolean'; default: number | boolean; min?: number; max?: number; step?: number }>
}> = {
  'frd-gap': {
    script: 'run_frd_gap.py',
    label: 'FRD Gap',
    params: {
      gap_min_atr: { label: 'Gap Min (×ATR)', type: 'number', default: 1.0, min: 0.1, max: 5.0, step: 0.1 },
      close_strength_min: { label: 'Close Strength', type: 'number', default: 0.70, min: 0.1, max: 1.0, step: 0.05 },
      slope_2d_min: { label: 'Slope 2d %', type: 'number', default: 7.0, min: 0, max: 100, step: 1 },
      slope_3d_min: { label: 'Slope 3d %', type: 'number', default: 5.0, min: 0, max: 100, step: 1 },
      slope_5d_min: { label: 'Slope 5d %', type: 'number', default: 4.0, min: 0, max: 100, step: 1 },
      d1_atr_body_min: { label: 'D-1 Body (×ATR)', type: 'number', default: 0.5, min: 0, max: 5.0, step: 0.1 },
      d2_atr_mult_min: { label: 'D-2 Range (×ATR14)', type: 'number', default: 2.0, min: 0.5, max: 10.0, step: 0.5 },
      d1_close_min: { label: 'Min Price $', type: 'number', default: 0, min: 0, max: 1000, step: 1 },
      volume_min: { label: 'Min Volume', type: 'number', default: 500000, min: 0, max: 50000000, step: 100000 },
      range_expand_days: { label: 'Range Lookback', type: 'number', default: 30, min: 5, max: 60, step: 1 },
    },
  },
  'frd-gap-lc': {
    script: 'run_frd_gap_lc.py',
    label: 'FRD Gap LC',
    params: {
      gap_min_atr: { label: 'Gap Min (×ATR)', type: 'number', default: 1.0, min: 0.1, max: 5.0, step: 0.1 },
      close_strength_min: { label: 'Close Strength', type: 'number', default: 0.70, min: 0.1, max: 1.0, step: 0.05 },
      slope_2d_min: { label: 'Slope 2d %', type: 'number', default: 7.0, min: 0, max: 100, step: 1 },
      slope_3d_min: { label: 'Slope 3d %', type: 'number', default: 5.0, min: 0, max: 100, step: 1 },
      slope_5d_min: { label: 'Slope 5d %', type: 'number', default: 4.0, min: 0, max: 100, step: 1 },
      d1_atr_body_min: { label: 'D-1 Body (×ATR)', type: 'number', default: 0.5, min: 0, max: 5.0, step: 0.1 },
      d2_atr_mult_min: { label: 'D-2 Range (×ATR14)', type: 'number', default: 2.0, min: 0.5, max: 10.0, step: 0.5 },
      d1_close_min: { label: 'Min Price $', type: 'number', default: 10, min: 0, max: 1000, step: 1 },
      volume_min: { label: 'Min Volume', type: 'number', default: 500000, min: 0, max: 50000000, step: 100000 },
      range_expand_days: { label: 'Range Lookback', type: 'number', default: 30, min: 5, max: 60, step: 1 },
    },
  },
  'mdr-signals': {
    script: 'run_mdr_signals.py',
    label: 'MDR Signals',
    params: {},
  },
  'mdr-fixed': {
    script: 'run_mdr_backtest_v2.py',
    label: 'MDR Backtest',
    params: {},
  },
  'd1-gap': {
    script: 'run_get_d1s.py',
    label: 'D1 Gap',
    params: {
      pm_high_min: { label: 'PM High %', type: 'number', default: 0.50, min: 0.1, max: 5.0, step: 0.05 },
      gap_min: { label: 'Gap %', type: 'number', default: 0.50, min: 0.1, max: 5.0, step: 0.05 },
      open_vs_prev_high_min: { label: 'Open vs PrevHigh %', type: 'number', default: 0.30, min: 0, max: 5.0, step: 0.05 },
      pm_vol_min: { label: 'PM Vol Min', type: 'number', default: 5000000, min: 0, max: 50000000, step: 500000 },
      prev_close_min: { label: 'Prev Close $', type: 'number', default: 0.75, min: 0, max: 1000, step: 0.25 },
      d2_move_min: { label: 'D2 Move %', type: 'number', default: 0.30, min: 0, max: 5.0, step: 0.05 },
      d2_vol_min: { label: 'D2 Vol Min', type: 'number', default: 10000000, min: 0, max: 50000000, step: 1000000 },
      ema_beaten_ratio: { label: 'EMA200 Ratio', type: 'number', default: 0.80, min: 0.1, max: 1.5, step: 0.05 },
    },
  },
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const jobId = url.searchParams.get('job')

  // Status poll for a specific job
  if (jobId) {
    const jobs = await loadJobs()
    const job = jobs[jobId]
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    await refreshJobStatus(job)
    // Save updated status
    jobs[jobId] = job
    await saveJobs(jobs)
    // Extract progress from stdout (e.g. "Processed 3100/3843 tickers")
    const progMatch = job.stdout.match(/Processed\s+(\d+)\/(\d+)\s*tickers/g)
    const lastProg = progMatch ? progMatch[progMatch.length - 1] : null
    const sigMatch = job.stdout.match(/(\d+)\s*signals/)
    return NextResponse.json({
      id: job.id,
      status: job.status,
      strategy: job.strategy,
      label: job.label,
      elapsed: Math.round((Date.now() - job.startedAt) / 1000),
      progress: lastProg,
      signalCount: job.signalCount,
      error: job.error,
      log: job.stdout.split('\n').slice(-8).join('\n'),
      errors: job.stderr ? job.stderr.split('\n').slice(-3).join('\n') : undefined,
    })
  }

  // List all jobs (for badge display)
  const fileJobs = await loadJobs()
  for (const j of Object.values(fileJobs)) await refreshJobStatus(j)
  await saveJobs(fileJobs)
  const activeJobs = Object.values(fileJobs)
    .filter(j => j.status === 'running')
    .map(j => ({ id: j.id, strategy: j.strategy, label: j.label, status: j.status, elapsed: Math.round((Date.now() - j.startedAt) / 1000), progress: (j.stdout.match(/Processed\s+(\d+)\/(\d+)\s*tickers/g) || []).slice(-1)[0] }))

  const specs = Object.entries(SCAN_SCRIPTS).map(([strategy, config]) => ({
    strategy,
    label: config.label,
    script: config.script,
    params: Object.entries(config.params).map(([key, p]) => ({ key, ...p })),
  }))
  return NextResponse.json({ specs, activeJobs })
}

async function runNamedScan(
  strategy: string,
  paramOverrides: Record<string, any>,
  from?: string,
  to?: string,
): Promise<Response> {
  console.log(`[SCAN] runNamedScan START strategy=${strategy}`)
  if (!SCAN_SCRIPTS[strategy]) {
    return NextResponse.json({ error: `Unknown strategy: ${strategy}` }, { status: 400 })
  }
  const config = SCAN_SCRIPTS[strategy]
  const scriptPath = `${SCRIPTS_DIR}/${config.script}`
  const fromDate = from || '2026-01-01'
  const toDate = to || new Date().toISOString().slice(0, 10)

  const mergedParams: Record<string, any> = {}
  for (const [key, p] of Object.entries(config.params)) {
    mergedParams[key] = paramOverrides[key] ?? p.default
  }

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    SCAN_START: fromDate,
    SCAN_END: toDate,
    SCAN_PARAMS: JSON.stringify(mergedParams),
  }

  // Read Polygon key from file if not in env
  if (!env.POLYGON_API_KEY) {
    try {
      const { readFile } = await import('fs/promises')
      env.POLYGON_API_KEY = (await readFile('/home/mdwzrd/.polygon_key', 'utf-8')).trim()
    } catch {}
  }

  // Spawn fully detached via shell redirect — no fd handles held by Node
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const logFile = `${SCRIPTS_DIR}/.scan_job_${jobId}.log`
  const job: ScanJob = {
    id: jobId,
    strategy,
    label: config.label,
    status: 'running',
    startedAt: Date.now(),
    stdout: '',
    stderr: '',
    params: mergedParams,
    from: fromDate,
    to: toDate,
    logFile,
  }
  await saveJobs({ ...await loadJobs(), [jobId]: job })

  const child = spawn('bash', ['-c', `${PYTHON} -u ${scriptPath} > ${logFile} 2>&1`], {
    env,
    cwd: SCRIPTS_DIR,
    stdio: 'ignore',
    detached: true,
  })
  child.unref()
  job.pid = child.pid
  await saveJobs({ ...await loadJobs(), [jobId]: job })

  // Check completion via polling the log file + process in the GET handler

  console.log(`[SCAN] Job ${jobId} spawned, PID ${child.pid}, saved to jobs file, returning`)
  return NextResponse.json({ ok: true, jobId, status: 'running' })
}

// Non-blocking spec runner — spawns traderra_scan.py in background
async function runSpecJob(specName: string, from?: string, to?: string): Promise<Response> {
  const assetsDir = path.join(os.homedir(), '.wzrd-pi-dev', 'projects', 'edge-dev', 'assets')
  const scanScript = path.join(assetsDir, 'traderra_scan.py')
  const pythonPath = path.join(os.homedir(), 'edge.dev', '.venv', 'bin', 'python')
  const envPath = path.join(os.homedir(), 'edge.dev', '.env')
  const cwd = path.join(os.homedir(), 'edge.dev')

  const fromDate = from || new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)
  const toDate = to || new Date().toISOString().slice(0, 10)

  // Load .env file
  let env: Record<string, string> = { ...(process.env as Record<string, string>) }
  try {
    const envContent = await readFile(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  } catch {}

  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const logFile = `${SCRIPTS_DIR}/.scan_job_${jobId}.log`
  const job: ScanJob = {
    id: jobId,
    strategy: specName,
    label: specName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    status: 'running',
    startedAt: Date.now(),
    stdout: '',
    stderr: '',
    params: {},
    from: fromDate,
    to: toDate,
    logFile,
  }
  await saveJobs({ ...await loadJobs(), [jobId]: job })

  const child = spawn('bash', ['-c', `${pythonPath} -u ${scanScript} --spec ${specName} --start ${fromDate} --end ${toDate} > ${logFile} 2>&1`], {
    env,
    cwd,
    stdio: 'ignore',
    detached: true,
  })
  child.unref()
  job.pid = child.pid
  await saveJobs({ ...await loadJobs(), [jobId]: job })
  console.log(`[SCAN] Spec job ${jobId} spawned for ${specName}, PID ${child.pid}, saved to jobs file`)
  return NextResponse.json({ ok: true, jobId, status: 'running' })
}

// Background poller: checks job status via log file tail
async function refreshJobStatus(job: ScanJob) {
  if (job.status !== 'running') return job
  try {
    const log = await readFile(job.logFile!, 'utf-8').catch(() => '')
    job.stdout = log.slice(-50000)
    console.log(`[SCAN] refresh ${job.id}: logFile=${job.logFile} logLen=${log.length} hasMarker=${/Total.*signals:\s*\d+|Pushed\s+\d+|Traceback|Error:/.test(job.stdout.slice(-2000))}`)
    // Check if process still alive
    // If we have no pid (stale/hot-reloaded), assume alive and rely on the log marker.
    const alive = job.pid ? await checkPidAlive(job.pid) : true
    const hasFinishedMarker = /Total.*signals:\s*\d+|Pushed\s+\d+|Traceback|Error:/.test(job.stdout.slice(-2000))
    if ((!alive && job.pid) || hasFinishedMarker) {
      job.finishedAt = Date.now()
      const match = job.stdout.match(/Total.*?signals:\s*(\d+)/)
      const pushed = job.stdout.match(/Pushed\s*(\d+).*?signals/)
      job.signalCount = pushed ? parseInt(pushed[1]) : (match ? parseInt(match[1]) : 0)
      const isError = /Traceback|Error:/.test(job.stdout.slice(-500))
      job.status = isError ? 'error' : 'done'
      job.error = isError ? job.stdout.split('\n').slice(-3).join('\n') : undefined
    }
  } catch {}
  return job
}

async function checkPidAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

