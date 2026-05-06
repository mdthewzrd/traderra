/**
 * Traderra Folder Management API Service
 *
 * TypeScript service layer for folder and content management operations.
 * Provides type-safe API communication with the FastAPI backend.
 */

import { FolderNode } from '@/components/folders/FolderTree'

// API Base Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:6500'
const API_PREFIX = '/api/folders'
const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API !== 'false' // Default to true for development

// Types matching backend Pydantic models
export interface ApiFolder {
  id: string
  name: string
  parent_id?: string
  user_id: string
  icon: string
  color: string
  position: number
  created_at: string
  updated_at: string
}

export interface ApiFolderWithChildren extends ApiFolder {
  children: ApiFolderWithChildren[]
  content_count: number
}

export interface ApiContentItem {
  id: string
  folder_id?: string
  type: 'trade_entry' | 'document' | 'note' | 'strategy' | 'research' | 'review'
  title: string
  content?: Record<string, any>
  metadata: Record<string, any>
  tags: string[]
  user_id: string
  created_at: string
  updated_at: string
}

export interface ApiContentItemWithFolder extends ApiContentItem {
  folder_name?: string
  folder_icon?: string
  folder_color?: string
}

export interface FolderCreateRequest {
  name: string
  parent_id?: string
  icon?: string
  color?: string
  position?: number
  user_id: string
}

export interface FolderUpdateRequest {
  name?: string
  icon?: string
  color?: string
  position?: number
  parent_id?: string
}

export interface FolderMoveRequest {
  new_parent_id?: string
  new_position?: number
}

export interface ContentItemCreateRequest {
  folder_id?: string
  type: ApiContentItem['type']
  title: string
  content?: Record<string, any>
  metadata?: Record<string, any>
  tags?: string[]
  user_id: string
}

export interface ContentItemUpdateRequest {
  title?: string
  content?: Record<string, any>
  metadata?: Record<string, any>
  tags?: string[]
  folder_id?: string
}

export interface FolderTreeResponse {
  folders: ApiFolderWithChildren[]
  total_folders: number
  total_content_items: number
}

export interface ContentItemListResponse {
  items: ApiContentItemWithFolder[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface FolderStatsResponse {
  folder_id: string
  folder_name: string
  content_count: number
  content_types: Record<string, number>
  recent_activity: ApiContentItem[]
  tags: string[]
}

// Error handling
export class FolderApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message)
    this.name = 'FolderApiError'
  }
}

// HTTP client utility
class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const defaultHeaders = {
      'Content-Type': 'application/json',
      // TODO: Add authentication headers when implemented
      // 'Authorization': `Bearer ${getAuthToken()}`
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    }

    try {
      const response = await fetch(url, config)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new FolderApiError(
          errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData
        )
      }

      // Handle empty responses
      if (response.status === 204) {
        return {} as T
      }

      return await response.json()
    } catch (error) {
      if (error instanceof FolderApiError) {
        throw error
      }

      throw new FolderApiError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async get<T>(endpoint: string, params?: URLSearchParams): Promise<T> {
    const url = params ? `${endpoint}?${params.toString()}` : endpoint
    return this.request<T>(url)
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    })
  }
}

// Main API service
class FolderApiService {
  private client: ApiClient

  constructor(baseUrl: string) {
    this.client = new ApiClient(baseUrl)
  }

  // ============================
  // FOLDER OPERATIONS
  // ============================

  /**
   * Create a new folder
   */
  async createFolder(data: FolderCreateRequest): Promise<ApiFolder> {
    return this.client.post<ApiFolder>(`${API_PREFIX}/`, data)
  }

  /**
   * Get list of folders for a user
   */
  async getFolders(
    userId: string,
    parentId?: string,
    includeContentCount = true
  ): Promise<ApiFolder[]> {
    const params = new URLSearchParams({ user_id: userId })
    if (parentId) params.set('parent_id', parentId)
    if (includeContentCount) params.set('include_content_count', 'true')

    return this.client.get<ApiFolder[]>(`${API_PREFIX}/`, params)
  }

  /**
   * Get complete folder tree for a user
   */
  async getFolderTree(userId: string): Promise<FolderTreeResponse> {
    const params = new URLSearchParams({ user_id: userId })
    return this.client.get<FolderTreeResponse>(`${API_PREFIX}/tree`, params)
  }

