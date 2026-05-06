/**
 * OpenRouter Client for Traderra
 *
 * Provides unified interface for LLM interactions via OpenRouter API.
 * Supports multiple models (Claude, GPT-4, etc.) with fallback support.
 * Includes model rotation, rate limiting, and smart error handling.
 *
 * Based on edge-dev implementation adapted for Next.js 15
 */

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
  metadata?: Record<string, any>
}

interface LLMResponse {
  content: string
  model: string
  finishReason: string
  toolCalls?: any[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  metadata?: Record<string, any>
}

interface LLMConfig {
  apiKey: string
  baseUrl: string
  defaultModel: string
  fallbackModel: string
  temperature: number
  maxTokens: number
  timeout: number
  // Model rotation settings
  enableRotation: boolean
  rotationModels: string[]
  rateLimitPerMinute: number
}

interface ChatCompletionRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  temperature: number
  max_tokens: number
  tools?: any[]
  tool_choice?: 'auto' | 'none' | { type: string; function: { name: string } }
  stream?: boolean
}

interface ChatCompletionResponse {
  id: string
  choices: Array<{
    message: {
      role: string
      content: string
      tool_calls?: any[]
    }
    finish_reason: string
  }>
  model: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  created: number
}

/**
 * Default configuration for OpenRouter client
 */
const DEFAULT_CONFIG: LLMConfig = {
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseUrl: 'https://openrouter.ai/api/v1',
  defaultModel: 'anthropic/claude-3.5-sonnet',
  fallbackModel: 'anthropic/claude-3-haiku',
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 120000, // 2 minutes
  // Model rotation settings - use free models for distribution
  enableRotation: true,
  rotationModels: [
    'anthropic/claude-3-haiku:free',
    'google/gemma-2-9b-it:free',
    'microsoft/phi-3-mini-128k-instruct:free',
    'meta-llama/llama-3.1-8b-instruct:free',
  ],
  rateLimitPerMinute: 10 // Conservative rate limit
}

/**
 * OpenRouter Client Class
 * Handles model switching, rate limiting, and API errors
 */
export class OpenRouterClient {
  private config: LLMConfig
  private currentModel: string
  private rotationIndex: number
  private lastCallTime: number = 0
  private callCount: number = 0
  private rateLimitWindow: number = 60000 // 1 minute in ms

  constructor(config: Partial<LLMConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.currentModel = this.config.defaultModel
    this.rotationIndex = 0
  }

  /**
   * Get current model
   */
  get model(): string {
    return this.currentModel
  }

  /**
   * Set the model to use
   */
  setModel(model: string): void {
    this.currentModel = model
    console.log(`[OpenRouter] Model switched to: ${model}`)
  }

  /**
   * Get next model in rotation
   */
  private getNextModel(): string {
    if (!this.config.enableRotation || this.config.rotationModels.length === 0) {
      return this.config.defaultModel
    }

    const model = this.config.rotationModels[this.rotationIndex]
    this.rotationIndex = (this.rotationIndex + 1) % this.config.rotationModels.length
    return model
  }

