'use client'

import { Node, mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

// Base Block Node that all custom blocks extend from
export interface BlockAttributes {
  id?: string
  type: string
  data?: any
  metadata?: {
    createdAt?: string
    updatedAt?: string
    author?: string
    tags?: string[]
  }
}

export const BlockNode = Node.create({
  name: 'blockNode',

  addOptions() {
    return {
      HTMLAttributes: {},
      blockType: 'generic',
    }
  },

  group: 'block',

  content: 'block*',

  isolating: true,

  defining: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-block-id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {}
          }
          return {
            'data-block-id': attributes.id,
          }
        },
      },
      type: {
        default: this.options.blockType,
        parseHTML: element => element.getAttribute('data-block-type'),
        renderHTML: attributes => ({
          'data-block-type': attributes.type,
        }),
      },
      data: {
        default: {},
        parseHTML: element => {
          const data = element.getAttribute('data-block-data')
          return data ? JSON.parse(data) : {}
        },
        renderHTML: attributes => {
          if (!attributes.data || Object.keys(attributes.data).length === 0) {
            return {}
          }
          return {
            'data-block-data': JSON.stringify(attributes.data),
          }
        },
      },
      metadata: {
        default: {},
        parseHTML: element => {
          const metadata = element.getAttribute('data-block-metadata')
          return metadata ? JSON.parse(metadata) : {}
        },
        renderHTML: attributes => {
          if (!attributes.metadata || Object.keys(attributes.metadata).length === 0) {
            return {}
          }
          return {
            'data-block-metadata': JSON.stringify(attributes.metadata),
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: `div[data-block-type="${this.options.blockType}"]`,
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `block-node block-${this.options.blockType}`,
        'data-drag-handle': '',
      }),
      0,
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blockNodeDecorations'),
        props: {
          decorations: (state) => {
            const { doc, selection } = state
            const decorations: Decoration[] = []

            doc.descendants((node, pos) => {
              if (node.type.name === this.name) {
                // Add hover decorations for block manipulation
                const decoration = Decoration.widget(pos, () => {
                  const element = document.createElement('div')
                  element.className = 'block-controls'
                  element.innerHTML = `
                    <div class="block-drag-handle opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg width="12" height="12" viewBox="0 0 12 12">
                        <circle cx="3" cy="3" r="1" fill="currentColor"/>
                        <circle cx="9" cy="3" r="1" fill="currentColor"/>
                        <circle cx="3" cy="9" r="1" fill="currentColor"/>
                        <circle cx="9" cy="9" r="1" fill="currentColor"/>
                      </svg>
                    </div>
                  `
                  return element
                }, {
                  side: -1,
                })
                decorations.push(decoration)
              }
            })

            return DecorationSet.create(doc, decorations)
          },
        },
      }),
    ]
  },

  addCommands() {
    return {
      insertBlock: (attributes: BlockAttributes) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: {
            id: attributes.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: attributes.type,
            data: attributes.data || {},
            metadata: {
              ...attributes.metadata,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        })
      },
      updateBlock: (id: string, data: any) => ({ state, commands }) => {
        const { doc } = state
        let blockPos: number | null = null

        doc.descendants((node, pos) => {
          if (node.type.name === this.name && node.attrs.id === id) {
            blockPos = pos
            return false
          }
        })

        if (blockPos !== null) {
          return commands.setNodeMarkup(blockPos, undefined, {
            ...doc.nodeAt(blockPos)?.attrs,
            data: { ...doc.nodeAt(blockPos)?.attrs.data, ...data },
            metadata: {
              ...doc.nodeAt(blockPos)?.attrs.metadata,
              updatedAt: new Date().toISOString(),
            },
          })
        }

        return false
      },
      deleteBlock: (id: string) => ({ state, commands }) => {
        const { doc } = state
        let blockPos: number | null = null
        let blockSize: number | null = null

        doc.descendants((node, pos) => {
          if (node.type.name === this.name && node.attrs.id === id) {
            blockPos = pos
            blockSize = node.nodeSize
            return false
          }
        })

        if (blockPos !== null && blockSize !== null) {
          return commands.deleteRange({
            from: blockPos,
            to: blockPos + blockSize,
          })
        }

        return false
      },
    }
  },
})

// Utility function to generate unique block IDs
export function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Types for block system
export interface BlockData {
  id: string
  type: string
  content: any
  metadata: {
    createdAt: string
    updatedAt: string
    author?: string
    tags?: string[]
  }
}

export interface BlockRegistration {
  type: string
  name: string
  icon: React.ComponentType<any>
  description: string
  category: 'basic' | 'media' | 'trading' | 'advanced'
  defaultData: any
  component: React.ComponentType<any>
}