'use client'

import { useEffect, useRef } from 'react'

interface ChartsShellProps {
  userId: string
  userName: string
  userImage: string
}

/**
 * Phase 0 scaffold: Renders the existing charts-terminal.html inside an iframe.
 * This gives us server-side auth gating immediately while we incrementally
 * extract pieces into React components.
 *
 * Future phases will replace this iframe with real React components.
 */
export function ChartsShell({ userId, userName, userImage }: ChartsShellProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument
        if (!doc) return

        // Inject user context into the charts app
        const script = doc.createElement('script')
        script.textContent = `
          window.__CHARTS_USER = {
            id: ${JSON.stringify(userId)},
            name: ${JSON.stringify(userName)},
            image: ${JSON.stringify(userImage)}
          };
          // Fire a custom event so the charts app knows auth context is ready
          window.dispatchEvent(new CustomEvent('charts-user-ready', { detail: window.__CHARTS_USER }));
        `
        doc.head.appendChild(script)
      } catch (e) {
        // Cross-origin or not loaded yet — ignore
      }
    }

    iframe.addEventListener('load', handleLoad)
    return () => iframe.removeEventListener('load', handleLoad)
  }, [userId, userName, userImage])

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        src="/charts-terminal.html"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        title="Traderra Charts"
      />
    </div>
  )
}
