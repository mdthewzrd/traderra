// Rich Text Editor Components for Traderra
// Notion-like editor with trading-specific features

// Core Editor Components
export { RichTextEditor } from './RichTextEditor'
export type { Document, RichTextEditorProps } from './RichTextEditor'

export { EditorToolbar } from './EditorToolbar'
export { BlockSelector } from './BlockSelector'
export { EditorSidebar } from './EditorSidebar'
export { DocumentManager } from './DocumentManager'

// Trading-Specific Blocks
export { TradeEntryBlock } from './blocks/TradeEntryBlock'
export type { TradeData } from './blocks/TradeEntryBlock'

export { ChartBlock } from './blocks/ChartBlock'
export type { ChartConfig } from './blocks/ChartBlock'

export { CalculationBlock, calculationTemplates } from './blocks/CalculationBlock'
export type { CalculationFormula } from './blocks/CalculationBlock'

// Document Templates
export { DocumentTemplates, documentTemplates } from './templates/DocumentTemplates'
export type { DocumentTemplate } from './templates/DocumentTemplates'

// Re-export commonly used types
export type {
  JSONContent,
  Editor
} from '@tiptap/react'