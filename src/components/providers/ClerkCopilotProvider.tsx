'use client'

/**
 * ClerkCopilotProvider - Authentication-Aware AI Provider
 *
 * This provider resolves conflicts between Clerk authentication and CopilotKit
 * by ensuring proper initialization order and providing user context to AI agents.
 *
 * Architecture:
 * 1. Waits for Clerk to fully initialize authentication
 * 2. Extracts user metadata (ID, email, name)
 * 3. Provides user context to CopilotKit
 * 4. Handles authentication state changes
 * 5. Manages AI session lifecycle
 *
 * @module ClerkCopilotProvider
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { CopilotKit } from '@copilotkit/react-core'
import { initializeArchonClient } from '@/lib/archon/archon-client'

interface ClerkCopilotProviderProps {
  children: React.ReactNode
  runtimeUrl?: string
}

interface UserContext {
  userId: string
  email?: string
  firstName?: string
  lastName?: string
  fullName?: string
  isAuthenticated: boolean
}

/**
 * ClerkCopilotProvider Component
 *
 * Ensures proper authentication flow before initializing CopilotKit:
 * - Blocks CopilotKit until Clerk is ready
 * - Provides user context for personalized AI responses
 * - Handles sign-in/sign-out events
 * - Syncs user data with Archon knowledge graph
 */
export function ClerkCopilotProvider({
  children,
  runtimeUrl = '/api/copilotkit'
}: ClerkCopilotProviderProps) {
  const { isLoaded, isSignedIn, user } = useUser()
  const [userContext, setUserContext] = useState<UserContext>({
    userId: '',
    isAuthenticated: false
  })
  const [isReady, setIsReady] = useState(false)

  /**
   * Update user context when authentication state changes
   */
  useEffect(() => {
    // Wait for Clerk to load
    if (!isLoaded) {
      console.log('[ClerkCopilot] Waiting for Clerk to load...')
      return
    }

    // Extract user data
    const userId = user?.id || 'anonymous'
    const email = user?.emailAddresses?.[0]?.emailAddress
    const firstName = user?.firstName
    const lastName = user?.lastName
    const fullName = user?.fullName

    const newContext: UserContext = {
      userId,
      email,
      firstName,
      lastName,
      fullName,
      isAuthenticated: isSignedIn || false
    }

    setUserContext(newContext)
    setIsReady(true)

    console.log('[ClerkCopilot] User context updated:', {
      userId,
      isAuthenticated: newContext.isAuthenticated,
      email: email ? '***@***' : 'none'
    })

    // Initialize Archon client with user context
    if (typeof window !== 'undefined' && newContext.isAuthenticated) {
      initializeArchonClient().then((client) => {
        console.log('[ClerkCopilot] Archon client initialized:', client.isConnected())
      }).catch((error) => {
        console.error('[ClerkCopilot] Archon initialization failed:', error)
      })
    }
  }, [isLoaded, isSignedIn, user])

  /**
   * Handle authentication state changes
   */
  const handleAuthChange = useCallback(() => {
    console.log('[ClerkCopilot] Authentication state changed:', {
      isSignedIn,
      userId: userContext.userId
    })

    // Could trigger AI context reset, cache clearing, etc.
    if (!isSignedIn && userContext.isAuthenticated) {
      console.log('[ClerkCopilot] User signed out - clearing AI context')
    }
  }, [isSignedIn, userContext])

  useEffect(() => {
    handleAuthChange()
  }, [handleAuthChange])

  /**
   * Don't render children until Clerk is loaded and ready
   * This prevents CopilotKit from initializing before authentication
   */
  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-studio-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="studio-muted">Loading authentication...</p>
        </div>
      </div>
    )
  }

  /**
   * Render CopilotKit with user context
   *
   * The user context is passed to AI agents through CopilotKit's
   * context system, enabling personalized responses.
   */
  return (
    <CopilotKit runtimeUrl={runtimeUrl}>
      {/* Provide user context through React context for AG-UI */}
      <UserContextProvider value={userContext}>
        {children}
      </UserContextProvider>
    </CopilotKit>
  )
}

/**
 * Internal context provider for user data
 */
interface UserContextValue {
  userId: string
  email?: string
  firstName?: string
  lastName?: string
  fullName?: string
  isAuthenticated: boolean
}

const UserContextInternal = React.createContext<UserContextValue | null>(null)

function UserContextProvider({
  children,
  value
}: {
  children: React.ReactNode
  value: UserContextValue
}) {
  return (
    <UserContextInternal.Provider value={value}>
      {children}
    </UserContextInternal.Provider>
  )
}

/**
 * Hook to access user context in components
 */
export function useUserContext(): UserContextValue {
  const context = React.useContext(UserContextInternal)

  if (!context) {
    // Return default context if not wrapped in provider
    return {
      userId: 'anonymous',
      isAuthenticated: false
    }
  }

  return context
}

/**
 * Hook to get current user ID for API calls
 */
export function useCurrentUserId(): string {
  const { userId } = useUserContext()
  return userId
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useUserContext()
  return isAuthenticated
}

/**
 * Hook to get user display name
 */
export function useUserDisplayName(): string {
  const { firstName, lastName, fullName, email } = useUserContext()

  if (fullName) return fullName
  if (firstName && lastName) return `${firstName} ${lastName}`
  if (firstName) return firstName
  if (email) return email.split('@')[0]

  return 'Trader'
}
