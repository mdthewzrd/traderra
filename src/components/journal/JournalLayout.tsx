'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  PanelLeft,
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Grid,
  List,
  Settings,
  BookOpen,
  Folder
} from 'lucide-react'
import { cn } from '@/lib/utils'

import { FolderNode, buildFolderTree, FolderTree } from '../folders/FolderTree'
import { FolderContextMenu, useFolderContextMenu } from '../folders/FolderContextMenu'
import { DragDropProvider } from '../folders/DragDropProvider'
import { JournalFilters } from './journal-components'

interface JournalLayoutProps {
  children: React.ReactNode
  className?: string
  selectedFolderId?: string
  onFolderSelect?: (folderId: string) => void
  expandedFolderIds?: Set<string>
  onFolderExpand?: (folderId: string, expanded: boolean) => void
  onCreateFolder?: (name?: string, parentId?: string) => void
  showNewEntryButton?: boolean
  onNewEntry?: () => void
  folders?: FolderNode[]
  foldersLoading?: boolean
}

interface SidebarProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
  folders: FolderNode[]
  selectedFolderId?: string
  onFolderSelect: (folderId: string) => void
  onFolderCreate: () => void
  onFolderContextMenu: (folderId: string, folderName: string, event: React.MouseEvent) => void
  expandedFolderIds?: Set<string>
  onFolderExpand?: (folderId: string, expanded: boolean) => void
}

interface MainContentProps {
  children: React.ReactNode
  selectedFolder?: FolderNode
  onCreateContent: () => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  showFilters: boolean
  onToggleFilters: () => void
  showNewEntryButton?: boolean
}

