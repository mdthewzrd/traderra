# Tool Instance System — Implementation Plan

## Data Model

```
Panel.tools = [
  {
    id: 't1',           // unique instance ID
    indKey: 'ema_band', // points to IND_CATALOG entry (the base indicator)
    name: 'EMA Band 9/20',
    on: true,
    params: { fast:9, slow:20 },
    colors: { fill:'rgba(...)', line:'rgba(...)' }
  },
  {
    id: 't2',
    indKey: 'ema_band',
    name: 'EMA Band 15/30',
    on: true,
    params: { fast:15, slow:30 },
    colors: { fill:'rgba(...)', line:'rgba(...)' }
  }
]
```

`p.inds` stays as a boolean map for backward compat — derived from `p.tools` on load.
`pi = p.inds` inside renderPanel continues to work.

## IND_CATALOG (base indicator definitions)

Extract from IND_REGISTRY — just the parameter/color schemas and render logic:

```
IND_CATALOG = {
  ema: {
    label: 'EMA',
    group: 'MA',
    params: [{key:'period', label:'Period', def:9, min:1, max:500}],
    colors: [{key:'line', label:'Line Color', def:'#D4AF37'}],
    deps: (params) => ['ema_'+params.period],
    render: (ctx, data, tool, helpers) => { ... }
  },
  ema_band: {
    label: 'EMA Band',
    group: 'EMA Bands',
    params: [{key:'fast',...}, {key:'slow',...}],
    colors: [{key:'bull_fill',...}, {key:'bull_line',...}, {key:'bear_fill',...}, {key:'bear_line',...}],
    deps: (params) => ['ema_'+params.fast, 'ema_'+params.slow],
    render: (ctx, data, tool, helpers) => { ... }
  },
  ...
}
```

`deps()` tells the calc phase which EMAs/ATRs to pre-compute.
`render()` handles all draw calls for that tool instance.

## Rendering Flow (current → new)

### Current (hardcoded):
```
PASS 0: if(pi.band_9_20) drawEMABand(e9,e20,...)
        if(pi.band_72_89) drawEMABand(e72,e89,...)
        if(pi.dev_s_9_20) drawDevBand(...)
PASS 1: candles + volume
PASS 2: if(pi.ema9) drawLine(e9,...)
        if(pi.band_9_20) drawEMABandLines(...)
```

### New (tool loop):
```
PASS 0: for tool of p.tools: if(tool.on) CATALOG[indKey].renderPass('fill', ...)
PASS 1: candles + volume
PASS 2: for tool of p.tools: if(tool.on) CATALOG[indKey].renderPass('line', ...)
```

Each catalog entry's render function handles its own calc + draw.
EMAs/ATRs are computed once per unique period needed (deduped via `deps()`).

## Migration (backward compat)

On load, if `p.tools` is empty but `p.inds` has entries:
```js
function migrateIndsToTools(p) {
  if (p.tools && p.tools.length) return; // already migrated
  p.tools = [];
  for (let indKey in p.inds) {
    if (!p.inds[indKey]) continue;
    const reg = IND_REGISTRY[indKey];
    if (!reg || !reg.params) continue;
    p.tools.push({
      id: 't' + (++toolIdCounter),
      indKey,
      name: reg.label,
      on: true,
      params: gatherParams(indKey),
      colors: gatherColors(indKey)
    });
  }
}
```

After migration, `p.inds` is derived: `p.inds = deriveInds(p.tools)`.
This keeps all existing code that checks `pi.xxx` working.

## Settings UI Changes

`openSingleIndSettings(tool)` instead of `openSingleIndSettings(indKey)`:
- Reads params/colors from tool instance directly
- Saves back to tool instance
- "Save as Tool" button → creates new named instance
- "Reset to Default" → resets to IND_CATALOG defaults
- "Duplicate" → copies current tool with new ID

## Tool Library (localStorage)

```
traderra-tool-lib = [
  { id:'tl1', indKey:'ema_band', name:'My EMA Band', params:{...}, colors:{...} },
  ...
]
```

User can save tools to library and reuse across presets/templates.

## File Changes

1. **Add IND_CATALOG** (~12 base indicator definitions with render functions)
2. **Add tool array to panels** + migration function
3. **Refactor renderPanel** — calc dedup + tool loop for passes 0 and 2
4. **Refactor openSingleIndSettings** — tool instance based
5. **Add tool management UI** — New/Duplicate/Delete in settings
6. **Update preset/template save/load** — include tool instances
7. **Keep p.inds derived** — backward compat for all non-rendering code

## Execution Order

1. IND_CATALOG definitions (pure addition, no breakage)
2. Tool data model + migration (p.tools alongside p.inds)
3. Rendering refactor (the big one — switch from hardcoded to tool loop)
4. Settings UI refactor
5. Tool creation/duplicate UI
6. Template/preset integration
7. Deploy + visual test
