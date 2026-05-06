'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'

export interface VSCodeTreeNode {
  id: string
  name: string
  parentId?: string
  icon: string
  color: string
  position: number
  children: VSCodeTreeNode[]
  contentCount: number
  type: 'folder' | 'file'
}

export interface VSCodeTreeState {
  expandedNodes: Set<string>
  selectedNode: string | null
  hoveredNode: string | null
}

export function useVSCodeTree(initialNodes: VSCodeTreeNode[] = [], externalSelectedNode?: string | null) {
  // PERSISTENT STATE: Use refs to maintain state across node changes
  // Start with Trading Journal collapsed (empty set)
  const persistentExpandedNodes = useRef<Set<string>>(new Set())
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => persistentExpandedNodes.current)
  const [internalSelectedNode, setInternalSelectedNode] = useState<string | null>('1')
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  // Sync ref with state
  useEffect(() => {
    persistentExpandedNodes.current = expandedNodes
  }, [expandedNodes])

  // Use external selection if provided, otherwise use internal state
  const selectedNode = externalSelectedNode !== undefined ? externalSelectedNode : internalSelectedNode

  // PURE expansion control - no side effects
  const handleToggleExpansion = useCallback((nodeId: string, forceState?: boolean) => {
    console.log('🔍 handleToggleExpansion called:', { nodeId, forceState, currentExpanded: expandedNodes.has(nodeId) })

    // CRITICAL FIX: Never allow Trading Journal (id: '1') to collapse
    if (nodeId === '1') {
      console.log('🚫 Prevented Trading Journal from collapsing')
      return // Don't allow root folder to collapse
    }

    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      const shouldExpand = forceState !== undefined ? forceState : !newSet.has(nodeId)

      if (shouldExpand) {
        newSet.add(nodeId)
      } else {
        newSet.delete(nodeId)
        // Also collapse all children when parent collapses (VS Code behavior)
        const collapseChildren = (nodes: VSCodeTreeNode[], parentId: string) => {
          nodes.forEach(node => {
            if (node.parentId === parentId) {
              newSet.delete(node.id)
              if (node.children.length > 0) {
                collapseChildren(node.children, node.id)
              }
            }
          })
        }

        // Find children and collapse them
        const findAndCollapseChildren = (nodes: VSCodeTreeNode[]) => {
          for (const node of nodes) {
            if (node.id === nodeId && node.children.length > 0) {
              collapseChildren(node.children, nodeId)
              return
            }
            if (node.children.length > 0) {
              findAndCollapseChildren(node.children)
            }
          }
        }

        findAndCollapseChildren(initialNodes)
      }

      return newSet
    })
  }, [initialNodes])

  // PURE selection control - no side effects
  const handleSelectNode = useCallback((nodeId: string) => {
    console.log('🎯 handleSelectNode called:', { nodeId, externalSelectedNode, currentSelected: selectedNode })

    // Only update internal state if we're not using external control
    if (externalSelectedNode === undefined) {
      setInternalSelectedNode(nodeId)
    }
    // NO expansion changes here - this is the key fix!
  }, [externalSelectedNode, selectedNode])

  // Hover management for better UX
  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNode(nodeId)
  }, [])

  // Utility: Check if node is expanded
  const isNodeExpanded = useCallback((nodeId: string) => {
    // ULTIMATE SAFEGUARD: Trading Journal is ALWAYS expanded, no matter what
    if (nodeId === '1') {
      return true
    }
    return expandedNodes.has(nodeId)
  }, [expandedNodes])

  // Utility: Check if node is selected
  const isNodeSelected = useCallback((nodeId: string) => {
    return selectedNode === nodeId
  }, [selectedNode])

  // Utility: Check if node is hovered
  const isNodeHovered = useCallback((nodeId: string) => {
    return hoveredNode === nodeId
  }, [hoveredNode])

  // Utility: Expand all nodes
  const expandAll = useCallback(() => {
    const getAllNodeIds = (nodes: VSCodeTreeNode[]): string[] => {
      const ids: string[] = []
      nodes.forEach(node => {
        ids.push(node.id)
        if (node.children.length > 0) {
          ids.push(...getAllNodeIds(node.children))
        }
      })
      return ids
    }

    setExpandedNodes(new Set(getAllNodeIds(initialNodes)))
  }, [initialNodes])

  // Utility: Collapse all nodes
  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set())
  }, [])

  // Utility: Find node by ID
  const findNode = useCallback((nodeId: string, nodes: VSCodeTreeNode[] = initialNodes): VSCodeTreeNode | null => {
    for (const node of nodes) {
      if (node.id === nodeId) return node
      if (node.children.length > 0) {
        const found = findNode(nodeId, node.children)
        if (found) return found
      }
    }
    return null
  }, [initialNodes])

  // Utility: Get node path (breadcrumb)
  const getNodePath = useCallback((nodeId: string): VSCodeTreeNode[] => {
    const path: VSCodeTreeNode[] = []

    const buildPath = (currentId: string, nodes: VSCodeTreeNode[] = initialNodes): boolean => {
      for (const node of nodes) {
        if (node.id === currentId) {
          path.unshift(node)
          if (node.parentId) {
            buildPath(node.parentId, initialNodes)
          }
          return true
        }
        if (node.children.length > 0) {
          if (buildPath(currentId, node.children)) {
            path.unshift(node)
            return true
          }
        }
      }
      return false
    }

    buildPath(nodeId)
    return path
  }, [initialNodes])

  // Memoized sorted nodes for performance
  const sortedNodes = useMemo(() => {
    const sortNodes = (nodes: VSCodeTreeNode[]): VSCodeTreeNode[] => {
      return [...nodes]
        .sort((a, b) => {
          if (a.position !== b.position) {
            return a.position - b.position
          }
          return a.name.localeCompare(b.name)
        })
        .map(node => ({
          ...node,
          children: node.children.length > 0 ? sortNodes(node.children) : []
        }))
    }

    return sortNodes(initialNodes)
  }, [initialNodes])

  return {
    // State
    nodes: sortedNodes,
    expandedNodes,
    selectedNode,
    hoveredNode,

    // Actions - all pure, no side effects
    handleToggleExpansion,
    handleSelectNode,
    handleNodeHover,

    // Utilities
    isNodeExpanded,
    isNodeSelected,
    isNodeHovered,
    findNode,
    getNodePath,
    expandAll,
    collapseAll,

    // Raw state setters for external control if needed
    setExpandedNodes,
    setSelectedNode: setInternalSelectedNode,
    setHoveredNode
  }
}