  /**
   * Get a specific folder
   */
  async getFolder(folderId: string, userId: string): Promise<ApiFolder> {
    const params = new URLSearchParams({ user_id: userId })
    return this.client.get<ApiFolder>(`${API_PREFIX}/${folderId}`, params)
  }

  /**
   * Update a folder
   */
  async updateFolder(
    folderId: string,
    userId: string,
    data: FolderUpdateRequest
  ): Promise<ApiFolder> {
    const params = new URLSearchParams({ user_id: userId })
    return this.client.put<ApiFolder>(
      `${API_PREFIX}/${folderId}?${params.toString()}`,
      data
    )
  }

  /**
   * Move a folder
   */
  async moveFolder(
    folderId: string,
    userId: string,
    data: FolderMoveRequest
  ): Promise<ApiFolder> {
    const params = new URLSearchParams({ user_id: userId })
    return this.client.post<ApiFolder>(
      `${API_PREFIX}/${folderId}/move?${params.toString()}`,
      data
    )
  }

  /**
   * Delete a folder
   */
  async deleteFolder(
    folderId: string,
    userId: string,
    force = false
  ): Promise<{ message: string; folder_id: string }> {
    const params = new URLSearchParams({ user_id: userId })
    if (force) params.set('force', 'true')

    return this.client.delete(`${API_PREFIX}/${folderId}?${params.toString()}`)
  }

  /**
   * Get folder statistics
   */
  async getFolderStats(
    folderId: string,
    userId: string
  ): Promise<FolderStatsResponse> {
    const params = new URLSearchParams({ user_id: userId })
    return this.client.get<FolderStatsResponse>(
      `${API_PREFIX}/${folderId}/stats`,
      params
    )
  }

  // ============================
  // CONTENT OPERATIONS
  // ============================

  /**
   * Create a new content item
   */
  async createContentItem(data: ContentItemCreateRequest): Promise<ApiContentItem> {
    return this.client.post<ApiContentItem>(`${API_PREFIX}/content`, data)
  }

  /**
   * Create a trade entry (specialized content item)
   */
  async createTradeEntry(data: any): Promise<ApiContentItem> {
    return this.client.post<ApiContentItem>(`${API_PREFIX}/content/trade-entry`, data)
  }

  /**
   * Get list of content items with filters
   */
  async getContentItems(
    userId: string,
    options: {
      folderId?: string
      type?: ApiContentItem['type']
      search?: string
      tags?: string[]
      limit?: number
      offset?: number
    } = {}
  ): Promise<ContentItemListResponse> {
    const params = new URLSearchParams({ user_id: userId })

    if (options.folderId) params.set('folder_id', options.folderId)
    if (options.type) params.set('type', options.type)
    if (options.search) params.set('search', options.search)
    if (options.tags) params.set('tags', options.tags.join(','))
    if (options.limit) params.set('limit', options.limit.toString())
    if (options.offset) params.set('offset', options.offset.toString())

    return this.client.get<ContentItemListResponse>(`${API_PREFIX}/content`, params)
  }

  /**
   * Get a specific content item
   */
  async getContentItem(
    contentId: string,
    userId: string
  ): Promise<ApiContentItemWithFolder> {
    const params = new URLSearchParams({ user_id: userId })
    return this.client.get<ApiContentItemWithFolder>(
      `${API_PREFIX}/content/${contentId}`,
      params
    )
  }

  /**
   * Update a content item
   */
  async updateContentItem(
    contentId: string,
    userId: string,
    data: ContentItemUpdateRequest
  ): Promise<ApiContentItem> {
    const params = new URLSearchParams({ user_id: userId })
    return this.client.put<ApiContentItem>(
      `${API_PREFIX}/content/${contentId}?${params.toString()}`,
      data
    )
  }

  /**
   * Move a content item to a different folder
   */
  async moveContentItem(
    contentId: string,
    userId: string,
    folderId?: string
  ): Promise<ApiContentItem> {
    const params = new URLSearchParams({ user_id: userId })
    return this.client.post<ApiContentItem>(
      `${API_PREFIX}/content/${contentId}/move?${params.toString()}`,
      { folder_id: folderId }
    )
  }

  /**
   * Move multiple content items to a folder
   */
  async bulkMoveContentItems(
    contentItemIds: string[],
    userId: string,
    folderId?: string
  ): Promise<{ message: string; moved_count: number; target_folder_id?: string }> {
    const params = new URLSearchParams({ user_id: userId })
    return this.client.post(
      `${API_PREFIX}/content/bulk-move?${params.toString()}`,
      {
        content_item_ids: contentItemIds,
        folder_id: folderId
      }
    )
  }

