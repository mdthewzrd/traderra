import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '../../../../../../lib/prisma'

// Learning effectiveness API for tracking user-specific learning metrics
export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId: authUserId } = auth()

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Users can only access their own learning metrics
    const requestedUserId = params.userId
    if (authUserId !== requestedUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get learning metrics
    const metrics = await prisma.learningMetrics.findUnique({
      where: { userId: requestedUserId }
    })

    if (!metrics) {
      // Return default metrics if none exist
      return NextResponse.json({
        learning_active: false,
        understanding_accuracy: 0.8,
        total_feedback: 0,
        total_corrections: 0,
        active_rules_count: 0,
        recent_accuracy: 0.8,
        learning_velocity: 0,
        last_updated: null
      })
    }

    // Get additional learning statistics
    const activeRulesCount = await prisma.learningRule.count({
      where: { userId: requestedUserId, isActive: true }
    })

    const totalRulesCount = await prisma.learningRule.count({
      where: { userId: requestedUserId }
    })

    // Calculate recent accuracy (last 10 feedback entries)
    const recentFeedback = await prisma.learningFeedback.findMany({
      where: { userId: requestedUserId },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    const recentAccuracy = recentFeedback.length > 0
      ? recentFeedback.filter(f => f.feedbackType === 'positive').length / recentFeedback.length
      : metrics.understandingAccuracy

    // Calculate learning velocity (rules created per week)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentRulesCount = await prisma.learningRule.count({
      where: {
        userId: requestedUserId,
        createdAt: { gte: oneWeekAgo }
      }
    })

    return NextResponse.json({
      learning_active: metrics.isActive,
      understanding_accuracy: metrics.understandingAccuracy,
      total_feedback: metrics.totalFeedback,
      total_corrections: metrics.totalCorrections,
      active_rules_count: activeRulesCount,
      total_rules_count: totalRulesCount,
      recent_accuracy: recentAccuracy,
      learning_velocity: recentRulesCount,
      last_updated: metrics.lastUpdated,
      created_at: metrics.createdAt || null
    })

  } catch (error) {
    console.error('Error retrieving learning effectiveness:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve learning effectiveness data' },
      { status: 500 }
    )
  }
}

// PATCH endpoint to update learning metrics
export async function PATCH(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId: authUserId } = auth()

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requestedUserId = params.userId
    if (authUserId !== requestedUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      isActive,
      understandingAccuracy,
      resetMetrics = false
    } = body

    if (resetMetrics) {
      // Reset all learning metrics
      await prisma.learningMetrics.upsert({
        where: { userId: requestedUserId },
        create: {
          userId: requestedUserId,
          totalFeedback: 0,
          understandingAccuracy: 0.8,
          totalCorrections: 0,
          isActive: true,
          lastUpdated: new Date()
        },
        update: {
          totalFeedback: 0,
          understandingAccuracy: 0.8,
          totalCorrections: 0,
          isActive: true,
          lastUpdated: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Learning metrics reset successfully'
      })
    }

    // Update specific metrics
    const updates: any = { lastUpdated: new Date() }

    if (isActive !== undefined) {
      updates.isActive = isActive
    }

    if (understandingAccuracy !== undefined) {
      updates.understandingAccuracy = Math.max(0, Math.min(1, understandingAccuracy))
    }

    const updatedMetrics = await prisma.learningMetrics.upsert({
      where: { userId: requestedUserId },
      create: {
        userId: requestedUserId,
        totalFeedback: 0,
        understandingAccuracy: understandingAccuracy || 0.8,
        totalCorrections: 0,
        isActive: isActive !== undefined ? isActive : true,
        lastUpdated: new Date()
      },
      update: updates
    })

    return NextResponse.json({
      success: true,
      metrics: updatedMetrics,
      message: 'Learning metrics updated successfully'
    })

  } catch (error) {
    console.error('Error updating learning effectiveness:', error)
    return NextResponse.json(
      { error: 'Failed to update learning effectiveness data' },
      { status: 500 }
    )
  }
}