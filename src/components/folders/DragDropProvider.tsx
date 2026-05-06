'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

// Types for drag and drop operations
export interface DragData {
  type: 'folder' | 'content'
  id: string
  name: string
  parentId?: string
  originalIndex?: number
}

export interface DropTarget {
  type: 'folder' | 'between' | 'root'
  id?: string
  parentId?: string
  position?: number
}

export interface DragDropState {
  isDragging: boolean
  dragData: DragData | null
  dropTarget: DropTarget | null
  dragPreview: React.ReactNode | null
}

interface DragDropContextValue {
  state: DragDropState
  startDrag: (data: DragData, preview?: React.ReactNode) => void
  updateDropTarget: (target: DropTarget | null) => void
  endDrag: () => void
  onDrop?: (dragData: DragData, dropTarget: DropTarget) => void
}

const DragDropContext = createContext<DragDropContextValue | null>(null)

export function useDragDrop() {
  const context = useContext(DragDropContext)
  if (!context) {
    throw new Error('useDragDrop must be used within a DragDropProvider')
  }
  return context
}

interface DragDropProviderProps {
  children: React.ReactNode
  onDrop?: (dragData: DragData, dropTarget: DropTarget) => void
}

export function DragDropProvider({ children, onDrop }: DragDropProviderProps) {
  const [state, setState] = useState<DragDropState>({
    isDragging: false,
    dragData: null,
    dropTarget: null,
    dragPreview: null
  })

  const dragPreviewRef = useRef<HTMLDivElement>(null)
  const mousePosition = useRef({ x: 0, y: 0 })

  const startDrag = useCallback((data: DragData, preview?: React.ReactNode) => {
    setState(prev => ({
      ...prev,
      isDragging: true,
      dragData: data,
      dragPreview: preview || null
    }))

    // Track mouse movement for drag preview
    const handleMouseMove = (e: MouseEvent) => {
      mousePosition.current = { x: e.clientX, y: e.clientY }

      if (dragPreviewRef.current) {
        dragPreviewRef.current.style.left = `${e.clientX + 10}px`
        dragPreviewRef.current.style.top = `${e.clientY + 10}px`
      }
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  const updateDropTarget = useCallback((target: DropTarget | null) => {
    setState(prev => ({
      ...prev,
      dropTarget: target
    }))
  }, [])

  const endDrag = useCallback(() => {
    const { dragData, dropTarget } = state

    if (dragData && dropTarget && onDrop) {
      onDrop(dragData, dropTarget)
    }

    setState({
      isDragging: false,
      dragData: null,
      dropTarget: null,
      dragPreview: null
    })
  }, [state, onDrop])

  return (
    <DragDropContext.Provider
      value={{
        state,
        startDrag,
        updateDropTarget,
        endDrag,
        onDrop
      }}
    >
      {children}

      {/* Drag Preview */}
      {state.isDragging && state.dragPreview && (
        <div
          ref={dragPreviewRef}
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: mousePosition.current.x + 10,
            top: mousePosition.current.y + 10
          }}
        >
          <div className="bg-[#1a1a1a] border studio-border rounded-lg p-2 shadow-xl opacity-90">
            {state.dragPreview}
          </div>
        </div>
      )}
    </DragDropContext.Provider>
  )
}

// Hook for making elements draggable
export function useDraggable(data: DragData, preview?: React.ReactNode) {
  const { startDrag } = useDragDrop()

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left mouse button

    const startX = e.clientX
    const startY = e.clientY
    let hasMoved = false

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = Math.abs(e.clientX - startX)
      const deltaY = Math.abs(e.clientY - startY)

      if (deltaX > 5 || deltaY > 5) {
        if (!hasMoved) {
          hasMoved = true
          startDrag(data, preview)
        }
      }
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [data, preview, startDrag])

  return {
    draggableProps: {
      onMouseDown: handleMouseDown,
      draggable: false, // We handle dragging manually
      style: { cursor: 'grab' }
    }
  }
}

