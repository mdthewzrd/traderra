'use client'

import React, { useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-client'
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2, FileInput, Clipboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/contexts/TraderraContext'

// ============================================================================
// Types
// ============================================================================

interface TradeUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete?: (result: UploadResult) => void
}

type BrokerFormat = 'auto' | 'tradervue' | 'das'

interface BrokerOption {
  value: BrokerFormat
  label: string
  description: string
  headers: string[]
}

const BROKER_OPTIONS: BrokerOption[] = [
  {
    value: 'auto',
    label: 'Auto-detect',
    description: 'Automatically detect the broker format from CSV headers',
    headers: []
  },
  {
    value: 'tradervue',
    label: 'Tradervue',
    description: 'Tradervue export with Open/Close Datetime, Symbol, Side, Volume, Entry/Exit Price, P&L',
    headers: ['Open Datetime', 'Close Datetime', 'Symbol', 'Side', 'Volume', 'Entry Price', 'Exit Price', 'Net P&L']
  },
  {
    value: 'das',
    label: 'DAS',
    description: 'DAS Trader export with Date, Time, Symbol, Quantity, Price, Side, Commission, ECNFee',
    headers: ['Date', 'Time', 'Symbol', 'Quantity', 'Price', 'Side', 'Commission', 'ECNFee']
  }
]

export interface UploadResult {
  success: boolean
  message: string
  batchId?: string
  newCount: number
  updatedCount: number
  duplicateCount: number
  errorCount: number
  errors?: string[]
}

interface UploadPreview {
  total_trades: number
  duplicates: number
  new_trades: number
  preview: Array<{
    symbol: string
    side: string
    entry_date: string
    entry_price: number
    pnl?: number
    is_duplicate: boolean
  }>
}

interface UploadState {
  step: 'idle' | 'selecting' | 'previewing' | 'uploading' | 'complete' | 'error'
  file: File | null
  preview: UploadPreview | null
  progress: number
  result: UploadResult | null
  error: string | null
  brokerFormat: BrokerFormat
  detectedFormat?: string
  inputMode: 'file' | 'paste'
  pastedContent: string
}

// ============================================================================
// Component
// ============================================================================

