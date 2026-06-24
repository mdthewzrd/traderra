'use client'

import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:3199',
})

export interface AuthState {
  isSignedIn: boolean
  isLoaded: boolean
  userId: string | null
}

/**
 * Hook that mimics Clerk's useAuth() API but uses better-auth
 *
 * Returns:
 *   - isSignedIn: true if user is authenticated
 *   - isLoaded: true if auth state is loaded
 *   - userId: user ID if authenticated, null otherwise
 *
 * Usage:
 *   const { isSignedIn, isLoaded, userId } = useAuth()
 */
export function useAuth(): AuthState {
  const { data: session, isPending } = authClient.useSession()

  return {
    isSignedIn: !!session?.user?.id,
    isLoaded: !isPending,
    userId: session?.user?.id || null,
  }
}
