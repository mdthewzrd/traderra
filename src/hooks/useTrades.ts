import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { TraderraTrade } from '@/utils/csv-parser'
import { useGuestMode } from '@/contexts/GuestModeContext'

export function useTrades() {
  const [trades, setTrades] = useState<TraderraTrade[] | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isLoaded, isSignedIn } = useUser()
  const { isGuestMode, guestTrades, hasGuestData, setGuestMode } = useGuestMode()

  // PERFORMANCE: Use ref to prevent duplicate API calls on mount
  const hasLoadedRef = useRef(false)
  // PERFORMANCE: Cache the last fetched data to prevent unnecessary re-fetches
  const lastFetchTimeRef = useRef<number>(0)
  const CACHE_DURATION = 60000 // 60 seconds cache

  // Disable guest mode when user signs in with Clerk
  useEffect(() => {
    if (isSignedIn && isGuestMode) {
      console.log('[useTrades] User signed in, disabling guest mode')
      setGuestMode(false)
      localStorage.removeItem('traderra-guest-mode')
    }
  }, [isSignedIn, isGuestMode, setGuestMode])

  // PERFORMANCE: Memoize loadTrades with useCallback to prevent re-creation
  const loadTrades = useCallback(async () => {
    // PERFORMANCE: Check cache before making API call
    const now = Date.now()
    if (lastFetchTimeRef.current && now - lastFetchTimeRef.current < CACHE_DURATION && trades) {
      console.log('[useTrades] Using cached data, skipping API call')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/trades')

      if (!response.ok) {
        throw new Error('Failed to load trades')
      }

      const data = await response.json()
      setTrades(data.trades || [])

      // PERFORMANCE: Update cache timestamp
      lastFetchTimeRef.current = now
    } catch (err) {
      console.error('Error loading trades:', err)
      setError(err instanceof Error ? err.message : 'Failed to load trades')
    } finally {
      setIsLoading(false)
    }
  }, [trades]) // Include trades dependency for cache checking

  // Load trades when user is authenticated or in guest mode
  useEffect(() => {
    // PERFORMANCE: Prevent duplicate calls on mount
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true

    // Prioritize authenticated user data over guest mode
    if (isSignedIn) {
      // Authenticated user: load from API (ignore guest mode)
      loadTrades()
    } else if (isGuestMode && hasGuestData) {
      // Guest mode: use mock data
      setTrades(guestTrades)
      setIsLoading(false)
      setError(null)
    } else if (isLoaded && !isSignedIn && !isGuestMode) {
      // Not authenticated and not in guest mode: show empty state
      setTrades([])
      setIsLoading(false)
    }
  }, [isLoaded, isSignedIn, isGuestMode, hasGuestData, guestTrades, loadTrades])

  // Listen for refresh events (e.g., after trade upload)
  useEffect(() => {
    const handleRefresh = () => {
      console.log('[useTrades] Refreshing trades...')
      // PERFORMANCE: Bypass cache when explicitly refreshing
      lastFetchTimeRef.current = 0
      loadTrades()
    }

    window.addEventListener('refreshTrades', handleRefresh)

    return () => {
      window.removeEventListener('refreshTrades', handleRefresh)
    }
  }, [loadTrades])

  const saveTrades = async (newTrades: TraderraTrade[]) => {
    try {
      setError(null)

      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trades: newTrades }),
      })

      if (!response.ok) {
        throw new Error('Failed to save trades')
      }

      const data = await response.json()

      // Update local state
      setTrades(newTrades)

      return data
    } catch (err) {
      console.error('Error saving trades:', err)
      setError(err instanceof Error ? err.message : 'Failed to save trades')
      throw err
    }
  }

  // PERFORMANCE: Memoize addTrade with useCallback to prevent re-creation
  const addTrade = useCallback(async (trade: TraderraTrade) => {
    const updatedTrades = [...(trades || []), trade]
    await saveTrades(updatedTrades)
  }, [trades]) // Include trades dependency

  // PERFORMANCE: Memoize deleteTrade with useCallback to prevent re-creation
  const deleteTrade = useCallback(async (tradeId: string) => {
    try {
      const response = await fetch(`/api/trades/${tradeId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete trade')
      }

      // Remove the deleted trade from local state
      setTrades((trades || []).filter(t => t.id !== tradeId))
    } catch (err) {
      console.error('Error deleting trade:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete trade')
      throw err
    }
  }, []) // No dependencies needed as we use functional state update

  return {
    trades: trades || [], // Always return array, never undefined
    isLoading,
    error,
    loadTrades,
    saveTrades,
    addTrade,
    deleteTrade,
  }
}