  /**
   * Delete a content item
   */
  async deleteContentItem(
    contentId: string,
    userId: string
  ): Promise<{ message: string; content_id: string }> {
    const params = new URLSearchParams({ user_id: userId })
    return this.client.delete(`${API_PREFIX}/content/${contentId}?${params.toString()}`)
  }
}

// Utility functions for data transformation
export const folderApiUtils = {
  /**
   * Convert API folder to FolderNode for frontend components
   */
  apiFolderToFolderNode(apiFolder: ApiFolderWithChildren): FolderNode {
    return {
      id: apiFolder.id,
      name: apiFolder.name,
      parentId: apiFolder.parent_id,
      icon: apiFolder.icon,
      color: apiFolder.color,
      position: apiFolder.position,
      children: apiFolder.children.map(child => this.apiFolderToFolderNode(child)),
      contentCount: apiFolder.content_count
    }
  },

  /**
   * Convert FolderTreeResponse to FolderNode array
   */
  folderTreeResponseToNodes(response: FolderTreeResponse): FolderNode[] {
    return response.folders.map(folder => this.apiFolderToFolderNode(folder))
  },

  /**
   * Create folder creation request with defaults
   */
  createFolderRequest(
    name: string,
    userId: string,
    parentId?: string,
    options: Partial<FolderCreateRequest> = {}
  ): FolderCreateRequest {
    return {
      name,
      user_id: userId,
      parent_id: parentId,
      icon: 'folder',
      color: '#FFD700',
      position: 0,
      ...options
    }
  },

  /**
   * Create content item creation request with defaults
   */
  createContentRequest(
    title: string,
    type: ApiContentItem['type'],
    userId: string,
    folderId?: string,
    options: Partial<ContentItemCreateRequest> = {}
  ): ContentItemCreateRequest {
    return {
      title,
      type,
      user_id: userId,
      folder_id: folderId,
      content: {},
      metadata: {},
      tags: [],
      ...options
    }
  }
}

// Mock implementation for development
class MockFolderApiService {
  private mockFolders: ApiFolderWithChildren[] = [
    {
      id: 'folder-1',
      name: 'Trading Journal',
      parent_id: undefined,
      user_id: 'default_user',
      icon: 'journal-text',
      color: '#FFD700',
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      children: [
        {
          id: 'folder-2',
          name: 'Trade Entries',
          parent_id: 'folder-1',
          user_id: 'default_user',
          icon: 'trending-up',
          color: '#10B981',
          position: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          children: [
            {
              id: 'folder-3',
              name: '2024',
              parent_id: 'folder-2',
              user_id: 'default_user',
              icon: 'calendar',
              color: '#10B981',
              position: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              children: [],
              content_count: 4
            }
          ],
          content_count: 4
        },
        {
          id: 'folder-4',
          name: 'Strategies',
          parent_id: 'folder-1',
          user_id: 'default_user',
          icon: 'target',
          color: '#3B82F6',
          position: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          children: [],
          content_count: 1
        },
        {
          id: 'folder-5',
          name: 'Research',
          parent_id: 'folder-1',
          user_id: 'default_user',
          icon: 'search',
          color: '#8B5CF6',
          position: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          children: [],
          content_count: 0
        },
        {
          id: 'folder-6',
          name: 'Goals & Reviews',
          parent_id: 'folder-1',
          user_id: 'default_user',
          icon: 'star',
          color: '#F59E0B',
          position: 4,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          children: [],
          content_count: 1
        }
      ],
      content_count: 0
    }
  ]

