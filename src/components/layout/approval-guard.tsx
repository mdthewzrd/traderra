'use client'

import { useState, useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { AwaitingApproval } from '@/components/auth/awaiting-approval'

interface MeUser {
  id: string
  email: string | null
  role: string
  status: string
}

/**
 * Global gate: shows the awaiting-approval screen to signed-in users whose
 * status is not 'approved'. Lets unauthenticated users through (so /sign-in
 * renders) and waits for a role/status round-trip before showing the app,
 * preventing any flash of protected content to pending users.
 *
 * Actual data access is still enforced server-side in the API routes; this is
 * the UX layer.
 */
export function ApprovalGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession()
  const isSignedIn = !!session?.user?.id
  const [me, setMe] = useState<MeUser | null>(null)
  const [meLoaded, setMeLoaded] = useState(false)

  useEffect(() => {
    if (!isSignedIn) {
      setMe(null)
      setMeLoaded(true)
      return
    }
    let cancelled = false
    setMeLoaded(false)
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (!cancelled) { setMe(d.user); setMeLoaded(true) } })
      .catch(() => { if (!cancelled) setMeLoaded(true) })
    return () => { cancelled = true }
  }, [isSignedIn])

  // Auth state unresolved
  if (isPending) return <div className="min-h-screen bg-[#0a0a0a]" />
  // Not signed in → render normally (sign-in page, etc.)
  if (!isSignedIn) return <>{children}</>
  // Signed in, resolving role/status
  if (!meLoaded) return <div className="min-h-screen bg-[#0a0a0a]" />
  // Approved → app
  if (me && me.status === 'approved') return <>{children}</>
  // Pending / rejected → gate
  return <AwaitingApproval status={me?.status} email={me?.email} />
}
