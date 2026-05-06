'use client'

import React, { useMemo, useCallback } from 'react'
import Tree from 'rc-tree'
import type { TreeProps, DataNode } from 'rc-tree/lib/interface'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
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
  Layers
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

export interface RCTreeFolderNode {
  id: string
  name: string
  icon?: string
  color?: string
  contentCount?: number
  children?: RCTreeFolderNode[]
  parentId?: string
}

interface RCTreeFolderTreeProps {
  folders: RCTreeFolderNode[]
  selectedFolderId?: string
  onFolderSelect?: (folderId: string) => void
  onCreateFolder?: (parentId?: string) => void
  onContextMenu?: (folderId: string, event: React.MouseEvent) => void
  className?: string
  showCreateButton?: boolean
  showContentCounts?: boolean
}

// Custom Node Component for VSCode-style rendering
function renderTreeNode(nodeData: any) {
  const { data, expanded, selected } = nodeData
  const hasChildren = data.children && data.children.length > 0
  const IconComponent = iconMap[data.icon as keyof typeof iconMap] || Folder

  return (
    <div
      className={cn(
        'flex items-center h-7 w-full transition-all duration-150 group',
        'hover:bg-[#1a1a1a] cursor-pointer',
        selected && 'bg-[#FFD700]/10 border-l-2 border-[#FFD700]'
      )}
    >
      {/* Folder icon */}
      <div className="flex items-center justify-center w-4 h-4 mr-2">
        <IconComponent
          className={cn(
            'w-4 h-4 transition-colors duration-150',
            selected ? 'text-[#FFD700]' : 'studio-muted'
          )}
          style={{
            color: selected ? '#FFD700' : data.color || '#888888'
          }}
        />
      </div>

      {/* Folder name */}
      <span className={cn(
        'flex-1 text-sm truncate transition-colors duration-150',
        selected ? 'text-[#FFD700] font-medium' : 'studio-text'
      )}>
        {data.name}
      </span>

      {/* Content count badge */}
      {data.contentCount > 0 && (
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded transition-colors duration-150 mr-2',
          'bg-[#2a2a2a] studio-muted',
          selected && 'bg-[#FFD700]/20 text-[#FFD700]'
        )}>
          {data.contentCount}
        </span>
      )}

      {/* Action buttons (visible on hover) */}
      <div className={cn(
        'flex items-center space-x-1 ml-2 opacity-0 transition-opacity duration-150',
        'group-hover:opacity-100'
      )}>
        {hasChildren && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('Create folder in:', data.id)
            }}
            className="p-1 rounded hover:bg-[#2a2a2a] transition-colors"
            title="Create subfolder"
          >
            <Plus className="w-3 h-3 studio-muted hover:studio-text" />
          </button>
        )}
      </div>
    </div>
  )
}

// Custom switcher icon for expand/collapse
function renderSwitcherIcon(props: any) {
  const { expanded } = props

  if (expanded) {
    return <ChevronDown className="w-3 h-3 studio-muted" />
  } else {
    return <ChevronRight className="w-3 h-3 studio-muted" />
  }
}

export function RCTreeFolderTree({
  folders,
  selectedFolderId,
  onFolderSelect,
  onCreateFolder,
  onContextMenu,
  className,
  showCreateButton = true,
  showContentCounts = true
}: RCTreeFolderTreeProps) {
  // Convert folder data to rc-tree format
  const treeData = useMemo(() => {
    const convertToRCTreeFormat = (folders: RCTreeFolderNode[]): DataNode[] => {
      return folders.map(folder => ({
        key: folder.id,
        title: folder.name,
        data: {
          id: folder.id,
          name: folder.name,
          icon: folder.icon,
          color: folder.color,
          contentCount: folder.contentCount || 0
        },
        children: folder.children ? convertToRCTreeFormat(folder.children) : undefined
      }))
    }
    return convertToRCTreeFormat(folders)
  }, [folders])

  // Handle selection changes
  const onSelect = useCallback((selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0 && onFolderSelect) {
      onFolderSelect(selectedKeys[0] as string)
    }
  }, [onFolderSelect])

  // Default expanded keys (expand Trading Journal by default)
  const defaultExpandedKeys = useMemo(() => {
    return ['1'] // Always expand the root "Trading Journal" folder
  }, [])

  // Selected keys
  const selectedKeys = useMemo(() => {
    return selectedFolderId ? [selectedFolderId] : []
  }, [selectedFolderId])

  return (
    <div className={cn('rc-tree-folder-tree h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-medium studio-text">Folders</h3>
          <span className="text-xs studio-muted">({folders.length})</span>
        </div>

        <div className="flex items-center space-x-1">
          {showCreateButton && (
            <button
              onClick={() => onCreateFolder?.()}
              className="p-1.5 rounded hover:bg-[#1a1a1a] transition-colors"
              title="Create new folder"
            >
              <Plus className="w-4 h-4 studio-muted hover:studio-text" />
            </button>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1">
        {treeData.length > 0 ? (
          <Tree
            treeData={treeData}
            onSelect={onSelect}
            selectedKeys={selectedKeys}
            defaultExpandedKeys={defaultExpandedKeys}
            showLine={false}
            showIcon={false}
            switcherIcon={renderSwitcherIcon}
            titleRender={renderTreeNode}
            className="vscode-style-tree"
          />
        ) : (
          <div className="text-center py-8 text-sm studio-muted">
            <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No folders yet</p>
            {showCreateButton && (
              <button
                onClick={() => onCreateFolder?.()}
                className="mt-2 text-xs text-[#FFD700] hover:text-[#FFD700]/80 transition-colors"
              >
                Create your first folder
              </button>
            )}
          </div>
        )}
      </div>

      {/* Custom styles for the tree */}
      <style jsx>{`
        .vscode-style-tree .rc-tree-treenode {
          padding: 0;
          margin: 0;
        }
        .vscode-style-tree .rc-tree-node-content-wrapper {
          padding: 0;
          border-radius: 0;
          transition: background-color 150ms ease;
          width: 100%;
        }
        .vscode-style-tree .rc-tree-node-content-wrapper:hover {
          background-color: transparent;
        }
        .vscode-style-tree .rc-tree-node-selected .rc-tree-node-content-wrapper {
          background-color: transparent;
        }
        .vscode-style-tree .rc-tree-switcher {
          background: transparent;
          border: none;
          width: 16px;
          height: 16px;
          margin-right: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .vscode-style-tree .rc-tree-switcher:hover {
          background-color: #2a2a2a;
          border-radius: 2px;
        }
        .vscode-style-tree .rc-tree-indent-unit {
          width: 16px;
        }
      `}</style>
    </div>
  )
}

// Utility function to convert old FolderNode format to RCTreeFolderNode
export function convertToRCTreeNodes(oldNodes: any[]): RCTreeFolderNode[] {
  return oldNodes.map(node => ({
    id: node.id,
    name: node.name,
    icon: node.icon || 'folder',
    color: node.color || '#888888',
    contentCount: node.contentCount || 0,
    children: node.children ? convertToRCTreeNodes(node.children) : [],
    parentId: node.parentId
  }))
}