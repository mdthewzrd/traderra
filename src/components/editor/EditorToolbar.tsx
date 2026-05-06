'use client'

import React, { useRef } from 'react'
import { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Table,
  Image,
  Link,
  Minus,
  Undo,
  Redo,
  Save,
  Type,
  Palette,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditorToolbarProps {
  editor: Editor
  onImageUpload?: (file: File) => void
  onSave?: () => void
  hasUnsavedChanges?: boolean
  className?: string
}

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  children: React.ReactNode
  title: string
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  isActive = false,
  disabled = false,
  children,
  title,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      'p-2 rounded-lg transition-all duration-200 text-sm',
      'hover:bg-accent hover:text-accent-foreground',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
      isActive && 'bg-primary text-primary-foreground shadow-sm'
    )}
  >
    {children}
  </button>
)

const ToolbarDivider: React.FC = () => (
  <div className="w-px h-6 bg-border mx-1" />
)

export function EditorToolbar({
  editor,
  onImageUpload,
  onSave,
  hasUnsavedChanges = false,
  className,
}: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      onImageUpload?.(file)
    }
    // Reset the input
    event.target.value = ''
  }

  const handleLinkClick = () => {
    const url = window.prompt('Enter URL:')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const toggleHeading = (level: 1 | 2 | 3) => {
    if (editor.isActive('heading', { level })) {
      editor.chain().focus().setParagraph().run()
    } else {
      editor.chain().focus().setHeading({ level }).run()
    }
  }

  const handleColorChange = (color: string) => {
    editor.chain().focus().setColor(color).run()
  }

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-1 p-3 bg-card border-b border-border',
      'sticky top-0 z-10 backdrop-blur-sm',
      className
    )}>
      {/* File Operations */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => onSave?.()}
          title={hasUnsavedChanges ? 'Save changes (Ctrl+S)' : 'Saved'}
          disabled={!hasUnsavedChanges}
        >
          <Save className={cn(
            'w-4 h-4',
            hasUnsavedChanges ? 'text-yellow-500' : 'text-green-500'
          )} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Headings */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => toggleHeading(1)}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <span className="font-bold text-lg">H1</span>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => toggleHeading(2)}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <span className="font-bold">H2</span>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => toggleHeading(3)}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <span className="font-bold text-sm">H3</span>
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Text Formatting */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Underline (Ctrl+U)"
        >
          <Underline className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title="Inline Code"
        >
          <Code className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          isActive={editor.isActive('highlight')}
          title="Highlight"
        >
          <Highlighter className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Text Alignment */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          isActive={editor.isActive({ textAlign: 'justify' })}
          title="Justify"
        >
          <AlignJustify className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Lists */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive('taskList')}
          title="Task List"
        >
          <CheckSquare className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Blocks */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Insert Table"
        >
          <Table className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <Minus className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Media & Links */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={handleImageClick}
          title="Insert Image"
        >
          <Image className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={handleLinkClick}
          isActive={editor.isActive('link')}
          title="Insert Link"
        >
          <Link className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Color Picker */}
      <div className="flex items-center gap-1">
        <div className="relative group">
          <ToolbarButton
            onClick={() => {}}
            title="Text Color"
          >
            <Palette className="w-4 h-4" />
          </ToolbarButton>

          {/* Color Palette */}
          <div className="absolute top-full mt-2 left-0 hidden group-hover:block z-50">
            <div className="bg-popover border border-border rounded-lg p-2 shadow-lg">
              <div className="grid grid-cols-6 gap-1">
                {[
                  '#000000', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#F3F4F6',
                  '#DC2626', '#EA580C', '#D97706', '#CA8A04', '#65A30D', '#16A34A',
                  '#059669', '#0891B2', '#0284C7', '#2563EB', '#4F46E5', '#7C3AED',
                  '#A21CAF', '#BE185D', '#E11D48', '#EF4444', '#F97316', '#EAB308',
                ].map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Status indicator */}
      {hasUnsavedChanges && (
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
          <span>Unsaved changes</span>
        </div>
      )}
    </div>
  )
}