function Sidebar({
  isCollapsed,
  onToggleCollapse,
  folders,
  selectedFolderId,
  onFolderSelect,
  onFolderCreate,
  onFolderContextMenu,
  expandedFolderIds = new Set(),
  onFolderExpand
}: SidebarProps) {
  // Switch to simple FolderTree - reliable custom implementation
  console.log('🚩 Sidebar render - Using custom FolderTree')

  // Use folders directly since they're already in tree format
  const treeData = useMemo(() => {
    console.log('🌲 Using folder tree structure:', {
      folderCount: folders.length,
      folderStructure: JSON.stringify(folders, null, 2)
    })
    return folders
  }, [folders])

  // VS Code-style context menu handler
  const handleContextMenu = useCallback((nodeId: string, event: React.MouseEvent) => {
    // Find the folder to get its name
    const findFolder = (folders: FolderNode[]): FolderNode | undefined => {
      for (const folder of folders) {
        if (folder.id === nodeId) return folder
        if (folder.children) {
          const found = findFolder(folder.children)
          if (found) return found
        }
      }
      return undefined
    }

    const folder = findFolder(folders)
    if (folder) {
      onFolderContextMenu(nodeId, folder.name, event)
    }
  }, [folders, onFolderContextMenu])

  // Removed legacy handlers - SimpleFolderTree manages its own state

  if (isCollapsed) {
    return (
      <div className="w-12 bg-[#0a0a0a] border-r studio-border flex flex-col">
        <button
          onClick={onToggleCollapse}
          className="p-3 hover:bg-[#1a1a1a] transition-colors border-b studio-border"
          aria-label="Expand sidebar"
        >
          <PanelLeft className="w-5 h-5 studio-muted" />
        </button>

        <div className="flex-1 flex flex-col items-center space-y-2 p-2">
          <button
            onClick={onFolderCreate}
            className="p-2 rounded hover:bg-[#1a1a1a] transition-colors"
            aria-label="Create folder"
          >
            <Folder className="w-5 h-5 studio-muted" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 bg-[#0a0a0a] border-r studio-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b studio-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold studio-text">Journal</h1>
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded hover:bg-[#1a1a1a] transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4 studio-muted" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onFolderCreate}
            className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-primary hover:bg-primary/90 text-black rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">New Folder</span>
          </button>
        </div>
      </div>

      {/* FolderTree Navigation - Custom reliable implementation */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <FolderTree
            folders={treeData}
            selectedFolderId={selectedFolderId}
            expandedFolderIds={expandedFolderIds}
            onFolderSelect={onFolderSelect}
            onFolderExpand={onFolderExpand}
            onFolderCreate={onFolderCreate}
            onFolderContextMenu={(folderId, event) => {
              // Find the folder to get its name
              const findFolder = (folders: FolderNode[]): FolderNode | undefined => {
                for (const folder of folders) {
                  if (folder.id === folderId) return folder
                  if (folder.children) {
                    const found = findFolder(folder.children)
                    if (found) return found
                  }
                }
                return undefined
              }

              const folder = findFolder(folders)
              if (folder) {
                onFolderContextMenu(folderId, folder.name, event)
              }
            }}
            showCreateButton={false}
            showContentCounts={true}
            className="flex-1"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t studio-border">
        <div className="flex items-center justify-between text-xs studio-muted">
          <span>Traderra Journal</span>
          <button className="p-1 rounded hover:bg-[#1a1a1a] transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function MainContent({
  children,
  selectedFolder,
  onCreateContent,
  viewMode,
  onViewModeChange,
  showFilters,
  onToggleFilters,
  showNewEntryButton = true
}: MainContentProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Content Header */}
      <div className="bg-[#0a0a0a] border-b studio-border p-4">
        <div className="flex items-center justify-between">
          {/* Breadcrumb / Title */}
          <div className="flex items-center space-x-2">
            {selectedFolder ? (
              <>
                <Folder className="w-5 h-5" style={{ color: selectedFolder.color }} />
                <h2 className="text-lg font-semibold studio-text">{selectedFolder.name}</h2>
                {selectedFolder.contentCount > 0 && (
                  <span className="text-sm studio-muted bg-[#1a1a1a] px-2 py-1 rounded">
                    {selectedFolder.contentCount} items
                  </span>
                )}
                <span className="text-xs studio-muted bg-green-500/20 text-green-400 px-2 py-1 rounded">
                  ✓ Selected
                </span>
              </>
            ) : (
              <>
                <BookOpen className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold studio-text">All Entries</h2>
                <span className="text-xs studio-muted">Select a folder from the sidebar to filter entries</span>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#1a1a1a] rounded-lg p-1">
              <button
                onClick={() => onViewModeChange('grid')}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  viewMode === 'grid' ? 'bg-primary text-black' : 'studio-muted hover:studio-text'
                )}
                aria-label="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  viewMode === 'list' ? 'bg-primary text-black' : 'studio-muted hover:studio-text'
                )}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Filters Toggle */}
            <button
              onClick={onToggleFilters}
              className={cn(
                'p-2 rounded-lg transition-colors',
                showFilters ? 'bg-primary text-black' : 'bg-[#1a1a1a] studio-muted hover:studio-text'
              )}
              aria-label="Toggle filters"
            >
              <Filter className="w-4 h-4" />
            </button>

            {/* Create Content */}
            {showNewEntryButton && (
              <button
                onClick={onCreateContent}
                className="flex items-center space-x-2 px-4 py-2 bg-primary hover:bg-primary/90 text-black rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">New Entry</span>
              </button>
            )}

            {/* More Options */}
            <button className="p-2 rounded-lg bg-[#1a1a1a] studio-muted hover:studio-text transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </div>
  )
}

