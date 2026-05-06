'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Editor } from '@tiptap/react'
import {
  List,
  Hash,
  Type,
  ChevronRight,
  ChevronDown,
  FileText,
  Clock,
  BookOpen,
  Search,
  Filter,
  MoreVertical,
  Pin,
  Archive,
  Trash2,
  Star,
  Tag,
  Calendar,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Document } from './RichTextEditor'

interface EditorSidebarProps {
  editor?: Editor
  document?: Document
  documents?: Document[]
  onDocumentSelect?: (document: Document) => void
  onDocumentAction?: (action: string, document: Document) => void
  className?: string
}

interface HeadingItem {
  id: string
  level: number
  text: string
  position: number
}

interface DocumentItem extends Document {
  isStarred?: boolean
  isPinned?: boolean
  isArchived?: boolean
}

export function EditorSidebar({
  editor,
  document,
  documents = [],
  onDocumentSelect,
  onDocumentAction,
  className,
}: EditorSidebarProps) {
  const [activeTab, setActiveTab] = useState<'outline' | 'documents'>('outline')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['recent']))
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'starred' | 'pinned'>('all')

  // Extract headings from editor content
  const headings = useMemo(() => {
    if (!editor) return []

    const headings: HeadingItem[] = []
    const doc = editor.state.doc

    doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const level = node.attrs.level
        const text = node.textContent
        if (text) {
          headings.push({
            id: `heading-${pos}`,
            level,
            text: text.substring(0, 100), // Truncate long headings
            position: pos,
          })
        }
      }
    })

    return headings
  }, [editor?.state.doc])

  // Process documents with metadata
  const processedDocuments = useMemo(() => {
    return documents.map(doc => ({
      ...doc,
      isStarred: Math.random() > 0.7, // Mock starred status
      isPinned: Math.random() > 0.8,  // Mock pinned status
      isArchived: false,
    })) as DocumentItem[]
  }, [documents])

  // Filter documents
  const filteredDocuments = useMemo(() => {
    let filtered = processedDocuments

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(query) ||
        doc.metadata.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // Apply status filter
    switch (selectedFilter) {
      case 'starred':
        filtered = filtered.filter(doc => doc.isStarred)
        break
      case 'pinned':
        filtered = filtered.filter(doc => doc.isPinned)
        break
    }

    return filtered
  }, [processedDocuments, searchQuery, selectedFilter])

  // Group documents
  const groupedDocuments = useMemo(() => {
    const groups: Record<string, DocumentItem[]> = {
      pinned: [],
      recent: [],
      strategy: [],
      research: [],
      review: [],
      note: [],
      trade_analysis: [],
    }

    filteredDocuments.forEach(doc => {
      if (doc.isPinned) {
        groups.pinned.push(doc)
      }
      groups.recent.push(doc)
      groups[doc.type].push(doc)
    })

    return groups
  }, [filteredDocuments])

  // Handle heading click
  const handleHeadingClick = (heading: HeadingItem) => {
    if (editor) {
      // Scroll to heading
      editor.commands.focus(heading.position)

      // Highlight the heading temporarily
      const transaction = editor.state.tr.setMeta('scrollToHeading', heading.position)
      editor.view.dispatch(transaction)
    }
  }

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  // Get document type icon
  const getDocumentTypeIcon = (type: Document['type']) => {
    switch (type) {
      case 'strategy':
        return Hash
      case 'research':
        return Search
      case 'review':
        return List
      case 'trade_analysis':
        return ChevronRight
      default:
        return FileText
    }
  }

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  return (
    <div className={cn(
      'w-80 h-full bg-card border-l border-border flex flex-col',
      className
    )}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setActiveTab('outline')}
            className={cn(
              'flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
              activeTab === 'outline'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <List className="w-4 h-4 inline mr-2" />
            Outline
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={cn(
              'flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
              activeTab === 'documents'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <BookOpen className="w-4 h-4 inline mr-2" />
            Documents
          </button>
        </div>

        {/* Search and Filter */}
        {activeTab === 'documents' && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex gap-1">
              {(['all', 'starred', 'pinned'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={cn(
                    'flex-1 px-2 py-1 text-xs font-medium rounded transition-colors',
                    selectedFilter === filter
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {filter === 'all' && 'All'}
                  {filter === 'starred' && <Star className="w-3 h-3 mx-auto" />}
                  {filter === 'pinned' && <Pin className="w-3 h-3 mx-auto" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'outline' ? (
          /* Document Outline */
          <div className="p-4">
            {headings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Type className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No headings found</p>
                <p className="text-xs">Add headings to see document outline</p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Document Outline
                </div>
                {headings.map((heading) => (
                  <button
                    key={heading.id}
                    onClick={() => handleHeadingClick(heading)}
                    className={cn(
                      'w-full text-left p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors text-sm',
                      'flex items-center gap-2'
                    )}
                    style={{ paddingLeft: `${heading.level * 8 + 8}px` }}
                  >
                    <Hash className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{heading.text}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Document Stats */}
            {document && (
              <div className="mt-6 p-3 bg-muted/30 rounded-lg">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Document Stats
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Words</span>
                    <span className="font-medium">{document.metadata.wordCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Reading Time</span>
                    <span className="font-medium">{document.metadata.readTime} min</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last Modified</span>
                    <span className="font-medium">
                      {formatRelativeTime(document.metadata.lastModified)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Documents List */
          <div className="p-4">
            {Object.entries(groupedDocuments).map(([groupId, docs]) => {
              if (docs.length === 0) return null

              const isExpanded = expandedSections.has(groupId)
              const groupLabels: Record<string, string> = {
                pinned: 'Pinned',
                recent: 'Recent',
                strategy: 'Strategies',
                research: 'Research',
                review: 'Reviews',
                note: 'Notes',
                trade_analysis: 'Trade Analysis',
              }

              return (
                <div key={groupId} className="mb-4">
                  <button
                    onClick={() => toggleSection(groupId)}
                    className="w-full flex items-center justify-between p-2 hover:bg-accent rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span className="text-sm font-medium">
                        {groupLabels[groupId]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({docs.length})
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="ml-6 mt-2 space-y-1">
                      {docs.slice(0, 10).map((doc) => {
                        const Icon = getDocumentTypeIcon(doc.type)
                        const isSelected = document?.id === doc.id

                        return (
                          <div
                            key={doc.id}
                            className={cn(
                              'group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                              isSelected
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-accent hover:text-accent-foreground'
                            )}
                            onClick={() => onDocumentSelect?.(doc)}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="truncate text-sm font-medium">
                                {doc.title}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatRelativeTime(doc.metadata.lastModified)}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {doc.isStarred && (
                                <Star className="w-3 h-3 text-yellow-500 fill-current" />
                              )}
                              {doc.isPinned && (
                                <Pin className="w-3 h-3 text-blue-500" />
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // Show context menu
                                }}
                                className="p-1 rounded hover:bg-accent"
                              >
                                <MoreVertical className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )
                      })}

                      {docs.length > 10 && (
                        <button className="w-full text-left p-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                          Show {docs.length - 10} more...
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {filteredDocuments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No documents found</p>
                <p className="text-xs">
                  {searchQuery ? 'Try a different search term' : 'Create your first document'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          {activeTab === 'outline' ? (
            <>
              {headings.length} heading{headings.length !== 1 ? 's' : ''}
              {document && (
                <> • {document.metadata.wordCount} words</>
              )}
            </>
          ) : (
            <>
              {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
            </>
          )}
        </div>
      </div>
    </div>
  )
}