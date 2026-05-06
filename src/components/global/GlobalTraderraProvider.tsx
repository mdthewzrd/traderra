'use client'

import { React, createContext, useContext, useEffect, ReactNode } from 'react'
import { useTraderraGlobalBridge } from './global-traderra-bridge'

interface GlobalTraderraContextType {
  executeAction: (action: any) => void
  executeCommands: (commands: any) => void
  executeRenataResponse: (response: any) => void
}

const GlobalTraderraContext = createContext<GlobalTraderraContextType | undefined>(undefined)

interface GlobalTraderraProviderProps {
  children: ReactNode
}

export const GlobalTraderraProvider: React.FC<GlobalTraderraProviderProps> = ({ children }) => {
  const bridge = useTraderraGlobalBridge()

  // Set up global access for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.executeTraderraAction = bridge.executeAction
      window.executeTraderraCommands = bridge.executeCommands
    }
  }, [bridge])

  const value = {
    executeAction: bridge.executeAction,
    executeCommands: bridge.executeCommands,
    executeRenataResponse: bridge.executeRenataResponse
  }

  return (
    <GlobalTraderraContext.Provider value={value}>
      {children}
    </GlobalTraderraContext.Provider>
  )
}

export const useGlobalTraderra = (): GlobalTraderraContextType => {
  const context = useContext(GlobalTraderraContext)
  if (context === undefined) {
    throw new Error('useGlobalTraderra must be used within a GlobalTraderraProvider')
  }
  return context
}