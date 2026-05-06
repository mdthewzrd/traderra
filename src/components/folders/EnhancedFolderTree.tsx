'use client'

import React, { useState, useCallback, useMemo } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Briefcase,
  TrendingUp,
  Archive,
  Target,
  BookOpen,
  Plus,
  MoreHorizontal
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DragDropProvider, useDragDrop, useDraggable, useDroppable, DropZone, dragDropUtils } from './DragDropProvider'
import { FolderContextMenu, useFolderContextMenu } from './FolderContextMenu'
import { CreateFolderModal, useCreateFolderModal } from './CreateFolderModal'
import { InlineRename, DeleteConfirmation, MoveFolderModal, useFolderOperations } from './FolderOperations'
import { useToast } from '../ui/Toast'
import { SAMPLE_FOLDERS, SAMPLE_DOCUMENTS, SampleFolder, SampleDocument } from '../../data/sampleContent'

// Enhanced folder interface with operations
interface EnhancedFolder extends SampleFolder {
  children?: EnhancedFolder[]
  isExpanded?: boolean
  documents?: SampleDocument[]
}

interface FolderTreeProps {
  folders: EnhancedFolder[]
  onFolderSelect?: (folderId: string) => void
  onDocumentSelect?: (documentId: string) => void
  selectedFolderId?: string
  selectedDocumentId?: string
  className?: string
}

interface FolderItemProps {
  folder: EnhancedFolder
  level: number
  onFolderSelect?: (folderId: string) => void
  onDocumentSelect?: (documentId: string) => void
  selectedFolderId?: string
  selectedDocumentId?: string
  onToggleExpanded: (folderId: string) => void
  onCreateFolder: (parentId: string) => void
  onRenameFolder: (folderId: string, newName: string) => void
  onDeleteFolder: (folderId: string) => void
  onMoveFolder: (folderId: string, newParentId: string | null) => void
}

// Icon mapping
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  folder: Folder,
  'folder-open': FolderOpen,
  briefcase: Briefcase,
  'trending-up': TrendingUp,
  'file-text': FileText,
  archive: Archive,
  target: Target,
  'book-open': BookOpen,
}

