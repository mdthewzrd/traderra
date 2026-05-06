'use client'

import React, { useState, useEffect } from 'react'
import {
  Folder,
  FolderPlus,
  Briefcase,
  TrendingUp,
  FileText,
  Archive,
  Target,
  BookOpen,
  X,
  Palette,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreateFolderModalProps {
  isOpen: boolean
  parentId?: string
  parentName?: string
  onClose: () => void
  onCreateFolder: (data: FolderData) => void
  className?: string
}

interface FolderData {
  name: string
  parentId?: string
  icon?: string
  color?: string
  description?: string
}

interface FolderIcon {
  name: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

interface FolderColor {
  name: string
  value: string
  bg: string
}

const FOLDER_ICONS: FolderIcon[] = [
  { name: 'folder', icon: Folder, description: 'Default folder' },
  { name: 'briefcase', icon: Briefcase, description: 'Business/Trading' },
  { name: 'trending-up', icon: TrendingUp, description: 'Analysis/Performance' },
  { name: 'file-text', icon: FileText, description: 'Documentation' },
  { name: 'archive', icon: Archive, description: 'Archive/Storage' },
  { name: 'target', icon: Target, description: 'Goals/Targets' },
  { name: 'book-open', icon: BookOpen, description: 'Learning/Research' },
]

const FOLDER_COLORS: FolderColor[] = [
  { name: 'default', value: '#60a5fa', bg: 'bg-blue-500' },
  { name: 'green', value: '#34d399', bg: 'bg-emerald-400' },
  { name: 'purple', value: '#a78bfa', bg: 'bg-violet-400' },
  { name: 'orange', value: '#fb923c', bg: 'bg-orange-400' },
  { name: 'red', value: '#f87171', bg: 'bg-red-400' },
  { name: 'yellow', value: '#fbbf24', bg: 'bg-amber-400' },
  { name: 'pink', value: '#f472b6', bg: 'bg-pink-400' },
  { name: 'gray', value: '#9ca3af', bg: 'bg-gray-400' },
]

export function CreateFolderModal({
  isOpen,
  parentId,
  parentName,
  onClose,
  onCreateFolder,
  className
}: CreateFolderModalProps) {
  const [name, setName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState<string>('folder')
  const [selectedColor, setSelectedColor] = useState<string>('#60a5fa')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('')
      setSelectedIcon('folder')
      setSelectedColor('#60a5fa')
      setDescription('')
      setErrors({})
    }
  }, [isOpen])

  // Close modal on escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'Folder name is required'
    } else if (name.trim().length < 2) {
      newErrors.name = 'Folder name must be at least 2 characters'
    } else if (name.trim().length > 50) {
      newErrors.name = 'Folder name must be less than 50 characters'
    }

    if (description && description.length > 200) {
      newErrors.description = 'Description must be less than 200 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      const folderData: FolderData = {
        name: name.trim(),
        parentId,
        icon: selectedIcon,
        color: selectedColor,
        description: description.trim() || undefined
      }

      await onCreateFolder(folderData)
      onClose()
    } catch (error) {
      console.error('Error creating folder:', error)
      setErrors({ submit: 'Failed to create folder. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  const SelectedIcon = FOLDER_ICONS.find(icon => icon.name === selectedIcon)?.icon || Folder

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-md bg-[#111] border border-[#333] rounded-xl shadow-2xl',
          'animate-in fade-in-0 zoom-in-95 duration-200',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#333]">
          <div className="flex items-center space-x-3">
            <FolderPlus className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold studio-text">Create New Folder</h2>
              {parentName && (
                <p className="text-sm text-gray-400">
                  in <span className="text-primary">{parentName}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Folder Name */}
          <div className="space-y-2">
            <label htmlFor="folder-name" className="block text-sm font-medium studio-text">
              Folder Name
            </label>
            <div className="relative">
              <input
                id="folder-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(
                  'w-full px-3 py-2 bg-[#1a1a1a] border rounded-lg transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  errors.name ? 'border-red-500' : 'border-[#333]',
                  'studio-text placeholder-gray-500'
                )}
                placeholder="Enter folder name..."
                autoFocus
                maxLength={50}
              />
              <div className="absolute right-3 top-2.5 flex items-center space-x-2">
                <SelectedIcon className="w-4 h-4" style={{ color: selectedColor }} />
              </div>
            </div>
            {errors.name && (
              <p className="text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Icon Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium studio-text">
              Choose Icon
            </label>
            <div className="grid grid-cols-4 gap-2">
              {FOLDER_ICONS.map((iconData) => {
                const IconComponent = iconData.icon
                const isSelected = selectedIcon === iconData.name

                return (
                  <button
                    key={iconData.name}
                    type="button"
                    onClick={() => setSelectedIcon(iconData.name)}
                    className={cn(
                      'relative flex flex-col items-center p-3 rounded-lg border transition-all',
                      'hover:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-primary/20',
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-[#333] bg-[#0a0a0a]'
                    )}
                    title={iconData.description}
                  >
                    <IconComponent
                      className="w-5 h-5 mb-1"
                      style={{ color: isSelected ? selectedColor : '#9ca3af' } as React.CSSProperties}
                    />
                    <span className="text-xs text-gray-400 capitalize">
                      {iconData.name.replace('-', ' ')}
                    </span>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Color Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium studio-text">
              Choose Color
            </label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((colorData) => {
                const isSelected = selectedColor === colorData.value

                return (
                  <button
                    key={colorData.name}
                    type="button"
                    onClick={() => setSelectedColor(colorData.value)}
                    className={cn(
                      'relative w-8 h-8 rounded-full border-2 transition-all',
                      'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/20',
                      isSelected ? 'border-white' : 'border-transparent',
                      colorData.bg
                    )}
                    title={colorData.name}
                  >
                    {isSelected && (
                      <Check className="absolute inset-0 w-4 h-4 m-auto text-white" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="folder-description" className="block text-sm font-medium studio-text">
              Description <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              id="folder-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(
                'w-full px-3 py-2 bg-[#1a1a1a] border rounded-lg transition-colors resize-none',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                errors.description ? 'border-red-500' : 'border-[#333]',
                'studio-text placeholder-gray-500'
              )}
              placeholder="Brief description of what this folder contains..."
              rows={3}
              maxLength={200}
            />
            <div className="flex justify-between items-center">
              {errors.description && (
                <p className="text-sm text-red-400">{errors.description}</p>
              )}
              <p className="text-xs text-gray-500 ml-auto">
                {description.length}/200
              </p>
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <p className="text-sm text-red-400">{errors.submit}</p>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-400 bg-[#1a1a1a] border border-[#333] rounded-lg hover:bg-[#222] transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Hook for managing the create folder modal
export function useCreateFolderModal() {
  const [modal, setModal] = useState<{
    isOpen: boolean
    parentId?: string
    parentName?: string
  }>({
    isOpen: false
  })

  const openModal = (parentId?: string, parentName?: string) => {
    setModal({
      isOpen: true,
      parentId,
      parentName
    })
  }

  const closeModal = () => {
    setModal({ isOpen: false })
  }

  return {
    modal,
    openModal,
    closeModal
  }
}