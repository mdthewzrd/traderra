'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Plus,
  MoreHorizontal,
  FileText,
  Target,
  Search,
  Star,
  Bookmark,
  Calendar,
  Archive,
  PieChart,
  Building,
  Lightbulb,
  Layers,
  TrendingUp,
  BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types for folder structure
export interface FolderNode {
  id: string
  name: string
  parentId?: string
  icon: string
  color: string
  position: number
  children: FolderNode[]
  contentCount: number
  isExpanded?: boolean
  isSelected?: boolean
}

interface FolderTreeProps {
  folders: FolderNode[]
  selectedFolderId?: string
  expandedFolderIds?: Set<string>
  onFolderSelect?: (folderId: string) => void
  onFolderExpand?: (folderId: string, expanded: boolean) => void
  onFolderCreate?: (parentId?: string) => void
  onFolderContextMenu?: (folderId: string, event: React.MouseEvent) => void
  className?: string
  showCreateButton?: boolean
  showContentCounts?: boolean
}

interface FolderTreeItemProps {
  folder: FolderNode
  level: number
  selectedFolderId?: string
  expandedFolderIds?: Set<string>
  onFolderSelect?: (folderId: string) => void
  onFolderExpand?: (folderId: string, expanded: boolean) => void
  onFolderCreate?: (parentId?: string) => void
  onFolderContextMenu?: (folderId: string, event: React.MouseEvent) => void
  showContentCounts?: boolean
}

// Icon mapping for different folder types
const iconMap = {
  'folder': Folder,
  'journal-text': BookOpen,
  'trending-up': TrendingUp,
  'trending-down': TrendingUp,
  'target': Target,
  'search': Search,
  'star': Star,
  'bookmark': Bookmark,
  'calendar': Calendar,
  'archive': Archive,
  'pie-chart': PieChart,
  'building': Building,
  'file-text': FileText,
  'lightbulb': Lightbulb,
  'layers': Layers
}

