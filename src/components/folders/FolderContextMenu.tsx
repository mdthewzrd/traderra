'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Edit3,
  Trash2,
  Plus,
  Move,
  Copy,
  Folder,
  FolderPlus,
  Settings,
  Palette,
  Info,
  Archive,
  Share
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContextMenuPosition {
  x: number
  y: number
}

interface FolderContextMenuProps {
  isOpen: boolean
  position: ContextMenuPosition
  folderId: string
  folderName: string
  onClose: () => void
  onRename?: (folderId: string) => void
  onDelete?: (folderId: string) => void
  onCreateSubfolder?: (parentId: string) => void
  onMove?: (folderId: string) => void
  onCopy?: (folderId: string) => void
  onChangeIcon?: (folderId: string) => void
  onChangeColor?: (folderId: string) => void
  onSettings?: (folderId: string) => void
  onInfo?: (folderId: string) => void
  onShare?: (folderId: string) => void
  className?: string
}

interface MenuItemProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
  className?: string
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  destructive = false,
  className
}: MenuItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      onClick()
    }
  }

  return (
    <button
      className={cn(
        'flex items-center w-full px-3 py-2 text-left text-sm transition-colors',
        'hover:bg-[#1a1a1a] focus:bg-[#1a1a1a] focus:outline-none',
        disabled && 'opacity-50 cursor-not-allowed',
        destructive && 'text-red-400 hover:text-red-300',
        !destructive && !disabled && 'studio-text hover:studio-text',
        className
      )}
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      disabled={disabled}
    >
      <Icon className="w-4 h-4 mr-3 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}

function MenuDivider() {
  return <div className="h-px bg-[#2a2a2a] my-1" />
}

export function FolderContextMenu({
  isOpen,
  position,
  folderId,
  folderName,
  onClose,
  onRename,
  onDelete,
  onCreateSubfolder,
  onMove,
  onCopy,
  onChangeIcon,
  onChangeColor,
  onSettings,
  onInfo,
  onShare,
  className
}: FolderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState(position)

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is outside the menu
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        // Add a small delay to prevent immediate closure
        setTimeout(() => {
          onClose()
        }, 0)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    // Use mousedown instead of click for better control
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!isOpen || !menuRef.current) return

    const menu = menuRef.current
    const rect = menu.getBoundingClientRect()
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    let { x, y } = position

    // Adjust horizontal position
    if (x + rect.width > viewport.width - 10) {
      x = viewport.width - rect.width - 10
    }
    if (x < 10) {
      x = 10
    }

    // Adjust vertical position
    if (y + rect.height > viewport.height - 10) {
      y = viewport.height - rect.height - 10
    }
    if (y < 10) {
      y = 10
    }

    setAdjustedPosition({ x, y })
  }, [isOpen, position])

  if (!isOpen) return null

  const handleItemClick = (action: () => void, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    // Execute the action first
    action()

    // Close menu after a brief delay to ensure action completes
    setTimeout(() => {
      onClose()
    }, 50)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Context Menu */}
      <div
        ref={menuRef}
        className={cn(
          'fixed z-50 min-w-[200px] max-w-[280px] py-2',
          'studio-surface border studio-border rounded-lg shadow-xl',
          'animate-in fade-in-0 zoom-in-95 duration-200',
          className
        )}
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y
        }}
        role="menu"
        aria-labelledby="folder-context-menu"
      >
        {/* Folder Info Header */}
        <div className="px-3 py-2 border-b border-[#2a2a2a]">
          <div className="flex items-center space-x-2">
            <Folder className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium studio-text truncate">
              {folderName}
            </span>
          </div>
        </div>

        {/* Primary Actions */}
        <div className="py-1">
          {onRename && (
            <MenuItem
              icon={Edit3}
              label="Rename"
              onClick={() => handleItemClick(() => onRename(folderId))}
            />
          )}

          {onCreateSubfolder && (
            <MenuItem
              icon={FolderPlus}
              label="Create Subfolder"
              onClick={() => handleItemClick(() => onCreateSubfolder(folderId))}
            />
          )}

          {onMove && (
            <MenuItem
              icon={Move}
              label="Move"
              onClick={() => handleItemClick(() => onMove(folderId))}
            />
          )}

          {onCopy && (
            <MenuItem
              icon={Copy}
              label="Duplicate"
              onClick={() => handleItemClick(() => onCopy(folderId))}
            />
          )}
        </div>

        {/* Customization Actions */}
        {(onChangeIcon || onChangeColor || onSettings) && (
          <>
            <MenuDivider />
            <div className="py-1">
              {onChangeIcon && (
                <MenuItem
                  icon={Palette}
                  label="Change Icon"
                  onClick={() => handleItemClick(() => onChangeIcon(folderId))}
                />
              )}

              {onChangeColor && (
                <MenuItem
                  icon={Palette}
                  label="Change Color"
                  onClick={() => handleItemClick(() => onChangeColor(folderId))}
                />
              )}

              {onSettings && (
                <MenuItem
                  icon={Settings}
                  label="Folder Settings"
                  onClick={() => handleItemClick(() => onSettings(folderId))}
                />
              )}
            </div>
          </>
        )}

        {/* Info and Sharing */}
        {(onInfo || onShare) && (
          <>
            <MenuDivider />
            <div className="py-1">
              {onInfo && (
                <MenuItem
                  icon={Info}
                  label="Folder Info"
                  onClick={() => handleItemClick(() => onInfo(folderId))}
                />
              )}

              {onShare && (
                <MenuItem
                  icon={Share}
                  label="Share"
                  onClick={() => handleItemClick(() => onShare(folderId))}
                />
              )}
            </div>
          </>
        )}

        {/* Destructive Actions */}
        {onDelete && (
          <>
            <MenuDivider />
            <div className="py-1">
              <MenuItem
                icon={Trash2}
                label="Delete Folder"
                onClick={() => handleItemClick(() => onDelete(folderId))}
                destructive
              />
            </div>
          </>
        )}
      </div>
    </>
  )
}

