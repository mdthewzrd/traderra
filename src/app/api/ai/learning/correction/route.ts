import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '../../../../../lib/prisma'

// Learning correction API for storing user rules and preferences
export async function POST(request: Request) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      originalMessage,
      correctedMessage,
      ruleDescription,
      ruleType = 'correction',
      context,
      priority = 1,
      isGlobalRule = false
    } = body

    // Validate required fields
    if (!originalMessage || !correctedMessage || !ruleDescription) {
      return NextResponse.json(
        { error: 'Missing required fields: originalMessage, correctedMessage, ruleDescription' },
        { status: 400 }
      )
    }

    // Ensure user exists
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId }
    })

    // Extract learning patterns from the correction
    const patterns = extractLearningPatterns(originalMessage, correctedMessage, ruleDescription)

    // Store the learning rule
    const learningRule = await prisma.learningRule.create({
      data: {
        userId,
        originalMessage,
        correctedMessage,
        ruleDescription,
        ruleType,
        context: context || null,
        priority,
        isGlobalRule,
        patterns: JSON.stringify(patterns),
        isActive: true,
        confidence: 1.0,
        timesApplied: 0,
        createdAt: new Date(),
        lastUsed: null
      }
    })

    // Update learning metrics
    await updateLearningMetrics(userId, 'rule_created')

    return NextResponse.json({
      success: true,
      ruleId: learningRule.id,
      patterns: patterns.length,
      message: `Learning rule created: "${ruleDescription}"`
    })

  } catch (error) {
    console.error('Error storing learning correction:', error)
    return NextResponse.json(
      { error: 'Failed to store learning correction' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve active learning rules
export async function GET(request: Request) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const ruleType = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '100')

    const whereClause: any = {
      userId,
      ...(includeInactive ? {} : { isActive: true })
    }

    if (ruleType) {
      whereClause.ruleType = ruleType
    }

    const learningRules = await prisma.learningRule.findMany({
      where: whereClause,
      orderBy: [
        { priority: 'desc' },
        { timesApplied: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit
    })

    // Parse patterns back to objects
    const rulesWithPatterns = learningRules.map((rule: any) => ({
      ...rule,
      patterns: rule.patterns ? JSON.parse(rule.patterns) : []
    }))

    return NextResponse.json({
      rules: rulesWithPatterns,
      count: rulesWithPatterns.length
    })

  } catch (error) {
    console.error('Error retrieving learning rules:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve learning rules' },
      { status: 500 }
    )
  }
}

// PATCH endpoint to update rule usage and confidence
export async function PATCH(request: Request) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ruleId, action, confidence } = body

    if (!ruleId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: ruleId, action' },
        { status: 400 }
      )
    }

    // Verify rule belongs to user
    const rule = await prisma.learningRule.findFirst({
      where: { id: ruleId, userId }
    })

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    // Update based on action
    const updates: any = { lastUsed: new Date() }

    switch (action) {
      case 'applied':
        updates.timesApplied = rule.timesApplied + 1
        if (confidence) {
          // Weighted average of confidence
          const totalApplications = rule.timesApplied + 1
          updates.confidence = ((rule.confidence * rule.timesApplied) + confidence) / totalApplications
        }
        break

      case 'deactivate':
        updates.isActive = false
        break

      case 'activate':
        updates.isActive = true
        break

      case 'update_confidence':
        if (confidence !== undefined) {
          updates.confidence = confidence
        }
        break
    }

    const updatedRule = await prisma.learningRule.update({
      where: { id: ruleId },
      data: updates
    })

    return NextResponse.json({
      success: true,
      rule: updatedRule,
      message: `Rule ${action} successfully`
    })

  } catch (error) {
    console.error('Error updating learning rule:', error)
    return NextResponse.json(
      { error: 'Failed to update learning rule' },
      { status: 500 }
    )
  }
}

// Helper function to extract learning patterns from corrections
function extractLearningPatterns(original: string, corrected: string, description: string) {
  const patterns = []

  // Extract intent patterns
  if (original.toLowerCase().includes('show') || original.toLowerCase().includes('display')) {
    patterns.push({
      type: 'intent',
      trigger: 'display_request',
      pattern: /\b(show|display|view)\b/i
    })
  }

  if (original.toLowerCase().includes('change') || original.toLowerCase().includes('switch')) {
    patterns.push({
      type: 'intent',
      trigger: 'mode_change',
      pattern: /\b(change|switch|set|update)\b/i
    })
  }

  // Extract context patterns
  if (description.toLowerCase().includes('when i say')) {
    const match = description.match(/when i say ["'](.+?)["']/i)
    if (match) {
      patterns.push({
        type: 'phrase',
        trigger: match[1].toLowerCase(),
        pattern: new RegExp(escapeRegex(match[1]), 'i')
      })
    }
  }

  // Extract preference patterns
  if (description.toLowerCase().includes('always') || description.toLowerCase().includes('never')) {
    patterns.push({
      type: 'preference',
      trigger: description.includes('always') ? 'always_do' : 'never_do',
      pattern: /\b(always|never|prefer|default)\b/i
    })
  }

  return patterns
}

// Helper function to escape regex special characters
function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Helper function to update learning metrics
async function updateLearningMetrics(userId: string, action: string) {
  try {
    const existing = await prisma.learningMetrics.findUnique({
      where: { userId }
    })

    if (existing) {
      const updates: any = { lastUpdated: new Date() }

      if (action === 'rule_created') {
        updates.totalCorrections = existing.totalCorrections + 1
      }

      await prisma.learningMetrics.update({
        where: { userId },
        data: updates
      })
    } else {
      await prisma.learningMetrics.create({
        data: {
          userId,
          totalFeedback: 0,
          understandingAccuracy: 0.8,
          totalCorrections: action === 'rule_created' ? 1 : 0,
          isActive: true,
          lastUpdated: new Date()
        }
      })
    }
  } catch (error) {
    console.error('Error updating learning metrics:', error)
  }
}