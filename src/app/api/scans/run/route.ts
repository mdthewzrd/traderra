import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import os from 'os'

// POST /api/scans/run — execute Python scan code or run a named spec
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { code, from, to, filterMode = '3', name = 'custom_scan', spec } = body

  // Mode 1: Run a named spec through the scan engine
  if (spec) {
    return await runSpecScan(spec, from, to)
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

  const args = ['--spec', specName]
  if (from) args.push('--start', from)
  if (to) args.push('--end', to)

  try {
    const result = await execFileAsync(pythonPath, [scanScript, ...args], {
      cwd: assetsDir,
      env: {
        ...process.env,
        PYTHONPATH: `${assetsDir}/scan-engine:${path.join(os.homedir(), 'edge.dev', 'src')}`,
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
        error.stderr = stderr
        error.stdout = stdout
        reject(error)
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}
