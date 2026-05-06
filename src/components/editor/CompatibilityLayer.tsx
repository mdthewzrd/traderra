'use client'

import React from 'react'
import { JSONContent } from '@tiptap/react'
import { RichTextEditor } from './RichTextEditor'
import { BlockEditor } from './BlockEditor'

// Import types
export interface Document {
  id: string
  folderId: string
  title: string
  type: 'strategy' | 'research' | 'review' | 'note' | 'trade_analysis'
  content: JSONContent
  metadata: {
    tags: string[]
    category?: string
    template?: string
    lastModified: string
    wordCount: number
    readTime: number
    blockCount?: number
    blockTypes?: string[]
  }
}

export interface EditorProps {
  document?: Document
  onChange?: (content: JSONContent) => void
  onSave?: (document: Document) => void
  placeholder?: string
  editable?: boolean
  showToolbar?: boolean
  showCharacterCount?: boolean
  className?: string
  autoSave?: boolean
  autoSaveDelay?: number
  mode?: 'rich-text' | 'blocks' | 'auto' // Auto-detect mode
}

/**
 * Smart Editor Component that automatically selects the appropriate editor
 * based on content structure and user preferences
 */
export function SmartEditor({
  document,
  mode = 'auto',
  ...props
}: EditorProps) {
  // Determine editor mode
  const getEditorMode = (): 'rich-text' | 'blocks' => {
    if (mode !== 'auto') {
      return mode
    }

    // Auto-detect based on content
    if (document?.content) {
      const hasBlocks = hasBlockContent(document.content)
      if (hasBlocks) {
        return 'blocks'
      }
    }

    // Check metadata hints
    if (document?.metadata?.blockCount && document.metadata.blockCount > 0) {
      return 'blocks'
    }

    // Default to rich-text for backward compatibility
    return 'rich-text'
  }

  const editorMode = getEditorMode()

  // Enhanced onChange to update metadata
  const handleChange = (content: JSONContent) => {
    if (props.onChange) {
      props.onChange(content)
    }

    // Auto-update block metadata if we detect blocks
    if (document && editorMode === 'blocks') {
      const blockCount = countBlocks(content)
      const blockTypes = getBlockTypes(content)

      // Update document metadata (this would normally be handled by the parent component)
      if (blockCount !== document.metadata.blockCount ||
          !arraysEqual(blockTypes, document.metadata.blockTypes || [])) {

        const updatedDocument = {
          ...document,
          metadata: {
            ...document.metadata,
            blockCount,
            blockTypes,
          },
        }

        // Note: This would typically be handled at a higher level
        console.log('Block metadata updated:', { blockCount, blockTypes })
      }
    }
  }

  if (editorMode === 'blocks') {
    return (
      <BlockEditor
        {...props}
        document={document}
        onChange={handleChange}
        mode="blocks"
      />
    )
  }

  return (
    <RichTextEditor
      {...props}
      document={document}
      onChange={handleChange}
    />
  )
}

/**
 * Legacy Editor Wrapper for backward compatibility
 * Use this to replace existing RichTextEditor components with minimal changes
 */
export function CompatibleEditor(props: EditorProps) {
  return <SmartEditor {...props} mode="auto" />
}

// Utility functions
function hasBlockContent(content: JSONContent): boolean {
  if (!content || !content.content) return false

  function checkForBlocks(node: JSONContent): boolean {
    if (node.type === 'tradeEntry' ||
        node.type === 'strategyTemplate' ||
        node.type === 'performanceSummary') {
      return true
    }

    if (node.content) {
      return node.content.some(checkForBlocks)
    }

    return false
  }

  return content.content.some(checkForBlocks)
}

function countBlocks(content: JSONContent): number {
  if (!content || !content.content) return 0

  let count = 0

  function traverse(node: JSONContent) {
    if (node.type === 'tradeEntry' ||
        node.type === 'strategyTemplate' ||
        node.type === 'performanceSummary') {
      count++
    }

    if (node.content) {
      node.content.forEach(traverse)
    }
  }

  content.content.forEach(traverse)
  return count
}

function getBlockTypes(content: JSONContent): string[] {
  if (!content || !content.content) return []

  const types = new Set<string>()

  function traverse(node: JSONContent) {
    if (node.type === 'tradeEntry' ||
        node.type === 'strategyTemplate' ||
        node.type === 'performanceSummary') {
      types.add(node.type)
    }

    if (node.content) {
      node.content.forEach(traverse)
    }
  }

  content.content.forEach(traverse)
  return Array.from(types)
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((val, index) => val === b[index])
}

/**
 * Content Migration Utilities
 */
