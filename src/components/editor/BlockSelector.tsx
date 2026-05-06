'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  Table,
  Image,
  Minus,
  FileText,
  TrendingUp,
  Calculator,
  PieChart,
  AlertCircle,
  Info,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  X,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BlockOption {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  category: 'basic' | 'media' | 'trading' | 'advanced'
  keywords: string[]
}

interface BlockSelectorProps {
  position: { x: number; y: number }
  onSelect: (blockType: string) => void
  onClose: () => void
}

const blockOptions: BlockOption[] = [
  // Basic Text Blocks
  {
    id: 'paragraph',
    title: 'Text',
    description: 'Start writing with plain text',
    icon: Type,
    category: 'basic',
    keywords: ['text', 'paragraph', 'p'],
  },
  {
    id: 'heading1',
    title: 'Heading 1',
    description: 'Big section heading',
    icon: Heading1,
    category: 'basic',
    keywords: ['heading', 'h1', 'title', 'big'],
  },
  {
    id: 'heading2',
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: Heading2,
    category: 'basic',
    keywords: ['heading', 'h2', 'subtitle', 'medium'],
  },
  {
    id: 'heading3',
    title: 'Heading 3',
    description: 'Small section heading',
    icon: Heading3,
    category: 'basic',
    keywords: ['heading', 'h3', 'small'],
  },

  // Lists
  {
    id: 'bulletList',
    title: 'Bullet List',
    description: 'Create a simple bulleted list',
    icon: List,
    category: 'basic',
    keywords: ['list', 'bullet', 'ul', 'unordered'],
  },
  {
    id: 'orderedList',
    title: 'Numbered List',
    description: 'Create a list with numbering',
    icon: ListOrdered,
    category: 'basic',
    keywords: ['list', 'numbered', 'ol', 'ordered', '1.', 'number'],
  },
  {
    id: 'taskList',
    title: 'To-do List',
    description: 'Track tasks with checkboxes',
    icon: CheckSquare,
    category: 'basic',
    keywords: ['todo', 'task', 'checkbox', 'check', '[]'],
  },

  // Code & Quotes
  {
    id: 'codeBlock',
    title: 'Code Block',
    description: 'Capture a code snippet',
    icon: Code,
    category: 'basic',
    keywords: ['code', 'snippet', 'programming', '```', 'block'],
  },
  {
    id: 'blockquote',
    title: 'Quote',
    description: 'Capture a quote',
    icon: Quote,
    category: 'basic',
    keywords: ['quote', 'citation', 'blockquote', '>'],
  },

  // Media & Layout
  {
    id: 'image',
    title: 'Image',
    description: 'Upload or embed an image',
    icon: Image,
    category: 'media',
    keywords: ['image', 'picture', 'photo', 'upload', 'img'],
  },
  {
    id: 'table',
    title: 'Table',
    description: 'Create a table',
    icon: Table,
    category: 'media',
    keywords: ['table', 'grid', 'data', 'rows', 'columns'],
  },
  {
    id: 'horizontalRule',
    title: 'Divider',
    description: 'Visually divide blocks',
    icon: Minus,
    category: 'media',
    keywords: ['divider', 'separator', 'rule', 'line', '---'],
  },

  // Trading-Specific Blocks
  {
    id: 'tradeEntry',
    title: 'Trade Entry',
    description: 'Add structured trade data',
    icon: TrendingUp,
    category: 'trading',
    keywords: ['trade', 'entry', 'position', 'buy', 'sell', 'trading'],
  },
  {
    id: 'chartBlock',
    title: 'Chart',
    description: 'Embed a trading chart',
    icon: PieChart,
    category: 'trading',
    keywords: ['chart', 'graph', 'trading', 'price', 'candlestick'],
  },
  {
    id: 'calculationBlock',
    title: 'Calculation',
    description: 'Add financial calculations',
    icon: Calculator,
    category: 'trading',
    keywords: ['calculation', 'math', 'formula', 'pnl', 'risk', 'calc'],
  },

  // Advanced Blocks
  {
    id: 'toggle',
    title: 'Toggle Section',
    description: 'Create a collapsible toggle section',
    icon: ChevronRight,
    category: 'advanced',
    keywords: ['toggle', 'collapsible', 'fold', 'expand', 'collapse', 'dropdown'],
  },
  {
    id: 'toggleList',
    title: 'Toggle List',
    description: 'Create a toggle with bullet points',
    icon: ChevronDown,
    category: 'advanced',
    keywords: ['toggle', 'list', 'collapsible', 'bullet', 'dropdown'],
  },
  {
    id: 'calloutInfo',
    title: 'Info Callout',
    description: 'Highlight important information',
    icon: Info,
    category: 'advanced',
    keywords: ['callout', 'info', 'highlight', 'note', 'information'],
  },
  {
    id: 'calloutWarning',
    title: 'Warning Callout',
    description: 'Add a warning notice',
    icon: AlertCircle,
    category: 'advanced',
    keywords: ['callout', 'warning', 'alert', 'caution', 'danger'],
  },
  {
    id: 'calloutSuccess',
    title: 'Success Callout',
    description: 'Highlight positive outcomes',
    icon: CheckCircle,
    category: 'advanced',
    keywords: ['callout', 'success', 'positive', 'win', 'good'],
  },
]

