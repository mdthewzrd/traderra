/**
 * Snapshot Store - localStorage-based snapshot management
 *
 * Manages page state snapshots with automatic size limits and persistence.
 * Max 10 snapshots to prevent localStorage overflow.
 */

import type {
  PageSnapshot,
  SnapshotCollection,
  SnapshotSummary,
  SnapshotFilters,
  SnapshotStatistics
} from './snapshot-types'

const STORAGE_KEY = 'traderra_snapshots'
const MAX_SNAPSHOTS = 10

/**
 * Generate a unique snapshot ID using timestamp + random
 */
function generateSnapshotId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 9)
  return `snap_${timestamp}_${random}`
}

/**
 * Snapshot Store class for managing page state snapshots
 */
class SnapshotStore {
  private cache: PageSnapshot[] | null = null

  /**
   * Load all snapshots from localStorage
   */
  private loadFromStorage(): PageSnapshot[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []

      const collection: SnapshotCollection = JSON.parse(raw)

      // Validate collection structure
      if (!collection || !Array.isArray(collection.snapshots)) {
        console.warn('[SnapshotStore] Invalid collection format, resetting')
        return []
      }

      return collection.snapshots
    } catch (error) {
      console.error('[SnapshotStore] Failed to load from storage:', error)
      return []
    }
  }

  /**
   * Save snapshots to localStorage
   */
  private saveToStorage(snapshots: PageSnapshot[]): void {
    try {
      const collection: SnapshotCollection = {
        snapshots,
        lastUpdated: Date.now()
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collection))
      this.cache = snapshots
    } catch (error) {
      // Handle quota exceeded error
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.error('[SnapshotStore] Storage quota exceeded, removing oldest snapshot')
        // Remove oldest snapshot and retry
        if (snapshots.length > 1) {
          this.saveToStorage(snapshots.slice(1))
        } else {
          console.error('[SnapshotStore] Cannot save snapshots - storage full')
        }
      } else {
        console.error('[SnapshotStore] Failed to save to storage:', error)
      }
    }
  }

  /**
   * Get all snapshots (with caching)
   */
  list(): PageSnapshot[] {
    if (this.cache === null) {
      this.cache = this.loadFromStorage()
    }
    return [...this.cache] // Return copy to prevent mutation
  }

  /**
   * Get snapshot summaries (lighter weight for display)
   */
  listSummaries(): SnapshotSummary[] {
    return this.list().map(s => ({
      id: s.id,
      name: s.name,
      timestamp: s.timestamp,
      page: s.page,
      tradeCount: s.statistics.totalTrades || 0,
      winRate: s.statistics.winRate || 0,
      totalPnL: s.statistics.totalGainLoss || 0
    }))
  }

  /**
   * Get a snapshot by ID
   */
  get(id: string): PageSnapshot | null {
    const snapshots = this.list()
    return snapshots.find(s => s.id === id) || null
  }

  /**
   * Get a snapshot by name or ID
   */
  getByNameOrId(nameOrId: string): PageSnapshot | null {
    const snapshots = this.list()
    return snapshots.find(s => s.id === nameOrId || s.name === nameOrId) || null
  }

  /**
   * Save a new snapshot
   * Enforces max limit by removing oldest snapshots if needed
   */
  save(snapshot: PageSnapshot): void {
    const snapshots = this.list()

    // Check for duplicate names
    const existingIndex = snapshots.findIndex(s => s.name === snapshot.name)
    if (existingIndex !== -1) {
      // Replace existing snapshot with same name
      snapshots[existingIndex] = snapshot
      console.log(`[SnapshotStore] Replacing existing snapshot: ${snapshot.name}`)
    } else {
      // Add new snapshot
      snapshots.unshift(snapshot) // Add to beginning (newest first)
    }

    // Enforce max limit
    if (snapshots.length > MAX_SNAPSHOTS) {
      const removed = snapshots.splice(MAX_SNAPSHOTS)
      console.log(`[SnapshotStore] Removed ${removed.length} old snapshot(s) to maintain limit of ${MAX_SNAPSHOTS}`)
    }

    this.saveToStorage(snapshots)
  }

  /**
   * Delete a snapshot by ID
   */
  delete(id: string): boolean {
    const snapshots = this.list()
    const index = snapshots.findIndex(s => s.id === id)

    if (index === -1) {
      console.warn(`[SnapshotStore] Snapshot not found: ${id}`)
      return false
    }

    const removed = snapshots.splice(index, 1)[0]
    this.saveToStorage(snapshots)
    console.log(`[SnapshotStore] Deleted snapshot: ${removed.name}`)
    return true
  }

  /**
   * Delete a snapshot by name or ID
   */
  deleteByNameOrId(nameOrId: string): boolean {
    const snapshot = this.getByNameOrId(nameOrId)
    if (!snapshot) {
      console.warn(`[SnapshotStore] Snapshot not found: ${nameOrId}`)
      return false
    }
    return this.delete(snapshot.id)
  }

  /**
   * Clear all snapshots
   */
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY)
    this.cache = []
    console.log('[SnapshotStore] All snapshots cleared')
  }

  /**
   * Get count of snapshots
   */
  count(): number {
    return this.list().length
  }

  /**
   * Check if more snapshots can be created
   */
  canCreateMore(): boolean {
    return this.count() < MAX_SNAPSHOTS
  }
}

