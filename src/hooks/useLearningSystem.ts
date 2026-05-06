import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'

interface LearningMetrics {
  learning_active: boolean
  understanding_accuracy: number
  total_feedback: number
  total_corrections: number
  active_rules_count: number
  recent_accuracy: number
  learning_velocity: number
  last_updated: string | null
}

interface LearningRule {
  id: string
  ruleDescription: string
  ruleType: string
  confidence: number
  timesApplied: number
  isActive: boolean
}

interface LearningFeedback {
  messageId: string
  feedbackType: 'positive' | 'correction' | 'clarification'
  originalMessage: string
  correctedMessage?: string
  userContext?: string
  confidence?: number
}

export function useLearningSystem() {
  const { user, isLoaded } = useUser()
  const [metrics, setMetrics] = useState<LearningMetrics>({
    learning_active: false,
    understanding_accuracy: 0.8,
    total_feedback: 0,
    total_corrections: 0,
    active_rules_count: 0,
    recent_accuracy: 0.8,
    learning_velocity: 0,
    last_updated: null
  })
  const [rules, setRules] = useState<LearningRule[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load learning metrics when user is available
  const loadLearningMetrics = useCallback(async () => {
    if (!user?.id || !isLoaded) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/ai/learning/effectiveness/${user.id}`)

      if (response.ok) {
        const data = await response.json()
        setMetrics(data)
      } else if (response.status === 404) {
        // User doesn't have metrics yet, use defaults
        setMetrics({
          learning_active: true,
          understanding_accuracy: 0.8,
          total_feedback: 0,
          total_corrections: 0,
          active_rules_count: 0,
          recent_accuracy: 0.8,
          learning_velocity: 0,
          last_updated: null
        })
      } else {
        throw new Error('Failed to load learning metrics')
      }
    } catch (err) {
      console.error('Learning metrics load error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load learning metrics')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, isLoaded])

  // Load active learning rules
  const loadLearningRules = useCallback(async () => {
    if (!user?.id || !isLoaded) return

    try {
      const response = await fetch(`/api/ai/learning/correction?limit=50`)

      if (response.ok) {
        const data = await response.json()
        setRules(data.rules || [])
      }
    } catch (err) {
      console.error('Learning rules load error:', err)
    }
  }, [user?.id, isLoaded])

  // Submit learning feedback
  const submitFeedback = useCallback(async (feedback: LearningFeedback) => {
    if (!user?.id) return false

    try {
      setError(null)

      const response = await fetch('/api/ai/learning/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedback)
      })

      if (response.ok) {
        // Reload metrics after successful feedback
        await loadLearningMetrics()
        return true
      } else {
        throw new Error('Failed to submit feedback')
      }
    } catch (err) {
      console.error('Feedback submission error:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
      return false
    }
  }, [user?.id, loadLearningMetrics])

  // Create learning rule from correction
  const createLearningRule = useCallback(async (
    originalMessage: string,
    correctedMessage: string,
    ruleDescription: string,
    ruleType = 'correction'
  ) => {
    if (!user?.id) return false

    try {
      setError(null)

      const response = await fetch('/api/ai/learning/correction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalMessage,
          correctedMessage,
          ruleDescription,
          ruleType,
          context: 'trading_chat',
          priority: 1
        })
      })

      if (response.ok) {
        // Reload metrics and rules after creating a rule
        await Promise.all([loadLearningMetrics(), loadLearningRules()])
        return true
      } else {
        throw new Error('Failed to create learning rule')
      }
    } catch (err) {
      console.error('Learning rule creation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create learning rule')
      return false
    }
  }, [user?.id, loadLearningMetrics, loadLearningRules])

  // Apply learning rules to a message
  const applyLearningRules = useCallback((message: string): {
    shouldModify: boolean
    modifiedMessage?: string
    appliedRules: string[]
  } => {
    if (!metrics.learning_active || rules.length === 0) {
      return { shouldModify: false, appliedRules: [] }
    }

    const appliedRules: string[] = []
    let modifiedMessage = message
    const lowerMessage = message.toLowerCase()

    // Apply active rules in priority order
    const activeRules = rules.filter(rule => rule.isActive).sort((a, b) => b.confidence - a.confidence)

    for (const rule of activeRules) {
      try {
        const patterns = JSON.parse(rule.patterns || '[]')

        for (const pattern of patterns) {
          if (pattern.type === 'phrase' && lowerMessage.includes(pattern.trigger.toLowerCase())) {
            // This rule might apply - for now, just track it
            appliedRules.push(rule.ruleDescription)

            // Update rule usage (fire and forget)
            fetch('/api/ai/learning/correction', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ruleId: rule.id,
                action: 'applied',
                confidence: 0.8
              })
            }).catch(() => {}) // Silent fail
          }
        }
      } catch (err) {
        console.warn('Error applying learning rule:', rule.id, err)
      }
    }

    return {
      shouldModify: appliedRules.length > 0,
      modifiedMessage: appliedRules.length > 0 ? modifiedMessage : undefined,
      appliedRules
    }
  }, [metrics.learning_active, rules])

  // Detect learning intent in user messages
  const detectLearningIntent = useCallback((message: string): {
    hasLearningIntent: boolean
    intentType?: 'rule_creation' | 'correction' | 'clarification'
    extractedRule?: string
  } => {
    const lowerMessage = message.toLowerCase()

    // Rule creation patterns
    if (lowerMessage.includes('set a rule') ||
        lowerMessage.includes('remember that') ||
        lowerMessage.includes('next time')) {
      return {
        hasLearningIntent: true,
        intentType: 'rule_creation',
        extractedRule: message
      }
    }

    // Correction patterns
    if (lowerMessage.includes('what i meant was') ||
        lowerMessage.includes('actually i want') ||
        lowerMessage.includes('that\'s wrong') ||
        lowerMessage.includes('please fix') ||
        lowerMessage.includes('can you fix') ||
        lowerMessage.includes('fix it') ||
        lowerMessage.includes('you did everything except') ||
        lowerMessage.includes('doesn\'t happen in the future') ||
        lowerMessage.includes('should not happen') ||
        lowerMessage.includes('prevent this') ||
        lowerMessage.includes('avoid this') ||
        lowerMessage.includes('don\'t forget')) {
      return {
        hasLearningIntent: true,
        intentType: 'correction'
      }
    }

    // Clarification patterns
    if (lowerMessage.includes('to be clear') ||
        lowerMessage.includes('what i mean is')) {
      return {
        hasLearningIntent: true,
        intentType: 'clarification'
      }
    }

    return { hasLearningIntent: false }
  }, [])

  // Initialize learning system when user is loaded
  useEffect(() => {
    if (isLoaded && user?.id) {
      loadLearningMetrics()
      loadLearningRules()
    }
  }, [isLoaded, user?.id, loadLearningMetrics, loadLearningRules])

  return {
    // State
    metrics,
    rules,
    isLoading,
    error,

    // Actions
    submitFeedback,
    createLearningRule,
    applyLearningRules,
    detectLearningIntent,
    refreshMetrics: loadLearningMetrics,
    refreshRules: loadLearningRules,

    // Computed
    isLearningActive: metrics.learning_active && isLoaded && !!user?.id,
    learningAccuracy: Math.round(metrics.understanding_accuracy * 100),
    totalCorrections: metrics.total_corrections
  }
}