# Toolbar Hot Button System — Spec

## Overview
The toolbar row (inside the chart area, right side of topbar) shows quick-toggle buttons for chart tools. Each button corresponds to an active tool instance and toggles it on/off. Clicking opens the tool's full settings panel.

## Current State
- `hot-btns-container` div in topbar
- `tool.hot` boolean property on each tool instance
- `renderHotButtons()` builds the buttons from active tools where `hot=true`
- Right-click opens tool settings
- 🔥 emoji prepended to all buttons

## Changes Required

### 1. Strip 🔥 Emoji
- Remove fire emoji from all toolbar button labels
- Remove fire emoji from the HOT BUTTON section label in tool settings
- Just show the tool name as the button text

### 2. Toolbar Button Click Behavior
- **Left-click**: Toggle tool on/off on the chart (primary action)
- **Right-click**: Open tool settings panel (current behavior, keep it)
- Settings are also accessible via the settings button above the chart or the sidebar TOOLS panel
- The toolbar is for quick toggling, not for opening settings

### 3. Tool Settings — Hot Button Section
In `openToolSettings()`, the existing HOT BUTTON section expands:

**When hot=OFF:**
- Toggle switch labeled "SHOW IN TOOLBAR"
- Status: OFF

**When hot=ON:**
- Toggle switch labeled "SHOW IN TOOLBAR" — ON
- **Button Label** text input — custom text for the toolbar button (default: tool name, max ~12 chars)
- **Button Color** color picker — border and text color for the button

These are stored on the tool instance:
```
tool.hot = true/false
tool.hotLabel = "VWAP" (string)
tool.hotColor = "#00e676" (hex string)
```

### 4. renderHotButtons() Update
- Only show buttons for tools where `tool.on === true AND tool.hot === true`
- Button text: `tool.hotLabel || tool.name || cat.label` (uppercase, truncated to 10 chars)
- Button color: `tool.hotColor || '#D4AF37'` (default gold)
- No 🔥 emoji
- Left-click: toggle tool on/off (current behavior)
- Right-click: open tool settings

### 5. Persistence
- `tool.hot`, `tool.hotLabel`, `tool.hotColor` saved as part of tool instance in localStorage via `saveTools()`
- Already persisted — just new fields on existing tool objects

### 6. Migration
- Existing tools with `hot: true` keep it
- Set sensible defaults: `hotLabel` = tool name, `hotColor` = current border color or gold

## Files to Change
- `/home/mdwzrd/traderra/public/charts-terminal.html`
  - `renderHotButtons()` — strip emoji, use hotLabel/hotColor, only show for active+hot tools
  - `openToolSettings()` — expand HOT BUTTON section with label input + color picker
  - `setToolHot()` — when toggling on, set defaults for hotLabel/hotColor if missing
  - CSS — no changes needed, existing `.ptog` class works

## Implementation Notes
- Keep it simple — these are just 3 new properties on the tool object
- The color picker reuses the same `type="color"` pattern as tool colors
- Label is a simple text input with maxlength=12
- No reordering in v1 — buttons render in tool array order
