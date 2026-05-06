'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Edit3,
  Trash2,
  AlertTriangle,
  Move,
  Copy,
  FolderOpen,
  X,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Inline Rename Component
interface InlineRenameProps {
  isActive: boolean
  currentName: string
  onSave: (newName: string) => void
  onCancel: () => void
  className?: string
}

export function InlineRename({
  isActive,
  currentName,
  onSave,
  onCancel,
  className
}: InlineRenameProps) {
  const [value, setValue] = useState(currentName)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isActive) {
      setValue(currentName)
      setError('')
      // Focus input after a brief delay
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
  }, [isActive, currentName])

  useEffect(() => {
    if (!isActive) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isActive, onCancel])

  const validateName = (name: string): boolean => {
    if (!name.trim()) {
      setError('Name cannot be empty')
      return false
    }
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters')
      return false
    }
    if (name.trim().length > 50) {
      setError('Name must be less than 50 characters')
      return false
    }
    setError('')
    return true
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedValue = value.trim()

    if (validateName(trimmedValue)) {
      onSave(trimmedValue)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    if (error) {
      validateName(e.target.value)
    }
  }

  if (!isActive) return null

  return (
    <form onSubmit={handleSubmit} className={cn('flex items-center space-x-1', className)}>
      <div className="flex-1 min-w-0">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          className={cn(
            'w-full px-2 py-1 text-sm bg-[#1a1a1a] border rounded',
            'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary',
            error ? 'border-red-500' : 'border-[#333]',
            'studio-text'
          )}
          maxLength={50}
        />
        {error && (
          <p className="text-xs text-red-400 mt-1">{error}</p>
        )}
      </div>
      <button
        type="submit"
        className="p-1 text-green-400 hover:bg-green-400/10 rounded transition-colors"
        title="Save"
      >
        <Check className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="p-1 text-gray-400 hover:bg-gray-400/10 rounded transition-colors"
        title="Cancel"
      >
        <X className="w-3 h-3" />
      </button>
    </form>
  )
}

// Delete Confirmation Modal
interface DeleteConfirmationProps {
  isOpen: boolean
  folderName: string
  childCount?: number
  onConfirm: () => void
  onCancel: () => void
  isDeleting?: boolean
}

export function DeleteConfirmation({
  isOpen,
  folderName,
  childCount = 0,
  onConfirm,
  onCancel,
  isDeleting = false
}: DeleteConfirmationProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onCancel, isDeleting])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDeleting) {
      onCancel()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md bg-[#111] border border-[#333] rounded-xl shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center space-x-3 p-6 border-b border-[#333]">
          <div className="flex-shrink-0 w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Delete Folder</h2>
            <p className="text-sm text-gray-400">This action cannot be undone</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <p className="text-sm studio-text">
              Are you sure you want to delete the folder{' '}
              <span className="font-medium text-primary">"{folderName}"</span>?
            </p>

            {childCount > 0 && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-300 font-medium">
                  ⚠️ This folder contains {childCount} item{childCount !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-red-400 mt-1">
                  All contents will be permanently deleted.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-400 bg-[#1a1a1a] border border-[#333] rounded-lg hover:bg-[#222] transition-colors disabled:opacity-50"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Folder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Move Folder Modal
interface MoveFolderModalProps {
  isOpen: boolean
  folderId: string
  folderName: string
  availableFolders: Array<{ id: string; name: string; parentId?: string }>
  onMove: (folderId: string, newParentId: string | null) => void
  onCancel: () => void
  isMoving?: boolean
}

export function MoveFolderModal({
  isOpen,
  folderId,
  folderName,
  availableFolders,
  onMove,
  onCancel,
  isMoving = false
}: MoveFolderModalProps) {
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isMoving) {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onCancel, isMoving])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isMoving) {
      onCancel()
    }
  }

  const handleMove = () => {
    onMove(folderId, selectedParentId)
  }

  // Filter out the folder being moved and its descendants to prevent circular references
  const availableTargets = availableFolders.filter(folder => folder.id !== folderId)

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md bg-[#111] border border-[#333] rounded-xl shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center space-x-3 p-6 border-b border-[#333]">
          <Move className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-white">Move Folder</h2>
            <p className="text-sm text-gray-400">
              Move "{folderName}" to a new location
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <label className="block text-sm font-medium studio-text">
              Choose Destination
            </label>

            {/* Root level option */}
            <label className="flex items-center space-x-3 p-3 bg-[#0a0a0a] border border-[#333] rounded-lg hover:bg-[#1a1a1a] cursor-pointer transition-colors">
              <input
                type="radio"
                name="destination"
                value=""
                checked={selectedParentId === null}
                onChange={() => setSelectedParentId(null)}
                className="text-primary focus:ring-primary focus:ring-offset-0"
              />
              <FolderOpen className="w-4 h-4 text-gray-400" />
              <span className="text-sm studio-text">Root (no parent folder)</span>
            </label>

            {/* Available folders */}
            <div className="max-h-48 overflow-y-auto space-y-2">
              {availableTargets.map((folder) => (
                <label
                  key={folder.id}
                  className="flex items-center space-x-3 p-3 bg-[#0a0a0a] border border-[#333] rounded-lg hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="destination"
                    value={folder.id}
                    checked={selectedParentId === folder.id}
                    onChange={() => setSelectedParentId(folder.id)}
                    className="text-primary focus:ring-primary focus:ring-offset-0"
                  />
                  <FolderOpen className="w-4 h-4 text-primary" />
                  <span className="text-sm studio-text truncate">{folder.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-400 bg-[#1a1a1a] border border-[#333] rounded-lg hover:bg-[#222] transition-colors disabled:opacity-50"
              disabled={isMoving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleMove}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isMoving}
            >
              {isMoving ? 'Moving...' : 'Move Here'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Hooks for managing folder operations
export function useFolderOperations() {
  const [operations, setOperations] = useState({
    rename: { active: false, folderId: '', currentName: '' },
    delete: { active: false, folderId: '', folderName: '', childCount: 0 },
    move: { active: false, folderId: '', folderName: '' }
  })

  const startRename = (folderId: string, currentName: string) => {
    setOperations(prev => ({
      ...prev,
      rename: { active: true, folderId, currentName }
    }))
  }

  const cancelRename = () => {
    setOperations(prev => ({
      ...prev,
      rename: { active: false, folderId: '', currentName: '' }
    }))
  }

  const startDelete = (folderId: string, folderName: string, childCount: number = 0) => {
    setOperations(prev => ({
      ...prev,
      delete: { active: true, folderId, folderName, childCount }
    }))
  }

  const cancelDelete = () => {
    setOperations(prev => ({
      ...prev,
      delete: { active: false, folderId: '', folderName: '', childCount: 0 }
    }))
  }

  const startMove = (folderId: string, folderName: string) => {
    setOperations(prev => ({
      ...prev,
      move: { active: true, folderId, folderName }
    }))
  }

  const cancelMove = () => {
    setOperations(prev => ({
      ...prev,
      move: { active: false, folderId: '', folderName: '' }
    }))
  }

  return {
    operations,
    startRename,
    cancelRename,
    startDelete,
    cancelDelete,
    startMove,
    cancelMove
  }
}