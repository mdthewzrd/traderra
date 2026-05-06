/**
 * Traderra Folder Management Hooks
 *
 * React hooks for managing folder state, operations, and API integration.
 * Provides optimistic updates, error handling, and loading states.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { FolderNode } from '@/components/folders/FolderTree'
import {
  folderApi,
  folderApiUtils,
  FolderCreateRequest,
  FolderUpdateRequest,
  FolderMoveRequest,
  ContentItemCreateRequest,
  ContentItemUpdateRequest,
  ApiContentItemWithFolder,
  FolderApiError
} from '@/services/folderApi'

// Query keys for react-query
export const folderQueryKeys = {
  all: ['folders'] as const,
  tree: (userId: string) => [...folderQueryKeys.all, 'tree', userId] as const,
  folder: (folderId: string, userId: string) => [...folderQueryKeys.all, 'folder', folderId, userId] as const,
  stats: (folderId: string, userId: string) => [...folderQueryKeys.all, 'stats', folderId, userId] as const,
  content: {
    all: ['content'] as const,
    list: (params: any) => [...folderQueryKeys.content.all, 'list', params] as const,
    item: (contentId: string, userId: string) => [...folderQueryKeys.content.all, 'item', contentId, userId] as const,
  }
}

// ============================
// FOLDER HOOKS
// ============================

/**
 * Hook for managing folder tree state and operations
 */
export function useFolderTree(userId: string, enabled = true) {
  const queryClient = useQueryClient()

  // Fetch folder tree
  const {
    data: treeResponse,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: folderQueryKeys.tree(userId),
    queryFn: () => folderApi.getFolderTree(userId),
    enabled: !!userId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  })

  // Convert API response to FolderNode array
  const folders = useMemo(() => {
    if (!treeResponse) return []
    return folderApiUtils.folderTreeResponseToNodes(treeResponse)
  }, [treeResponse])

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: (data: FolderCreateRequest) => folderApi.createFolder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.tree(userId) })
      toast.success('Folder created successfully')
    },
    onError: (error: FolderApiError) => {
      toast.error(`Failed to create folder: ${error.message}`)
    }
  })

  // Update folder mutation
  const updateFolderMutation = useMutation({
    mutationFn: ({ folderId, data }: { folderId: string; data: FolderUpdateRequest }) =>
      folderApi.updateFolder(folderId, userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.tree(userId) })
      toast.success('Folder updated successfully')
    },
    onError: (error: FolderApiError) => {
      toast.error(`Failed to update folder: ${error.message}`)
    }
  })

  // Move folder mutation
  const moveFolderMutation = useMutation({
    mutationFn: ({ folderId, data }: { folderId: string; data: FolderMoveRequest }) =>
      folderApi.moveFolder(folderId, userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.tree(userId) })
      toast.success('Folder moved successfully')
    },
    onError: (error: FolderApiError) => {
      toast.error(`Failed to move folder: ${error.message}`)
    }
  })

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: ({ folderId, force }: { folderId: string; force?: boolean }) =>
      folderApi.deleteFolder(folderId, userId, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.tree(userId) })
      toast.success('Folder deleted successfully')
    },
    onError: (error: FolderApiError) => {
      toast.error(`Failed to delete folder: ${error.message}`)
    }
  })

  // Convenience methods
  const createFolder = useCallback((
    name: string,
    parentId?: string,
    options: Partial<FolderCreateRequest> = {}
  ) => {
    const data = folderApiUtils.createFolderRequest(name, userId, parentId, options)
    return createFolderMutation.mutateAsync(data)
  }, [userId, createFolderMutation])

  const updateFolder = useCallback((
    folderId: string,
    data: FolderUpdateRequest
  ) => {
    return updateFolderMutation.mutateAsync({ folderId, data })
  }, [updateFolderMutation])

  const moveFolder = useCallback((
    folderId: string,
    newParentId?: string,
    newPosition?: number
  ) => {
    const data: FolderMoveRequest = { new_parent_id: newParentId, new_position: newPosition }
    return moveFolderMutation.mutateAsync({ folderId, data })
  }, [moveFolderMutation])

  const deleteFolder = useCallback((
    folderId: string,
    force = false
  ) => {
    return deleteFolderMutation.mutateAsync({ folderId, force })
  }, [deleteFolderMutation])

  return {
    folders,
    isLoading,
    error,
    refetch,
    createFolder,
    updateFolder,
    moveFolder,
    deleteFolder,
    isCreating: createFolderMutation.isPending,
    isUpdating: updateFolderMutation.isPending,
    isMoving: moveFolderMutation.isPending,
    isDeleting: deleteFolderMutation.isPending,
    totalFolders: treeResponse?.total_folders ?? 0,
    totalContentItems: treeResponse?.total_content_items ?? 0
  }
}

