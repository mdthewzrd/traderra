'use client'

import React, { useCallback, useRef, useEffect, useState } from 'react'
import { useEditor, EditorContent, JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Heading from '@tiptap/extension-heading'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Typography from '@tiptap/extension-typography'
import Dropcursor from '@tiptap/extension-dropcursor'
import Gapcursor from '@tiptap/extension-gapcursor'
import { lowlight } from 'lowlight'
import { cn } from '@/lib/utils'
import { EditorToolbar } from './EditorToolbar'
import { BlockSelector } from './BlockSelector'

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
  }
}

export interface RichTextEditorProps {
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
}

export function RichTextEditor({
  document,
  onChange,
  onSave,
  placeholder = "Start writing... Type '/' for commands",
  editable = true,
  showToolbar = true,
  showCharacterCount = true,
  className,
  autoSave = true,
  autoSaveDelay = 30000, // 30 seconds
}: RichTextEditorProps) {
  const [isBlockSelectorOpen, setIsBlockSelectorOpen] = useState(false)
  const [blockSelectorPosition, setBlockSelectorPosition] = useState({ x: 0, y: 0 })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>()
  const editorRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We'll use CodeBlockLowlight instead
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg shadow-studio',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary hover:text-primary/80 underline cursor-pointer',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-studio-border rounded-lg overflow-hidden',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border-b border-studio-border',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'bg-muted/30 px-3 py-2 text-left font-medium border-r border-studio-border',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'px-3 py-2 border-r border-studio-border',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'not-prose list-none',
        },
      }),
      TaskItem.configure({
        HTMLAttributes: {
          class: 'flex items-start gap-2 [&>label]:mt-1',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'bg-muted/50 rounded-lg p-4 font-mono text-sm border border-studio-border',
        },
      }),
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
        showOnlyCurrent: false,
      }),
      CharacterCount,
      Heading.configure({
        levels: [1, 2, 3, 4],
        HTMLAttributes: {
          class: 'scroll-mt-20',
        },
      }),
      TextStyle,
      Color,
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-yellow-200/30 text-yellow-900 dark:bg-yellow-500/30 dark:text-yellow-100',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Typography,
      Dropcursor.configure({
        color: 'hsl(var(--primary))',
        width: 2,
      }),
      Gapcursor,
    ],
    content: document?.content,
    editable,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-invert max-w-none focus:outline-none min-h-[500px] p-6',
          'prose-headings:text-foreground prose-headings:font-semibold',
          'prose-p:text-foreground prose-p:leading-relaxed',
          'prose-strong:text-foreground prose-em:text-foreground',
          'prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
          'prose-pre:bg-transparent prose-pre:p-0',
          'prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground',
          'prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground',
          'prose-hr:border-border',
          'prose-img:rounded-lg prose-img:shadow-studio',
          className
        ),
      },
      handleKeyDown: (view, event) => {
        // Handle slash command
        if (event.key === '/' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
          const { selection } = view.state
          const { $from } = selection

          // Check if we're at the start of a line or after whitespace
          const beforeText = $from.nodeBefore?.textContent || ''
          const isAtStartOfLine = beforeText === '' || beforeText.endsWith('\n') || beforeText.endsWith(' ')

          if (isAtStartOfLine) {
            event.preventDefault()

            // Get cursor position
            const rect = view.coordsAtPos(selection.from)
            setBlockSelectorPosition({ x: rect.left, y: rect.bottom })
            setIsBlockSelectorOpen(true)

            return true
          }
        }

        // Close block selector on escape
        if (event.key === 'Escape' && isBlockSelectorOpen) {
          setIsBlockSelectorOpen(false)
          return true
        }

        return false
      },
    },
    onUpdate: ({ editor }) => {
      const content = editor.getJSON()
      onChange?.(content)
      setHasUnsavedChanges(true)

      // Auto-save logic
      if (autoSave && document && onSave) {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current)
        }

        autoSaveTimeoutRef.current = setTimeout(() => {
          const updatedDocument: Document = {
            ...document,
            content,
            metadata: {
              ...document.metadata,
              lastModified: new Date().toISOString(),
              wordCount: editor.storage.characterCount.words(),
              readTime: Math.ceil(editor.storage.characterCount.words() / 200), // Average reading speed
            },
          }

          onSave(updatedDocument)
          setHasUnsavedChanges(false)
        }, autoSaveDelay)
      }
    },
  })

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  // Handle block selection
  const handleBlockSelect = useCallback((blockType: string) => {
    if (!editor) return

    const { selection } = editor.state
    const { from } = selection

    // Remove the slash if it was typed
    if (editor.state.doc.textBetween(from - 1, from) === '/') {
      editor.chain().focus().deleteRange({ from: from - 1, to: from }).run()
    }

    switch (blockType) {
      case 'heading1':
        editor.chain().focus().setHeading({ level: 1 }).run()
        break
      case 'heading2':
        editor.chain().focus().setHeading({ level: 2 }).run()
        break
      case 'heading3':
        editor.chain().focus().setHeading({ level: 3 }).run()
        break
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run()
        break
      case 'orderedList':
        editor.chain().focus().toggleOrderedList().run()
        break
      case 'taskList':
        editor.chain().focus().toggleTaskList().run()
        break
      case 'codeBlock':
        editor.chain().focus().setCodeBlock().run()
        break
      case 'blockquote':
        editor.chain().focus().setBlockquote().run()
        break
      case 'table':
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        break
      case 'horizontalRule':
        editor.chain().focus().setHorizontalRule().run()
        break
      case 'toggle':
        editor.chain().focus().insertContent(`
<details>
<summary><strong>Toggle Section</strong></summary>

Content goes here...

</details>
`).run()
        break
      case 'toggleList':
        editor.chain().focus().insertContent(`
<details>
<summary><strong>Toggle List</strong></summary>

• Item 1
• Item 2
• Item 3

</details>
`).run()
        break
    }

    setIsBlockSelectorOpen(false)
  }, [editor])

  // Handle image upload
  const handleImageUpload = useCallback((file: File) => {
    if (!editor) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const src = e.target?.result as string
      editor.chain().focus().setImage({ src }).run()
    }
    reader.readAsDataURL(file)
  }, [editor])

  // Manual save function
  const handleSave = useCallback(() => {
    if (!editor || !document || !onSave) return

    const content = editor.getJSON()
    const updatedDocument: Document = {
      ...document,
      content,
      metadata: {
        ...document.metadata,
        lastModified: new Date().toISOString(),
        wordCount: editor.storage.characterCount.words(),
        readTime: Math.ceil(editor.storage.characterCount.words() / 200),
      },
    }

    onSave(updatedDocument)
    setHasUnsavedChanges(false)
  }, [editor, document, onSave])

  // Keyboard shortcuts for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm studio-muted">Loading editor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full studio-bg">
      {showToolbar && (
        <EditorToolbar
          editor={editor}
          onImageUpload={handleImageUpload}
          onSave={handleSave}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      )}

      <div className="flex-1 relative" ref={editorRef}>
        <EditorContent
          editor={editor}
          className="h-full studio-surface rounded-lg border border-studio-border overflow-auto"
        />

        {/* Block Selector */}
        {isBlockSelectorOpen && (
          <BlockSelector
            position={blockSelectorPosition}
            onSelect={handleBlockSelect}
            onClose={() => setIsBlockSelectorOpen(false)}
          />
        )}
      </div>

      {/* Character Count */}
      {showCharacterCount && editor.storage.characterCount && (
        <div className="flex items-center justify-between p-2 text-xs studio-muted border-t border-studio-border">
          <div className="flex items-center gap-4">
            <span>{editor.storage.characterCount.characters()} characters</span>
            <span>{editor.storage.characterCount.words()} words</span>
            <span>~{Math.ceil(editor.storage.characterCount.words() / 200)} min read</span>
          </div>

          {hasUnsavedChanges && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span>Unsaved changes</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}