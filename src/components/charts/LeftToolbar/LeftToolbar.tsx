'use client'

/**
 * LeftToolbar — the vertical drawing tools toolbar on the left side.
 * Extracted from charts-terminal.html lines 739-851.
 * Tool categories with flyout menus: Trend, Fib/Gann, Shapes, Annotations, Trade, Measure.
 */

export function LeftToolbar() {
  return (
    <div id="left-toolbar">
      {/* Cursor */}
      <button className="lt-btn active" data-tool="" onClick={() => { (window as any).setActiveTool?.(null); (window as any).ltCloseAll?.() }} title="Cursor">
        <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 1l10 7-5 1-2 5z" fill="currentColor" /></svg>
      </button>
      <div className="lt-sep" />

      {/* Trend Lines */}
      <button className="lt-cat" data-cat="trend" onMouseDown={() => (window as any).ltToggle?.('trend')} title="Trend Lines">
        <svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" /></svg>
        <span className="cat-arrow">▸</span>
      </button>
      <div className="lt-flyout" id="fo-trend">
        <div className="lt-fo-label">Trend Lines</div>
        <FlyoutItem tool="trendline" label="Trend Line" svg={<svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" /></svg>} />
        <FlyoutItem tool="hline" label="Horizontal Line" svg={<svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" /></svg>} />
        <FlyoutItem tool="vline" label="Vertical Line" svg={<svg width="16" height="16" viewBox="0 0 16 16"><line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5" /></svg>} />
        <FlyoutItem tool="ray" label="Ray" svg={<svg width="16" height="16" viewBox="0 0 16 16"><line x1="1" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" /><line x1="14" y1="2" x2="16" y2="0" stroke="currentColor" strokeWidth="1" /></svg>} />
        <FlyoutItem tool="hray" label="Horizontal Ray" svg={<svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" /><polygon points="14,6 16,8 14,10" fill="currentColor" /></svg>} />
        <FlyoutItem tool="xline" label="Cross Line" svg={<svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1" /><line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1" /></svg>} />
        <div className="lt-fo-sep" />
        <FlyoutItem tool="parallel" label="Parallel Channel" svg={<svg width="16" height="16" viewBox="0 0 16 16"><line x1="3" y1="14" x2="13" y2="3" stroke="currentColor" strokeWidth="1.2" /><line x1="6" y1="14" x2="16" y2="3" stroke="currentColor" strokeWidth="1.2" /></svg>} />
        <FlyoutItem tool="disjoint" label="Disjoint Channel" svg={<svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="14" x2="10" y2="3" stroke="currentColor" strokeWidth="1.2" /><line x1="6" y1="14" x2="14" y2="3" stroke="currentColor" strokeWidth="1.2" /></svg>} />
      </div>

      {/* Fibonacci & Gann */}
      <button className="lt-cat" data-cat="fib" onMouseDown={() => (window as any).ltToggle?.('fib')} title="Fibonacci & Gann">
        <svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1" /><line x1="2" y1="2" x2="8" y2="2" stroke="currentColor" strokeWidth="1" strokeDasharray="1,1" /><line x1="5" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1" strokeDasharray="1,1" /><line x1="8" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1" strokeDasharray="1,1" /></svg>
        <span className="cat-arrow">▸</span>
      </button>
      <div className="lt-flyout" id="fo-fib">
        <div className="lt-fo-label">Fibonacci</div>
        <FlyoutItem tool="fib_ret" label="Fib Retracement" color="#a78bfa" svg={<svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1" /><line x1="2" y1="2" x2="8" y2="2" stroke="currentColor" strokeWidth="1" strokeDasharray="1,1" /><line x1="5" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1" strokeDasharray="1,1" /></svg>} />
        <div className="lt-fo-sep" />
        <div className="lt-fo-label">Gann</div>
        <FlyoutItem tool="gann_box" label="Gann Box" color="#f59e0b" svg={<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1" /><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth=".5" strokeDasharray="1,1" /><line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth=".5" strokeDasharray="1,1" /></svg>} />
      </div>

      {/* Shapes */}
      <button className="lt-cat" data-cat="shape" onMouseDown={() => (window as any).ltToggle?.('shape')} title="Geometric Shapes">
        <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
        <span className="cat-arrow">▸</span>
      </button>
      <div className="lt-flyout" id="fo-shape">
        <div className="lt-fo-label">Shapes</div>
        <FlyoutItem tool="box_orange" label="Rectangle" color="#f97316" svg={<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>} />
        <FlyoutItem tool="circle" label="Circle" color="#f97316" svg={<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>} />
        <FlyoutItem tool="ellipse" label="Ellipse" color="#f97316" svg={<svg width="16" height="16" viewBox="0 0 16 16"><ellipse cx="8" cy="8" rx="7" ry="4" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>} />
        <FlyoutItem tool="triangle" label="Triangle" color="#f97316" svg={<svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,2 14,14 2,14" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>} />
        <FlyoutItem tool="path" label="Polyline" color="#f97316" svg={<svg width="16" height="16" viewBox="0 0 16 16"><polyline points="2,12 5,4 10,10 14,3" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>} />
        <div className="lt-fo-sep" />
        <div className="lt-fo-label">Brush</div>
        <FlyoutItem tool="hl_cyan" label="Highlight" color="#22d3ee" svg={<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="4" width="12" height="8" fill="currentColor" opacity={0.3} stroke="currentColor" strokeWidth="0.5" /></svg>} />
        <FlyoutItem tool="brush" label="Brush" color="#94a3b8" svg={<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 14Q4 10 8 6Q12 2 14 2Q14 4 10 8Q6 12 2 14Z" fill="none" stroke="currentColor" strokeWidth="1" /></svg>} />
      </div>

      {/* Annotations */}
      <button className="lt-cat" data-cat="annot" onMouseDown={() => (window as any).ltToggle?.('annot')} title="Annotations">
        <svg width="16" height="16" viewBox="0 0 16 16"><text x="3" y="13" fontSize="13" fontWeight="bold" fill="currentColor">A</text></svg>
        <span className="cat-arrow">▸</span>
      </button>
      <div className="lt-flyout" id="fo-annot">
        <div className="lt-fo-label">Text & Notes</div>
        <FlyoutItem tool="text_orange" label="Text" color="#f97316" svg={<svg width="16" height="16" viewBox="0 0 16 16"><text x="3" y="13" fontSize="13" fontWeight="bold" fill="currentColor">T</text></svg>} />
        <FlyoutItem tool="callout" label="Callout" color="#f97316" svg={<svg width="16" height="16" viewBox="0 0 16 16"><rect x="1" y="1" width="12" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1" /><polygon points="5,10 7,14 9,10" fill="currentColor" /></svg>} />
        <FlyoutItem tool="note" label="Note" color="#fbbf24" svg={<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="1" width="12" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1" /><line x1="5" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1" /><line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1" /></svg>} />
        <FlyoutItem tool="price_label" label="Price Label" color="#26a69a" svg={<svg width="16" height="16" viewBox="0 0 16 16"><rect x="1" y="6" width="14" height="4" rx="2" fill="none" stroke="currentColor" strokeWidth="1" /></svg>} />
        <FlyoutItem tool="flag" label="Flag" color="#ef5350" svg={<svg width="16" height="16" viewBox="0 0 16 16"><line x1="4" y1="2" x2="4" y2="14" stroke="currentColor" strokeWidth="1.2" /><polygon points="4,2 14,4 4,7" fill="currentColor" /></svg>} />
      </div>

      {/* Trade / Position */}
      <button className="lt-cat" data-cat="trade" onMouseDown={() => (window as any).ltToggle?.('trade')} title="Trade Positions">
        <svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 13,7 10,7 10,15 6,15 6,7 3,7" fill="currentColor" /></svg>
        <span className="cat-arrow">▸</span>
      </button>
      <div className="lt-flyout" id="fo-trade">
        <div className="lt-fo-label">Entries & Exits</div>
        <FlyoutItem tool="entry_arrow" label="Long Entry" color="#ff9800" svg={<svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 13,7 10,7 10,15 6,15 6,7 3,7" fill="currentColor" /></svg>} />
        <FlyoutItem tool="exit_arrow" label="Long Exit" color="#40c4ff" svg={<svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,15 13,9 10,9 10,1 6,1 6,9 3,9" fill="currentColor" /></svg>} />
        <FlyoutItem tool="short_arrow" label="Short Entry" color="#ff5252" svg={<svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,15 13,9 10,9 10,1 6,1 6,9 3,9" fill="currentColor" /></svg>} />
        <FlyoutItem tool="cover_arrow" label="Cover" color="#00e676" svg={<svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 13,7 10,7 10,15 6,15 6,7 3,7" fill="currentColor" /></svg>} />
        <div className="lt-fo-sep" />
        <div className="lt-fo-label">Stops</div>
        <FlyoutItem tool="stop_line" label="Stop Loss" color="#facc15" svg={<svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3,2" /></svg>} />
        <FlyoutItem tool="trail_stop" label="Trail Stop" color="#38bdf8" svg={<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 12 L5 8 L8 10 L12 4 L14 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2,1" /></svg>} />
        <div className="lt-fo-sep" />
        <div className="lt-fo-label">Position</div>
        <FlyoutItem tool="long_pos" label="Long Position" color="#26a69a" svg={<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="rgba(38,166,154,.15)" stroke="#26a69a" strokeWidth="1" /><line x1="2" y1="12" x2="14" y2="5" stroke="#26a69a" strokeWidth="1" /></svg>} />
        <FlyoutItem tool="short_pos" label="Short Position" color="#ef5350" svg={<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="rgba(239,83,80,.15)" stroke="#ef5350" strokeWidth="1" /><line x1="2" y1="5" x2="14" y2="12" stroke="#ef5350" strokeWidth="1" /></svg>} />
        <FlyoutItem tool="forecast" label="Forecast" color="#7b61ff" svg={<svg width="16" height="16" viewBox="0 0 16 16"><polyline points="2,12 6,8 10,10 14,3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3,2" /></svg>} />
      </div>

      {/* Measure */}
      <button className="lt-cat" data-cat="measure" onMouseDown={() => (window as any).ltToggle?.('measure')} title="Measure & Zoom">
        <svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1" strokeDasharray="2,1" /><circle cx="2" cy="2" r="1.5" fill="currentColor" /><circle cx="14" cy="14" r="1.5" fill="currentColor" /></svg>
        <span className="cat-arrow">▸</span>
      </button>
      <div className="lt-flyout" id="fo-measure">
        <FlyoutItem tool="measure" label="Measure" svg={<svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1" strokeDasharray="2,1" /><circle cx="2" cy="2" r="1.5" fill="currentColor" /><circle cx="14" cy="14" r="1.5" fill="currentColor" /></svg>} />
        <FlyoutItem tool="zoom_in" label="Zoom In" svg={<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" /><line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" /><line x1="5" y1="7" x2="9" y2="7" stroke="currentColor" strokeWidth="1.2" /><line x1="7" y1="5" x2="7" y2="9" stroke="currentColor" strokeWidth="1.2" /></svg>} />
      </div>

      {/* Edit / Delete */}
      <div className="lt-sep" />
      <button className="lt-btn tool-btn" data-tool="edit" title="Edit" style={{ color: '#fbbf24' }}>
        <svg width="16" height="16" viewBox="0 0 16 16"><path d="M12 1l3 3-9 9H3v-3z" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
      </button>
      <button className="lt-btn tool-btn" data-tool="del" title="Delete" style={{ color: '#ff3d57' }}>
        <svg width="16" height="16" viewBox="0 0 16 16"><line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" /><line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>

      {/* Bottom actions */}
      <div className="lt-bottom">
        <button className="lt-btn" id="magnet-btn" title="Magnet Snap" onClick={(e) => { e.currentTarget.classList.toggle('active'); (window as any)._magnetSnap = e.currentTarget.classList.contains('active') }}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 7a4 4 0 018 0v4h-2V7a2 2 0 00-4 0v4H4z" fill="none" stroke="currentColor" strokeWidth="1.2" /><rect x="3" y="1" width="3" height="3" fill="#ff3d57" rx="0.5" /><rect x="10" y="1" width="3" height="3" fill="#3d85ff" rx="0.5" /></svg>
        </button>
        <button className="lt-btn" id="stay-draw-btn" title="Stay in Drawing Mode" onClick={(e) => { e.currentTarget.classList.toggle('active-bottom'); (window as any)._stayDraw = e.currentTarget.classList.contains('active-bottom') }}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1" /><circle cx="8" cy="8" r="3" fill="none" stroke="#D4AF37" strokeWidth="1" /></svg>
        </button>
        <button className="lt-btn" id="lock-all-btn" title="Lock All Drawings" onClick={(e) => { e.currentTarget.classList.toggle('active-bottom'); (window as any)._lockAll = e.currentTarget.classList.contains('active-bottom') }}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 7V5a4 4 0 018 0v2" fill="none" stroke="currentColor" strokeWidth="1.2" /><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
        </button>
        <button className="lt-btn" id="hide-all-btn" title="Hide All Drawings" onClick={(e) => { e.currentTarget.classList.toggle('active-bottom'); (window as any)._hideAll = e.currentTarget.classList.contains('active-bottom'); (window as any).renderAll?.() }}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" fill="none" stroke="currentColor" strokeWidth="1.2" /><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>
      </div>
    </div>
  )
}

function FlyoutItem({ tool, label, color, svg }: { tool: string; label: string; color?: string; svg: React.ReactNode }) {
  return (
    <div
      className="lt-fo-item"
      data-tool={tool}
      style={color ? { color } : undefined}
      onMouseDown={() => (window as any).ltPick?.(document.querySelector(`[data-tool="${tool}"].lt-fo-item`))}
    >
      {svg}
      {label}
    </div>
  )
}
