import { NextRequest, NextResponse } from 'next/server'

// For now, we'll store the API key in a simple way
// In a real production app, you'd want to use a database
let openRouterApiKey: string | null = null

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    // Validate OpenRouter API key format (should start with 'sk-or-v1-')
    if (!apiKey.startsWith('sk-or-v1-')) {
      return NextResponse.json(
        { error: 'Invalid OpenRouter API key format. Key should start with "sk-or-v1-"' },
        { status: 400 }
      )
    }

    // Store the API key (in memory for this demo)
    openRouterApiKey = apiKey

    return NextResponse.json({
      success: true,
      message: 'OpenRouter API key updated successfully (stored in memory for demo)',
      keyPreview: apiKey.slice(0, 8) + '...' + apiKey.slice(-4)
    })

  } catch (error) {
    console.error('Error updating API key:', error)
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      hasKey: !!openRouterApiKey,
      keyPreview: openRouterApiKey ? openRouterApiKey.slice(0, 8) + '...' + openRouterApiKey.slice(-4) : null,
      note: 'Key is stored in memory for this demo. In production, it would be securely stored.'
    })

  } catch (error) {
    console.error('Error reading API key:', error)
    return NextResponse.json(
      { error: 'Failed to read API key' },
      { status: 500 }
    )
  }
}