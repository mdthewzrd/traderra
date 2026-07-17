'use client'

import { Loader2 } from 'lucide-react'

/** Full-screen "awaiting approval" gate shown to pending/rejected users. */
export function AwaitingApproval({ status, email }: { status?: string; email?: string | null }) {
  const rejected = status === 'rejected'
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-[#e0e0e0] px-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
          {rejected ? (
            <span className="text-3xl">⛔</span>
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          )}
        </div>
        <h1 className="text-2xl font-bold mb-3">
          {rejected ? 'Access not approved' : 'Awaiting approval'}
        </h1>
        <p className="text-[#9ca3af] mb-1">
          {email ? `Signed in as ${email}` : 'Signed in'}
        </p>
        <p className="text-[#666] text-sm">
          {rejected
            ? 'Your request to join Traderra was not approved. Contact the account owner if you believe this is an error.'
            : 'Your account is awaiting the owner\u2019s approval. You\u2019ll get access once it\u2019s approved. This page will update automatically.'}
        </p>
      </div>
    </div>
  )
}
