'use client'

import React, { useState, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  BookOpen,
  TrendingUp,
  Target,
  Search,
  Star,
  Calendar,
  Archive,
  PieChart,
  Building,
  FileText,
  Lightbulb,
  Layers,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Icon mapping for different folder types
const iconMap = {
  'folder': Folder,
  'journal-text': BookOpen,
  'trending-up': TrendingUp,
  'trending-down': TrendingUp,
  'target': Target,
  'search': Search,
  'star': Star,
  'bookmark': Star,
  'calendar': Calendar,
  'archive': Archive,
  'pie-chart': PieChart,
  'building': Building,
  'file-text': FileText,
  'lightbulb': Lightbulb,
  'layers': Layers
}

export interface SimpleFolderNode {
  id: string
  name: string
  icon?: string
  color?: string
  contentCount?: number
  children?: SimpleFolderNode[]
  parentId?: string
}

interface SimpleFolderTreeProps {
  folders: SimpleFolderNode[]
  selectedFolderId?: string
  onFolderSelect?: (folderId: string) => void
  onCreateFolder?: (parentId?: string) => void
  className?: string
  showCreateButton?: boolean
  showContentCounts?: boolean
}

interface FolderItemProps {
  folder: SimpleFolderNode
  level: number
  selectedId: string
  expandedIds: Set<string>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onCreate?: (parentId: string) => void
  showContentCounts: boolean
}

function FolderItem({
  folder,
  level,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  onCreate,
  showContentCounts
}: FolderItemProps) {
  const isSelected = selectedId === folder.id
  const isExpanded = expandedIds.has(folder.id)
  const hasChildren = folder.children && folder.children.length > 0
  const IconComponent = iconMap[folder.icon as keyof typeof iconMap] || Folder

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    console.log('🖱️ Simple folder click:', {
      folderId: folder.id,
      folderName: folder.name,
      hasChildren,
      isExpanded,
      currentSelected: isSelected,
      timestamp: Date.now()
    })

    // ALWAYS select first
    onSelect(folder.id)

    // Then expand if needed (VSCode behavior: expand but don't collapse)
    if (hasChildren && !isExpanded) {
      console.log('🔄 Expanding folder:', folder.id)
      onToggle(folder.id)
    } else {
      console.log('⚠️ Not expanding:', { hasChildren, isExpanded })
    }
  }, [folder.id, folder.name, hasChildren, isExpanded, isSelected, onSelect, onToggle])

  const handleChevronClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (hasChildren) {
      onToggle(folder.id)
    }
  }, [hasChildren, folder.id, onToggle])

  const handleCreateClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onCreate?.(folder.id)
  }, [folder.id, onCreate])

  return (
    <>
      <div
        className={cn(
          'flex items-center h-7 w-full transition-colors duration-150 group cursor-pointer',
          'hover:bg-[#1a1a1a]',
          isSelected && 'bg-[#FFD700]/10 border-l-2 border-[#FFD700]'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Chevron */}
        <button
          onClick={handleChevronClick}
          className={cn(
            'flex items-center justify-center w-4 h-4 mr-1 rounded transition-colors',
            'hover:bg-[#2a2a2a]',
            !hasChildren && 'invisible'
          )}
          tabIndex={-1}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="w-3 h-3 studio-muted" />
            ) : (
              <ChevronRight className="w-3 h-3 studio-muted" />
            )
          )}
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center w-4 h-4 mr-2">
          <IconComponent
            className={cn(
              'w-4 h-4 transition-colors duration-150',
              isSelected ? 'text-[#FFD700]' : 'studio-muted'
            )}
            style={{
              color: isSelected ? '#FFD700' : folder.color || '#888888'
            }}
          />
        </div>

        {/* Name */}
        <span className={cn(
          'flex-1 text-sm truncate transition-colors duration-150',
          isSelected ? 'text-[#FFD700] font-medium' : 'studio-text'
        )}>
          {folder.name}
        </span>

        {/* Content count */}
        {showContentCounts && folder.contentCount && folder.contentCount > 0 && (
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded transition-colors duration-150 mr-2',
            'bg-[#2a2a2a] studio-muted',
            isSelected && 'bg-[#FFD700]/20 text-[#FFD700]'
          )}>
            {folder.contentCount}
          </span>
        )}

        {/* Actions on hover */}
        <div className={cn(
          'flex items-center space-x-1 ml-2 opacity-0 transition-opacity duration-150',
          'group-hover:opacity-100'
        )}>
          {hasChildren && (
            <button
              onClick={handleCreateClick}
              className="p-1 rounded hover:bg-[#2a2a2a] transition-colors"
              title="Create subfolder"
              tabIndex={-1}
            >
              <Plus className="w-3 h-3 studio-muted hover:studio-text" />
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && folder.children && (
        <div>
          {folder.children.map(child => (
            <FolderItem
              key={child.id}
              folder={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              onCreate={onCreate}
              showContentCounts={showContentCounts}
            />
          ))}
        </div>
      )}
    </>
  )
}