function FolderTreeItem({
  folder,
  level,
  selectedFolderId,
  expandedFolderIds,
  onFolderSelect,
  onFolderExpand,
  onFolderCreate,
  onFolderContextMenu,
  showContentCounts = true
}: FolderTreeItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  const isExpanded = expandedFolderIds?.has(folder.id) ?? false
  const isSelected = selectedFolderId === folder.id
  const hasChildren = folder.children && folder.children.length > 0

  // Get the appropriate icon component
  const IconComponent = iconMap[folder.icon as keyof typeof iconMap] || Folder

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()

    console.log('🖱️ Folder clicked:', {
      folderId: folder.id,
      folderName: folder.name,
      hasChildren,
      isExpanded,
      willExpand: hasChildren && !isExpanded
    })

    // Always select the folder first
    onFolderSelect?.(folder.id)

    // Always expand if folder has children (no toggle - only expand)
    if (hasChildren && !isExpanded) {
      console.log('📂 Expanding folder:', folder.id)
      onFolderExpand?.(folder.id, true)
    }
  }, [folder.id, onFolderSelect, hasChildren, isExpanded, onFolderExpand])

  const handleExpandClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()

    console.log('🔼 Chevron clicked:', {
      folderId: folder.id,
      folderName: folder.name,
      hasChildren,
      isExpanded,
      willExpand: hasChildren && !isExpanded
    })

    // Always select the folder first (same as main click)
    onFolderSelect?.(folder.id)

    // Always expand if folder has children (no toggle - only expand, same as main click)
    if (hasChildren && !isExpanded) {
      console.log('📂 Expanding folder via chevron:', folder.id)
      onFolderExpand?.(folder.id, true)
    }
  }, [folder.id, onFolderSelect, hasChildren, isExpanded, onFolderExpand])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onFolderContextMenu?.(folder.id, e)
  }, [folder.id, onFolderContextMenu])

  const handleCreateClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onFolderCreate?.(folder.id)
  }, [folder.id, onFolderCreate])

  return (
    <div className="select-none">
      <div
        className={cn(
          'group flex items-center py-1.5 px-2 rounded-md cursor-pointer transition-all duration-200',
          'hover:bg-[#1a1a1a] hover:shadow-sm',
          isSelected && 'bg-[#FFD700]/10 border-l-4 border-[#FFD700]',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50',
          // Enhanced clickable visual feedback
          !isSelected && 'hover:border-l-2 hover:border-[#FFD700]/30'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        tabIndex={0}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
      >
        {/* Expand Button - Consistent single-click-to-expand behavior */}
        <div
          onClick={handleExpandClick}
          className={cn(
            'flex items-center justify-center w-4 h-4 mr-1 rounded transition-colors',
            !hasChildren && 'invisible',
            hasChildren && 'hover:bg-[#FFD700]/20 cursor-pointer',
            'relative z-10' // Ensure this stays on top for click handling
          )}
          title={hasChildren && !isExpanded ? 'Click to expand folder' : ''}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="w-3 h-3 studio-muted" />
            ) : (
              <ChevronRight className="w-3 h-3 studio-muted" />
            )
          )}
        </div>

        {/* Folder Icon */}
        <div className="flex items-center justify-center w-4 h-4 mr-2">
          <IconComponent
            className={cn(
              'w-4 h-4',
              isSelected ? 'text-[#FFD700]' : isHovered ? 'studio-text' : 'studio-muted'
            )}
            style={{ color: isSelected ? '#FFD700' : folder.color }}
          />
        </div>

        {/* Folder Name */}
        <span
          className={cn(
            'flex-1 text-sm truncate',
            isSelected ? 'text-[#FFD700] font-semibold' : 'studio-text'
          )}
        >
          {folder.name}
        </span>

        {/* Content Count */}
        {showContentCounts && folder.contentCount > 0 && (
          <span className="text-xs studio-muted bg-[#2a2a2a] px-1.5 py-0.5 rounded">
            {folder.contentCount}
          </span>
        )}

        {/* Action Buttons (visible on hover) */}
        <div className={cn(
          'flex items-center space-x-1 ml-2',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'relative z-10' // Ensure buttons stay on top for click handling
        )}>
          <button
            onClick={(e) => {
              e.stopPropagation() // Prevent folder selection when clicking action buttons
              handleCreateClick(e)
            }}
            className="p-1 rounded hover:bg-[#2a2a2a] transition-colors"
            aria-label="Create subfolder"
          >
            <Plus className="w-3 h-3 studio-muted hover:studio-text" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation() // Prevent folder selection when clicking action buttons
              handleContextMenu(e)
            }}
            className="p-1 rounded hover:bg-[#2a2a2a] transition-colors"
            aria-label="Folder options"
          >
            <MoreHorizontal className="w-3 h-3 studio-muted hover:studio-text" />
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div role="group">
          {folder.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              expandedFolderIds={expandedFolderIds}
              onFolderSelect={onFolderSelect}
              onFolderExpand={onFolderExpand}
              onFolderCreate={onFolderCreate}
              onFolderContextMenu={onFolderContextMenu}
              showContentCounts={showContentCounts}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FolderTree({
  folders,
  selectedFolderId,
  expandedFolderIds = new Set(),
  onFolderSelect,
  onFolderExpand,
  onFolderCreate,
  onFolderContextMenu,
  className,
  showCreateButton = true,
  showContentCounts = true
}: FolderTreeProps) {
  // Sort folders by position and name
  const sortedFolders = useMemo(() => {
    return [...folders].sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position
      }
      return a.name.localeCompare(b.name)
    })
  }, [folders])

  return (
    <div className={cn('folder-tree', className)} role="tree">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-2">
        <h3 className="text-sm font-medium studio-text">Folders</h3>
        {showCreateButton && (
          <button
            onClick={() => onFolderCreate?.()}
            className="p-1.5 rounded hover:bg-[#1a1a1a] transition-colors"
            aria-label="Create new folder"
          >
            <Plus className="w-4 h-4 studio-muted hover:studio-text" />
          </button>
        )}
      </div>

      {/* Tree Items */}
      <div className="space-y-0.5">
        {sortedFolders.length > 0 ? (
          sortedFolders.map((folder) => (
            <FolderTreeItem
              key={folder.id}
              folder={folder}
              level={0}
              selectedFolderId={selectedFolderId}
              expandedFolderIds={expandedFolderIds}
              onFolderSelect={onFolderSelect}
              onFolderExpand={onFolderExpand}
              onFolderCreate={onFolderCreate}
              onFolderContextMenu={onFolderContextMenu}
              showContentCounts={showContentCounts}
            />
          ))
        ) : (
          <div className="text-center py-8 text-sm studio-muted">
            <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No folders yet</p>
            {showCreateButton && (
              <button
                onClick={() => onFolderCreate?.()}
                className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors"
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

// Utility function to build tree structure from flat folder list
export function buildFolderTree(flatFolders: Omit<FolderNode, 'children'>[]): FolderNode[] {
  const folderMap = new Map<string, FolderNode>()
  const rootFolders: FolderNode[] = []

  // First pass: create all folder objects with empty children arrays
  flatFolders.forEach(folder => {
    folderMap.set(folder.id, { ...folder, children: [] })
  })

  // Second pass: build parent-child relationships
  flatFolders.forEach(folder => {
    const folderNode = folderMap.get(folder.id)!

    if (folder.parentId && folderMap.has(folder.parentId)) {
      const parent = folderMap.get(folder.parentId)!
      parent.children.push(folderNode)
    } else {
      rootFolders.push(folderNode)
    }
  })

  // Sort children at each level
  const sortFolders = (folders: FolderNode[]) => {
    folders.sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position
      }
      return a.name.localeCompare(b.name)
    })

    folders.forEach(folder => {
      if (folder.children.length > 0) {
        sortFolders(folder.children)
      }
    })
  }

  sortFolders(rootFolders)

  return rootFolders
}

// Hook for managing folder tree state
export function useFolderTree(initialFolders: FolderNode[] = []) {
  const [folders, setFolders] = useState<FolderNode[]>(initialFolders)
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>()
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set())

  // Update folders when initialFolders changes (fixes document counting issue)
  useEffect(() => {
    setFolders(initialFolders)
  }, [initialFolders])

  const handleFolderSelect = useCallback((folderId: string) => {
    setSelectedFolderId(folderId)
  }, [])

  const handleFolderExpand = useCallback((folderId: string, expanded: boolean) => {
    setExpandedFolderIds(prev => {
      const newSet = new Set(prev)
      if (expanded) {
        newSet.add(folderId)
      } else {
        newSet.delete(folderId)
      }
      return newSet
    })
  }, [])

  const expandAll = useCallback(() => {
    const getAllFolderIds = (folders: FolderNode[]): string[] => {
      const ids: string[] = []
      folders.forEach(folder => {
        ids.push(folder.id)
        if (folder.children.length > 0) {
          ids.push(...getAllFolderIds(folder.children))
        }
      })
      return ids
    }

    setExpandedFolderIds(new Set(getAllFolderIds(folders)))
  }, [folders])

  const collapseAll = useCallback(() => {
    setExpandedFolderIds(new Set())
  }, [])

  return {
    folders,
    setFolders,
    selectedFolderId,
    expandedFolderIds,
    handleFolderSelect,
    handleFolderExpand,
    expandAll,
    collapseAll
  }
}