export class ContentMigration {
  /**
   * Convert rich text content to suggest block conversions
   */
  static suggestBlockConversions(content: JSONContent): Array<{
    type: 'tradeEntry' | 'strategyTemplate' | 'performanceSummary'
    position: number
    confidence: number
    preview: string
    data?: any
  }> {
    const suggestions: Array<any> = []

    if (!content || !content.content) return suggestions

    function analyzeText(text: string, position: number) {
      const lowerText = text.toLowerCase()

      // Look for trade mentions
      const tradeKeywords = ['bought', 'sold', 'entry', 'exit', 'position', 'trade', 'p&l', 'profit', 'loss']
      const tradeScore = tradeKeywords.filter(keyword => lowerText.includes(keyword)).length

      if (tradeScore >= 2) {
        suggestions.push({
          type: 'tradeEntry',
          position,
          confidence: Math.min(tradeScore * 0.3, 1),
          preview: text.substring(0, 100) + '...',
          data: {
            symbol: extractSymbol(text),
            notes: text,
          },
        })
      }

      // Look for strategy mentions
      const strategyKeywords = ['strategy', 'rules', 'setup', 'entry criteria', 'exit criteria', 'risk management']
      const strategyScore = strategyKeywords.filter(keyword => lowerText.includes(keyword)).length

      if (strategyScore >= 2) {
        suggestions.push({
          type: 'strategyTemplate',
          position,
          confidence: Math.min(strategyScore * 0.25, 1),
          preview: text.substring(0, 100) + '...',
          data: {
            name: extractStrategyName(text),
            description: text,
          },
        })
      }

      // Look for performance mentions
      const performanceKeywords = ['win rate', 'profit factor', 'drawdown', 'performance', 'results', 'summary']
      const performanceScore = performanceKeywords.filter(keyword => lowerText.includes(keyword)).length

      if (performanceScore >= 2) {
        suggestions.push({
          type: 'performanceSummary',
          position,
          confidence: Math.min(performanceScore * 0.3, 1),
          preview: text.substring(0, 100) + '...',
          data: {
            period: { name: 'Analysis Period' },
            notes: text,
          },
        })
      }
    }

    function traverse(node: JSONContent, position: number = 0) {
      if (node.type === 'paragraph' && node.content) {
        const text = extractTextFromNode(node)
        if (text.length > 50) { // Only analyze substantial paragraphs
          analyzeText(text, position)
        }
      }

      if (node.content) {
        node.content.forEach((child, index) => {
          traverse(child, position + index)
        })
      }
    }

    content.content.forEach((node, index) => {
      traverse(node, index)
    })

    // Sort by confidence and remove duplicates
    return suggestions
      .filter(s => s.confidence > 0.5)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5) // Limit to top 5 suggestions
  }

  /**
   * Automatically convert content based on suggestions
   */
  static autoConvert(content: JSONContent): JSONContent {
    const suggestions = this.suggestBlockConversions(content)

    if (suggestions.length === 0) {
      return content
    }

    // For now, just add a note about conversion possibilities
    // In a full implementation, this would modify the content structure

    const conversionNote = {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: `💡 Block Conversion Available: Found ${suggestions.length} sections that could be converted to trading blocks. Use the conversion tool to upgrade this content.`,
        },
      ],
    }

    return {
      ...content,
      content: [conversionNote, ...(content.content || [])],
    }
  }
}

// Helper functions for content analysis
function extractTextFromNode(node: JSONContent): string {
  if (node.type === 'text') {
    return node.text || ''
  }

  if (node.content) {
    return node.content.map(extractTextFromNode).join('')
  }

  return ''
}

function extractSymbol(text: string): string {
  // Simple regex to find potential stock symbols
  const matches = text.match(/\b[A-Z]{2,5}\b/g)
  return matches ? matches[0] : ''
}

function extractStrategyName(text: string): string {
  // Try to extract strategy name from text
  const lines = text.split('\n')
  const firstLine = lines[0]

  if (firstLine.length < 50) {
    return firstLine
  }

  return 'Custom Strategy'
}

/**
 * Migration hooks for React components
 */
export function useMigrationWarning(document?: Document) {
  const [showWarning, setShowWarning] = React.useState(false)

  React.useEffect(() => {
    if (document?.content) {
      const suggestions = ContentMigration.suggestBlockConversions(document.content)
      setShowWarning(suggestions.length > 0)
    }
  }, [document])

  return {
    showWarning,
    dismissWarning: () => setShowWarning(false),
  }
}

export function useContentMode(document?: Document) {
  const [mode, setMode] = React.useState<'rich-text' | 'blocks'>('rich-text')

  React.useEffect(() => {
    if (document) {
      const hasBlocks = document.content ? hasBlockContent(document.content) : false
      const blockCount = document.metadata?.blockCount || 0

      if (hasBlocks || blockCount > 0) {
        setMode('blocks')
      } else {
        setMode('rich-text')
      }
    }
  }, [document])

  return {
    mode,
    setMode,
    canSwitchToBlocks: document?.content ? !hasBlockContent(document.content) : true,
    canSwitchToRichText: true, // Always allow fallback to rich text
  }
}