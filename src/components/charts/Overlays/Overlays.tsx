'use client'

/**
 * Overlays — fullscreen backdrop, draw hint, toast.
 * 
 * NOTE: Modal overlays (#modal-overlay, #modal-box, #scan-add-modal, #pct-popup, 
 * #text-popup, #ind-settings-popup, #ind-btn-popup, #col-settings-popup) are now 
 * included in the Sidebar's SIDEBAR_TABS_HTML blob for charts-engine.js interop.
 * They need to be siblings of the sidebar content divs in the DOM.
 */

export function Overlays() {
  return (
    <>
      <div id="fs-backdrop" />
      <div id="draw-hint" />
      <div id="toast" />
    </>
  )
}
