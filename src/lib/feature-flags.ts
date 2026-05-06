/**
 * Feature Flags for Traderra
 *
 * This system allows for safe rollback of features and A/B testing
 */

export interface FeatureFlags {
  // Navigation features
  useVSCodeNavigation: boolean
  enableFolderDragDrop: boolean
  showNavigationAnimations: boolean

  // Journal features
  enhancedJournalMode: boolean
  richTextEditor: boolean
  templateSystem: boolean

  // AI features
  renataIntegration: boolean
  aiSuggestions: boolean

  // Performance features
  virtualizedLists: boolean
  lazyLoading: boolean
}

// Default feature flags - set to safe defaults
const DEFAULT_FLAGS: FeatureFlags = {
  // Navigation - VS Code style is now the default (can be rolled back)
  useVSCodeNavigation: true,
  enableFolderDragDrop: true,
  showNavigationAnimations: true,

  // Journal
  enhancedJournalMode: true,
  richTextEditor: false, // Not implemented yet
  templateSystem: true,

  // AI
  renataIntegration: true,
  aiSuggestions: false, // Not implemented yet

  // Performance
  virtualizedLists: false, // For large datasets
  lazyLoading: true
}

// Environment-based overrides
const getEnvironmentFlags = (): Partial<FeatureFlags> => {
  const env = process.env.NODE_ENV

  if (env === 'development') {
    return {
      // Enable all features in development
      useVSCodeNavigation: true,
      richTextEditor: true,
      aiSuggestions: true,
      virtualizedLists: true
    }
  }

  if (env === 'production') {
    return {
      // Conservative settings for production
      useVSCodeNavigation: true, // Our new implementation
      richTextEditor: false,
      aiSuggestions: false,
      virtualizedLists: false
    }
  }

  return {}
}

// URL parameter overrides for testing
const getURLFlags = (): Partial<FeatureFlags> => {
  if (typeof window === 'undefined') return {}

  const params = new URLSearchParams(window.location.search)
  const flags: Partial<FeatureFlags> = {}

  // Allow URL overrides like ?vscode_nav=false
  if (params.has('vscode_nav')) {
    flags.useVSCodeNavigation = params.get('vscode_nav') === 'true'
  }

  if (params.has('old_nav')) {
    flags.useVSCodeNavigation = false // Force old navigation for testing
  }

  if (params.has('rich_editor')) {
    flags.richTextEditor = params.get('rich_editor') === 'true'
  }

  return flags
}

// Local storage overrides for persistent user preferences
const getStorageFlags = (): Partial<FeatureFlags> => {
  if (typeof window === 'undefined') return {}

  try {
    const stored = localStorage.getItem('traderra_feature_flags')
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

// Main function to get current feature flags
export function getFeatureFlags(): FeatureFlags {
  const envFlags = getEnvironmentFlags()
  const urlFlags = getURLFlags()
  const storageFlags = getStorageFlags()

  return {
    ...DEFAULT_FLAGS,
    ...envFlags,
    ...storageFlags,
    ...urlFlags // URL has highest priority for testing
  }
}

// Helper to check a specific feature flag (non-hook version)
export function getFeatureFlag(flag: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags()
  return flags[flag]
}

// React hook version for components
export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  // This will be implemented as a proper React hook
  const flags = getFeatureFlags()
  return flags[flag]
}

// Helper to update feature flags in localStorage
export function setFeatureFlag(flag: keyof FeatureFlags, value: boolean): void {
  if (typeof window === 'undefined') return

  try {
    const current = getStorageFlags()
    const updated = { ...current, [flag]: value }
    localStorage.setItem('traderra_feature_flags', JSON.stringify(updated))

    // Refresh the page to apply changes
    window.location.reload()
  } catch (error) {
    console.error('Failed to update feature flag:', error)
  }
}

// Emergency rollback function
export function rollbackToClassicNavigation(): void {
  setFeatureFlag('useVSCodeNavigation', false)
  console.warn('🔄 Rolling back to classic navigation')
}

// Helper to get current navigation mode
export function getNavigationMode(): 'vscode' | 'classic' {
  return useFeatureFlag('useVSCodeNavigation') ? 'vscode' : 'classic'
}

// Debug helper to log all flags
export function debugFeatureFlags(): void {
  if (process.env.NODE_ENV !== 'development') return

  const flags = getFeatureFlags()
  console.group('🚩 Traderra Feature Flags')
  Object.entries(flags).forEach(([key, value]) => {
    console.log(`${key}: ${value}`)
  })
  console.groupEnd()
}

// Export for emergency use in browser console
if (typeof window !== 'undefined') {
  (window as any).traderraFeatureFlags = {
    get: getFeatureFlags,
    set: setFeatureFlag,
    rollback: rollbackToClassicNavigation,
    debug: debugFeatureFlags
  }
}