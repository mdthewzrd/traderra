'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export type PnLMode = 'gross' | 'net'

interface PnLModeContextType {
  mode: PnLMode
  setMode: (mode: PnLMode) => void
  isGross: boolean
  isNet: boolean
}

const PnLModeContext = createContext<PnLModeContextType | undefined>(undefined)

interface PnLModeProviderProps {
  children: React.ReactNode
}

export function PnLModeProvider({ children }: PnLModeProviderProps) {
  const [mode, setMode] = useState<PnLMode>('gross') // Default to Gross P&L as per requirements

  // Load preference from localStorage on component mount
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('traderra-pnl-mode') as PnLMode
      if (savedMode === 'gross' || savedMode === 'net') {
        setMode(savedMode)
      }
    } catch (error) {
      console.warn('Failed to load P&L mode preference from localStorage:', error)
    }
  }, [])

  // Save preference to localStorage whenever mode changes
  useEffect(() => {
    try {
      localStorage.setItem('traderra-pnl-mode', mode)
    } catch (error) {
      console.warn('Failed to save P&L mode preference to localStorage:', error)
    }
  }, [mode])

  const contextValue: PnLModeContextType = {
    mode,
    setMode,
    isGross: mode === 'gross',
    isNet: mode === 'net'
  }

  
  return (
    <PnLModeContext.Provider value={contextValue}>
      {children}
    </PnLModeContext.Provider>
  )
}

export function usePnLMode() {
  const context = useContext(PnLModeContext)
  if (context === undefined) {
    throw new Error('usePnLMode must be used within a PnLModeProvider')
  }
  return context
}