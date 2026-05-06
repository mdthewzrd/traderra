'use client'

import React, { useRef, useCallback } from 'react'
import { Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatFileUploadProps {
  onFileSelect: (file: File, fileData: { name: string; content: string }) => void
  disabled?: boolean
}

/**
 * File upload component for chat input
 * Handles CSV file uploads for trade import
 * Reads file as base64 for transmission with chat messages
 * NOTE: Parent component is responsible for showing the file indicator
 */
export function ChatFileUpload({ onFileSelect, disabled = false }: ChatFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Only accept CSV files
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file')
      return
    }

    // Read file as base64
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      const base64Content = dataUrl.split(',')[1] // Remove data URL prefix

      console.log('📎 File processed in ChatFileUpload:', {
        fileName: file.name,
        fileSize: file.size,
        base64Length: base64Content.length
      })

      // Call parent with both file and content
      console.log('📞 Calling onFileSelect with:', { name: file.name, hasContent: !!base64Content })
      onFileSelect(file, {
        name: file.name,
        content: base64Content
      })
    }
    reader.readAsDataURL(file)
  }, [onFileSelect])

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      <button
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'p-2 rounded-md transition-colors',
          'text-studio-muted hover:text-studio-text hover:bg-studio-accent/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        title="Upload CSV file"
      >
        <Paperclip className="w-5 h-5" />
      </button>
    </div>
  )
}
