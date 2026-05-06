'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Editor } from '@tiptap/react'
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
  Plus,
  Hash,
  AlignLeft,
  Bold,
  Italic,
  Underline
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SlashCommand {
  id: string
  title: string
  description: string
  icon: React.ComponentType<any>
  shortcut: string
  action: (editor: Editor) => void
  category: 'basic' | 'headings' | 'lists' | 'advanced'
}

interface SlashCommandMenuProps {
  editor: Editor
  isOpen: boolean
  position: { top: number; left: number }
  onClose: () => void
  query: string
}

const SLASH_COMMANDS: SlashCommand[] = [
  // Basic Text
  {
    id: 'paragraph',
    title: 'Text',
    description: 'Start writing with plain text',
    icon: Type,
    shortcut: 'text',
    category: 'basic',
    action: (editor) => {
      editor.chain().focus().setParagraph().run()
    }
  },
  {
    id: 'bold',
    title: 'Bold',
    description: 'Make text bold',
    icon: Bold,
    shortcut: 'bold',
    category: 'basic',
    action: (editor) => {
      editor.chain().focus().toggleBold().run()
    }
  },
  {
    id: 'italic',
    title: 'Italic',
    description: 'Make text italic',
    icon: Italic,
    shortcut: 'italic',
    category: 'basic',
    action: (editor) => {
      editor.chain().focus().toggleItalic().run()
    }
  },

  // Headings
  {
    id: 'heading1',
    title: 'Heading 1',
    description: 'Large section heading',
    icon: Heading1,
    shortcut: 'h1',
    category: 'headings',
    action: (editor) => {
      editor.chain().focus().setHeading({ level: 1 }).run()
    }
  },
  {
    id: 'heading2',
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: Heading2,
    shortcut: 'h2',
    category: 'headings',
    action: (editor) => {
      editor.chain().focus().setHeading({ level: 2 }).run()
    }
  },
  {
    id: 'heading3',
    title: 'Heading 3',
    description: 'Small section heading',
    icon: Heading3,
    shortcut: 'h3',
    category: 'headings',
    action: (editor) => {
      editor.chain().focus().setHeading({ level: 3 }).run()
    }
  },

  // Lists and Tasks
  {
    id: 'bulletList',
    title: 'Bullet List',
    description: 'Create a simple bullet list',
    icon: List,
    shortcut: 'ul',
    category: 'lists',
    action: (editor) => {
      editor.chain().focus().toggleBulletList().run()
    }
  },
  {
    id: 'orderedList',
    title: 'Numbered List',
    description: 'Create a numbered list',
    icon: ListOrdered,
    shortcut: 'ol',
    category: 'lists',
    action: (editor) => {
      editor.chain().focus().toggleOrderedList().run()
    }
  },
  {
    id: 'taskList',
    title: 'To-do List',
    description: 'Track tasks with checkboxes',
    icon: CheckSquare,
    shortcut: 'todo',
    category: 'lists',
    action: (editor) => {
      editor.chain().focus().toggleTaskList().run()
    }
  },
  {
    id: 'checkbox',
    title: 'Checkbox',
    description: 'Add a single checkbox',
    icon: CheckSquare,
    shortcut: 'check',
    category: 'lists',
    action: (editor) => {
      editor.chain().focus().insertContent('- [ ] ').run()
    }
  },

  // Advanced
  {
    id: 'toggle',
    title: 'Toggle',
    description: 'Create a collapsible toggle section',
    icon: ChevronRight,
    shortcut: 'toggle',
    category: 'advanced',
    action: (editor) => {
      editor.chain().focus().insertContent(`
<details>
<summary><strong>Toggle Section</strong></summary>

Content goes here...

</details>
`).run()
    }
  },
  {
    id: 'quote',
    title: 'Quote',
    description: 'Add a quote or callout',
    icon: Quote,
    shortcut: 'quote',
    category: 'advanced',
    action: (editor) => {
      editor.chain().focus().setBlockquote().run()
    }
  },
  {
    id: 'codeBlock',
    title: 'Code Block',
    description: 'Insert a code block',
    icon: Code,
    shortcut: 'code',
    category: 'advanced',
    action: (editor) => {
      editor.chain().focus().setCodeBlock().run()
    }
  },
  {
    id: 'divider',
    title: 'Divider',
    description: 'Add a horizontal divider',
    icon: Minus,
    shortcut: 'divider',
    category: 'advanced',
    action: (editor) => {
      editor.chain().focus().setHorizontalRule().run()
    }
  }
]

const COMMAND_CATEGORIES = {
  basic: { name: 'Basic', color: '#10B981' },
  headings: { name: 'Headings', color: '#3B82F6' },
  lists: { name: 'Lists', color: '#F59E0B' },
  advanced: { name: 'Advanced', color: '#8B5CF6' }
}

export function SlashCommandMenu({
  editor,
  isOpen,
  position,
  onClose,
  query
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  // Filter commands based on query
  const filteredCommands = SLASH_COMMANDS.filter(command =>
    command.title.toLowerCase().includes(query.toLowerCase()) ||
    command.shortcut.toLowerCase().includes(query.toLowerCase()) ||
    command.description.toLowerCase().includes(query.toLowerCase())
  )

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, command) => {
    if (!acc[command.category]) {
      acc[command.category] = []
    }
    acc[command.category].push(command)
    return acc
  }, {} as Record<string, SlashCommand[]>)

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedIndex(prev =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          )
          break
        case 'Enter':
          event.preventDefault()
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex])
          }
          break
        case 'Escape':
          event.preventDefault()
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, filteredCommands, onClose])

  const executeCommand = (command: SlashCommand) => {
    command.action(editor)
    onClose()
  }

  if (!isOpen || filteredCommands.length === 0) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg shadow-2xl min-w-[300px] max-w-[400px] max-h-[400px] overflow-y-auto"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="p-2">
        {query && (
          <div className="px-3 py-2 text-xs text-gray-400 border-b border-[#2a2a2a] mb-2">
            {filteredCommands.length} result{filteredCommands.length !== 1 ? 's' : ''} for "{query}"
          </div>
        )}

        {Object.entries(groupedCommands).map(([categoryKey, commands]) => {
          const category = COMMAND_CATEGORIES[categoryKey as keyof typeof COMMAND_CATEGORIES]
          const startIndex = filteredCommands.findIndex(cmd => cmd.category === categoryKey)

          return (
            <div key={categoryKey} className="mb-2 last:mb-0">
              <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                {category.name}
              </div>
              <div className="space-y-1">
                {commands.map((command, index) => {
                  const globalIndex = filteredCommands.indexOf(command)
                  const Icon = command.icon

                  return (
                    <button
                      key={command.id}
                      onClick={() => executeCommand(command)}
                      className={cn(
                        'w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors',
                        globalIndex === selectedIndex
                          ? 'bg-primary/20 text-primary'
                          : 'text-gray-300 hover:bg-[#1a1a1a] hover:text-white'
                      )}
                    >
                      <div
                        className={cn(
                          'p-1.5 rounded',
                          globalIndex === selectedIndex
                            ? 'bg-primary/30'
                            : 'bg-[#2a2a2a]'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{command.title}</span>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: `${category.color}20`,
                              color: category.color
                            }}
                          >
                            /{command.shortcut}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                          {command.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {filteredCommands.length === 0 && (
        <div className="p-4 text-center text-gray-500">
          <Type className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No commands found</p>
          <p className="text-xs">Try typing a different command</p>
        </div>
      )}
    </div>
  )
}

export default SlashCommandMenu