function FolderItem({
  folder,
  level,
  onFolderSelect,
  onDocumentSelect,
  selectedFolderId,
  selectedDocumentId,
  onToggleExpanded,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder
}: FolderItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const { contextMenu, openContextMenu, closeContextMenu } = useFolderContextMenu()
  const { operations, startRename, cancelRename, startDelete, cancelDelete, startMove, cancelMove } = useFolderOperations()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const { addToast } = useToast()

  const Icon = ICON_MAP[folder.icon] || Folder
  const hasChildren = folder.children && folder.children.length > 0
  const hasDocuments = folder.documents && folder.documents.length > 0
  // Enhanced path detection for persistent breadcrumb navigation
  const pathInfo = React.useMemo(() => {
    if (!selectedFolderId) return { isSelected: false, isInPath: false, pathDepth: 0 }

    // Direct selection
    if (selectedFolderId === folder.id) {
      return { isSelected: true, isInPath: true, pathDepth: 0 }
    }

    // Check if this folder is an ancestor of the selected folder
    const pathToSelected = getParentFolderIds(selectedFolderId, SAMPLE_FOLDERS)
    const isInPath = pathToSelected.includes(folder.id)

    // Calculate how many levels up this folder is from the selected one
    const pathDepth = isInPath ? pathToSelected.indexOf(folder.id) + 1 : 0

    return { isSelected: false, isInPath, pathDepth }
  }, [selectedFolderId, folder.id])

  const isDirectlySelected = pathInfo.isSelected
  const isInSelectedPath = pathInfo.isInPath
  const isExpanded = folder.isExpanded

  // Drag and drop functionality
  const dragData = useMemo(() => ({
    type: 'folder' as const,
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId
  }), [folder.id, folder.name, folder.parentId])

  const dragPreview = (
    <div className="flex items-center space-x-2 text-sm">
      <Icon className="w-4 h-4" style={{ color: folder.color }} />
      <span>{folder.name}</span>
    </div>
  )

  const { draggableProps } = useDraggable(dragData, dragPreview)

  const dropTarget = useMemo(() => ({
    type: 'folder' as const,
    id: folder.id,
    parentId: folder.parentId
  }), [folder.id, folder.parentId])

  const { droppableProps, isOver } = useDroppable(
    dropTarget,
    (data) => dragDropUtils.canDropFolderInFolder(data, folder.id)
  )

  // Event handlers
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (operations.rename.active && operations.rename.folderId === folder.id) return

    // Single click should ALWAYS do both actions for folders with children
    // 1. First select the folder
    onFolderSelect?.(folder.id)

    // 2. Then ensure expansion if it has children/documents and is not already expanded
    if ((hasChildren || hasDocuments) && !isExpanded) {
      onToggleExpanded(folder.id)
    }
  }, [folder.id, onFolderSelect, onToggleExpanded, operations.rename, hasChildren, hasDocuments, isExpanded])

  const handleToggleExpanded = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleExpanded(folder.id)
  }, [folder.id, onToggleExpanded])

  const handleRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    openContextMenu(folder.id, folder.name, e)
  }, [folder.id, folder.name, openContextMenu])

  const handleRename = useCallback(async (newName: string) => {
    try {
      await onRenameFolder(folder.id, newName)
      cancelRename()
      addToast({ type: 'success', title: 'Folder renamed', message: `"${folder.name}" renamed to "${newName}"` })
    } catch (error) {
      addToast({ type: 'error', title: 'Failed to rename folder', message: 'Please try again' })
    }
  }, [folder.id, folder.name, onRenameFolder, cancelRename, addToast])

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)
    try {
      await onDeleteFolder(folder.id)
      cancelDelete()
      addToast({ type: 'success', title: 'Folder deleted', message: `"${folder.name}" has been deleted` })
    } catch (error) {
      addToast({ type: 'error', title: 'Failed to delete folder', message: 'Please try again' })
    } finally {
      setIsDeleting(false)
    }
  }, [folder.id, folder.name, onDeleteFolder, cancelDelete, addToast])

  const handleMove = useCallback(async (folderId: string, newParentId: string | null) => {
    setIsMoving(true)
    try {
      await onMoveFolder(folderId, newParentId)
      cancelMove()
      addToast({ type: 'success', title: 'Folder moved', message: `"${folder.name}" has been moved` })
    } catch (error) {
      addToast({ type: 'error', title: 'Failed to move folder', message: 'Please try again' })
    } finally {
      setIsMoving(false)
    }
  }, [folder.name, onMoveFolder, cancelMove, addToast])

  const handleContextMenuAction = useCallback((action: string) => {
    closeContextMenu()

    switch (action) {
      case 'rename':
        startRename(folder.id, folder.name)
        break
      case 'delete':
        const childCount = (folder.children?.length || 0) + (folder.documents?.length || 0)
        startDelete(folder.id, folder.name, childCount)
        break
      case 'createSubfolder':
        onCreateFolder(folder.id)
        break
      case 'move':
        startMove(folder.id, folder.name)
        break
    }
  }, [folder, closeContextMenu, startRename, startDelete, startMove, onCreateFolder])

  // Get available folders for move operation (excluding current folder and its descendants)
  const availableFolders = SAMPLE_FOLDERS.filter(f =>
    f.id !== folder.id && !f.parentId?.startsWith(folder.id)
  )

  return (
    <>
      <div
        data-testid={`folder-${folder.id}`}
        className={cn(
          'group relative flex items-center py-1 px-2 rounded-lg transition-all duration-200',
          'hover:bg-[#1a1a1a] cursor-pointer select-none',
          // Direct selection gets full gold highlighting
          isDirectlySelected && 'bg-primary/15 border border-primary/40 shadow-sm',
          // Parent folders get graduated highlighting based on depth (closer = brighter)
          isInSelectedPath && !isDirectlySelected && pathInfo.pathDepth === 1 && 'bg-primary/10 border border-primary/30',
          isInSelectedPath && !isDirectlySelected && pathInfo.pathDepth === 2 && 'bg-primary/8 border border-primary/25',
          isInSelectedPath && !isDirectlySelected && pathInfo.pathDepth >= 3 && 'bg-primary/6 border border-primary/20',
          isOver && 'bg-primary/20 border border-primary/50',
          operations.rename.active && operations.rename.folderId === folder.id && 'bg-[#1a1a1a]'
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleRightClick}
        {...draggableProps}
        {...droppableProps}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Expand/Collapse Toggle */}
        <div className="flex-shrink-0 w-6 flex justify-center">
          {(hasChildren || hasDocuments) ? (
            <button
              onClick={handleToggleExpanded}
              className="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
              title={isExpanded ? 'Collapse folder' : 'Expand folder'}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-gray-400 hover:text-gray-200" />
              ) : (
                <ChevronRight className="w-3 h-3 text-gray-400 hover:text-gray-200" />
              )}
            </button>
          ) : (
            <div className="w-3 h-3" />
          )}
        </div>

        {/* Icon */}
        <div className="flex-shrink-0 ml-1 mr-3">
          <Icon className="w-4 h-4" style={{ color: folder.color } as React.CSSProperties} />
        </div>

        {/* Name / Rename Input */}
        <div className="flex-1 min-w-0">
          {operations.rename.active && operations.rename.folderId === folder.id ? (
            <InlineRename
              isActive={true}
              currentName={operations.rename.currentName}
              onSave={handleRename}
              onCancel={cancelRename}
            />
          ) : (
            <span className="text-sm studio-text truncate block">{folder.name}</span>
          )}
        </div>

        {/* Action Buttons */}
        {isHovered && !operations.rename.active && (
          <div className="flex-shrink-0 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCreateFolder(folder.id)
              }}
              className="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
              title="Create subfolder"
            >
              <Plus className="w-3 h-3 text-gray-400" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleRightClick(e)
              }}
              className="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-3 h-3 text-gray-400" />
            </button>
          </div>
        )}
      </div>

      {/* Drop zone after folder */}
      <DropZone
        target={{
          type: 'between',
          parentId: folder.parentId,
          position: folder.position + 1
        }}
        canDrop={(data) => data.type === 'folder'}
        className="h-1 mx-4"
      />

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="ml-2">
          {folder.children?.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              level={level + 1}
              onFolderSelect={onFolderSelect}
              onDocumentSelect={onDocumentSelect}
              selectedFolderId={selectedFolderId}
              selectedDocumentId={selectedDocumentId}
              onToggleExpanded={onToggleExpanded}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onMoveFolder={onMoveFolder}
            />
          ))}
        </div>
      )}

      {/* Documents */}
      {isExpanded && hasDocuments && (
        <div className="ml-2">
          {folder.documents?.map((document) => (
            <DocumentItem
              key={document.id}
              document={document}
              level={level + 1}
              onDocumentSelect={onDocumentSelect}
              selectedDocumentId={selectedDocumentId}
            />
          ))}
        </div>
      )}

      {/* Context Menu */}
      <FolderContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        folderId={contextMenu.folderId}
        folderName={contextMenu.folderName}
        onClose={closeContextMenu}
        onRename={() => handleContextMenuAction('rename')}
        onDelete={() => handleContextMenuAction('delete')}
        onCreateSubfolder={() => handleContextMenuAction('createSubfolder')}
        onMove={() => handleContextMenuAction('move')}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmation
        isOpen={operations.delete.active && operations.delete.folderId === folder.id}
        folderName={operations.delete.folderName}
        childCount={operations.delete.childCount}
        onConfirm={handleDelete}
        onCancel={cancelDelete}
        isDeleting={isDeleting}
      />

      {/* Move Modal */}
      <MoveFolderModal
        isOpen={operations.move.active && operations.move.folderId === folder.id}
        folderId={operations.move.folderId}
        folderName={operations.move.folderName}
        availableFolders={availableFolders}
        onMove={handleMove}
        onCancel={cancelMove}
        isMoving={isMoving}
      />
    </>
  )
}

