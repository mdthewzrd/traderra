// Smart Model Routing for Renata AI
// Automatically selects the optimal model based on task complexity and user intent

import { getModelById } from '../config/openrouter-models'

export interface TaskAnalysis {
  complexity: 'basic' | 'advanced' | 'complex'
  domain: 'general' | 'trading' | 'technical' | 'analysis'
  urgency: 'low' | 'medium' | 'high'
  modelRecommendation: string
  reasoning: string
}

// Define model tiers for different use cases
export const MODEL_TIERS = {
  free: "meta-llama/llama-3.2-3b-instruct",      // Free tier for basic tasks
  advanced: "zhipuai/glm-4-9b-chat",             // Advanced tier for complex analysis
  premium: "anthropic/claude-3.5-sonnet",        // Premium tier for critical tasks
  specialist: "openai/gpt-4-turbo-preview"       // Specialist tier for highest complexity
} as const

// Keywords that indicate advanced/complex tasks
const ADVANCED_KEYWORDS = [
  'analyze', 'analysis', 'strategy', 'optimization', 'backtest', 'risk',
  'performance', 'metrics', 'statistical', 'correlation', 'volatility',
  'drawdown', 'sharpe', 'portfolio', 'technical analysis', 'fundamental',
  'pattern', 'indicator', 'signal', 'algorithm', 'model', 'prediction'
]

const BASIC_KEYWORDS = [
  'hello', 'hi', 'help', 'what', 'how', 'simple', 'quick', 'basic',
  'explain', 'define', 'show', 'list', 'tell me', 'information'
]

const COMPLEX_KEYWORDS = [
  'comprehensive', 'detailed', 'in-depth', 'complex', 'sophisticated',
  'advanced', 'optimize', 'systematic', 'quantitative', 'mathematical',
  'statistical modeling', 'machine learning', 'ai', 'deep analysis'
]

/**
 * Analyzes user input to determine optimal model selection
 */
export function analyzeTaskComplexity(userInput: string, context?: any): TaskAnalysis {
  const input = userInput.toLowerCase()
  const words = input.split(/\s+/)

  // Count keyword matches
  const basicScore = BASIC_KEYWORDS.filter(keyword =>
    input.includes(keyword.toLowerCase())
  ).length

  const advancedScore = ADVANCED_KEYWORDS.filter(keyword =>
    input.includes(keyword.toLowerCase())
  ).length

  const complexScore = COMPLEX_KEYWORDS.filter(keyword =>
    input.includes(keyword.toLowerCase())
  ).length

  // Length-based complexity scoring
  const lengthScore = words.length > 20 ? 'complex' :
                     words.length > 10 ? 'advanced' : 'basic'

  // Domain detection
  let domain: TaskAnalysis['domain'] = 'general'
  if (input.includes('trading') || input.includes('trade') ||
      input.includes('market') || input.includes('stock') ||
      input.includes('position') || input.includes('profit')) {
    domain = 'trading'
  }
  if (input.includes('technical') || input.includes('analysis') ||
      input.includes('indicator') || input.includes('chart')) {
    domain = 'technical'
  }
  if (input.includes('performance') || input.includes('metrics') ||
      input.includes('statistics') || input.includes('data')) {
    domain = 'analysis'
  }

  // Determine complexity
  let complexity: TaskAnalysis['complexity']
  if (complexScore > 0 || lengthScore === 'complex') {
    complexity = 'complex'
  } else if (advancedScore > basicScore || lengthScore === 'advanced') {
    complexity = 'advanced'
  } else {
    complexity = 'basic'
  }

  // Select model based on complexity and domain
  let modelRecommendation: string
  let reasoning: string

  switch (complexity) {
    case 'basic':
      modelRecommendation = MODEL_TIERS.free
      reasoning = "Basic query - using efficient model for quick responses"
      break

    case 'advanced':
      if (domain === 'trading' || domain === 'analysis') {
        modelRecommendation = MODEL_TIERS.advanced
        reasoning = "Advanced trading/analysis task - using specialized model for enhanced analysis"
      } else {
        modelRecommendation = MODEL_TIERS.free
        reasoning = "Advanced but general task - using standard model for optimal efficiency"
      }
      break

    case 'complex':
      if (domain === 'trading' || domain === 'analysis' || domain === 'technical') {
        modelRecommendation = MODEL_TIERS.premium
        reasoning = "Complex trading task - using premium model for comprehensive analysis"
      } else {
        modelRecommendation = MODEL_TIERS.advanced
        reasoning = "Complex general task - using advanced model for optimal performance"
      }
      break
  }

  return {
    complexity,
    domain,
    urgency: complexity === 'complex' ? 'high' :
             complexity === 'advanced' ? 'medium' : 'low',
    modelRecommendation,
    reasoning
  }
}

/**
 * Get recommended model for a specific Renata mode
 */
export function getModelForRenataMode(mode: string): string {
  switch (mode) {
    case 'analyst':
      return MODEL_TIERS.advanced // GLM 4 9B for analytical tasks
    case 'coach':
      return MODEL_TIERS.free     // Free model for coaching conversations
    case 'mentor':
      return MODEL_TIERS.premium  // Claude for thoughtful mentoring
    default:
      return MODEL_TIERS.free     // Default to free model
  }
}

/**
 * Validate that a model ID exists in the configuration
 */
export function validateModelId(modelId: string): boolean {
  return getModelById(modelId) !== undefined
}

/**
 * Get fallback model if the selected model is not available
 */
export function getFallbackModel(preferredModel: string): string {
  if (validateModelId(preferredModel)) {
    return preferredModel
  }

  // Fallback hierarchy: advanced -> free -> default
  if (validateModelId(MODEL_TIERS.advanced)) {
    return MODEL_TIERS.advanced
  }

  if (validateModelId(MODEL_TIERS.free)) {
    return MODEL_TIERS.free
  }

  return "anthropic/claude-3.5-sonnet" // Last resort
}

/**
 * Smart model selection combining user input and mode
 */
export function selectOptimalModel(
  userInput: string,
  mode: string = 'renata',
  userSelectedModel?: string
): {
  selectedModel: string
  analysis: TaskAnalysis
  isUserOverride: boolean
} {
  // If user explicitly selected a model, respect their choice
  if (userSelectedModel && validateModelId(userSelectedModel)) {
    const analysis = analyzeTaskComplexity(userInput)
    return {
      selectedModel: userSelectedModel,
      analysis: {
        ...analysis,
        modelRecommendation: userSelectedModel,
        reasoning: "User-selected model"
      },
      isUserOverride: true
    }
  }

  // Otherwise, use smart routing
  const analysis = analyzeTaskComplexity(userInput)
  const modeBasedModel = getModelForRenataMode(mode)

  // Use the more capable model between task analysis and mode recommendation
  let optimalModel = analysis.modelRecommendation

  // Upgrade model if mode suggests it
  const modelHierarchy = [
    MODEL_TIERS.free,
    MODEL_TIERS.advanced,
    MODEL_TIERS.premium,
    MODEL_TIERS.specialist
  ]

  const analysisIndex = modelHierarchy.indexOf(analysis.modelRecommendation as any)
  const modeIndex = modelHierarchy.indexOf(modeBasedModel as any)

  if (modeIndex > analysisIndex) {
    optimalModel = modeBasedModel
    analysis.reasoning += ` (upgraded for ${mode} mode)`
  }

  return {
    selectedModel: getFallbackModel(optimalModel),
    analysis,
    isUserOverride: false
  }
}