  private mockContentItems: ApiContentItemWithFolder[] = [
    // Trade Entries (folder-3: 2024) - 4 items
    {
      id: 'content-1',
      folder_id: 'folder-3',
      type: 'trade_entry',
      title: 'AAPL Long Trade Analysis',
      content: {
        trade_data: {
          symbol: 'AAPL',
          side: 'Long',
          entry_price: 150.50,
          exit_price: 155.25,
          pnl: 475.00,
          rating: 4,
          emotion: 'confident',
          category: 'win',
          setup_analysis: 'Strong breakout above resistance with high volume confirmation.'
        }
      },
      metadata: {},
      tags: ['tech', 'swing-trade'],
      user_id: 'default_user',
      created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      updated_at: new Date(Date.now() - 86400000).toISOString(),
      folder_name: '2024',
      folder_icon: 'calendar',
      folder_color: '#10B981'
    },
    {
      id: 'content-2',
      folder_id: 'folder-3',
      type: 'trade_entry',
      title: 'SPY Scalp Trade',
      content: {
        trade_data: {
          symbol: 'SPY',
          side: 'Long',
          entry_price: 428.15,
          exit_price: 429.80,
          pnl: 165.00,
          rating: 3,
          emotion: 'neutral',
          category: 'win',
          setup_analysis: 'Quick scalp on market open momentum.'
        }
      },
      metadata: {},
      tags: ['etf', 'scalp'],
      user_id: 'default_user',
      created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      updated_at: new Date(Date.now() - 172800000).toISOString(),
      folder_name: '2024',
      folder_icon: 'calendar',
      folder_color: '#10B981'
    },
    {
      id: 'content-3',
      folder_id: 'folder-3',
      type: 'trade_entry',
      title: 'TSLA Momentum Play',
      content: {
        trade_data: {
          symbol: 'TSLA',
          side: 'Long',
          entry_price: 185.20,
          exit_price: 189.45,
          pnl: 255.00,
          rating: 4,
          emotion: 'confident',
          category: 'win',
          setup_analysis: 'Clean breakout on earnings beat with strong volume.'
        }
      },
      metadata: {},
      tags: ['ev', 'momentum'],
      user_id: 'default_user',
      created_at: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
      updated_at: new Date(Date.now() - 259200000).toISOString(),
      folder_name: '2024',
      folder_icon: 'calendar',
      folder_color: '#10B981'
    },
    {
      id: 'content-4',
      folder_id: 'folder-3',
      type: 'trade_entry',
      title: 'NVDA Gap Fill',
      content: {
        trade_data: {
          symbol: 'NVDA',
          side: 'Short',
          entry_price: 892.50,
          exit_price: 885.20,
          pnl: 365.00,
          rating: 5,
          emotion: 'excited',
          category: 'win',
          setup_analysis: 'Perfect gap fill setup with rejection at resistance.'
        }
      },
      metadata: {},
      tags: ['tech', 'gap-fill'],
      user_id: 'default_user',
      created_at: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
      updated_at: new Date(Date.now() - 345600000).toISOString(),
      folder_name: '2024',
      folder_icon: 'calendar',
      folder_color: '#10B981'
    },
    // Strategies (folder-4) - 1 item
    {
      id: 'content-5',
      folder_id: 'folder-4',
      type: 'strategy',
      title: 'Momentum Breakout Strategy',
      content: {
        strategy_data: {
          description: 'High probability momentum plays on clean breakouts',
          rules: [
            'Wait for clean breakout above resistance',
            'Volume must be 2x average',
            'Enter within first 15 minutes',
            'Stop loss at breakout level'
          ],
          win_rate: 68,
          avg_return: 2.4,
          max_drawdown: -1.8
        }
      },
      metadata: {},
      tags: ['momentum', 'breakout'],
      user_id: 'default_user',
      created_at: new Date(Date.now() - 604800000).toISOString(), // 1 week ago
      updated_at: new Date(Date.now() - 604800000).toISOString(),
      folder_name: 'Strategies',
      folder_icon: 'target',
      folder_color: '#3B82F6'
    },
    // Goals & Reviews (folder-6) - 1 item
    {
      id: 'content-6',
      folder_id: 'folder-6',
      type: 'review',
      title: 'Q1 2024 Trading Review',
      content: {
        review_data: {
          period: 'Q1 2024',
          total_trades: 47,
          win_rate: 64,
          total_pnl: 8420,
          best_trade: 1250,
          worst_trade: -380,
          goals_met: ['Increase win rate to 60%', 'Risk management improvement'],
          goals_missed: ['Reach $10k profit target'],
          next_quarter_goals: ['Focus on position sizing', 'Develop scanner for setups']
        }
      },
      metadata: {},
      tags: ['review', 'goals'],
      user_id: 'default_user',
      created_at: new Date(Date.now() - 1209600000).toISOString(), // 2 weeks ago
      updated_at: new Date(Date.now() - 1209600000).toISOString(),
      folder_name: 'Goals & Reviews',
      folder_icon: 'star',
      folder_color: '#F59E0B'
    }
  ]

  private delay(ms: number = 300) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async getFolderTree(userId: string): Promise<FolderTreeResponse> {
    await this.delay()
    return {
      folders: this.mockFolders,
      total_folders: this.mockFolders.length,
      total_content_items: this.mockContentItems.length
    }
  }

