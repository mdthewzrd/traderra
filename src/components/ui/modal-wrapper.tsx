'use client'

import { ReactNode, useEffect } from 'react'
import { useChatContext } from '@/contexts/TraderraContext'

interface ModalWrapperProps {
  children: ReactNode
  isOpen: boolean
  onClose: () => void
}

/**
 * Wrapper for modals that:
 * 1. Positions modals within the dashboard content area (not over top nav)
 * 2. Accounts for AI sidebar when open
 * 3. Provides proper backdrop blur for dashboard content only
 */
export function ModalWrapper({ children, isOpen, onClose }: ModalWrapperProps) {
  const { isSidebarOpen: aiSidebarOpen } = useChatContext()

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop - positioned below top nav, covers main content only */}
      <div
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
        style={{
          top: '64px' // Below top nav (4rem = 64px)
        }}
        onClick={onClose}
      />

      {/* Modal Container - centered within dashboard area */}
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
        style={{
          top: '64px', // Below top nav
          paddingRight: '0px' // Sidebar removed — always 0
        }}
      >
        <div className="pointer-events-auto">
          {children}
        </div>
      </div>
    </>
  )
}
