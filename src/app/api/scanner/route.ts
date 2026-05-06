import { NextRequest, NextResponse } from 'next/server'

// Scanner API route — calls the Python SDK via subprocess
// In production, this would call a FastAPI sidecar service

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scanner, start, end, params } = body

    if (!scanner || !start || !end) {
      return NextResponse.json(
        { error: 'Missing required fields: scanner, start, end' },
        { status: 400 }
      )
    }

    // Call Python SDK via subprocess
    const { execFile } = require('child_process')
    const path = require('path')

    const scriptPath = path.join(process.env.HOME || '/home/mdwzrd', 'edge.dev', 'src', 'sdk', 'scanner', 'runner.py')
    const pythonPath = path.join(process.env.HOME || '/home/mdwzrd', 'edge.dev', '.venv', 'bin', 'python')

    const args = [
      scriptPath,
      scanner,
      '--start', start,
      '--end', end,
      '--json',
    ]

    if (params) {
      args.push('--params', JSON.stringify(params))
    }

    const result = await new Promise((resolve, reject) => {
      execFile(pythonPath, args, {
        cwd: path.join(process.env.HOME || '/home/mdwzrd', 'edge.dev'),
        env: { ...process.env, PYTHONPATH: 'src' },
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large scan results
      }, (error: any, stdout: string, stderr: string) => {
        if (error) {
          console.error('Scanner error:', stderr)
          reject(new Error(stderr || error.message))
          return
        }
        try {
          // Parse the JSON output from the runner
          const lines = stdout.trim().split('\n')
          const jsonLine = lines.find((l: string) => l.startsWith('{') || l.startsWith('['))
          if (jsonLine) {
            resolve(JSON.parse(jsonLine))
          } else {
            // If no JSON found, return the text output
            resolve({ raw: stdout, signals: [] })
          }
        } catch (e) {
          resolve({ raw: stdout, signals: [] })
        }
      })
    })

    return NextResponse.json({
      scanner,
      start,
      end,
      signals: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Scanner API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    scanners: [
      { id: 'backside_b', name: 'Backside B — Parabolic Breakdown', description: 'Parabolic uptrends showing breakdown signals' },
    ],
  })
}