  /**
   * Rate limiting wait
   * Prevents overcalling by respecting rate limits
   */
  private async rateLimitWait(): Promise<void> {
    if (this.config.rateLimitPerMinute <= 0) {
      return
    }

    const currentTime = Date.now()
    const timeSinceLast = currentTime - this.lastCallTime

    // Reset counter if window has passed
    if (timeSinceLast >= this.rateLimitWindow) {
      this.callCount = 0
      return
    }

    // Check if we've hit the limit
    if (this.callCount >= this.config.rateLimitPerMinute) {
      const waitTime = this.rateLimitWindow - timeSinceLast + 500 // Small buffer
      console.warn(`[OpenRouter] Rate limit reached, waiting ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      this.callCount = 0
      return
    }

    // Increment counter
    this.callCount++
    this.lastCallTime = currentTime
  }

  /**
   * Send chat completion request
   */
  async chat(
    messages: Message[],
    options: {
      model?: string
      temperature?: number
      maxTokens?: number
      tools?: any[]
      toolChoice?: 'auto' | 'none' | { type: string; function: { name: string } }
    } = {}
  ): Promise<LLMResponse> {
    // Apply rate limiting
    await this.rateLimitWait()

    // Use rotation if enabled and no model specified
    const model = options.model ?? (this.config.enableRotation ? this.getNextModel() : this.currentModel)
    const temperature = options.temperature ?? this.config.temperature
    const maxTokens = options.maxTokens ?? this.config.maxTokens

    console.log(`[OpenRouter] Using model: ${model}`)

    // Convert messages to OpenAI format
    const apiMessages = messages.map(m => ({
      role: m.role,
      content: m.content
    }))

    const requestBody: ChatCompletionRequest = {
      model,
      messages: apiMessages,
      temperature,
      max_tokens: maxTokens,
      ...(options.tools && { tools: options.tools }),
      ...(options.toolChoice && { tool_choice: options.toolChoice })
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:6565',
          'X-Title': 'Traderra Renata'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenRouter error ${response.status}: ${errorText}`)
      }

      const data: ChatCompletionResponse = await response.json()
      const choice = data.choices[0]

      return {
        content: choice.message.content || '',
        model: data.model,
        finishReason: choice.finish_reason,
        toolCalls: choice.message.tool_calls || undefined,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined,
        metadata: {
          id: data.id,
          created: data.created
        }
      }

    } catch (error) {
      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`[OpenRouter] Timeout with ${model}, trying fallback ${this.config.fallbackModel}`)
        if (model !== this.config.fallbackModel) {
          return this.chat(messages, { ...options, model: this.config.fallbackModel })
        }
        throw new Error(`OpenRouter timeout: Request exceeded ${this.config.timeout}ms`)
      }

      // Handle auth errors
      const errorStr = error instanceof Error ? error.message : String(error)
      const isAuthError =
        errorStr.includes('401') ||
        errorStr.includes('Unauthorized') ||
        errorStr.includes('User not found') ||
        errorStr.includes('Invalid API key')

      if (isAuthError) {
        throw new Error(
          'OpenRouter API key is invalid or has been deleted. ' +
          'Please get a new API key from https://openrouter.ai/keys and update your .env file. ' +
          'If you have credits, contact OpenRouter support to restore your account.'
        )
      }

      // Try fallback model on error
      if (model !== this.config.fallbackModel) {
        console.warn(`[OpenRouter] Error with ${model}: ${error}, trying fallback ${this.config.fallbackModel}`)
        return this.chat(messages, { ...options, model: this.config.fallbackModel })
      }

      throw error
    }
  }

  /**
   * Estimate token count (rough approximation)
   */
  countTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  /**
   * Truncate messages to fit within token limit
   */
  truncateToFit(
    messages: Message[],
    maxTokens: number = 128000,
    reserveForOutput: number = 2048
  ): Message[] {
    // Estimate current tokens
    const totalTokens = messages.reduce((sum, m) => sum + this.countTokens(m.content), 0)

    if (totalTokens <= maxTokens - reserveForOutput) {
      return messages
    }

    // Keep system message, truncate from end
    const result: Message[] = []
    let tokensUsed = 0

    // Always keep system message
    for (const m of messages) {
      if (m.role === 'system') {
        result.push(m)
        tokensUsed += this.countTokens(m.content)
      }
    }

    // Add messages from end until we hit limit
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === 'system') continue

      const msgTokens = this.countTokens(m.content)

      if (tokensUsed + msgTokens > maxTokens - reserveForOutput) {
        break
      }

      result.splice(1, 0, m) // Insert after system message
      tokensUsed += msgTokens
    }

    return result
  }
}

/**
 * Singleton instance for easy access
 */
let defaultClient: OpenRouterClient | null = null

/**
 * Get or create default OpenRouter client
 */
export function getOpenRouterClient(): OpenRouterClient {
  if (!defaultClient) {
    defaultClient = new OpenRouterClient()
  }
  return defaultClient
}

/**
 * Reset default client (useful for testing)
 */
export function resetOpenRouterClient(): void {
  defaultClient = null
}

/**
 * Set a custom configuration for the default client
 */
export function configureOpenRouter(config: Partial<LLMConfig>): void {
  if (defaultClient) {
    console.warn('[OpenRouter] Client already created. Configuration will apply to new client.')
  }
  defaultClient = new OpenRouterClient(config)
}

// Export types
export type { Message, LLMResponse, LLMConfig, ChatCompletionRequest, ChatCompletionResponse }
