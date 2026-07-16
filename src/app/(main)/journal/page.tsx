'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { useAuth } from '@/lib/auth-client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useComponentRegistry, type ScrollBehavior } from '@/lib/ag-ui/component-registry'

import { JournalLayout } from '@/components/journal/JournalLayout'
import {
  JournalEntryCard,
  NewEntryModal,
  mockJournalEntries
} from '@/components/journal/journal-components'
import { useFolderTree, useFolderContent, useFolderDragDrop } from '@/hooks/useFolders'
import { FolderNode } from '@/components/folders/FolderTree'

// Create a query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
    },
  },
})

interface EnhancedJournalContentProps {
  searchQuery?: string
  filters?: any
}

function EnhancedJournalContent({
  searchQuery,
  filters
}: EnhancedJournalContentProps) {
  // Real authenticated user (parent gates rendering to signed-in users only)
  const { userId: authUserId } = useAuth()
  const userId = authUserId || ''

  // Selected folder is owned here so the sidebar (JournalLayout) and the
  // content list share ONE source of truth.
  const [selectedFolderId, setSelectedFolderId] = useState<string>()

  // Folder and content management
  const {
    folders,
    isLoading: foldersLoading,
    createFolder,
    updateFolder,
    deleteFolder,
    isCreating,
    isUpdating,
    isDeleting
  } = useFolderTree(userId, !!userId)

  const {
    items: contentItems,
    total: totalContent,
    isLoading: contentLoading,
    createContent,
    updateContent,
    deleteContent,
    moveContent
  } = useFolderContent(userId, {
    folderId: selectedFolderId,
    search: searchQuery,
    limit: 50
  })

  // Drag and drop handling
  const { handleDrop } = useFolderDragDrop(userId)

  // UI state
  const [showNewEntryModal, setShowNewEntryModal] = useState(false)

  // Register journal components with AG-UI registry
  useComponentRegistry('journal.new-entry-modal', {
    activate: (action) => {
      if (action === 'open' || action === 'click') {
        setShowNewEntryModal(true)
      } else if (action === 'close') {
        setShowNewEntryModal(false)
      }
    }
  })

  useComponentRegistry('journal.stats', {
    scroll: (behavior) => {
      const element = document.getElementById('journal-stats-section')
      element?.scrollIntoView({ behavior: behavior as ScrollBehavior })
    }
  })

  useComponentRegistry('journal.entries', {
    scroll: (behavior) => {
      const element = document.getElementById('journal-entries-section')
      element?.scrollIntoView({ behavior: behavior as ScrollBehavior })
    }
  })

  useComponentRegistry('journal.view-mode', {
    setState: (state) => {
      if (state === 'grid' || state === 'list') {
        setViewMode(state)
      }
    }
  })

  // Legacy journal entries kept empty — real entries come from the API now
  const [legacyEntries] = useState<any[]>([])

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

  // Combine content items and legacy entries for display
  const displayEntries = useMemo(() => {
    const entries = [...legacyEntries]

    // Add content items as journal entries
    contentItems.forEach((item: any) => {
      if (item.type === 'trade_entry' && item.content) {
        const tradeData = item.content.trade_data || {}
        entries.push({
          id: item.id,
          date: item.created_at.split('T')[0],
          title: item.title,
          strategy: tradeData.symbol || 'N/A',
          side: tradeData.side || 'Long',
          setup: `Entry: ${tradeData.entry_price || 0}, Exit: ${tradeData.exit_price || 0}`,
          bias: tradeData.side || 'Long',
          pnl: tradeData.pnl || 0,
          rating: tradeData.rating || 3,
          tags: item.tags,
          content: tradeData.setup_analysis || '',
          emotion: tradeData.emotion || 'neutral',
          category: tradeData.category || 'win',
          template: tradeData.template || '',
          createdAt: item.created_at
        })
      } else if (item.type === 'daily_review' && item.content) {
        const d = item.content.doc_data || {}
        const dayPnl = typeof d.dayPnl === 'number' ? d.dayPnl : parseFloat(d.dayPnl || 0)
        entries.push({
          id: item.id,
          date: (d.date || item.created_at || new Date().toISOString()).split('T')[0],
          title: item.title,
          strategy: 'Daily Review',
          side: 'N/A',
          setup: d.mood || '—',
          bias: 'Neutral',
          pnl: dayPnl || 0,
          rating: 3,
          tags: item.tags,
          content: d.sections || '',
          emotion: 'neutral',
          category: dayPnl >= 0 ? 'win' : 'loss',
          template: 'daily-review',
          createdAt: item.created_at
        })
      }
    })

    return entries
  }, [legacyEntries, contentItems])

  // Filter entries based on current filters
  const filteredEntries = useMemo(() => {
    if (!filters) return displayEntries

    return displayEntries.filter(entry => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        if (!entry.title.toLowerCase().includes(searchLower) &&
            !entry.content.toLowerCase().includes(searchLower)) {
          return false
        }
      }
      if (filters.category && entry.category !== filters.category) {
        return false
      }
      if (filters.emotion && entry.emotion !== filters.emotion) {
        return false
      }
      if (filters.symbol && !entry.strategy.toLowerCase().includes(filters.symbol.toLowerCase())) {
        return false
      }
      if (filters.rating && entry.rating < filters.rating) {
        return false
      }
      return true
    })
  }, [displayEntries, filters])

  // Event handlers
  const handleCreateFolder = useCallback(async (name?: string, parentId?: string) => {
    try {
      const folderName = name || prompt('Enter folder name:')
      if (!folderName) return

      await createFolder(folderName, parentId, {
        icon: 'folder',
        color: '#FFD700'
      })
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }, [createFolder])

  const handleUpdateFolder = useCallback(async (folderId: string, data: any) => {
    try {
      await updateFolder(folderId, data)
    } catch (error) {
      console.error('Failed to update folder:', error)
    }
  }, [updateFolder])

  const handleDeleteFolder = useCallback(async (folderId: string) => {
    try {
      const confirmed = confirm('Are you sure you want to delete this folder?')
      if (!confirmed) return

      await deleteFolder(folderId, false)
    } catch (error) {
      console.error('Failed to delete folder:', error)
    }
  }, [deleteFolder])

  const handleCreateContent = useCallback(async () => {
    setShowNewEntryModal(true)
  }, [])

  const handleSaveEntry = useCallback(async (newEntry: any) => {
    try {
      const isDailyReview = newEntry.template === 'daily-review'
      const tagsArr = Array.isArray(newEntry.tags)
        ? newEntry.tags
        : (typeof newEntry.tags === 'string' ? newEntry.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : [])

      // Create as content item in selected folder
      await createContent(
        newEntry.title,
        isDailyReview ? 'daily_review' : 'trade_entry',
        selectedFolderId,
        isDailyReview
          ? {
              content: {
                doc_data: {
                  date: newEntry.date,
                  dayPnl: parseFloat(newEntry.dayPnl || '0'),
                  mood: newEntry.mood,
                  sections: newEntry.content
                }
              },
              tags: tagsArr
            }
          : {
              content: {
                trade_data: {
                  symbol: newEntry.symbol,
                  side: newEntry.side,
                  entry_price: parseFloat(newEntry.entryPrice),
                  exit_price: parseFloat(newEntry.exitPrice),
                  pnl: parseFloat(newEntry.pnl),
                  rating: newEntry.rating,
                  emotion: newEntry.emotion,
                  category: newEntry.category,
                  setup_analysis: newEntry.content
                },
                blocks: [] // For future rich text editor
              },
              tags: tagsArr
            }
      )

      setShowNewEntryModal(false)
    } catch (error) {
      console.error('Failed to create entry:', error)
    }
  }, [createContent, selectedFolderId])

  const handleEditEntry = useCallback((entry: any) => {
    // Inline editing handled by the card's own edit mode
    console.log('Edit entry:', entry)
  }, [])

  // Save inline body edits — PUT replaces the whole content object, so rebuild it
  // from the raw content item with only the body field changed.
  const handleUpdateBody = useCallback(async (id: string, html: string) => {
    const item = contentItems.find((c: any) => c.id === id)
    if (!item) return
    const content = { ...(item.content || {}) }
    if (item.type === 'daily_review') {
      content.doc_data = { ...(content.doc_data || {}), sections: html }
    } else {
      content.trade_data = { ...(content.trade_data || {}), setup_analysis: html }
    }
    try {
      await updateContent(id, { content })
    } catch (error) {
      console.error('Failed to update entry body:', error)
    }
  }, [contentItems, updateContent])

  const handleDeleteEntry = useCallback(async (id: string) => {
    try {
      const confirmed = confirm('Are you sure you want to delete this entry?')
      if (!confirmed) return

      // Check if it's a content item or legacy entry
      const isContentItem = contentItems.some((item: any) => item.id === id)
      if (isContentItem) {
        await deleteContent(id)
      } else {
        // Handle legacy entry deletion
        console.log('Delete legacy entry:', id)
      }
    } catch (error) {
      console.error('Failed to delete entry:', error)
    }
  }, [contentItems, deleteContent])

  if (foldersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm studio-muted">Loading folders...</p>
        </div>
      </div>
    )
  }

  return (
    <JournalLayout
      folders={folders as any}
      foldersLoading={foldersLoading}
      selectedFolderId={selectedFolderId}
      onFolderSelect={setSelectedFolderId}
      onCreateFolder={(name) => createFolder(name || 'New Folder', selectedFolderId)}
      showNewEntryButton
      onNewEntry={() => setShowNewEntryModal(true)}
    >
      <div className="space-y-4">
        {/* Results Summary */}
        <div className="flex items-center justify-between">
          <div className="text-sm studio-muted">
            {selectedFolder ? (
              <>Showing {filteredEntries.length} entries in "{selectedFolder.name}"</>
            ) : (
              <>Showing {filteredEntries.length} of {displayEntries.length} entries</>
            )}
          </div>
          {contentLoading && (
            <div className="text-sm studio-muted">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary inline-block mr-2"></div>
              Loading content...
            </div>
          )}
        </div>

        {/* Journal Entries — doc-focused single column */}
        <div id="journal-entries-section">
          <div className="space-y-6">
          {filteredEntries.length > 0 ? (
            filteredEntries.map((entry) => (
              <JournalEntryCard
                key={entry.id}
                entry={entry as any}
                onEdit={handleEditEntry}
                onDelete={handleDeleteEntry}
                onUpdateBody={handleUpdateBody}
              />
            ))
          ) : (
            <div className="studio-surface rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">📁</div>
              <h3 className="text-lg font-semibold studio-text mb-2">
                {selectedFolder ? (
                  `No entries in "${selectedFolder.name}"`
                ) : displayEntries.length === 0 ? (
                  'No journal entries yet'
                ) : (
                  'No entries match your filters'
                )}
              </h3>
              <p className="text-sm studio-muted mb-4">
                {selectedFolder ? (
                  'Start adding entries to this folder to organize your trading journal'
                ) : displayEntries.length === 0 ? (
                  'Start documenting your trades to improve your performance'
                ) : (
                  'Try adjusting your search criteria or clear the filters'
                )}
              </p>
              <button
                className="btn-primary"
                onClick={handleCreateContent}
              >
                {selectedFolder ? 'Add Entry to Folder' : 'Create Your First Entry'}
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* New Entry Modal */}
      <NewEntryModal
        isOpen={showNewEntryModal}
        onClose={() => setShowNewEntryModal(false)}
        onSave={handleSaveEntry}
      />

      {/* Loading Overlay */}
      {(isCreating || isUpdating || isDeleting) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-[#1a1a1a] rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm studio-text">
              {isCreating && 'Creating folder...'}
              {isUpdating && 'Updating folder...'}
              {isDeleting && 'Deleting folder...'}
            </p>
          </div>
        </div>
      )}
    </JournalLayout>
  )
}

export default function EnhancedJournalPage() {
  const { isLoaded, isSignedIn } = useAuth()

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout pageClassName="min-h-screen">
        {!isLoaded ? (
          <div className="flex items-center justify-center h-[60vh] text-zinc-500">Loading your journal…</div>
        ) : !isSignedIn ? (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-center">
            <div className="text-2xl font-bold text-zinc-300">Sign in to journal</div>
            <p className="text-zinc-500 max-w-sm">Your trade journal entries are tied to your account. Sign in to create, save, and organize entries.</p>
            <a href="/sign-in" className="mt-2 px-5 py-2 rounded-lg bg-amber-500 text-zinc-950 font-semibold hover:bg-amber-400 transition-colors">Sign in</a>
          </div>
        ) : (
          <EnhancedJournalContent />
        )}
      </AppLayout>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#e5e5e5',
            border: '1px solid #2a2a2a'
          }
        }}
      />
    </QueryClientProvider>
  )
}