// Hook for making elements droppable
export function useDroppable(target: DropTarget, canDrop?: (dragData: DragData) => boolean) {
  const { state, updateDropTarget, endDrag } = useDragDrop()
  const [isOver, setIsOver] = useState(false)

  const isValidDrop = useCallback((dragData: DragData | null) => {
    if (!dragData || !canDrop) return true
    return canDrop(dragData)
  }, [canDrop])

  const handleMouseEnter = useCallback(() => {
    if (state.isDragging && isValidDrop(state.dragData)) {
      setIsOver(true)
      updateDropTarget(target)
    }
  }, [state.isDragging, state.dragData, isValidDrop, target, updateDropTarget])

  const handleMouseLeave = useCallback(() => {
    setIsOver(false)
    updateDropTarget(null)
  }, [updateDropTarget])

  const handleMouseUp = useCallback(() => {
    if (state.isDragging && isOver && isValidDrop(state.dragData)) {
      endDrag()
    }
    setIsOver(false)
  }, [state.isDragging, isOver, state.dragData, isValidDrop, endDrag])

  const isDropTarget = state.dropTarget?.id === target.id && state.dropTarget?.type === target.type

  return {
    droppableProps: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onMouseUp: handleMouseUp
    },
    isOver: isOver && state.isDragging,
    isDropTarget,
    canDrop: isValidDrop(state.dragData)
  }
}

// Component for rendering drop zones between items
interface DropZoneProps {
  target: DropTarget
  orientation?: 'horizontal' | 'vertical'
  className?: string
  canDrop?: (dragData: DragData) => boolean
}

export function DropZone({
  target,
  orientation = 'horizontal',
  className,
  canDrop
}: DropZoneProps) {
  const { droppableProps, isOver, canDrop: isValidDrop } = useDroppable(target, canDrop)

  if (!isValidDrop) return null

  return (
    <div
      {...droppableProps}
      className={cn(
        'transition-all duration-200',
        orientation === 'horizontal' ? 'h-0.5 mx-2' : 'w-0.5 my-2',
        isOver && 'bg-primary',
        !isOver && 'bg-transparent hover:bg-primary/30',
        className
      )}
    />
  )
}

// Utility functions for drag and drop operations
export const dragDropUtils = {
  // Check if a folder can be dropped into another folder
  canDropFolderInFolder: (dragData: DragData, targetFolderId: string): boolean => {
    if (dragData.type !== 'folder') return false
    if (dragData.id === targetFolderId) return false
    // TODO: Add check for circular reference (folder being dropped into its own descendant)
    return true
  },

  // Check if content can be dropped into a folder
  canDropContentInFolder: (dragData: DragData, targetFolderId: string): boolean => {
    return dragData.type === 'content'
  },

  // Calculate drop position based on mouse coordinates
  getDropPosition: (element: HTMLElement, mouseY: number): 'before' | 'after' | 'inside' => {
    const rect = element.getBoundingClientRect()
    const relativeY = mouseY - rect.top
    const third = rect.height / 3

    if (relativeY < third) return 'before'
    if (relativeY > third * 2) return 'after'
    return 'inside'
  },

  // Generate drag preview for different item types
  createDragPreview: (type: 'folder' | 'content', name: string, icon?: React.ReactNode) => {
    return (
      <div className="flex items-center space-x-2 text-sm studio-text">
        {icon}
        <span className="truncate max-w-[200px]">{name}</span>
        <span className="text-xs studio-muted">
          {type === 'folder' ? 'Folder' : 'Item'}
        </span>
      </div>
    )
  }
}

// Higher-order component for adding drag and drop to folder tree items
export function withDragDrop<T extends object>(
  Component: React.ComponentType<T>
): React.ComponentType<T & { dragData?: DragData; dropTarget?: DropTarget }> {
  return function DragDropWrapper(props: T & { dragData?: DragData; dropTarget?: DropTarget }) {
    const { dragData, dropTarget, ...componentProps } = props
    const { state } = useDragDrop()

    const draggableHook = useDraggable(
      dragData || { type: 'folder', id: '', name: '' }
    )

    const droppableHook = useDroppable(
      dropTarget || { type: 'folder' }
    )

    return (
      <div
        {...(dragData ? draggableHook.draggableProps : {})}
        {...(dropTarget ? droppableHook.droppableProps : {})}
        className={cn(
          dragData && state.isDragging && state.dragData?.id === dragData.id && 'opacity-50',
          dropTarget && droppableHook.isOver && 'bg-primary/10 border-primary/50'
        )}
      >
        <Component {...(componentProps as T)} />
      </div>
    )
  }
}