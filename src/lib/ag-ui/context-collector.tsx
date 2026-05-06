'use client'

import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react'

/**
 * Context for collecting and storing all useCopilotReadable data
 * This allows AG-UI to access the same context that CopilotKit uses
 */

interface CopilotContextData {
  [key: string]: any
}

interface CopilotContextCollectorContextType {
  contextData: CopilotContextData
  registerContext: (id: string, description: string, value: any) => void
  updateContext: (id: string, value: any) => void
  unregisterContext: (id: string) => void
  getFlattenedContext: () => CopilotContextData
}

export const CopilotContextCollectorContext = createContext<CopilotContextCollectorContextType | null>(null)

export function CopilotContextProvider({ children }: { children: ReactNode }) {
  const [contextData, setContextData] = useState<CopilotContextData>({})

  const registerContext = useCallback((id: string, description: string, value: any) => {
    setContextData(prev => ({
      ...prev,
      [id]: { description, value, timestamp: Date.now() }
    }))
  }, [])

  const updateContext = useCallback((id: string, value: any) => {
    setContextData(prev => {
      const existing = prev[id]
      if (!existing) return prev

      return {
        ...prev,
        [id]: { ...existing, value, timestamp: Date.now() }
      }
    })
  }, [])

  const unregisterContext = useCallback((id: string) => {
    setContextData(prev => {
      const newData = { ...prev }
      delete newData[id]
      return newData
    })
  }, [])

  const getFlattenedContext = useCallback((): CopilotContextData => {
    const flattened: CopilotContextData = {}

    Object.entries(contextData).forEach(([key, data]: [string, any]) => {
      flattened[key] = data.value
    })

    return flattened
  }, [contextData])

  return (
    <CopilotContextCollectorContext.Provider
      value={{
        contextData,
        registerContext,
        updateContext,
        unregisterContext,
        getFlattenedContext
      }}
    >
      {children}
    </CopilotContextCollectorContext.Provider>
  )
}

/**
 * Hook to register context data (used by components)
 */
export function useRegisterCopilotContext(id: string, description: string, value: any) {
  const context = useContext(CopilotContextCollectorContext)

  // Store the previous value to detect changes
  const prevValueRef = useRef<any>()
  const isRegisteredRef = useRef(false)

  // Register on mount
  useEffect(() => {
    if (!context || isRegisteredRef.current) return

    context.registerContext(id, description, value)
    isRegisteredRef.current = true

    return () => {
      context.unregisterContext(id)
      isRegisteredRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, id, description])

  // Update when value changes
  useEffect(() => {
    if (!context || !isRegisteredRef.current) return

    // Only update if value actually changed
    if (JSON.stringify(value) !== JSON.stringify(prevValueRef.current)) {
      context.updateContext(id, value)
      prevValueRef.current = value
    }
  }, [context, id, value])
}

/**
 * Hook to access all collected context (used by chat component)
 */
export function useCollectedCopilotContext() {
  const context = useContext(CopilotContextCollectorContext)

  if (!context) {
    return {
      contextData: {},
      getFlattenedContext: () => ({})
    }
  }

  return {
    contextData: context.contextData,
    getFlattenedContext: context.getFlattenedContext
  }
}
