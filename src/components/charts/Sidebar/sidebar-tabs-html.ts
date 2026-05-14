// Original sidebar tab content from charts-terminal-backup.html
// Used via dangerouslySetInnerHTML for charts-engine.js interop
export const SIDEBAR_TABS_HTML = `
<div id="tab-look">
      <div id="settings-panel-header" style="justify-content:space-between;">
        <span style="font-size:11px;font-weight:700;color:#D4AF37;letter-spacing:1px;">⚙ LOOK & FEEL</span>
        <span id="theme-editing-label" style="font-size:11px;font-weight:700;color:#6878a8;letter-spacing:.5px;background:#1a1e2e;padding:2px 8px;border-radius:3px;">EDITING: DARK</span>
      </div>
      <div id="settings-panel-body">
        <div class="ss"><div class="sst">CANDLES</div>
          <div class="sr"><label>Up</label><input type="color" id="sc-up" value="#26a69a"></div>
          <div class="sr"><label>Down</label><input type="color" id="sc-dn" value="#ef5350"></div>
          <div class="sr"><label>Vol Up</label><input type="color" id="sc-vu" value="#26a69a"></div>
          <div class="sr"><label>Vol Down</label><input type="color" id="sc-vd" value="#ef5350"></div>
          <div class="sr" style="margin-top:4px;padding-top:4px;border-top:1px solid #1a1e2a;"><label>Filter Prints</label><button id="sc-clean" style="background:#e879f918;border:1px solid #e879f9;color:#e879f9;font-size:11px;font-weight:700;padding:2px 10px;border-radius:3px;cursor:pointer;font-family:'Inter',system-ui,-apple-system,sans-serif;">ON</button><span style="font-size:11px;color:#4a6080;margin-left:4px;">Drop fake bars</span></div>
        </div>
        <div class="ss"><div class="sst">BACKGROUND</div>
          <div class="sr"><label>Chart</label><input type="color" id="sc-bg" value="#0c0e14"></div>
          <div class="sr"><label>Axis</label><input type="color" id="sc-ax" value="#0d0f18"></div>
          <div class="sr"><label>Grid</label><input type="color" id="sc-gr" value="#141926"></div>
          <div class="sr"><label>Border</label><input type="color" id="sc-bd" value="#1e2535"></div>
        </div>
        <div class="ss"><div class="sst">SESSIONS</div>
          <div class="sr"><label>Pre-Mkt</label><input type="color" id="sc-pre" value="#787878"><input type="range" id="sc-preo" min="1" max="40" value="7" style="flex:1;"><span class="srv" id="sc-preo-v">7%</span></div>
          <div class="sr"><label>After-Hrs</label><input type="color" id="sc-aft" value="#3c3c3c"><input type="range" id="sc-afto" min="1" max="40" value="9" style="flex:1;"><span class="srv" id="sc-afto-v">9%</span></div>
        </div>
        <div class="ss"><div class="sst">CROSSHAIR</div>
          <div class="sr"><label>Color</label><input type="color" id="sc-cr" value="#8ca0c8"><input type="range" id="sc-cro" min="10" max="100" value="50" style="flex:1;"><span class="srv" id="sc-cro-v">50%</span></div>
        </div>
        <div class="ss"><div class="sst">FONT SIZE</div>
          <div class="sr" style="margin-bottom:6px;">
            <label>Quick Scale</label>
            <div style="display:flex;gap:4px;flex:1;justify-content:flex-end;">
              <button class="tbtn" onclick="setFontScale('small')" id="fs-small" style="font-size:11px;padding:3px 8px;min-width:0;">S</button>
              <button class="tbtn" onclick="setFontScale('medium')" id="fs-medium" style="font-size:11px;padding:3px 8px;min-width:0;border-color:#D4AF37!important;color:#D4AF37!important;">M</button>
              <button class="tbtn" onclick="setFontScale('large')" id="fs-large" style="font-size:11px;padding:3px 10px;min-width:0;">L</button>
            </div>
          </div>
          <div class="sr"><label>Price Axis</label><input type="range" id="sf-p" min="7" max="16" value="10" style="flex:1;"><span class="srv" id="sf-p-v">10</span></div>
          <div class="sr"><label>Time Axis</label><input type="range" id="sf-t" min="7" max="16" value="9" style="flex:1;"><span class="srv" id="sf-t-v">9</span></div>
          <div class="sr"><label>OHLCV Tip</label><input type="range" id="sf-o" min="9" max="18" value="12" style="flex:1;"><span class="srv" id="sf-o-v">12</span></div>
          <div class="sr"><label>UI Scale</label><input type="range" id="sf-ui" min="9" max="18" value="13" style="flex:1;"><span class="srv" id="sf-ui-v">13</span></div>
        </div>
        <div class="ss"><div class="sst">PRESETS</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <button class="spb" data-pr="default">Default</button>
            <button class="spb" data-pr="gold">Gold</button>
            <button class="spb" data-pr="light">Light</button>
            <button class="spb" data-pr="nord">Nord</button>
          </div>
        </div>
        <div style="display:flex;gap:4px;margin-top:8px;">
          <button id="s-save" class="sab" style="background:#D4AF37;color:#000;">💾 Save as Default</button>
          <span id="save-hint" style="font-size:8px;color:#4a6080;margin-top:2px;text-align:center;display:block;">...</span>
          <button id="s-reset" class="sab" style="border-color:#ef5350;color:#ef5350;">↺ Factory Reset</button>
        </div>
      </div>
    </div>
    <div id="tab-tools">
      <div style="padding:10px 14px;border-bottom:1px solid #1a1e2a;display:flex;align-items:center;">
        <span style="font-size:11px;font-weight:700;color:#D4AF37;letter-spacing:1px;">⚙ TOOL SETTINGS</span>
        <span id="tools-ind-label" style="font-size:11px;font-weight:700;color:#6878a8;letter-spacing:.5px;background:#1a1e2e;padding:2px 8px;border-radius:3px;margin-left:8px;">SELECT TOOL</span>
        <button id="add-tool-btn" onclick="openAddToolPopup()" style="margin-left:auto;width:24px;height:24px;border-radius:50%;border:1px solid #D4AF37;color:#D4AF37;background:transparent;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;font-weight:700;">＋</button>
      </div>
      <!-- Add tool popup (centered modal) -->
      <div id="add-tool-popup" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:1000;display:none;align-items:center;justify-content:center;"></div>
      <div id="tools-body" style="flex:1;overflow-y:auto;padding:0;"></div>
    </div>
    <div id="tab-settings">
      <div style="padding:8px 12px;border-bottom:1px solid #111620;display:flex;align-items:center;">
        <span style="font-size:11px;font-weight:700;color:#22d3ee;letter-spacing:1px;">⚙ SETTINGS</span>
      </div>
      <div style="flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:12px;">
        <div class="vs"><div class="vst">INPUT</div>
          <div class="vr"><label>Zoom Sensitivity</label><input id="is-zoom" type="range" min="0.05" max="0.4" step="0.01" value="0.15" style="flex:1;accent-color:#D4AF37;"><span id="is-zoom-v" class="vrv">0.15</span></div>
          <div class="vr"><label>Trackpad Pan</label><input id="is-tpan" type="range" min="0.1" max="2.0" step="0.05" value="0.5" style="flex:1;accent-color:#22d3ee;"><span id="is-tpan-v" class="vrv">0.50</span></div>
          <div class="vr"><label>Mouse Scroll</label><input id="is-mpan" type="range" min="0.2" max="3.0" step="0.1" value="1.0" style="flex:1;accent-color:#a78bfa;"><span id="is-mpan-v" class="vrv">1.0</span></div>
          <div class="vr"><label>Right Padding</label><input id="is-rpad" type="range" min="0" max="40" step="1" value="6" style="flex:1;accent-color:#22c55e;"><span id="is-rpad-v" class="vrv">6</span></div>
        </div>
        <div class="vs"><div class="vst">DISPLAY</div>
          <div class="vr"><label>Crosshair</label><input type="color" id="sc-cr2" value="#8ca0c8"><input id="sc-cro2" type="range" min="10" max="100" value="50" style="flex:1;accent-color:#D4AF37;"><span id="sc-cro2-v" class="vrv">50%</span></div>
          <div class="vr"><label>Price Labels</label><input id="sf-p2" type="range" min="7" max="16" value="10" style="flex:1;accent-color:#22d3ee;"><span id="sf-p2-v" class="vrv">10</span></div>
          <div class="vr"><label>Time Labels</label><input id="sf-t2" type="range" min="7" max="16" value="9" style="flex:1;accent-color:#a78bfa;"><span id="sf-t2-v" class="vrv">9</span></div>
        </div>
        <div style="display:flex;gap:6px;">
          <button id="is-save" style="flex:2;padding:4px;border:1px solid #D4AF37;color:#000;background:#D4AF37;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">💾 SAVE</button>
          <button id="is-reset" style="flex:1;padding:4px;border:1px solid #ef5350;color:#ef5350;background:transparent;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">↺ RESET</button>
        </div>
      </div>
    </div>
    <div id="tab-vault">
      <div style="padding:8px 12px;border-bottom:1px solid #111620;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:11px;font-weight:700;color:#a78bfa;letter-spacing:1px;">📦 INDICATOR VAULT</span>
      </div>
      <div id="vault-list" style="flex:1;overflow-y:auto;padding:6px;"></div>
    </div>
    <div id="tab-scan">
      <div id="scan-panel-header" style="display:flex;align-items:center;padding:8px 10px;border-bottom:1px solid #111620;">
        <span style="font-size:11px;font-weight:700;color:#4ade80;letter-spacing:1px;">📡 SCANS</span>
        <span id="scan-count" style="margin-left:auto;font-size:11px;color:#8aa0c0;font-weight:700;"></span>
        <button id="scan-col-cog" title="Column settings" style="margin-left:6px;background:none;border:1px solid #3a4a68;color:#5a7090;font-size:13px;width:22px;height:22px;border-radius:3px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;transition:all .15s;" onmouseover="this.style.borderColor='#4ade80';this.style.color='#4ade80'" onmouseout="this.style.borderColor='#3a4a68';this.style.color='#5a7090'">⚙</button>
        <button id="scan-add-btn" title="Add scan" style="margin-left:4px;background:none;border:1px solid #4ade80;color:#4ade80;font-size:14px;width:22px;height:22px;border-radius:3px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">+</button>
      </div>
      <div id="scan-panel-body" style="flex:1;overflow-y:auto;padding:8px;">
        <!-- Scan list: saved scans appear here -->
        <div id="scan-list" style="margin-bottom:8px;"></div>
        <!-- Run controls (shown for any selected scan) -->
        <div id="scan-run-controls" style="display:none;">
          <div style="display:flex;gap:5px;margin-bottom:6px;">
            <div id="scan-active-label" style="flex:1;background:#1a1e2e;border:1px solid #4ade80;color:#4ade80;font-size:11px;font-weight:700;padding:4px 6px;border-radius:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>
            <button id="scan-run-btn" style="background:#4ade80;color:#000;border:none;font-size:11px;font-weight:700;padding:4px 12px;border-radius:3px;cursor:pointer;white-space:nowrap;">▶ SCAN</button>
          </div>
          <div style="display:flex;gap:4px;margin-bottom:6px;">
            <button class="scan-tab active" data-scantab="live" style="padding:4px 10px;border-radius:3px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #2a3050;background:none;color:#4a6080;">LIVE</button>
            <button class="scan-tab" data-scantab="historical" style="padding:4px 10px;border-radius:3px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #2a3050;background:none;color:#4a6080;">HIST</button>
          </div>
          <div id="scan-date-range" style="display:none;margin-bottom:6px;">
            <div style="display:flex;gap:5px;align-items:center;">
              <span style="font-size:11px;color:#6a80a0;font-weight:700;">FROM</span>
              <input id="scan-from" type="date" style="flex:1;background:#1a1e2e;border:1px solid #a855f7;color:#a855f7;font-size:11px;padding:3px 5px;border-radius:3px;outline:none;"/>
              <span style="font-size:11px;color:#6a80a0;font-weight:700;">TO</span>
              <input id="scan-to" type="date" style="flex:1;background:#1a1e2e;border:1px solid #a855f7;color:#a855f7;font-size:11px;padding:3px 5px;border-radius:3px;outline:none;"/>
            </div>
            <div style="display:flex;gap:4px;margin-top:4px;">
              <button class="scan-preset" data-days="30" style="flex:1;background:none;border:1px solid #2a3050;color:#4a6080;font-size:11px;font-weight:700;padding:4px;border-radius:3px;cursor:pointer;">1M</button>
              <button class="scan-preset" data-days="90" style="flex:1;background:none;border:1px solid #2a3050;color:#4a6080;font-size:11px;font-weight:700;padding:4px;border-radius:3px;cursor:pointer;">3M</button>
              <button class="scan-preset" data-days="180" style="flex:1;background:none;border:1px solid #2a3050;color:#4a6080;font-size:11px;font-weight:700;padding:4px;border-radius:3px;cursor:pointer;">6M</button>
              <button class="scan-preset" data-days="365" style="flex:1;background:none;border:1px solid #2a3050;color:#4a6080;font-size:11px;font-weight:700;padding:4px;border-radius:3px;cursor:pointer;">1Y</button>
              <button class="scan-preset" data-days="730" style="flex:1;background:none;border:1px solid #2a3050;color:#4a6080;font-size:11px;font-weight:700;padding:4px;border-radius:3px;cursor:pointer;">2Y</button>
            </div>
          </div>
          <div id="scan-filters" style="margin-bottom:6px;">
            <span style="font-size:11px;color:#6a80a0;font-weight:700;">FILTER:</span>
            <div style="display:flex;gap:4px;margin-top:3px;">
              <label style="display:flex;align-items:center;gap:3px;font-size:11px;color:#4ade80;cursor:pointer;border:1px solid #1e2840;padding:2px 6px;border-radius:3px;">
                <input type="radio" name="scan-filter" value="1" style="accent-color:#4ade80;"/> F1
              </label>
              <label style="display:flex;align-items:center;gap:3px;font-size:11px;color:#38bdf8;cursor:pointer;border:1px solid #1e2840;padding:2px 6px;border-radius:3px;">
                <input type="radio" name="scan-filter" value="2" style="accent-color:#38bdf8;"/> F2
              </label>
              <label style="display:flex;align-items:center;gap:3px;font-size:11px;color:#f59e0b;cursor:pointer;border:1px solid #1e2840;padding:2px 6px;border-radius:3px;">
                <input type="radio" name="scan-filter" value="3" checked style="accent-color:#f59e0b;"/> Both
              </label>
            </div>
          </div>
        </div>
        <div id="scan-status" style="font-size:11px;color:#8aa0c0;margin-bottom:6px;min-height:14px;"></div>
        <div id="scan-watchlist"></div>
        <div id="scan-historical" style="display:none;"></div>
      </div>
    </div>
    <div id="tab-bt">
      <div style="padding:8px 12px;border-bottom:1px solid #111620;display:flex;align-items:center;">
        <span style="font-size:11px;font-weight:700;color:#f59e0b;letter-spacing:1px;">⏱ BT — SAVED SCANS</span>
      </div>
      <div style="flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:10px;">
        <div id="scan-bt-active" style="padding:8px 10px;background:#0d1220;border:1px solid #1e2840;border-radius:4px;font-size:11px;color:#8aa0c0;line-height:1.5;">Select a saved scan in <span style="color:#4ade80;font-weight:700;">SCAN</span> to backtest it here.</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>
            <div style="font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:4px;">SIDE</div>
            <select id="scan-bt-side" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:11px;padding:6px 8px;border-radius:4px;outline:none;">
              <option value="long">▲ LONG</option>
              <option value="short">▼ SHORT</option>
            </select>
          </div>
          <div>
            <div style="font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:4px;">ENTRY</div>
            <select id="scan-bt-entry" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:11px;padding:6px 8px;border-radius:4px;outline:none;">
              <option value="next_open">Next day open</option>
              <option value="trigger_break">Trigger break</option>
              <option value="signal_close">Signal close</option>
            </select>
          </div>
          <div>
            <div style="font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:4px;">STOP</div>
            <select id="scan-bt-stop" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:11px;padding:6px 8px;border-radius:4px;outline:none;">
              <option value="signal">Setup bar extreme</option>
              <option value="pct">Fixed % stop</option>
            </select>
          </div>
          <div>
            <div style="font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:4px;">STOP %</div>
            <input id="scan-bt-stop-pct" type="number" min="0.1" step="0.5" value="5" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:11px;padding:6px 8px;border-radius:4px;outline:none;" />
          </div>
          <div>
            <div style="font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:4px;">TARGET (R)</div>
            <input id="scan-bt-target-r" type="number" min="0" step="0.25" value="2" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:11px;padding:6px 8px;border-radius:4px;outline:none;" />
          </div>
          <div>
            <div style="font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:4px;">MAX HOLD</div>
            <input id="scan-bt-hold-days" type="number" min="1" step="1" value="5" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:11px;padding:6px 8px;border-radius:4px;outline:none;" />
          </div>
        </div>

        <div>
          <div style="font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:4px;">RISK / TRADE ($)</div>
          <input id="scan-bt-risk" type="number" min="1" step="50" value="1000" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:11px;padding:6px 8px;border-radius:4px;outline:none;" />
        </div>

        <div style="display:flex;gap:6px;">
          <button id="scan-bt-run-btn" style="flex:1;background:#f59e0b;color:#000;border:none;font-size:11px;font-weight:800;padding:7px 10px;border-radius:4px;cursor:pointer;">▶ RUN BT</button>
          <button id="scan-bt-review-btn" style="flex:1;background:#0d1220;border:1px solid #38bdf8;color:#38bdf8;font-size:11px;font-weight:800;padding:7px 10px;border-radius:4px;cursor:pointer;">📋 REVIEW</button>
        </div>

        <div id="scan-bt-status" style="font-size:11px;color:#8aa0c0;line-height:1.5;padding:8px 10px;background:#0a0c12;border:1px solid #1e2840;border-radius:4px;">Uses saved scan results + Polygon daily bars. Conservative fill model: if stop and target hit on the same bar, stop wins.</div>

        <div id="scan-bt-summary" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;"></div>

        <div style="font-size:10px;color:#4a6080;line-height:1.5;padding:8px 10px;border:1px dashed #2a3050;border-radius:4px;">
          MVP rules: daily bars only, no intraday sequencing, no overlapping-position controls yet. Review generated trades in the BT review sidebar.
        </div>
      </div>
    </div>
    <div id="tab-lab">
              <div style="padding:8px 12px;border-bottom:1px solid #111620;display:flex;align-items:center;gap:6px;">
                <span style="font-size:11px;font-weight:700;color:#c084fc;letter-spacing:1px;">🔬 STRATEGY LAB</span>
                <span style="flex:1"></span>
                <button id="lab-add-project" style="background:#c084fc;color:#000;border:none;font-size:10px;font-weight:800;padding:3px 8px;border-radius:3px;cursor:pointer;">+ NEW</button>
              </div>
        
              <div id="lab-projects-list" style="padding:6px 0;max-height:120px;overflow-y:auto;">
                <div style="padding:10px 14px;font-size:11px;color:#4a6080;">No strategy projects yet.</div>
              </div>
        
              <div id="lab-project-detail" style="display:none;padding:0;">
                <div id="lab-project-header" style="padding:8px 12px;border-bottom:1px solid #1e2840;display:flex;align-items:center;gap:6px;">
                  <button id="lab-back-btn" style="background:none;border:none;color:#4a6080;font-size:14px;cursor:pointer;">←</button>
                  <span id="lab-project-title" style="font-size:12px;font-weight:800;color:#c084fc;flex:1;"></span>
                  <span id="lab-project-status" style="font-size:10px;padding:2px 6px;border-radius:3px;font-weight:700;"></span>
                  <button id="lab-capture-btn" style="background:#c084fc;color:#000;border:none;font-size:10px;font-weight:800;padding:3px 8px;border-radius:3px;cursor:pointer;" title="Capture chart screenshot">📷</button>
                  <button id="lab-add-note-btn" style="background:none;border:1px solid #3a4a68;color:#8aa0c0;font-size:10px;font-weight:700;padding:3px 8px;border-radius:3px;cursor:pointer;">+ Note</button>
                </div>
        
                <div id="lab-phase-tabs" style="display:flex;border-bottom:1px solid #1e2840;overflow-x:auto;"></div>
        
                <div id="lab-entries" style="flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px;"></div>
              </div>
            </div>

  </div>
</div>

<!-- Generic Modal -->
<div id="modal-overlay" onclick="modalClose()"></div>
<div id="modal-box">
  <div id="modal-title"></div>
  <div id="modal-body"></div>
  <div id="modal-actions"></div>
</div>

<!-- Scan Add Modal -->
<div id="scan-add-modal">
  <div id="scan-add-box">
    <h3>＋ ADD SCAN</h3>
    <div style="padding:0 16px;overflow-y:auto;flex:1;">
      <!-- Tab selector -->
      <div style="display:flex;gap:4px;margin:10px 0 8px;">
        <button class="scan-add-tab active" data-addtab="upload" style="flex:1;padding:6px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #2a3050;background:#1a2030;color:#4ade80;">📤 UPLOAD</button>
        <button class="scan-add-tab" data-addtab="builtin" style="flex:1;padding:6px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #2a3050;background:none;color:#4a6080;">📡 BUILT-IN</button>
        <button class="scan-add-tab" data-addtab="code" style="flex:1;padding:6px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #2a3050;background:none;color:#4a6080;">💻 CODE</button>
      </div>

      <!-- Name field -->
      <input type="text" id="scan-add-name" placeholder="Scan name (e.g. Inside Day — Q1 2025)" />

      <!-- Upload tab -->
      <div id="scan-add-upload" class="scan-add-panel">
        <div class="scan-upload-zone" id="scan-drop-zone">
          <div class="icon">📂</div>
          <p style="color:#dde3f0;font-weight:700;font-size:12px;">Drop file or click to upload</p>
          <p>CSV, JSON, or JS scan files</p>
          <input type="file" id="scan-file-input" accept=".csv,.json,.js,.py" style="display:none;" />
        </div>
        <div id="scan-file-info" style="display:none;padding:8px;background:#0d1220;border:1px solid #1e2840;border-radius:4px;margin-top:8px;font-size:11px;color:#8aa0c0;"></div>
      </div>

      <!-- Built-in tab -->
      <div id="scan-add-builtin" class="scan-add-panel" style="display:none;">
        <select id="scan-add-strategy" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:12px;padding:6px 10px;border-radius:4px;margin:4px 0;">
          <option value="inside_day_long">Inside Day Long</option>
        </select>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <div style="flex:1;">
            <label style="font-size:11px;color:#4a6080;">FROM</label>
            <input type="date" id="scan-add-from" style="width:100%;background:#141926;border:1px solid #2a3050;color:#a855f7;font-size:11px;padding:4px 6px;border-radius:3px;outline:none;" />
          </div>
          <div style="flex:1;">
            <label style="font-size:11px;color:#4a6080;">TO</label>
            <input type="date" id="scan-add-to" style="width:100%;background:#141926;border:1px solid #2a3050;color:#a855f7;font-size:11px;padding:4px 6px;border-radius:3px;outline:none;" />
          </div>
        </div>
        <p style="font-size:11px;color:#4a6080;margin-top:6px;">Creates a saved scan and runs it. Results are stored.</p>
      </div>

      <!-- Code tab -->
      <div id="scan-add-code" class="scan-add-panel" style="display:none;">
        <textarea id="scan-add-codearea" placeholder="// Paste scan code here...\\n// Must export: function scan(dayMaps, dates, filterMode) → results[]" style="width:100%;height:140px;background:#0a0c12;border:1px solid #2a3050;color:#dde3f0;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:11px;padding:8px;border-radius:4px;resize:vertical;outline:none;"></textarea>
        <p style="font-size:11px;color:#4a6080;margin-top:4px;">JS code receives (dayMaps, dates, filterMode) and returns results[].</p>
      </div>
    </div>
    <div class="scan-modal-btns">
      <button class="btn-cancel" onclick="scanAddClose()">Cancel</button>
      <button class="btn-validate" id="scan-validate-btn" onclick="scanAddValidate()" style="background:#a855f7;color:#fff;">🤖 Validate & Fix</button>
      <button class="btn-save" id="scan-add-save" onclick="scanAddSave()">Save Scan</button>
    </div>
    <div id="scan-validate-result" style="display:none;padding:10px 16px;border-top:1px solid #1e2840;max-height:200px;overflow-y:auto;"></div>
  </div>
</div>

<div id="pct-popup">
  <div id="pct-popup-title" style="font-size:11px;letter-spacing:1px;font-weight:700;color:#ff9800;cursor:move;user-select:none;">LONG</div>
  <div style="display:grid;grid-template-columns:auto 1fr;align-items:center;gap:5px 8px;">
    <label id="pct-price-label" style="font-size:11px;color:#4a6080;font-family:'Inter',system-ui,-apple-system,sans-serif;display:none;">PRICE</label>
    <input id="pct-price-input" type="number" step="0.01" placeholder="price" style="background:#1e2436;border:1px solid #fbbf24;color:#fbbf24;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14px;padding:4px 7px;border-radius:3px;outline:none;width:100%;display:none;"/>
    <label style="font-size:11px;color:#4a6080;font-family:'Inter',system-ui,-apple-system,sans-serif;">%&nbsp;RISK</label>
    <div style="display:flex;gap:4px;">
      <input id="pct-input" type="number" min="0" max="9999" step="1" placeholder="100" style="background:#1e2436;border:1px solid #2a3050;color:#dde3f0;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14px;padding:4px 7px;border-radius:3px;outline:none;flex:1;min-width:0;"/>
      <button id="pct-rebuy" title="Re-add last sold qty" style="background:none;border:1px solid #ff9800;color:#ff9800;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:8px;padding:2px 5px;border-radius:3px;cursor:pointer;white-space:nowrap;">↺ REBUY</button>
    </div>
    <label id="pct-stop-label" style="font-size:11px;color:#4a6080;font-family:'Inter',system-ui,-apple-system,sans-serif;">STOP</label>
    <input id="pct-stop-input" type="number" step="0.0001" placeholder="price" style="background:#1e2436;border:1px solid #2a3050;color:#facc15;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14px;padding:4px 7px;border-radius:3px;outline:none;width:100%;"/>
    <label id="pct-pnlrisk-label" style="font-size:11px;color:#4a6080;font-family:'Inter',system-ui,-apple-system,sans-serif;display:none;">+BASE%</label>
    <input id="pct-pnlrisk-input" type="number" min="0" max="9999" step="1" placeholder="0" title="Use locked PnL + this% of Risk$ as risk budget" style="background:#1e2436;border:1px solid #2a3050;color:#a78bfa;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14px;padding:4px 7px;border-radius:3px;outline:none;width:100%;display:none;"/>
  </div>
  <div style="display:flex;gap:4px;margin-top:4px;">
    <button id="pct-mode-normal" style="flex:1;padding:2px;border-radius:3px;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:8px;cursor:pointer;border:1px solid #ff9800;background:#ff980018;color:#ff9800;" id="pct-mode-normal-label">% RISK</button>
    <button id="pct-mode-pnl" style="flex:1;padding:2px;border-radius:3px;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:8px;cursor:pointer;border:1px solid #2a3050;background:none;color:#4a6080;">PNL + %</button>
  </div>
  <div id="pct-popup-hint" style="font-size:11px;color:#2a4060;margin-top:3px;line-height:1.4;min-height:12px;"></div>
  <div class="popup-btns">
    <button id="pct-ok">PLACE</button>
    <button class="cancel" id="pct-cancel">CANCEL</button>
  </div>
</div>

<div id="text-popup">
  <div style="font-size:11px;color:#a855f7;letter-spacing:1px;font-weight:700;">ANNOTATION TEXT</div>
  <input id="text-input" type="text" placeholder="Enter label…" maxlength="80"/>
  <div class="popup-btns">
    <button id="text-ok">PLACE</button>
    <button class="cancel" id="text-cancel">CANCEL</button>
  </div>
</div>
`
