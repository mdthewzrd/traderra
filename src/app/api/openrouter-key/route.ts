import { NextRequest } from 'next/server'

let openRouterApiKey: string | null = null

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey } = body

    if (!apiKey) {
      return Response.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    if (!apiKey.startsWith('sk-or-v1-')) {
      return Response.json(
        { error: 'Invalid OpenRouter API key format' },
        { status: 400 }
      )
    }

    openRouterApiKey = apiKey

    return Response.json({
      success: true,
      message: 'API key updated successfully',
      keyPreview: apiKey.slice(0, 8) + '...' + apiKey.slice(-4)
    })

  } catch (error) {
    console.error('Error updating API key:', error)
    return Response.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    return Response.json({
      hasKey: !!openRouterApiKey,
      keyPreview: openRouterApiKey ? openRouterApiKey.slice(0, 8) + '...' + openRouterApiKey.slice(-4) : null
    })
  } catch (error) {
    console.error('Error reading API key:', error)
    return Response.json(
      { error: 'Failed to read API key' },
      { status: 500 }
    )
  }
}