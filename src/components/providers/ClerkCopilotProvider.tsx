'use client'

import React from 'react'
import { CopilotKit } from '@copilotkit/react-core'

export function ClerkCopilotProvider({
  children,
  runtimeUrl = '/api/copilotkit'
}: {
  children: React.ReactNode
  runtimeUrl?: string
}) {
  return (
    <CopilotKit runtimeUrl={runtimeUrl}>
      {children}
    </CopilotKit>
  )
}

// Stubs for components that import these
export function useUserContext() {
  return { userId: '', isAuthenticated: false, email: '', fullName: '' }
}
export function useCurrentUserId() { return '' }
export function useIsAuthenticated() { return false }
export function useUserDisplayName() { return '' }
