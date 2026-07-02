'use client'
import { useEffect } from 'react'

// globals.css sets html { zoom: 0.9 } for "better UI proportions" on the
// dashboard/journal pages. On this fullscreen h-screen tool page that 0.9
// scale shrinks the 100vh shell to 90% of the viewport, leaving a dark
// (#0a0a0a) band along the bottom. Override zoom to 1 for this route only,
// restoring it when we navigate away so other pages keep their 90% scale.
export default function DatabaseLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.zoom || ''
    html.style.zoom = '1'
    return () => { html.style.zoom = prev }
  }, [])
  return <>{children}</>
}