// Hook for managing context menu state
export function useFolderContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean
    position: ContextMenuPosition
    folderId: string
    folderName: string
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    folderId: '',
    folderName: ''
  })

  const openContextMenu = (
    folderId: string,
    folderName: string,
    event: React.MouseEvent
  ) => {
    event.preventDefault()
    event.stopPropagation()

    setContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      folderId,
      folderName
    })
  }

  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, isOpen: false }))
  }

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu
  }
}

// Specialized context menu for different folder types
interface QuickActionsMenuProps extends Omit<FolderContextMenuProps, 'onRename' | 'onDelete' | 'onMove' | 'onCopy'> {
  folderType?: 'trading' | 'strategy' | 'research' | 'archive'
  onNewTradeEntry?: (folderId: string) => void
  onNewStrategy?: (folderId: string) => void
  onNewNote?: (folderId: string) => void
}

export function QuickActionsMenu({
  folderType = 'trading',
  onNewTradeEntry,
  onNewStrategy,
  onNewNote,
  ...props
}: QuickActionsMenuProps) {
  return (
    <div
      className={cn('min-w-[220px]', props.className)}
    >
      <FolderContextMenu
        {...props}
      />
      {/* Quick Create Actions based on folder type */}
      {folderType === 'trading' && onNewTradeEntry && (
        <div className="py-1 border-b border-[#2a2a2a]">
          <MenuItem
            icon={Plus}
            label="New Trade Entry"
            onClick={() => {
              onNewTradeEntry(props.folderId)
              props.onClose()
            }}
          />
        </div>
      )}

      {folderType === 'strategy' && onNewStrategy && (
        <div className="py-1 border-b border-[#2a2a2a]">
          <MenuItem
            icon={Plus}
            label="New Strategy"
            onClick={() => {
              onNewStrategy(props.folderId)
              props.onClose()
            }}
          />
        </div>
      )}

      {onNewNote && (
        <div className="py-1 border-b border-[#2a2a2a]">
          <MenuItem
            icon={Plus}
            label="New Note"
            onClick={() => {
              onNewNote(props.folderId)
              props.onClose()
            }}
          />
        </div>
      )}
    </div>
  )
}