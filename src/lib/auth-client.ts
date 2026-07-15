'use client'

import { createAuthClient } from 'better-auth/react'

// Auth is mounted inside Next.js at /api/auth/* (toNextJsHandler).
// Use same-origin so it works via localhost AND tailscale IP — the old
// http://localhost:3199 pointed at a standalone server that was never started.
export const authClient = createAuthClient()

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
