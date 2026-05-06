/**
 * AG-UI Component Registry
 *
 * Centralized registry for mapping component IDs to their handlers.
 * This enables the unified component interaction system to work with ANY component in the site.
 */

'use client'

import { useEffect } from 'react'

/**
 * Component handler types
 */
export type ComponentAction = 'click' | 'expand' | 'collapse' | 'open' | 'close' | 'select' | 'activate' | 'toggle'
export type ScrollBehavior = 'smooth' | 'instant' | 'auto'

export interface ComponentHandler {
  activate?: (action: ComponentAction, value?: string) => void
  scroll?: (behavior: ScrollBehavior) => void
  setState?: (state: any, property?: string) => void
}

/**
 * Component Registry
 *
 * Maps component IDs to their handlers.
 * Pages register their components, and the event dispatchers look them up here.
 */
class ComponentRegistry {
  private handlers: Map<string, ComponentHandler> = new Map()

  /**
   * Register a component handler
   */
  register(componentId: string, handler: ComponentHandler) {
    console.log('[ComponentRegistry] Registering:', componentId)
    this.handlers.set(componentId, handler)
  }

  /**
   * Unregister a component handler
   */
  unregister(componentId: string) {
    console.log('[ComponentRegistry] Unregistering:', componentId)
    this.handlers.delete(componentId)
  }

  /**
   * Get a component handler
   */
  get(componentId: string): ComponentHandler | undefined {
    return this.handlers.get(componentId)
  }

  /**
   * Check if a component is registered
   */
  has(componentId: string): boolean {
    return this.handlers.has(componentId)
  }

  /**
   * Get all registered component IDs
   */
  getRegisteredComponents(): string[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * Clear all handlers (useful for testing/cleanup)
   */
  clear() {
    this.handlers.clear()
  }
}

// Singleton instance
export const componentRegistry = new ComponentRegistry()

/**
 * Hook for registering components
 *
 * Usage in a component:
 * ```tsx
 * useComponentRegistry('statistics.tabs.analytics', {
 *   activate: (action) => setActiveTab('analytics'),
 *   scroll: (behavior) => document.getElementById('analytics')?.scrollIntoView({ behavior })
 * })
 * ```
 */
export function useComponentRegistry(componentId: string, handler: ComponentHandler) {
  useEffect(() => {
    componentRegistry.register(componentId, handler)
    return () => {
      componentRegistry.unregister(componentId)
    }
  }, [componentId, handler])
}

/**
 * Initialize global event listeners for component interactions
 *
 * This should be called once in the app root or a high-level component
 */
export function initializeComponentInteractionListeners() {
  if (typeof window === 'undefined') return

  // Listen for activateComponent events
  window.addEventListener('activateComponent', ((event: Event) => {
    const customEvent = event as CustomEvent<{
      component: string
      action?: ComponentAction
      value?: string
    }>

    const { component, action = 'click', value } = customEvent.detail
    console.log('[ComponentRegistry] Activating:', { component, action, value })

    const handler = componentRegistry.get(component)
    if (handler?.activate) {
      handler.activate(action, value)
    } else {
      console.warn('[ComponentRegistry] No handler found for:', component)
    }
  }) as EventListener)

  // Listen for scrollToElement events
  window.addEventListener('scrollToElement', ((event: Event) => {
    const customEvent = event as CustomEvent<{
      element: string
      behavior?: ScrollBehavior
    }>

    const { element, behavior = 'smooth' } = customEvent.detail
    console.log('[ComponentRegistry] Scrolling to:', { element, behavior })

    const handler = componentRegistry.get(element)
    if (handler?.scroll) {
      handler.scroll(behavior)
    } else {
      console.warn('[ComponentRegistry] No scroll handler found for:', element)
    }
  }) as EventListener)

  // Component ID mapping for backward compatibility with Renata agent
  // Maps generic component IDs to page-specific ones
  const componentIdMap: Record<string, string> = {
    // Map trades page filters to statistics page filters when on statistics page
    'trades.filters.symbol': 'statistics.filters.symbol',
    'trades.filters.tags': 'statistics.filters.tags',
    'trades.filters.side': 'statistics.filters.side',
    'trades.filters.duration': 'statistics.filters.duration',
    'trades.filters.show': 'statistics.filters.show',
    'trades.filters.clear': 'statistics.filters.clear',
  }

  // Listen for setComponentState events
  window.addEventListener('setComponentState', ((event: Event) => {
    const customEvent = event as CustomEvent<{
      component: string
      state: any
      property?: string
    }>

    let { component, state, property } = customEvent.detail
    console.log('[ComponentRegistry] Setting state:', { component, state, property })

    // Apply component ID mapping if handler not found
    let mappedComponent = component
    let handler = componentRegistry.get(component)

    if (!handler?.setState && componentIdMap[component]) {
      mappedComponent = componentIdMap[component]
      handler = componentRegistry.get(mappedComponent)
      console.log('[ComponentRegistry] Mapped component ID:', {
        original: component,
        mapped: mappedComponent
      })
    }

    if (handler?.setState) {
      handler.setState(state, property)
    } else {
      console.warn('[ComponentRegistry] No state handler found for:', component, '(tried mapping to:', mappedComponent, ')')
    }
  }) as EventListener)

  console.log('[ComponentRegistry] Global listeners initialized')
}
