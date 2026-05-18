'use client'

import { useEffect } from 'react'

/**
 * Error boundary for charts — catches client-side errors and displays
 * the stack trace instead of the generic "Application error" page.
 */
export default function ChartsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ChartsError]', error)
  }, [error])

  return (
    <div style={{ padding: 40, color: '#ef5350', fontFamily: 'monospace', fontSize: 13, background: '#0a0c12', minHeight: '100vh' }}>
      <h2 style={{ color: '#f59e0b' }}>Charts Error</h2>
      <pre style={{ whiteSpace: 'pre-wrap', color: '#ef5350', background: '#111620', padding: 16, borderRadius: 8, overflow: 'auto' }}>
        {error.message}
      </pre>
      {error.stack && (
        <pre style={{ whiteSpace: 'pre-wrap', color: '#8aa0c0', background: '#0d1220', padding: 16, borderRadius: 8, marginTop: 12, fontSize: 11 }}>
          {error.stack}
        </pre>
      )}
      {error.digest && <p style={{ color: '#4a6080', marginTop: 12 }}>Digest: {error.digest}</p>}
      <button onClick={reset} style={{ marginTop: 20, padding: '8px 16px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: 4, fontWeight: 700, cursor: 'pointer' }}>
        Retry
      </button>
    </div>
  )
}