// Document item component
interface DocumentItemProps {
  document: SampleDocument
  level: number
  onDocumentSelect?: (documentId: string) => void
  selectedDocumentId?: string
}

function DocumentItem({ document, level, onDocumentSelect, selectedDocumentId }: DocumentItemProps) {
  const isSelected = selectedDocumentId === document.id

  const handleClick = useCallback(() => {
    onDocumentSelect?.(document.id)
  }, [document.id, onDocumentSelect])

  return (
    <div
      className={cn(
        'flex items-center py-1 px-2 rounded-lg transition-all duration-200',
        'hover:bg-[#1a1a1a] cursor-pointer select-none',
        isSelected && 'bg-primary/10 border border-primary/30'
      )}
      style={{ paddingLeft: `${level * 20 + 8}px` }}
      onClick={handleClick}
    >
      <div className="flex-shrink-0 ml-4 mr-3">
        <FileText className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm studio-text truncate block">{document.title}</span>
        <div className="flex items-center space-x-2 mt-0.5">
          <span className="text-xs text-gray-500 capitalize">{document.type.replace('_', ' ')}</span>
          {document.tags.length > 0 && (
            <span className="text-xs text-gray-500">
              {document.tags.slice(0, 2).join(', ')}
              {document.tags.length > 2 && '...'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper function to get all parent folder IDs for a given folder
function getParentFolderIds(folderId: string, folders: SampleFolder[]): string[] {
  const parentIds: string[] = []
  const folder = folders.find(f => f.id === folderId)

  if (folder?.parentId) {
    parentIds.push(folder.parentId)
    parentIds.push(...getParentFolderIds(folder.parentId, folders))
  }

  return parentIds
}

// Main enhanced folder tree component
// Helper function to load expanded folders from localStorage
function loadExpandedFolders(): Set<string> {
  if (typeof window === 'undefined') return new Set(['trading-journal', 'strategies', 'trades-2024'])

  try {
    const saved = localStorage.getItem('traderra-expanded-folders')
    if (saved) {
      const parsed = JSON.parse(saved)
      return new Set(Array.isArray(parsed) ? parsed : ['trading-journal', 'strategies', 'trades-2024'])
    }
  } catch (error) {
    console.warn('Failed to load expanded folders from localStorage:', error)
  }

  return new Set(['trading-journal', 'strategies', 'trades-2024'])
}

// Helper function to save expanded folders to localStorage
function saveExpandedFolders(expandedFolders: Set<string>) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem('traderra-expanded-folders', JSON.stringify(Array.from(expandedFolders)))
  } catch (error) {
    console.warn('Failed to save expanded folders to localStorage:', error)
  }
}

export function EnhancedFolderTree({
  folders,
  onFolderSelect,
  onDocumentSelect,
  selectedFolderId,
  selectedDocumentId,
  className
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(loadExpandedFolders())
  const { modal, openModal, closeModal } = useCreateFolderModal()
  const { addToast } = useToast()

  // Auto-expand parent folders when a folder is selected
  React.useEffect(() => {
    if (selectedFolderId) {
      const parentIds = getParentFolderIds(selectedFolderId, SAMPLE_FOLDERS)
      if (parentIds.length > 0) {
        setExpandedFolders(prev => {
          const next = new Set(prev)
          parentIds.forEach(id => next.add(id))
          saveExpandedFolders(next)
          return next
        })
      }
    }
  }, [selectedFolderId])

  // Save expanded folders to localStorage whenever they change
  React.useEffect(() => {
    saveExpandedFolders(expandedFolders)
  }, [expandedFolders])

  // Build folder hierarchy with documents
  const enhancedFolders = useMemo(() => {
    const buildHierarchy = (folders: SampleFolder[], parentId?: string): EnhancedFolder[] => {
      return folders
        .filter(folder => folder.parentId === parentId)
        .sort((a, b) => a.position - b.position)
        .map(folder => ({
          ...folder,
          isExpanded: expandedFolders.has(folder.id),
          children: buildHierarchy(folders, folder.id),
          documents: SAMPLE_DOCUMENTS.filter(doc => doc.folderId === folder.id)
        }))
    }

    return buildHierarchy(SAMPLE_FOLDERS)
  }, [expandedFolders])

  // Event handlers
  const handleToggleExpanded = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }, [])

  const handleCreateFolder = useCallback((parentId?: string) => {
    const parentFolder = SAMPLE_FOLDERS.find(f => f.id === parentId)
    openModal(parentId, parentFolder?.name)
  }, [openModal])

  const handleFolderCreated = useCallback(async (folderData: any) => {
    // In a real app, this would make an API call
    console.log('Creating folder:', folderData)
    addToast({
      type: 'success',
      title: 'Folder created',
      message: `"${folderData.name}" has been created`
    })
  }, [addToast])

  const handleRenameFolder = useCallback(async (folderId: string, newName: string) => {
    // In a real app, this would make an API call
    console.log('Renaming folder:', folderId, 'to', newName)
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
  }, [])

  const handleDeleteFolder = useCallback(async (folderId: string) => {
    // In a real app, this would make an API call
    console.log('Deleting folder:', folderId)
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
  }, [])

  const handleMoveFolder = useCallback(async (folderId: string, newParentId: string | null) => {
    // In a real app, this would make an API call
    console.log('Moving folder:', folderId, 'to parent:', newParentId)
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800))
  }, [])

  const handleDrop = useCallback((dragData: any, dropTarget: any) => {
    console.log('Drop operation:', dragData, 'onto', dropTarget)
    addToast({
      type: 'info',
      title: 'Folder moved',
      message: `"${dragData.name}" moved successfully`
    })
  }, [addToast])

  return (
    <DragDropProvider onDrop={handleDrop}>
      <div className={cn('space-y-1', className)}>
        {/* Create root folder button */}
        <div className="flex items-center justify-between p-2 border-b border-[#333]">
          <h3 className="text-sm font-medium studio-text">Folders</h3>
          <button
            onClick={() => handleCreateFolder()}
            className="p-1 hover:bg-[#1a1a1a] rounded transition-colors"
            title="Create new folder"
          >
            <Plus className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Folder tree */}
        <div className="space-y-0.5">
          {enhancedFolders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              level={0}
              onFolderSelect={onFolderSelect}
              onDocumentSelect={onDocumentSelect}
              selectedFolderId={selectedFolderId}
              selectedDocumentId={selectedDocumentId}
              onToggleExpanded={handleToggleExpanded}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
              onMoveFolder={handleMoveFolder}
            />
          ))}
        </div>

        {/* Drop zone at the end */}
        <DropZone
          target={{
            type: 'root',
            position: enhancedFolders.length
          }}
          canDrop={(data) => data.type === 'folder'}
          className="h-2 mx-4"
        />
      </div>

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={modal.isOpen}
        parentId={modal.parentId}
        parentName={modal.parentName}
        onClose={closeModal}
        onCreateFolder={handleFolderCreated}
      />
    </DragDropProvider>
  )
}