'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Editor } from '@tiptap/react'
import {
  GripVertical,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Edit3,
  Move,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BlockHoverMenuProps {
  blockId: string
  editor: Editor
  onClose: () => void
}

export function BlockHoverMenu({ blockId, editor, onClose }: BlockHoverMenuProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [showMore, setShowMore] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Find the block element and position the menu
    const blockElement = document.querySelector(`[data-block-id="${blockId}"]`)
    if (blockElement) {
      const rect = blockElement.getBoundingClientRect()
      setPosition({
        x: rect.left - 40, // Position to the left of the block
        y: rect.top,
      })
    }
  }, [blockId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', blockId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDuplicate = () => {
    // Find the block and duplicate it
    const { doc } = editor.state
    let blockPos: number | null = null
    let blockNode: any = null

    doc.descendants((node, pos) => {
      if (node.attrs.id === blockId) {
        blockPos = pos
        blockNode = node
        return false
      }
    })

    if (blockPos !== null && blockNode) {
      const duplicatedNode = {
        ...blockNode.toJSON(),
        attrs: {
          ...blockNode.attrs,
          id: `${blockNode.type.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        },
      }

      editor
        .chain()
        .focus()
        .setTextSelection(blockPos + blockNode.nodeSize)
        .insertContent(duplicatedNode)
        .run()
    }

    onClose()
  }

  const handleDelete = () => {
    const { doc } = editor.state
    let blockPos: number | null = null
    let blockSize: number | null = null

    doc.descendants((node, pos) => {
      if (node.attrs.id === blockId) {
        blockPos = pos
        blockSize = node.nodeSize
        return false
      }
    })

    if (blockPos !== null && blockSize !== null) {
      editor
        .chain()
        .focus()
        .deleteRange({ from: blockPos, to: blockPos + blockSize })
        .run()
    }

    onClose()
  }

  const handleMoveUp = () => {
    // TODO: Implement block moving logic
    console.log('Move block up')
    onClose()
  }

  const handleMoveDown = () => {
    // TODO: Implement block moving logic
    console.log('Move block down')
    onClose()
  }

  const handleAddBlockAbove = () => {
    const { doc } = editor.state
    let blockPos: number | null = null

    doc.descendants((node, pos) => {
      if (node.attrs.id === blockId) {
        blockPos = pos
        return false
      }
    })

    if (blockPos !== null) {
      editor
        .chain()
        .focus()
        .setTextSelection(blockPos)
        .insertContent('<p></p>')
        .run()
    }

    onClose()
  }

  const handleAddBlockBelow = () => {
    const { doc } = editor.state
    let blockPos: number | null = null
    let blockSize: number | null = null

    doc.descendants((node, pos) => {
      if (node.attrs.id === blockId) {
        blockPos = pos
        blockSize = node.nodeSize
        return false
      }
    })

    if (blockPos !== null && blockSize !== null) {
      editor
        .chain()
        .focus()
        .setTextSelection(blockPos + blockSize)
        .insertContent('<p></p>')
        .run()
    }

    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 flex flex-col bg-popover border border-border rounded-lg shadow-lg"
      style={{ left: position.x, top: position.y }}
    >
      {/* Main Menu */}
      <div className="flex items-center">
        {/* Drag Handle */}
        <button
          draggable
          onDragStart={handleDragStart}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent cursor-grab active:cursor-grabbing rounded-l-lg"
          title="Drag to move"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Add Block Above */}
        <button
          onClick={handleAddBlockAbove}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent"
          title="Add block above"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* More Actions */}
        <button
          onClick={() => setShowMore(!showMore)}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-r-lg"
          title="More actions"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded Menu */}
      {showMore && (
        <div className="border-t border-border">
          <button
            onClick={handleMoveUp}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent"
          >
            <ArrowUp className="w-3 h-3" />
            Move up
          </button>

          <button
            onClick={handleMoveDown}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent"
          >
            <ArrowDown className="w-3 h-3" />
            Move down
          </button>

          <button
            onClick={handleDuplicate}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent"
          >
            <Copy className="w-3 h-3" />
            Duplicate
          </button>

          <button
            onClick={handleAddBlockBelow}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent"
          >
            <Plus className="w-3 h-3" />
            Add block below
          </button>

          <div className="border-t border-border">
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent text-destructive"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}