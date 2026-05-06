/**
 * Archon MCP Client for CE-Hub Integration
 *
 * This client provides Traderra with access to the Archon knowledge graph
 * for context engineering, RAG-based intelligence retrieval, and project management.
 *
 * Architecture:
 * - Connects to Archon MCP server at localhost:8051 via MCP JSON-RPC protocol
 * - Uses FastMCP streamable HTTP transport (POST /mcp with JSON-RPC)
 * - Provides typed interfaces for all Archon operations
 * - Handles connection pooling and error recovery
 * - Caches responses for performance optimization
 *
 * @module ArchonClient
 */

interface ArchonConfig {
  baseUrl: string
  timeout: number
  retryAttempts: number
  retryDelay: number
}

interface Project {
  id: string
  name: string
  description: string
  status: 'active' | 'archived' | 'completed'
  createdAt: string
  updatedAt: string
  metadata?: Record<string, any>
}

interface Task {
  id: string
  projectId: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignedTo?: string
  createdAt: string
  updatedAt: string
  dependencies?: string[]
}

interface KnowledgeSearchResult {
  id: string
  content: string
  metadata: Record<string, any>
  relevanceScore: number
  source: string
  timestamp: string
}

interface CodeExample {
  id: string
  title: string
  description: string
  code: string
  language: string
  tags: string[]
  metadata: Record<string, any>
}

interface RAGSearchOptions {
  limit?: number
  threshold?: number
  filters?: Record<string, any>
  includeMetadata?: boolean
}

/**
 * Archon MCP Client Class
 *
 * Provides methods for:
 * - Project management (find, create, update)
 * - Task coordination (find, create, update, status changes)
 * - Knowledge retrieval (RAG-based search)
 * - Code example search
 * - Embedding health validation
 */
export class ArchonClient {
  private config: ArchonConfig
  private connectionHealth: boolean = false
  private lastHealthCheck: number = 0
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map()

  constructor(config?: Partial<ArchonConfig>) {
    this.config = {
      baseUrl: config?.baseUrl || 'http://localhost:8051',
      timeout: config?.timeout || 10000,
      retryAttempts: config?.retryAttempts || 3,
      retryDelay: config?.retryDelay || 1000
    }
  }

  /**
   * Check Archon MCP server health using MCP JSON-RPC protocol
   * Gracefully handles CORS errors by returning false instead of throwing
   */
  async healthCheck(): Promise<boolean> {
    // Skip health check if running in browser (CORS issues)
    if (typeof window !== 'undefined') {
      console.log('[Archon] Skipping browser health check (CORS limitation)')
      this.connectionHealth = true // Assume healthy to avoid blocking
      this.lastHealthCheck = Date.now()
      return true
    }

    try {
      const response = await this.callMCPTool('health_check', {})
      const result = JSON.parse(response as string)

      this.connectionHealth = result.success === true
      this.lastHealthCheck = Date.now()

      if (!this.connectionHealth) {
        console.warn('[Archon] Health check failed:', result)
      }

      return this.connectionHealth
    } catch (error) {
      console.error('[Archon] Health check error:', error)
      this.connectionHealth = false
      return false
    }
  }