export function TradeUploadModal({ isOpen, onClose, onUploadComplete }: TradeUploadModalProps) {
  const { userId } = useAuth()
  const { isSidebarOpen: aiSidebarOpen } = useChatContext()
  const effectiveUserId = userId || 'default_user'

  const [state, setState] = useState<UploadState>({
    step: 'idle',
    file: null,
    preview: null,
    progress: 0,
    result: null,
    error: null,
    brokerFormat: 'auto',
    inputMode: 'file',
    pastedContent: ''
  })

  const [dragActive, setDragActive] = useState(false)

  const resetState = useCallback(() => {
    setState({
      step: 'idle',
      file: null,
      preview: null,
      progress: 0,
      result: null,
      error: null,
      brokerFormat: 'auto',
      inputMode: 'file',
      pastedContent: ''
    })
    setDragActive(false)
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [resetState, onClose])

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setState(prev => ({ ...prev, error: 'Please select a CSV file' }))
      return
    }

    setState(prev => ({ ...prev, step: 'selecting', file, error: null }))

    try {
      // Generate preview
      const formData = new FormData()
      formData.append('file', file)
      formData.append('user_id', effectiveUserId)
      formData.append('broker_format', state.brokerFormat)

      const response = await fetch('/api/trades/upload/preview', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to generate preview')
      }

      const previewData = await response.json()

      // Extract detected format if available
      const preview: UploadPreview = {
        total_trades: previewData.total_trades,
        duplicates: previewData.duplicates,
        new_trades: previewData.new_trades,
        preview: previewData.preview
      }

      setState(prev => ({
        ...prev,
        step: 'previewing',
        preview,
        detectedFormat: previewData.detected_format || previewData.broker_format
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Failed to process file'
      }))
    }
  }, [effectiveUserId, state.brokerFormat])

  // Handle pasted content preview
  const handlePastePreview = useCallback(async () => {
    if (!state.pastedContent.trim()) {
      setState(prev => ({ ...prev, error: 'Please paste CSV content' }))
      return
    }

    setState(prev => ({ ...prev, step: 'selecting', error: null }))

    try {
      // Create a blob from pasted content
      const blob = new Blob([state.pastedContent], { type: 'text/csv' })
      const file = new File([blob], 'pasted-trades.csv', { type: 'text/csv' })

      // Generate preview
      const formData = new FormData()
      formData.append('file', file)
      formData.append('user_id', effectiveUserId)
      formData.append('broker_format', state.brokerFormat)

      const response = await fetch('/api/trades/upload/preview', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to generate preview')
      }

      const previewData = await response.json()

      // Extract detected format if available
      const preview: UploadPreview = {
        total_trades: previewData.total_trades,
        duplicates: previewData.duplicates,
        new_trades: previewData.new_trades,
        preview: previewData.preview
      }

      setState(prev => ({
        ...prev,
        step: 'previewing',
        file, // Store the blob as file for upload
        preview,
        detectedFormat: previewData.detected_format || previewData.broker_format
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Failed to process pasted content'
      }))
    }
  }, [effectiveUserId, state.pastedContent, state.brokerFormat])

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [handleFileSelect])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }, [handleFileSelect])

  // Handle upload
  const handleUpload = useCallback(async (importIfExists: 'update' | 'skip' | 'error' = 'update') => {
    if (!state.file) return

    setState(prev => ({ ...prev, step: 'uploading', progress: 0 }))

    try {
      const formData = new FormData()
      formData.append('file', state.file)
      formData.append('user_id', effectiveUserId)
      formData.append('import_if_exists', importIfExists)
      formData.append('broker_format', state.brokerFormat)

      // Simulate progress
      const progressInterval = setInterval(() => {
        setState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90)
        }))
      }, 200)

      const response = await fetch('/api/trades/upload', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result: UploadResult = await response.json()

      setState(prev => ({
        ...prev,
        step: 'complete',
        progress: 100,
        result
      }))

      // Dispatch refresh event for other components
      window.dispatchEvent(new CustomEvent('refreshTrades'))

      onUploadComplete?.(result)
    } catch (error) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Upload failed'
      }))
    }
  }, [state.file, effectiveUserId, onUploadComplete])

  // Don't render if not open
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm"
        style={{ top: '64px' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[1001] flex items-center justify-center p-4 pointer-events-none"
        style={{ top: '64px', paddingRight: aiSidebarOpen ? '480px' : '0px' }}
      >
        <div className="pointer-events-auto bg-[#1a1a2e] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-white">Upload Trades</h2>
            <p className="text-sm text-gray-400 mt-1">Import CSV files with automatic broker detection</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {state.step === 'idle' && (
            <UploadZone
              dragActive={dragActive}
              onDrag={handleDrag}
              onDrop={handleDrop}
              onFileInput={handleFileInput}
              brokerFormat={state.brokerFormat}
              onBrokerFormatChange={(format) => setState(prev => ({ ...prev, brokerFormat: format }))}
              inputMode={state.inputMode}
              onInputModeChange={(mode) => setState(prev => ({ ...prev, inputMode: mode }))}
              pastedContent={state.pastedContent}
              onPastedContentChange={(content) => setState(prev => ({ ...prev, pastedContent: content }))}
              onPastePreview={handlePastePreview}
            />
          )}

          {state.step === 'selecting' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-gray-300">Processing file...</p>
            </div>
          )}

          {state.step === 'previewing' && state.preview && (
            <PreviewContent
              preview={state.preview}
              fileName={state.file?.name || ''}
              onUpload={handleUpload}
              onCancel={resetState}
              detectedFormat={state.detectedFormat}
            />
          )}

          {state.step === 'uploading' && (
            <UploadingState progress={state.progress} />
          )}

          {state.step === 'complete' && state.result && (
            <CompleteState
              result={state.result}
              onClose={handleClose}
            />
          )}

          {state.step === 'error' && (
            <ErrorState
              error={state.error || 'Unknown error'}
              onRetry={resetState}
              onClose={handleClose}
            />
          )}
        </div>
      </div>
      </div>
    </>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface UploadZoneProps {
  dragActive: boolean
  onDrag: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void
  brokerFormat: BrokerFormat
  onBrokerFormatChange: (format: BrokerFormat) => void
  inputMode: 'file' | 'paste'
  onInputModeChange: (mode: 'file' | 'paste') => void
  pastedContent: string
  onPastedContentChange: (content: string) => void
  onPastePreview: () => void
}

function UploadZone({
  dragActive,
  onDrag,
  onDrop,
  onFileInput,
  brokerFormat,
  onBrokerFormatChange,
  inputMode,
  onInputModeChange,
  pastedContent,
  onPastedContentChange,
  onPastePreview
}: UploadZoneProps) {
  const selectedBroker = BROKER_OPTIONS.find(opt => opt.value === brokerFormat)

  return (
    <div className="space-y-4">
      {/* Broker Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">Broker Format</label>
        <div className="grid grid-cols-3 gap-2">
          {BROKER_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => onBrokerFormatChange(option.value)}
              className={cn(
                'px-3 py-3 rounded-lg border transition-all text-left',
                brokerFormat === option.value
                  ? 'border-primary bg-primary/20 text-white'
                  : 'border-gray-600 hover:border-gray-500 text-gray-400'
              )}
            >
              <div className="font-medium text-sm mb-1">{option.label}</div>
              {option.value !== 'auto' && (
                <div className="text-xs text-gray-500 truncate">{option.headers.slice(0, 2).join(', ')}</div>
              )}
            </button>
          ))}
        </div>
        {selectedBroker && (
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-400">{selectedBroker.description}</p>
          </div>
        )}
      </div>

      {/* Input Mode Toggle */}
      <div className="flex gap-2 p-1 bg-gray-800 rounded-lg">
        <button
          onClick={() => onInputModeChange('file')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-all',
            inputMode === 'file'
              ? 'bg-primary text-white'
              : 'text-gray-400 hover:text-gray-300'
          )}
        >
          <FileInput className="w-4 h-4" />
          <span className="text-sm font-medium">Upload File</span>
        </button>
        <button
          onClick={() => onInputModeChange('paste')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-all',
            inputMode === 'paste'
              ? 'bg-primary text-white'
              : 'text-gray-400 hover:text-gray-300'
          )}
        >
          <Clipboard className="w-4 h-4" />
          <span className="text-sm font-medium">Paste CSV</span>
        </button>
      </div>

      {/* File Upload Zone */}
      {inputMode === 'file' && (
        <div
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-all',
            dragActive
              ? 'border-primary bg-primary/10'
              : 'border-gray-600 hover:border-gray-500'
          )}
          onDragEnter={onDrag}
          onDragLeave={onDrag}
          onDragOver={onDrag}
          onDrop={onDrop}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-300 mb-2">
            {dragActive ? 'Drop your CSV file here' : `Drag and drop your CSV file`}
          </p>
          <p className="text-gray-500 text-sm mb-4">or</p>
          <label className="inline-block">
            <input
              type="file"
              accept=".csv"
              onChange={onFileInput}
              className="hidden"
            />
            <span className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg cursor-pointer transition-colors">
              Browse Files
            </span>
          </label>
        </div>
      )}

      {/* Paste Zone */}
      {inputMode === 'paste' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Paste CSV Content
            </label>
            <textarea
              value={pastedContent}
              onChange={(e) => onPastedContentChange(e.target.value)}
              placeholder="Paste your CSV data here...&#10;&#10;Example DAS format:&#10;Date,Time,Symbol,Quantity,Price,Side,Commission,ECNFee&#10;2026-01-15,09:30:00,AAPL,100,150.25,B,1.25,0.10&#10;2026-01-15,10:15:00,GOOGL,50,2800.00,S,2.50,0.15"
              className="w-full h-48 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-gray-300 placeholder-gray-500 font-mono text-sm resize-y focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={onPastePreview}
            disabled={!pastedContent.trim()}
            className={cn(
              'w-full px-4 py-3 rounded-lg font-medium transition-colors',
              pastedContent.trim()
                ? 'bg-primary hover:bg-primary/90 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            )}
          >
            Preview Pasted Data
          </button>
        </div>
      )}
    </div>
  )
}

