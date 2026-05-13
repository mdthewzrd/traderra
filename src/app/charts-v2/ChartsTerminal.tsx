'use client'

import { useEffect, useRef } from 'react'
import '../../styles/charts-terminal.css'

interface ChartsTerminalProps {
  userId: string
  userName: string
  userImage: string
}

// Phase 1+2: React shell that loads the existing charts app.
// HTML structure + JS are loaded from the static file.
// Future phases will extract pieces into proper React components.
export default function ChartsTerminal({ userId, userName, userImage }: ChartsTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Inject user context
    ;(window as any).__CHARTS_USER = { id: userId, name: userName, image: userImage }

    // Load the charts HTML+JS into the container
    const loadCharts = async () => {
      try {
        const resp = await fetch('/charts-terminal.html')
        const html = await resp.text()
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')

        const container = containerRef.current
        if (!container) return

        // Move body children into our container
        while (doc.body.firstChild) {
          container.appendChild(doc.body.firstChild)
        }

        // Move style into head (if not already there)
        const existingStyles = doc.querySelectorAll('style')
        existingStyles.forEach(style => {
          if (!document.querySelector('style[data-charts-style]')) {
            style.setAttribute('data-charts-style', '1')
            document.head.appendChild(style)
          }
        })

        // Load vault.js
        if (!document.querySelector('script[src="/indicators/vault.js"]')) {
          const vaultScript = document.createElement('script')
          vaultScript.src = '/indicators/vault.js'
          document.body.appendChild(vaultScript)
        }

        // Extract and execute inline scripts in order
        const scripts = container.querySelectorAll('script')
        scripts.forEach(oldScript => {
          const newScript = document.createElement('script')
          if (oldScript.src) {
            newScript.src = oldScript.src
          } else {
            newScript.textContent = oldScript.textContent
          }
          oldScript.parentNode?.replaceChild(newScript, oldScript)
        })

        // Fire user-ready event
        window.dispatchEvent(new CustomEvent('charts-user-ready', {
          detail: (window as any).__CHARTS_USER,
        }))
      } catch (err) {
        console.error('Failed to load charts:', err)
      }
    }

    loadCharts()

    // Cleanup on unmount
    return () => {
      const container = containerRef.current
      if (container) container.innerHTML = ''
    }
  }, [userId, userName, userImage])

  return (
    <div
      ref={containerRef}
      id="charts-root"
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        background: '#0b0d12',
      }}
    />
  )
}
