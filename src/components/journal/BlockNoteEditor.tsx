'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bold, Italic, List, Heading1, Heading2 } from 'lucide-react'

interface BlockNoteEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function BlockNoteEditor({ value, onChange, placeholder }: BlockNoteEditorProps) {
  const [isInitialized, setIsInitialized] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const isUpdatingFromProp = useRef(false)

  // Initialize editor content only once
  useEffect(() => {
    if (!isInitialized && editorRef.current) {
      editorRef.current.innerHTML = value || ''
      setIsInitialized(true)
    }
  }, [value, isInitialized])

  // Only update from props when the component is being reset (like when switching entries)
  useEffect(() => {
    if (isInitialized && editorRef.current && !isUpdatingFromProp.current) {
      const currentContent = editorRef.current.innerHTML
      if (currentContent !== value && value !== undefined) {
        // Save cursor position
        const selection = window.getSelection()
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null

        isUpdatingFromProp.current = true
        editorRef.current.innerHTML = value || ''

        // Restore cursor position if possible
        if (range && selection) {
          try {
            selection.removeAllRanges()
            selection.addRange(range)
          } catch (e) {
            // Ignore errors if range is no longer valid
          }
        }

        setTimeout(() => {
          isUpdatingFromProp.current = false
        }, 0)
      }
    }
  }, [value, isInitialized])

  const handleInput = useCallback(() => {
    if (editorRef.current && !isUpdatingFromProp.current) {
      const newContent = editorRef.current.innerHTML
      onChange(newContent)
    }
  }, [onChange])

  // Modern approach to text formatting using Selection API
  const applyFormat = useCallback((tag: string) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const selectedText = range.toString()

    if (selectedText) {
      // If text is selected, wrap it with the tag
      const element = document.createElement(tag)
      try {
        range.surroundContents(element)
        selection.removeAllRanges()

        // Move cursor after the formatted text
        const newRange = document.createRange()
        newRange.setStartAfter(element)
        newRange.collapse(true)
        selection.addRange(newRange)

        handleInput()
      } catch (e) {
        // Fallback for complex selections
        const formattedText = `<${tag}>${selectedText}</${tag}>`
        range.deleteContents()
        range.insertNode(document.createRange().createContextualFragment(formattedText))
        handleInput()
      }
    } else {
      // If no text selected, insert tags for user to type between
      const element = document.createElement(tag)
      element.textContent = 'Type here'
      range.insertNode(element)

      // Select the placeholder text
      const newRange = document.createRange()
      newRange.selectNodeContents(element)
      selection.removeAllRanges()
      selection.addRange(newRange)

      handleInput()
    }

    editorRef.current?.focus()
  }, [handleInput])

  const insertList = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const listHtml = `<ul><li>List item</li></ul>`
    const fragment = document.createRange().createContextualFragment(listHtml)

    range.insertNode(fragment)
    selection.removeAllRanges()

    handleInput()
    editorRef.current?.focus()
  }, [handleInput])

  const formatBold = () => applyFormat('strong')
  const formatItalic = () => applyFormat('em')
  const formatHeading1 = () => applyFormat('h1')
  const formatHeading2 = () => applyFormat('h2')
  const formatList = () => insertList()

  return (
    <div className="studio-surface rounded-lg border studio-border overflow-hidden">
      {/* Formatting Toolbar */}
      <div className="flex items-center space-x-1 p-3 border-b studio-border bg-[#0f0f0f]">
        <button
          type="button"
          onClick={formatBold}
          className="p-2 hover:bg-[#1a1a1a] rounded transition-colors group"
          title="Bold (Ctrl+B / Cmd+B)"
        >
          <Bold className="h-4 w-4 studio-muted group-hover:studio-text" />
        </button>
        <button
          type="button"
          onClick={formatItalic}
          className="p-2 hover:bg-[#1a1a1a] rounded transition-colors group"
          title="Italic (Ctrl+I / Cmd+I)"
        >
          <Italic className="h-4 w-4 studio-muted group-hover:studio-text" />
        </button>
        <div className="w-px h-6 bg-[#1a1a1a] mx-1" />
        <button
          type="button"
          onClick={formatHeading1}
          className="p-2 hover:bg-[#1a1a1a] rounded transition-colors group"
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4 studio-muted group-hover:studio-text" />
        </button>
        <button
          type="button"
          onClick={formatHeading2}
          className="p-2 hover:bg-[#1a1a1a] rounded transition-colors group"
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4 studio-muted group-hover:studio-text" />
        </button>
        <div className="w-px h-6 bg-[#1a1a1a] mx-1" />
        <button
          type="button"
          onClick={formatList}
          className="p-2 hover:bg-[#1a1a1a] rounded transition-colors group"
          title="Bullet List"
        >
          <List className="h-4 w-4 studio-muted group-hover:studio-text" />
        </button>
        <div className="flex-1" />
        <div className="text-xs studio-muted">
          Select text and click formatting buttons
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="w-full min-h-[200px] max-h-[400px] overflow-y-auto p-4 bg-transparent text-studio-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary leading-relaxed prose prose-invert max-w-none [&_p]:mb-3 [&_p]:text-gray-300 [&_strong]:text-white [&_strong]:font-bold [&_em]:text-gray-400 [&_em]:italic [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:text-gray-300 [&_li]:mb-1 [&_li]:text-gray-300 [&_h1]:text-white [&_h1]:font-bold [&_h1]:text-xl [&_h1]:mb-4 [&_h2]:text-white [&_h2]:font-semibold [&_h2]:text-lg [&_h2]:mb-3 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-500 empty:before:italic empty:before:pointer-events-none"
        style={{
          color: '#e5e5e5',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '14px',
          lineHeight: '1.6'
        }}
        onKeyDown={(e) => {
          // Keyboard shortcuts
          if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') {
              e.preventDefault()
              formatBold()
            } else if (e.key === 'i') {
              e.preventDefault()
              formatItalic()
            }
          }

          // Handle Enter key for better paragraph breaks
          if (e.key === 'Enter' && !e.shiftKey) {
            // Let default behavior handle Enter, but ensure we trigger handleInput
            setTimeout(handleInput, 0)
          }

          // Handle Backspace and Delete to ensure proper cleanup
          if (e.key === 'Backspace' || e.key === 'Delete') {
            setTimeout(handleInput, 0)
          }
        }}
        onFocus={() => {
          // Add visual focus indicator
          if (editorRef.current) {
            editorRef.current.style.borderColor = 'rgb(var(--primary))'
          }
        }}
        onBlur={() => {
          // Remove focus indicator
          if (editorRef.current) {
            editorRef.current.style.borderColor = ''
          }
        }}
        suppressContentEditableWarning={true}
        data-placeholder={placeholder || "Start writing your journal entry..."}
      />

      <div className="p-2 text-xs studio-muted border-t studio-border bg-[#0a0a0a]">
        ✨ <strong>Tip:</strong> Select text and click formatting buttons, or use Ctrl+B/Ctrl+I (Windows) or Cmd+B/Cmd+I (Mac) shortcuts
      </div>
    </div>
  )
}