// API client for Traderra backend communication
// Connects to FastAPI backend on port 6500

import { AguiResponse, AguiGenerationRequest, AguiComponent } from '@/types/agui'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6500'

export interface PerformanceMetrics {
  totalPnL: number
  winRate: number
  expectancy: number
  profitFactor: number
  maxDrawdown: number
  totalTrades: number
  avgWinner: number
  avgLoser: number
}

export interface TradingContext {
  timeRange: string
  activeFilters: string[]
  currentMode?: string
  focusArea?: string
}

export interface RenataRequest {
  query: string
  mode: 'analyst' | 'coach' | 'mentor'
  performance_data: PerformanceMetrics
  trading_context: TradingContext
  user_preferences?: {
    analysis_depth: 'brief' | 'detailed' | 'comprehensive'
    focus_areas: string[]
  }
}

export interface RenataResponse {
  response: string
  mode: string
  confidence: number
  insights: string[]
  recommendations: string[]
  follow_up_questions: string[]
  analysis_metadata: {
    knowledge_sources: number
    processing_time: number
    archon_queries: number
  }
  // AGUI support
  agui?: AguiResponse
  components?: AguiComponent[]
  interactive?: boolean
}

// New interfaces for intelligent conversation
export interface UIContext {
  current_page: string
  display_mode: string
  filters_active: string[]
  time_range: string
  user_location: string
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface IntelligentConversationRequest {
  user_input: string
  ui_context: UIContext
  conversation_history?: ConversationMessage[]
}

export interface AIResponse {
  response: string
  command_type: 'ui_action' | 'ai_mode' | 'question' | 'correction' | 'greeting'
  intent: string
  confidence: number
  ui_action?: {
    action_type: string
    parameters: Record<string, any>
  }
  ai_mode_change?: {
    new_mode: string
    mode_description: string
  }
  learning_applied: boolean
  suggested_learning?: string
}

export interface ArchonSearchRequest {
  query: string
  source_id?: string
  match_count?: number
}

export interface ArchonSearchResponse {
  success: boolean
  results: Array<{
    content: string
    source: string
    relevance_score: number
    metadata: Record<string, any>
  }>
  sources_queried: number
  processing_time: number
}

// API Client class for backend communication
class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }

    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Health check endpoint
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.makeRequest('/health')
  }

  // Get performance metrics
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return this.makeRequest('/api/performance/metrics')
  }

  // Chat with Renata AI agent
  async chatWithRenata(request: RenataRequest): Promise<RenataResponse> {
    return this.makeRequest('/ai/renata/chat-simple', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  // New intelligent conversation method with command parsing
  async intelligentConversation(request: IntelligentConversationRequest): Promise<AIResponse> {
    console.log('🚀 API Client: Making intelligent conversation request:', request)

    try {
      // Call backend directly - bypass Next.js proxy
      const response = await fetch('http://localhost:6500/ai/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      console.log('🔍 API Client: Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ API Client: Error response:', errorText)
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      console.log('✅ API Client: Success response:', data)
      return data
    } catch (error) {
      console.error('❌ API Client: Network error:', error)
      throw error
    }
  }

  // Analyze performance with Renata
  async analyzePerformance(
    performanceData: PerformanceMetrics,
    tradingContext: TradingContext,
    mode: 'analyst' | 'coach' | 'mentor' = 'coach'
  ): Promise<RenataResponse> {
    return this.makeRequest('/api/ai/renata/analyze', {
      method: 'POST',
      body: JSON.stringify({
        mode,
        performance_data: performanceData,
        trading_context: tradingContext,
      }),
    })
  }

  // Search Archon knowledge base
  async searchKnowledge(request: ArchonSearchRequest): Promise<ArchonSearchResponse> {
    return this.makeRequest('/api/archon/search', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  // Get available knowledge sources
  async getKnowledgeSources(): Promise<{ sources: Array<{ id: string; title: string; url: string }> }> {
    return this.makeRequest('/api/archon/sources')
  }

  // Initialize trading knowledge base
  async initializeKnowledge(): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('/api/archon/init', {
      method: 'POST',
    })
  }

  // AGUI-specific methods
  async chatWithRenataAgui(request: RenataRequest & { enableAgui?: boolean }): Promise<RenataResponse> {
    return this.makeRequest('/ai/renata/chat-simple', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async generateAguiComponents(request: AguiGenerationRequest): Promise<AguiResponse> {
    return this.makeRequest('/api/ai/renata/generate-agui', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async updateAguiComponent(componentId: string, data: any): Promise<{ success: boolean }> {
    return this.makeRequest(`/api/ai/renata/agui/${componentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }
}

// Export singleton instance
export const apiClient = new ApiClient()

// Utility functions for API calls
export const api = {
  // Quick health check
  ping: () => apiClient.healthCheck(),

  // Performance data
  getMetrics: () => apiClient.getPerformanceMetrics(),

  // Renata AI interactions
  renata: {
    chat: (query: string, mode: 'analyst' | 'coach' | 'mentor', performanceData: PerformanceMetrics, tradingContext: TradingContext) =>
      apiClient.chatWithRenata({ query, mode, performance_data: performanceData, trading_context: tradingContext }),

    // New intelligent conversation with command parsing
    intelligentChat: (userInput: string, uiContext: UIContext, conversationHistory?: ConversationMessage[]) =>
      apiClient.intelligentConversation({ user_input: userInput, ui_context: uiContext, conversation_history: conversationHistory }),

    analyze: (performanceData: PerformanceMetrics, tradingContext: TradingContext, mode?: 'analyst' | 'coach' | 'mentor') =>
      apiClient.analyzePerformance(performanceData, tradingContext, mode),

    // AGUI methods
    chatAgui: (query: string, mode: 'analyst' | 'coach' | 'mentor', performanceData: PerformanceMetrics, tradingContext: TradingContext, enableAgui = true) =>
      apiClient.chatWithRenataAgui({ query, mode, performance_data: performanceData, trading_context: tradingContext, enableAgui }),

    generateComponents: (request: AguiGenerationRequest) =>
      apiClient.generateAguiComponents(request),

    updateComponent: (componentId: string, data: any) =>
      apiClient.updateAguiComponent(componentId, data),
  },

  // Archon knowledge search
  knowledge: {
    search: (query: string, sourceId?: string, matchCount?: number) =>
      apiClient.searchKnowledge({ query, source_id: sourceId, match_count: matchCount }),

    sources: () => apiClient.getKnowledgeSources(),

    init: () => apiClient.initializeKnowledge(),
  },
}

export default apiClient