/**
 * Hook for managing individual folder state
 */
export function useFolder(folderId: string, userId: string) {
  const queryClient = useQueryClient()

  const {
    data: folder,
    isLoading,
    error
  } = useQuery({
    queryKey: folderQueryKeys.folder(folderId, userId),
    queryFn: () => folderApi.getFolder(folderId, userId),
    enabled: !!folderId && !!userId,
  })

  const {
    data: stats,
    isLoading: isLoadingStats
  } = useQuery({
    queryKey: folderQueryKeys.stats(folderId, userId),
    queryFn: () => folderApi.getFolderStats(folderId, userId),
    enabled: !!folderId && !!userId,
  })

  return {
    folder,
    stats,
    isLoading,
    isLoadingStats,
    error
  }
}

// ============================
// CONTENT HOOKS
// ============================

/**
 * Hook for managing content items in folders
 */
export function useFolderContent(
  userId: string,
  options: {
    folderId?: string
    type?: string
    search?: string
    tags?: string[]
    limit?: number
    offset?: number
  } | null = {}
) {
  const queryClient = useQueryClient()

  const {
    data: contentResponse,
    isLoading,
    error
  } = useQuery({
    queryKey: folderQueryKeys.content.list(options || {}),
    queryFn: () => folderApi.getContentItems(userId, options || {}),
    enabled: !!userId && !!options,
  })

  // Create content mutation
  const createContentMutation = useMutation({
    mutationFn: (data: ContentItemCreateRequest) => folderApi.createContentItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.content.all })
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.tree(userId) })
      toast.success('Content created successfully')
    },
    onError: (error: FolderApiError) => {
      toast.error(`Failed to create content: ${error.message}`)
    }
  })

  // Update content mutation
  const updateContentMutation = useMutation({
    mutationFn: ({ contentId, data }: { contentId: string; data: ContentItemUpdateRequest }) =>
      folderApi.updateContentItem(contentId, userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.content.all })
      toast.success('Content updated successfully')
    },
    onError: (error: FolderApiError) => {
      toast.error(`Failed to update content: ${error.message}`)
    }
  })

  // Move content mutation
  const moveContentMutation = useMutation({
    mutationFn: ({ contentId, folderId }: { contentId: string; folderId?: string }) =>
      folderApi.moveContentItem(contentId, userId, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.content.all })
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.tree(userId) })
      toast.success('Content moved successfully')
    },
    onError: (error: FolderApiError) => {
      toast.error(`Failed to move content: ${error.message}`)
    }
  })

  // Bulk move content mutation
  const bulkMoveContentMutation = useMutation({
    mutationFn: ({ contentIds, folderId }: { contentIds: string[]; folderId?: string }) =>
      folderApi.bulkMoveContentItems(contentIds, userId, folderId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.content.all })
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.tree(userId) })
      toast.success(`Moved ${data.moved_count} items successfully`)
    },
    onError: (error: FolderApiError) => {
      toast.error(`Failed to move content: ${error.message}`)
    }
  })

  // Delete content mutation
  const deleteContentMutation = useMutation({
    mutationFn: (contentId: string) => folderApi.deleteContentItem(contentId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.content.all })
      queryClient.invalidateQueries({ queryKey: folderQueryKeys.tree(userId) })
      toast.success('Content deleted successfully')
    },
    onError: (error: FolderApiError) => {
      toast.error(`Failed to delete content: ${error.message}`)
    }
  })

  // Convenience methods
  const createContent = useCallback((
    title: string,
    type: any,
    folderId?: string,
    options: Partial<ContentItemCreateRequest> = {}
  ) => {
    const data = folderApiUtils.createContentRequest(title, type, userId, folderId, options)
    return createContentMutation.mutateAsync(data)
  }, [userId, createContentMutation])

  const updateContent = useCallback((
    contentId: string,
    data: ContentItemUpdateRequest
  ) => {
    return updateContentMutation.mutateAsync({ contentId, data })
  }, [updateContentMutation])

  const moveContent = useCallback((
    contentId: string,
    folderId?: string
  ) => {
    return moveContentMutation.mutateAsync({ contentId, folderId })
  }, [moveContentMutation])

  const bulkMoveContent = useCallback((
    contentIds: string[],
    folderId?: string
  ) => {
    return bulkMoveContentMutation.mutateAsync({ contentIds, folderId })
  }, [bulkMoveContentMutation])

  const deleteContent = useCallback((
    contentId: string
  ) => {
    return deleteContentMutation.mutateAsync(contentId)
  }, [deleteContentMutation])

  return {
    items: contentResponse?.items ?? [],
    total: contentResponse?.total ?? 0,
    hasMore: contentResponse?.has_more ?? false,
    isLoading,
    error,
    createContent,
    updateContent,
    moveContent,
    bulkMoveContent,
    deleteContent,
    isCreating: createContentMutation.isPending,
    isUpdating: updateContentMutation.isPending,
    isMoving: moveContentMutation.isPending,
    isBulkMoving: bulkMoveContentMutation.isPending,
    isDeleting: deleteContentMutation.isPending
  }
}

