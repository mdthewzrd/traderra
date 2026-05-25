// Init ScanManager on page load
ScanManager.init();
// Select the built-in scan by default
ScanManager.select('builtin-idl');

// ── Column settings panel ──
const COL_SETTINGS_KEY = 'traderra-scan-cols';
function getScanColPrefs() {
  try { return JSON.parse(localStorage.getItem(COL_SETTINGS_KEY)) || {}; } catch { return {}; }
}
function saveScanColPrefs(prefs) {
  localStorage.setItem(COL_SETTINGS_KEY, JSON.stringify(prefs));
}
function getHiddenCols(scanName) {
  const prefs = getScanColPrefs();
  return new Set(prefs[scanName] || []);
}
function toggleCol(scanName, col, hide) {
  const prefs = getScanColPrefs();
  const hidden = new Set(prefs[scanName] || []);
  if (hide) hidden.add(col); else hidden.delete(col);
  prefs[scanName] = [...hidden];
  saveScanColPrefs(prefs);
}

document.getElementById('scan-col-cog').addEventListener('click', () => {
  const scan = ScanManager.getActive();
  if (!scan) return;
  const results = scan.results || [];
  if (!results.length) return;

  // Collect all columns
  const priorityKeys = ['ticker', 'date', 'c', 'o', 'h', 'l', 'v', 'pct_change', 'pct_chg', 'changePct',
    'gap_20', 'gap_30', 'gap_50', 'gap_100', 'gap_pct', 'gap_atr', 'gap_cont_30',
    'range', 'close_range', 'atr', 'rvol', 'dol_v'];
  const colLabels = {
    ticker: 'Ticker', date: 'D0', d1Date: 'D1', restDate: 'D0', c: 'Close', o: 'Open', h: 'High', l: 'Low', v: 'Vol',
    pct_change: 'Chg%', pct_chg: 'Chg%', changePct: 'Chg%',
    gap_20: 'Gap$20', gap_30: 'Gap$30', gap_50: 'Gap$50', gap_100: 'Gap$100',
    gap_pct: 'Gap%', gap_atr: 'GapATR', gap_cont_30: 'GapC30',
    range: 'Range$', close_range: 'CloseRng', atr: 'ATR', rvol: 'RVol', dol_v: '$Vol',
    triggerPrice: 'Trigger', d1DolVol: 'D1$Vol', d1ExtPct: 'D1Ext%', retracePct: 'Retrace%',
    idVolRatio: 'IDVolR', ssrPossible: 'SSR', isStrictInside: 'Inside',
  };
  const skipCols = new Set(['filterTag', 'v_ua', 'o_ua', 'c_ua', 'h_ua', 'l_ua', '_cacheId']);
  const seen = new Set();
  const allCols = [];
  for (const k of priorityKeys) { if (results.some(r => r[k] != null) && !skipCols.has(k)) { allCols.push(k); seen.add(k); } }
  for (const r of results) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k) && !skipCols.has(k) && r[k] != null && typeof r[k] !== 'object') { allCols.push(k); seen.add(k); }
    }
  }

  const hidden = getHiddenCols(scan.name);

  // Build popup HTML
  let popHtml = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;background:rgba(0,0,0,.5);" id="col-settings-overlay"></div>';
  popHtml += '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1001;background:#141926;border:1px solid #2a3050;border-radius:8px;padding:16px 18px;min-width:320px;max-width:460px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.6);" id="col-settings-popup">';
  popHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><span style="color:#dde3f0;font-weight:800;font-size:14px;">⚙ Column Settings</span><button id="col-settings-close" style="background:none;border:none;color:#5a7090;font-size:18px;cursor:pointer;">×</button></div>';
  popHtml += '<div style="display:flex;gap:6px;margin-bottom:10px;"><button id="col-sel-all" style="background:none;border:1px solid #3a4a68;color:#8aa0c0;font-size:11px;font-weight:700;padding:3px 8px;border-radius:3px;cursor:pointer;">Show All</button><button id="col-sel-none" style="background:none;border:1px solid #3a4a68;color:#8aa0c0;font-size:11px;font-weight:700;padding:3px 8px;border-radius:3px;cursor:pointer;">Hide All</button><button id="col-sel-default" style="background:none;border:1px solid #3a4a68;color:#8aa0c0;font-size:11px;font-weight:700;padding:3px 8px;border-radius:3px;cursor:pointer;">Default</button></div>';
  popHtml += '<div style="overflow-y:auto;flex:1;display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;">';

  for (const col of allCols) {
    const label = colLabels[col] || col;
    const isChecked = !hidden.has(col);
    popHtml += '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:' + (isChecked ? '#dde3f0' : '#5a7090') + ';cursor:pointer;padding:3px 0;"><input type="checkbox" data-col="' + escHtml(col) + '" ' + (isChecked ? 'checked' : '') + ' style="accent-color:#4ade80;"/>' + escHtml(label) + '</label>';
  }
  popHtml += '</div>';

  // ── Custom formula columns section ──
  popHtml += '<div style="margin-top:12px;border-top:1px solid #2a3050;padding-top:10px;">';
  popHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="color:#f59e0b;font-weight:800;font-size:12px;">⚡ Custom Columns</span><button id="col-add-custom" style="background:#f59e0b;color:#000;border:none;font-size:10px;font-weight:700;padding:3px 8px;border-radius:3px;cursor:pointer;">+ Add</button></div>';
  popHtml += '<div id="col-custom-list" style="display:flex;flex-direction:column;gap:4px;max-height:120px;overflow-y:auto;">';
  // Load existing custom columns for this scan
  const _customCols = JSON.parse(localStorage.getItem('traderra-scan-custom-cols') || '{}');
  const scanCustomCols = _customCols[scan.id] || [];
  if (scanCustomCols.length === 0) {
    popHtml += '<div style="font-size:10px;color:#4a6080;padding:4px 0;">No custom columns. Click + Add to create one.</div>';
  }
  for (let i = 0; i < scanCustomCols.length; i++) {
    const cc = scanCustomCols[i];
    popHtml += '<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;background:#0a0c12;border:1px solid #1e2840;border-radius:3px;" data-ccidx="' + i + '">';
    popHtml += '<span style="color:#dde3f0;font-size:11px;font-weight:700;min-width:60px;">' + escHtml(cc.name) + '</span>';
    popHtml += '<span style="color:#4a6080;font-size:10px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escHtml(cc.formula) + '">' + escHtml(cc.formula) + '</span>';
    popHtml += '<button class="cc-edit" data-ccidx="' + i + '" style="background:none;border:none;color:#4a6080;font-size:10px;cursor:pointer;">✏️</button>';
    popHtml += '<button class="cc-del" data-ccidx="' + i + '" style="background:none;border:none;color:#f87171;font-size:10px;cursor:pointer;">×</button>';
    popHtml += '</div>';
  }
  popHtml += '</div></div>';

  popHtml += '<div style="margin-top:12px;display:flex;justify-content:flex-end;"><button id="col-settings-apply" style="background:#4ade80;color:#000;border:none;font-size:12px;font-weight:700;padding:6px 16px;border-radius:4px;cursor:pointer;">Apply</button></div>';
  popHtml += '</div>';

  // Remove old popup if exists
  document.getElementById('col-settings-overlay')?.remove();
  document.getElementById('col-settings-popup')?.remove();
  document.body.insertAdjacentHTML('beforeend', popHtml);

  // Wire up events
  const close = () => { document.getElementById('col-settings-overlay')?.remove(); document.getElementById('col-settings-popup')?.remove(); };
  document.getElementById('col-settings-close').onclick = close;
  document.getElementById('col-settings-overlay').onclick = close;

  // Toggle checkbox color on change
  document.querySelectorAll('#col-settings-popup input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.parentElement.style.color = cb.checked ? '#dde3f0' : '#5a7090';
    });
  });

  // Show All / Hide All / Default
  document.getElementById('col-sel-all').onclick = () => {
    document.querySelectorAll('#col-settings-popup input[type=checkbox]').forEach(cb => { cb.checked = true; cb.parentElement.style.color = '#dde3f0'; });
  };
  document.getElementById('col-sel-none').onclick = () => {
    document.querySelectorAll('#col-settings-popup input[type=checkbox]').forEach(cb => { cb.checked = false; cb.parentElement.style.color = '#5a7090'; });
  };
  document.getElementById('col-sel-default').onclick = () => {
    const defaultHidden = new Set(); // show all by default
    document.querySelectorAll('#col-settings-popup input[type=checkbox]').forEach(cb => {
      cb.checked = !defaultHidden.has(cb.dataset.col);
      cb.parentElement.style.color = cb.checked ? '#dde3f0' : '#5a7090';
    });
  };

  // Apply
  document.getElementById('col-settings-apply').onclick = () => {
    const newHidden = [];
    document.querySelectorAll('#col-settings-popup input[type=checkbox]').forEach(cb => {
      if (!cb.checked) newHidden.push(cb.dataset.col);
    });
    const prefs = getScanColPrefs();
    prefs[scan.name] = newHidden;
    saveScanColPrefs(prefs);
    close();
    ScanManager.renderScanResults();
  };

  // ── Custom column management ──
  function getCustomCols() {
    return JSON.parse(localStorage.getItem('traderra-scan-custom-cols') || '{}');
  }
  function saveCustomCols(cc) {
    localStorage.setItem('traderra-scan-custom-cols', JSON.stringify(cc));
  }

  function showCustomColumnForm(idx) {
    const ccAll = getCustomCols();
    const scanCols = ccAll[scan.id] || [];
    const existing = idx >= 0 ? scanCols[idx] : null;

    const nameVal = existing ? existing.name : '';
    const formulaVal = existing ? existing.formula : '';
    const formatVal = existing ? (existing.format || 'number') : 'number';

    const formHtml = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:1002;background:rgba(0,0,0,.5);" id="cc-form-overlay"></div>' +
      '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1003;background:#141926;border:1px solid #f59e0b;border-radius:8px;padding:16px 18px;min-width:300px;max-width:420px;box-shadow:0 12px 40px rgba(0,0,0,.6);" id="cc-form-box">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><span style="color:#f59e0b;font-weight:800;font-size:13px;">⚡ ' + (existing ? 'Edit' : 'Add') + ' Custom Column</span><button id="cc-form-close" style="background:none;border:none;color:#5a7090;font-size:18px;cursor:pointer;">×</button></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;">' +
      '<div><div style="font-size:10px;color:#4a6080;font-weight:700;margin-bottom:3px;">COLUMN NAME</div><input id="cc-name" value="' + escHtml(nameVal) + '" placeholder="e.g. Risk/Reward" style="width:100%;background:#0a0c12;border:1px solid #2a3050;color:#dde3f0;font-size:12px;padding:6px 8px;border-radius:4px;outline:none;" /></div>' +
      '<div><div style="font-size:10px;color:#4a6080;font-weight:700;margin-bottom:3px;">FORMULA (JS expression, "row" = signal object)</div><input id="cc-formula" value="' + escHtml(formulaVal) + '" placeholder="e.g. (row.close - row.open) / row.open * 100" style="width:100%;background:#0a0c12;border:1px solid #2a3050;color:#dde3f0;font-size:12px;padding:6px 8px;border-radius:4px;outline:none;font-family:monospace;" /></div>' +
      '<div><div style="font-size:10px;color:#4a6080;font-weight:700;margin-bottom:3px;">FORMAT</div><select id="cc-format" style="width:100%;background:#0a0c12;border:1px solid #2a3050;color:#dde3f0;font-size:12px;padding:6px 8px;border-radius:4px;outline:none;"><option value="number"' + (formatVal==='number'?' selected':'') + '>Number</option><option value="percent"' + (formatVal==='percent'?' selected':'') + '>Percent</option><option value="money"' + (formatVal==='money'?' selected':'') + '>Money ($)</option><option value="ratio"' + (formatVal==='ratio'?' selected':'') + '>Ratio (x:1)</option></select></div>' +
      '<div style="font-size:10px;color:#4a6080;line-height:1.4;">Available: row.ticker, row.close, row.open, row.high, row.low, row.volume, row.c, row.o, row.h, row.l, row.v, + any field in the signal data.</div>' +
      '</div>' +
      '<div style="margin-top:12px;display:flex;justify-content:flex-end;gap:6px;"><button id="cc-form-cancel" style="background:none;border:1px solid #3a4a68;color:#8aa0c0;font-size:11px;font-weight:700;padding:5px 12px;border-radius:4px;cursor:pointer;">Cancel</button><button id="cc-form-save" style="background:#f59e0b;color:#000;border:none;font-size:11px;font-weight:700;padding:5px 12px;border-radius:4px;cursor:pointer;">Save</button></div>' +
      '</div>';

    document.getElementById('cc-form-overlay')?.remove();
    document.getElementById('cc-form-box')?.remove();
    document.body.insertAdjacentHTML('beforeend', formHtml);

    const closeForm = () => { document.getElementById('cc-form-overlay')?.remove(); document.getElementById('cc-form-box')?.remove(); };
    document.getElementById('cc-form-close').onclick = closeForm;
    document.getElementById('cc-form-cancel').onclick = closeForm;
    document.getElementById('cc-form-overlay').onclick = closeForm;

    document.getElementById('cc-form-save').onclick = () => {
      const name = document.getElementById('cc-name').value.trim();
      const formula = document.getElementById('cc-formula').value.trim();
      const format = document.getElementById('cc-format').value;
      if (!name || !formula) return alert('Name and formula are required.');

      const ccAll = getCustomCols();
      if (!ccAll[scan.id]) ccAll[scan.id] = [];

      const col = { name, key: name.toLowerCase().replace(/[^a-z0-9]/g, '_'), formula, format };

      if (idx >= 0) {
        ccAll[scan.id][idx] = col;
      } else {
        ccAll[scan.id].push(col);
      }
      saveCustomCols(ccAll);
      closeForm();
      close(); // Close column settings too
      // Re-open to refresh the custom columns list
      document.getElementById('scan-col-cog')?.click();
    };
  }

  document.getElementById('col-add-custom').onclick = () => showCustomColumnForm(-1);

  document.querySelectorAll('.cc-edit').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); showCustomColumnForm(parseInt(btn.dataset.ccidx)); };
  });
  document.querySelectorAll('.cc-del').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const ccAll = getCustomCols();
      const scanCols = ccAll[scan.id] || [];
      scanCols.splice(parseInt(btn.dataset.ccidx), 1);
      ccAll[scan.id] = scanCols;
      saveCustomCols(ccAll);
      close();
      document.getElementById('scan-col-cog')?.click(); // Re-open to refresh
    };
  });
});
