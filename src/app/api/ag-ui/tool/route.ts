/**
 * AG-UI Tool Execution API Route
 *
 * This route handles tool execution requests from the AI agent.
 * When the agent calls a tool, this endpoint executes it on the frontend
 * and returns the result.
 *
 * POST /api/ag-ui/tool
 * Body: { tool: string, args: any }
 * Response: { success: boolean, result: ToolResult }
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tool, args } = body

    console.log('🔧 AG-UI Tool Call:', tool, args)

    // Validate request
    if (!tool) {
      return NextResponse.json(
        { success: false, error: 'Tool name is required' },
        { status: 400 }
      )
    }

    // Get tool registry - this will be executed by the frontend
    // For now, we return the tool call info and let the frontend execute it
    // This is a temporary approach until we implement full AG-UI protocol

    const response = {
      success: true,
      tool,
      args,
      // The frontend will execute this via event listener
      executeOnFrontend: true,
    }

    console.log('✅ AG-UI Tool Call Prepared:', response)

    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ AG-UI Tool Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
