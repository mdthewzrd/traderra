'use client'

import { ContextMenu } from './ContextMenu'

/**
 * Overlays — fullscreen backdrop, draw hint, toast, context menu.
 */

export function Overlays() {
  return (
    <>
      <div id="fs-backdrop" />
      <div id="draw-hint" />
      <div id="toast" />
      <ContextMenu />
    </>
  )
}
