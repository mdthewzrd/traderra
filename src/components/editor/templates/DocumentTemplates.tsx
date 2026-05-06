'use client'

import React, { useState } from 'react'
import { JSONContent } from '@tiptap/react'
import {
  FileText,
  TrendingUp,
  Search,
  BarChart3,
  Target,
  BookOpen,
  Plus,
  Star,
  Clock,
  Users,
  Award,
  Calendar,
  Lightbulb,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Document } from '../RichTextEditor'

export interface DocumentTemplate {
  id: string
  name: string
  description: string
  category: 'strategy' | 'research' | 'review' | 'note' | 'trade_analysis'
  icon: React.ComponentType<{ className?: string }>
  tags: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime: string
  content: JSONContent
  metadata: {
    author?: string
    version: string
    lastUpdated: string
    popularity?: number
  }
}

interface DocumentTemplatesProps {
  onSelectTemplate: (template: DocumentTemplate) => void
  onClose: () => void
  className?: string
}

// Document templates with structured content
export const documentTemplates: DocumentTemplate[] = [
  {
    id: 'trade-analysis-template',
    name: 'Trade Analysis',
    description: 'Comprehensive template for analyzing individual trades',
    category: 'trade_analysis',
    icon: TrendingUp,
    tags: ['analysis', 'trade', 'review', 'performance'],
    difficulty: 'beginner',
    estimatedTime: '15-30 min',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Trade Analysis: [SYMBOL]' }]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Date: ' },
            { type: 'text', marks: [{ type: 'bold' }], text: '[Enter Date]' }
          ]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '📊 Trade Overview' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Insert trade entry block here to document the basic trade details.' }]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '🎯 Setup Analysis' }]
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Market Context' }]
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Overall market trend: ' }] }]
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sector performance: ' }] }]
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Key economic events: ' }] }]
            }
          ]
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Technical Analysis' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Insert chart block here to show the setup.' }]
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Key support/resistance levels: ' }] }]
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Chart patterns identified: ' }] }]
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Indicator signals: ' }] }]
            }
          ]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '💰 Risk Management' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Insert calculation block for position size and risk metrics.' }]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '🎭 Psychology & Emotions' }]
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Emotional state before trade: ' }] }]
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Confidence level (1-10): ' }] }]
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Any biases or concerns: ' }] }]
            }
          ]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '📈 Execution & Results' }]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Entry executed as planned' }] }]
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Stop loss properly set' }] }]
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Position sizing correct' }] }]
            }
          ]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '🎓 Lessons Learned' }]
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'What Went Well' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'List the positive aspects of this trade...' }]
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'What Could Be Improved' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Identify areas for improvement...' }]
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Action Items' }]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Review and update strategy rules' }] }]
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Practice identified weak areas' }] }]
            }
          ]
        }
      ]
    },
    metadata: {
      author: 'Traderra Team',
      version: '1.0',
      lastUpdated: '2024-01-15',
      popularity: 95
    }
  },
  {
    id: 'strategy-document-template',
    name: 'Trading Strategy',
    description: 'Comprehensive template for documenting trading strategies',
    category: 'strategy',
    icon: Target,
    tags: ['strategy', 'rules', 'backtesting', 'methodology'],
    difficulty: 'intermediate',
    estimatedTime: '45-60 min',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Trading Strategy: [Strategy Name]' }]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Version: ' },
            { type: 'text', marks: [{ type: 'bold' }], text: '1.0' },
            { type: 'text', text: ' | Created: ' },
            { type: 'text', marks: [{ type: 'bold' }], text: '[Date]' }
          ]
        },
        {
          type: 'horizontalRule'
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '🎯 Strategy Overview' }]
        },
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', marks: [{ type: 'italic' }], text: 'Provide a brief description of what this strategy aims to achieve and its core philosophy.' }]
            }
          ]
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: 'Market Type: ' },
                    { type: 'text', text: 'Trending/Ranging/Volatile' }
                  ]
                }
              ]
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: 'Timeframe: ' },
                    { type: 'text', text: 'Primary and secondary timeframes' }
                  ]
                }
              ]
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: 'Risk per Trade: ' },
                    { type: 'text', text: '1-2% of account' }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    metadata: {
      author: 'Traderra Team',
      version: '1.0',
      lastUpdated: '2024-01-15',
      popularity: 88
    }
  },
  {
    id: 'research-note-template',
    name: 'Research Note',
    description: 'Template for market research and analysis notes',
    category: 'research',
    icon: Search,
    tags: ['research', 'analysis', 'market', 'fundamental'],
    difficulty: 'beginner',
    estimatedTime: '20-40 min',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Research Note: [Topic/Symbol]' }]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Research Date: ' },
            { type: 'text', marks: [{ type: 'bold' }], text: '[Date]' },
            { type: 'text', text: ' | Analyst: ' },
            { type: 'text', marks: [{ type: 'bold' }], text: '[Your Name]' }
          ]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '📋 Executive Summary' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'italic' }], text: 'Provide a concise summary of your research findings and key takeaways.' }]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '🔍 Key Findings' }]
        },
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Primary finding or trend identified' }] }]
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Supporting evidence or data points' }] }]
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Potential implications for trading' }] }]
            }
          ]
        }
      ]
    },
    metadata: {
      author: 'Traderra Team',
      version: '1.0',
      lastUpdated: '2024-01-15',
      popularity: 76
    }
  },
  {
    id: 'performance-review-template',
    name: 'Performance Review',
    description: 'Monthly/quarterly performance review template',
    category: 'review',
    icon: BarChart3,
    tags: ['performance', 'review', 'analysis', 'goals'],
    difficulty: 'intermediate',
    estimatedTime: '30-45 min',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Performance Review: [Month/Quarter] [Year]' }]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '📊 Performance Metrics' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Insert calculation blocks for key performance metrics.' }]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '🎯 Goals Assessment' }]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Achieved target win rate' }] }]
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Stayed within risk limits' }] }]
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Followed trading plan consistently' }] }]
            }
          ]
        }
      ]
    },
    metadata: {
      author: 'Traderra Team',
      version: '1.0',
      lastUpdated: '2024-01-15',
      popularity: 82
    }
  },
  {
    id: 'quick-note-template',
    name: 'Quick Note',
    description: 'Simple template for quick thoughts and observations',
    category: 'note',
    icon: FileText,
    tags: ['note', 'quick', 'thoughts', 'observations'],
    difficulty: 'beginner',
    estimatedTime: '5-10 min',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Quick Note' }]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Date: ' },
            { type: 'text', marks: [{ type: 'bold' }], text: new Date().toLocaleDateString() }
          ]
        },
        {
          type: 'horizontalRule'
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Start writing your thoughts here...' }]
        }
      ]
    },
    metadata: {
      author: 'Traderra Team',
      version: '1.0',
      lastUpdated: '2024-01-15',
      popularity: 92
    }
  }
]

