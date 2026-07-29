'use client'

import React from 'react'

interface AppLayoutProps {
  children: React.ReactNode
  showPageHeader?: boolean
  pageHeaderContent?: React.ReactNode
  pageClassName?: string
}

/**
 * Main content shell for (main) pages.
 *
 * The unified grouped TopNav is mounted ONCE in the root layout (src/app/layout.tsx)
 * and now shows on every non-landing/auth page, so AppLayout no longer renders its
 * own nav bar or the legacy Traderra sub-nav. Content flows beneath the global nav.
 */
export function AppLayout({
  children,
  showPageHeader = false,
  pageHeaderContent,
  pageClassName = "min-h-screen"
}: AppLayoutProps) {
  return (
    <div className={`${pageClassName} studio-bg`} style={{ direction: 'ltr' }}>
      <div className="flex w-full pt-4" style={{ direction: 'ltr' }}>
        <main
          className="flex-1 overflow-x-hidden"
          style={{ direction: 'ltr' }}
        >
          <div className="w-full overflow-x-hidden pr-6">
            {showPageHeader && pageHeaderContent}
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}