export function BlockSelector({ position, onSelect, onClose }: BlockSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter blocks based on search query
  const filteredBlocks = blockOptions.filter((block) => {
    if (!searchQuery) return true

    const query = searchQuery.toLowerCase()
    return (
      block.title.toLowerCase().includes(query) ||
      block.description.toLowerCase().includes(query) ||
      block.keywords.some(keyword => keyword.includes(query))
    )
  })

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % filteredBlocks.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + filteredBlocks.length) % filteredBlocks.length)
          break
        case 'Enter':
          e.preventDefault()
          if (filteredBlocks[selectedIndex]) {
            onSelect(filteredBlocks[selectedIndex].id)
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [filteredBlocks, selectedIndex, onSelect, onClose])

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Position the menu
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: position.y + 8,
    left: position.x,
    zIndex: 1000,
  }

  // Group blocks by category
  const groupedBlocks = filteredBlocks.reduce((acc, block) => {
    if (!acc[block.category]) {
      acc[block.category] = []
    }
    acc[block.category].push(block)
    return acc
  }, {} as Record<string, BlockOption[]>)

  const categoryOrder = ['basic', 'media', 'trading', 'advanced']
  const categoryLabels = {
    basic: 'Basic',
    media: 'Media',
    trading: 'Trading',
    advanced: 'Advanced',
  }

  return (
    <div
      ref={containerRef}
      style={menuStyle}
      className="w-80 max-h-96 overflow-auto studio-surface border border-studio-border rounded-lg shadow-studio-lg"
    >
      {/* Search Header */}
      <div className="p-3 border-b border-studio-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search blocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
          <button
            onClick={onClose}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-accent"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Block Options */}
      <div className="p-2">
        {filteredBlocks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No blocks found</p>
            <p className="text-xs">Try a different search term</p>
          </div>
        ) : (
          categoryOrder.map((category) => {
            const blocks = groupedBlocks[category]
            if (!blocks || blocks.length === 0) return null

            return (
              <div key={category} className="mb-3 last:mb-0">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 py-1 mb-1">
                  {categoryLabels[category]}
                </div>
                <div className="space-y-1">
                  {blocks.map((block, index) => {
                    const globalIndex = filteredBlocks.indexOf(block)
                    const isSelected = globalIndex === selectedIndex
                    const Icon = block.icon

                    return (
                      <button
                        key={block.id}
                        onClick={() => onSelect(block.id)}
                        className={cn(
                          'w-full text-left p-3 rounded-lg transition-colors',
                          'hover:bg-accent hover:text-accent-foreground',
                          'focus:outline-none focus:bg-accent focus:text-accent-foreground',
                          isSelected && 'bg-accent text-accent-foreground'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {block.title}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {block.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-studio-border text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>↑↓ to navigate</span>
          <span>Enter to select</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  )
}