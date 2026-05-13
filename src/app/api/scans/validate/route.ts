import { NextRequest, NextResponse } from 'next/server'

// POST /api/scans/validate — validate + fix scan code (rule-based)
// If OPENROUTER_API_KEY is available and valid, uses AI. Otherwise uses rules.
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { code, name, from, to, filterMode } = body

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 })
  }

  const isPython = detectPython(code) || body.language === 'python' || (body.fileName || '').endsWith('.py')

  if (isPython) {
    return await fixPythonScan(code, name || 'scan', from, to, filterMode)
  } else {
    return NextResponse.json({
      analysis: 'JavaScript scan code detected.',
      fixes: 'No automatic fixes available for JS. Code will run in browser sandbox.',
      code: null,
      language: 'javascript',
    })
  }
}

async function fixPythonScan(
  code: string,
  name: string,
  from: string | null,
  to: string | null,
  filterMode: string | null,
): Promise<Response> {
  const fixes: string[] = []
  let fixed = code

  // 1. Strip multiprocessing imports
  if (/multiprocessing/.test(fixed)) {
    fixed = fixed.replace(/^from\s+multiprocessing\s+import.*$/gm, '# [removed multiprocessing import]')
    fixed = fixed.replace(/^import\s+multiprocessing.*$/gm, '# [removed multiprocessing import]')
    fixes.push('Removed multiprocessing (not available in sandbox) — converted Pool.map() to sequential loop')
  }

    // 2. Fix Pool usage → sequential
  if (/Pool\s*\(/.test(fixed)) {
    const lines = fixed.split('\n')
    const out: string[] = []
    for (let i = 0; i < lines.length; i++) {
      // "with Pool(N) as p:" → skip and convert next line
      if (/\s*with\s+Pool\(\d+\)\s+as\s+\w+\s*:/.test(lines[i])) {
        const nextLine = lines[i + 1] || ''
        const mapMatch = nextLine.match(/(\w+)\s*=\s*(\w+)\.map\((\w+),\s*(\w+)\)/)
        if (mapMatch) {
          // Dedent: remove one level of indentation (4 spaces) from the replacement
          const origIndent = nextLine.match(/^(\s*)/)?.[1] || ''
          const dedented = origIndent.length >= 4 ? origIndent.slice(4) : origIndent
          out.push(dedented + mapMatch[1] + ' = [' + mapMatch[3] + '(x) for x in ' + mapMatch[4] + ']')
          i++ // skip the p.map line
          fixes.push('Converted Pool.map() to sequential list comprehension')
          continue
        }
        // If no map on next line, just remove the 'with' line
        continue
      }
      // Standalone p.map line
      if (/\w+\.map\(\w+,/.test(lines[i])) {
        const mapMatch = lines[i].match(/(\w+)\s*=\s*(\w+)\.map\((\w+),\s*(\w+)\)/)
        if (mapMatch && /Pool/.test(code)) {
          const indent = lines[i].match(/^(\s*)/)?.[1] || ''
          out.push(indent + mapMatch[1] + ' = [' + mapMatch[3] + '(x) for x in ' + mapMatch[4] + ']')
          fixes.push('Converted .map() to sequential list comprehension')
          continue
        }
      }
      // p.close(), p.join() etc
      if (/\w+\.(close|join|terminate)\(\)/.test(lines[i]) && /Pool/.test(code)) continue
      // p = Pool(N)
      if (/\w+\s*=\s*Pool\(\d+\)/.test(lines[i])) continue
      out.push(lines[i])
    }
    fixed = out.join('\n')
  }

  // 3. Strip local/custom imports that won't exist
  const localImportPattern = /^(from|import)\s+(sdk|scanners|src|utils|config|services|data)\b.*$/gm
  if (localImportPattern.test(fixed)) {
    const stripped = fixed.match(localImportPattern) || []
    fixed = fixed.replace(localImportPattern, (m) => '# [removed: ' + m.trim() + ']')
    fixes.push(`Removed ${stripped.length} local import(s) that don't exist in sandbox`)
  }

  // 4. Ensure dotenv is loaded for API keys
  if (!/dotenv/.test(fixed) && !/load_dotenv/.test(fixed)) {
    if (/os\.environ|POLYGON_API_KEY/.test(fixed)) {
      fixed = 'import os\nfrom dotenv import load_dotenv\nload_dotenv(os.path.join(os.path.expanduser("~"), "edge.dev", ".env"))\n\n' + fixed
      fixes.push('Added dotenv loading for Polygon API key')
    }
  } else if (/load_dotenv\(\)/.test(fixed) && !/edge\.dev/.test(fixed)) {
    // Fix bare load_dotenv() → load from edge.dev
    fixed = fixed.replace(
      /load_dotenv\(\)/g,
      'load_dotenv(os.path.join(os.path.expanduser("~"), "edge.dev", ".env"))'
    )
    fixes.push('Fixed dotenv path to load from edge.dev/.env')
  }

  // 5. Ensure SCAN_FROM/SCAN_TO globals are available
  // The wrapper already injects these, but make sure user code can access them
  if (!/SCAN_FROM/.test(fixed) && (from || to)) {
    fixes.push('Date range injected as SCAN_FROM, SCAN_TO globals by the scan runner')
  }

  // 6. Ensure output format — if no `results` assignment and no `scan()` function, wrap
  const hasResultsVar = /^\s*results\s*=/.test(fixed)
  const hasSignalsVar = /^\s*signals\s*=/.test(fixed)
  const hasScanFn = /def\s+scan\s*\(/.test(fixed)
  const hasRunScanFn = /def\s+run_scan\s*\(/.test(fixed)
  const hasMainBlock = /if\s+__name__\s*==\s*['"]__main__['"]/.test(fixed)

  if (!hasResultsVar && !hasSignalsVar && !hasScanFn && !hasRunScanFn) {
    fixes.push('Warning: No results/signals variable, scan() function, or standard DataFrame found. Code must set "results", define scan(), or produce df_lc/df_sc/df_results.')
  }

  // 7. Handle __main__ blocks — strip date overrides but keep the execution logic
  if (hasMainBlock) {
    // Remove START_DATE / END_DATE assignments in __main__ so our injected globals take effect
    fixed = fixed.replace(/^\s*START_DATE\s*=\s*['"].*?['"].*$/gm, '# [date override removed — using SCAN_FROM]')
    fixed = fixed.replace(/^\s*END_DATE\s*=\s*['"].*?['"].*$/gm, '# [date override removed — using SCAN_TO]')
    fixes.push('Stripped hardcoded dates from __main__ block (using injected SCAN_FROM/SCAN_TO)')
  }

  // 8. Add requests if using fetch/urllib patterns without import
  if (/requests\.get|requests\.post/.test(fixed) && !/^import requests/m.test(fixed)) {
    fixed = 'import requests\n' + fixed
    fixes.push('Added missing "import requests"')
  }

  const analysis = buildAnalysis(fixed, name)

  // Try to do a syntax check
  const syntaxOk = await checkPythonSyntax(fixed)

  if (!syntaxOk.ok) {
    fixes.push(`⚠ Syntax check failed: ${syntaxOk.error}`)
  } else {
    fixes.push('✓ Syntax check passed')
  }

  const changed = fixed !== code

  return NextResponse.json({
    analysis,
    fixes: fixes.join('\n'),
    code: changed ? fixed : null, // null = no changes needed
    language: 'python',
    changed,
  })
}

function buildAnalysis(code: string, name: string): string {
  const parts: string[] = []
  if (/grouped.*daily|aggs\/grouped/i.test(code)) parts.push('fetches grouped daily bars')
  if (/ticker.*range|aggs\/ticker/i.test(code)) parts.push('fetches per-ticker history')
  if (/volume|vol/i.test(code)) parts.push('analyzes volume')
  if (/gap/i.test(code)) parts.push('checks gap patterns')
  if (/inside.*day|consolidation/i.test(code)) parts.push('detects inside day/consolidation patterns')
  if (/atr/i.test(code)) parts.push('uses ATR')
  if (/ema|sma|moving.*average/i.test(code)) parts.push('uses moving averages')
  if (/ssr|short.*sale.*restrict/i.test(code)) parts.push('checks SSR')
  if (/mdr|multi.*day.*runner/i.test(code)) parts.push('detects multi-day runners')

  const what = parts.length > 0 ? parts.join(', ') : 'custom scan logic'
  const tickerCount = (code.match(/ticker/gi) || []).length
  return `"${name}" is a Python scan that ${what}. Contains ${tickerCount} ticker reference(s).`
}

async function checkPythonSyntax(code: string): Promise<{ ok: boolean; error?: string }> {
  const { execFile } = require('child_process')
  const { writeFile, unlink } = require('fs/promises')
  const path = require('path')
  const os = require('os')

  const tmpDir = path.join(os.tmpdir(), 'traderra-scans')
  const tmpFile = path.join(tmpDir, `syntax_check_${Date.now()}.py`)

  try {
    const { mkdir } = require('fs/promises')
    await mkdir(tmpDir, { recursive: true })
    await writeFile(tmpFile, code, 'utf-8')

    const pythonPath = path.join(os.homedir(), 'edge.dev', '.venv', 'bin', 'python')

    return new Promise((resolve) => {
      execFile(pythonPath, ['-m', 'py_compile', tmpFile], {
        timeout: 10000,
      }, (error: any) => {
        try { unlink(tmpFile) } catch {}
        if (error) {
          const msg = error.stderr || error.message
          const clean = msg.split('\n').filter((l: string) => l.trim()).slice(-2).join(' ')
          resolve({ ok: false, error: clean })
        } else {
          resolve({ ok: true })
        }
      })
    })
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

function detectPython(code: string): boolean {
  const indicators = [
    /^from\s+\w+/m, /^import\s+\w+/m,
    /def\s+\w+\s*\(/, /if\s+__name__/,
    /self\.\w+/, /^\s*class\s+\w+/m,
    /multiprocessing/, /pandas|numpy|vectorbt|pandas_ta/,
    /\belif\b/, /\bNone\b/, /\bTrue\b/, /\bFalse\b/,
    /with\s+\w+\s+as\s+\w+\s*:/,  // Python context manager
    /print\s*\(f['"]/,                  // f-string print
    /for\s+\w+\s+in\s+range/,         // for...in range
    /\bexcept\s+\w+/,                   // except Exception
    /:\s*$/m,                          // trailing colon (Python blocks)
  ]
  let hits = 0
  for (const re of indicators) { if (re.test(code)) hits++ }
  return hits >= 2
}