// Export singleton instance
export const snapshotStore = new SnapshotStore()

/**
 * Helper function to create a snapshot from current page context
 */
export function createSnapshotFromContext(
  name: string,
  page: 'dashboard' | 'statistics',
  context: any,
  tradeIds: string[] = []
): PageSnapshot {
  return {
    id: generateSnapshotId(),
    name,
    timestamp: Date.now(),
    page,
    filters: {
      dateRange: context.dateRange || localStorage.getItem('dateRange') || 'all',
      symbol: context.symbolFilter || null,
      side: context.sideFilter || null,
      duration: context.durationFilter || null,
      strategy: context.strategyFilter || null,
      displayMode: context.displayMode || localStorage.getItem('displayMode') || 'dollar',
      pnlMode: context.pnlMode || localStorage.getItem('pnlMode') || 'net'
    },
    statistics: {
      totalTrades: context.totalTrades || 0,
      winningTrades: context.winningTrades || 0,
      losingTrades: context.losingTrades || 0,
      winRate: context.winRate || 0,
      totalGainLoss: context.totalGainLoss || 0,
      totalRMultiple: context.totalRMultiple || 0,
      profitFactor: context.profitFactor || 0,
      expectancy: context.expectancy || 0,
      expectancyR: context.expectancyR || 0,
      avgWin: context.avgWin || 0,
      avgWinR: context.avgWinR || 0,
      avgLoss: context.avgLoss || 0,
      avgLossR: context.avgLossR || 0,
      largestWin: context.largestWin || 0,
      largestWinR: context.largestWinR || 0,
      largestLoss: context.largestLoss || 0,
      largestLossR: context.largestLossR || 0,
      maxDrawdown: context.maxDrawdown || 0,
      maxDrawdownR: context.maxDrawdownR || 0,
      sharpeRatio: context.sharpeRatio,
      kellyPercentage: context.kellyPercentage,
      kRatio: context.kRatio,
      systemQualityNumber: context.systemQualityNumber,
      maxConsecutiveWins: context.maxConsecutiveWins,
      maxConsecutiveLosses: context.maxConsecutiveLosses,
      avgHoldTimeWinner: context.avgHoldTimeWinner,
      avgHoldTimeLoser: context.avgHoldTimeLoser,
      totalCommissions: context.totalCommissions,
      totalFees: context.totalFees
    },
    tradeIds
  }
}