/**
 * Hook for managing individual content item
 */
export function useContentItem(contentId: string, userId: string) {
  const queryClient = useQueryClient()

  const {
    data: content,
    isLoading,
    error
  } = useQuery({
    queryKey: folderQueryKeys.content.item(contentId, userId),
    queryFn: () => folderApi.getContentItem(contentId, userId),
    enabled: !!contentId && !!userId,
  })

  return {
    content,
    isLoading,
    error
  }
}

// ============================
// DRAG AND DROP HOOKS
// ============================

/**
 * Hook for handling drag and drop operations between folders and content
 */
export function useFolderDragDrop(userId: string, enabled = true) {
  const { moveFolder } = useFolderTree(userId, enabled)
  const { moveContent, bulkMoveContent } = useFolderContent(userId, enabled ? {} : null)

  const handleDrop = useCallback(async (dragData: any, dropTarget: any) => {
    try {
      if (dragData.type === 'folder' && dropTarget.type === 'folder') {
        // Moving folder to another folder
        await moveFolder(dragData.id, dropTarget.id, dropTarget.position)
      } else if (dragData.type === 'content' && dropTarget.type === 'folder') {
        // Moving content to folder
        if (Array.isArray(dragData.id)) {
          // Bulk move
          await bulkMoveContent(dragData.id, dropTarget.id)
        } else {
          // Single move
          await moveContent(dragData.id, dropTarget.id)
        }
      } else if (dragData.type === 'folder' && dropTarget.type === 'root') {
        // Moving folder to root
        await moveFolder(dragData.id, undefined, dropTarget.position)
      }
    } catch (error) {
      console.error('Drag and drop operation failed:', error)
    }
  }, [moveFolder, moveContent, bulkMoveContent])

  return {
    handleDrop
  }
}

// ============================
// SELECTION HOOKS
// ============================

/**
 * Hook for managing multi-selection state
 */
export function useSelection<T extends { id: string }>() {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  const toggleSelection = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }, [])

  const selectAll = useCallback((items: T[]) => {
    setSelectedItems(new Set(items.map(item => item.id)))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set())
  }, [])

  const isSelected = useCallback((itemId: string) => {
    return selectedItems.has(itemId)
  }, [selectedItems])

  return {
    selectedItems: Array.from(selectedItems),
    selectedCount: selectedItems.size,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected
  }
}

// ============================
// UTILITY HOOKS
// ============================

/**
 * Hook for debounced search
 */
export function useSearch(
  onSearch: (query: string) => void,
  delay = 300
) {
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(searchQuery)
    }, delay)

    return () => clearTimeout(timer)
  }, [searchQuery, onSearch, delay])

  return {
    searchQuery,
    setSearchQuery
  }
}