'use client'

/**
 * CopilotKit Context Integration Hook
 *
 * This hook provides context registration for AI agents without
 * using CopilotKit's useCopilotReadable (which conflicts with Clerk).
 *
 * Instead, it uses a simple registry pattern that stores context
 * in memory and makes it available via getRegisteredContext().
 *
 * @module useCopilotReadableWithContext
 */

export {
  useCopilotReadableWithContext,
  getRegisteredContext,
  getContextRegistryStats,
  clearContextRegistry,
  useCopilotReadableWithContext as useCopilotReadable
} from '@/lib/copilotkit/context-registry'
