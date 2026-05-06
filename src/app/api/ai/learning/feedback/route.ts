import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '../../../../../lib/prisma'

// Learning feedback API for user corrections and improvements
export async function POST(request: Request) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      messageId,
      feedbackType,
      originalMessage,
      correctedMessage,
      userContext,
      confidence = 1.0
    } = body

    // Validate required fields
    if (!messageId || !feedbackType || !originalMessage) {
      return NextResponse.json(
        { error: 'Missing required fields: messageId, feedbackType, originalMessage' },
        { status: 400 }
      )
    }

    // Ensure user exists
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId }
    })

    // Store the learning feedback
    const learningFeedback = await prisma.learningFeedback.create({
      data: {
        userId,
        messageId,
        feedbackType,
        originalMessage,
        correctedMessage: correctedMessage || null,
        userContext: userContext || null,
        confidence,
        createdAt: new Date()
      }
    })

    // Update user learning metrics
    const existingMetrics = await prisma.learningMetrics.findUnique({
      where: { userId }
    })

    if (existingMetrics) {
      const totalFeedback = existingMetrics.totalFeedback + 1
      const positiveWeight = feedbackType === 'positive' ? 1 : 0
      const newAccuracy = ((existingMetrics.understandingAccuracy * existingMetrics.totalFeedback) + positiveWeight) / totalFeedback

      await prisma.learningMetrics.update({
        where: { userId },
        data: {
          totalFeedback,
          understandingAccuracy: newAccuracy,
          totalCorrections: feedbackType === 'correction' ? existingMetrics.totalCorrections + 1 : existingMetrics.totalCorrections,
          lastUpdated: new Date()
        }
      })
    } else {
      await prisma.learningMetrics.create({
        data: {
          userId,
          totalFeedback: 1,
          understandingAccuracy: feedbackType === 'positive' ? 1.0 : 0.5,
          totalCorrections: feedbackType === 'correction' ? 1 : 0,
          isActive: true,
          lastUpdated: new Date()
        }
      })
    }

    return NextResponse.json({
      success: true,
      feedbackId: learningFeedback.id,
      message: 'Learning feedback stored successfully'
    })

  } catch (error) {
    console.error('Error storing learning feedback:', error)
    return NextResponse.json(
      { error: 'Failed to store learning feedback' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve learning feedback history
export async function GET(request: Request) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const feedbackType = searchParams.get('type')

    const whereClause: any = { userId }
    if (feedbackType) {
      whereClause.feedbackType = feedbackType
    }

    const feedbackHistory = await prisma.learningFeedback.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json({
      feedback: feedbackHistory,
      count: feedbackHistory.length
    })

  } catch (error) {
    console.error('Error retrieving learning feedback:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve learning feedback' },
      { status: 500 }
    )
  }
}