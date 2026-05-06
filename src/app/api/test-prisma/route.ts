import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('🔍 Testing Prisma connection...')

    // Test basic database connection
    await prisma.$connect()
    console.log('✅ Prisma connected successfully')

    // Test if we can query the database
    const userCount = await prisma.user.count()
    console.log(`📊 Found ${userCount} users in database`)

    const tradeCount = await prisma.trade.count()
    console.log(`📈 Found ${tradeCount} trades in database`)

    await prisma.$disconnect()
    console.log('✅ Prisma disconnected successfully')

    return NextResponse.json({
      success: true,
      message: 'Prisma connection test successful',
      userCount,
      tradeCount,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Prisma connection test failed:', error)

    return NextResponse.json({
      success: false,
      message: 'Prisma connection test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}