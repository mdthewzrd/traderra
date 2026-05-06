'use client'

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react'

// Display mode type definitions
export type DisplayMode = 'dollar' | 'r'

export interface DisplayModeContextType {
  displayMode: DisplayMode
  setDisplayMode: (mode: DisplayMode) => void
  toggleDisplayMode: () => void
  getDisplayModeLabel: (mode?: DisplayMode) => string
}

interface DisplayModeProviderProps {
  children: ReactNode
  defaultMode?: DisplayMode
}

const DisplayModeContext = createContext<DisplayModeContextType | undefined>(undefined)

// Storage key for localStorage persistence
const DISPLAY_MODE_STORAGE_KEY = 'traderra_display_mode'

// Helper function to get stored display mode from localStorage
function getStoredDisplayMode(): DisplayMode {
  if (typeof window === 'undefined') {
    return 'dollar' // Default for SSR
  }

  try {
    const stored = localStorage.getItem(DISPLAY_MODE_STORAGE_KEY)
    if (stored && ['dollar', 'r'].includes(stored)) {
      return stored as DisplayMode
    }
  } catch (error) {
    console.warn('Failed to read display mode from localStorage:', error)
  }

  return 'dollar' // Default fallback
}

// Helper function to store display mode in localStorage
function storeDisplayMode(mode: DisplayMode): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, mode)
  } catch (error) {
    console.warn('Failed to store display mode in localStorage:', error)
  }
}

export function DisplayModeProvider({ children, defaultMode }: DisplayModeProviderProps) {
  // Initialize with default values first, then load from localStorage
  const [displayMode, setDisplayModeState] = useState<DisplayMode>('dollar')
  const [isInitialized, setIsInitialized] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Set mounted state on client-side and register with handshake protocol
  useEffect(() => {
    setIsMounted(true)

    }, [])

  // Load from localStorage on component mount (client-side only)
  useEffect(() => {
    if (isMounted && !isInitialized) {
      const stored = defaultMode || getStoredDisplayMode()
      setDisplayModeState(stored)
      setIsInitialized(true)
    }
  }, [isMounted, isInitialized, defaultMode])

  // Set display mode with localStorage persistence
  const setDisplayMode = useCallback((mode: DisplayMode) => {
    console.log(`🎯 DisplayModeContext: setDisplayMode called with ${mode}`)
    setDisplayModeState(mode)
    storeDisplayMode(mode)
  }, [setDisplayModeState])

  // Toggle through display modes in sequence: $ → R → $ ...
  const toggleDisplayMode = useCallback(() => {
    const modes: DisplayMode[] = ['dollar', 'r']
    const currentIndex = modes.indexOf(displayMode)
    const nextIndex = (currentIndex + 1) % modes.length
    setDisplayMode(modes[nextIndex])
  }, [displayMode, setDisplayMode])

  // Get human-readable label for display mode
  const getDisplayModeLabel = useCallback((mode?: DisplayMode): string => {
    const targetMode = mode || displayMode
    switch (targetMode) {
      case 'dollar':
        return 'Dollar ($)'
      case 'r':
        return 'Risk Multiple (R)'
      default:
        return 'Unknown'
    }
  }, [displayMode])

  const contextValue: DisplayModeContextType = useMemo(() => ({
    displayMode,
    setDisplayMode,
    toggleDisplayMode,
    getDisplayModeLabel,
  }), [
    displayMode,
    setDisplayMode,
    toggleDisplayMode,
    getDisplayModeLabel
  ])

  
  return (
    <DisplayModeContext.Provider value={contextValue}>
      {children}
    </DisplayModeContext.Provider>
  )
}

export function useDisplayMode() {
  const context = useContext(DisplayModeContext)
  if (context === undefined) {
    throw new Error('useDisplayMode must be used within a DisplayModeProvider')
  }
  return context
}

// Export the context for advanced use cases
export { DisplayModeContext }