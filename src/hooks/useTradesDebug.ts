import { useState, useEffect } from 'react'
import { TraderraTrade } from '@/utils/csv-parser'

export function useTradesDebug() {
  const [trades, setTrades] = useState<TraderraTrade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load trades from debug endpoint
  useEffect(() => {
    loadTrades()
  }, [])

  const loadTrades = async () => {
    try {
      console.log('useTradesDebug: Starting to load trades...')
      setIsLoading(true)
      setError(null)

      console.log('useTradesDebug: Fetching from /api/trades-debug...')
      const response = await fetch('/api/trades-debug')

      console.log('useTradesDebug: Response status:', response.status, response.statusText)

      if (!response.ok) {
        throw new Error(`Failed to load debug trades: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('useTradesDebug: Received data:', data)

      const trades = data.trades || []
      console.log('useTradesDebug: Setting trades:', trades.length, 'items')
      setTrades(trades)
      console.log('useTradesDebug: Trades set successfully')
    } catch (err) {
      console.error('useTradesDebug: Error loading debug trades:', err)
      setError(err instanceof Error ? err.message : 'Failed to load debug trades')
    } finally {
      console.log('useTradesDebug: Setting loading to false')
      setIsLoading(false)
    }
  }

  const saveTrades = async (newTrades: TraderraTrade[]) => {
    try {
      setError(null)
      // In debug mode, just update local state
      setTrades(newTrades)
      return { message: 'Debug mode: trades updated locally' }
    } catch (err) {
      console.error('Error in debug save trades:', err)
      setError(err instanceof Error ? err.message : 'Failed to save debug trades')
      throw err
    }
  }

  const addTrade = async (trade: TraderraTrade) => {
    const updatedTrades = [...trades, trade]
    await saveTrades(updatedTrades)
  }

  return {
    trades,
    isLoading,
    error,
    loadTrades,
    saveTrades,
    addTrade,
  }
}