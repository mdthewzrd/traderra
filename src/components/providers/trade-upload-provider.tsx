'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { TradeUploadModal, UploadResult } from '@/components/trades/trade-upload-modal'

/**
 * Global Trade Upload Provider
 *
 * Manages the trade upload modal state across the entire application.
 * Handles custom events from Renata AI and other components.
 */

interface TradeUploadProviderProps {
  children: React.ReactNode
  userId?: string
}

export function TradeUploadProvider({ children, userId = 'default_user' }: TradeUploadProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

  // Handle upload completion
  const handleUploadComplete = useCallback((result: UploadResult) => {
    setUploadResult(result)

    // Dispatch event for other components to listen to
    window.dispatchEvent(new CustomEvent('tradeUploadComplete', { detail: result }))

    // Also dispatch refresh event to reload trades
    if (result.success) {
      window.dispatchEvent(new CustomEvent('refreshTrades'))
    }

    // Log completion
    console.log('[TradeUpload] Upload complete:', result)
  }, [])

  // Handle close
  const handleClose = useCallback(() => {
    setIsOpen(false)
    setUploadResult(null)
  }, [])

  // Listen for openTradeUploadModal events
  useEffect(() => {
    const handleOpenEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ confirm?: boolean }>
      console.log('[TradeUpload] Opening modal via event:', customEvent.detail)
      setIsOpen(true)
    }

    window.addEventListener('openTradeUploadModal', handleOpenEvent)

    return () => {
      window.removeEventListener('openTradeUploadModal', handleOpenEvent)
    }
  }, [])

  // Listen for trade upload requests from Renata AI
  useEffect(() => {
    const handleRenataUploadRequest = (e: Event) => {
      const customEvent = e as CustomEvent<{ file?: File; fileName?: string; confirm?: boolean }>
      console.log('[TradeUpload] Renata upload request:', customEvent.detail)
      setIsOpen(true)
    }

    window.addEventListener('renataUploadTrade', handleRenataUploadRequest)

    return () => {
      window.removeEventListener('renataUploadTrade', handleRenataUploadRequest)
    }
  }, [])

  return (
    <>
      {children}
      <TradeUploadModal
        isOpen={isOpen}
        onClose={handleClose}
        onUploadComplete={handleUploadComplete}
        userId={userId}
      />
    </>
  )
}