export function JournalLayout({
  children,
  className,
  selectedFolderId: propSelectedFolderId,
  onFolderSelect,
  expandedFolderIds: propExpandedFolderIds,
  onFolderExpand: propOnFolderExpand,
  onCreateFolder,
  showNewEntryButton = false,
  onNewEntry,
  folders: propFolders,
  foldersLoading
}: JournalLayoutProps) {
  // Layout state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [showFilters, setShowFilters] = useState(false)

  // Folder state
  const [internalFolders, setInternalFolders] = useState<FolderNode[]>([])
  const [internalSelectedFolderId, setInternalSelectedFolderId] = useState<string>()

  // TEMP FIX: Use mock folders while API is loading or if both prop and internal folders are empty
  const mockFolders = [
    {
      id: 'folder-1',
      name: 'Trading Journal',
      parentId: undefined,
      icon: 'journal-text',
      color: '#3B82F6',
      position: 0,
      contentCount: 3,
      children: [
        {
          id: 'folder-1-1',
          name: 'Daily Trades',
          parentId: 'folder-1',
          icon: 'calendar',
          color: '#10B981',
          position: 1,
          contentCount: 2,
          children: []
        },
        {
          id: 'folder-1-2',
          name: 'Weekly Reviews',
          parentId: 'folder-1',
          icon: 'star',
          color: '#F59E0B',
          position: 2,
          contentCount: 1,
          children: []
        }
      ]
    },
    {
      id: 'folder-2',
      name: 'Strategies',
      parentId: undefined,
      icon: 'target',
      color: '#F59E0B',
      position: 1,
      contentCount: 2,
      children: [
        {
          id: 'folder-2-1',
          name: 'Swing Trading',
          parentId: 'folder-2',
          icon: 'trending-up',
          color: '#EF4444',
          position: 1,
          contentCount: 1,
          children: []
        },
        {
          id: 'folder-2-2',
          name: 'Day Trading',
          parentId: 'folder-2',
          icon: 'trending-up',
          color: '#EF4444',
          position: 2,
          contentCount: 1,
          children: []
        }
      ]
    },
    {
      id: 'folder-3',
      name: 'Research',
      parentId: undefined,
      icon: 'search',
      color: '#8B5CF6',
      position: 2,
      contentCount: 1,
      children: []
    }
  ]

  // Use prop folders, internal folders, or mock folders as fallback
  const folders = (propFolders && propFolders.length > 0) ? propFolders :
                  (internalFolders.length > 0) ? internalFolders :
                  mockFolders

  console.log('📁 JournalLayout folder state:', {
    propFolders: propFolders?.length || 0,
    internalFolders: internalFolders.length,
    finalFolders: folders.length,
    usingMockFolders: folders === mockFolders,
    foldersLoading
  })

  // Use prop OR internal state for selected folder (not both to avoid conflicts)
  const selectedFolderId = propSelectedFolderId !== undefined ? propSelectedFolderId : internalSelectedFolderId

  // Use prop expansion state if provided, otherwise use internal state
  const [internalExpandedFolderIds, setInternalExpandedFolderIds] = useState<Set<string>>(new Set(['folder-1', 'folder-2'])) // Auto-expand for better UX
  const expandedFolderIds = propExpandedFolderIds || internalExpandedFolderIds

  // Context menu state
  const { contextMenu, openContextMenu, closeContextMenu } = useFolderContextMenu()

  // Load initial folder structure and set defaults
  useEffect(() => {
    console.log('🔄 useEffect triggered:', {
      propFolders: !!propFolders,
      propFoldersLength: propFolders?.length || 0,
      internalFoldersLength: internalFolders.length,
      condition: (!propFolders || propFolders.length === 0) && internalFolders.length === 0
    })

    if ((!propFolders || propFolders.length === 0) && internalFolders.length === 0) {
      console.log('✅ Loading mock folders...')
      // TODO: Load from API when no prop folders provided
      const mockFolders = [
        {
          id: 'folder-1',
          name: 'Trading Journal',
          parentId: undefined,
          icon: 'journal-text',
          color: '#3B82F6',
          position: 0,
          contentCount: 3
        },
        {
          id: 'folder-1-1',
          name: 'Daily Trades',
          parentId: 'folder-1',
          icon: 'calendar',
          color: '#10B981',
          position: 1,
          contentCount: 2
        },
        {
          id: 'folder-1-2',
          name: 'Weekly Reviews',
          parentId: 'folder-1',
          icon: 'star',
          color: '#F59E0B',
          position: 2,
          contentCount: 1
        },
        {
          id: 'folder-2',
          name: 'Strategies',
          parentId: undefined,
          icon: 'target',
          color: '#F59E0B',
          position: 1,
          contentCount: 2
        },
        {
          id: 'folder-2-1',
          name: 'Swing Trading',
          parentId: 'folder-2',
          icon: 'trending-up',
          color: '#EF4444',
          position: 1,
          contentCount: 1
        },
        {
          id: 'folder-2-2',
          name: 'Day Trading',
          parentId: 'folder-2',
          icon: 'trending-up',
          color: '#EF4444',
          position: 2,
          contentCount: 1
        },
        {
          id: 'folder-3',
          name: 'Research',
          parentId: undefined,
          icon: 'search',
          color: '#8B5CF6',
          position: 2,
          contentCount: 1
        }
      ]

      // Convert flat mockFolders to tree structure using buildFolderTree
      const treeFolders = buildFolderTree(mockFolders)
      setInternalFolders(treeFolders)

      // Set default selection to Daily Trades folder if no folder is already selected
      if (!propSelectedFolderId && !internalSelectedFolderId) {
        setInternalSelectedFolderId('folder-1-1')
      }

      // Auto-expand Trading Journal and Trade Entries for better UX
      // REMOVED: This was interfering with VS Code tree state management
      // setExpandedFolderIds(new Set(['1', '2']))
    }
  }, [])

  // FolderTree selection handler
  const handleFolderSelect = useCallback((folderId: string) => {
    console.log('📋 FolderTree handleFolderSelect:', { folderId, hasParentCallback: !!onFolderSelect })

    // Update internal state if not controlled by parent
    if (propSelectedFolderId === undefined) {
      setInternalSelectedFolderId(folderId)
    }

    // Notify parent component if callback provided
    if (onFolderSelect) {
      onFolderSelect(folderId)
    }
  }, [onFolderSelect, propSelectedFolderId])

  const handleFolderExpand = useCallback((folderId: string, expanded: boolean) => {
    console.log('📂 handleFolderExpand:', { folderId, expanded })

    // Use prop callback if provided, otherwise use internal state
    if (propOnFolderExpand) {
      propOnFolderExpand(folderId, expanded)
    } else {
      setInternalExpandedFolderIds(prev => {
        const newSet = new Set(prev)
        if (expanded) {
          newSet.add(folderId)
        } else {
          newSet.delete(folderId)
        }
        return newSet
      })
    }
  }, [propOnFolderExpand])

  const handleFolderCreate = useCallback(() => {
    if (onCreateFolder) {
      onCreateFolder()
    } else {
      // TODO: Open create folder modal
      console.log('Create folder')
    }
  }, [onCreateFolder])

  const handleFolderContextMenu = useCallback((folderId: string, folderName: string, event: React.MouseEvent) => {
    openContextMenu(folderId, folderName, event)
  }, [openContextMenu])

  const handleCreateContent = useCallback(() => {
    if (onNewEntry) {
      onNewEntry()
    } else {
      // TODO: Open create content modal
      console.log('Create content in folder:', selectedFolderId)
    }
  }, [onNewEntry, selectedFolderId])

  const handleDragDrop = useCallback((dragData: any, dropTarget: any) => {
    // TODO: Implement drag and drop logic
    console.log('Drag drop:', { dragData, dropTarget })
  }, [])

  // Find selected folder
  const selectedFolder = useMemo(() => {
    if (!selectedFolderId) return undefined

    const findFolder = (folders: FolderNode[]): FolderNode | undefined => {
      for (const folder of folders) {
        if (folder.id === selectedFolderId) return folder
        const found = findFolder(folder.children)
        if (found) return found
      }
      return undefined
    }

    return findFolder(folders)
  }, [folders, selectedFolderId])

  return (
    <DragDropProvider onDrop={handleDragDrop}>
      <div className={cn('journal-layout flex flex-1 h-full bg-studio-bg', className)} data-testid="journal-layout">
        {/* Sidebar */}
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          folders={folders}
          selectedFolderId={selectedFolderId}
          onFolderSelect={handleFolderSelect}
          onFolderCreate={handleFolderCreate}
          onFolderContextMenu={handleFolderContextMenu}
          expandedFolderIds={expandedFolderIds}
          onFolderExpand={handleFolderExpand}
        />

        {/* Main Content */}
        <MainContent
          selectedFolder={selectedFolder}
          onCreateContent={handleCreateContent}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          showNewEntryButton={showNewEntryButton}
        >
          {/* Filters */}
          {showFilters && (
            <div className="border-b studio-border">
              <JournalFilters
                filters={{
                  search: '',
                  category: '',
                  emotion: '',
                  symbol: '',
                  rating: 0
                }}
                onFiltersChange={() => {
                  // TODO: Implement filter changes
                }}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-h-0">
            {children}
          </div>
        </MainContent>

        {/* Context Menu */}
        <FolderContextMenu
          {...contextMenu}
          onClose={closeContextMenu}
          onRename={(folderId) => {
            console.log('Rename folder:', folderId)
          }}
          onDelete={(folderId) => {
            console.log('Delete folder:', folderId)
          }}
          onCreateSubfolder={(parentId) => {
            console.log('Create subfolder in:', parentId)
          }}
          onMove={(folderId) => {
            console.log('Move folder:', folderId)
          }}
          onCopy={(folderId) => {
            console.log('Copy folder:', folderId)
          }}
          onChangeIcon={(folderId) => {
            console.log('Change icon for:', folderId)
          }}
          onChangeColor={(folderId) => {
            console.log('Change color for:', folderId)
          }}
          onSettings={(folderId) => {
            console.log('Folder settings:', folderId)
          }}
          onInfo={(folderId) => {
            console.log('Folder info:', folderId)
          }}
        />
      </div>
    </DragDropProvider>
  )
}