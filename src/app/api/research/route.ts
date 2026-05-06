import { NextRequest, NextResponse } from 'next/server'

// Research API — SEC dilution intelligence
// Uses EdgarTools (free, MIT) for SEC filing data

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker')
  
  if (!ticker) {
    return NextResponse.json({
      status: 'ok',
      message: 'SEC Dilution Intelligence — pass ?ticker=SYMBOL',
      tools: ['EdgarTools', 'SEC EDGAR', 'Dilution Scoring'],
    })
  }

  // TODO: Wire to Python EdgarTools SDK
  // For now return the structure the frontend expects
  return NextResponse.json({
    ticker: ticker.toUpperCase(),
    risk_scores: {
      overall: null,
      offering_ability: null,
      cash_need: null,
      float_risk: null,
    },
    filings: [],
    active_instruments: [],
    message: 'EdgarTools integration pending — connect Python SDK via /api/python/research',
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { ticker } = body

  if (!ticker) {
    return NextResponse.json({ error: 'Missing ticker' }, { status: 400 })
  }

  // TODO: Wire to Python EdgarTools SDK
  return NextResponse.json({
    ticker: ticker.toUpperCase(),
    risk_scores: {
      overall: null,
      offering_ability: null,
      cash_need: null,
      float_risk: null,
    },
    filings: [],
    active_instruments: [],
    message: 'EdgarTools integration pending',
  })
}
