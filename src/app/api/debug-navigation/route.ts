import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log(`🎯 DEBUG NAVIGATION: ${body.message}`, body.data)

    return NextResponse.json({ status: 'logged' })
  } catch (error) {
    console.error('Debug navigation error:', error)
    return NextResponse.json({ error: 'Failed to log' }, { status: 500 })
  }
}