'use client'

/**
 * Context Registry for CopilotKit Integration
 *
 * This registry provides a Clerk-compatible alternative to useCopilotReadable
 * that avoids authentication conflicts while maintaining context availability.
 *
 * Architecture:
 * - Simple in-memory registry using Map
 * - Thread-safe registration/retrieval
 * - Automatic cleanup on component unmount
 * - No dependency on CopilotKit's internal state
 */

import { useEffect, useRef } from 'react'
import { snapshotStore } from '../ag-ui/snapshot-store'

export interface ContextRegistration {
  id: string
  description: string
  value: any
  timestamp: number
}

// Global registry store (survives component re-renders)
const contextRegistry = new Map<string, ContextRegistration>()

/**
 * Register context data for AI agent access
 *
 * This hook replaces useCopilotReadable to avoid Clerk conflicts.
 * Context is stored in a simple Map and retrieved by getRegisteredContext().
 *
 * @param props - Context data with description and value
 * @param id - Optional unique identifier (auto-generated if not provided)
 *
 * @example
 * ```tsx
 * useCopilotReadableWithContext({
 *   description: 'Current trades with performance metrics',
 *   value: trades
 * })
 * ```
 */
export function useCopilotReadableWithContext(
  props: { description: string; value: any },
  id?: string
) {
  const registrationId = useRef<string>(
    id || `context-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  )

  useEffect(() => {
    // Register context on mount
    const registration: ContextRegistration = {
      id: registrationId.current,
      description: props.description,
      value: props.value,
      timestamp: Date.now()
    }

    contextRegistry.set(registrationId.current, registration)

    console.log('[Context Registry] Registered context:', {
      id: registrationId.current,
      description: props.description,
      valueType: typeof props.value
    })

    // Cleanup on unmount
    return () => {
      contextRegistry.delete(registrationId.current)
      console.log('[Context Registry] Unregistered context:', registrationId.current)
    }
  }, [props.description, props.value])

  // Update registration when values change
  useEffect(() => {
    const existing = contextRegistry.get(registrationId.current)
    if (existing) {
      existing.value = props.value
      existing.timestamp = Date.now()
      contextRegistry.set(registrationId.current, existing)
    }
  }, [props.value])

  return registrationId.current
}

/**
 * Get all registered context data
 *
 * Returns flattened context object with all registered values.
 * Called by AG-UI chat to collect enhanced context for AI agents.
 *
 * @returns Flattened object with all registered context
 *
 * @example
 * ```typescript
 * const context = getRegisteredContext()
 * // { trades: [...], metrics: {...], journal: [...], snapshots: {...} }
 * ```
 */
export function getRegisteredContext(): Record<string, any> {
  const flattened: Record<string, any> = {}

  contextRegistry.forEach((registration, id) => {
    // Use description as key, sanitized to be object-safe
    const key = registration.description
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    flattened[key] = registration.value
  })

  // Add snapshot information to context
  try {
    const snapshots = snapshotStore.listSummaries()
    flattened.snapshots = {
      available: snapshots.map(s => ({
        id: s.id,
        name: s.name,
        timestamp: s.timestamp,
        date: new Date(s.timestamp).toLocaleString(),
        page: s.page,
        tradeCount: s.tradeCount,
        winRate: s.winRate,
        totalPnL: s.totalPnL
      })),
      count: snapshots.length,
      canCreateMore: snapshotStore.canCreateMore(),
      maxSnapshots: 10
    }

    console.log('[Context Registry] Added snapshot info:', {
      snapshotCount: snapshots.length,
      canCreateMore: snapshotStore.canCreateMore()
    })
  } catch (error) {
    console.error('[Context Registry] Failed to add snapshot info:', error)
    flattened.snapshots = {
      available: [],
      count: 0,
      canCreateMore: true,
      maxSnapshots: 10,
      error: 'Failed to load snapshots'
    }
  }

  // Store context globally for snapshot tool access
  if (typeof window !== 'undefined') {
    ;(window as any).__traderraContext = flattened
  }

  console.log('[Context Registry] Retrieved context:', {
    totalEntries: contextRegistry.size,
    keys: Object.keys(flattened),
    hasSnapshots: flattened.snapshots?.count > 0
  })

  return flattened
}

/**
 * Get context registry statistics (for debugging)
 */
export function getContextRegistryStats() {
  return {
    totalRegistrations: contextRegistry.size,
    entries: Array.from(contextRegistry.values()).map(reg => ({
      id: reg.id,
      description: reg.description,
      valueType: typeof reg.value,
      timestamp: new Date(reg.timestamp).toISOString()
    }))
  }
}

/**
 * Clear all context registrations (for testing/debugging)
 */
export function clearContextRegistry() {
  contextRegistry.clear()
  console.log('[Context Registry] Cleared all registrations')
}

// Re-export with same name for easy import replacement
export { useCopilotReadableWithContext as useCopilotReadable }
