/**
 * AG-UI Chat API Route
 *
 * Frontend proxy for the backend AG-UI chat endpoint.
 * This allows the frontend to communicate with the AG-UI backend
 * while handling CORS and authentication.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, context } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get backend URL from environment or use default
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:6500'
    const aguiUrl = `${backendUrl}/agui/chat`

    console.log('[AG-UI API] Forwarding request to backend:', aguiUrl)

    // Forward request to backend
    const response = await fetch(aguiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, context }),
    })

    if (!response.ok) {
      console.error('[AG-UI API] Backend error:', response.status, response.statusText)
      return NextResponse.json(
        { error: `Backend error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[AG-UI API] Backend response:', data)

    return NextResponse.json(data)
  } catch (error) {
    console.error('[AG-UI API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'AG-UI chat endpoint is available',
    backendUrl: process.env.BACKEND_URL || 'http://localhost:6500'
  })
}
