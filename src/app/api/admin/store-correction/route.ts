import { NextRequest, NextResponse } from 'next/server'

/**
 * Admin Learning System API
 * Stores corrections from master admin (mikedurante13@gmail.com) for system-wide improvement
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      originalRequest,
      wrongAction,
      correctAction,
      explanation,
      adminUser,
      appliesTo,
      timestamp
    } = body

    // Validate admin user
    if (adminUser !== 'mikedurante13@gmail.com') {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Admin learning is restricted to master admin account'
      }, { status: 403 })
    }

    // Validate required fields
    if (!originalRequest || !wrongAction || !correctAction || !explanation) {
      return NextResponse.json({
        error: 'Missing required fields',
        message: 'originalRequest, wrongAction, correctAction, and explanation are required'
      }, { status: 400 })
    }

    // Store the correction (for now, we'll log it - later integrate with Archon)
    const correction = {
      id: `correction_${Date.now()}`,
      originalRequest,
      wrongAction,
      correctAction,
      explanation,
      adminUser,
      appliesTo: appliesTo || 'all_users',
      timestamp: timestamp || new Date().toISOString(),
      status: 'stored'
    }

    console.log('🎓 MASTER ADMIN CORRECTION STORED:', {
      id: correction.id,
      originalRequest,
      wrongAction,
      correctAction,
      explanation,
      appliesTo
    })

    // TODO: Integrate with Archon MCP knowledge graph
    // await archonClient.storeCorrection(correction)

    // For now, store in temporary file for debugging
    try {
      const fs = require('fs')
      const path = require('path')

      const correctionsPath = path.join(process.cwd(), 'admin-corrections.json')
      let corrections = []

      if (fs.existsSync(correctionsPath)) {
        const data = fs.readFileSync(correctionsPath, 'utf8')
        corrections = JSON.parse(data)
      }

      corrections.push(correction)
      fs.writeFileSync(correctionsPath, JSON.stringify(corrections, null, 2))

      console.log(`✅ Correction saved to ${correctionsPath}`)
    } catch (fileError) {
      console.warn('Failed to write correction to file:', fileError)
      // Continue anyway - the correction was logged
    }

    return NextResponse.json({
      success: true,
      message: 'Correction stored successfully',
      correction: {
        id: correction.id,
        originalRequest,
        correctAction,
        appliesTo,
        timestamp: correction.timestamp
      }
    })

  } catch (error) {
    console.error('Error storing admin correction:', error)

    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to store correction'
    }, { status: 500 })
  }
}

// GET endpoint to retrieve stored corrections (for debugging)
export async function GET() {
  try {
    const fs = require('fs')
    const path = require('path')

    const correctionsPath = path.join(process.cwd(), 'admin-corrections.json')

    if (!fs.existsSync(correctionsPath)) {
      return NextResponse.json({
        corrections: [],
        count: 0
      })
    }

    const data = fs.readFileSync(correctionsPath, 'utf8')
    const corrections = JSON.parse(data)

    return NextResponse.json({
      corrections: corrections.map((c: any) => ({
        id: c.id,
        originalRequest: c.originalRequest,
        correctAction: c.correctAction,
        explanation: c.explanation,
        timestamp: c.timestamp
      })),
      count: corrections.length
    })

  } catch (error) {
    console.error('Error retrieving corrections:', error)

    return NextResponse.json({
      error: 'Failed to retrieve corrections',
      corrections: [],
      count: 0
    })
  }
}