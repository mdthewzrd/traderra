'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { TraderraTrade } from '@/utils/csv-parser'
import { getMockTrades } from '@/lib/mock-trades'

interface GuestModeContextType {
  isGuestMode: boolean
  setGuestMode: (enabled: boolean) => void
  guestTrades: TraderraTrade[]
  hasGuestData: boolean
}

const GuestModeContext = createContext<GuestModeContextType | undefined>(undefined)

export function GuestModeProvider({ children }: { children: ReactNode }) {
  const [isGuestMode, setIsGuestModeState] = useState(false)
  const [guestTrades, setGuestTrades] = useState<TraderraTrade[]>([])

  // Load guest mode state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('traderra-guest-mode')
    if (stored === 'true') {
      setIsGuestModeState(true)
      setGuestTrades(getMockTrades())
    }
  }, [])

  const setGuestMode = (enabled: boolean) => {
    setIsGuestModeState(enabled)
    localStorage.setItem('traderra-guest-mode', String(enabled))

    if (enabled) {
      const mockData = getMockTrades()
      setGuestTrades(mockData)
    } else {
      setGuestTrades([])
    }
  }

  const value = {
    isGuestMode,
    setGuestMode,
    guestTrades,
    hasGuestData: guestTrades.length > 0,
  }

  return <GuestModeContext.Provider value={value}>{children}</GuestModeContext.Provider>
}

export function useGuestMode() {
  const context = useContext(GuestModeContext)
  if (context === undefined) {
    throw new Error('useGuestMode must be used within a GuestModeProvider')
  }
  return context
}
