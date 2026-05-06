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
  Target,
  BarChart3,
  Award,
  Lightbulb,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BlockOption {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  category: 'basic' | 'media' | 'trading' | 'advanced' | 'ai'
  keywords: string[]
  isPremium?: boolean
  isNew?: boolean
}

interface EnhancedBlockSelectorProps {
  position: { x: number; y: number }
  onSelect: (blockType: string, data?: any) => void
  onClose: () => void
  mode?: 'rich-text' | 'blocks'
}

const blockOptions: BlockOption[] = [
  // Basic Text Blocks
  {
    id: 'paragraph',
    title: 'Text',
    description: 'Start writing with plain text',
    icon: Type,
    category: 'basic',
    keywords: ['text', 'paragraph', 'p', 'write'],
  },
  {
    id: 'heading1',
    title: 'Heading 1',
    description: 'Big section heading',
    icon: Heading1,
    category: 'basic',
    keywords: ['heading', 'h1', 'title', 'big', 'header'],
  },
  {
    id: 'heading2',
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: Heading2,
    category: 'basic',
    keywords: ['heading', 'h2', 'subtitle', 'medium', 'header'],
  },
  {
    id: 'heading3',
    title: 'Heading 3',
    description: 'Small section heading',
    icon: Heading3,
    category: 'basic',
    keywords: ['heading', 'h3', 'small', 'header'],
  },

  // Lists
  {
    id: 'bulletList',
    title: 'Bullet List',
    description: 'Create a simple bulleted list',
    icon: List,
    category: 'basic',
    keywords: ['list', 'bullet', 'ul', 'unordered', 'items'],
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
    keywords: ['todo', 'task', 'checkbox', 'check', '[]', 'checklist'],
  },

  // Code & Quotes
  {
    id: 'codeBlock',
    title: 'Code Block',
    description: 'Capture a code snippet',
    icon: Code,
    category: 'basic',
    keywords: ['code', 'snippet', 'programming', '```', 'block', 'syntax'],
  },
  {
    id: 'blockquote',
    title: 'Quote',
    description: 'Capture a quote or citation',
    icon: Quote,
    category: 'basic',
    keywords: ['quote', 'citation', 'blockquote', '>', 'excerpt'],
  },

  // Media & Layout
  {
    id: 'image',
    title: 'Image',
    description: 'Upload or embed an image',
    icon: Image,
    category: 'media',
    keywords: ['image', 'picture', 'photo', 'upload', 'img', 'visual'],
  },
  {
    id: 'table',
    title: 'Table',
    description: 'Create a table for data',
    icon: Table,
    category: 'media',
    keywords: ['table', 'grid', 'data', 'rows', 'columns', 'spreadsheet'],
  },
  {
    id: 'horizontalRule',
    title: 'Divider',
    description: 'Visually divide content sections',
    icon: Minus,
    category: 'media',
    keywords: ['divider', 'separator', 'rule', 'line', '---', 'break'],
  },

  // Trading-Specific Blocks
  {
    id: 'tradeEntry',
    title: 'Trade Entry',
    description: 'Add structured trade data with P&L tracking',
    icon: TrendingUp,
    category: 'trading',
    keywords: ['trade', 'entry', 'position', 'buy', 'sell', 'trading', 'pnl', 'profit', 'loss'],
    isNew: true,
  },
  {
    id: 'strategyTemplate',
    title: 'Strategy Template',
    description: 'Document trading strategies and rules',
    icon: Target,
    category: 'trading',
    keywords: ['strategy', 'template', 'rules', 'plan', 'system', 'methodology'],
    isNew: true,
  },
  {
    id: 'performanceSummary',
    title: 'Performance Summary',
    description: 'Track and analyze trading performance metrics',
    icon: BarChart3,
    category: 'trading',
    keywords: ['performance', 'summary', 'metrics', 'stats', 'analysis', 'report'],
    isNew: true,
  },
  {
    id: 'chartBlock',
    title: 'Chart Placeholder',
    description: 'Placeholder for trading charts (coming soon)',
    icon: PieChart,
    category: 'trading',
    keywords: ['chart', 'graph', 'trading', 'price', 'candlestick', 'analysis'],
    isPremium: true,
  },
  {
    id: 'calculationBlock',
    title: 'Risk Calculator',
    description: 'Calculate position size and risk (coming soon)',
    icon: Calculator,
    category: 'trading',
    keywords: ['calculation', 'math', 'formula', 'pnl', 'risk', 'calc', 'position', 'size'],
    isPremium: true,
  },

  // Advanced Blocks
  {
    id: 'calloutInfo',
    title: 'Info Callout',
    description: 'Highlight important information',
    icon: Info,
    category: 'advanced',
    keywords: ['callout', 'info', 'highlight', 'note', 'information', 'notice'],
  },
  {
    id: 'calloutWarning',
    title: 'Warning Callout',
    description: 'Add a warning notice',
    icon: AlertCircle,
    category: 'advanced',
    keywords: ['callout', 'warning', 'alert', 'caution', 'danger', 'important'],
  },
  {
    id: 'calloutSuccess',
    title: 'Success Callout',
    description: 'Highlight positive outcomes',
    icon: CheckCircle,
    category: 'advanced',
    keywords: ['callout', 'success', 'positive', 'win', 'good', 'achievement'],
  },
  {
    id: 'toggle',
    title: 'Toggle Section',
    description: 'Create a collapsible content section',
    icon: ChevronRight,
    category: 'advanced',
    keywords: ['toggle', 'collapsible', 'fold', 'expand', 'collapse', 'dropdown', 'accordion'],
  },
  {
    id: 'toggleList',
    title: 'Toggle List',
    description: 'Create a toggle with bullet points',
    icon: ChevronDown,
    category: 'advanced',
    keywords: ['toggle', 'list', 'collapsible', 'bullet', 'dropdown', 'expandable'],
  },

  // AI-Powered Blocks (Future)
  {
    id: 'aiInsights',
    title: 'AI Insights',
    description: 'Generate AI-powered trading insights (coming soon)',
    icon: Lightbulb,
    category: 'ai',
    keywords: ['ai', 'insights', 'analysis', 'artificial intelligence', 'suggestions'],
    isPremium: true,
  },
  {
    id: 'aiSummary',
    title: 'AI Summary',
    description: 'Auto-generate content summaries (coming soon)',
    icon: BookOpen,
    category: 'ai',
    keywords: ['ai', 'summary', 'auto', 'generate', 'artificial intelligence'],
    isPremium: true,
  },
]

