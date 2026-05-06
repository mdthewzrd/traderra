// ═══════════════════════════════════════════════════════════
// TRADERRA INDICATOR VAULT
// Pine Script → JS indicator library with favorites system
// ═══════════════════════════════════════════════════════════

const VAULT_KEY = 'traderra-indicator-vault';
const FAV_KEY = 'traderra-indicator-favs';

// Get all saved indicators
function getVault() {
  try { return JSON.parse(localStorage.getItem(VAULT_KEY) || '{}'); } catch(e) { return {}; }
}

// Save indicator to vault
function saveToVault(id, indicator) {
  const vault = getVault();
  vault[id] = { ...indicator, id, savedAt: Date.now() };
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
  return vault[id];
}

// Delete indicator from vault
function deleteFromVault(id) {
  const vault = getVault();
  delete vault[id];
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

// Get/Set favorites
function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch(e) { return []; }
}

function toggleFavorite(id) {
  const favs = getFavorites();
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(id);
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  return favs;
}

function isFavorite(id) {
  return getFavorites().includes(id);
}

// ═══════════════════════════════════════════════════════════
// INDICATOR REGISTRY — all known indicators
// Each indicator has: id, name, description, params, calcFn, drawFn
// ═══════════════════════════════════════════════════════════

const INDICATOR_REGISTRY = {
  // ── Key Levels (Bjorgum) ──
  'key-levels': {
    id: 'key-levels',
    name: 'Key Levels',
    author: 'Bjorgum',
    description: 'Pivot-based supply/demand zones using HA candle bodies',
    source: 'Bjorgum Key Levels (Pine Script v5)',
    params: {
      left: { label: 'Look Left', type: 'int', default: 66, min: 5, max: 200 },
      right: { label: 'Look Right', type: 'int', default: 33, min: 5, max: 100 },
      nPiv: { label: 'Number of Pivots', type: 'int', default: 4, min: 1, max: 20 },
      atrLen: { label: 'ATR Length', type: 'int', default: 66, min: 5, max: 200 },
      mult: { label: 'Zone Width (× ATR)', type: 'float', default: 0.6, min: 0.1, max: 5.0, step: 0.1 },
      per: { label: 'Max Zone %', type: 'float', default: 1.0, min: 0.1, max: 10.0, step: 0.1 },
    },
    tags: ['zones', 'pivot', 'supply-demand'],
  },

  // ── EMA Bands (9/20 and 72/89) ──
  'ema-band-9-20': {
    id: 'ema-band-9-20',
    name: 'EMA Band 9/20',
    author: 'Traderra',
    description: 'EMA 9/20 crossover band with green/red fill',
    source: 'Custom',
    params: {
      fast: { label: 'Fast EMA', type: 'int', default: 9, min: 1, max: 200 },
      slow: { label: 'Slow EMA', type: 'int', default: 20, min: 1, max: 200 },
    },
    tags: ['ema', 'band', 'trend'],
  },
  'ema-band-72-89': {
    id: 'ema-band-72-89',
    name: 'EMA Band 72/89',
    author: 'Traderra',
    description: 'EMA 72/89 crossover band with green/red fill',
    source: 'Custom',
    params: {
      fast: { label: 'Fast EMA', type: 'int', default: 72, min: 1, max: 200 },
      slow: { label: 'Slow EMA', type: 'int', default: 89, min: 1, max: 200 },
    },
    tags: ['ema', 'band', 'trend'],
  },

  // ── Deviation Bands ──
  'dev-band-s-9-20': {
    id: 'dev-band-s-9-20',
    name: 'Dev Band Short 9/20',
    author: 'Traderra',
    description: 'ATR deviation band: upper 0.5/1, lower 2/2.4',
    source: 'Custom (Pine Script: Dual Deviation Cloud)',
    params: {
      fast: { label: 'Fast EMA', type: 'int', default: 9 },
      slow: { label: 'Slow EMA', type: 'int', default: 20 },
      up1: { label: 'Upper Dev 1', type: 'float', default: 0.5, step: 0.1 },
      up2: { label: 'Upper Dev 2', type: 'float', default: 1.0, step: 0.1 },
      dn1: { label: 'Lower Dev 1', type: 'float', default: 2.0, step: 0.1 },
      dn2: { label: 'Lower Dev 2', type: 'float', default: 2.4, step: 0.1 },
    },
    tags: ['deviation', 'atr', 'band'],
  },
  'dev-band-l-9-20': {
    id: 'dev-band-l-9-20',
    name: 'Dev Band Long 9/20',
    author: 'Traderra',
    description: 'ATR deviation band: upper 2/2.4, lower 0.5/1',
    source: 'Custom (Pine Script: Dual Deviation Cloud)',
    params: {
      fast: { label: 'Fast EMA', type: 'int', default: 9 },
      slow: { label: 'Slow EMA', type: 'int', default: 20 },
      up1: { label: 'Upper Dev 1', type: 'float', default: 2.0, step: 0.1 },
      up2: { label: 'Upper Dev 2', type: 'float', default: 2.4, step: 0.1 },
      dn1: { label: 'Lower Dev 1', type: 'float', default: 0.5, step: 0.1 },
      dn2: { label: 'Lower Dev 2', type: 'float', default: 1.0, step: 0.1 },
    },
    tags: ['deviation', 'atr', 'band'],
  },
  'dev-band-s-72-89': {
    id: 'dev-band-s-72-89',
    name: 'Dev Band Short 72/89',
    author: 'Traderra',
    description: 'ATR deviation band: both 6.9/9.6',
    source: 'Custom (Pine Script: Dual Deviation Cloud)',
    params: {
      fast: { label: 'Fast EMA', type: 'int', default: 72 },
      slow: { label: 'Slow EMA', type: 'int', default: 89 },
      up1: { label: 'Upper Dev 1', type: 'float', default: 6.9, step: 0.1 },
      up2: { label: 'Upper Dev 2', type: 'float', default: 9.6, step: 0.1 },
      dn1: { label: 'Lower Dev 1', type: 'float', default: 6.9, step: 0.1 },
      dn2: { label: 'Lower Dev 2', type: 'float', default: 9.6, step: 0.1 },
    },
    tags: ['deviation', 'atr', 'band'],
  },
  'dev-band-l-72-89': {
    id: 'dev-band-l-72-89',
    name: 'Dev Band Long 72/89',
    author: 'Traderra',
    description: 'ATR deviation band: both 6.9/9.6',
    source: 'Custom (Pine Script: Dual Deviation Cloud)',
    params: {
      fast: { label: 'Fast EMA', type: 'int', default: 72 },
      slow: { label: 'Slow EMA', type: 'int', default: 89 },
      up1: { label: 'Upper Dev 1', type: 'float', default: 6.9, step: 0.1 },
      up2: { label: 'Upper Dev 2', type: 'float', default: 9.6, step: 0.1 },
      dn1: { label: 'Lower Dev 1', type: 'float', default: 6.9, step: 0.1 },
      dn2: { label: 'Lower Dev 2', type: 'float', default: 9.6, step: 0.1 },
    },
    tags: ['deviation', 'atr', 'band'],
  },
};

// Export for use in chart
if (typeof module !== 'undefined') module.exports = { getVault, saveToVault, deleteFromVault, getFavorites, toggleFavorite, isFavorite, INDICATOR_REGISTRY };
