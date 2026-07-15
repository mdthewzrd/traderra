'use client'

import React from 'react'
import { TopNavigation } from './top-nav'
import { useChatContext } from '@/contexts/TraderraContext'

interface AppLayoutProps {
  children: React.ReactNode
  showPageHeader?: boolean
  pageHeaderContent?: React.ReactNode
  pageClassName?: string
}

export function AppLayout({
  children,
  showPageHeader = false,
  pageHeaderContent,
  pageClassName = "min-h-screen"
}: AppLayoutProps) {
  const { isSidebarOpen: aiSidebarOpen, setIsSidebarOpen: setAiSidebarOpen } = useChatContext()

  return (
    <div className={`${pageClassName} studio-bg`} style={{ direction: 'ltr' }}>
      {/* Top Navigation - Always extends to right edge, above Renata */}
      <div className="fixed top-0 left-0 right-0 z-50 transition-all duration-300" style={{ direction: 'ltr' }}>
        <div className="w-full">
          <TopNavigation onAiToggle={() => setAiSidebarOpen(!aiSidebarOpen)} aiOpen={aiSidebarOpen} />
        </div>
      </div>

      {/* Optional Page Header - Adjusts for sidebar */}
      {showPageHeader && (
        <div className={`fixed top-16 left-0 right-0 z-40 transition-all duration-300 studio-surface border-b border-[#1a1a1a]`} style={{ direction: 'ltr' }}>
          <div className="w-full overflow-x-auto">
            {pageHeaderContent}
          </div>
        </div>
      )}

      {/* Main content container with sidebar */}
      <div className={`flex w-full ${showPageHeader ? 'pt-36' : 'pt-16'}`} style={{ direction: 'ltr' }}>
        {/* Page Content */}
        <main
          className="flex-1 overflow-x-hidden"
          style={{ direction: 'ltr' }}
        >
          <div className="w-full pr-6 overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}