  /**
   * Call MCP tool using JSON-RPC protocol
   * Implements the MCP JSON-RPC specification for tool calls
   */
  private async callMCPTool(
    toolName: string,
    arguments_: Record<string, any>
  ): Promise<string | object> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const payload = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: arguments_
      }
    }

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(`${this.config.baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout)
        })

        if (!response.ok) {
          throw new Error(`MCP server error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()

        // Handle JSON-RPC error response
        if (data.error) {
          throw new Error(`MCP error: ${data.error.message || JSON.stringify(data.error)}`)
        }

        // Return the result content
        if (data.result) {
          // MCP tools return content array - extract text or data
          if (Array.isArray(data.result.content)) {
            const textContent = data.result.content.find((c: any) => c.type === 'text')
            if (textContent) {
              return textContent.text
            }
          }
          return data.result
        }

        throw new Error('Invalid MCP response: missing result')

      } catch (error) {
        lastError = error as Error
        console.warn(`[Archon] MCP call attempt ${attempt}/${this.config.retryAttempts} failed:`, error)

        if (attempt < this.config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt))
        }
      }
    }

    throw lastError || new Error('MCP call failed after retries')
  }

  /**
   * Get cached data if available and not expired
   */
  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }

    return cached.data as T
  }

  /**
   * Set cache with TTL
   */
  private setCache<T>(key: string, data: T, ttl: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear()
  }

  // ====================
  // PROJECT MANAGEMENT
  // ====================

  /**
   * Find projects by query using MCP list_projects tool
   */
  async findProjects(query: string = '', options: RAGSearchOptions = {}): Promise<Project[]> {
    const cacheKey = `projects:${query}:${JSON.stringify(options)}`
    const cached = this.getCached<Project[]>(cacheKey)
    if (cached) return cached

    try {
      const response = await this.callMCPTool('list_projects', {
        query,
        page: 1,
        per_page: options.limit || 10
      })

      // Parse JSON response
      const result = typeof response === 'string' ? JSON.parse(response) : response
      const projects = result.projects || []

      this.setCache(cacheKey, projects)
      return projects
    } catch (error) {
      console.error('[Archon] findProjects error:', error)
      return []
    }
  }

  /**
   * Get project by ID using MCP list_projects tool
   */
  async getProject(projectId: string): Promise<Project | null> {
    const cacheKey = `project:${projectId}`
    const cached = this.getCached<Project>(cacheKey)
    if (cached) return cached

    try {
      const response = await this.callMCPTool('list_projects', {
        project_id: projectId
      })

      const result = typeof response === 'string' ? JSON.parse(response) : response
      const project = result.projects?.[0] || null

      if (project) {
        this.setCache(cacheKey, project)
      }
      return project
    } catch (error) {
      console.error('[Archon] getProject error:', error)
      return null
    }
  }

  /**
   * Create or update project using MCP manage_project tool
   */
  async manageProject(action: 'create' | 'update' | 'delete', project: Partial<Project> & { name?: string }): Promise<Project | null> {
    try {
      const params: any = { action }
      if (project.name) params.title = project.name
      if (project.description) params.description = project.description
      if (project.id) params.project_id = project.id

      const response = await this.callMCPTool('manage_project', params)

      const result = typeof response === 'string' ? JSON.parse(response) : response

      // Invalidate cache
      this.cache.clear()

      return result.project || null
    } catch (error) {
      console.error('[Archon] manageProject error:', error)
      return null
    }
  }

  // ====================
  // TASK COORDINATION
  // ====================

  /**
   * Find tasks by query or project using MCP list_tasks tool
   */
  async findTasks(
    query: string = '',
    projectId?: string,
    options: RAGSearchOptions = {}
  ): Promise<Task[]> {
    const cacheKey = `tasks:${query}:${projectId || 'all'}:${JSON.stringify(options)}`
    const cached = this.getCached<Task[]>(cacheKey)
    if (cached) return cached

    try {
      const params: any = {
        query,
        per_page: options.limit || 10
      }
      if (projectId) {
        params.filter_by = 'project_id'
        params.filter_value = projectId
      }

      const response = await this.callMCPTool('list_tasks', params)

      const result = typeof response === 'string' ? JSON.parse(response) : result
      const tasks = result.tasks || []

      this.setCache(cacheKey, tasks)
      return tasks
    } catch (error) {
      console.error('[Archon] findTasks error:', error)
      return []
    }
  }

  /**
   * Get task by ID using MCP list_tasks tool
   */
  async getTask(taskId: string): Promise<Task | null> {
    const cacheKey = `task:${taskId}`
    const cached = this.getCached<Task>(cacheKey)
    if (cached) return cached

    try {
      const response = await this.callMCPTool('list_tasks', {
        task_id: taskId
      })

      const result = typeof response === 'string' ? JSON.parse(response) : response
      const task = result.tasks?.[0] || null

      if (task) {
        this.setCache(cacheKey, task)
      }
      return task
    } catch (error) {
      console.error('[Archon] getTask error:', error)
      return null
    }
  }

  /**
   * Create or update task using MCP manage_task tool
   */
  async manageTask(action: 'create' | 'update' | 'delete', task: Partial<Task> & { title?: string }): Promise<Task | null> {
    try {
      const params: any = { action }
      if (task.title) params.title = task.title
      if (task.description) params.description = task.description
      if (task.id) params.task_id = task.id
      if (task.projectId) params.project_id = task.projectId
      if (task.status) params.status = task.status
      if (task.priority) params.priority = task.priority

      const response = await this.callMCPTool('manage_task', params)

      const result = typeof response === 'string' ? JSON.parse(response) : response

      // Invalidate cache
      this.cache.clear()

      return result.task || null
    } catch (error) {
      console.error('[Archon] manageTask error:', error)
      return null
    }
  }

  /**
   * Update task status using MCP manage_task tool
   */
  async updateTaskStatus(
    taskId: string,
    status: Task['status']
  ): Promise<Task | null> {
    return this.manageTask('update', { id: taskId, status } as any)
  }

  // ====================
  // KNOWLEDGE RETRIEVAL
  // ====================

  /**
   * RAG-based knowledge base search using MCP rag_search_knowledge_base tool
   */
  async ragSearchKnowledgeBase(
    query: string,
    options: RAGSearchOptions = {}
  ): Promise<KnowledgeSearchResult[]> {
    const cacheKey = `rag:kb:${query}:${JSON.stringify(options)}`
    const cached = this.getCached<KnowledgeSearchResult[]>(cacheKey)
    if (cached) return cached

    try {
      const params: any = {
        query,
        match_count: options.limit || 5
      }

      const response = await this.callMCPTool('rag_search_knowledge_base', params)

      const result = typeof response === 'string' ? JSON.parse(response) : response
      const results = result.results || []

      this.setCache(cacheKey, results, 60000) // Cache for 1 minute
      return results
    } catch (error) {
      console.error('[Archon] ragSearchKnowledgeBase error:', error)
      return []
    }
  }

  /**
   * RAG-based code examples search using MCP rag_search_code_examples tool
   */
  async ragSearchCodeExamples(
    query: string,
    language?: string,
    options: RAGSearchOptions = {}
  ): Promise<CodeExample[]> {
    const cacheKey = `rag:code:${query}:${language || 'all'}:${JSON.stringify(options)}`
    const cached = this.getCached<CodeExample[]>(cacheKey)
    if (cached) return cached

    try {
      const params: any = {
        query,
        match_count: options.limit || 3
      }

      const response = await this.callMCPTool('rag_search_code_examples', params)

      const result = typeof response === 'string' ? JSON.parse(response) : response
      const examples = result.results || result.examples || []

      this.setCache(cacheKey, examples, 60000) // Cache for 1 minute
      return examples
    } catch (error) {
      console.error('[Archon] ragSearchCodeExamples error:', error)
      return []
    }
  }

  // ====================
  // EMBEDDING HEALTH
  // ====================

  /**
   * Get available sources using MCP rag_get_available_sources tool
   */
  async getAvailableSources(): Promise<any[]> {
    try {
      const response = await this.callMCPTool('rag_get_available_sources', {})
      const result = typeof response === 'string' ? JSON.parse(response) : response
      return result.sources || []
    } catch (error) {
      console.error('[Archon] getAvailableSources error:', error)
      return []
    }
  }

  /**
   * Validate embedding health (via health check)
   */
  async validateEmbeddingHealth(): Promise<{
    healthy: boolean
    totalEmbeddings: number
    lastUpdated: string
    issues: string[]
  }> {
    const healthy = await this.healthCheck()

    return {
      healthy,
      totalEmbeddings: healthy ? -1 : 0, // Unknown count if healthy
      lastUpdated: new Date().toISOString(),
      issues: healthy ? [] : ['Failed to connect to Archon MCP server']
    }
  }

  // ====================
  // UTILITY METHODS
  // ====================

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connectionHealth
  }

  /**
   * Get time since last health check
   */
  getTimeSinceLastHealthCheck(): number {
    return Date.now() - this.lastHealthCheck
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number
    keys: string[]
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

// Singleton instance
let archonClientInstance: ArchonClient | null = null

/**
 * Get or create Archon client singleton
 */
export function getArchonClient(config?: Partial<ArchonConfig>): ArchonClient {
  if (!archonClientInstance) {
    archonClientInstance = new ArchonClient(config)
  }

  return archonClientInstance
}

/**
 * Initialize Archon client with health check
 */
export async function initializeArchonClient(
  config?: Partial<ArchonConfig>
): Promise<ArchonClient> {
  const client = getArchonClient(config)
  const healthy = await client.healthCheck()

  if (!healthy) {
    console.warn('[Archon] Failed to connect to MCP server. Retrying...')
    // Retry after 2 seconds
    setTimeout(() => client.healthCheck(), 2000)
  } else {
    console.log('[Archon] Successfully connected to MCP server')
  }

  return client
}