export function DocumentTemplates({ onSelectTemplate, onClose, className }: DocumentTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const categories = [
    { id: 'all', name: 'All Templates', icon: FileText },
    { id: 'trade_analysis', name: 'Trade Analysis', icon: TrendingUp },
    { id: 'strategy', name: 'Strategy', icon: Target },
    { id: 'research', name: 'Research', icon: Search },
    { id: 'review', name: 'Review', icon: BarChart3 },
    { id: 'note', name: 'Notes', icon: BookOpen },
  ]

  // Filter templates
  const filteredTemplates = documentTemplates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    const matchesSearch = !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    return matchesCategory && matchesSearch
  })

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'text-green-500 bg-green-500/10'
      case 'intermediate':
        return 'text-yellow-500 bg-yellow-500/10'
      case 'advanced':
        return 'text-red-500 bg-red-500/10'
      default:
        return 'text-gray-500 bg-gray-500/10'
    }
  }

  return (
    <div className={cn(
      'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4',
      className
    )}>
      <div className="w-full max-w-4xl max-h-[90vh] studio-surface rounded-lg border border-studio-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-studio-border">
          <div>
            <h2 className="text-2xl font-bold">Choose a Template</h2>
            <p className="text-muted-foreground mt-1">
              Start with a pre-built template to structure your document
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b border-studio-border">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto">
              {categories.map((category) => {
                const Icon = category.icon
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                      selectedCategory === category.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {category.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">No templates found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or category filter
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => {
                const Icon = template.icon
                return (
                  <button
                    key={template.id}
                    onClick={() => onSelectTemplate(template)}
                    className="text-left p-4 studio-surface border border-studio-border rounded-lg hover:shadow-studio-lg transition-all duration-200 group"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Icon className="w-5 h-5 text-primary group-hover:text-current" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">
                          {template.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'px-2 py-1 rounded-full font-medium',
                          getDifficultyColor(template.difficulty)
                        )}>
                          {template.difficulty}
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {template.estimatedTime}
                        </span>
                      </div>

                      {template.metadata.popularity && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Star className="w-3 h-3" />
                          <span>{template.metadata.popularity}%</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mt-3">
                      {template.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                      {template.tags.length > 3 && (
                        <span className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs">
                          +{template.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-studio-border">
          <div className="text-sm text-muted-foreground">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSelectTemplate({
                id: 'blank',
                name: 'Blank Document',
                description: 'Start with a blank document',
                category: 'note',
                icon: Plus,
                tags: [],
                difficulty: 'beginner',
                estimatedTime: '0 min',
                content: {
                  type: 'doc',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '' }]
                    }
                  ]
                },
                metadata: {
                  version: '1.0',
                  lastUpdated: new Date().toISOString()
                }
              })}
              className="btn-secondary"
            >
              Start Blank
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}