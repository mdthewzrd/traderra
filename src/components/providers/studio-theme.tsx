'use client'

import { ReactNode, useEffect } from 'react'

interface StudioThemeProps {
  children: ReactNode
}

export function StudioTheme({ children }: StudioThemeProps) {
  useEffect(() => {
    // Ensure dark mode is always enabled for Traderra
    document.documentElement.classList.add('dark')

    // Force dark theme for all pages
    document.body.classList.add('dark')

    // Set CSS custom properties for consistent theming (updated for gold accent)
    const root = document.documentElement
    root.style.setProperty('--studio-bg', '#0a0a0a')
    root.style.setProperty('--studio-surface', '#111111')
    root.style.setProperty('--studio-border', '#1a1a1a')
    root.style.setProperty('--studio-text', '#e5e5e5')
    root.style.setProperty('--studio-muted', '#666666')
    root.style.setProperty('--studio-accent', '#d97706') // Gold accent to match primary
    root.style.setProperty('--trading-profit', '#10b981')
    root.style.setProperty('--trading-loss', '#ef4444')
    root.style.setProperty('--trading-neutral', '#6b7280')

    // Ensure body has dark background
    document.body.style.backgroundColor = '#0a0a0a'
    document.body.style.color = '#e5e5e5'
  }, [])

  return <>{children}</>
}