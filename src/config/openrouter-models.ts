// OpenRouter model configurations organized by category and pricing
// Prices are per 1M tokens (input/output)

export interface ModelConfig {
  id: string
  name: string
  provider: string
  inputPrice: number  // Per 1M tokens
  outputPrice: number // Per 1M tokens
  contextLength: number
  description: string
  strengths: string[]
  bestFor: string[]
  badge?: string
}

export interface ModelCategory {
  name: string
  description: string
  models: ModelConfig[]
}

export const modelCategories: ModelCategory[] = [
  {
    name: "🏆 Premium (Best Performance)",
    description: "Top-tier models for the highest quality responses",
    models: [
      {
        id: "openai/gpt-4-turbo-preview",
        name: "GPT-4 Turbo",
        provider: "OpenAI",
        inputPrice: 10.00,
        outputPrice: 30.00,
        contextLength: 128000,
        description: "Latest GPT-4 with enhanced capabilities and larger context",
        strengths: ["Reasoning", "Analysis", "Complex tasks"],
        bestFor: ["Trading analysis", "Strategic planning", "Complex reasoning"],
        badge: "🔥 Most Popular"
      },
      {
        id: "openai/gpt-4",
        name: "GPT-4",
        provider: "OpenAI",
        inputPrice: 30.00,
        outputPrice: 60.00,
        contextLength: 8192,
        description: "Original GPT-4 - exceptional quality for complex tasks",
        strengths: ["Accuracy", "Reasoning", "Reliability"],
        bestFor: ["High-stakes analysis", "Critical decisions", "Professional insights"]
      },
      {
        id: "anthropic/claude-3-opus",
        name: "Claude 3 Opus",
        provider: "Anthropic",
        inputPrice: 15.00,
        outputPrice: 75.00,
        contextLength: 200000,
        description: "Most capable Claude model with exceptional reasoning",
        strengths: ["Analysis", "Writing", "Complex reasoning"],
        bestFor: ["In-depth analysis", "Strategic insights", "Comprehensive reports"],
        badge: "🧠 Best Reasoning"
      },
      {
        id: "google/gemini-pro-1.5",
        name: "Gemini Pro 1.5",
        provider: "Google",
        inputPrice: 3.50,
        outputPrice: 10.50,
        contextLength: 1000000,
        description: "Google's flagship model with massive context window",
        strengths: ["Long context", "Multimodal", "Analysis"],
        bestFor: ["Large dataset analysis", "Long-form content", "Multi-modal tasks"],
        badge: "📊 Huge Context"
      }
    ]
  },
  {
    name: "💎 High Performance",
    description: "Excellent quality with better value proposition",
    models: [
      {
        id: "anthropic/claude-3.5-sonnet",
        name: "Claude 3 Sonnet",
        provider: "Anthropic",
        inputPrice: 3.00,
        outputPrice: 15.00,
        contextLength: 200000,
        description: "Balanced performance and cost from Anthropic",
        strengths: ["Balance", "Reliability", "Trading insights"],
        bestFor: ["Regular trading analysis", "Daily insights", "Balanced conversations"],
        badge: "⚖️ Best Balance"
      },
      {
        id: "openai/gpt-3.5-turbo",
        name: "GPT-3.5 Turbo",
        provider: "OpenAI",
        inputPrice: 0.50,
        outputPrice: 1.50,
        contextLength: 16385,
        description: "Fast and capable for most trading tasks",
        strengths: ["Speed", "Efficiency", "General tasks"],
        bestFor: ["Quick insights", "Regular conversations", "Daily analysis"]
      },
      {
        id: "anthropic/claude-3-haiku",
        name: "Claude 3 Haiku",
        provider: "Anthropic",
        inputPrice: 0.25,
        outputPrice: 1.25,
        contextLength: 200000,
        description: "Fastest Claude model, great for quick tasks",
        strengths: ["Speed", "Efficiency", "Large context"],
        bestFor: ["Quick responses", "Fast analysis", "Frequent interactions"],
        badge: "⚡ Fastest"
      },
      {
        id: "google/gemini-pro",
        name: "Gemini Pro",
        provider: "Google",
        inputPrice: 0.50,
        outputPrice: 1.50,
        contextLength: 32768,
        description: "Google's versatile model for general tasks",
        strengths: ["Versatility", "Multimodal", "Analysis"],
        bestFor: ["General analysis", "Diverse tasks", "Balanced performance"]
      }
    ]
  },
  {
    name: "💰 Best Value",
    description: "Great performance at budget-friendly prices",
    models: [
      {
        id: "meta-llama/llama-3.2-3b-instruct",
        name: "Llama 3.2 3B Instruct",
        provider: "Meta",
        inputPrice: 0.00,
        outputPrice: 0.00,
        contextLength: 8192,
        description: "Meta's efficient 3B model - completely free",
        strengths: ["Free", "Fast", "Good for basic tasks"],
        bestFor: ["Basic questions", "Quick responses", "High-volume usage"],
        badge: "🆓 Free"
      },
      {
        id: "zhipuai/glm-4-9b-chat",
        name: "GLM 4 9B Chat",
        provider: "Zhipu AI",
        inputPrice: 0.10,
        outputPrice: 0.10,
        contextLength: 128000,
        description: "Advanced bilingual model with strong reasoning",
        strengths: ["Advanced reasoning", "Large context", "Cost effective"],
        bestFor: ["Complex analysis", "Advanced tasks", "Trading insights"],
        badge: "🧠 Advanced"
      },
      {
        id: "meta-llama/llama-3-70b-instruct",
        name: "Llama 3 70B",
        provider: "Meta",
        inputPrice: 0.70,
        outputPrice: 0.90,
        contextLength: 8192,
        description: "Meta's powerful open-source model",
        strengths: ["Open source", "Good performance", "Cost effective"],
        bestFor: ["Budget-conscious users", "Open source preference", "General tasks"],
        badge: "🔓 Open Source"
      },
      {
        id: "meta-llama/llama-3-8b-instruct",
        name: "Llama 3 8B",
        provider: "Meta",
        inputPrice: 0.18,
        outputPrice: 0.18,
        contextLength: 8192,
        description: "Smaller but efficient Llama model",
        strengths: ["Very affordable", "Fast", "Efficient"],
        bestFor: ["High-volume usage", "Simple tasks", "Testing"],
        badge: "💸 Cheapest"
      },
      {
        id: "mistralai/mixtral-8x7b-instruct",
        name: "Mixtral 8x7B",
        provider: "Mistral AI",
        inputPrice: 0.54,
        outputPrice: 0.54,
        contextLength: 32768,
        description: "Efficient mixture-of-experts model",
        strengths: ["Efficiency", "Good context", "Balanced"],
        bestFor: ["Cost-effective analysis", "Medium complexity tasks", "Regular use"]
      },
      {
        id: "microsoft/wizardlm-2-8x22b",
        name: "WizardLM 2 8x22B",
        provider: "Microsoft",
        inputPrice: 1.00,
        outputPrice: 1.00,
        contextLength: 65536,
        description: "Microsoft's advanced reasoning model",
        strengths: ["Reasoning", "Problem solving", "Analysis"],
        bestFor: ["Complex reasoning", "Problem solving", "Trading strategy"]
      }
    ]
  },
  {
    name: "🔬 Specialized",
    description: "Models optimized for specific use cases",
    models: [
      {
        id: "perplexity/llama-3-sonar-large-32k-online",
        name: "Perplexity Sonar Large",
        provider: "Perplexity",
        inputPrice: 1.00,
        outputPrice: 1.00,
        contextLength: 32768,
        description: "Web-connected model with real-time information",
        strengths: ["Real-time data", "Web search", "Current events"],
        bestFor: ["Market news", "Real-time analysis", "Current market conditions"],
        badge: "🌐 Web Connected"
      },
      {
        id: "deepseek/deepseek-coder-33b-instruct",
        name: "DeepSeek Coder 33B",
        provider: "DeepSeek",
        inputPrice: 0.80,
        outputPrice: 0.80,
        contextLength: 16384,
        description: "Specialized coding and analysis model",
        strengths: ["Code analysis", "Technical analysis", "Programming"],
        bestFor: ["Trading algorithms", "Technical indicators", "Code analysis"],
        badge: "👨‍💻 Code Expert"
      },
      {
        id: "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",
        name: "DeepSeek V3",
        provider: "DeepSeek",
        inputPrice: 0.27,
        outputPrice: 1.10,
        contextLength: 64000,
        description: "Latest DeepSeek V3 model with exceptional reasoning and cost-effectiveness",
        strengths: ["Reasoning", "Analysis", "Cost-effective", "Large context"],
        bestFor: ["Trading analysis", "Strategic insights", "Cost optimization", "General conversations"],
        badge: "🔥 Hot Model"
      },
      {
        id: "nousresearch/nous-hermes-2-mixtral-8x7b-dpo",
        name: "Nous Hermes 2 Mixtral",
        provider: "Nous Research",
        inputPrice: 0.54,
        outputPrice: 0.54,
        contextLength: 32768,
        description: "Fine-tuned for helpful and harmless responses",
        strengths: ["Helpfulness", "Safety", "Instruction following"],
        bestFor: ["Educational content", "Safe advice", "Learning"]
      },
      {
        id: "togethercomputer/stripedhyena-nous-7b",
        name: "StripedHyena Nous 7B",
        provider: "Together",
        inputPrice: 0.18,
        outputPrice: 0.18,
        contextLength: 32768,
        description: "Novel architecture optimized for long sequences",
        strengths: ["Long sequences", "Efficiency", "Novel approach"],
        bestFor: ["Long-form analysis", "Sequence modeling", "Research"]
      }
    ]
  },
  {
    name: "⚡ Speed Focused",
    description: "Optimized for fast responses and high throughput",
    models: [
      {
        id: "anthropic/claude-instant-1.2",
        name: "Claude Instant",
        provider: "Anthropic",
        inputPrice: 0.80,
        outputPrice: 2.40,
        contextLength: 100000,
        description: "Fast and capable Claude variant",
        strengths: ["Speed", "Large context", "Reliable"],
        bestFor: ["Quick responses", "High-frequency trading insights", "Real-time analysis"],
        badge: "🏃‍♂️ Ultra Fast"
      },
      {
        id: "openai/gpt-3.5-turbo-instruct",
        name: "GPT-3.5 Turbo Instruct",
        provider: "OpenAI",
        inputPrice: 1.50,
        outputPrice: 2.00,
        contextLength: 4096,
        description: "Instruction-tuned for better following of specific tasks",
        strengths: ["Instruction following", "Task completion", "Speed"],
        bestFor: ["Specific instructions", "Task automation", "Quick tasks"]
      },
      {
        id: "google/gemma-7b-it",
        name: "Gemma 7B",
        provider: "Google",
        inputPrice: 0.07,
        outputPrice: 0.07,
        contextLength: 8192,
        description: "Google's lightweight open model",
        strengths: ["Ultra fast", "Very cheap", "Open source"],
        bestFor: ["High-volume usage", "Testing", "Simple responses"],
        badge: "🚀 Lightning"
      }
    ]
  }
]

// Default model for new users - using DeepSeek V3 for excellent performance at great value
export const defaultModel = "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"

// Get model by ID
export function getModelById(id: string): ModelConfig | undefined {
  for (const category of modelCategories) {
    const model = category.models.find(m => m.id === id)
    if (model) return model
  }
  return undefined
}

// Get all models flattened
export function getAllModels(): ModelConfig[] {
  return modelCategories.flatMap(category => category.models)
}

// Sort models by price (ascending)
export function getModelsByPrice(): ModelConfig[] {
  return getAllModels().sort((a, b) => a.inputPrice - b.inputPrice)
}

// Get models by provider
export function getModelsByProvider(provider: string): ModelConfig[] {
  return getAllModels().filter(model =>
    model.provider.toLowerCase() === provider.toLowerCase()
  )
}

// Format price for display
export function formatPrice(price: number): string {
  if (price < 1) {
    return `$${price.toFixed(2)}`
  }
  return `$${price.toFixed(0)}`
}

// Calculate cost for a conversation
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: ModelConfig
): number {
  const inputCost = (inputTokens / 1000000) * model.inputPrice
  const outputCost = (outputTokens / 1000000) * model.outputPrice
  return inputCost + outputCost
}