interface PreviewContentProps {
  preview: UploadPreview
  fileName: string
  onUpload: (mode: 'update' | 'skip' | 'error') => void
  onCancel: () => void
  detectedFormat?: string
}

function PreviewContent({ preview, fileName, onUpload, onCancel, detectedFormat }: PreviewContentProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            <span className="text-gray-300">{fileName}</span>
          </div>
          {detectedFormat && (
            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
              {detectedFormat.toUpperCase()} format
            </span>
          )}
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{preview.total_trades}</div>
            <div className="text-xs text-gray-400">Total Trades</div>
          </div>
          <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{preview.new_trades}</div>
            <div className="text-xs text-gray-400">New Trades</div>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{preview.duplicates}</div>
            <div className="text-xs text-gray-400">Duplicates</div>
          </div>
        </div>

        {/* Preview Table */}
        {preview.preview.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Preview (first 10 trades)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-gray-800 rounded-lg overflow-hidden">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-300 font-medium whitespace-nowrap">Symbol</th>
                    <th className="px-4 py-2 text-left text-gray-300 font-medium whitespace-nowrap">Side</th>
                    <th className="px-4 py-2 text-left text-gray-300 font-medium whitespace-nowrap">Date</th>
                    <th className="px-4 py-2 text-right text-gray-300 font-medium whitespace-nowrap">P&L</th>
                    <th className="px-4 py-2 text-center text-gray-300 font-medium whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {preview.preview.map((trade, i) => (
                    <tr key={i} className="hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-2 text-white font-medium whitespace-nowrap">{trade.symbol}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={cn(
                          'inline-block px-2 py-1 rounded text-xs font-medium',
                          trade.side === 'Long' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                        )}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{trade.entry_date}</td>
                      <td className="px-4 py-2 text-right text-gray-300 whitespace-nowrap font-mono">
                        {trade.pnl !== undefined ? `$${trade.pnl.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">
                        {trade.is_duplicate ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-900/30 text-yellow-400">
                            Duplicate
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-900/30 text-green-400">
                            New
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onUpload('update')}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
        >
          Import All
        </button>
      </div>
    </div>
  )
}

function UploadingState({ progress }: { progress: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
      <p className="text-gray-300 mb-2">Uploading trades...</p>
      <div className="w-full max-w-xs bg-gray-700 rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-500 mt-2">{progress}%</p>
    </div>
  )
}

interface CompleteStateProps {
  result: UploadResult
  onClose: () => void
}

function CompleteState({ result, onClose }: CompleteStateProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-6">
        <div className="w-16 h-16 rounded-full bg-green-900/30 flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Upload Complete!</h3>
        <p className="text-gray-400 text-center">{result.message}</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{result.newCount}</div>
          <div className="text-xs text-gray-400">New Trades</div>
        </div>
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">{result.updatedCount}</div>
          <div className="text-xs text-gray-400">Updated Trades</div>
        </div>
      </div>

      {result.duplicateCount > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
          <div className="text-lg font-semibold text-yellow-400">{result.duplicateCount}</div>
          <div className="text-xs text-gray-400">Duplicate Trades (skipped)</div>
        </div>
      )}

      {result.errorCount > 0 && result.errors && result.errors.length > 0 && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">
              {result.errorCount} Error{result.errorCount > 1 ? 's' : ''}
            </span>
          </div>
          <div className="max-h-32 overflow-y-auto">
            {result.errors.slice(0, 10).map((error, i) => (
              <div key={i} className="text-xs text-gray-400 py-1">{error}</div>
            ))}
            {result.errors.length > 10 && (
              <div className="text-xs text-gray-500 py-1">
                ...and {result.errors.length - 10} more
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
      >
        Done
      </button>
    </div>
  )
}

interface ErrorStateProps {
  error: string
  onRetry: () => void
  onClose: () => void
}

function ErrorState({ error, onRetry, onClose }: ErrorStateProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-6">
        <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center mb-4">
          <AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Upload Failed</h3>
        <p className="text-gray-400 text-center">{error}</p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Close
        </button>
        <button
          onClick={onRetry}
          className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
