'use client'

import React, { memo } from 'react'
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
import { VSCodeTreeNode } from '@/hooks/useVSCodeTree'

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

interface VSCodeTreeItemProps {
  node: VSCodeTreeNode
  level: number
  isExpanded: boolean
  isSelected: boolean
  isHovered: boolean
  onToggleExpansion: (nodeId: string) => void
  onSelectNode: (nodeId: string) => void
  onHoverNode: (nodeId: string | null) => void
  onContextMenu?: (nodeId: string, event: React.MouseEvent) => void
  onCreateChild?: (parentId: string) => void
  showContentCounts?: boolean
}

export const VSCodeTreeItem = memo(function VSCodeTreeItem({
  node,
  level,
  isExpanded,
  isSelected,
  isHovered,
  onToggleExpansion,
  onSelectNode,
  onHoverNode,
  onContextMenu,
  onCreateChild,
  showContentCounts = true
}: VSCodeTreeItemProps) {
  const hasChildren = node.children && node.children.length > 0
  const IconComponent = iconMap[node.icon as keyof typeof iconMap] || Folder

  // VS Code-style indentation: 16px per level
  const indentSize = level * 16

  // Chevron click: Always toggle expansion (expand/collapse)
  const handleChevronClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (hasChildren) {
      // Chevron always toggles - this is the only way to collapse
      onToggleExpansion(node.id)
    }
  }

  const handleNameClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    console.log('🖱️ VSCodeTreeItem handleNameClick:', {
      nodeId: node.id,
      nodeName: node.name,
      hasChildren,
      isExpanded
    })

    // Always select the node
    onSelectNode(node.id)

    // Expand if collapsed (but don't collapse if expanded)
    if (hasChildren && !isExpanded) {
      console.log('📂 Expanding folder:', node.id)
      onToggleExpansion(node.id)
    }
  }

  const handleRowDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Double click: select + expand (optional behavior)
    onSelectNode(node.id)
    if (hasChildren) {
      onToggleExpansion(node.id)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu?.(node.id, e)
  }

  const handleCreateClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onCreateChild?.(node.id)
  }

  const handleMouseEnter = () => {
    onHoverNode(node.id)
  }

  const handleMouseLeave = () => {
    onHoverNode(null)
  }

  return (
    <div
      className="vscode-tree-item group select-none"
      style={{ '--indent': `${indentSize}px` } as React.CSSProperties}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleRowDoubleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Main row container */}
      <div
        className={cn(
          'flex items-center h-7 w-full cursor-pointer transition-all duration-150',
          'hover:bg-[#1a1a1a]',
          isSelected && 'bg-[#FFD700]/10 border-l-2 border-[#FFD700]',
          isHovered && !isSelected && 'bg-[#161616]'
        )}
        style={{ paddingLeft: `${indentSize + 8}px` }}
      >
        {/* Chevron button - separate click area */}
        <button
          onClick={handleChevronClick}
          className={cn(
            'flex items-center justify-center w-4 h-4 mr-1 rounded transition-all duration-150',
            'hover:bg-[#2a2a2a]',
            !hasChildren && 'invisible'
          )}
          tabIndex={-1}
          aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
        >
          {hasChildren && (
            <div className={cn(
              'transition-transform duration-200',
              // Proper chevron rotation based on expansion state
              isExpanded ? 'rotate-90' : 'rotate-0'
            )}>
              <ChevronRight className="w-3 h-3 studio-muted" />
            </div>
          )}
        </button>

        {/* Folder icon */}
        <div className="flex items-center justify-center w-4 h-4 mr-2">
          <IconComponent
            className={cn(
              'w-4 h-4 transition-colors duration-150',
              isSelected ? 'text-[#FFD700]' : 'studio-muted',
              isHovered && !isSelected && 'studio-text'
            )}
            style={{
              color: isSelected ? '#FFD700' : isHovered ? '#e5e5e5' : node.color
            }}
          />
        </div>

        {/* Folder name - clickable area for selection */}
        <button
          onClick={handleNameClick}
          className={cn(
            'flex-1 text-left text-sm truncate transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-[#FFD700]/50 rounded px-1',
            isSelected ? 'text-[#FFD700] font-medium' : 'studio-text',
            isHovered && !isSelected && 'studio-text'
          )}
          tabIndex={0}
          role="treeitem"
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={isSelected}
        >
          {node.name}
        </button>

        {/* Content count badge */}
        {showContentCounts && node.contentCount > 0 && (
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded transition-colors duration-150',
            'bg-[#2a2a2a] studio-muted',
            isSelected && 'bg-[#FFD700]/20 text-[#FFD700]'
          )}>
            {node.contentCount}
          </span>
        )}

        {/* Action buttons (visible on hover) */}
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

          <button
            onClick={handleContextMenu}
            className="p-1 rounded hover:bg-[#2a2a2a] transition-colors"
            title="More options"
            tabIndex={-1}
          >
            <MoreHorizontal className="w-3 h-3 studio-muted hover:studio-text" />
          </button>
        </div>
      </div>

      {/* Children rendering - NOTE: This is handled by VSCodeFolderTree, not here */}
      {/* Remove children rendering from here to avoid duplication */}
    </div>
  )
})