  async getContentItems(
    userId: string,
    options: {
      folderId?: string
      type?: ApiContentItem['type']
      search?: string
      tags?: string[]
      limit?: number
      offset?: number
    } = {}
  ): Promise<ContentItemListResponse> {
    await this.delay()

    let filteredItems = this.mockContentItems

    if (options.folderId) {
      filteredItems = filteredItems.filter(item => item.folder_id === options.folderId)
    }

    if (options.type) {
      filteredItems = filteredItems.filter(item => item.type === options.type)
    }

    if (options.search) {
      const searchLower = options.search.toLowerCase()
      filteredItems = filteredItems.filter(item =>
        item.title.toLowerCase().includes(searchLower) ||
        JSON.stringify(item.content).toLowerCase().includes(searchLower)
      )
    }

    const limit = options.limit || 50
    const offset = options.offset || 0
    const paginatedItems = filteredItems.slice(offset, offset + limit)

    return {
      items: paginatedItems,
      total: filteredItems.length,
      limit,
      offset,
      has_more: offset + limit < filteredItems.length
    }
  }

  async createContentItem(data: ContentItemCreateRequest): Promise<ApiContentItem> {
    await this.delay()

    const newItem: ApiContentItem = {
      id: `content-${Date.now()}`,
      folder_id: data.folder_id,
      type: data.type,
      title: data.title,
      content: data.content || {},
      metadata: data.metadata || {},
      tags: data.tags || [],
      user_id: data.user_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    this.mockContentItems.push(newItem as ApiContentItemWithFolder)
    return newItem
  }

  async deleteContentItem(contentId: string, userId: string): Promise<{ message: string; content_id: string }> {
    await this.delay()

    const index = this.mockContentItems.findIndex(item => item.id === contentId)
    if (index > -1) {
      this.mockContentItems.splice(index, 1)
    }

    return {
      message: 'Content item deleted successfully',
      content_id: contentId
    }
  }

  // Stub implementations for other methods
  async createFolder(data: FolderCreateRequest): Promise<ApiFolder> {
    await this.delay()
    throw new Error('Mock: createFolder not implemented')
  }

  async getFolders(userId: string, parentId?: string): Promise<ApiFolder[]> {
    await this.delay()
    throw new Error('Mock: getFolders not implemented')
  }

  async getFolder(folderId: string, userId: string): Promise<ApiFolder> {
    await this.delay()
    throw new Error('Mock: getFolder not implemented')
  }

  async updateFolder(folderId: string, userId: string, data: FolderUpdateRequest): Promise<ApiFolder> {
    await this.delay()
    throw new Error('Mock: updateFolder not implemented')
  }

  async moveFolder(folderId: string, userId: string, data: FolderMoveRequest): Promise<ApiFolder> {
    await this.delay()
    throw new Error('Mock: moveFolder not implemented')
  }

  async deleteFolder(folderId: string, userId: string, force?: boolean): Promise<{ message: string; folder_id: string }> {
    await this.delay()
    throw new Error('Mock: deleteFolder not implemented')
  }

  async getFolderStats(folderId: string, userId: string): Promise<FolderStatsResponse> {
    await this.delay()
    throw new Error('Mock: getFolderStats not implemented')
  }

  async createTradeEntry(data: any): Promise<ApiContentItem> {
    await this.delay()
    throw new Error('Mock: createTradeEntry not implemented')
  }

  async getContentItem(contentId: string, userId: string): Promise<ApiContentItemWithFolder> {
    await this.delay()
    throw new Error('Mock: getContentItem not implemented')
  }

  async updateContentItem(contentId: string, userId: string, data: ContentItemUpdateRequest): Promise<ApiContentItem> {
    await this.delay()
    throw new Error('Mock: updateContentItem not implemented')
  }

  async moveContentItem(contentId: string, userId: string, folderId?: string): Promise<ApiContentItem> {
    await this.delay()
    throw new Error('Mock: moveContentItem not implemented')
  }

  async bulkMoveContentItems(contentItemIds: string[], userId: string, folderId?: string): Promise<{ message: string; moved_count: number; target_folder_id?: string }> {
    await this.delay()
    throw new Error('Mock: bulkMoveContentItems not implemented')
  }
}

// Export singleton instance - use mock in development
export const folderApi = USE_MOCK_API ? new MockFolderApiService() as any : new FolderApiService(API_BASE_URL)

// Export for testing or custom configurations
export { FolderApiService }