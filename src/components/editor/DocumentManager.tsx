'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { JSONContent } from '@tiptap/react'
import {
  Save,
  Download,
  Upload,
  Share2,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Folder,
  Tag,
  Calendar,
  User,
  Settings,
  Copy,
  Trash2,
  Archive,
  Star,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Document } from './RichTextEditor'
import { toast } from 'sonner'

export interface DocumentManagerProps {
  document: Document
  onDocumentChange: (document: Document) => void
  onSave?: (document: Document) => Promise<void>
  onExport?: (document: Document, format: 'pdf' | 'markdown' | 'json') => void
  onShare?: (document: Document) => void
  onDelete?: (documentId: string) => void
  autoSave?: boolean
  autoSaveInterval?: number
  className?: string
}

interface SaveStatus {
  status: 'saved' | 'saving' | 'error' | 'unsaved'
  lastSaved?: Date
  error?: string
}

export function DocumentManager({
  document,
  onDocumentChange,
  onSave,
  onExport,
  onShare,
  onDelete,
  autoSave = true,
  autoSaveInterval = 30000, // 30 seconds
  className,
}: DocumentManagerProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ status: 'saved' })
  const [isExporting, setIsExporting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [localDocument, setLocalDocument] = useState<Document>(document)

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>()
  const saveInProgressRef = useRef(false)

  // Update local document when prop changes
  useEffect(() => {
    setLocalDocument(document)
  }, [document])

  // Auto-save functionality
  const performSave = useCallback(async (docToSave: Document) => {
    if (saveInProgressRef.current || !onSave) return

    try {
      saveInProgressRef.current = true
      setSaveStatus({ status: 'saving' })

      await onSave(docToSave)

      setSaveStatus({
        status: 'saved',
        lastSaved: new Date(),
      })

      toast.success('Document saved successfully')
    } catch (error) {
      console.error('Save failed:', error)
      setSaveStatus({
        status: 'error',
        error: error instanceof Error ? error.message : 'Save failed',
      })

      toast.error('Failed to save document')
    } finally {
      saveInProgressRef.current = false
    }
  }, [onSave])

  // Handle document content changes
  const handleDocumentChange = useCallback((updatedDocument: Document) => {
    setLocalDocument(updatedDocument)
    onDocumentChange(updatedDocument)

    // Mark as unsaved
    setSaveStatus({ status: 'unsaved' })

    // Set up auto-save
    if (autoSave) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }

      autoSaveTimeoutRef.current = setTimeout(() => {
        performSave(updatedDocument)
      }, autoSaveInterval)
    }
  }, [onDocumentChange, autoSave, autoSaveInterval, performSave])

  // Manual save
  const handleManualSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    performSave(localDocument)
  }, [localDocument, performSave])

  // Export functionality
  const handleExport = useCallback(async (format: 'pdf' | 'markdown' | 'json') => {
    if (!onExport) return

    setIsExporting(true)
    try {
      await onExport(localDocument, format)
      toast.success(`Document exported as ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export document')
    } finally {
      setIsExporting(false)
    }
  }, [localDocument, onExport])

  // Document metadata update
  const updateMetadata = useCallback((updates: Partial<Document['metadata']>) => {
    const updatedDocument: Document = {
      ...localDocument,
      metadata: {
        ...localDocument.metadata,
        ...updates,
        lastModified: new Date().toISOString(),
      }
    }
    handleDocumentChange(updatedDocument)
  }, [localDocument, handleDocumentChange])

  // Update document title
  const updateTitle = useCallback((title: string) => {
    const updatedDocument: Document = {
      ...localDocument,
      title,
      metadata: {
        ...localDocument.metadata,
        lastModified: new Date().toISOString(),
      }
    }
    handleDocumentChange(updatedDocument)
  }, [localDocument, handleDocumentChange])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleManualSave()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleManualSave])

  // Get save status display
  const getSaveStatusDisplay = () => {
    switch (saveStatus.status) {
      case 'saved':
        return {
          icon: CheckCircle,
          text: saveStatus.lastSaved
            ? `Saved at ${saveStatus.lastSaved.toLocaleTimeString()}`
            : 'Saved',
          className: 'text-green-500',
        }
      case 'saving':
        return {
          icon: Clock,
          text: 'Saving...',
          className: 'text-yellow-500 animate-pulse',
        }
      case 'error':
        return {
          icon: AlertCircle,
          text: saveStatus.error || 'Save failed',
          className: 'text-red-500',
        }
      case 'unsaved':
        return {
          icon: Clock,
          text: 'Unsaved changes',
          className: 'text-yellow-500',
        }
      default:
        return {
          icon: Clock,
          text: 'Unknown status',
          className: 'text-gray-500',
        }
    }
  }

  const statusDisplay = getSaveStatusDisplay()
  const StatusIcon = statusDisplay.icon

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Document Header */}
      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={localDocument.title}
            onChange={(e) => updateTitle(e.target.value)}
            className="text-2xl font-bold bg-transparent border-none outline-none w-full truncate focus:ring-2 focus:ring-ring rounded px-2 py-1"
            placeholder="Untitled Document"
          />

          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span>{localDocument.type.replace('_', ' ')}</span>
            </div>

            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{new Date(localDocument.metadata.lastModified).toLocaleDateString()}</span>
            </div>

            <div className="flex items-center gap-1">
              <span>{localDocument.metadata.wordCount} words</span>
              <span>•</span>
              <span>{localDocument.metadata.readTime} min read</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-4">
          {/* Save Status */}
          <div className={cn('flex items-center gap-2 text-sm', statusDisplay.className)}>
            <StatusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{statusDisplay.text}</span>
          </div>

          {/* Manual Save Button */}
          <button
            onClick={handleManualSave}
            disabled={saveStatus.status === 'saving' || saveStatus.status === 'saved'}
            className="p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
            title="Save document (Ctrl+S)"
          >
            <Save className="w-4 h-4" />
          </button>

          {/* Export Menu */}
          <div className="relative group">
            <button
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              title="Export document"
            >
              <Download className="w-4 h-4" />
            </button>

            <div className="absolute top-full right-0 mt-2 hidden group-hover:block z-50">
              <div className="bg-popover border border-border rounded-lg shadow-lg p-2 min-w-[150px]">
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={isExporting}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded transition-colors"
                >
                  Export as PDF
                </button>
                <button
                  onClick={() => handleExport('markdown')}
                  disabled={isExporting}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded transition-colors"
                >
                  Export as Markdown
                </button>
                <button
                  onClick={() => handleExport('json')}
                  disabled={isExporting}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded transition-colors"
                >
                  Export as JSON
                </button>
              </div>
            </div>
          </div>

          {/* Share Button */}
          {onShare && (
            <button
              onClick={() => onShare(localDocument)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              title="Share document"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          {/* More Options */}
          <div className="relative group">
            <button
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            <div className="absolute top-full right-0 mt-2 hidden group-hover:block z-50">
              <div className="bg-popover border border-border rounded-lg shadow-lg p-2 min-w-[150px]">
                <button
                  onClick={() => setShowSettings(true)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded transition-colors flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(localDocument.content))}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded transition-colors flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Content
                </button>
                <hr className="my-1 border-border" />
                <button
                  onClick={() => onDelete?.(localDocument.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-destructive hover:text-destructive-foreground rounded transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Document Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tags */}
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4" />
            <span className="font-medium">Tags</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {localDocument.metadata.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-primary/10 text-primary rounded text-xs"
              >
                {tag}
              </span>
            ))}

            <button
              onClick={() => {
                const newTag = prompt('Add tag:')
                if (newTag) {
                  updateMetadata({
                    tags: [...localDocument.metadata.tags, newTag]
                  })
                }
              }}
              className="px-2 py-1 bg-muted hover:bg-muted/80 rounded text-xs transition-colors"
            >
              + Add
            </button>
          </div>
        </div>

        {/* Category */}
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Folder className="w-4 h-4" />
            <span className="font-medium">Category</span>
          </div>

          <select
            value={localDocument.metadata.category || ''}
            onChange={(e) => updateMetadata({ category: e.target.value })}
            className="w-full p-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select category</option>
            <option value="trading">Trading</option>
            <option value="analysis">Analysis</option>
            <option value="strategy">Strategy</option>
            <option value="research">Research</option>
            <option value="review">Review</option>
            <option value="education">Education</option>
          </select>
        </div>

        {/* Template */}
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4" />
            <span className="font-medium">Template</span>
          </div>

          <div className="text-sm text-muted-foreground">
            {localDocument.metadata.template || 'Custom'}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Document Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 rounded hover:bg-accent"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Auto-save</label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoSave}
                    onChange={(e) => {
                      // This would need to be passed up to parent component
                      console.log('Auto-save toggled:', e.target.checked)
                    }}
                    className="rounded"
                  />
                  <span className="text-sm text-muted-foreground">
                    Automatically save changes
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Auto-save interval (seconds)
                </label>
                <input
                  type="number"
                  value={autoSaveInterval / 1000}
                  onChange={(e) => {
                    // This would need to be passed up to parent component
                    console.log('Auto-save interval changed:', e.target.value)
                  }}
                  min="10"
                  max="300"
                  className="w-full p-2 bg-background border border-border rounded text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="btn-primary"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}