export function SimpleFolderTree({
  folders,
  selectedFolderId,
  onFolderSelect,
  onCreateFolder,
  className,
  showCreateButton = true,
  showContentCounts = true
}: SimpleFolderTreeProps) {
  // ISOLATED state - completely independent after initial load
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['1'])) // Start with Trading Journal expanded
  const [selectedId, setSelectedId] = useState<string>('1') // Always start with Trading Journal
  const [initialized, setInitialized] = useState(false)

  // Initialize only once, then ignore external changes
  React.useEffect(() => {
    if (!initialized && selectedFolderId) {
      setSelectedId(selectedFolderId)
      setInitialized(true)
    }
  }, [selectedFolderId, initialized])

  console.log('🌲 SimpleFolderTree render:', {
    foldersCount: folders.length,
    selectedFolderId,
    internalSelectedId: selectedId,
    expandedCount: expandedIds.size,
    initialized
  })

  // Handle selection with proper callback - VS Code style
  const handleSelect = useCallback((folderId: string) => {
    console.log('📋 Simple handleSelect:', { folderId, onFolderSelect: !!onFolderSelect })

    setSelectedId(folderId)

    // Notify parent component to update main content area
    if (onFolderSelect) {
      onFolderSelect(folderId)
      console.log('✅ Called onFolderSelect with:', folderId)
    } else {
      console.log('⚠️ No onFolderSelect callback provided')
    }
  }, [onFolderSelect])

  // Handle toggle - simple expand/collapse
  const handleToggle = useCallback((folderId: string) => {
    console.log('🔄 Simple handleToggle:', { folderId })

    setExpandedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }, [])

  // Handle create
  const handleCreate = useCallback((parentId?: string) => {
    console.log('➕ Simple handleCreate:', { parentId })
    if (onCreateFolder) {
      onCreateFolder(parentId)
    }
  }, [onCreateFolder])

  // Recursive render function - ALWAYS use internal state
  const renderFolder = useCallback((folder: SimpleFolderNode, level: number = 0) => {
    return (
      <FolderItem
        key={folder.id}
        folder={folder}
        level={level}
        selectedId={selectedId} // ALWAYS use internal state, never external prop
        expandedIds={expandedIds}
        onSelect={handleSelect}
        onToggle={handleToggle}
        onCreate={handleCreate}
        showContentCounts={showContentCounts}
      />
    )
  }, [selectedId, expandedIds, handleSelect, handleToggle, handleCreate, showContentCounts])

  return (
    <div className={cn('simple-folder-tree h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-medium studio-text">Folders</h3>
          <span className="text-xs studio-muted">({folders.length})</span>
        </div>

        <div className="flex items-center space-x-1">
          {showCreateButton && (
            <button
              onClick={() => handleCreate()}
              className="p-1.5 rounded hover:bg-[#1a1a1a] transition-colors"
              title="Create new folder"
            >
              <Plus className="w-4 h-4 studio-muted hover:studio-text" />
            </button>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto">
        {folders.length > 0 ? (
          <div>
            {folders.map(folder => renderFolder(folder, 0))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm studio-muted">
            <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No folders yet</p>
            {showCreateButton && (
              <button
                onClick={() => handleCreate()}
                className="mt-2 text-xs text-[#FFD700] hover:text-[#FFD700]/80 transition-colors"
              >
                Create your first folder
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Utility function to convert old FolderNode format
export function convertToSimpleNodes(oldNodes: any[]): SimpleFolderNode[] {
  return oldNodes.map(node => ({
    id: node.id,
    name: node.name,
    icon: node.icon || 'folder',
    color: node.color || '#888888',
    contentCount: node.contentCount || 0,
    children: node.children ? convertToSimpleNodes(node.children) : [],
    parentId: node.parentId
  }))
}