export function EnhancedBlockSelector({ position, onSelect, onClose, mode = 'blocks' }: EnhancedBlockSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter blocks based on search query and category
  const filteredBlocks = blockOptions.filter((block) => {
    // Filter by category if selected
    if (selectedCategory && block.category !== selectedCategory) return false

    // Filter by search query
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
            handleBlockSelect(filteredBlocks[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'Tab':
          e.preventDefault()
          // Cycle through categories
          const categories = ['basic', 'media', 'trading', 'advanced', 'ai']
          const currentIndex = selectedCategory ? categories.indexOf(selectedCategory) : -1
          const nextIndex = (currentIndex + 1) % (categories.length + 1)
          setSelectedCategory(nextIndex === 0 ? null : categories[nextIndex - 1])
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [filteredBlocks, selectedIndex, selectedCategory, onClose])

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery, selectedCategory])

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

  const handleBlockSelect = (block: BlockOption) => {
    if (block.isPremium) {
      // TODO: Show premium upgrade modal
      console.log('Premium feature - show upgrade modal')
      return
    }

    onSelect(block.id)
  }

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

  const categoryOrder = ['basic', 'media', 'trading', 'advanced', 'ai']
  const categoryLabels = {
    basic: 'Basic',
    media: 'Media',
    trading: 'Trading',
    advanced: 'Advanced',
    ai: 'AI-Powered',
  }

  const categoryColors = {
    basic: 'text-blue-600 dark:text-blue-400',
    media: 'text-green-600 dark:text-green-400',
    trading: 'text-orange-600 dark:text-orange-400',
    advanced: 'text-purple-600 dark:text-purple-400',
    ai: 'text-pink-600 dark:text-pink-400',
  }

  return (
    <div
      ref={containerRef}
      style={menuStyle}
      className="w-96 max-h-[500px] overflow-auto studio-surface border border-studio-border rounded-lg shadow-studio-lg"
    >
      {/* Header */}
      <div className="p-4 border-b border-studio-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Add Block</h3>
            <p className="text-xs text-muted-foreground">
              {mode === 'blocks' ? 'Choose a block to add to your document' : 'Insert content blocks'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
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
        </div>

        {/* Category Filter */}
        <div className="flex gap-1 mt-3 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors",
              !selectedCategory
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            All
          </button>
          {categoryOrder.map((category) => {
            const hasBlocks = groupedBlocks[category]?.length > 0
            if (!hasBlocks) return null

            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors",
                  selectedCategory === category
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {categoryLabels[category]}
              </button>
            )
          })}
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
              <div key={category} className="mb-4 last:mb-0">
                <div className={cn(
                  "text-xs font-medium uppercase tracking-wide px-2 py-1 mb-2",
                  categoryColors[category]
                )}>
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
                        onClick={() => handleBlockSelect(block)}
                        disabled={block.isPremium}
                        className={cn(
                          'w-full text-left p-3 rounded-lg transition-colors relative',
                          'hover:bg-accent hover:text-accent-foreground',
                          'focus:outline-none focus:bg-accent focus:text-accent-foreground',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          isSelected && 'bg-accent text-accent-foreground'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <Icon className={cn(
                              "w-4 h-4",
                              block.isPremium && "opacity-60"
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium truncate">
                                {block.title}
                              </div>
                              {block.isNew && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium rounded">
                                  New
                                </span>
                              )}
                              {block.isPremium && (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-medium rounded">
                                  Pro
                                </span>
                              )}
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
      <div className="px-3 py-2 border-t border-studio-border text-xs text-muted-foreground bg-muted/20">
        <div className="flex items-center justify-between">
          <span>↑↓ navigate</span>
          <span>Tab categories</span>
          <span>Enter select</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  )
}