'use client'

import React, { memo, useMemo } from 'react'
import { Plus, FolderPlus, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VSCodeTreeNode, useVSCodeTree } from '@/hooks/useVSCodeTree'
import { VSCodeTreeItem } from './VSCodeTreeItem'

interface VSCodeFolderTreeProps {
  nodes: VSCodeTreeNode[]
  selectedNodeId?: string
  onNodeSelect?: (nodeId: string) => void
  onCreateFolder?: (parentId?: string) => void
  onContextMenu?: (nodeId: string, event: React.MouseEvent) => void
  className?: string
  showCreateButton?: boolean
  showContentCounts?: boolean
  showTreeControls?: boolean
}

export const VSCodeFolderTree = memo(function VSCodeFolderTree({
  nodes,
  selectedNodeId,
  onNodeSelect,
  onCreateFolder,
  onContextMenu,
  className,
  showCreateButton = true,
  showContentCounts = true,
  showTreeControls = true
}: VSCodeFolderTreeProps) {
  console.log('🌳 VSCodeFolderTree render:', {
    nodesLength: nodes.length,
    selectedNodeId,
    nodesChanged: JSON.stringify(nodes.map(n => ({ id: n.id, name: n.name })))
  })

  // Initialize the VS Code tree hook with external selection control
  const {
    nodes: sortedNodes,
    expandedNodes,
    selectedNode,
    hoveredNode,
    handleToggleExpansion,
    handleSelectNode,
    handleNodeHover,
    isNodeExpanded,
    isNodeSelected,
    isNodeHovered,
    expandAll,
    collapseAll
  } = useVSCodeTree(nodes, selectedNodeId)

  // Pure selection handler that notifies parent immediately
  const handleNodeSelectWithCallback = React.useCallback((nodeId: string) => {
    console.log('📋 VSCodeFolderTree handleNodeSelectWithCallback:', { nodeId, selectedNodeId })
    handleSelectNode(nodeId)
    // Immediately notify parent - no loops since we're using pure functions
    onNodeSelect?.(nodeId)
  }, [handleSelectNode, onNodeSelect, selectedNodeId])

  // Render individual tree item with proper state
  const renderTreeItem = React.useCallback((node: VSCodeTreeNode, level: number = 0): React.ReactNode => {
    return (
      <VSCodeTreeItem
        key={node.id}
        node={node}
        level={level}
        isExpanded={isNodeExpanded(node.id)}
        isSelected={isNodeSelected(node.id)}
        isHovered={isNodeHovered(node.id)}
        onToggleExpansion={handleToggleExpansion}
        onSelectNode={handleNodeSelectWithCallback}
        onHoverNode={handleNodeHover}
        onContextMenu={onContextMenu}
        onCreateChild={onCreateFolder}
        showContentCounts={showContentCounts}
      />
    )
  }, [
    isNodeExpanded,
    isNodeSelected,
    isNodeHovered,
    handleToggleExpansion,
    handleNodeSelectWithCallback,
    handleNodeHover,
    onContextMenu,
    onCreateFolder,
    showContentCounts
  ])

  // Recursively render tree structure
  const renderTree = React.useCallback((nodeList: VSCodeTreeNode[], level: number = 0): React.ReactNode[] => {
    return nodeList.map(node => {
      const item = renderTreeItem(node, level)

      // Show children only if node is expanded
      if (isNodeExpanded(node.id) && node.children?.length > 0) {
        return (
          <React.Fragment key={node.id}>
            {item}
            {renderTree(node.children, level + 1)}
          </React.Fragment>
        )
      }

      return item
    })
  }, [renderTreeItem, isNodeExpanded])

  // Memoize the tree rendering for performance
  const treeContent = useMemo(() => {
    return renderTree(sortedNodes)
  }, [renderTree, sortedNodes])

  // Total node count for display
  const totalNodes = useMemo(() => {
    const countNodes = (nodeList: VSCodeTreeNode[]): number => {
      return nodeList.reduce((count, node) => {
        return count + 1 + (node.children ? countNodes(node.children) : 0)
      }, 0)
    }
    return countNodes(sortedNodes)
  }, [sortedNodes])

  return (
    <div className={cn('vscode-folder-tree', className)} role="tree">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-medium studio-text">Folders</h3>
          <span className="text-xs studio-muted">({totalNodes})</span>
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

      {/* Tree Controls */}
      {showTreeControls && (
        <div className="flex items-center justify-between mb-3 px-2">
          <div className="flex items-center space-x-1 text-xs">
            <button
              onClick={expandAll}
              className="studio-muted hover:studio-text transition-colors px-2 py-1 rounded hover:bg-[#1a1a1a]"
              title="Expand all folders"
            >
              Expand All
            </button>
            <span className="studio-muted">•</span>
            <button
              onClick={collapseAll}
              className="studio-muted hover:studio-text transition-colors px-2 py-1 rounded hover:bg-[#1a1a1a]"
              title="Collapse all folders"
            >
              Collapse
            </button>
          </div>
        </div>
      )}

      {/* Tree Content */}
      <div className="vscode-tree-content">
        {sortedNodes.length > 0 ? (
          <div className="space-y-0">
            {treeContent}
          </div>
        ) : (
          <div className="text-center py-8 text-sm studio-muted">
            <FolderPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
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
    </div>
  )
})

// Utility function to convert old FolderNode format to VSCodeTreeNode
export function convertToVSCodeNodes(oldNodes: any[]): VSCodeTreeNode[] {
  return oldNodes.map(node => ({
    id: node.id,
    name: node.name,
    parentId: node.parentId,
    icon: node.icon || 'folder',
    color: node.color || '#888888',
    position: node.position || 0,
    children: node.children ? convertToVSCodeNodes(node.children) : [],
    contentCount: node.contentCount || 0,
    type: 'folder' as const
  }))
}