'use client'

import React, { useEffect, useState } from 'react'
import { Editor } from '@tiptap/react'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

interface DragDropHandlerProps {
  editor: Editor
}

export function DragDropHandler({ editor }: DragDropHandlerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragPreview, setDragPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!editor) return

    // Add drag and drop plugin
    const dragDropPlugin = new Plugin({
      key: new PluginKey('dragDrop'),
      props: {
        handleDOMEvents: {
          dragstart: (view, event) => {
            const target = event.target as HTMLElement
            const blockElement = target.closest('[data-block-id]')

            if (blockElement) {
              const blockId = blockElement.getAttribute('data-block-id')
              if (blockId) {
                setIsDragging(true)
                setDragPreview(blockId)

                // Set drag data
                event.dataTransfer?.setData('text/plain', blockId)
                event.dataTransfer?.setData('application/block-id', blockId)

                // Create custom drag image
                const dragImage = createDragImage(blockElement)
                event.dataTransfer?.setDragImage(dragImage, 0, 0)

                return true
              }
            }
            return false
          },

          dragend: () => {
            setIsDragging(false)
            setDragPreview(null)
            return false
          },

          dragover: (view, event) => {
            if (isDragging) {
              event.preventDefault()
              return true
            }
            return false
          },

          drop: (view, event) => {
            if (!isDragging) return false

            event.preventDefault()

            const blockId = event.dataTransfer?.getData('application/block-id')
            if (!blockId) return false

            const dropPosition = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            })

            if (dropPosition) {
              moveBlock(view, blockId, dropPosition.pos)
            }

            setIsDragging(false)
            setDragPreview(null)
            return true
          },
        },
      },

      state: {
        init() {
          return DecorationSet.empty
        },

        apply(tr, set) {
          // Update decorations to show drop zones
          if (isDragging) {
            const decorations: Decoration[] = []

            tr.doc.descendants((node, pos) => {
              // Add drop zone decorations between blocks
              if (node.type.name === 'paragraph' ||
                  node.type.name === 'tradeEntry' ||
                  node.type.name === 'strategyTemplate' ||
                  node.type.name === 'performanceSummary') {

                const decoration = Decoration.widget(pos, () => {
                  const dropZone = document.createElement('div')
                  dropZone.className = 'drop-zone opacity-0 hover:opacity-100 transition-opacity h-1 bg-primary rounded-full my-1'
                  return dropZone
                })

                decorations.push(decoration)
              }
            })

            return DecorationSet.create(tr.doc, decorations)
          }

          return set.map(tr.mapping, tr.doc)
        },
      },
    })

    // Add the plugin to the editor
    editor.registerPlugin(dragDropPlugin)

    return () => {
      editor.unregisterPlugin(dragDropPlugin.key)
    }
  }, [editor, isDragging])

  const moveBlock = (view: any, blockId: string, targetPos: number) => {
    const { doc, tr } = view.state
    let sourcePos: number | null = null
    let sourceNode: any = null
    let sourceSize: number = 0

    // Find the source block
    doc.descendants((node: any, pos: number) => {
      if (node.attrs.id === blockId) {
        sourcePos = pos
        sourceNode = node
        sourceSize = node.nodeSize
        return false
      }
    })

    if (sourcePos === null || !sourceNode) return

    // Remove the source block
    const deleteTransaction = tr.delete(sourcePos, sourcePos + sourceSize)

    // Adjust target position if it's after the deleted block
    let adjustedTargetPos = targetPos
    if (targetPos > sourcePos) {
      adjustedTargetPos = targetPos - sourceSize
    }

    // Insert the block at the new position
    const insertTransaction = deleteTransaction.insert(adjustedTargetPos, sourceNode)

    view.dispatch(insertTransaction)
  }

  const createDragImage = (element: Element): HTMLElement => {
    const dragImage = element.cloneNode(true) as HTMLElement
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-1000px'
    dragImage.style.left = '-1000px'
    dragImage.style.width = `${element.clientWidth}px`
    dragImage.style.opacity = '0.8'
    dragImage.style.transform = 'rotate(2deg)'
    dragImage.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
    dragImage.style.borderRadius = '8px'
    dragImage.style.backgroundColor = 'var(--background)'
    dragImage.style.border = '2px solid var(--primary)'

    document.body.appendChild(dragImage)

    // Remove the drag image after a delay
    setTimeout(() => {
      document.body.removeChild(dragImage)
    }, 1000)

    return dragImage
  }

  // Add global styles for drag and drop
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .block-node[draggable="true"] {
        cursor: grab;
      }

      .block-node[draggable="true"]:active {
        cursor: grabbing;
      }

      .block-node.dragging {
        opacity: 0.5;
        transform: rotate(2deg);
      }

      .drop-zone {
        transition: all 0.2s ease;
        margin: 4px 0;
      }

      .drop-zone.active {
        opacity: 1 !important;
        background-color: hsl(var(--primary));
        height: 4px;
      }

      .drag-preview {
        position: fixed;
        pointer-events: none;
        z-index: 1000;
        opacity: 0.8;
        transform: rotate(2deg);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        background-color: var(--background);
        border: 2px solid var(--primary);
      }
    `

    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return null // This component doesn't render anything visible
}