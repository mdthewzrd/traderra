// ══════════════════════════════════════════════════════════
//  CLOUD STORE + AUTH — better-auth inline modal
// ══════════════════════════════════════════════════════════
var CloudStore = {
  userId: null,
  userName: null,
  userEmail: null,
  token: null,
  _debounce: null,
  get apiBase(){
    if(window._cloudApiBase) return window._cloudApiBase;
    if(location.hostname.indexOf('traderra-lime')!==-1 || location.hostname.indexOf('traderra-maikus')!==-1) return '';
    return 'https://traderra-lime.vercel.app';
  },

  // Get auth headers for API calls
  _authHeaders: function(){
    var h = {'Content-Type':'application/json'};
    var t = CloudStore.token || localStorage.getItem('traderra-auth-token');
    if(t) h['Authorization'] = 'Bearer '+t;
    return h;
  },

  init: function(){
    // Check for OAuth callback token in URL
    var params = new URLSearchParams(window.location.search);
    var cbToken = params.get('token');
    if(cbToken){
      localStorage.setItem('traderra-auth-token', cbToken);
      CloudStore.token = cbToken;
      // Clean URL
      params.delete('token');
      var clean = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (clean ? '?'+clean : ''));
    } else {
      CloudStore.token = localStorage.getItem('traderra-auth-token');
    }
    CloudStore.checkSession();
  },

  checkSession: function(){
    fetch(CloudStore.apiBase+'/api/chart-data/session',{headers:CloudStore._authHeaders()}).then(function(r){return r.json();}).then(function(d){
      if(d.authenticated){
        CloudStore.userId = d.userId;
        CloudStore.userName = d.name || d.email;
        CloudStore.userEmail = d.email;
        CloudStore.loadAll();
        CloudStore._updateIcon('synced');
      } else {
        CloudStore.token = null;
        localStorage.removeItem('traderra-auth-token');
        CloudStore._updateIcon(false);
      }
    }).catch(function(){ CloudStore._updateIcon(false); });
  },

  _updateIcon: function(state){
    var icon = document.getElementById('profile-icon');
    if(!icon) return;
    if(state==='synced'){
      var initials = (CloudStore.userName||'U').charAt(0).toUpperCase();
      icon.innerHTML = '<span style="font-size:12px;font-weight:700">'+initials+'</span>';
      icon.style.background = '#D4AF37';
      icon.style.borderColor = '#D4AF37';
      icon.style.color = '#000';
      icon.title = CloudStore.userEmail || 'Synced';
      icon.onclick = function(e){ e.stopPropagation(); CloudStore.showProfileMenu(); };
    } else {
      icon.innerHTML = '👤';
      icon.style.background = '#2a3050';
      icon.style.borderColor = '#3a4a68';
      icon.style.color = '#6a7a98';
      icon.title = 'Sign in to sync';
      icon.onclick = function(e){ e.stopPropagation(); CloudStore.showAuthModal(); };
    }
  },

  // ── Auth Modal ──
  showAuthModal: function(){
    CloudStore.hideProfileMenu();
    if(document.getElementById('auth-modal')) return;
    var m = document.createElement('div');
    m.id = 'auth-modal';
    m.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);';
    m.onclick = function(e){ if(e.target===m) CloudStore.hideAuthModal(); };
    m.innerHTML = '<div style="background:#131720;border:1px solid #2a3050;border-radius:8px;width:320px;padding:24px;font-family:monospace;color:#dde3f0;">'+
      '<div style="font-size:16px;font-weight:700;margin-bottom:16px;text-align:center;">TRADERRA</div>'+
      '<div id="auth-tabs" style="display:flex;gap:0;margin-bottom:16px;">'+
      '<button id="auth-tab-signin" onclick="CloudStore.authTab(\'signin\')" style="flex:1;padding:8px;background:#1a1e2e;border:1px solid #2a3050;color:#D4AF37;font-weight:700;font-size:12px;cursor:pointer;border-radius:4px 0 0 4px;font-family:monospace;">Sign In</button>'+
      '<button id="auth-tab-signup" onclick="CloudStore.authTab(\'signup\')" style="flex:1;padding:8px;background:#0a0c12;border:1px solid #2a3050;color:#5a6a88;font-weight:700;font-size:12px;cursor:pointer;border-radius:0 4px 4px 0;font-family:monospace;">Sign Up</button>'+
      '</div>'+
      '<div id="auth-form-area"></div>'+
      '<div id="auth-error" style="color:#ef5350;font-size:11px;margin-top:8px;display:none;"></div>'+
      '</div>';
    document.body.appendChild(m);
    CloudStore.authTab('signin');
  },

  hideAuthModal: function(){
    var m = document.getElementById('auth-modal');
    if(m) m.remove();
  },

  authTab: function(tab){
    var siBtn = document.getElementById('auth-tab-signin');
    var suBtn = document.getElementById('auth-tab-signup');
    var area = document.getElementById('auth-form-area');
    var errEl = document.getElementById('auth-error');
    if(errEl) errEl.style.display='none';
    if(tab==='signin'){
      siBtn.style.background='#1a1e2e'; siBtn.style.color='#D4AF37';
      suBtn.style.background='#0a0c12'; suBtn.style.color='#5a6a88';
      area.innerHTML = '<input id="auth-email" type="email" placeholder="Email" style="width:100%;padding:8px 10px;background:#0a0c12;border:1px solid #2a3050;color:#dde3f0;font-size:13px;border-radius:4px;margin-bottom:8px;font-family:monospace;">'+
        '<input id="auth-pass" type="password" placeholder="Password" style="width:100%;padding:8px 10px;background:#0a0c12;border:1px solid #2a3050;color:#dde3f0;font-size:13px;border-radius:4px;margin-bottom:12px;font-family:monospace;">'+
        '<button onclick="CloudStore.signIn()" style="width:100%;padding:10px;background:#D4AF37;color:#000;font-weight:700;border:none;border-radius:4px;font-size:13px;cursor:pointer;font-family:monospace;margin-bottom:12px;">Sign In</button>'+
        '<div style="text-align:center;color:#3a4a68;font-size:11px;margin-bottom:12px;">— or —</div>'+
        '<button onclick="CloudStore.signInWithGitHub()" style="width:100%;padding:10px;background:#24292e;color:#fff;font-weight:700;border:1px solid #444;border-radius:4px;font-size:13px;cursor:pointer;font-family:monospace;display:flex;align-items:center;justify-content:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>Continue with GitHub</button>'+
        '<button onclick="CloudStore.signInWithGoogle()" style="width:100%;padding:10px;background:#fff;color:#333;font-weight:700;border:1px solid #ddd;border-radius:4px;font-size:13px;cursor:pointer;font-family:monospace;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;"><svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>Continue with Google</button>';
      document.getElementById('auth-email').focus();
    } else {
      suBtn.style.background='#1a1e2e'; suBtn.style.color='#D4AF37';
      siBtn.style.background='#0a0c12'; siBtn.style.color='#5a6a88';
      area.innerHTML = '<input id="auth-name" type="text" placeholder="Name" style="width:100%;padding:8px 10px;background:#0a0c12;border:1px solid #2a3050;color:#dde3f0;font-size:13px;border-radius:4px;margin-bottom:8px;font-family:monospace;">'+
        '<input id="auth-email" type="email" placeholder="Email" style="width:100%;padding:8px 10px;background:#0a0c12;border:1px solid #2a3050;color:#dde3f0;font-size:13px;border-radius:4px;margin-bottom:8px;font-family:monospace;">'+
        '<input id="auth-pass" type="password" placeholder="Password (6+ chars)" style="width:100%;padding:8px 10px;background:#0a0c12;border:1px solid #2a3050;color:#dde3f0;font-size:13px;border-radius:4px;margin-bottom:12px;font-family:monospace;">'+
        '<button onclick="CloudStore.signUp()" style="width:100%;padding:10px;background:#D4AF37;color:#000;font-weight:700;border:none;border-radius:4px;font-size:13px;cursor:pointer;font-family:monospace;margin-bottom:12px;">Create Account</button>'+
        '<div style="text-align:center;color:#3a4a68;font-size:11px;margin-bottom:12px;">— or —</div>'+
        '<button onclick="CloudStore.signInWithGitHub()" style="width:100%;padding:10px;background:#24292e;color:#fff;font-weight:700;border:1px solid #444;border-radius:4px;font-size:13px;cursor:pointer;font-family:monospace;display:flex;align-items:center;justify-content:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>Continue with GitHub</button>'+
        '<button onclick="CloudStore.signInWithGoogle()" style="width:100%;padding:10px;background:#fff;color:#333;font-weight:700;border:1px solid #ddd;border-radius:4px;font-size:13px;cursor:pointer;font-family:monospace;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;"><svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>Continue with Google</button>';
      document.getElementById('auth-name').focus();
    }
  },

  _authErr: function(msg){
    var e = document.getElementById('auth-error');
    if(e){ e.textContent=msg; e.style.display='block'; }
  },

  signIn: function(){
    var email = document.getElementById('auth-email').value.trim();
    var pass = document.getElementById('auth-pass').value;
    if(!email||!pass) return CloudStore._authErr('Email and password required');
    fetch(CloudStore.apiBase+'/api/auth/sign-in/email',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:email,password:pass})
    }).then(function(r){
      if(!r.ok) return r.json().then(function(d){ throw new Error(d.message||'Sign in failed'); });
      return r.json();
    }).then(function(d){
      if(d.token){
        CloudStore.token = d.token;
        localStorage.setItem('traderra-auth-token', d.token);
      }
      CloudStore.hideAuthModal();
      CloudStore.checkSession();
    }).catch(function(e){ CloudStore._authErr(e.message||'Sign in failed'); });
  },

  signUp: function(){
    var name = document.getElementById('auth-name').value.trim();
    var email = document.getElementById('auth-email').value.trim();
    var pass = document.getElementById('auth-pass').value;
    if(!name||!email||!pass) return CloudStore._authErr('All fields required');
    if(pass.length<6) return CloudStore._authErr('Password must be 6+ chars');
    fetch(CloudStore.apiBase+'/api/auth/sign-up/email',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:name,email:email,password:pass})
    }).then(function(r){
      if(!r.ok) return r.json().then(function(d){ throw new Error(d.message||'Sign up failed'); });
      return r.json();
    }).then(function(d){
      if(d.token){
        CloudStore.token = d.token;
        localStorage.setItem('traderra-auth-token', d.token);
      }
      CloudStore.hideAuthModal();
      CloudStore.checkSession();
    }).catch(function(e){ CloudStore._authErr(e.message||'Sign up failed'); });
  },

  signInWithGoogle: function(){
    CloudStore._socialSignIn('google');
  },

  signInWithGitHub: function(){
    CloudStore._socialSignIn('github');
  },

  _socialSignIn: function(provider){
    // Must navigate browser to the API domain so better-auth cookies are set properly.
    // Cross-origin fetch doesn't preserve cookies for the OAuth state check.
    var finalDest = window.location.origin + window.location.pathname;
    var encoded = btoa(finalDest);
    var dest = CloudStore.apiBase + '/charts-login?provider=' + provider + '&dest=' + encodeURIComponent(encoded);
    window.location.href = dest;
  },

  signOut: function(){
    CloudStore.hideProfileMenu();
    CloudStore.token = null;
    localStorage.removeItem('traderra-auth-token');
    CloudStore.userId = null;
    CloudStore.userName = null;
    CloudStore.userEmail = null;
    CloudStore._updateIcon(false);
  },

  // ── Profile Menu ──
  showProfileMenu: function(){
    CloudStore.hideProfileMenu();
    var icon = document.getElementById('profile-icon');
    if(!icon) return;
    var rect = icon.getBoundingClientRect();
    var menu = document.createElement('div');
    menu.id = 'profile-menu';
    menu.style.cssText = 'position:fixed;top:'+(rect.bottom+8)+'px;right:12px;z-index:10001;background:#131720;border:1px solid #2a3050;border-radius:6px;width:200px;padding:8px 0;font-family:monospace;color:#dde3f0;';
    menu.innerHTML = '<div style="padding:8px 14px;font-size:11px;color:#5a6a88;">'+(CloudStore.userEmail||'')+'</div>'+
      '<div style="height:1px;background:#1e2535;margin:4px 0;"></div>'+
      '<div style="padding:6px 14px;font-size:11px;color:#22c55e;cursor:default;">✓ Synced to cloud</div>'+
      '<div style="height:1px;background:#1e2535;margin:4px 0;"></div>'+
      '<div onclick="CloudStore.signOut()" style="padding:8px 14px;font-size:12px;color:#ef5350;cursor:pointer;" onmouseover="this.style.background=\'#1a1e2e\'" onmouseout="this.style.background=\'\'">🚪 Sign Out</div>';
    document.body.appendChild(menu);
    // Close on outside click
    setTimeout(function(){ document.addEventListener('click', CloudStore.hideProfileMenu, {once:true}); }, 10);
  },

  hideProfileMenu: function(){
    var m = document.getElementById('profile-menu');
    if(m) m.remove();
  },

  // ── Data sync ──
  loadAll: function(){
    if(!CloudStore.userId) return;
    fetch(CloudStore.apiBase+'/api/chart-data/layout',{headers:CloudStore._authHeaders()}).then(function(r){return r.json();}).then(function(d){
      if(!d.layout) return;
      var l = d.layout;
      if(l.tools && l.tools.length) {
        panels.forEach(function(p,i){
          if(l.tools[i]) { p.tools = l.tools[i]; p.inds = deriveInds(p.tools); }
        });
        panels.forEach(function(_,i){ buildIndicatorRow(i); });
        renderHotButtons();
      }
      if(l.preset) { activePreset = l.preset; }
      if(l.presetIndCustoms) { presetIndCustoms = l.presetIndCustoms; }
    }).catch(function(){});
  },

  save: function(what){
    if(what === 'tools'){
      localStorage.setItem('traderra-tools', JSON.stringify(panels.map(function(p){return p.tools||[];})));
    }
    if(!CloudStore.userId) return;
    if(CloudStore._debounce) clearTimeout(CloudStore._debounce);
    CloudStore._debounce = setTimeout(function(){ CloudStore._flushSave(what); }, 1000);
  },

  _flushSave: function(what){
    var base = CloudStore.apiBase;
    var opts = { method:'PUT', headers:CloudStore._authHeaders() };
    if(what==='tools'||what==='layout'){
      fetch(base+'/api/chart-data/layout', Object.assign({}, opts, {body:JSON.stringify({
        tools: panels.map(function(p){return p.tools||[];}),
        preset: activePreset,
        presetIndCustoms: presetIndCustoms,
      })})).catch(function(){});
    } else if(what==='annotations'){
      if(!symbol) return;
      var annData = JSON.parse(localStorage.getItem('traderra-annotations-'+symbol)||'[]');
      fetch(base+'/api/chart-data/annotations?symbol='+symbol, Object.assign({}, opts, {body:JSON.stringify({data:annData})})).catch(function(){});
    } else if(what==='settings'){
      var s = {};
      try{ s.drawDefaults = JSON.parse(localStorage.getItem('traderra-draw-defaults')||'{}'); }catch(e){}
      try{ s.theme = localStorage.getItem('traderra-theme')||'dark'; }catch(e){}
      try{ s.themeColors = JSON.parse(localStorage.getItem('traderra-theme-colors')||'{}'); }catch(e){}
      try{ s.trackpadSettings = JSON.parse(localStorage.getItem('traderra-trackpad')||'{}'); }catch(e){}
      fetch(base+'/api/chart-data/settings', Object.assign({}, opts, {body:JSON.stringify(s)})).catch(function(){});
    }
  }
};
'use strict';
window.onerror=function(msg,src,line,col,err){document.title='❌ '+msg+' L'+line;var t=document.getElementById('toast');if(t){t.textContent='🔴 ERROR L'+line+': '+msg;t.style.transform='translateX(0)';t.style.borderLeftColor='red';setTimeout(function(){t.style.transform='translateX(130%)';},6000);}return false;};
window.addEventListener('unhandledrejection',function(e){var t=document.getElementById('toast');if(t){t.textContent='🔴 ASYNC: '+(e.reason&&e.reason.message||e.reason);t.style.transform='translateX(0)';t.style.borderLeftColor='red';setTimeout(function(){t.style.transform='translateX(130%)';},6000);}});
// ══════════════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════════════
const API_KEY = 'd95jSGsXx6ZoqYG1_GXaqnmP6y64ZO_r';
const POLY = 'https://api.polygon.io';
const PRE_START=240, MKTOPEN=570, MKTCLOSE=960, POST_END=1200;
const VOL_FRAC_DEFAULT = 0.22;   // default volume pane fraction

// ══════════════════════════════════════════════════════════
//  INDICATOR PARAM HELPERS
//  gatherParams reads saved customizations from localStorage
// ══════════════════════════════════════════════════════════
function gatherParams(indKey){
  const reg = IND_REGISTRY[indKey];
  if(!reg || !reg.params) return {};
  const p = {};
  reg.params.forEach(prm => {
    var v = getIndCustom(indKey, 'params', prm.key);
    p[prm.key] = v != null ? v : prm.def;
  });
  return p;
}

const TF_LIST = [
  {tf:'1',l:'1m'},{tf:'2',l:'2m'},{tf:'3',l:'3m'},{tf:'5',l:'5m'},
  {tf:'10',l:'10m'},{tf:'15',l:'15m'},{tf:'30',l:'30m'},{tf:'60',l:'1h'},
  {tf:'240',l:'4h'},{tf:'D',l:'D'},{tf:'W',l:'W'},{tf:'M',l:'Mo'},
];
const PANEL_DEFAULTS=[{tf:'5'},{tf:'15'},{tf:'60'},{tf:'D'}];

const C={
  bg:'#0c0e14', axisbg:'#0d0f18', grid:'#141926',
  up:'#26a69a', dn:'#ef5350',
  axisLabel:'#6878a8', axisMuted:'#4a5580', axisHighlight:'#8090b0',
  crossLabelBg:'#141a2a', crossLabelBd:'#2a3050',
  ema9:'#e8d000', ema20:'#3a70e0', ema50:'#00c8e8', ema150:'#e0e0e0', ema200:'#e0e0e0', vwap:'#00e676',
  sma_color:'#5a9ae6', bb_fill:'rgba(100,149,237,.08)', bb_upper:'rgba(100,149,237,.40)', bb_lower:'rgba(100,149,237,.40)',
  vol_sma_color:'#D4AF37',
  ema40_60_fill:'rgba(0,200,232,0.10)', ema40_60_line:'rgba(0,200,232,0.55)',
  db_upper_fill:'rgba(200,120,20,.20)', db_upper_line:'rgba(220,140,30,.90)',
  db_low1_fill:'rgba(200,184,0,.20)',   db_low1_line:'rgba(220,200,10,.90)',
  db_low2_fill:'rgba(20,120,200,.20)',  db_low2_line:'rgba(30,150,220,.90)',
  pre:'rgba(120,120,120,.08)', after:'rgba(60,60,60,.10)',
  cross:'rgba(140,160,200,.5)',
  trendline:'#dde3f0',
  box_orange:'#f97316', box_yellow:'#eab308',
  hl_cyan:'#22d3ee', hl_magenta:'#e879f9', hl_green:'#4ade80', hl_white:'#cbd5e1',
  vol_up:'rgba(38,166,154,.5)', vol_dn:'rgba(239,83,80,.5)',
  band_green:'rgba(34,197,94,.15)',    band_red:'rgba(239,68,68,.15)',
  band_green_line:'rgba(34,197,94,.50)', band_red_line:'rgba(239,68,68,.50)',
  // Per-tool colors (each tool gets unique keys)
  band_9_20_bull_fill:'rgba(34,197,94,.15)',  band_9_20_bull_line:'rgba(34,197,94,.50)',
  band_9_20_bear_fill:'rgba(239,68,68,.15)',  band_9_20_bear_line:'rgba(239,68,68,.50)',
  band_72_89_bull_fill:'rgba(34,197,94,.15)', band_72_89_bull_line:'rgba(34,197,94,.50)',
  band_72_89_bear_fill:'rgba(239,68,68,.15)', band_72_89_bear_line:'rgba(239,68,68,.50)',
  dev_s_9_20_up_fill:'rgba(239,68,68,.15)', dev_s_9_20_up_line:'rgba(239,68,68,.40)',
  dev_s_9_20_dn_fill:'rgba(34,197,94,.15)', dev_s_9_20_dn_line:'rgba(34,197,94,.40)',
  dev_l_9_20_up_fill:'rgba(239,68,68,.15)', dev_l_9_20_up_line:'rgba(239,68,68,.40)',
  dev_l_9_20_dn_fill:'rgba(34,197,94,.15)', dev_l_9_20_dn_line:'rgba(34,197,94,.40)',
  db_72_89_up_fill:'rgba(239,68,68,.15)',   db_72_89_up_line:'rgba(239,68,68,.40)',
  db_72_89_dn_fill:'rgba(34,197,94,.15)',   db_72_89_dn_line:'rgba(34,197,94,.40)',
  zone_fill:'rgba(212,175,55,.12)',    zone_line:'rgba(212,175,55,.40)',
  pz_sup_fill:'rgba(34,197,94,.08)',   pz_sup_line:'rgba(34,197,94,.35)',  pz_sup_label:'#26a69a',
  pz_res_fill:'rgba(239,68,68,.08)',   pz_res_line:'rgba(239,68,68,.35)',  pz_res_label:'#ef5350',
};

// ═══ INDICATOR REGISTRY ═══
// Master definition of every indicator: which C{} color keys it uses, params it accepts, group for UI
const IND_REGISTRY = {
  ema9:     {label:'EMA 9',  group:'MA', colors:['ema9'], params:[{key:'period',label:'Period',def:9,min:1,max:500}]},
  ema20:    {label:'EMA 20', group:'MA', colors:['ema20'], params:[{key:'period',label:'Period',def:20,min:1,max:500}]},
  ema50:    {label:'EMA 50', group:'MA', colors:['ema50'], params:[{key:'period',label:'Period',def:50,min:1,max:500}]},
  ema150:   {label:'EMA 150',group:'MA', colors:['ema150'], params:[{key:'period',label:'Period',def:150,min:1,max:500}]},
  ema200:   {label:'EMA 200',group:'MA', colors:['ema200'], params:[{key:'period',label:'Period',def:200,min:1,max:500}]},
  ema40_60: {label:'EMA 40/60',group:'MA', colors:['ema40_60_fill','ema40_60_line'], colorLabels:['Fill','Line'], params:[{key:'fast',label:'Fast',def:40,min:1,max:500},{key:'slow',label:'Slow',def:60,min:1,max:500}]},
  band_9_20:{label:'EMA Band 9/20', group:'EMA Bands', colors:['band_9_20_bull_fill','band_9_20_bull_line','band_9_20_bear_fill','band_9_20_bear_line'], colorLabels:['Bull Fill','Bull Line','Bear Fill','Bear Line']},
  band_72_89:{label:'EMA Band 72/89',group:'EMA Bands', colors:['band_72_89_bull_fill','band_72_89_bull_line','band_72_89_bear_fill','band_72_89_bear_line'], colorLabels:['Bull Fill','Bull Line','Bear Fill','Bear Line']},
  dev_s_9_20:{label:'Dev Band S 9/20',group:'Dev Bands', colors:['dev_s_9_20_up_fill','dev_s_9_20_up_line','dev_s_9_20_dn_fill','dev_s_9_20_dn_line'], colorLabels:['Upper Fill','Upper Line','Lower Fill','Lower Line'], params:[{key:'fast',label:'Fast',def:9,min:1,max:200},{key:'slow',label:'Slow',def:20,min:1,max:200},{key:'upLow',label:'Up Mult Low',def:0.5,step:0.1},{key:'upHigh',label:'Up Mult High',def:1,step:0.1},{key:'dnLow',label:'Dn Mult Low',def:2,step:0.1},{key:'dnHigh',label:'Dn Mult High',def:2.4,step:0.1}]},
  dev_l_9_20:{label:'Dev Band L 9/20',group:'Dev Bands', colors:['dev_l_9_20_up_fill','dev_l_9_20_up_line','dev_l_9_20_dn_fill','dev_l_9_20_dn_line'], colorLabels:['Upper Fill','Upper Line','Lower Fill','Lower Line'], params:[{key:'fast',label:'Fast',def:9,min:1,max:200},{key:'slow',label:'Slow',def:20,min:1,max:200},{key:'upLow',label:'Up Mult Low',def:2,step:0.1},{key:'upHigh',label:'Up Mult High',def:2.4,step:0.1},{key:'dnLow',label:'Dn Mult Low',def:0.5,step:0.1},{key:'dnHigh',label:'Dn Mult High',def:1,step:0.1}]},
  db_72_89: {label:'Dev Band 72/89',group:'Dev Bands', colors:['db_72_89_up_fill','db_72_89_up_line','db_72_89_dn_fill','db_72_89_dn_line'], colorLabels:['Upper Fill','Upper Line','Lower Fill','Lower Line'], params:[{key:'fast',label:'Fast',def:72,min:1,max:500},{key:'slow',label:'Slow',def:89,min:1,max:500},{key:'upLow',label:'Up Mult Low',def:6.9,step:0.1},{key:'upHigh',label:'Up Mult High',def:9.6,step:0.1},{key:'dnLow',label:'Dn Mult Low',def:6.9,step:0.1},{key:'dnHigh',label:'Dn Mult High',def:9.6,step:0.1}]},
  db_upper: {label:'Dev Upper (Sam)',group:'Dev Bands', colors:['db_upper_fill','db_upper_line'], colorLabels:['Fill','Line'], params:[{key:'ema',label:'EMA Period',def:20,min:1,max:200},{key:'atr',label:'ATR Period',def:20,min:1,max:200},{key:'mult',label:'Multiplier',def:2,step:0.1}]},
  db_low1:  {label:'Dev Low 1 (Sam)',group:'Dev Bands', colors:['db_low1_fill','db_low1_line'], colorLabels:['Fill','Line'], params:[{key:'ema',label:'EMA Period',def:9,min:1,max:200},{key:'atr',label:'ATR Period',def:9,min:1,max:200},{key:'mult',label:'Multiplier',def:2,step:0.1}]},
  db_low2:  {label:'Dev Low 2 (Sam)',group:'Dev Bands', colors:['db_low2_fill','db_low2_line'], colorLabels:['Fill','Line'], params:[{key:'ema',label:'EMA Period',def:20,min:1,max:200},{key:'atr',label:'ATR Period',def:20,min:1,max:200},{key:'mult',label:'Multiplier',def:2,step:0.1}]},
  vwap:     {label:'VWAP',    group:'Overlays', colors:['vwap']},
  vol:      {label:'Volume',  group:'Overlays', colors:['vol_up','vol_dn'], colorLabels:['Up','Down']},
  pdc:      {label:'Prior Day Close',group:'Overlays'},
  pzones:   {label:'Key Levels',group:'Overlays', colors:['pz_sup_fill','pz_sup_line','pz_sup_label','pz_res_fill','pz_res_line','pz_res_label'], colorLabels:['Sup Fill','Sup Line','Sup Label','Res Fill','Res Line','Res Label'], params:[
    {key:'left',label:'Look Left',def:66,min:5,max:200},
    {key:'right',label:'Look Right',def:33,min:1,max:100},
    {key:'nPiv',label:'Max Zones',def:1,min:1,max:20},
    {key:'atrLen',label:'ATR Length',def:66,min:5,max:200},
    {key:'mult',label:'Zone Width x ATR',def:0.6,step:0.1},
    {key:'per',label:'Max Zone %',def:1,step:0.1},
    {key:'maxBoxes',label:'Max Pattern Boxes',def:10,min:1,max:50},
    {key:'offset',label:'Label Offset',def:30,min:0,max:100},
    {key:'showLabels',label:'Show Price Labels',def:1,min:0,max:1,type:'toggle'},
    {key:'lookbackBreaks',label:'Lookback Breaks',def:2,min:1,max:20},
    {key:'swingHL',label:'Swing H/L',def:5,min:1,max:50},
    {key:'sigHL',label:'Significant H/L',def:10,min:1,max:50},
    {key:'considerBar',label:'Consider Bar',def:1,min:1,max:10}
  ]},
  bollinger:{label:'Bollinger Bands',group:'Overlays', colors:['bb_fill','bb_upper','bb_lower'], colorLabels:['Fill','Upper','Lower'], params:[{key:'period',label:'Period',def:20,min:1,max:500},{key:'stddev',label:'Std Dev',def:2,step:0.1}]},
  sma:      {label:'SMA',group:'MA', colors:['sma_color'], params:[{key:'period',label:'Period',def:20,min:1,max:500}]},
  sma_vol:  {label:'Volume SMA',group:'Volume', colors:['vol_sma_color'], params:[{key:'period',label:'Period',def:20,min:1,max:200}]},
  tl:       {label:'Trendlines',group:'Annotations'},
  ann:      {label:'Annotations',group:'Annotations'},
  otherann: {label:'Other Panels\' Ann',group:'Annotations'},
  exec:     {label:'Executions',group:'Annotations'},
  btexec:   {label:'BT Executions',group:'Annotations'},
};

// ════════════════════════════════════════════════════════
//  IND_CATALOG — base indicator definitions for tool instances
//  Each entry defines: params, colors, deps (what EMAs/ATRs to pre-compute),
//  and a render function that handles all drawing for a tool instance.
// ════════════════════════════════════════════════════════
const IND_CATALOG = {

  // ── Single EMA line ──
  ema: {
    label:'EMA', group:'MA',
    params:[{key:'period',label:'Period',def:9,min:1,max:500}],
    colors:[{key:'line',label:'Line',def:'#D4AF37'}],
    deps(p){ return ['ema_'+p.period]; },
    linePass(ctx,data,tool,h){
      const vals=h.calcCache['ema_'+tool.params.period];
      if(!vals)return;
      h.drawLine(vals,tool.colors.line||'#D4AF37',1.7);
    }
  },

  // ── EMA Crossover (two lines) ──
  ema_cross: {
    label:'EMA Crossover', group:'MA',
    params:[{key:'fast',label:'Fast Period',def:40,min:1,max:500},{key:'slow',label:'Slow Period',def:60,min:1,max:500}],
    colors:[{key:'fast_line',label:'Fast Line',def:'#22c55e'},{key:'slow_line',label:'Slow Line',def:'#ef5350'},{key:'fill',label:'Fill',def:'rgba(100,149,237,.06)'}],
    deps(p){ return ['ema_'+p.fast,'ema_'+p.slow]; },
    fillPass(ctx,data,tool,h){
      const fast=h.calcCache['ema_'+tool.params.fast],slow=h.calcCache['ema_'+tool.params.slow];
      if(!fast||!slow)return;
      h.drawBandFill(fast,slow,tool.colors.fill||'rgba(100,149,237,.06)');
    },
    linePass(ctx,data,tool,h){
      const fast=h.calcCache['ema_'+tool.params.fast],slow=h.calcCache['ema_'+tool.params.slow];
      if(!fast||!slow)return;
      h.drawLine(fast,tool.colors.fast_line||'#22c55e',1.4);
      h.drawLine(slow,tool.colors.slow_line||'#ef5350',1.4);
    }
  },

  // ── EMA Band (two EMAs with directional fill) ──
  ema_band: {
    label:'EMA Band', group:'EMA Bands',
    params:[{key:'fast',label:'Fast EMA',def:9,min:1,max:500},{key:'slow',label:'Slow EMA',def:20,min:1,max:500}],
    colors:[{key:'bull_fill',label:'Bull Fill',def:'rgba(34,197,94,.15)'},{key:'bull_line',label:'Bull Line',def:'rgba(34,197,94,.50)'},{key:'bear_fill',label:'Bear Fill',def:'rgba(239,68,68,.15)'},{key:'bear_line',label:'Bear Line',def:'rgba(239,68,68,.50)'}],
    deps(p){ return ['ema_'+p.fast,'ema_'+p.slow]; },
    fillPass(ctx,data,tool,h){
      const fast=h.calcCache['ema_'+tool.params.fast];
      const slow=h.calcCache['ema_'+tool.params.slow];
      if(!fast||!slow)return;
      // Fill only — segment by segment with directional color
      const top=fast,bot=slow;
      let segStart=-1,segDir=null;
      const flush=(endI)=>{
        if(segStart<0)return;
        const clr=segDir==='up'?tool.colors.bull_fill:tool.colors.bear_fill;
        ctx.beginPath();let s=false;
        for(let j=segStart;j<=endI;j++){const aj=h.vs+j;if(top[aj]==null||bot[aj]==null){s=false;continue;}const x=h.xCtr(j),y=h.pToY(top[aj]);if(!s){ctx.moveTo(x,y);s=true;}else ctx.lineTo(x,y);}
        for(let j=endI;j>=segStart;j--){const aj=h.vs+j;if(bot[aj]==null)continue;ctx.lineTo(h.xCtr(j),h.pToY(bot[aj]));}
        ctx.closePath();ctx.fillStyle=clr;ctx.fill();
      };
      for(let i=0;i<h.visible.length;i++){const ai=h.vs+i;if(top[ai]==null||bot[ai]==null){flush(i-1);segStart=-1;segDir=null;continue;}const dir=top[ai]>=bot[ai]?'up':'dn';if(dir!==segDir){flush(i-1);segStart=i;segDir=dir;}else if(segStart<0){segStart=i;segDir=dir;}}
      flush(h.visible.length-1);
    },
    linePass(ctx,data,tool,h){
      const fast=h.calcCache['ema_'+tool.params.fast];
      const slow=h.calcCache['ema_'+tool.params.slow];
      if(!fast||!slow)return;
      const top=fast,bot=slow;
      let segStart=-1,segDir=null;
      const flush=(endI)=>{
        if(segStart<0)return;
        for(const vals of[top,bot]){
          const lc=segDir==='up'?tool.colors.bull_line:tool.colors.bear_line;
          ctx.strokeStyle=lc;ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();let s=false;
          for(let j=segStart;j<=endI;j++){const aj=h.vs+j;if(vals[aj]==null){s=false;continue;}const x=h.xCtr(j),y=h.pToY(vals[aj]);if(!s){ctx.moveTo(x,y);s=true;}else ctx.lineTo(x,y);}
          ctx.stroke();
        }
      };
      for(let i=0;i<h.visible.length;i++){const ai=h.vs+i;if(top[ai]==null||bot[ai]==null){flush(i-1);segStart=-1;segDir=null;continue;}const dir=top[ai]>=bot[ai]?'up':'dn';if(dir!==segDir){flush(i-1);segStart=i;segDir=dir;}else if(segStart<0){segStart=i;segDir=dir;}}
      flush(h.visible.length-1);
    }
  },

  // ── Deviation Band (EMA+ATR dual band with multipliers) ──
  deviation: {
    label:'Deviation Band', group:'Dev Bands',
    params:[{key:'fast',label:'Fast EMA',def:9,min:1,max:200},{key:'slow',label:'Slow EMA',def:20,min:1,max:200},{key:'upLow',label:'Up Mult Low',def:0.5,step:0.1},{key:'upHigh',label:'Up Mult High',def:1,step:0.1},{key:'dnLow',label:'Dn Mult Low',def:2,step:0.1},{key:'dnHigh',label:'Dn Mult High',def:2.4,step:0.1}],
    colors:[{key:'up_fill',label:'Upper Fill',def:'rgba(239,68,68,.15)'},{key:'up_line',label:'Upper Line',def:'rgba(239,68,68,.40)'},{key:'dn_fill',label:'Lower Fill',def:'rgba(34,197,94,.15)'},{key:'dn_line',label:'Lower Line',def:'rgba(34,197,94,.40)'}],
    deps(p){ return ['ema_'+p.fast,'atr_'+p.fast,'ema_'+p.slow,'atr_'+p.slow]; },
    fillPass(ctx,data,tool,h){
      const fe=h.calcCache['ema_'+tool.params.fast],fa=h.calcCache['atr_'+tool.params.fast];
      const se=h.calcCache['ema_'+tool.params.slow],sa=h.calcCache['atr_'+tool.params.slow];
      if(!fe||!fa||!se||!sa)return;
      const up1=fe.map((v,i)=>v+(fa[i]||0)*tool.params.upLow),up2=fe.map((v,i)=>v+(fa[i]||0)*tool.params.upHigh);
      const dn1=se.map((v,i)=>v-(sa[i]||0)*tool.params.dnLow),dn2=se.map((v,i)=>v-(sa[i]||0)*tool.params.dnHigh);
      h.drawBandFill(up1,up2,tool.colors.up_fill); h.drawBandFill(dn1,dn2,tool.colors.dn_fill);
    },
    linePass(ctx,data,tool,h){
      const fe=h.calcCache['ema_'+tool.params.fast],fa=h.calcCache['atr_'+tool.params.fast];
      const se=h.calcCache['ema_'+tool.params.slow],sa=h.calcCache['atr_'+tool.params.slow];
      if(!fe||!fa||!se||!sa)return;
      const up1=fe.map((v,i)=>v+(fa[i]||0)*tool.params.upLow),up2=fe.map((v,i)=>v+(fa[i]||0)*tool.params.upHigh);
      const dn1=se.map((v,i)=>v-(sa[i]||0)*tool.params.dnLow),dn2=se.map((v,i)=>v-(sa[i]||0)*tool.params.dnHigh);
      h.drawBandLines(up1,up2,tool.colors.up_line); h.drawBandLines(dn1,dn2,tool.colors.dn_line);
    }
  },

  // ── Deviation Single (one EMA + ATR band) ──
  deviation_single: {
    label:'Deviation Single', group:'Dev Bands',
    params:[{key:'ema',label:'EMA Period',def:20,min:1,max:200},{key:'atr',label:'ATR Period',def:20,min:1,max:200},{key:'mult',label:'Multiplier',def:2,step:0.1}],
    colors:[{key:'fill',label:'Fill',def:'rgba(200,120,20,.20)'},{key:'line',label:'Line',def:'rgba(220,140,30,.90)'}],
    deps(p){ return ['ema_'+p.ema,'atr_'+p.atr]; },
    fillPass(ctx,data,tool,h){
      const ema=h.calcCache['ema_'+tool.params.ema],atr=h.calcCache['atr_'+tool.params.atr];
      if(!ema||!atr)return;
      const m=tool.params.mult;
      h.drawBandFill(ema.map((v,i)=>v+(atr[i]||0)*m),ema.map((v,i)=>v+(atr[i]||0)*(m*0.5)),tool.colors.fill);
    },
    linePass(ctx,data,tool,h){
      const ema=h.calcCache['ema_'+tool.params.ema],atr=h.calcCache['atr_'+tool.params.atr];
      if(!ema||!atr)return;
      const m=tool.params.mult;
      h.drawBandLines(ema.map((v,i)=>v+(atr[i]||0)*m),ema.map((v,i)=>v+(atr[i]||0)*(m*0.5)),tool.colors.line);
    }
  },

  // ── Bollinger Bands ──
  bollinger: {
    label:'Bollinger Bands', group:'Overlays',
    params:[{key:'period',label:'Period',def:20,min:1,max:500},{key:'stddev',label:'Std Dev',def:2,step:0.1}],
    colors:[{key:'fill',label:'Fill',def:'rgba(100,149,237,.08)'},{key:'upper',label:'Upper',def:'rgba(100,149,237,.40)'},{key:'lower',label:'Lower',def:'rgba(100,149,237,.40)'}],
    deps(){ return []; },
    fillPass(ctx,data,tool,h){
      const bb=calcBollinger(data,tool.params.period||20,tool.params.stddev||2);
      h.drawBandFill(bb.upper,bb.lower,tool.colors.fill||'rgba(100,149,237,.08)');
    },
    linePass(ctx,data,tool,h){
      const bb=calcBollinger(data,tool.params.period||20,tool.params.stddev||2);
      h.drawBandLines(bb.upper,bb.lower,tool.colors.upper||'rgba(100,149,237,.40)');
      h.drawLine(bb.middle,tool.colors.upper||'rgba(100,149,237,.40)',1);
    }
  },

  // ── SMA ──
  sma: {
    label:'SMA', group:'MA',
    params:[{key:'period',label:'Period',def:20,min:1,max:500}],
    colors:[{key:'line',label:'Line',def:'#5a9ae6'}],
    deps(){ return []; },
    linePass(ctx,data,tool,h){
      const vals=calcSMA(data,tool.params.period||20);
      h.drawLine(vals,tool.colors.line||'#5a9ae6',1.4);
    }
  },

  // ── VWAP ──
  vwap: {
    label:'VWAP', group:'Overlays',
    params:[],
    colors:[{key:'line',label:'Line',def:'#00e676'}],
    deps(){ return []; },
    linePass(ctx,data,tool,h){
      const vals=calcVWAP(data,h.isIntraday);
      h.drawLine(vals,tool.colors.line||'#00e676',1.8);
    }
  },

  // ── Volume ──
  vol: {
    label:'Volume', group:'Volume',
    params:[{key:'sma_len',label:'Volume SMA (0=off)',def:0,min:0,max:200}],
    colors:[{key:'up',label:'Up Volume',def:'rgba(38,166,154,.5)'},{key:'dn',label:'Down Volume',def:'rgba(239,83,80,.5)'},{key:'sma_line',label:'SMA Line',def:'#D4AF37'}],
    deps(){ return []; },
    // Volume is special — rendered by the candle pass, not tool loop
    // This entry exists so the settings UI works and tools can reference it
    render(){ /* handled inline in volume pass */ }
  },

  // ── Volume SMA ──
  sma_vol: {
    label:'Volume SMA', group:'Volume',
    params:[{key:'period',label:'Period',def:20,min:1,max:200}],
    colors:[{key:'line',label:'Line',def:'#D4AF37'}],
    deps(){ return []; },
    render(){ /* handled inline in volume pass */ }
  },

  // ── Prior Day Close ──
  pdc: {
    label:'Prior Day Close', group:'Overlays',
    params:[],
    colors:[{key:'line',label:'Line',def:'#787878'}],
    deps(){ return []; },
    render(){ /* handled inline */ }
  },

  // ── Key Levels (Bjorgum-style zones) ──
  pzones: {
    label:'Key Levels', group:'Overlays',
    params:[
      {key:'left',label:'Look Left',def:66,min:5,max:200},
      {key:'right',label:'Look Right',def:33,min:1,max:100},
      {key:'nPiv',label:'Max Zones',def:1,min:1,max:20},
      {key:'atrLen',label:'ATR Length',def:66,min:5,max:200},
      {key:'mult',label:'Zone Width x ATR',def:0.6,step:0.1},
      {key:'per',label:'Max Zone %',def:1,step:0.1},
      {key:'maxBoxes',label:'Max Pattern Boxes',def:10,min:1,max:50},
      {key:'offset',label:'Label Offset',def:30,min:0,max:100},
      {key:'showLabels',label:'Show Price Labels',def:1,min:0,max:1,type:'toggle'},
      {key:'lookbackBreaks',label:'Lookback Breaks',def:2,min:1,max:20},
      {key:'swingHL',label:'Swing H/L',def:5,min:1,max:50},
      {key:'sigHL',label:'Significant H/L',def:10,min:1,max:50},
      {key:'considerBar',label:'Consider Bar',def:1,min:1,max:10}
    ],
    colors:[
      {key:'sup_fill',label:'Support Fill',def:'rgba(34,197,94,.08)'},
      {key:'sup_line',label:'Support Line',def:'rgba(34,197,94,.35)'},
      {key:'sup_label',label:'Support Label',def:'#26a69a'},
      {key:'res_fill',label:'Resistance Fill',def:'rgba(239,68,68,.08)'},
      {key:'res_line',label:'Resistance Line',def:'rgba(239,68,68,.35)'},
      {key:'res_label',label:'Resistance Label',def:'#ef5350'}
    ],
    deps(){ return []; },
    render(){ /* handled inline */ }
  }

};

// Per-preset indicator customizations (colors, params) — saved to localStorage
const PRESET_IND_KEY = 'traderra-preset-ind';
let presetIndCustoms = JSON.parse(localStorage.getItem(PRESET_IND_KEY)||'{}');

// ════════════════════════════════════════════════════════
//  TOOL INSTANCE SYSTEM
//  p.tools = [{id, indKey, name, on, params, colors}, ...]
//  p.inds derived from p.tools for backward compat
// ════════════════════════════════════════════════════════
let _toolId = Date.now();
function newToolId(){ return 't'+(++_toolId); }

// Derive p.inds boolean map from p.tools array
function deriveInds(tools){
  const inds = {};
  if(tools) tools.forEach(t => {
    if(!t.on) return;
    // Set legacy keys so legacy rendering still works
    if(t.legacyKeys) t.legacyKeys.forEach(k => inds[k]=true);
    else inds[t.indKey] = true; // fallback for new-style tools
  });
  // Always-ON indicators (not tool-instanceable)
  inds.tl = true; inds.ann = true; inds.otherann = true; inds.exec = true; inds.btexec = true;
  return inds;
}

// Gather params for a tool instance (defaults from catalog + overrides)
function toolParams(tool){
  const cat = IND_CATALOG[tool.indKey] || IND_REGISTRY[tool.indKey];
  if(!cat || !cat.params) return {};
  const p = {};
  cat.params.forEach(prm => { p[prm.key] = tool.params?.[prm.key] ?? prm.def; });
  return p;
}

// Gather colors for a tool instance (defaults from catalog + overrides)
function toolColors(tool){
  const cat = IND_CATALOG[tool.indKey] || IND_REGISTRY[tool.indKey];
  if(!cat || !cat.colors) return {};
  const c = {};
  cat.colors.forEach((clr,i) => {
    const key = clr.key;
    c[key] = tool.colors?.[key] ?? (cat.colorDefaults?.[i]) ?? clr.def;
  });
  return c;
}

// Migrate legacy p.inds (boolean map) → p.tools (instance array)
function migrateIndsToTools(p){
  if(p.tools && p.tools.length) return; // already migrated
  p.tools = [];
  // Map legacy IND_REGISTRY keys to catalog keys + default params
  const legacyMap = {
    ema9:       {indKey:'ema', legacyKeys:['ema9'], params:{period:9}},
    ema20:      {indKey:'ema', legacyKeys:['ema20'], params:{period:20}},
    ema50:      {indKey:'ema', legacyKeys:['ema50'], params:{period:50}},
    ema150:     {indKey:'ema', legacyKeys:['ema150'], params:{period:150}},
    ema200:     {indKey:'ema', legacyKeys:['ema200'], params:{period:200}},
    ema40_60:   {indKey:'ema_cross', legacyKeys:['ema40_60'], params:{fast:40,slow:60}},
    band_9_20:  {indKey:'ema_band', legacyKeys:['band_9_20'], params:{fast:9,slow:20}},
    band_72_89: {indKey:'ema_band', legacyKeys:['band_72_89'], params:{fast:72,slow:89}},
    dev_s_9_20: {indKey:'deviation', legacyKeys:['dev_s_9_20'], params:{fast:9,slow:20,upLow:0.5,upHigh:1,dnLow:2,dnHigh:2.4}},
    dev_l_9_20: {indKey:'deviation', legacyKeys:['dev_l_9_20'], params:{fast:9,slow:20,upLow:2,upHigh:2.4,dnLow:0.5,dnHigh:1}},
    db_72_89:   {indKey:'deviation', legacyKeys:['db_72_89'], params:{fast:72,slow:89,upLow:6.9,upHigh:9.6,dnLow:6.9,dnHigh:9.6}},
    db_upper:   {indKey:'deviation_single', legacyKeys:['db_upper'], params:{ema:20,atr:20,mult:2}},
    db_low1:    {indKey:'deviation_single', legacyKeys:['db_low1'], params:{ema:9,atr:9,mult:2}},
    db_low2:    {indKey:'deviation_single', legacyKeys:['db_low2'], params:{ema:20,atr:20,mult:2.5}},
    vwap:       {indKey:'vwap', legacyKeys:['vwap'], params:{}},
    vol:        {indKey:'vol', legacyKeys:['vol'], params:{}},
    sma_vol:    {indKey:'sma_vol', legacyKeys:['sma_vol'], params:{period:20}},
    pdc:        {indKey:'pdc', legacyKeys:['pdc'], params:{}},
    pzones:     {indKey:'pzones', legacyKeys:['pzones'], params:{}},
    bollinger:  {indKey:'bollinger', legacyKeys:['bollinger'], params:{period:20,stddev:2}},
    sma:        {indKey:'sma', legacyKeys:['sma'], params:{period:20}},
  };
  for(let key in p.inds){
    const isOn = !!p.inds[key];
    const map = legacyMap[key];
    if(!map) continue; // skip tl, ann, exec etc
    const reg = IND_REGISTRY[key];
    const cat = IND_CATALOG[map.indKey];
    // Gather saved custom params from legacy system
    const savedParams = {};
    if(reg && reg.params) reg.params.forEach(prm => {
      const v = getIndCustom(key,'params',prm.key);
      if(v != null) savedParams[prm.key] = v;
    });
    const savedColors = {};
    if(reg && reg.colors) reg.colors.forEach(ck => {
      const v = getIndCustom(key,'colors',ck);
      if(v) savedColors[ck] = v;
    });
    p.tools.push({
      id: newToolId(),
      indKey: map.indKey,
      legacyKeys: map.legacyKeys,
      name: reg ? reg.label : key,
      on: isOn,
      params: {...map.params, ...savedParams},
      colors: savedColors,
      hot: isOn,
      hotLabel: reg ? reg.label : key,
      hotColor: '#D4AF37'
    });
  }
  // Derive p.inds from tools
  Object.assign(p.inds, deriveInds(p.tools));
}

// Create a new tool instance from a catalog entry
function createTool(indKey, name, params, colors){
  const cat = IND_CATALOG[indKey];
  if(!cat) return null;
  const defParams = {};
  cat.params.forEach(p => defParams[p.key] = p.def);
  const defColors = {};
  cat.colors.forEach(c => defColors[c.key] = c.def);
  // Generate a unique legacy key for new tools (e.g. 'ema_band_1234')
  const legacyKey = indKey + '_' + Date.now().toString(36);
  return {
    id: newToolId(),
    indKey,
    legacyKeys: [legacyKey],
    name: name || cat.label,
    on: true,
    params: {...defParams, ...params},
    colors: {...defColors, ...colors},
    hot: true,
    hotLabel: name || cat.label,
    hotColor: '#D4AF37'
  };
}

// Add a tool to a panel, return the tool
// Save tools to localStorage
function saveTools(){
  const data = panels.map(p => p.tools || []);
  localStorage.setItem(TOOLS_KEY, JSON.stringify(data));
  if(typeof CloudStore!=='undefined') CloudStore.save('tools');
}

function addTool(panelIdx, indKey, params, colors, name){
  const p = panels[panelIdx];
  if(!p) return;
  if(!p.tools) p.tools = [];
  const tool = createTool(indKey, name, params, colors);
  p.tools.push(tool);
  p.inds = deriveInds(p.tools);
  return tool;
}

// Remove a tool from a panel by ID
function removeTool(panelIdx, toolId){
  const p = panels[panelIdx];
  if(!p || !p.tools) return;
  p.tools = p.tools.filter(t => t.id !== toolId);
  p.inds = deriveInds(p.tools);
}

// Toggle a tool on/off
function toggleTool(panelIdx, toolId){
  const p = panels[panelIdx];
  if(!p || !p.tools) return;
  const t = p.tools.find(t => t.id === toolId);
  if(t) t.on = !t.on;
  p.inds = deriveInds(p.tools);
}

// Get color for an indicator in current preset (custom or default)
function getIndColor(indKey, colorIdx){
  const reg = IND_REGISTRY[indKey];
  if(!reg || !reg.colors) return null;
  const colorKey = reg.colors[colorIdx||0];
  const custom = presetIndCustoms[activePreset]?.[indKey]?.colors?.[colorKey];
  return custom || C[colorKey];
}
// Convert rgba/hex to hex for color inputs
function colorToHex(c){
  if(!c||typeof c!=='string')return '#ffffff';
  if(c.startsWith('#'))return c.length>7?c.slice(0,7):c;
  var m=c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if(m)return '#'+(1<<24|(+m[1])<<16|(+m[2])<<8|(+m[3])).toString(16).slice(1);
  return '#ffffff';
}
// Apply a hex color back to the right format (preserves alpha)
function hexToColor(hex, original){
  if(!original||typeof original!=='string')return hex;
  var m=original.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  if(m){
    var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+m[4]+')';
  }
  return hex;
}
// Save per-preset indicator customization
function saveIndCustom(indKey, type, key, value){
  if(!presetIndCustoms[activePreset]) presetIndCustoms[activePreset]={};
  if(!presetIndCustoms[activePreset][indKey]) presetIndCustoms[activePreset][indKey]={};
  if(!presetIndCustoms[activePreset][indKey][type]) presetIndCustoms[activePreset][indKey][type]={};
  presetIndCustoms[activePreset][indKey][type][key]=value;
  localStorage.setItem(PRESET_IND_KEY, JSON.stringify(presetIndCustoms));
}
function getIndCustom(indKey, type, key){
  return presetIndCustoms[activePreset]?.[indKey]?.[type]?.[key];
}

// ═══ TOOLSET PRESETS ═══
const PRESET_KEY='traderra-preset';
const TOOLS_KEY='traderra-tools';
let activePreset='Mike';
const PRESETS={
Sam:{
  name:'Sam',
  inds: tf=>tf==='D'
    ?{ema9:true,ema20:true,ema50:false,ema200:false,db_upper:false,db_low1:false,db_low2:false,vol:true,vwap:false,ema40_60:false,ema150:false,band_9_20:false,band_72_89:false,dev_s_9_20:false,dev_l_9_20:false,db_72_89:false,pzones:false,bollinger:false,sma:false,sma_vol:false}
    :{ema9:true,ema20:true,ema50:true,ema200:true,db_upper:false,db_low1:false,db_low2:false,vol:true,vwap:true,ema40_60:false,ema150:false,band_9_20:false,band_72_89:false,dev_s_9_20:false,dev_l_9_20:false,db_72_89:false,pzones:false,bollinger:false,sma:false,sma_vol:false},
},
Mike:{
  name:'Mike',
  inds: tf=>tf==='D'
    ?{ema9:false,ema20:false,ema50:false,ema200:false,db_upper:false,db_low1:false,db_low2:false,vol:true,vwap:true,ema40_60:false,ema150:false,band_9_20:true,band_72_89:true,dev_s_9_20:true,dev_l_9_20:false,db_72_89:true,pzones:true,bollinger:false,sma:false,sma_vol:false}
    :{ema9:false,ema20:false,ema50:false,ema200:false,db_upper:false,db_low1:false,db_low2:false,vol:true,vwap:true,ema40_60:false,ema150:false,band_9_20:true,band_72_89:true,dev_s_9_20:true,dev_l_9_20:false,db_72_89:true,pzones:true,bollinger:false,sma:false,sma_vol:false},
  dev:{
    s_9_20:{fast:9,slow:20,up:[0.5,1],dn:[2,2.4]},
    l_9_20:{fast:9,slow:20,up:[2,2.4],dn:[0.5,1]},
    db_72_89:{fast:72,slow:89,up:[6.9,9.6],dn:[6.9,9.6]},
  },
  pz:{left:66,right:33,nPiv:1,atrLen:66,mult:0.6,per:1,maxBoxes:10,offset:30,showLabels:0,lookbackBreaks:2,swingHL:5,sigHL:10,considerBar:1},
}
};

function updatePresetButtons(){
  document.querySelectorAll('.preset-btn').forEach(function(b){
    b.classList.toggle('active',b.dataset.preset===activePreset);
  });
}
function loadPreset(name){
  activePreset=name;
  const pr=PRESETS[name];
  if(!pr) return;
  panels.forEach((p,i)=>{
    p.inds=Object.assign({},pr.inds(p.tf));
    p.tools=[]; // reset tools for fresh migration
  });
  localStorage.setItem(PRESET_KEY,name);
  if(name==='Mike'&&panels[0]) panels[0].tf='15';
  else if(name==='Sam'&&panels[0]) panels[0].tf='5';
  // Set default chart style per preset
  if(name==='Mike') setChartStyle('hollow');
  else if(name==='Sam') setChartStyle('candles');
  panels.forEach(p=>migrateIndsToTools(p));
  updatePresetButtons();
  panels.forEach((_,i)=>buildIndicatorRow(i));
  if(name==='Sam') setLayout(4);
  else if(name==='Mike') setLayout(1);
  loadAll();
  renderAll();
}

// ══════════════════════════════════════════════════════════
//  GLOBAL STATE
// ══════════════════════════════════════════════════════════
let symbol=(function(){try{var s=localStorage.getItem('traderra-symbol');if(s&&s.trim())return s.trim().toUpperCase();}catch(e){}try{var d=JSON.parse(localStorage.getItem('traderra-watchlists'));if(d&&d.lists&&d.lists[0]&&d.lists[0].syms&&d.lists[0].syms[0])return d.lists[0].syms[0].toUpperCase();}catch(e){}return'AAPL';})(), activeTool=null, toolStep=null, toolAnchor=null;
function setSymbol(s){symbol=s;try{localStorage.setItem('traderra-symbol',s);}catch(e){}loadAnnotations();}
let selectedAnn=null, draggingAnn=null, dragOffset={dx:0,dy:0};
// Drawing defaults — persist across annotations, saved to localStorage
var drawDefaults=(function(){try{var d=JSON.parse(localStorage.getItem('traderra-draw-defaults'));if(d)return d;}catch(e){}return{color:'#dde3f0',lineWidth:2,dashed:false,opacity:1};})();
const FIB_DEFAULT_LEVELS=[
  {value:0,enabled:true},{value:23.6,enabled:true},{value:38.2,enabled:true},
  {value:50,enabled:true},{value:61.8,enabled:true},{value:78.6,enabled:true},{value:100,enabled:true},
];
const GANN_BOX_RATIOS=[1/8,1/4,3/8,1/2,5/8,3/4,7/8];
function cloneFibLevels(levels){
  const src=Array.isArray(levels)&&levels.length?levels:FIB_DEFAULT_LEVELS;
  return src.map(function(l){
    var value=l&&l.value!=null?parseFloat(l.value):parseFloat(l&&l.pct!=null?l.pct*100:0);
    return {value:isFinite(value)?value:0,enabled:l&&l.enabled!==false};
  });
}
function ensureFibSettings(ann){
  if(!ann.fibLevels) ann.fibLevels=cloneFibLevels();
  if(!ann.levelColor) ann.levelColor=ann.color||'#a78bfa';
  if(ann.lineStyle==null) ann.lineStyle=ann.dashed||false;
}
function ensurePositionSettings(ann){
  if(ann.type==='long_pos'){
    if(!ann.entryColor) ann.entryColor='#26a69a';
    if(!ann.tpColor) ann.tpColor='#4ade80';
    if(!ann.stopColor) ann.stopColor='#ef5350';
    if(!ann.fillColor) ann.fillColor='rgba(38,166,154,0.12)';
  } else if(ann.type==='short_pos'){
    if(!ann.entryColor) ann.entryColor='#ef5350';
    if(!ann.tpColor) ann.tpColor='#f97316';
    if(!ann.stopColor) ann.stopColor='#26a69a';
    if(!ann.fillColor) ann.fillColor='rgba(239,83,80,0.12)';
  }
}
function saveDrawDefaults(){try{localStorage.setItem('traderra-draw-defaults',JSON.stringify(drawDefaults));}catch(e){} if(typeof CloudStore!=='undefined') CloudStore.save('settings');}
function applyDrawDefaults(ann){
  ann.color=ann.color||drawDefaults.color||'#dde3f0';
  if(drawDefaults.lineWidth&&ann.lineWidth==null)ann.lineWidth=drawDefaults.lineWidth;
  if(ann.dashed==null)ann.dashed=drawDefaults.dashed||false;
  if(drawDefaults.opacity!=null&&drawDefaults.opacity!==1&&ann.opacity==null)ann.opacity=drawDefaults.opacity;
  if(ann.type==='fib_ret') ensureFibSettings(ann);
  if(ann.type==='long_pos'||ann.type==='short_pos') ensurePositionSettings(ann);
  if(ann.type==='brush'&&ann.lineWidth==null) ann.lineWidth=3;
  if(ann.type.startsWith('hl_')&&Array.isArray(ann.points)){
    if(ann.opacity==null) ann.opacity=Math.min(drawDefaults.opacity!=null?drawDefaults.opacity:0.35,0.55);
    if(ann.lineWidth==null) ann.lineWidth=28;
  }
}
let fullscreenPanel=null, pendingText=null, pendingExec=null, freehandState=null;
let annotations=[], nextId=1;
// Load persisted annotations for current symbol
function annStorageKey(){return 'traderra-annotations-'+symbol;}
function loadAnnotations(){
  annotations=[]; nextId=1;
  try{
    var saved=JSON.parse(localStorage.getItem(annStorageKey())||'null');
    if(saved&&saved.anns){
      annotations=saved.anns;
      nextId=saved.nextId||annotations.length+1;
    }
  }catch(e){}
}
function saveAnnotations(){
  try{localStorage.setItem(annStorageKey(),JSON.stringify({anns:annotations,nextId:nextId}));}catch(e){}
  if(typeof CloudStore!=='undefined') CloudStore.save('annotations');
}
loadAnnotations();
let liveMode=true;  // Enable live updates by default
let showPriceLine=true;
let barsVisible=true;  // toggle toolbar rows

// ── BACKTEST STATE ──
let btTrades=[];
let btActive=false;
let btSelected=null;
let btMarkers=[];
let btStrategyMode='short'; // 'long' or 'short' — default short
let btHighlightDates=true;  // highlight trade dates on chart background

let useAdjusted=true; // ADJ/UNADJ toggle
let globalCrossTime=-1; // shared crosshair timestamp across panels
let globalCrossPrice=-1; // shared crosshair price across panels
let cleanPrints=true; // filter suspicious bars (ON by default)

const panels = PANEL_DEFAULTS.map((d,i)=>({
  idx:i, tf:d.tf,
  startDate:null, endDate:null,
  data:[],
  viewStart:0, viewBars:defaultViewBars(d.tf),
  W:0, H:0, PRICE_W:72, TIME_H:20,
  volFrac:VOL_FRAC_DEFAULT,  // per-panel volume height fraction (draggable)
  priceScale:1.0,           // per-panel price Y scale multiplier (1.0=default, >1=zoomed in)
  canvas:null, ctx:null,
  dragging:false, dragStartX:0, dragViewStart:0,
  sbDragging:false, sbDragStartX:0, sbDragViewStart:0,
  cx:-1, cy:-1,
  mouseDown:false, mouseDownX:0, mouseDownY:0, mouseDownTime:0,
  inds: Object.assign({},
    PRESETS[activePreset]?.inds(d.tf) || (d.tf==='D'
      ?{ema9:true,ema20:true,ema50:false,ema200:false,db_upper:false,db_low1:false,db_low2:false,vol:true,vwap:false,ema40_60:false,ema150:false,
        band_9_20:false,band_72_89:false,dev_s_9_20:false,dev_l_9_20:false,db_72_89:false,pzones:false,bollinger:false,sma:false,sma_vol:false}
      :{ema9:true,ema20:true,ema50:true,ema200:true,db_upper:false,db_low1:false,db_low2:false,vol:true,vwap:true,ema40_60:false,ema150:false,
        band_9_20:false,band_72_89:false,dev_s_9_20:false,dev_l_9_20:false,db_72_89:false,pzones:false,bollinger:false,sma:false,sma_vol:false}
     )),
  showTL:true, showAnn:true, showExec:true, showBtExec:true,
  btBack:null, btFwd:null,   // custom BT lookback/forward (null=use defaults)
  showOtherAnn:true,         // show annotations drawn on OTHER panels
  showPDC:true,               // prior-day close line
  adjusted:true,              // per-panel adj toggle (defaults to global)
}));

// Load saved preset + tools
try{
  const sp=localStorage.getItem(PRESET_KEY);
  if(sp&&PRESETS[sp]){activePreset=sp;panels.forEach((p)=>{p.inds=Object.assign({},PRESETS[sp].inds(p.tf));});}
  else{panels.forEach(p=>{p.inds=Object.assign({},PRESETS[activePreset].inds(p.tf));});}
  // Restore saved tools from localStorage if they exist
  const savedTools=JSON.parse(localStorage.getItem(TOOLS_KEY)||'null');
  if(savedTools){
    panels.forEach((p,i)=>{
      if(savedTools[i]&&savedTools[i].length){
        p.tools=savedTools[i];
        // One-time migration: set hot defaults for tools missing them
        p.tools.forEach(function(t){
          if(t.on && !t.hot && !HOT_EXCLUDE[t.indKey]){
            const cat=IND_CATALOG[t.indKey]||IND_REGISTRY[t.indKey];
            t.hot=true;
            if(!t.hotLabel) t.hotLabel=t.name||(cat?.label)||t.indKey||'TOOL';
            if(!t.hotColor) t.hotColor='#D4AF37';
          }
          // Force OFF system tools that should never be hot
          if(HOT_EXCLUDE[t.indKey]) t.hot=false;
        });
        p.inds=deriveInds(p.tools);
      }
      else migrateIndsToTools(p);
    });
  } else {
    panels.forEach(p=>migrateIndsToTools(p));
  }
  panels.forEach((_,i)=>buildIndicatorRow(i));
}catch(e){console.error('load error',e);}

// ══════════════════════════════════════════════════════════
//  TIME / FORMAT HELPERS
// ══════════════════════════════════════════════════════════
function fmtDate(d){
  // Always use UTC to match Polygon timestamps (prevents timezone shift)
  return`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
function defaultRange(tf){
  const to=new Date(),from=new Date();
  // Default visible range (what the user sees on screen)
  // Warmup is handled SEPARATELY in loadPanel via warmupDaysForTF()
  const viewDays={
    '1':2,'2':2,
    '5':5,'10':5,'15':10,'30':15,'60':40,
    '240':120,
    'D':180,'W':365,'M':1825
  }[tf]||31;
  from.setUTCDate(from.getUTCDate()-viewDays);
  return{from:fmtDate(from),to:fmtDate(to)};
}
// Per-TF default viewBars (how many candles visible on screen)
function defaultViewBars(tf){
  return{
    '1':390,'2':390,       // 1m/2m: ~1 trading day (390 min)
    '5':156,'10':156,      // 5m/10m: ~2 days
    '15':156,'30':78,       // 15m: ~6 days, 30m: ~5 days
    '60':78,               // 1h: ~20 trading days
    '240':60,              // 4h: ~60 days
    'D':130,               // Daily: ~180 days
    'W':52,                // Weekly: ~1 year
    'M':60                 // Monthly: ~5 years
  }[tf]||80;
}
// Extra calendar days to fetch BEFORE visible range for indicator convergence.
// ~400 bars warmup covers EMA89 (~267 bars) + Key Levels (left=66 + ATR=66 = 132).
// Calendar days include ~29% weekends/holidays so we pad generously.
function warmupDaysForTF(tf){
  return{
    '1':5,'2':5,           // ~1950 bars ✓
    '5':10,                // ~780 bars ✓
    '10':18,'15':25,       // ~702, ~650 bars ✓
    '30':45,'60':85,       // ~585, ~553 bars ✓
    '240':350,             // ~560 bars ✓
    'D':500,'W':3000,'M':12000 // ~357d, ~428w, ~400mo ✓
  }[tf]||60;
}
function liveRange(tf){
  const to=new Date(),from=new Date();
  // Per-TF lookbacks as requested
  // Live mode visible range — warmup handled by loadPanel via warmupDaysForTF()
  const daysBack={
    '1':2,'2':2,
    '5':5,'15':10,'30':15,'60':40,
    '240':120,
    'D':180,'W':365*2,'M':365*5,
  }[tf]||31;
  from.setUTCDate(from.getUTCDate()-daysBack);
  return{from:fmtDate(from),to:fmtDate(to)};
}
function tfToPolygon(tf){
  if(tf==='D') return{mul:1,ts:'day'};
  if(tf==='W') return{mul:1,ts:'week'};
  if(tf==='M') return{mul:1,ts:'month'};
  return{mul:parseInt(tf),ts:'minute'};
}
function isIntraday(tf){return tf!=='D'&&tf!=='W'&&tf!=='M';}
// Convert any bar timestamp (unix number OR "YYYY-MM-DD" string) to Unix seconds
function toUnix(t){
  if(typeof t==='number') return t;
  if(typeof t==='string'&&t.match(/^\d{4}-\d{2}-\d{2}$/))
    return Date.UTC(+t.slice(0,4),+t.slice(5,7)-1,+t.slice(8,10))/1000;
  const n=Number(t); return isNaN(n)?0:n;
}
function fmtPrice(v){
  if(v==null) return'';
  return v>=10000?v.toFixed(0):v.toFixed(2);
}
function fmtVol(v){
  if(v==null||v===0) return'—';
  if(v>=1e9) return(v/1e9).toFixed(2)+'B';
  if(v>=1e6) return(v/1e6).toFixed(2)+'M';
  if(v>=1e3) return(v/1e3).toFixed(1)+'K';
  return v.toFixed(0);
}

const _nyFmt=new Intl.DateTimeFormat('en-US',{
  timeZone:'America/New_York',year:'numeric',month:'2-digit',
  day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false
});
function getNY(ts){
  if(typeof ts!=='number') return{year:0,month:0,day:0,hour:0,minute:0};
  const p={};
  for(const{type,value} of _nyFmt.formatToParts(new Date(ts*1000))) p[type]=parseInt(value,10);
  if(p.hour===24) p.hour=0;
  return p;
}
function nyMins(ts){const{hour,minute}=getNY(ts);return hour*60+minute;}
function getSession(ts){
  const m=nyMins(ts);
  if(m>=PRE_START&&m<MKTOPEN) return'pre';
  if(m>=MKTOPEN&&m<MKTCLOSE) return'regular';
  if(m>=MKTCLOSE&&m<POST_END) return'after';
  return null;
}
function fmtTimeAxis(ts,tf){
  if(!isIntraday(tf)){const[y,m,d]=String(ts).split('-');return`${m}/${d}/${y.slice(2)}`;}
  const{hour,minute}=getNY(ts);
  return`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}
function fmtTimeCross(ts,tf){
  if(!isIntraday(tf)){const[y,m,d]=String(ts).split('-');return`${m}/${d}/${y}`;}
  const{year,month,day,hour,minute}=getNY(ts);
  return`${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}/${year} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} ET`;
}

// ══════════════════════════════════════════════════════════
//  INDICATORS
// ══════════════════════════════════════════════════════════
function calcEMA(data,period){
  const k=2/(period+1); let ema=null; const out=[];
  for(const b of data){ema=ema===null?b.close:b.close*k+ema*(1-k);out.push(ema);}
  return out;
}
function calcSMA(data,period){
  const out=[]; let sum=0;
  for(let i=0;i<data.length;i++){
    sum+=data[i].close;
    if(i>=period) sum-=data[i-period].close;
    out.push(i>=period-1?sum/period:null);
  }
  return out;
}
function calcBollinger(data,period,mult){
  const sma=calcSMA(data,period);
  const upper=[],lower=[];
  for(let i=0;i<data.length;i++){
    if(sma[i]===null){upper.push(null);lower.push(null);continue;}
    let sumSq=0;
    for(let j=i-period+1;j<=i;j++) sumSq+=(data[j].close-sma[i])*(data[j].close-sma[i]);
    const std=Math.sqrt(sumSq/period);
    upper.push(sma[i]+std*mult);
    lower.push(sma[i]-std*mult);
  }
  return {upper,middle:sma,lower};
}
function calcVolSMA(data,period){
  const out=[]; let sum=0;
  for(let i=0;i<data.length;i++){
    sum+=data[i].volume||0;
    if(i>=period) sum-=(data[i-period].volume||0);
    out.push(i>=period-1?sum/period:null);
  }
  return out;
}

function calcVWAP(data, intraday){
  // For intraday: reset each calendar day. For daily+: cumulative from data start.
  const out=[];
  let cumPV=0, cumV=0, lastDay=null;
  for(let i=0;i<data.length;i++){
    const b=data[i];
    const day=intraday?new Date(b.time*1000).toISOString().slice(0,10):null;
    if(intraday && day!==lastDay){cumPV=0;cumV=0;lastDay=day;}
    const tp=(b.high+b.low+b.close)/3;
    cumPV+=tp*(b.volume||0);
    cumV+=(b.volume||0);
    out.push(cumV>0?cumPV/cumV:tp);
  }
  return out;
}

// ═══ KEY LEVELS (Bjorgum-style Pivot Zones) ═══
// Faithful port of Bjorgum Key Levels Pine Script indicator
// Uses HA body pivots, ATR zone width, rolling array of nPiv zones,
// color flips when price breaks through zone boundaries
function calcKeyLevels(data,params){
  if(!data||data.length<100) return [];
  const p=params||{};
  const left=p.left||66, right=p.right||33, nPiv=p.nPiv||1;
  const atrLen=p.atrLen||66, mult=p.mult||0.6, per=p.per||1;
  const lookbackBreaks=p.lookbackBreaks||2;
  const swingHL=p.swingHL||5, sigHL=p.sigHL||10, considerBar=p.considerBar||1;

  // Result array: zones with per-bar color tracking
  // Each zone: {idx, top, bottom, type:'high'|'low', colors:[]}
  // colors[i] = true (green/support) or false (red/resistance) at bar i

  // 1. Heikin-Ashi candles
  const ha=[];
  for(let i=0;i<data.length;i++){
    const b=data[i];
    if(i===0){ha.push({o:b.open,h:b.high,l:b.low,c:b.close});continue;}
    const prev=ha[i-1];
    const haC=(b.open+b.high+b.low+b.close)/4;
    const haO=(prev.o+prev.c)/2;
    ha.push({o:haO,h:Math.max(b.high,haO,haC),l:Math.min(b.low,haO,haC),c:haC});
  }

  // 2. ATR (SMA of true range)
  const atr=new Array(data.length).fill(0);
  for(let i=atrLen;i<data.length;i++){
    let sum=0;
    for(let j=i-atrLen+1;j<=i;j++){
      const tr=Math.max(data[j].high-data[j].low,
        Math.abs(data[j].high-(data[j-1]?data[j-1].close:data[j].open)),
        Math.abs(data[j].low-(data[j-1]?data[j-1].close:data[j].open)));
      sum+=tr;
    }
    atr[i]=sum/atrLen;
  }

  // 3. Source: HA body highs/lows (like Pine: hiHaBod, loHaBod)
  const srcH=[], srcL=[];
  for(let i=0;i<data.length;i++){
    srcH[i]=ha[i].h;  // HA high (with wicks)
    srcL[i]=ha[i].l;   // HA low (with wicks)
  }

  // 4. Find ALL pivots (ta.pivothigh/ta.pivotlow equivalent)
  const pivH=new Array(data.length).fill(null);
  const pivL=new Array(data.length).fill(null);
  for(let i=left;i<data.length-right;i++){
    // Check pivot high: srcH[i] must be highest in [i-left, i+right]
    let isHigh=true;
    for(let j=i-left;j<i;j++) if(srcH[j]>=srcH[i]){isHigh=false;break;}
    if(isHigh) for(let j=i+1;j<=i+right;j++) if(srcH[j]>=srcH[i]){isHigh=false;break;}
    if(isHigh) pivH[i]=srcH[i];
    // Check pivot low: srcL[i] must be lowest in [i-left, i+right]
    let isLow=true;
    for(let j=i-left;j<i;j++) if(srcL[j]<=srcL[i]){isLow=false;break;}
    if(isLow) for(let j=i+1;j<=i+right;j++) if(srcL[j]<=srcL[i]){isLow=false;break;}
    if(isLow) pivL[i]=srcL[i];
  }

  // 5. Build zones from ALL pivots
  const allHighZones=[];
  const allLowZones=[];

  for(let i=0;i<data.length;i++){
    if(pivH[i]!==null){
      const a=atr[i]||0;
      const band=Math.min(a*mult, pivH[i]*per/100)/2;
      allHighZones.push({idx:i, top:pivH[i]+band, bottom:pivH[i]-band, bullish:false, endIdx:data.length-1});
    }
    if(pivL[i]!==null){
      const a=atr[i]||0;
      const band=Math.min(a*mult, pivL[i]*per/100)/2;
      allLowZones.push({idx:i, top:pivL[i]+band, bottom:pivL[i]-band, bullish:true, endIdx:data.length-1});
    }
  }

  // Each zone stops extending when the NEXT zone of same type replaces it
  // (older zones get pushed out by nPiv limit)
  // Mark endIdx: zone ends when the next same-type zone starts (or data end)
  for(let i=0;i<allHighZones.length-1;i++){
    allHighZones[i].endIdx=allHighZones[i+1].idx-1;
  }
  for(let i=0;i<allLowZones.length-1;i++){
    allLowZones[i].endIdx=allLowZones[i+1].idx-1;
  }

  // Keep all zones — they already have correct endIdx from replacement chain
  // nPiv unused here but kept in params for future filtering
  const highZones=allHighZones;
  const lowZones=allLowZones;

  // 6. Historical bar-by-bar zone coloring
  // Zone starts as its type. Break above -> green. Break below -> red.
  // Zone only lives from idx to endIdx.
  const allZones=[...highZones,...lowZones];
  for(const z of allZones){
    z.barColors=[];
    var curBull=z.bullish;
    for(var bi=z.idx;bi<=z.endIdx;bi++){
      var hi=data[bi].high, lo=data[bi].low;
      if(hi>z.top && lo<z.bottom){/* engulfed */}
      else if(hi>z.top){curBull=true;}
      else if(lo<z.bottom){curBull=false;}
      z.barColors[bi]=curBull;
    }
    z.bullish=curBull;
  }

  // 7. Merge overlapping zones (like Pine's _align function)
  const merged=[];
  for(const z of allZones){
    let found=false;
    for(const m of merged){
      if(z.top>m.bottom && z.bottom<m.top){
        // Overlap — expand to encompass both
        m.top=Math.max(m.top,z.top);
        m.bottom=Math.min(m.bottom,z.bottom);
        m.idx=Math.min(m.idx,z.idx);
        found=true;
        break;
      }
    }
    if(!found) merged.push({...z});
  }

  return merged;
}
function calcATR(data,period=14){
  let atr=null; const out=[];
  for(let i=0;i<data.length;i++){
    const hi=data[i].high,lo=data[i].low,pc=i>0?data[i-1].close:data[i].open;
    const tr=Math.max(hi-lo,Math.abs(hi-pc),Math.abs(lo-pc));
    atr=atr===null?tr:(atr*(period-1)+tr)/period;
    out.push(atr);
  }
  return out;
}
// SMA of True Range — matches Pine Script ta.sma(ta.tr(true), length)
function calcATRSMA(data,period=14){
  const trs=[];
  for(let i=0;i<data.length;i++){
    const hi=data[i].high,lo=data[i].low,pc=i>0?data[i-1].close:data[i].open;
    trs.push(Math.max(hi-lo,Math.abs(hi-pc),Math.abs(lo-pc)));
  }
  const out=[];
  for(let i=0;i<trs.length;i++){
    if(i<period-1){out.push(null);continue;}
    let sum=0; for(let j=i-period+1;j<=i;j++) sum+=trs[j];
    out.push(sum/period);
  }
  return out;
}

// ══════════════════════════════════════════════════════════
//  BAD PRINT FILTER
// ══════════════════════════════════════════════════════════
const nbboCache=new Map();
async function fetchNBBO(sym,ts,mins){
  const key=`${sym}:${ts}`;
  if(nbboCache.has(key)) return nbboCache.get(key);
  const s=(ts*1e9).toFixed(0), e=((ts+mins*60)*1e9).toFixed(0);
  try{
    const r=await fetch(`${POLY}/v3/quotes/${encodeURIComponent(sym)}?timestamp.gte=${s}&timestamp.lt=${e}&limit=20&sort=timestamp&order=asc&apiKey=${API_KEY}`);
    if(!r.ok){nbboCache.set(key,null);return null;}
    const j=await r.json();
    if(!j.results?.length){nbboCache.set(key,null);return null;}
    let lo=Infinity,hi=-Infinity;
    for(const q of j.results){
      const bid=+(q.bid_price||0),ask=+(q.ask_price||0);
      if(bid>0.01&&bid<lo) lo=bid;
      if(ask>0.01&&ask>hi) hi=ask;
    }
    if(lo===Infinity){nbboCache.set(key,null);return null;}
    const res={lo:lo*0.994,hi:hi*1.006};
    nbboCache.set(key,res); return res;
  }catch(e){nbboCache.set(key,null);return null;}
}
function sanityOk(b){
  if(!b||b.open<=0||b.high<=0||b.low<=0||b.close<=0) return false;
  if(b.high<b.low) return false;
  return true;
}
function rollingMedATR(bars,win=30){
  const tr=new Float64Array(bars.length);
  let a=0;
  for(let i=0;i<bars.length;i++){
    const b=bars[i],pc=i>0?bars[i-1].close:b.open;
    tr[i]=Math.max(b.high-b.low,Math.abs(b.high-pc),Math.abs(b.low-pc));
    a=i===0?tr[i]:(a*13+tr[i])/14;
  }
  const sa=new Float64Array(bars.length);
  a=0;
  for(let i=0;i<bars.length;i++){a=i===0?tr[i]:(a*13+tr[i])/14;sa[i]=a;}
  const med=new Float64Array(bars.length);
  const tmp=[];
  for(let i=0;i<bars.length;i++){
    const s=Math.max(0,i-win),e=Math.min(bars.length-1,i+win);
    tmp.length=0;
    for(let j=s;j<=e;j++) tmp.push(sa[j]);
    tmp.sort((a,b)=>a-b);
    med[i]=tmp[Math.floor(tmp.length/2)];
  }
  return med;
}
function buildProtectedSet(bars){
  const s=new Set();
  const KEY_MINS=[240,241,242,243,244,568,569,570,571,572,960,961,962];
  let lastRegularOpen=-1;
  for(let i=0;i<bars.length;i++){
    if(typeof bars[i].time!=='number') continue;
    const mins=nyMins(bars[i].time);
    if(KEY_MINS.includes(mins)){s.add(i);}
    if(i>0&&typeof bars[i-1].time==='number'){
      if(getSession(bars[i].time)!==getSession(bars[i-1].time)) s.add(i);
      if(bars[i].time-bars[i-1].time>20*60) s.add(i);
    }
    if(getSession(bars[i].time)==='regular'){
      if(i===0||getSession(bars[i-1]?.time)!=='regular') lastRegularOpen=i;
      if(lastRegularOpen>=0&&i-lastRegularOpen<12) s.add(i);
    }
  }
  return s;
}
async function filterBadPrints(sym,bars,tfMins){
  if(bars.length<4) return bars;
  // Log what sanityOk drops
  bars.filter(b=>!sanityOk(b)).forEach(b=>{
    const t=typeof b.time==='number'?new Date(b.time*1000).toISOString():b.time;
    console.warn(`[sanityOk DROP] ${t} O=${b.open} H=${b.high} L=${b.low} C=${b.close}`);
  });
  bars=bars.filter(b=>sanityOk(b));
  if(bars.length<4) return bars;
  const protected_=buildProtectedSet(bars);
  const med=rollingMedATR(bars);
  const remove=new Set(),needNBBO=[];
  const atrReliable=bars.length>=60;
  for(let i=1;i<bars.length-1;i++){
    if(protected_.has(i)) continue;
    const b=bars[i],pv=bars[i-1],nx=bars[i+1];
    const sess=getSession(b.time);
    const mATR=med[i]||pv.close*0.001;
    const range=b.high-b.low,body=Math.abs(b.close-b.open)||mATR*0.01;
    const upWick=b.high-Math.max(b.open,b.close);
    const dnWick=Math.min(b.open,b.close)-b.low;
    const bigWick=Math.max(upWick,dnWick);

    // Flag for NBBO verification:
    // (a) wide range: >5× average of surrounding 6-bar ranges
    // (b) big wick: wick >3× body AND wick >2× mATR
    // (c) regular session extreme: range >8× mATR (existing logic)
    const neighborRanges=[i-3,i-2,i-1,i+1,i+2,i+3]
      .filter(j=>j>=0&&j<bars.length)
      .map(j=>bars[j].high-bars[j].low);
    const avgNeighborRange=neighborRanges.length
      ? neighborRanges.reduce((a,v)=>a+v,0)/neighborRanges.length
      : mATR;

    const isWideRange = range > avgNeighborRange*5;
    const isBigWick   = bigWick > body*3 && bigWick > mATR*2;
    const isExtremeRegular = sess==='regular' && atrReliable && range > mATR*8;

    if(isWideRange||isBigWick||isExtremeRegular){
      // Fast statistical filter — skip NBBO API for most cases
      const refPrice=(pv.close+nx.open)/2;
      const bodyDev=Math.abs(b.close-refPrice)/Math.max(refPrice,0.001);
      const openDev=Math.abs(b.open-refPrice)/Math.max(refPrice,0.001);
      const maxDev=Math.max(bodyDev,openDev);
      
      // If BOTH body endpoints are far from neighbors, bar is definitely fake
      if(maxDev>0.02 && bodyDev>0.015){
        console.warn(`[STAT DROP] ${new Date(b.time*1000).toISOString()} bodyDev=${(bodyDev*100).toFixed(2)}% maxDev=${(maxDev*100).toFixed(2)}% range=${range.toFixed(2)}`);
        remove.add(i); continue;
      }
      // If range is extreme (>8× neighbors), trim wicks to neighbor bounds
      if(range > avgNeighborRange*8){
        const halfSpread=avgNeighborRange*3;
        const mid=(b.open+b.close)/2;
        const trimHi=Math.min(b.high, mid+halfSpread);
        const trimLo=Math.max(b.low, mid-halfSpread);
        if(trimHi!==b.high||trimLo!==b.low){
          console.warn(`[STAT TRIM] ${new Date(b.time*1000).toISOString()} H:${b.high.toFixed(2)}→${trimHi.toFixed(2)} L:${b.low.toFixed(2)}→${trimLo.toFixed(2)}`);
          bars[i]={...b,high:trimHi,low:trimLo};
        }
        continue;
      }
      // Pre/post market with big wicks but plausible body — trim wick only
      if((sess==='pre'||sess==='post') && bigWick > body*3 && bigWick > mATR*2 && bodyDev<0.01){
        const mid=Math.max(b.open,b.close);
        const midLo=Math.min(b.open,b.close);
        let trimHi=b.high, trimLo=b.low;
        if(upWick===bigWick) trimHi=Math.min(b.high, mid+avgNeighborRange*2);
        if(dnWick===bigWick) trimLo=Math.max(b.low, midLo-avgNeighborRange*2);
        if(trimHi!==b.high||trimLo!==b.low){
          console.warn(`[SESS TRIM] ${new Date(b.time*1000).toISOString()} ${sess} H:${b.high.toFixed(2)}→${trimHi.toFixed(2)} L:${b.low.toFixed(2)}→${trimLo.toFixed(2)}`);
          bars[i]={...b,high:trimHi,low:trimLo};
        }
        continue;
      }
      // Fall through to NBBO for truly ambiguous cases
      needNBBO.push(i);
      continue;
    }

    // Moderate ATR removal (regular session only, no NBBO needed)
    if(sess==='regular'&&atrReliable&&range>mATR*5){
      console.warn(`[ATR DROP] ${new Date(b.time*1000).toISOString()} range=${range.toFixed(3)} threshold=${(mATR*5).toFixed(3)}`);
      remove.add(i);continue;
    }

    // Island check — close isolated >8% from both neighbours in all sessions
    const dP=Math.abs(b.close-pv.close)/Math.max(pv.close,0.001);
    const dN=Math.abs(b.close-nx.open)/Math.max(nx.open,0.001);
    if(dP>0.08&&dN>0.08){
      console.warn(`[ISLAND DROP] ${new Date(b.time*1000).toISOString()} dP=${dP.toFixed(3)} dN=${dN.toFixed(3)}`);
      remove.add(i);continue;
    }
  }
  // NBBO verification — fetch in larger batches for speed
  for(let si=0;si<needNBBO.length;si+=12){
    await Promise.all(needNBBO.slice(si,si+12).map(async idx=>{
      if(protected_.has(idx)) return;
      const b=bars[idx];
      if(typeof b.time!=='number'){remove.add(idx);return;}
      const nb=await fetchNBBO(sym,b.time,tfMins);
      if(nb){
        const bodyOk=b.open>=nb.lo&&b.open<=nb.hi&&b.close>=nb.lo&&b.close<=nb.hi;
        if(bodyOk){
          // Body is real — trim any wicks that exceed NBBO bounds
          const clippedHigh=Math.min(b.high,nb.hi);
          const clippedLow =Math.max(b.low, nb.lo);
          if(clippedHigh!==b.high||clippedLow!==b.low)
            console.warn(`[NBBO TRIM] ${new Date(b.time*1000).toISOString()} H:${b.high.toFixed(2)}→${clippedHigh.toFixed(2)} L:${b.low.toFixed(2)}→${clippedLow.toFixed(2)}`);
          bars[idx]={...b,high:clippedHigh,low:clippedLow};
        } else {
          // Body outside NBBO — whole bar is bad
          console.warn(`[NBBO DROP] ${new Date(b.time*1000).toISOString()} body outside [${nb.lo.toFixed(2)},${nb.hi.toFixed(2)}]`);
          remove.add(idx);
        }
      } else {
        // No NBBO — only remove if body is isolated >12% from neighbours
        const pv2=idx>0?bars[idx-1]:null,nx2=idx<bars.length-1?bars[idx+1]:null;
        const ref=pv2&&nx2?(pv2.close+nx2.open)/2:pv2?pv2.close:b.close;
        if(Math.abs(b.close-ref)/Math.max(ref,.001)>0.12){
          console.warn(`[NO-NBBO DROP] ${new Date(b.time*1000).toISOString()}`);
          remove.add(idx);
        }
        // Otherwise keep as-is — can't verify, don't remove
      }
    }));
  }
  console.log(`[filter] ${sym} ${tfMins}m: kept ${bars.length-remove.size}/${bars.length}`);
  return bars.filter((_,i)=>!remove.has(i));
}

// ══════════════════════════════════════════════════════════
//  RENDERER  — gap-compressed bar positioning
//  Overnight / weekend gaps are collapsed so bars pack
//  contiguously like TradingView. Each visible bar gets one
//  equal-width slot regardless of wall-clock gaps.
// ══════════════════════════════════════════════════════════
function renderPanel(p){
  const{canvas,ctx,data,W,H,PRICE_W,TIME_H,viewStart,viewBars,cx,cy,tf,inds:pi}=p;
  if(!ctx||W<=0||H<=0||!data.length) return;
  const chartW=W-PRICE_W;
  const volFrac=p.volFrac||VOL_FRAC_DEFAULT;
  const volH=pi.vol?Math.round(H*volFrac):0;
  const priceH=H-TIME_H-volH;
  if(chartW<=0||priceH<=10) return;

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=C.axisbg;
  ctx.fillRect(chartW,0,PRICE_W,H);
  ctx.fillRect(0,H-TIME_H,W,TIME_H);

  const maxStart=Math.max(0,data.length-viewBars);
  const vs=Math.max(0,Math.min(viewStart,maxStart));
  const ve=Math.min(vs+viewBars,data.length);
  const visible=data.slice(vs,ve);
  if(!visible.length) return;

  // ── Bar sizing — simple: N visible bars + fixed right pad, bars start at x=0 ──
  const RIGHT_PAD=window.RIGHT_PAD||6; // configurable right padding
  const barW=chartW/Math.max(visible.length+RIGHT_PAD,1);
  const GAP=Math.max(2,Math.round(barW*0.25));
  const candleW=Math.max(1,barW-GAP);
  const xCtr=(i)=>i*barW+barW/2;
  const xLc =(i)=>i*barW+GAP/2; // candle left edge (gap-offset)
  const xL  =(i)=>i*barW;

  // ── Price range — candles only, scaled by priceScale, then clamp pToY ──
  let minP=Infinity,maxP=-Infinity;
  for(const b of visible){if(b.low<minP)minP=b.low;if(b.high>maxP)maxP=b.high;}
  const pad=(maxP-minP)*0.15||minP*0.02;
  minP-=pad; maxP+=pad;
  // Apply priceScale: >1 = more padding = zoomed out on price, <1 = tighter = zoomed in
  const midP=(minP+maxP)/2, halfRange=(maxP-minP)/2;
  const scaledHalf=halfRange*(p.priceScale||1);
  minP=midP-scaledHalf; maxP=midP+scaledHalf;
  const priceRange=maxP-minP;
  const pToY=v=>Math.max(0,Math.min(priceH, priceH-((v-minP)/priceRange)*priceH));

  // ── Annotation time→X (search ALL data, extrapolate off-screen) ──
  function annTimeToX(t){
    const ts=toUnix(t);
    // Find the two bars that bracket this timestamp for interpolation
    let lo=-1, hi=-1;
    for(let i=0;i<data.length;i++){
      const bt=toUnix(data[i].time);
      if(bt<=ts) lo=i;
      if(bt>=ts && hi<0) hi=i;
    }
    if(lo<0&&hi<0) return null;
    // If exact match or only one side found, snap to nearest
    if(lo<0) return (hi-vs+0.5)*barW;
    if(hi<0) return (lo-vs+0.5)*barW;
    if(lo===hi) return (lo-vs+0.5)*barW;
    // Interpolate between lo and hi
    const loT=toUnix(data[lo].time), hiT=toUnix(data[hi].time);
    const frac=(hiT===loT)?0:(ts-loT)/(hiT-loT);
    return ((lo+frac*(hi-lo))-vs+0.5)*barW;
  }

  // ── GRID ──
  ctx.strokeStyle=C.grid; ctx.lineWidth=1;
  // Horizontal grid: snap to nice round price levels
  const priceSteps=6;
  // Calculate a nice step size (1, 2, 5, 10, 20, 50, etc.)
  const rawStep=priceRange/priceSteps;
  const mag=Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized=rawStep/mag;
  let niceStep;
  if(normalized<=1) niceStep=mag;
  else if(normalized<=2) niceStep=2*mag;
  else if(normalized<=5) niceStep=5*mag;
  else niceStep=10*mag;
  // Draw horizontal lines at nice price levels
  const gridMinP=Math.ceil(minP/niceStep)*niceStep;
  for(let gp=gridMinP; gp<=maxP; gp+=niceStep){
    const y=Math.round(pToY(gp))+.5;
    if(y<0||y>priceH) continue;
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(chartW,y);ctx.stroke();
  }
  // Vertical grid: snap to candle boundaries (stop at separator, resume below)
  const pxPerBar=chartW/(visible.length+6);
  const barsPerStep=Math.max(1,Math.round(80/pxPerBar));
  const firstGridBar=Math.ceil(vs/barsPerStep)*barsPerStep;
  for(let bi=firstGridBar;bi<=ve;bi+=barsPerStep){
    const i_=bi-vs;
    if(i_<0||i_>=visible.length) continue;
    const x=Math.round(xCtr(i_))+.5;
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,priceH);ctx.stroke();
    if(volH>0){ctx.beginPath();ctx.moveTo(x,priceH+1);ctx.lineTo(x,priceH+volH);ctx.stroke();}
  }

  // ── PRICE AXIS ──
  ctx.fillStyle=C.axisLabel; ctx.font=`bold ${F.p}px Inter`; ctx.textAlign='right';
  for(let gp=gridMinP; gp<=maxP; gp+=niceStep){
    const y=pToY(gp);
    if(y<0||y>priceH) continue;
    ctx.fillText(fmtPrice(gp),W-4,y+4);
  }

  // ── TIME AXIS ── labels across visible bars + projected future times
  ctx.fillStyle=C.axisLabel; ctx.font=`bold ${F.t}px Inter`; ctx.textAlign='center';

  const lastBar=visible[visible.length-1];
  const barIntervalSec=visible.length>1
    ? (Number(visible[visible.length-1].time)-Number(visible[0].time))/(visible.length-1)
    : (parseInt(tf)||5)*60;

  const totalLabelSlots=visible.length+RIGHT_PAD;
  const labelCount=Math.min(8,Math.floor(chartW/70));
  for(let li=0;li<=labelCount;li++){
    const slotIdx=Math.round(li/labelCount*(totalLabelSlots-1));
    const x=slotIdx*barW+barW/2;
    if(x>chartW-4) break;
    let label;
    if(slotIdx<visible.length){
      label=fmtTimeAxis(visible[slotIdx].time,tf);
    } else {
      const futureOffset=slotIdx-visible.length+1;
      const futureTs=typeof lastBar.time==='number'
        ? lastBar.time+futureOffset*barIntervalSec : null;
      label=futureTs?fmtTimeAxis(futureTs,tf):'';
    }
    ctx.fillText(label,Math.round(x),H-TIME_H+13);
  }

  // ── BT DATE HIGHLIGHTS ──
  if(btHighlightDates && btSelected){
    const tradeDates=new Set([btSelected.date]);
    ctx.save();
    const hlCol='rgba(245,158,11,0.10)';
    if(isIntraday(tf)){
      let segStart=-1, segDate=null;
      const flushSeg=(endX)=>{
        if(tradeDates.has(segDate)){
          ctx.fillStyle=hlCol;
          ctx.fillRect(segStart,0,endX-segStart,priceH+volH);
        }
      };
      for(let i=0;i<visible.length;i++){
        const ny=getNY(visible[i].time);
        const dk=`${ny.year}-${String(ny.month).padStart(2,'0')}-${String(ny.day).padStart(2,'0')}`;
        if(dk!==segDate){
          if(segDate!==null) flushSeg(xL(i));
          segStart=xL(i); segDate=dk;
        }
      }
      if(segDate!==null) flushSeg(xL(visible.length-1)+barW);
    } else {
      for(let i=0;i<visible.length;i++){
        const dk=typeof visible[i].time==='string'?visible[i].time:fmtDate(new Date(visible[i].time*1000));
        if(tradeDates.has(dk)){
          ctx.fillStyle=hlCol;
          ctx.fillRect(xL(i),0,barW,priceH+volH);
        }
      }
    }
    ctx.restore();
  }

  // ── SESSION SHADING + BOUNDARY LINES ──
  if(isIntraday(tf)){
    let spanStart=-1, spanSess=null, spanEndBar=-1;
    const flushSpan=(endX)=>{
      if(spanSess==='pre')   {ctx.fillStyle=C.pre;   ctx.fillRect(spanStart,0,endX-spanStart,priceH+volH);}
      if(spanSess==='after') {ctx.fillStyle=C.after; ctx.fillRect(spanStart,0,endX-spanStart,priceH+volH);}
    };

    // First pass: shade sessions
    for(let i=0;i<visible.length;i++){
      const sess=getSession(visible[i].time);
      const bL=xL(i);

      if(sess==='pre'||sess==='after'){
        if(spanSess!==sess){
          if(spanSess) flushSpan(bL);
          spanStart=bL; spanSess=sess;
        }
        spanEndBar=i;
      } else {
        // sess is 'regular' or null
        if(spanSess==='pre'){
          // Extend pre-market shading all the way to this bar's left edge
          // so there's no unshaded gap between last pre bar and 9:30 open
          flushSpan(bL);
        } else if(spanSess==='after'){
          flushSpan(bL);
        }
        spanStart=-1; spanSess=null; spanEndBar=-1;
      }
    }
    if(spanSess) flushSpan(xL(visible.length-1)+barW);

    // Precompute PDC map from FULL data array (not just visible) so zoom never shifts it
    // pdcMap: date-string -> last regular-session close price for that date
    if(!p._pdcMap||p._pdcMapLen!==data.length){
      const m={};
      for(let i=0;i<data.length;i++){
        if(getSession(data[i].time)==='regular'){
          const ny=getNY(data[i].time);
          const dk=`${ny.year}-${ny.month}-${ny.day}`;
          m[dk]=data[i].close; // keep overwriting -> last regular bar of day wins
        }
      }
      p._pdcMap=m; p._pdcMapLen=data.length;
    }
    const pdcMap=p._pdcMap;

    // Second pass: vertical boundary lines at session transitions and day changes
    let prevSess=visible[0]?getSession(visible[0].time):null;
    let prevDay=visible[0]?getNY(visible[0].time):{day:-1,month:-1};
    const pdcSegs=[];
    for(let i=1;i<visible.length;i++){
      const b=visible[i];
      const sess=getSession(b.time);
      const ny=getNY(b.time);
      const bL=xL(i);
      const dayChanged=ny.day!==prevDay.day||ny.month!==prevDay.month;

      if(dayChanged){
        // Look up prior day's regular close from precomputed map
        const pd=prevDay;
        const dk=`${pd.year}-${pd.month}-${pd.day}`;
        const pdcPrice=pdcMap[dk]??null;
        if(pdcPrice!==null){
          // Find where this day ends (next day boundary or chart edge)
          let endX=chartW;
          pdcSegs.push({x:bL, endX, price:pdcPrice, dayKey:dk});
          if(pdcSegs.length>1) pdcSegs[pdcSegs.length-2].endX=bL;
        }
        ctx.strokeStyle='rgba(80,100,150,0.5)'; ctx.lineWidth=1.5; ctx.setLineDash([]);
        ctx.beginPath();ctx.moveTo(bL,0);ctx.lineTo(bL,priceH+volH);ctx.stroke();
      } else if(sess!==prevSess&&(prevSess==='pre'||sess==='regular')){
        ctx.strokeStyle='rgba(100,140,200,0.35)'; ctx.lineWidth=1; ctx.setLineDash([2,3]);
        ctx.beginPath();ctx.moveTo(bL,0);ctx.lineTo(bL,priceH+volH);ctx.stroke();
        ctx.setLineDash([]);
      }
      prevSess=sess; prevDay=ny;
    }
    // Also draw PDC for the FIRST visible day if we're mid-day (no boundary visible)
    if(visible.length>0&&pdcSegs.length===0){
      const ny0=getNY(visible[0].time);
      // Find prior calendar day's close
      let priorDk=null, priorClose=null;
      // Walk back through data before vs to find last regular close of prior day
      for(let i=vs-1;i>=0;i--){
        if(getSession(data[i].time)==='regular'){
          const ny=getNY(data[i].time);
          if(ny.day!==ny0.day||ny.month!==ny0.month){
            priorClose=data[i].close; break;
          }
        }
      }
      if(priorClose!==null) pdcSegs.push({x:0, endX:chartW, price:priorClose});
    }
    // Also handle case where first visible boundary is mid-chart
    if(visible.length>0&&pdcSegs.length>0&&pdcSegs[0].x>0){
      // May need a segment from x=0 to first boundary for the starting day's PDC
      const ny0=getNY(visible[0].time);
      let priorClose=null;
      for(let i=vs-1;i>=0;i--){
        if(getSession(data[i].time)==='regular'){
          const ny=getNY(data[i].time);
          if(ny.day!==ny0.day||ny.month!==ny0.month){priorClose=data[i].close;break;}
        }
      }
      if(priorClose!==null) pdcSegs.unshift({x:0, endX:pdcSegs[0].x, price:priorClose});
    }
    // Draw prior-day close lines
    if(p.showPDC){
      ctx.save();
      ctx.beginPath(); ctx.rect(0,0,chartW,priceH); ctx.clip();
      ctx.lineWidth=1.5; ctx.setLineDash([5,4]);
      for(const seg of pdcSegs){
        const y=pToY(seg.price);
        if(y<0||y>priceH) continue;
        ctx.strokeStyle='rgba(190,200,220,0.70)';
        ctx.beginPath(); ctx.moveTo(seg.x,y); ctx.lineTo(seg.endX,y); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // ── VOLUME ──
  if(volH>0){
    const maxVol=Math.max(...visible.map(b=>b.volume||0))||1;
    for(let i=0;i<visible.length;i++){
      const b=visible[i];
      const vh=Math.max(1,((b.volume||0)/maxVol)*volH*0.92);
      const vx=Math.round(xLc(i));
      const vw=Math.min(Math.round(candleW),chartW-vx-1);
      if(vw<=0) continue;
      ctx.fillStyle=b.close>=b.open?C.vol_up:C.vol_dn;
      ctx.fillRect(vx,priceH+volH-vh,vw,vh);
    }
    // Volume label
    ctx.fillStyle=C.axisMuted; ctx.font=`bold ${F.t}px Inter`; ctx.textAlign='right';
    ctx.fillText(fmtVol(Math.max(...visible.map(b=>b.volume||0))),W-4,priceH+10);
    // Volume SMA overlay
    if(pi.sma_vol||pi.vol){
      const volSmaPeriod = pi.sma_vol ? (gatherParams('sma_vol').period||20) : 0;
      if(volSmaPeriod>0){
        const vSma=calcVolSMA(data,volSmaPeriod);
        const volSmaClr=getIndColor('sma_vol',0)||C.vol_sma_color;
        ctx.strokeStyle=volSmaClr; ctx.lineWidth=1.2; ctx.setLineDash([]); ctx.beginPath(); let vs=false;
        for(let i=0;i<visible.length;i++){
          const ai=vs+i;
          if(vSma[ai]==null){vs=false;continue;}
          const y=priceH+volH-((vSma[ai]/maxVol)*volH*0.92);
          if(!vs){ctx.moveTo(xCtr(i),y);vs=true;}else ctx.lineTo(xCtr(i),y);
        }
        ctx.stroke();
      }
    }
    // Volume separator — solid opaque band covering grid lines
    ctx.fillStyle=C.axisbg;
    ctx.fillRect(0, priceH-1, chartW, 3);
    // Thin accent line on top edge
    ctx.fillStyle=C.axisLabel; ctx.globalAlpha=0.25;
    ctx.fillRect(0, priceH-1, chartW, 1);
    ctx.globalAlpha=1;
    // Right axis separator too
    ctx.fillStyle=C.axisbg;
    ctx.fillRect(chartW, priceH-1, PRICE_W, 3);
  }

  // ── INDICATORS ──
  // Pre-compute EMAs/ATRs based on active tool deps (deduped)
  const calcCache = {};
  const _emaCache = {}, _atrCache = {};
  function ensureEMA(period){
    const k='ema_'+period;
    if(!_emaCache[k]) _emaCache[k]=calcEMA(data,period);
    calcCache[k]=_emaCache[k];
    return _emaCache[k];
  }
  function ensureATR(period){
    const k='atr_'+period;
    if(!_atrCache[k]) _atrCache[k]=calcATRSMA(data,period);
    calcCache[k]=_atrCache[k];
    return _atrCache[k];
  }

  // Resolve deps from all active tools + legacy indicators
  // Legacy: compute EMAs that hardcoded rendering still needs
  const needE9=pi.ema9||pi.db_upper||pi.band_9_20||pi.dev_s_9_20||pi.dev_l_9_20;
  if(needE9) ensureEMA(9);
  const needDev=pi.dev_s_9_20||pi.dev_l_9_20;
  if(pi.db_upper||needDev) ensureATR(9);
  if(pi.db_low1||pi.db_low2||needDev) ensureATR(20);
  const needE20=pi.ema20||pi.db_low2||pi.band_9_20||pi.dev_s_9_20||pi.dev_l_9_20;
  if(needE20) ensureEMA(20);
  const needE72=pi.band_72_89||pi.db_72_89;
  if(needE72) ensureEMA(72);
  const needE89=pi.band_72_89||pi.db_72_89;
  if(needE89) ensureEMA(89);
  if(pi.ema50) ensureEMA(50);
  if(pi.ema200) ensureEMA(200);
  if(pi.ema150) ensureEMA(150);
  if(pi.ema40_60){ ensureEMA(40); ensureEMA(60); }
  if(needE72) ensureATR(72);
  if(needE89) ensureATR(89);

  // Also resolve deps from tool instances
  if(p.tools) p.tools.forEach(t => {
    if(!t.on) return;
    const cat = IND_CATALOG[t.indKey];
    if(!cat || !cat.deps) return;
    const prms = toolParams(t);
    const deps = cat.deps(prms);
    deps.forEach(d => {
      if(d.startsWith('ema_')) ensureEMA(parseInt(d.split('_')[1]));
      if(d.startsWith('atr_')) ensureATR(parseInt(d.split('_')[1]));
    });
  });

  // Shorthands for legacy rendering
  const e9=calcCache.ema_9||null, e20=calcCache.ema_20||null;
  const e50=calcCache.ema_50||null, e150=calcCache.ema_150||null, e200=calcCache.ema_200||null;
  const e40=calcCache.ema_40||null, e60=calcCache.ema_60||null;
  const e72=calcCache.ema_72||null, e89=calcCache.ema_89||null;
  const atr9=calcCache.atr_9||null, atr20=calcCache.atr_20||null;
  const atr72=calcCache.atr_72||null, atr89=calcCache.atr_89||null;
  const vwap=pi.vwap?calcVWAP(data,isIntraday(p.tf)):null;

  // Key Levels (Bjorgum-style) — pass custom params from tool instance or legacy
  var klParams=null;
  if(pi.pzones){
    var pzReg=IND_REGISTRY.pzones;
    // Try to get params from active tool instance first
    var pzTool = p.tools ? p.tools.find(t => t.on && t.legacyKeys && t.legacyKeys.includes('pzones')) : null;
    if(pzTool){
      klParams = toolParams(pzTool);
      var pzCat = IND_CATALOG[pzTool.indKey];
      var pzClrs = toolColors(pzTool);
      if(pzCat && pzCat.colors) pzCat.colors.forEach(function(ck){klParams[ck] = pzClrs[ck.key] || C[ck.key] || ck.def;});
    } else if(pzReg){
      klParams={};
      if(pzReg.params) pzReg.params.forEach(function(prm){var v=getIndCustom('pzones','params',prm.key);klParams[prm.key]=v!=null?v:prm.def;});
      if(pzReg.colors) pzReg.colors.forEach(function(ck){klParams[ck]=getIndCustom('pzones','colors',ck)||C[ck];});
    }
  }
  var keyLevels=null;
  if(pi.pzones&&data.length>100){
    keyLevels = calcKeyLevels(data, klParams);
  }
  // Get dev params from active preset
  const devPr=PRESETS[activePreset]?.dev||{};

  function drawLine(vals,color,lw,dashed){
    if(!vals) return;
    ctx.strokeStyle=color; ctx.lineWidth=lw||1.6; ctx.setLineDash(dashed?[6,4]:[]);
    ctx.beginPath(); let s=false;
    for(let i=0;i<visible.length;i++){
      const ai=vs+i; if(vals[ai]==null||isNaN(vals[ai])){s=false;continue;}
      const x=xCtr(i),y=pToY(vals[ai]);
      if(y<-2||y>priceH+2){s=false;continue;}
      if(!s){ctx.moveTo(x,y);s=true;}else ctx.lineTo(x,y);
    }
    ctx.stroke(); ctx.setLineDash([]);
  }
  // Draw only the filled area of a band (no border lines)
  function drawBandFill(tV,bV,fill){
    if(!tV||!bV) return;
    ctx.beginPath(); let s=false;
    for(let i=0;i<visible.length;i++){
      const ai=vs+i; if(tV[ai]==null){s=false;continue;}
      const x=xCtr(i),y=pToY(tV[ai]);
      if(!s){ctx.moveTo(x,y);s=true;}else ctx.lineTo(x,y);
    }
    for(let i=visible.length-1;i>=0;i--){
      const ai=vs+i; if(bV[ai]==null) continue;
      ctx.lineTo(xCtr(i),pToY(bV[ai]));
    }
    ctx.closePath(); ctx.fillStyle=fill; ctx.fill();
  }
  // Draw only the border lines of a band
  function drawBandLines(tV,bV,line){
    if(!tV||!bV) return;
    for(const vals of[tV,bV]){
      ctx.strokeStyle=line; ctx.lineWidth=1.2; ctx.setLineDash([]); ctx.beginPath(); let s=false;
      for(let i=0;i<visible.length;i++){
        const ai=vs+i; if(vals[ai]==null){s=false;continue;}
        const x=xCtr(i),y=pToY(vals[ai]);
        if(!s){ctx.moveTo(x,y);s=true;}else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
  }

  // ── EMA BANDS (9/20 and 72/89) — fill green/red based on direction ──
  function drawEMABand(fastEma,slowEma,fillGreen,fillRed,lineGreen,lineRed){
    if(!fastEma||!slowEma) return;
    const top=fastEma,bot=slowEma;
    // Draw segment by segment so color changes based on crossover
    let segStart=-1, segDir=null;
    const flush=(endI)=>{
      if(segStart<0) return;
      const clr=segDir==='up'?fillGreen:fillRed;
      ctx.beginPath(); let s=false;
      for(let j=segStart;j<=endI;j++){
        const aj=vs+j; if(top[aj]==null||bot[aj]==null){s=false;continue;}
        const x=xCtr(j),y=pToY(top[aj]);
        if(!s){ctx.moveTo(x,y);s=true;}else ctx.lineTo(x,y);
      }
      for(let j=endI;j>=segStart;j--){
        const aj=vs+j; if(bot[aj]==null) continue;
        ctx.lineTo(xCtr(j),pToY(bot[aj]));
      }
      ctx.closePath(); ctx.fillStyle=clr; ctx.fill();
      // Draw border lines
      for(const vals of[top,bot]){
        const lc=segDir==='up'?lineGreen:lineRed;
        ctx.strokeStyle=lc; ctx.lineWidth=1; ctx.setLineDash([]); ctx.beginPath(); let ls=false;
        for(let j=segStart;j<=endI;j++){
          const aj=vs+j; if(vals[aj]==null){ls=false;continue;}
          const x=xCtr(j),y=pToY(vals[aj]);
          if(!ls){ctx.moveTo(x,y);ls=true;}else ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
    };
    for(let i=0;i<visible.length;i++){
      const ai=vs+i;
      if(top[ai]==null||bot[ai]==null){flush(i-1);segStart=-1;segDir=null;continue;}
      const dir=top[ai]>=bot[ai]?'up':'dn';
      if(dir!==segDir){flush(i-1);segStart=i;segDir=dir;}
      else if(segStart<0){segStart=i;segDir=dir;}
    }
    flush(visible.length-1);
  }

  // ── DEVIATION BANDS (ATR-based, Pine Script accurate) ──
  // Upper = fastEMA + (mult × fastATR), Lower = slowEMA - (mult × slowATR)
  function drawDevBand(fastEma,fastAtr,slowEma,slowAtr,upMults,dnMults,upFill,upLine,dnFill,dnLine){
    if(!fastEma||!fastAtr||!slowEma||!slowAtr) return;
    // Upper deviation band: fastEMA + multiplier × fastATR
    const up1=fastEma.map((v,i)=>v+(fastAtr[i]||0)*upMults[0]);
    const up2=fastEma.map((v,i)=>v+(fastAtr[i]||0)*upMults[1]);
    // Lower deviation band: slowEMA - multiplier × slowATR
    const dn1=slowEma.map((v,i)=>v-(slowAtr[i]||0)*dnMults[0]);
    const dn2=slowEma.map((v,i)=>v-(slowAtr[i]||0)*dnMults[1]);
    // Draw fills + lines
    drawBandFill(up1,up2,upFill); drawBandLines(up1,up2,upLine);
    drawBandFill(dn1,dn2,dnFill); drawBandLines(dn1,dn2,dnLine);
  }

  // ── TOOL LOOP (PASS 0+2 for tool instances) ──
  // Render all active tool instances that have catalog render functions
  // Separated into fill pass (before candles) and line pass (after candles)
  // Build set of legacy keys owned by tool instances so legacy rendering can skip them
  const _toolOwned = new Set();
  if(p.tools) p.tools.forEach(t => {
    if(t.on && t.legacyKeys && IND_CATALOG[t.indKey]?.linePass) t.legacyKeys.forEach(k => _toolOwned.add(k));
  });
  const activeTools = (p.tools||[]).filter(t => t.on && IND_CATALOG[t.indKey]?.linePass);
  const toolHelpers = {drawLine,drawBandFill,drawBandLines,drawEMABand,drawDevBand,pToY,vs,visible,xCtr,calcCache,isIntraday:isIntraday(p.tf)};

  // TOOL FILL PASS (before candles)
  activeTools.forEach(t => {
    const cat = IND_CATALOG[t.indKey];
    const prms = toolParams(t);
    const clrs = toolColors(t);
    if(cat.fillPass) cat.fillPass(ctx,data,{...t,params:prms,colors:clrs},toolHelpers);
  });

  // PASS 1 — band fills only (drawn before candles so candles appear on top)
  if(!_toolOwned.has('ema40_60') && pi.ema40_60&&e40&&e60) drawBandFill(e40,e60,C.ema40_60_fill);
  if(!_toolOwned.has('db_upper') && e9&&atr9&&pi.db_upper)  drawBandFill(e9.map((v,i)=>v+(atr9[i]||0)),      e9.map((v,i)=>v+(atr9[i]||0)*.5),   getIndColor('db_upper',0)||C.db_upper_fill);
  if(!_toolOwned.has('db_low1') && e20&&atr20&&pi.db_low1) drawBandFill(e20.map((v,i)=>v-(atr20[i]||0)*.5), e20.map((v,i)=>v-(atr20[i]||0)),     getIndColor('db_low1',0)||C.db_low1_fill);
  if(!_toolOwned.has('db_low2') && e20&&atr20&&pi.db_low2) drawBandFill(e20.map((v,i)=>v-(atr20[i]||0)*2),  e20.map((v,i)=>v-(atr20[i]||0)*2.5), getIndColor('db_low2',0)||C.db_low2_fill);

  // EMA bands
  if(!_toolOwned.has('band_9_20') && pi.band_9_20)  drawEMABand(e9,e20, getIndColor('band_9_20',0)||C.band_9_20_bull_fill, getIndColor('band_9_20',2)||C.band_9_20_bear_fill, getIndColor('band_9_20',1)||C.band_9_20_bull_line, getIndColor('band_9_20',3)||C.band_9_20_bear_line);
  if(!_toolOwned.has('band_72_89') && pi.band_72_89) drawEMABand(e72,e89,getIndColor('band_72_89',0)||C.band_72_89_bull_fill,getIndColor('band_72_89',2)||C.band_72_89_bear_fill,getIndColor('band_72_89',1)||C.band_72_89_bull_line,getIndColor('band_72_89',3)||C.band_72_89_bear_line);

  // Deviation bands — read multipliers from saved settings, fallback to preset defaults
  function devMults(indKey, presetKey){
    // Try to read from active tool instance first
    var devTool = p.tools ? p.tools.find(t => t.on && t.legacyKeys && t.legacyKeys.includes(indKey)) : null;
    if(devTool){
      const tp = toolParams(devTool);
      return [[tp.upLow??0.5, tp.upHigh??1], [tp.dnLow??2, tp.dnHigh??2.4]];
    }
    const reg=IND_REGISTRY[indKey];
    const def=PRESETS[activePreset]?.dev?.[presetKey];
    const upLow=getIndCustom(indKey,'params','upLow') ?? def?.up?.[0] ?? .5;
    const upHigh=getIndCustom(indKey,'params','upHigh') ?? def?.up?.[1] ?? 1;
    const dnLow=getIndCustom(indKey,'params','dnLow') ?? def?.dn?.[0] ?? 2;
    const dnHigh=getIndCustom(indKey,'params','dnHigh') ?? def?.dn?.[1] ?? 2.4;
    return [[upLow,upHigh],[dnLow,dnHigh]];
  }
  if(!_toolOwned.has('dev_s_9_20') && pi.dev_s_9_20){const [u,d]=devMults('dev_s_9_20','s_9_20');drawDevBand(e9,atr9,e20,atr20,u,d, getIndColor('dev_s_9_20',0)||'rgba(239,68,68,.15)',getIndColor('dev_s_9_20',1)||'rgba(239,68,68,.40)', getIndColor('dev_s_9_20',2)||'rgba(34,197,94,.15)',getIndColor('dev_s_9_20',3)||'rgba(34,197,94,.40)');}
  if(!_toolOwned.has('dev_l_9_20') && pi.dev_l_9_20){const [u,d]=devMults('dev_l_9_20','l_9_20');drawDevBand(e9,atr9,e20,atr20,u,d, getIndColor('dev_l_9_20',0)||'rgba(239,68,68,.15)',getIndColor('dev_l_9_20',1)||'rgba(239,68,68,.40)', getIndColor('dev_l_9_20',2)||'rgba(34,197,94,.15)',getIndColor('dev_l_9_20',3)||'rgba(34,197,94,.40)');}
  if(!_toolOwned.has('db_72_89') && pi.db_72_89){const [u,d]=devMults('db_72_89','db_72_89');drawDevBand(e72,atr72,e89,atr89,u,d, getIndColor('db_72_89',0)||'rgba(239,68,68,.15)',getIndColor('db_72_89',1)||'rgba(239,68,68,.40)', getIndColor('db_72_89',2)||'rgba(34,197,94,.15)',getIndColor('db_72_89',3)||'rgba(34,197,94,.40)');}

  // ── CANDLES (drawn after band fills, before indicator lines) ──
  ctx.save();
  ctx.beginPath(); ctx.rect(0,0,chartW,priceH+volH); ctx.clip();
  for(let i=0;i<visible.length;i++){
    const b=visible[i], up=b.close>=b.open, col=up?C.up:C.dn;
    const cx2=Math.min(Math.round(xCtr(i))+.5, chartW-1);
    const bodyX=Math.round(xLc(i));
    const bodyW=Math.min(Math.round(candleW), chartW-bodyX-1);
    if(bodyW<=0) continue;
    const hY=Math.round(pToY(b.high)), lY=Math.round(pToY(b.low));
    const bTop=Math.round(Math.min(pToY(b.open),pToY(b.close)));
    const bH=Math.max(2,Math.round(Math.abs(pToY(b.close)-pToY(b.open))));

    if(_chartStyle==='candles'||_chartStyle==='hollow'){
      // Standard candlesticks
      ctx.strokeStyle=col; ctx.lineWidth=1; ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(cx2,hY);ctx.lineTo(cx2,lY);ctx.stroke();
      if(_chartStyle==='hollow'&&up){
        ctx.strokeStyle=col; ctx.strokeRect(bodyX,bTop,bodyW,bH);
      } else {
        ctx.fillStyle=col; ctx.fillRect(bodyX,bTop,bodyW,bH);
      }
    } else if(_chartStyle==='ohlc'){
      // OHLC bars
      ctx.strokeStyle=col; ctx.lineWidth=1; ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(cx2,hY);ctx.lineTo(cx2,lY);ctx.stroke();
      const oY=Math.round(pToY(b.open)), cY=Math.round(pToY(b.close));
      ctx.beginPath();ctx.moveTo(bodyX,oY);ctx.lineTo(cx2,oY);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx2,cY);ctx.lineTo(bodyX+bodyW,cY);ctx.stroke();
    } else if(_chartStyle==='line'){
      // Line chart (close prices only)
      if(i===0){ctx.beginPath();ctx.strokeStyle=C.up;ctx.lineWidth=1.5;ctx.setLineDash([]);ctx.moveTo(cx2,Math.round(pToY(b.close)));}
      else{ctx.lineTo(cx2,Math.round(pToY(b.close)));}
      if(i===visible.length-1) ctx.stroke();
    } else if(_chartStyle==='area'){
      // Area chart
      if(i===0){ctx.beginPath();ctx.moveTo(cx2,Math.round(pToY(b.close)));}
      else{ctx.lineTo(cx2,Math.round(pToY(b.close)));}
      if(i===visible.length-1){
        ctx.lineTo(cx2,priceH); ctx.lineTo(Math.round(xCtr(0)),priceH); ctx.closePath();
        ctx.fillStyle=up?'rgba(38,166,154,.18)':'rgba(239,83,80,.18)';
        ctx.fill();
        // Re-draw line on top
        ctx.beginPath();
        for(let j=0;j<visible.length;j++){
          const x=Math.min(Math.round(xCtr(j))+.5,chartW-1), y=Math.round(pToY(visible[j].close));
          j===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        }
        ctx.strokeStyle=C.up; ctx.lineWidth=1.5; ctx.setLineDash([]); ctx.stroke();
      }
    } else if(_chartStyle==='heikin'){
      // Heikin Ashi candles
      const pi2=p; // current panel
      if(!p._haData||p._haData.length!==data.length){
        // Compute HA on first use
        p._haData=[];
        for(let h=0;h<data.length;h++){
          const bd=data[h];
          if(h===0){p._haData.push({o:bd.open,h:bd.high,l:bd.low,c:bd.close});continue;}
          const pv=p._haData[h-1];
          const haC=(bd.open+bd.high+bd.low+bd.close)/4;
          const haO=(pv.o+pv.c)/2;
          p._haData.push({o:haO,h:Math.max(bd.high,haO,haC),l:Math.min(bd.low,haO,haC),c:haC});
        }
      }
      const hb=p._haData[vs+i]||b;
      const haUp=hb.c>=hb.o, haCol=haUp?C.up:C.dn;
      const haH=Math.round(pToY(hb.h)), haL=Math.round(pToY(hb.l));
      const haBTop=Math.round(Math.min(pToY(hb.o),pToY(hb.c)));
      const haBH=Math.max(2,Math.round(Math.abs(pToY(hb.c)-pToY(hb.o))));
      ctx.strokeStyle=haCol; ctx.lineWidth=1; ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(cx2,haH);ctx.lineTo(cx2,haL);ctx.stroke();
      ctx.fillStyle=haCol; ctx.fillRect(bodyX,haBTop,bodyW,haBH);
    } else if(_chartStyle==='baseline'){
      // Baseline: fill above/below the first visible close
      if(!window._baselineRef) window._baselineRef=b.close;
      const refY=Math.round(pToY(window._baselineRef));
      const cY2=Math.round(pToY(b.close));
      ctx.fillStyle=cY2<refY?'rgba(38,166,154,.25)':'rgba(239,83,80,.25)';
      ctx.fillRect(bodyX,Math.min(cY2,refY),bodyW,Math.abs(cY2-refY)||1);
      // baseline line
      if(i===0){ctx.beginPath();ctx.strokeStyle='#4a6080';ctx.lineWidth=.5;ctx.setLineDash([3,3]);ctx.moveTo(0,refY);ctx.lineTo(chartW,refY);ctx.stroke();ctx.setLineDash([]);}
      if(i===0){ctx.beginPath();ctx.strokeStyle=C.up;ctx.lineWidth=1.5;ctx.setLineDash([]);ctx.moveTo(cx2,cY2);}
      else{ctx.lineTo(cx2,cY2);}
      if(i===visible.length-1) ctx.stroke();
    }
  }
  ctx.restore();

  // PASS 2 — band border lines + EMA lines (drawn after candles so they appear on top)
  // _toolOwned already defined before PASS 1
  if(!_toolOwned.has('db_upper') && e9&&atr9&&pi.db_upper)  drawBandLines(e9.map((v,i)=>v+(atr9[i]||0)),      e9.map((v,i)=>v+(atr9[i]||0)*.5),   getIndColor('db_upper',1)||C.db_upper_line);
  if(!_toolOwned.has('db_low1') && e20&&atr20&&pi.db_low1) drawBandLines(e20.map((v,i)=>v-(atr20[i]||0)*.5), e20.map((v,i)=>v-(atr20[i]||0)),     getIndColor('db_low1',1)||C.db_low1_line);
  if(!_toolOwned.has('db_low2') && e20&&atr20&&pi.db_low2) drawBandLines(e20.map((v,i)=>v-(atr20[i]||0)*2),  e20.map((v,i)=>v-(atr20[i]||0)*2.5), getIndColor('db_low2',1)||C.db_low2_line);
  if(!_toolOwned.has('ema40_60') && pi.ema40_60&&e40&&e60){
    drawBandLines(e40,e60,C.ema40_60_line);
  }
  if(!_toolOwned.has('ema150')) { if(pi.ema150) drawLine(e150,C.ema150,1.2,true); }
  if(!_toolOwned.has('ema200')) { if(pi.ema200) drawLine(e200,C.ema200,1.4); }
  if(!_toolOwned.has('ema50'))  { if(pi.ema50)  drawLine(e50, C.ema50, 1.4); }
  if(!_toolOwned.has('ema20'))  { if(pi.ema20)  drawLine(e20, C.ema20, 1.4); }
  if(!_toolOwned.has('ema9'))   { if(pi.ema9&&e9) drawLine(e9,C.ema9,  1.7); }
  if(!_toolOwned.has('vwap'))   { if(pi.vwap&&vwap) drawLine(vwap,C.vwap,1.8); }

  // SMA line
  if(!_toolOwned.has('sma') && pi.sma){
    const sp=gatherParams('sma');
    const smaVals=calcSMA(data,sp.period||20);
    const smaClr=getIndColor('sma',0)||C.sma_color;
    drawLine(smaVals,smaClr,1.4);
  }
  // Bollinger Bands
  if(!_toolOwned.has('bollinger') && pi.bollinger){
    const bp=gatherParams('bollinger');
    const bb=calcBollinger(data,bp.period||20,bp.stddev||2);
    const bbFillClr=getIndColor('bollinger',0)||C.bb_fill;
    const bbUpClr=getIndColor('bollinger',1)||C.bb_upper;
    const bbLoClr=getIndColor('bollinger',2)||C.bb_lower;
    drawBandFill(bb.upper,bb.lower,bbFillClr);
    drawBandLines(bb.upper,bb.lower,bbUpClr);
    drawLine(bb.middle,bbUpClr,1);
  }

  // TOOL LINE PASS (after candles)
  activeTools.forEach(t => {
    const cat = IND_CATALOG[t.indKey];
    const prms = toolParams(t);
    const clrs = toolColors(t);
    // Only render lines for tools with linePass (non-fill drawing)
    if(cat.linePass) cat.linePass(ctx,data,{...t,params:prms,colors:clrs},toolHelpers);
  });

  // ── KEY LEVELS (Bjorgum-style zones) ──
  if(keyLevels&&keyLevels.length){
    var klOffset=30;
    if(klParams&&klParams.offset) klOffset=klParams.offset;
    // Read colors from settings (with fallbacks)
    var supFill=klParams&&klParams.pz_sup_fill?klParams.pz_sup_fill:'rgba(34,197,94,.08)';
    var supLine=klParams&&klParams.pz_sup_line?klParams.pz_sup_line:'rgba(34,197,94,.35)';
    var supLabel=klParams&&klParams.pz_sup_label?klParams.pz_sup_label:'#26a69a';
    var resFill=klParams&&klParams.pz_res_fill?klParams.pz_res_fill:'rgba(239,68,68,.08)';
    var resLine=klParams&&klParams.pz_res_line?klParams.pz_res_line:'rgba(239,68,68,.35)';
    var resLabel=klParams&&klParams.pz_res_label?klParams.pz_res_label:'#ef5350';
    for(const z of keyLevels){
      var zEndIdx=Math.min(z.endIdx, data.length-1);
      if(zEndIdx<vs||z.idx>ve) continue;
      var zStartX=Math.max(0,xL(Math.max(z.idx-vs,0)));
      var zEndBarVis=zEndIdx-vs;
      var zEndX;
      if(zEndBarVis>=visible.length){ zEndX=chartW; }
      else if(zEndBarVis<0){ continue; }
      else { zEndX=xCtr(zEndBarVis)+barW/2+2; }
      const y1=pToY(z.top), y2=pToY(z.bottom);
      const h=Math.abs(y2-y1);
      if(h<1) continue;
      // Draw zone in colored segments (fill + border per segment)
      var segStartX=-1, segBull=null;
      var lastBull=z.bullish;
      var startVi=Math.max(0, z.idx-vs);
      var endVi=Math.min(visible.length, zEndIdx-vs+1);
      function flushSeg(endX, bull){
        if(segStartX<0||bull===null) return;
        var sx=Math.max(segStartX,zStartX);
        ctx.fillStyle=bull?supFill:resFill;
        ctx.fillRect(sx,Math.min(y1,y2),endX-sx,h);
        ctx.strokeStyle=bull?supLine:resLine;
        ctx.lineWidth=1; ctx.setLineDash([]);
        ctx.strokeRect(sx,Math.min(y1,y2),endX-sx,h);
      }
      for(var vi=startVi;vi<=endVi;vi++){
        var ai=vs+vi;
        var barBull;
        if(vi===endVi){ barBull=lastBull; }
        else if(z.barColors&&z.barColors[ai]!=null){ barBull=z.barColors[ai]; lastBull=barBull; }
        else { barBull=lastBull; }
        if(barBull!==segBull){
          if(segStartX>=0&&segBull!==null) flushSeg(vi===endVi?zEndX:xCtr(vi), segBull);
          segStartX=vi===endVi?-1:xCtr(vi);
          segBull=barBull;
        }
      }
      if(segStartX>=0&&segBull!==null) flushSeg(zEndX, segBull);
      var finalBull=z.bullish;
      // Price labels at right edge of zone (toggleable)
      var sl=klParams?(klParams.showLabels!=null?klParams.showLabels:klParams.show_labels):null;
      var showLabels=sl==null||sl==1;
      if(showLabels){
        var lblClr=finalBull?supLabel:resLabel;
        ctx.textAlign='right';ctx.font='bold '+F.p+'px Inter';
        ctx.fillStyle='rgba(10,12,20,.85)';
        ctx.fillRect(zEndX-klOffset-30,y1-7,klOffset+28,14);
        ctx.fillStyle=lblClr;
        ctx.fillText((finalBull?'Sup ':'Res ')+fmtPrice(z.top),zEndX-2,y1+4);
        ctx.fillStyle='rgba(10,12,20,.85)';
        ctx.fillRect(zEndX-klOffset-30,y2-7,klOffset+28,14);
        ctx.fillStyle=lblClr;
        ctx.fillText((finalBull?'Sup ':'Res ')+fmtPrice(z.bottom),zEndX-2,y2+4);
        ctx.textAlign='right';
      }
    }
  }



  // ── ANNOTATIONS (clipped to chart area) ──
  ctx.save();
  ctx.beginPath(); ctx.rect(0,0,chartW,priceH); ctx.clip();

  if(p.showTL||p.showAnn){
    for(const ann of annotations){
      const isTL=ann.type==='trendline'||ann.type==='ray'||ann.type==='hray'||ann.type==='parallel'||ann.type==='disjoint'||ann.type==='xline', isBox=ann.type.startsWith('box_')||ann.type==='circle'||ann.type==='ellipse'||ann.type==='triangle'||ann.type==='gann_box';
      const isTxt=ann.type.startsWith('text_'), isHl=ann.type.startsWith('hl_')||ann.type==='brush'||ann.type==='path';
      const isCallout=ann.type==='callout', isNote=ann.type==='note', isPriceLbl=ann.type==='price_label', isFlag=ann.type==='flag';
      const isExecAnn=ann.type==='entry_arrow'||ann.type==='exit_arrow'||ann.type==='short_arrow'||ann.type==='cover_arrow'||ann.type==='stop_line'||ann.type==='trail_stop';
      const isFib=ann.type==='fib_ret';
      const isHLine=ann.type==='hline', isVLine=ann.type==='vline';
      const isPos=ann.type==='long_pos'||ann.type==='short_pos';
      if(_hideAll) continue;
      if(isTL&&!p.showTL) continue;
      if((isBox||isTxt||isHl||isCallout||isNote||isPriceLbl||isFlag)&&!p.showAnn) continue;
      if(isExecAnn&&!p.showExec) continue;
      if(!p.showOtherAnn && ann.panelIdx!=null && ann.panelIdx!==p.idx) continue;
      if(!isTL&&!isBox&&!isTxt&&!isHl&&!isExecAnn&&!isFib&&!isHLine&&!isVLine&&!isPos&&!isCallout&&!isNote&&!isPriceLbl&&!isFlag) continue;
      if(ann.hidden) continue;
      // Apply annotation opacity
      const annAlpha=ann.opacity!=null?ann.opacity:1;
      if(annAlpha<1) ctx.globalAlpha=annAlpha;
      if(renderAdvancedAnnotation(ctx,ann,p,chartW,priceH,chartW,priceH,annTimeToX,pToY)){
        ctx.globalAlpha=1;
        if((activeTool==='del'||activeTool==='edit')&&cx>=0&&cy>=0&&isAnnNear(ann,cx,cy,p,annTimeToX,pToY)){
          const hlCol=activeTool==='edit'?'rgba(251,191,36,0.7)':'rgba(255,61,87,0.7)';
          ctx.strokeStyle=hlCol; ctx.lineWidth=2; ctx.setLineDash([4,3]);
          if(isPointArrayAnn(ann)){
            const pts=getScreenPointsFromAnn(ann,annTimeToX,pToY), bounds=getPointBounds(pts);
            if(bounds) ctx.strokeRect(bounds.minX-4,bounds.minY-4,bounds.maxX-bounds.minX+8,bounds.maxY-bounds.minY+8);
          } else {
            const x1=annTimeToX(ann.x1), y1=pToY(ann.y1), x2=ann.x2!=null?annTimeToX(ann.x2):x1, y2=ann.y2!=null?pToY(ann.y2):y1;
            if(x1!=null) ctx.strokeRect(Math.min(x1,x2)-4,Math.min(y1,y2)-4,Math.abs((x2??x1)-x1)+8,Math.abs((y2??y1)-y1)+8);
          }
          ctx.setLineDash([]);
        }
        continue;
      }
      if(isFib){
        const fibHigh=Math.max(ann.y1,ann.y2);
        const fibLow =Math.min(ann.y1,ann.y2);
        const swing  =fibHigh-fibLow;
        if(swing<=0) continue;
        const FIB_LEVELS=[
          {pct:0.30,col:'#f472b6',label:'30%'},
          {pct:0.40,col:'#fb923c',label:'40%'},
          {pct:0.50,col:'#facc15',label:'50%'},
          {pct:0.60,col:'#34d399',label:'60%'},
          {pct:0.70,col:'#60a5fa',label:'70%'},
        ];
        ctx.font=`bold ${F.p}px Inter`;
        for(const fl of FIB_LEVELS){
          const price=fibHigh-swing*fl.pct;
          const y=pToY(price);
          if(y<-2||y>priceH+2) continue;
          ctx.strokeStyle=fl.col; ctx.lineWidth=1.2; ctx.setLineDash([6,4]);
          ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(chartW,y); ctx.stroke();
          ctx.setLineDash([]);
          const lbl=`${fl.label} ${fmtPrice(price)}`;
          const tw=ctx.measureText(lbl).width;
          ctx.fillStyle='rgba(10,12,20,0.78)';
          ctx.fillRect(chartW-tw-8,y-11,tw+6,13);
          ctx.fillStyle=fl.col; ctx.textAlign='right';
          ctx.fillText(lbl,chartW-4,y-1);
        }
        // High/low boundary lines (dim purple dashes)
        for(const bPrice of [fibHigh,fibLow]){
          const y=pToY(bPrice);
          if(y<-2||y>priceH+2) continue;
          ctx.strokeStyle='rgba(167,139,250,0.35)'; ctx.lineWidth=1; ctx.setLineDash([2,3]);
          ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(chartW,y); ctx.stroke();
          ctx.setLineDash([]);
        }
        continue;
      }
      if(isPos){
        const x=annTimeToX(ann.x1);if(x==null)continue;
        const entry=ann.y1, tp=ann.y2, stop=ann.y3||0;
        if(!stop){continue;}
        const ey=pToY(entry), tpy=pToY(tp), sty=pToY(stop);
        ctx.fillStyle='rgba(38,166,154,.08)';
        ctx.fillRect(x-20,Math.min(ey,tpy),chartW-x+20,Math.abs(tpy-ey));
        ctx.fillStyle='rgba(239,83,80,.08)';
        ctx.fillRect(x-20,Math.min(ey,sty),chartW-x+20,Math.abs(sty-ey));
        ctx.setLineDash([4,3]);ctx.lineWidth=1;
        ctx.strokeStyle='rgba(38,166,154,.5)';ctx.beginPath();ctx.moveTo(x-20,tpy);ctx.lineTo(chartW,tpy);ctx.stroke();
        ctx.strokeStyle='rgba(221,227,240,.3)';ctx.beginPath();ctx.moveTo(x-20,ey);ctx.lineTo(chartW,ey);ctx.stroke();
        ctx.strokeStyle='rgba(239,83,80,.5)';ctx.beginPath();ctx.moveTo(x-20,sty);ctx.lineTo(chartW,sty);ctx.stroke();
        ctx.setLineDash([]);
        ctx.textAlign='right';ctx.font='bold 10px Inter';
        var tpPct=((Math.abs(tp-entry)/entry)*100).toFixed(1);
        ctx.fillStyle='rgba(10,12,20,.8)';ctx.fillRect(chartW-74,tpy-10,72,14);
        ctx.fillStyle='#26a69a';ctx.fillText('TP '+fmtPrice(tp)+' +'+tpPct+'%',chartW-4,tpy+2);
        ctx.fillStyle='rgba(10,12,20,.8)';ctx.fillRect(chartW-74,ey-10,72,14);
        ctx.fillStyle='#dde3f0';ctx.fillText('E '+fmtPrice(entry),chartW-4,ey+2);
        var stPct=((Math.abs(stop-entry)/entry)*100).toFixed(1);
        ctx.fillStyle='rgba(10,12,20,.8)';ctx.fillRect(chartW-74,sty-10,72,14);
        ctx.fillStyle='#ef5350';ctx.fillText('SL '+fmtPrice(stop)+' -'+stPct+'%',chartW-4,sty+2);
        var rr=Math.abs(tp-entry)/Math.abs(entry-stop);
        var rrY=(ey+tpy)/2;
        ctx.fillStyle='rgba(10,12,20,.85)';ctx.fillRect(x-58,rrY-8,54,16);
        ctx.fillStyle='#D4AF37';ctx.font='bold 11px Inter';
        ctx.textAlign='center';ctx.fillText('R:R '+rr.toFixed(2),x-31,rrY+4);
        ctx.textAlign='right';
        continue;
      }
      if(isExecAnn){
        const x=annTimeToX(ann.x1); if(x==null) continue;
        const y=pToY(ann.y1);
        const lbl=ann.label||fmtPrice(ann.y1);
        // Smart label placement helper (inline, same logic as BT markers)
        const execPlaceLbl=(lbl2,col,anchorY,prefBelow)=>{
          ctx.font='bold 11px Inter';
          const tw=ctx.measureText(lbl2).width, th=12, pad=4;
          const nearBars=[];
          for(let ni=0;ni<visible.length;ni++){const bx=(ni+0.5)*barW;if(Math.abs(bx-x)<barW*2.5)nearBars.push(visible[ni]);}
          const chY=nearBars.length?Math.min(...nearBars.map(b=>pToY(b.high))):0;
          const clY=nearBars.length?Math.max(...nearBars.map(b=>pToY(b.low))):priceH;
          const cands=prefBelow?
            [{tx:x,ty:anchorY+pad+th,al:'center'},{tx:x,ty:anchorY-pad,al:'center'},{tx:x+tw/2+pad+4,ty:anchorY+4,al:'left'},{tx:x-tw/2-pad-4,ty:anchorY+4,al:'right'}]:
            [{tx:x,ty:anchorY-pad,al:'center'},{tx:x,ty:anchorY+pad+th,al:'center'},{tx:x+tw/2+pad+4,ty:anchorY+4,al:'left'},{tx:x-tw/2-pad-4,ty:anchorY+4,al:'right'}];
          const sc=(pos)=>{
            let pen=0;
            if(pos.ty>chY&&(pos.ty-th)<clY)pen+=100;
            if(pos.ty<0||pos.ty>priceH)pen+=200;
            const tl=pos.al==='center'?pos.tx-tw/2:pos.al==='left'?pos.tx:pos.tx-tw;
            if(tl<0)pen+=50; if(tl+tw>chartW)pen+=50;
            return pen;
          };
          cands.sort((a,b)=>sc(a)-sc(b));
          const best=cands[0];
          ctx.textAlign=best.al;
          const bgX=best.al==='center'?best.tx-tw/2-2:best.al==='left'?best.tx-2:best.tx-tw-2;
          ctx.fillStyle='rgba(10,12,20,0.75)'; ctx.fillRect(bgX,best.ty-th,tw+4,th+2);
          ctx.fillStyle=col; ctx.fillText(lbl2,best.tx,best.ty);
        };
        if(ann.type==='entry_arrow'){
          const col='#ff9800'; const size=7;
          ctx.beginPath(); ctx.moveTo(x,y-size-2); ctx.lineTo(x+size,y+2); ctx.lineTo(x-size,y+2); ctx.closePath();
          ctx.fillStyle=col; ctx.fill();
          // If this entry has a linked stop below, prefer label ABOVE arrow to avoid overlap
          const prefBelow=ann.stopPrice==null;
          execPlaceLbl(lbl,col,ann.stopPrice!=null?y-size-2:y+size+2,prefBelow);
          ctx.strokeStyle=col+'55'; ctx.lineWidth=1; ctx.setLineDash([2,3]);
          ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,priceH); ctx.stroke(); ctx.setLineDash([]);
        } else if(ann.type==='exit_arrow'){
          const col='#40c4ff'; const size=7;
          ctx.beginPath(); ctx.moveTo(x,y+size+2); ctx.lineTo(x+size,y-2); ctx.lineTo(x-size,y-2); ctx.closePath();
          ctx.fillStyle=col; ctx.fill();
          execPlaceLbl(lbl,col,y-size-2,false);
          ctx.strokeStyle=col+'55'; ctx.lineWidth=1; ctx.setLineDash([2,3]);
          ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,priceH); ctx.stroke(); ctx.setLineDash([]);
        } else if(ann.type==='short_arrow'){
          // Short entry: downward-pointing filled triangle, red
          const col='#ff5252'; const size=7;
          ctx.beginPath(); ctx.moveTo(x,y+size+2); ctx.lineTo(x+size,y-2); ctx.lineTo(x-size,y-2); ctx.closePath();
          ctx.fillStyle=col; ctx.fill();
          const prefBelow2=ann.stopPrice==null;
          execPlaceLbl(lbl,col,ann.stopPrice!=null?y+size+2:y-size-2,prefBelow2);
          ctx.strokeStyle=col+'55'; ctx.lineWidth=1; ctx.setLineDash([2,3]);
          ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,priceH); ctx.stroke(); ctx.setLineDash([]);
        } else if(ann.type==='cover_arrow'){
          // Cover (close short): upward-pointing filled triangle, green
          const col='#00e676'; const size=7;
          ctx.beginPath(); ctx.moveTo(x,y-size-2); ctx.lineTo(x+size,y+2); ctx.lineTo(x-size,y+2); ctx.closePath();
          ctx.fillStyle=col; ctx.fill();
          execPlaceLbl(lbl,col,y+size+2,true);
          ctx.strokeStyle=col+'55'; ctx.lineWidth=1; ctx.setLineDash([2,3]);
          ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,priceH); ctx.stroke(); ctx.setLineDash([]);
        } else if(ann.type==='stop_line'){
          // Auto-stops (paired with entry): extend right, label to the right of line
          // Manual stops: use smart placement
          if(ann._autoStop){
            // Extend line further right so label clears the entry label above
            const leftW=Math.max(14,barW*1.5);
            const rightW=Math.max(60,barW*8);
            ctx.strokeStyle='#facc15'; ctx.lineWidth=1.5; ctx.setLineDash([3,2]);
            ctx.beginPath(); ctx.moveTo(x-leftW,y); ctx.lineTo(x+rightW,y); ctx.stroke(); ctx.setLineDash([]);
            // Label always to the right of the line end
            ctx.font=`bold ${F.p}px Inter`; ctx.textAlign='left';
            const slbl2='S:'+lbl;
            const sw=ctx.measureText(slbl2).width;
            const lx=x+rightW+3, ly=y+4;
            ctx.fillStyle='rgba(10,12,20,0.8)'; ctx.fillRect(lx-2,ly-10,sw+4,12);
            ctx.fillStyle='#facc15'; ctx.fillText(slbl2,lx,ly);
          } else {
            const halfW=Math.max(14,barW*2.5);
            ctx.strokeStyle='#facc15'; ctx.lineWidth=1.5; ctx.setLineDash([3,2]);
            ctx.beginPath(); ctx.moveTo(x-halfW,y); ctx.lineTo(x+halfW,y); ctx.stroke(); ctx.setLineDash([]);
            execPlaceLbl('S:'+lbl,'#facc15',y,false);
          }
        } else if(ann.type==='trail_stop'){
          const halfW=Math.max(14,barW*2.5);
          ctx.strokeStyle='#38bdf8'; ctx.lineWidth=1.5; ctx.setLineDash([4,2]);
          ctx.beginPath(); ctx.moveTo(x-halfW,y); ctx.lineTo(x+halfW,y); ctx.stroke(); ctx.setLineDash([]);
          execPlaceLbl('T:'+lbl,'#38bdf8',y,false);
        }
        if((activeTool==='del'||activeTool==='edit')&&cx>=0&&cy>=0&&isAnnNear(ann,cx,cy,p,annTimeToX,pToY)){
          const hlCol=activeTool==='edit'?'rgba(251,191,36,0.7)':'rgba(255,61,87,0.7)';
          ctx.strokeStyle=hlCol; ctx.lineWidth=2; ctx.setLineDash([4,3]);
          ctx.beginPath(); ctx.arc(x,y,18,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
        }
        continue;
      }
      const x1=annTimeToX(ann.x1); if(x1==null) continue;
      const y1=pToY(ann.y1);
      if(isHLine){
        ctx.strokeStyle=ann.color||C.trendline;ctx.lineWidth=annLineWidth(ann);ctx.setLineDash(annLineDash(ann));
        ctx.beginPath();ctx.moveTo(0,y1);ctx.lineTo(chartW,y1);ctx.stroke();ctx.setLineDash([]);
      } else if(isVLine){
        const vx=annTimeToX(ann.x1);if(vx==null)continue;
        ctx.strokeStyle=ann.color||C.trendline;ctx.lineWidth=annLineWidth(ann);ctx.setLineDash(annLineDash(ann));
        ctx.beginPath();ctx.moveTo(vx,0);ctx.lineTo(vx,priceH);ctx.stroke();ctx.setLineDash([]);
      } else if(isTL){
        const x2=annTimeToX(ann.x2); if(x2==null) continue;
        const y2=pToY(ann.y2);
        ctx.strokeStyle=ann.color||C.trendline; ctx.lineWidth=annLineWidth(ann); ctx.setLineDash(annLineDash(ann));
        ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle=ann.color||C.trendline;
        ctx.beginPath();ctx.arc(x1,y1,3,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(x2,y2,3,0,Math.PI*2);ctx.fill();
        // Hollow centre so endpoints look like handles
        ctx.fillStyle=C.bg;
        ctx.beginPath();ctx.arc(x1,y1,1.5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(x2,y2,1.5,0,Math.PI*2);ctx.fill();
      } else if(isBox){
        const x2=annTimeToX(ann.x2); if(x2==null) continue;
        const y2=pToY(ann.y2);
        const col=ann.type==='box_orange'?C.box_orange:C.box_yellow;
        const bxX=Math.min(x1,x2),bxY=Math.min(y1,y2),bxW=Math.abs(x2-x1),bxH=Math.abs(y2-y1);
        ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.setLineDash([]);
        ctx.strokeRect(bxX,bxY,bxW,bxH);
        const rv=parseInt(col.slice(1,3),16),gv=parseInt(col.slice(3,5),16),bv=parseInt(col.slice(5,7),16);
        ctx.fillStyle=`rgba(${rv},${gv},${bv},0.07)`; ctx.fillRect(bxX,bxY,bxW,bxH);
      } else if(isTxt){
        // TradingView-style text with background box
        const tCol = ann.type==='text_orange' ? C.box_orange : C.box_yellow;
        const txt = ann.text || '';
        const fs = ann.fontSize || F.o;
        ctx.font = `${ann.fontWeight||'bold'} ${fs}px Inter`;
        const tw = ctx.measureText(txt).width;
        const pad = 6, bh = fs + pad*2, bw = tw + pad*2;
        const bx = x1 - 2, by = y1 - fs - pad + 2;
        // Background
        const r=parseInt(tCol.slice(1,3),16), g=parseInt(tCol.slice(3,5),16), b=parseInt(tCol.slice(5,7),16);
        ctx.fillStyle = `rgba(${r},${g},${b},0.12)`;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();
        // Border
        ctx.strokeStyle = `rgba(${r},${g},${b},0.35)`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.stroke();
        // Text
        ctx.fillStyle = tCol;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(txt, bx + pad, by + pad);
        ctx.textBaseline = 'alphabetic';
      } else if(isHl){
        const x2=annTimeToX(ann.x2); if(x2==null) continue;
        const y2=pToY(ann.y2);
        const col=C[ann.type]||'#22d3ee';
        const bxX=Math.min(x1,x2),bxY=Math.min(y1,y2),bxW=Math.abs(x2-x1),bxH=Math.abs(y2-y1);
        const rv=parseInt(col.slice(1,3),16),gv=parseInt(col.slice(3,5),16),bv=parseInt(col.slice(5,7),16);
        const op=ann.opacity??0.15;
        ctx.fillStyle=`rgba(${rv},${gv},${bv},${op})`; ctx.fillRect(bxX,bxY,bxW,bxH);
        ctx.strokeStyle=`rgba(${rv},${gv},${bv},${Math.min(1,op+0.15)})`; ctx.lineWidth=1; ctx.setLineDash([]);
        ctx.strokeRect(bxX,bxY,bxW,bxH);
      } else if(ann.type==='callout'){
        // TradingView-style callout: pointer line + rounded text box
        const x2=annTimeToX(ann.x2); if(x2==null) continue;
        const y2=pToY(ann.y2);
        const txt=ann.text||'Callout';
        const fs=ann.fontSize||11;
        ctx.font=`bold ${fs}px Inter`;
        const tw=ctx.measureText(txt).width;
        const pad=8, bh=fs+pad*2, bw=tw+pad*2;
        // Box centered on point 2
        const bx=x2-bw/2, by=y2-bh/2;
        // Pointer line from target to box edge
        ctx.strokeStyle=ann.color||'#f97316'; ctx.lineWidth=1.5; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        // Target dot
        ctx.fillStyle=ann.color||'#f97316';
        ctx.beginPath(); ctx.arc(x1,y1,3,0,Math.PI*2); ctx.fill();
        // Box background
        ctx.fillStyle='rgba(20,25,38,0.95)';
        ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,5); ctx.fill();
        // Box border
        ctx.strokeStyle=ann.color||'#f97316'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,5); ctx.stroke();
        // Text
        ctx.fillStyle=ann.color||'#f97316';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(txt,x2,y2);
        ctx.textAlign='left'; ctx.textBaseline='alphabetic';
      } else if(ann.type==='note'){
        // TradingView-style sticky note with folded corner
        const txt=ann.text||'Note';
        const fs=ann.fontSize||11;
        const noteW=ann.noteWidth||120;
        ctx.font=`${fs}px Inter`;
        // Wrap text
        const lines=wrapText(ctx,txt,noteW-16);
        const lh=fs*1.35;
        const noteH=Math.max(lines.length*lh+16, fs+20);
        const foldSize=10;
        // Note body (yellow sticky)
        const noteCol=ann.noteColor||'#fbbf24';
        const nr=parseInt(noteCol.slice(1,3),16), ng=parseInt(noteCol.slice(3,5),16), nb=parseInt(noteCol.slice(5,7),16);
        ctx.fillStyle=`rgba(${nr},${ng},${nb},0.15)`;
        ctx.beginPath();
        ctx.moveTo(x1,y1); ctx.lineTo(x1+noteW-foldSize,y1);
        ctx.lineTo(x1+noteW,y1+foldSize);
        ctx.lineTo(x1+noteW,y1+noteH); ctx.lineTo(x1,y1+noteH); ctx.closePath(); ctx.fill();
        // Folded corner (darker)
        ctx.fillStyle=`rgba(${nr},${ng},${nb},0.3)`;
        ctx.beginPath();
        ctx.moveTo(x1+noteW-foldSize,y1);
        ctx.lineTo(x1+noteW-foldSize,y1+foldSize);
        ctx.lineTo(x1+noteW,y1+foldSize); ctx.closePath(); ctx.fill();
        // Border
        ctx.strokeStyle=`rgba(${nr},${ng},${nb},0.4)`; ctx.lineWidth=1; ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x1,y1); ctx.lineTo(x1+noteW-foldSize,y1);
        ctx.lineTo(x1+noteW,y1+foldSize);
        ctx.lineTo(x1+noteW,y1+noteH); ctx.lineTo(x1,y1+noteH); ctx.closePath(); ctx.stroke();
        // Pin dot
        ctx.fillStyle=noteCol;
        ctx.beginPath(); ctx.arc(x1+6,y1+3,2,0,Math.PI*2); ctx.fill();
        // Text lines
        ctx.fillStyle='#dde3f0'; ctx.textAlign='left'; ctx.textBaseline='top';
        for(let i=0;i<lines.length;i++){
          ctx.fillText(lines[i],x1+8,y1+10+i*lh);
        }
        ctx.textBaseline='alphabetic';
      } else if(ann.type==='price_label'){
        // TradingView-style price label — pill on the price axis
        const txt=ann.text||(ann.y1?ann.y1.toFixed(2):'');
        const fs=ann.fontSize||10;
        ctx.font=`bold ${fs}px Inter`;
        const tw=ctx.measureText(txt).width;
        const pad=6, bh=fs+pad*2, bw=tw+pad*2+6;
        const pRight=p.W-p.PRICE_W; // right edge of chart area
        const lx=pRight-4, ly=y1-bh/2;
        // Pill background
        ctx.fillStyle=ann.color||'#26a69a';
        ctx.beginPath(); ctx.roundRect(lx-bw,ly,bw,bh,bh/2); ctx.fill();
        // Arrow nub
        ctx.beginPath();
        ctx.moveTo(lx,y1-4); ctx.lineTo(lx+4,y1); ctx.lineTo(lx,y1+4); ctx.closePath(); ctx.fill();
        // Text
        ctx.fillStyle='#000'; ctx.textAlign='right'; ctx.textBaseline='middle';
        ctx.fillText(txt,lx-pad,ly+bh/2);
        ctx.textAlign='left'; ctx.textBaseline='alphabetic';
      } else if(ann.type==='flag'){
        // TradingView-style flag on a pole
        const flagCol=ann.color||'#ef5350';
        const fr=parseInt(flagCol.slice(1,3),16), fg=parseInt(flagCol.slice(3,5),16), fb=parseInt(flagCol.slice(5,7),16);
        // Pole
        ctx.strokeStyle=flagCol; ctx.lineWidth=1.5; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x1,y1-24); ctx.stroke();
        // Flag triangle
        ctx.fillStyle=`rgba(${fr},${fg},${fb},0.8)`;
        ctx.beginPath();
        ctx.moveTo(x1,y1-24); ctx.lineTo(x1+16,y1-20); ctx.lineTo(x1,y1-16); ctx.closePath(); ctx.fill();
        // Optional text
        if(ann.text){
          const fs=9;
          ctx.font=`bold ${fs}px Inter`;
          ctx.fillStyle=flagCol; ctx.textAlign='left'; ctx.textBaseline='middle';
          ctx.fillText(ann.text,x1+20,y1-20);
          ctx.textBaseline='alphabetic';
        }
      }
      // Reset opacity after each annotation
      ctx.globalAlpha=1;
      if(activeTool==='del'&&cx>=0&&cy>=0&&isAnnNear(ann,cx,cy,p,annTimeToX,pToY)){
        ctx.strokeStyle='rgba(255,61,87,0.7)'; ctx.lineWidth=2; ctx.setLineDash([4,3]);
        if(isTL){const x2=annTimeToX(ann.x2)||x1,y2=pToY(ann.y2);ctx.beginPath();ctx.moveTo(x1-4,y1-4);ctx.lineTo(x2+4,y2+4);ctx.stroke();}
        else if(isBox||isHl){const x2=annTimeToX(ann.x2)||x1,y2=pToY(ann.y2);ctx.strokeRect(Math.min(x1,x2)-3,Math.min(y1,y2)-3,Math.abs(x2-x1)+6,Math.abs(y2-y1)+6);}
        else if(isTxt){ctx.strokeRect(x1-3,y1-14,60,18);}
        ctx.setLineDash([]);
      }
    }
  }

  // ── SELECTION HIGHLIGHT ──
  if(selectedAnn&&selectedAnn.panelIdx===p.idx){
    const ann=selectedAnn;
    const sx1=annTimeToX(ann.x1);if(sx1!=null){
    const sy1=pToY(ann.y1);
    const SEL_COL='rgba(251,191,36,0.8)'; // gold
    const SEL_DASH=[5,3];
    ctx.save(); ctx.strokeStyle=SEL_COL; ctx.lineWidth=1.5; ctx.setLineDash(SEL_DASH);
    if(ann.type==='trendline'||ann.type==='ray'||ann.type==='hray'||ann.type==='fib_ret'){
      const sx2=annTimeToX(ann.x2);if(sx2!=null){
        const sy2=pToY(ann.y2);
        if(ann.type==='hray'){ctx.beginPath();ctx.moveTo(sx1,sy1);ctx.lineTo(chartW,sy1);ctx.stroke();}
        else if(ann.type==='ray'){const end=getRayRightPoint(sx1,sy1,sx2,sy2,chartW);ctx.beginPath();ctx.moveTo(sx1,sy1);ctx.lineTo(end.x,end.y);ctx.stroke();}
        else {ctx.beginPath();ctx.moveTo(sx1,sy1);ctx.lineTo(sx2,sy2);ctx.stroke();}
        drawHandle(ctx,sx1,sy1,SEL_COL);drawHandle(ctx,sx2,sy2,SEL_COL);
      }
    } else if(ann.type==='parallel'||ann.type==='disjoint'){
      const sx2=annTimeToX(ann.x2), sx3=annTimeToX(ann.x3); if(sx2!=null&&sx3!=null){
        const sy2=pToY(ann.y2), sy3=pToY(ann.y3), dx=sx2-sx1, dy=sy2-sy1;
        ctx.beginPath();ctx.moveTo(sx1,sy1);ctx.lineTo(sx2,sy2);ctx.moveTo(sx3,sy3);ctx.lineTo(sx3+dx,sy3+dy);ctx.stroke();
        drawHandle(ctx,sx1,sy1,SEL_COL);drawHandle(ctx,sx2,sy2,SEL_COL);drawHandle(ctx,sx3,sy3,SEL_COL);
      }
    } else if(ann.type==='hline'){
      ctx.beginPath();ctx.moveTo(0,sy1);ctx.lineTo(chartW,sy1);ctx.stroke();drawHandle(ctx,sx1,sy1,SEL_COL);
    } else if(ann.type==='vline'){
      ctx.beginPath();ctx.moveTo(sx1,0);ctx.lineTo(sx1,priceH);ctx.stroke();drawHandle(ctx,sx1,sy1,SEL_COL);
    } else if(ann.type==='xline'){
      ctx.beginPath();ctx.moveTo(0,sy1);ctx.lineTo(chartW,sy1);ctx.moveTo(sx1,0);ctx.lineTo(sx1,priceH);ctx.stroke();drawHandle(ctx,sx1,sy1,SEL_COL);
    } else if(ann.type.startsWith('box_')||ann.type==='circle'||ann.type==='ellipse'||ann.type==='triangle'||ann.type==='gann_box'||(ann.type.startsWith('hl_')&&!isPointArrayAnn(ann))){
      const sx2=annTimeToX(ann.x2);if(sx2!=null){
        const sy2=pToY(ann.y2);
        const bx=Math.min(sx1,sx2),by=Math.min(sy1,sy2),bw=Math.abs(sx2-sx1),bh=Math.abs(sy2-sy1);
        ctx.strokeRect(bx-2,by-2,bw+4,bh+4);
        drawHandle(ctx,bx,by,SEL_COL);drawHandle(ctx,bx+bw,by,SEL_COL);
        drawHandle(ctx,bx,by+bh,SEL_COL);drawHandle(ctx,bx+bw,by+bh,SEL_COL);
      }
    } else if(isPointArrayAnn(ann)){
      const pts=getScreenPointsFromAnn(ann,annTimeToX,pToY), bounds=getPointBounds(pts);
      if(bounds){ctx.strokeRect(bounds.minX-4,bounds.minY-4,bounds.maxX-bounds.minX+8,bounds.maxY-bounds.minY+8);}
    } else if(ann.type.startsWith('text_')){
      const tw=ctx.measureText(ann.text||'T').width+22;
      ctx.strokeRect(sx1-6,sy1-(ann.fontSize||F.o)-8,tw,(ann.fontSize||F.o)+16);
      drawHandle(ctx,sx1-6,sy1-(ann.fontSize||F.o)-8,SEL_COL);
      drawHandle(ctx,sx1+tw-6,sy1+8,SEL_COL);
    } else if(ann.type==='callout'){
      const sx2=annTimeToX(ann.x2);if(sx2!=null){
        const sy2=pToY(ann.y2);
        ctx.strokeRect(sx2-30,sy2-15,60,30);
        drawHandle(ctx,sx1,sy1,SEL_COL); drawHandle(ctx,sx2,sy2,SEL_COL);
      }
    } else if(ann.type==='note'){
      const nw=ann.noteWidth||120;
      ctx.strokeRect(sx1,sy1,nw,60);
      drawHandle(ctx,sx1,sy1,SEL_COL); drawHandle(ctx,sx1+nw,sy1+60,SEL_COL);
    } else if(ann.type==='price_label'||ann.type==='flag'||ann.type==='entry_arrow'||ann.type==='exit_arrow'||ann.type==='short_arrow'||ann.type==='cover_arrow'||ann.type==='stop_line'||ann.type==='trail_stop'){
      ctx.beginPath();ctx.arc(sx1,sy1,14,0,Math.PI*2);ctx.stroke();drawHandle(ctx,sx1,sy1,SEL_COL);
    } else if(ann.type==='long_pos'||ann.type==='short_pos'){
      ctx.beginPath();ctx.moveTo(sx1,sy1);ctx.lineTo(chartW,sy1);ctx.moveTo(sx1,pToY(ann.y2));ctx.lineTo(chartW,pToY(ann.y2));ctx.moveTo(sx1,pToY(ann.y3||ann.y1));ctx.lineTo(chartW,pToY(ann.y3||ann.y1));ctx.stroke();
      drawHandle(ctx,sx1,sy1,SEL_COL);drawHandle(ctx,sx1,pToY(ann.y2),SEL_COL);drawHandle(ctx,sx1,pToY(ann.y3||ann.y1),SEL_COL);
    }
    ctx.restore();
    }
  }

  // ── ANNOTATION PREVIEW ──
  if((activeTool&&toolAnchor?.panelIdx===p.idx&&cx>=0&&cy>=0)||freehandState?.panelIdx===p.idx){
    if(renderAdvancedPreview(ctx,p,chartW,priceH,annTimeToX,pToY,cx,cy)){
      // handled by advanced preview renderer
    } else if(activeTool&&toolStep==='second'&&toolAnchor?.panelIdx===p.idx&&cx>=0&&cy>=0){
    const ax=annTimeToX(toolAnchor.time)||toolAnchor.rawX, ay=pToY(toolAnchor.price);
    const col=activeTool==='trendline'?C.trendline:C[activeTool]||(activeTool==='box_orange'?C.box_orange:C.box_yellow);
    if(activeTool==='trendline'||activeTool==='ray'){
      ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
      ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(cx,cy);
      if(activeTool==='ray')ctx.lineTo(cx+(cx-ax)*3,cy+(cy-ay)*3); // extend ray
      ctx.stroke();
      ctx.setLineDash([]);
    } else if(activeTool==='measure'){
      ctx.strokeStyle='#8aa0c0'; ctx.lineWidth=1; ctx.setLineDash([3,2]);
      ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(cx,cy);ctx.stroke();
      ctx.setLineDash([]);
      const dt=Math.abs(cx-ax),dp=Math.abs(cy-ay);
      ctx.fillStyle='#dde3f0';ctx.font=F.p+'px Inter';
      ctx.fillText(dt.toFixed(0)+'px, '+dp.toFixed(0)+'px',(ax+cx)/2+4,(ay+cy)/2-4);
    } else if(activeTool.startsWith('box_')){
      ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
      ctx.strokeRect(Math.min(ax,cx),Math.min(ay,cy),Math.abs(cx-ax),Math.abs(cy-ay));
      ctx.setLineDash([]);
    } else if(activeTool.startsWith('hl_')){
      const rv=parseInt(col.slice(1,3),16),gv=parseInt(col.slice(3,5),16),bv=parseInt(col.slice(5,7),16);
      const op=(parseInt(document.getElementById('hl-opacity').value)||35)/100;
      ctx.fillStyle=`rgba(${rv},${gv},${bv},${op})`;
      ctx.fillRect(Math.min(ax,cx),Math.min(ay,cy),Math.abs(cx-ax),Math.abs(cy-ay));
      ctx.strokeStyle=`rgba(${rv},${gv},${bv},${Math.min(1,op+0.15)})`; ctx.lineWidth=1; ctx.setLineDash([4,3]);
      ctx.strokeRect(Math.min(ax,cx),Math.min(ay,cy),Math.abs(cx-ax),Math.abs(cy-ay));
      ctx.setLineDash([]);
    } else if(activeTool==='fib_ret'){
      const {min:gMin,max:gMax}=getMinMax(p);
      const cursorPrice=gMin+(gMax-gMin)*(1-cy/priceH);
      const gH=Math.max(toolAnchor.price,cursorPrice);
      const gL=Math.min(toolAnchor.price,cursorPrice);
      const gSwing=gH-gL;
      if(gSwing>0){
        const GHOST_LEVELS=[
          {pct:0.30,col:'#f472b6'},{pct:0.40,col:'#fb923c'},
          {pct:0.50,col:'#facc15'},{pct:0.60,col:'#34d399'},{pct:0.70,col:'#60a5fa'},
        ];
        ctx.font=`bold ${F.p}px Inter`;
        ctx.fillStyle='rgba(167,139,250,0.8)';
        ctx.beginPath(); ctx.arc(ax,ay,4,0,Math.PI*2); ctx.fill();
        for(const fl of GHOST_LEVELS){
          const price=gH-gSwing*fl.pct;
          const y=pToY(price);
          if(y<-2||y>priceH+2) continue;
          ctx.strokeStyle=fl.col+'aa'; ctx.lineWidth=1; ctx.setLineDash([5,4]);
          ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(chartW,y); ctx.stroke();
          ctx.setLineDash([]);
          const lbl=`${(fl.pct*100).toFixed(0)}% ${fmtPrice(price)}`;
          const tw=ctx.measureText(lbl).width;
          ctx.fillStyle='rgba(10,12,20,0.65)';
          ctx.fillRect(chartW-tw-8,y-11,tw+6,13);
          ctx.fillStyle=fl.col+'cc'; ctx.textAlign='right';
          ctx.fillText(lbl,chartW-4,y-1);
        }
      }
    }
    } // close else-if wrapper
  }
  ctx.restore();

  // ── BACKTEST MARKERS ──
  if(btMarkers.length && p.showBtExec){
    ctx.save();
    ctx.beginPath(); ctx.rect(0,0,chartW,priceH); ctx.clip();
    const useDate=!isIntraday(p.tf);

    // Smart label placement: pick above/below/side with most clearance from candles
    const placeLbl=(ctx,lbl,col,x,anchorY,prefBelow)=>{
      ctx.font='bold 11px Inter';
      const tw=ctx.measureText(lbl).width;
      const th=12, pad=4;
      // Sample candle pixel ranges for bars near x (within ±2 bars)
      const nearBars=[];
      for(let ni=0;ni<visible.length;ni++){
        const bx=(ni+0.5)*barW;
        if(Math.abs(bx-x)<barW*2.5) nearBars.push(visible[ni]);
      }
      const candleHighY=nearBars.length?Math.min(...nearBars.map(b=>pToY(b.high))):0;
      const candleLowY =nearBars.length?Math.max(...nearBars.map(b=>pToY(b.low))):priceH;
      // Candidate positions: below anchor, above anchor, right side, left side
      const below={tx:x, ty:anchorY+pad+th, align:'center'};
      const above={tx:x, ty:anchorY-pad,     align:'center'};
      const right={tx:x+tw/2+pad+4, ty:anchorY+4, align:'left'};
      const left ={tx:x-tw/2-pad-4, ty:anchorY+4, align:'right'};
      // Score each: lower = less overlap with candle bodies
      const score=(pos)=>{
        const ly=pos.ty, lx=pos.tx;
        // penalise if text rect overlaps candle zone
        const txtTop=ly-th, txtBot=ly, txtL=lx-tw/2, txtR=lx+tw/2;
        let penalty=0;
        if(txtBot>candleHighY && txtTop<candleLowY) penalty+=100; // overlaps candle range
        if(ly<0||ly>priceH) penalty+=200; // off screen
        if(txtL<0) penalty+=50;
        if(txtR>chartW) penalty+=50;
        return penalty;
      };
      const candidates=prefBelow?[below,above,right,left]:[above,below,right,left];
      candidates.sort((a,b)=>score(a)-score(b));
      const best=candidates[0];
      ctx.textAlign=best.align;
      // Dark background for readability
      const bgX=best.align==='center'?best.tx-tw/2-2:best.align==='left'?best.tx-2:best.tx-tw-2;
      ctx.fillStyle='rgba(10,12,20,0.75)';
      ctx.fillRect(bgX,best.ty-th,tw+4,th+2);
      ctx.fillStyle=col;
      ctx.fillText(lbl,best.tx,best.ty);
    };

    for(const m of btMarkers){
      const matchTime=useDate?m.date:m.time;
      const x=annTimeToX(matchTime); if(x==null) continue;
      const y=pToY(m.price);
      const isEntry=m.type==='entry';
      const isStop=m.type==='stop';

      if(isStop){
        const halfW=Math.max(14, barW*2.5);
        ctx.strokeStyle='#facc15'; ctx.lineWidth=1.5; ctx.setLineDash([3,2]);
        ctx.beginPath(); ctx.moveTo(x-halfW,y); ctx.lineTo(x+halfW,y); ctx.stroke();
        ctx.setLineDash([]);
        placeLbl(ctx,'S:'+m.label,'#facc15',x+halfW+ctx.measureText('S:'+m.label).width/2+4,y,false);
        continue;
      }

      const col=(btStrategyMode==='long')?(isEntry?'#00e676':'#ff5252'):(isEntry?'#ff5252':'#00e676');
      const size=7;
      ctx.beginPath();
      if(isEntry){
        ctx.moveTo(x,y-size-2); ctx.lineTo(x+size,y+2); ctx.lineTo(x-size,y+2);
      } else {
        ctx.moveTo(x,y+size+2); ctx.lineTo(x+size,y-2); ctx.lineTo(x-size,y-2);
      }
      ctx.closePath(); ctx.fillStyle=col; ctx.fill();
      placeLbl(ctx,m.label,col,x,isEntry?y+size+2:y-size-2,isEntry);
      ctx.strokeStyle=col+'55'; ctx.lineWidth=1; ctx.setLineDash([2,3]);
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,priceH); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
  // Sync crosshair from another panel
  if((cx<0||cx>chartW)&&globalCrossTime>0&&data.length){
    // Find bar index matching globalCrossTime
    let syncBi=-1,bestD=Infinity;
    for(let _i=0;_i<visible.length;_i++){
      const d=Math.abs(visible[_i].time-globalCrossTime);
      if(d<bestD){bestD=d;syncBi=_i;}
    }
    if(syncBi>=0){
      const syncX=xCtr(syncBi);
      ctx.strokeStyle='rgba(180,200,255,0.25)'; ctx.lineWidth=1; ctx.setLineDash([3,4]);
      // Vertical line
      ctx.beginPath();ctx.moveTo(syncX,0);ctx.lineTo(syncX,priceH+volH);ctx.stroke();
      // Horizontal line at the source panel's cursor price (mapped to this panel's scale)
      if(globalCrossPrice>0&&priceRange>0){
        const syncY=priceH*(1-(globalCrossPrice-minP)/priceRange);
        if(syncY>=0&&syncY<=priceH){
          ctx.beginPath();ctx.moveTo(0,syncY);ctx.lineTo(chartW,syncY);ctx.stroke();
          ctx.setLineDash([]);
          // Price label on right axis
          ctx.fillStyle=C.crossLabelBg;ctx.fillRect(chartW,syncY-10,PRICE_W,20);
          ctx.strokeStyle=C.crossLabelBd;ctx.lineWidth=1;ctx.strokeRect(chartW,syncY-10,PRICE_W,20);
          ctx.fillStyle=C.axisHighlight;ctx.font=`bold ${F.p}px Inter`;ctx.textAlign='right';
          ctx.fillText(fmtPrice(globalCrossPrice),W-4,syncY+4);
        }
      }
      ctx.setLineDash([]);
      // Time label
      const slbl=fmtTimeCross(visible[syncBi].time,tf);
      ctx.font=`bold ${F.t}px Inter`; ctx.textAlign='center';
      const stw=ctx.measureText(slbl).width+10;
      ctx.fillStyle='#141a2a';ctx.fillRect(syncX-stw/2,H-TIME_H,stw,TIME_H);
      ctx.strokeStyle='#2a3050';ctx.lineWidth=1;ctx.strokeRect(syncX-stw/2,H-TIME_H,stw,TIME_H);
      ctx.fillStyle='#8090b0';ctx.fillText(slbl,syncX,H-TIME_H+13);
    }
  }

  if(cx>=0&&cx<=chartW&&cy>=0&&cy<=priceH+volH){
    ctx.strokeStyle=C.cross; ctx.lineWidth=1; ctx.setLineDash([3,3]);
    ctx.beginPath();ctx.moveTo(cx,0);ctx.lineTo(cx,priceH+volH);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,cy);ctx.lineTo(chartW,cy);ctx.stroke();
    ctx.setLineDash([]);
    if(cy<=priceH){
      const hp=minP+priceRange*(1-cy/priceH);
      ctx.fillStyle='#1a2040';ctx.fillRect(chartW,cy-10,PRICE_W,20);
      ctx.strokeStyle='#2a3050';ctx.lineWidth=1;ctx.strokeRect(chartW,cy-10,PRICE_W,20);
      ctx.fillStyle='#00e676';ctx.font=`bold ${F.p}px Inter`;ctx.textAlign='right';
      ctx.fillText(fmtPrice(hp),W-4,cy+4);
    } else if(volH>0&&cy>priceH&&cy<=priceH+volH){
      // Cursor is in volume pane — show volume value on right axis
      const maxVol=Math.max(...visible.map(b=>b.volume||0))||1;
      const volFrac=1-(cy-priceH)/volH;
      const hv=maxVol*volFrac/0.92; // reverse the 0.92 scale factor
      ctx.fillStyle='#1a2040';ctx.fillRect(chartW,cy-10,PRICE_W,20);
      ctx.strokeStyle='#2a3050';ctx.lineWidth=1;ctx.strokeRect(chartW,cy-10,PRICE_W,20);
      ctx.fillStyle='#8080e8';ctx.font=`bold ${F.p}px Inter`;ctx.textAlign='right';
      ctx.fillText(fmtVol(Math.max(0,hv)),W-4,cy+4);
    }
    // Find bar closest to cursor (compressed slots = simple division)
    const bi=Math.max(0,Math.min(visible.length-1,Math.round(cx/barW)));
    const bar=visible[bi];
    if(bar){
      const lbl=fmtTimeCross(bar.time,tf);
      ctx.font=`bold ${F.t}px Inter`; ctx.textAlign='center';
      const tw=ctx.measureText(lbl).width+10;
      const lx=xCtr(bi);
      ctx.fillStyle='#1a2040';ctx.fillRect(lx-tw/2,H-TIME_H,tw,TIME_H);
      ctx.strokeStyle='#2a3050';ctx.strokeRect(lx-tw/2,H-TIME_H,tw,TIME_H);
      ctx.fillStyle='#D4AF37';ctx.fillText(lbl,lx,H-TIME_H+13);
      const chg=bar.close-bar.open,pct=((chg/bar.open)*100).toFixed(2);
      const cc=chg>=0?'#26a69a':'#ef5350';
      document.getElementById(`ohlc-${p.idx}`).innerHTML=
        `O<span style="color:#dde3f0"> ${fmtPrice(bar.open)}</span> `+
        `H<span style="color:#26a69a"> ${fmtPrice(bar.high)}</span> `+
        `L<span style="color:#ef5350"> ${fmtPrice(bar.low)}</span> `+
        `C<span style="color:${cc}"> ${fmtPrice(bar.close)}</span> `+
        `V<span style="color:#8080e8"> ${fmtVol(bar.volume)}</span> `+
        `<span style="color:${cc}">(${chg>=0?'+':''}${pct}%)</span>`;
    }
  }

  ctx.strokeStyle='#1e2535';ctx.lineWidth=1;ctx.setLineDash([]);
  ctx.strokeRect(.5,.5,chartW-1,priceH+volH-1);

  // ── LIVE PRICE LINE ──
  if(showPriceLine&&data.length){
    const lastClose=data[data.length-1].close;
    const ly=pToY(lastClose);
    if(ly>=0&&ly<=priceH){
      const lineCol=data[data.length-1].close>=data[data.length-1].open?C.up:C.dn;
      ctx.save();
      ctx.strokeStyle=lineCol; ctx.lineWidth=1.2; ctx.setLineDash([4,3]);
      ctx.beginPath();ctx.moveTo(0,ly);ctx.lineTo(chartW,ly);ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle=lineCol; ctx.fillRect(chartW,ly-10,PRICE_W,20);
      // Pick text color that contrasts with the label background
      const _hex=colorToHex(lineCol);
      const _lum=(parseInt(_hex.slice(1,3),16)*299+parseInt(_hex.slice(3,5),16)*587+parseInt(_hex.slice(5,7),16)*114)/1000;
      ctx.fillStyle=_lum>160?'#000':'#fff'; ctx.font=`bold ${F.p}px Inter`; ctx.textAlign='right';
      ctx.fillText(fmtPrice(lastClose),W-4,ly+4);
      ctx.restore();
    }
  }
}


// Check if annotation is near mouse (for delete highlight)
// Returns {ann, endpoint:'1'|'2'|'3'} for draggable handles on supported annotations.
function findTLEndpoint(mx,my,p,chartW,priceH){
  const HIT=20;
  const vs=Math.max(0,Math.min(p.viewStart,Math.max(0,p.data.length-p.viewBars)));
  const vlen=Math.min(p.viewBars,p.data.length-vs);
  const barW=chartW/Math.max(vlen+(window.RIGHT_PAD||6),1); // must match renderPanel RIGHT_PAD=6
  function toX(t){
    const ts=toUnix(t); let lo=-1,hi=-1;
    for(let i=0;i<p.data.length;i++){const bt=toUnix(p.data[i].time);if(bt<=ts)lo=i;if(bt>=ts&&hi<0)hi=i;}
    if(lo<0&&hi<0) return null;
    if(lo<0) return(hi-vs+0.5)*barW;
    if(hi<0) return(lo-vs+0.5)*barW;
    if(lo===hi) return(lo-vs+0.5)*barW;
    const loT=toUnix(p.data[lo].time),hiT=toUnix(p.data[hi].time);
    const frac=(hiT===loT)?0:(ts-loT)/(hiT-loT);
    return((lo+frac*(hi-lo))-vs+0.5)*barW;
  }
  const {min,max}=getMinMax(p);
  const toY=v=>Math.max(0,Math.min(priceH, priceH-((v-min)/(max-min))*priceH));
  let bestHit=null, bestDist=Infinity;
  function testHandle(ann,key,hx,hy){
    if(hx==null||hy==null) return;
    const dist=Math.hypot(mx-hx,my-hy);
    if(dist<HIT&&dist<bestDist){bestDist=dist; bestHit={ann:endAnnHidden(ann)?null:ann,endpoint:key};}
  }
  function endAnnHidden(ann){ return !ann||ann.hidden||_hideAll||ann.panelIdx!=null&&ann.panelIdx!==p.idx; }
  for(const ann of annotations){
    if(endAnnHidden(ann)) continue;
    const x1=toX(ann.x1); if(x1==null) continue;
    const y1=toY(ann.y1);
    if(ann.type==='hline'||ann.type==='vline'||ann.type==='xline'){ testHandle(ann,'1',x1,y1); continue; }
    if(ann.type==='long_pos'||ann.type==='short_pos'){
      testHandle(ann,'1',x1,toY(ann.y1)); testHandle(ann,'2',x1,toY(ann.y2)); testHandle(ann,'3',x1,toY(ann.y3||ann.y1)); continue;
    }
    if(ann.type==='parallel'||ann.type==='disjoint'){
      const x2=toX(ann.x2), x3=toX(ann.x3); if(x2==null||x3==null) continue;
      testHandle(ann,'1',x1,y1); testHandle(ann,'2',x2,toY(ann.y2)); testHandle(ann,'3',x3,toY(ann.y3));
      continue;
    }
    if(ann.type==='trendline'||ann.type==='ray'||ann.type==='hray'||ann.type==='fib_ret'||ann.type==='circle'||ann.type==='ellipse'||ann.type==='triangle'||ann.type==='gann_box'||ann.type.startsWith('box_')){
      const x2=toX(ann.x2); if(x2==null) continue;
      testHandle(ann,'1',x1,y1); testHandle(ann,'2',x2,toY(ann.y2));
    }
  }
  return bestHit&&bestHit.ann?bestHit:null;
}

function annLineDash(ann){
  if(!ann.dashed) return [];
  if(ann.dashed==='dotted') return [2,4];
  return [6,4];
}
function annLineWidth(ann){return ann.lineWidth||2;}

function drawHandle(ctx,x,y,col){
  ctx.save();ctx.setLineDash([]);
  ctx.fillStyle='#10131a';ctx.strokeStyle=col;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.restore();
}

function wrapText(ctx,text,maxW){const words=text.split(' ');const lines=[];let cur='';for(const w of words){const test=cur?cur+' '+w:w;if(ctx.measureText(test).width>maxW&&cur){lines.push(cur);cur=w;}else cur=test;}if(cur)lines.push(cur);return lines;}
function hexToRgb(col){
  if(!col||typeof col!=='string'||col[0]!=='#') return null;
  var hex=col.slice(1); if(hex.length===3) hex=hex.split('').map(function(c){return c+c;}).join('');
  if(hex.length!==6) return null;
  return {r:parseInt(hex.slice(0,2),16),g:parseInt(hex.slice(2,4),16),b:parseInt(hex.slice(4,6),16)};
}
function colorWithAlpha(col,alpha){
  if(col&&col.startsWith('rgba(')) return col.replace(/rgba\(([^)]+),[^,]+\)$/,'rgba($1,'+alpha+')');
  var rgb=hexToRgb(col||'#dde3f0');
  return rgb?('rgba('+rgb.r+','+rgb.g+','+rgb.b+','+alpha+')'):(col||'#dde3f0');
}
function pointToSegmentDistance(px,py,x1,y1,x2,y2){
  var dx=x2-x1, dy=y2-y1;
  if(!dx&&!dy) return Math.hypot(px-x1,py-y1);
  var t=((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy);
  t=Math.max(0,Math.min(1,t));
  var sx=x1+t*dx, sy=y1+t*dy;
  return Math.hypot(px-sx,py-sy);
}
function distanceToPolyline(px,py,pts,closed){
  if(!Array.isArray(pts)||pts.length<2) return Infinity;
  var best=Infinity;
  for(var i=1;i<pts.length;i++) best=Math.min(best,pointToSegmentDistance(px,py,pts[i-1].x,pts[i-1].y,pts[i].x,pts[i].y));
  if(closed&&pts.length>2) best=Math.min(best,pointToSegmentDistance(px,py,pts[pts.length-1].x,pts[pts.length-1].y,pts[0].x,pts[0].y));
  return best;
}
function renderPolylinePath(ctx,pts,closed){
  if(!Array.isArray(pts)||!pts.length) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
  if(closed&&pts.length>2) ctx.closePath();
}
function isPointArrayAnn(ann){return !!(ann&&Array.isArray(ann.points)&&ann.points.length>0);}
function getRayRightPoint(x1,y1,x2,y2,targetX){
  if(x2==null||y2==null) return {x:targetX,y:y1};
  if(Math.abs(x2-x1)<0.0001) return {x:x1,y:y2};
  var slope=(y2-y1)/(x2-x1);
  return {x:targetX,y:y1+slope*(targetX-x1)};
}
function getScreenPointsFromAnn(ann,annTimeToX,pToY){
  if(!isPointArrayAnn(ann)) return [];
  var pts=[];
  for(var i=0;i<ann.points.length;i++){
    var sx=annTimeToX(ann.points[i].x);
    if(sx==null) continue;
    pts.push({x:sx,y:pToY(ann.points[i].y)});
  }
  return pts;
}
function getPointBounds(pts){
  if(!pts.length) return null;
  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  pts.forEach(function(pt){if(pt.x<minX)minX=pt.x;if(pt.x>maxX)maxX=pt.x;if(pt.y<minY)minY=pt.y;if(pt.y>maxY)maxY=pt.y;});
  return {minX,minY,maxX,maxY};
}
function snapPriceToMagnet(p,time,price){
  if(!_magnetSnap||!p||!p.data||!p.data.length||!isFinite(price)) return price;
  var bestBar=p.data[0], bestDt=Infinity;
  for(var i=0;i<p.data.length;i++){
    var dt=Math.abs(toUnix(p.data[i].time)-time);
    if(dt<bestDt){bestDt=dt;bestBar=p.data[i];}
  }
  var vals=[bestBar.open,bestBar.high,bestBar.low,bestBar.close].filter(function(v){return isFinite(v);});
  var bestPrice=price, bestDiff=Infinity;
  vals.forEach(function(v){var d=Math.abs(v-price); if(d<bestDiff){bestDiff=d; bestPrice=v;}});
  return bestPrice;
}
function snapDrawPoint(p,time,price){return {time:time,price:snapPriceToMagnet(p,time,price)};}
function finishPathAnnotation(){
  if(activeTool!=='path'||!toolAnchor||!Array.isArray(toolAnchor.points)||toolAnchor.points.length<2) return false;
  var pts=toolAnchor.points.map(function(pt){return {x:pt.x,y:pt.y};});
  var ann={id:nextId++,type:'path',panelIdx:toolAnchor.panelIdx,points:pts,x1:pts[0].x,y1:pts[0].y,x2:pts[pts.length-1].x,y2:pts[pts.length-1].y};
  applyDrawDefaults(ann);
  annotations.push(ann);
  toolStep='first'; toolAnchor=null;
  renderAll(); toast('✓ path placed');
  if(!_stayDraw) setActiveTool(null); else updateHint('PATH: click to add points, double-click or Enter to finish');
  return true;
}
function finishFreehandAnnotation(){
  if(!freehandState||!Array.isArray(freehandState.points)||freehandState.points.length<2) return false;
  var pts=freehandState.points.map(function(pt){return {x:pt.x,y:pt.y};});
  var ann={id:nextId++,type:freehandState.type,panelIdx:freehandState.panelIdx,points:pts,x1:pts[0].x,y1:pts[0].y,x2:pts[pts.length-1].x,y2:pts[pts.length-1].y,color:freehandState.color,lineWidth:freehandState.lineWidth,opacity:freehandState.opacity};
  applyDrawDefaults(ann);
  annotations.push(ann);
  freehandState=null;
  renderAll(); toast('✓ '+(ann.type==='brush'?'brush':'highlight')+' placed');
  if(!_stayDraw) setActiveTool(null);
  return true;
}
function applyAnnHandleMove(hit,time,price){
  if(!hit||!hit.ann) return false;
  var ann=hit.ann, key=hit.endpoint;
  if(ann.type==='hline'){ann.y1=price;ann.y2=price;return true;}
  if(ann.type==='vline'){ann.x1=time;ann.x2=time;return true;}
  if(ann.type==='xline'){ann.x1=time;ann.x2=time;ann.y1=price;ann.y2=price;return true;}
  if(ann.type==='long_pos'||ann.type==='short_pos'){
    if(key==='1') ann.y1=price; else if(key==='2') ann.y2=price; else if(key==='3') ann.y3=price;
    return true;
  }
  if(ann.type==='parallel'||ann.type==='disjoint'){
    if(key==='1'){ann.x1=time;ann.y1=price;} else if(key==='2'){ann.x2=time;ann.y2=price;} else if(key==='3'){ann.x3=time;ann.y3=price;}
    return true;
  }
  if(key==='1'){ann.x1=time;ann.y1=price;return true;}
  if(key==='2'){ann.x2=time;ann.y2=price;return true;}
  return false;
}
function renderAdvancedAnnotation(ctx,ann,p,chartW,priceH,cw,ch,annTimeToX,pToY){
  const baseCol=ann.color||'#dde3f0';
  if(ann.type==='ray'){
    const x1=annTimeToX(ann.x1), x2=annTimeToX(ann.x2); if(x1==null||x2==null) return true;
    const y1=pToY(ann.y1), y2=pToY(ann.y2), end=getRayRightPoint(x1,y1,x2,y2,chartW);
    ctx.strokeStyle=baseCol; ctx.lineWidth=annLineWidth(ann); ctx.setLineDash(annLineDash(ann));
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(end.x,end.y); ctx.stroke(); ctx.setLineDash([]);
    return true;
  }
  if(ann.type==='hray'){
    const x1=annTimeToX(ann.x1); if(x1==null) return true;
    const y1=pToY(ann.y1);
    ctx.strokeStyle=baseCol; ctx.lineWidth=annLineWidth(ann); ctx.setLineDash(annLineDash(ann));
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(chartW,y1); ctx.stroke(); ctx.setLineDash([]);
    return true;
  }
  if(ann.type==='xline'){
    const x1=annTimeToX(ann.x1); if(x1==null) return true;
    const y1=pToY(ann.y1);
    ctx.strokeStyle=baseCol; ctx.lineWidth=annLineWidth(ann); ctx.setLineDash(annLineDash(ann));
    ctx.beginPath(); ctx.moveTo(0,y1); ctx.lineTo(chartW,y1); ctx.moveTo(x1,0); ctx.lineTo(x1,priceH); ctx.stroke(); ctx.setLineDash([]);
    return true;
  }
  if(ann.type==='parallel'||ann.type==='disjoint'){
    const x1=annTimeToX(ann.x1), x2=annTimeToX(ann.x2), x3=annTimeToX(ann.x3);
    if(x1==null||x2==null||x3==null) return true;
    const y1=pToY(ann.y1), y2=pToY(ann.y2), y3=pToY(ann.y3), dx=x2-x1, dy=y2-y1;
    ctx.strokeStyle=baseCol; ctx.lineWidth=annLineWidth(ann); ctx.setLineDash(annLineDash(ann));
    if(ann.type==='parallel'){
      ctx.fillStyle=colorWithAlpha(baseCol,0.08);
      renderPolylinePath(ctx,[{x:x1,y:y1},{x:x2,y:y2},{x:x3+dx,y:y3+dy},{x:x3,y:y3}],true); ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.moveTo(x3,y3); ctx.lineTo(x3+dx,y3+dy); ctx.stroke(); ctx.setLineDash([]);
    return true;
  }
  if(ann.type==='circle'||ann.type==='ellipse'||ann.type==='triangle'||ann.type==='gann_box'){
    const x1=annTimeToX(ann.x1), x2=annTimeToX(ann.x2); if(x1==null||x2==null) return true;
    const y1=pToY(ann.y1), y2=pToY(ann.y2);
    const left=Math.min(x1,x2), top=Math.min(y1,y2), w=Math.abs(x2-x1), h=Math.abs(y2-y1), cx=left+w/2, cy=top+h/2;
    ctx.strokeStyle=baseCol; ctx.lineWidth=annLineWidth(ann); ctx.setLineDash(annLineDash(ann));
    if(ann.type==='circle'){
      const r=Math.min(w,h)/2;
      ctx.fillStyle=colorWithAlpha(baseCol,0.07);
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
    } else if(ann.type==='ellipse'){
      ctx.fillStyle=colorWithAlpha(baseCol,0.07);
      ctx.beginPath(); ctx.ellipse(cx,cy,Math.max(1,w/2),Math.max(1,h/2),0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx,cy,Math.max(1,w/2),Math.max(1,h/2),0,0,Math.PI*2); ctx.stroke();
    } else if(ann.type==='triangle'){
      const pts=[{x:cx,y:top},{x:left,y:top+h},{x:left+w,y:top+h}];
      ctx.fillStyle=colorWithAlpha(baseCol,0.07);
      renderPolylinePath(ctx,pts,true); ctx.fill();
      renderPolylinePath(ctx,pts,true); ctx.stroke();
    } else if(ann.type==='gann_box'){
      const borderCol=ann.borderColor||baseCol, gridCol=ann.gridColor||colorWithAlpha(baseCol,0.5);
      ctx.strokeStyle=borderCol; ctx.strokeRect(left,top,w,h);
      if(ann.showGrid!==false){
        ctx.strokeStyle=gridCol; ctx.lineWidth=1; ctx.setLineDash([3,3]);
        GANN_BOX_RATIOS.forEach(function(ratio){
          const gx=left+w*ratio, gy=top+h*ratio;
          ctx.beginPath(); ctx.moveTo(gx,top); ctx.lineTo(gx,top+h); ctx.moveTo(left,gy); ctx.lineTo(left+w,gy); ctx.stroke();
          if(ann.showLabels!==false){ctx.fillStyle=gridCol; ctx.font='10px Inter'; ctx.textAlign='left'; ctx.fillText((ratio*8).toFixed(0)+'/8',gx+2,top+10);}
        });
        ctx.setLineDash([]);
      }
    }
    ctx.setLineDash([]);
    return true;
  }
  if(isPointArrayAnn(ann)){
    const pts=getScreenPointsFromAnn(ann,annTimeToX,pToY); if(pts.length<2) return true;
    if(ann.type==='brush'){
      ctx.strokeStyle=baseCol; ctx.lineWidth=Math.max(1,ann.lineWidth||3); ctx.lineCap='round'; ctx.lineJoin='round';
      renderPolylinePath(ctx,pts,false); ctx.stroke();
    } else if(ann.type.startsWith('hl_')){
      const hlOp=ann.opacity!=null?ann.opacity:0.35;
      // Highlighter: thick, flat cap, semi-transparent with subtle border
      ctx.lineCap='butt'; ctx.lineJoin='round';
      ctx.strokeStyle=colorWithAlpha(baseCol,Math.min(hlOp,0.4));
      ctx.lineWidth=Math.max(16,ann.lineWidth||28);
      renderPolylinePath(ctx,pts,false); ctx.stroke();
      // Thin bright edge for definition
      ctx.strokeStyle=colorWithAlpha(baseCol,Math.min(hlOp+0.12,0.5));
      ctx.lineWidth=1;
      renderPolylinePath(ctx,pts,false); ctx.stroke();
      ctx.lineCap='round';
    } else if(ann.type==='path'){
      ctx.strokeStyle=baseCol; ctx.lineWidth=annLineWidth(ann); ctx.setLineDash(annLineDash(ann));
      ctx.lineCap='round'; ctx.lineJoin='round'; renderPolylinePath(ctx,pts,false); ctx.stroke(); ctx.setLineDash([]);
    }
    return true;
  }
  if(ann.type==='fib_ret'){
    ensureFibSettings(ann);
    const x1=annTimeToX(ann.x1), x2=annTimeToX(ann.x2); if(x1==null||x2==null) return true;
    const y1=pToY(ann.y1), y2=pToY(ann.y2), left=Math.min(x1,x2), right=Math.max(x1,x2);
    const fibHigh=Math.max(ann.y1,ann.y2), fibLow=Math.min(ann.y1,ann.y2), swing=fibHigh-fibLow;
    if(swing<=0) return true;
    ctx.strokeStyle=baseCol; ctx.lineWidth=annLineWidth(ann); ctx.setLineDash(annLineDash({dashed:ann.lineStyle!=null?ann.lineStyle:ann.dashed}));
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); ctx.setLineDash([]);
    ctx.font=`bold ${F.p}px Inter`;
    ann.fibLevels.forEach(function(level){
      if(level.enabled===false) return;
      var pct=parseFloat(level.value); if(!isFinite(pct)) return;
      var price=fibHigh-swing*(pct/100), y=pToY(price), lblPct=(Math.round(pct*10)/10).toString().replace(/\.0$/,'')+'%';
      ctx.strokeStyle=ann.levelColor||baseCol; ctx.lineWidth=1.2; ctx.setLineDash(annLineDash({dashed:ann.lineStyle!=null?ann.lineStyle:ann.dashed}));
      ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(right,y); ctx.stroke(); ctx.setLineDash([]);
      var rightTxt=fmtPrice(price), leftW=ctx.measureText(lblPct).width, rightW=ctx.measureText(rightTxt).width;
      ctx.fillStyle='rgba(10,12,20,0.78)';
      ctx.fillRect(left+2,y-10,leftW+6,12); ctx.fillRect(right-rightW-8,y-10,rightW+6,12);
      ctx.fillStyle=ann.levelColor||baseCol; ctx.textAlign='left'; ctx.fillText(lblPct,left+5,y-1); ctx.textAlign='right'; ctx.fillText(rightTxt,right-5,y-1);
    });
    ctx.textAlign='left';
    return true;
  }
  if(ann.type==='long_pos'||ann.type==='short_pos'){
    ensurePositionSettings(ann);
    const x=annTimeToX(ann.x1); if(x==null) return true;
    const entry=ann.y1, tp=ann.y2, stop=ann.y3||0; if(!stop) return true;
    const ey=pToY(entry), tpy=pToY(tp), sty=pToY(stop);
    ctx.fillStyle=ann.fillColor||colorWithAlpha(baseCol,0.12); ctx.fillRect(x-20,Math.min(ey,tpy),chartW-x+20,Math.abs(tpy-ey));
    ctx.fillStyle=colorWithAlpha(ann.stopColor||'#ef5350',0.08); ctx.fillRect(x-20,Math.min(ey,sty),chartW-x+20,Math.abs(sty-ey));
    ctx.setLineDash([4,3]);ctx.lineWidth=1;
    ctx.strokeStyle=ann.tpColor||'#4ade80'; ctx.beginPath();ctx.moveTo(x-20,tpy);ctx.lineTo(chartW,tpy);ctx.stroke();
    ctx.strokeStyle=ann.entryColor||baseCol; ctx.beginPath();ctx.moveTo(x-20,ey);ctx.lineTo(chartW,ey);ctx.stroke();
    ctx.strokeStyle=ann.stopColor||'#ef5350'; ctx.beginPath();ctx.moveTo(x-20,sty);ctx.lineTo(chartW,sty);ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign='right';ctx.font='bold 10px Inter';
    var tpPct=((Math.abs(tp-entry)/entry)*100).toFixed(1), stPct=((Math.abs(stop-entry)/entry)*100).toFixed(1);
    ctx.fillStyle='rgba(10,12,20,.8)';ctx.fillRect(chartW-88,tpy-10,86,14);ctx.fillRect(chartW-88,ey-10,86,14);ctx.fillRect(chartW-88,sty-10,86,14);
    ctx.fillStyle=ann.tpColor||'#4ade80';ctx.fillText('TP '+fmtPrice(tp)+' +'+tpPct+'%',chartW-4,tpy+2);
    ctx.fillStyle=ann.entryColor||'#dde3f0';ctx.fillText('E '+fmtPrice(entry),chartW-4,ey+2);
    ctx.fillStyle=ann.stopColor||'#ef5350';ctx.fillText('SL '+fmtPrice(stop)+' -'+stPct+'%',chartW-4,sty+2);
    return true;
  }
  return false;
}
function renderAdvancedPreview(ctx,p,chartW,priceH,annTimeToX,pToY,cx,cy){
  if(freehandState&&freehandState.panelIdx===p.idx&&Array.isArray(freehandState.points)&&freehandState.points.length){
    const pts=getScreenPointsFromAnn({points:freehandState.points},annTimeToX,pToY); if(pts.length){
      ctx.save();
      ctx.strokeStyle=freehandState.type.startsWith('hl_')?colorWithAlpha(freehandState.color||'#22d3ee',Math.min(freehandState.opacity!=null?freehandState.opacity:0.22,0.35)):(freehandState.color||'#94a3b8');
      ctx.lineWidth=freehandState.lineWidth||3; ctx.lineCap='round'; ctx.lineJoin='round';
      renderPolylinePath(ctx,pts,false); ctx.stroke(); ctx.restore();
    }
    return true;
  }
  if(activeTool==='path'&&toolAnchor&&toolAnchor.panelIdx===p.idx&&Array.isArray(toolAnchor.points)&&toolAnchor.points.length){
    const pts=toolAnchor.points.map(function(pt){var sx=annTimeToX(pt.x); return sx==null?null:{x:sx,y:pToY(pt.y)};}).filter(Boolean);
    if(pts.length){
      ctx.strokeStyle=drawDefaults.color||'#dde3f0'; ctx.lineWidth=drawDefaults.lineWidth||2; ctx.setLineDash([4,3]);
      renderPolylinePath(ctx,pts,false); if(cx>=0&&cy>=0){ctx.lineTo(cx,cy);} ctx.stroke(); ctx.setLineDash([]);
    }
    return true;
  }
  if(!toolAnchor||toolAnchor.panelIdx!==p.idx) return false;
  const ax=annTimeToX(toolAnchor.time)||toolAnchor.rawX, ay=pToY(toolAnchor.price), col=drawDefaults.color||'#dde3f0';
  if(activeTool==='hray'){
    ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(chartW,ay); ctx.stroke(); ctx.setLineDash([]); return true;
  }
  if(activeTool==='xline'){
    ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(0,ay); ctx.lineTo(chartW,ay); ctx.moveTo(ax,0); ctx.lineTo(ax,priceH); ctx.stroke(); ctx.setLineDash([]); return true;
  }
  if(activeTool==='parallel'||activeTool==='disjoint'){
    ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
    if(toolStep==='second'){
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(cx,cy); ctx.stroke();
    } else if(toolStep==='third'&&toolAnchor.x2!=null){
      const bx=annTimeToX(toolAnchor.x2)||cx, by=pToY(toolAnchor.y2), dx=bx-ax, dy=by-ay;
      if(activeTool==='parallel'){
        ctx.fillStyle=colorWithAlpha(col,0.08);
        renderPolylinePath(ctx,[{x:ax,y:ay},{x:bx,y:by},{x:cx+dx,y:cy+dy},{x:cx,y:cy}],true); ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.moveTo(cx,cy); ctx.lineTo(cx+dx,cy+dy); ctx.stroke();
    }
    ctx.setLineDash([]); return true;
  }
  if(activeTool==='circle'||activeTool==='ellipse'||activeTool==='triangle'||activeTool==='gann_box'){
    const left=Math.min(ax,cx), top=Math.min(ay,cy), w=Math.abs(cx-ax), h=Math.abs(cy-ay), midX=left+w/2, midY=top+h/2;
    ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
    if(activeTool==='circle'){
      const r=Math.min(w,h)/2; ctx.beginPath(); ctx.arc(midX,midY,r,0,Math.PI*2); ctx.stroke();
    } else if(activeTool==='ellipse'){
      ctx.beginPath(); ctx.ellipse(midX,midY,Math.max(1,w/2),Math.max(1,h/2),0,0,Math.PI*2); ctx.stroke();
    } else if(activeTool==='triangle'){
      renderPolylinePath(ctx,[{x:midX,y:top},{x:left,y:top+h},{x:left+w,y:top+h}],true); ctx.stroke();
    } else {
      ctx.strokeRect(left,top,w,h);
      GANN_BOX_RATIOS.forEach(function(ratio){var gx=left+w*ratio, gy=top+h*ratio; ctx.beginPath(); ctx.moveTo(gx,top); ctx.lineTo(gx,top+h); ctx.moveTo(left,gy); ctx.lineTo(left+w,gy); ctx.stroke();});
    }
    ctx.setLineDash([]); return true;
  }
  if(activeTool==='fib_ret'){
    const left=Math.min(ax,cx), right=Math.max(ax,cx);
    ctx.strokeStyle='#a78bfa'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(cx,cy); ctx.stroke();
    const high=Math.max(toolAnchor.price, pToY===undefined?toolAnchor.price:toolAnchor.price), low=Math.min(toolAnchor.price,toolAnchor.price);
    const topPrice=Math.max(toolAnchor.price, pixelToTimePrice(cx,cy,p).price), botPrice=Math.min(toolAnchor.price, pixelToTimePrice(cx,cy,p).price), swing=topPrice-botPrice;
    if(swing>0){
      cloneFibLevels().forEach(function(level){var price=topPrice-swing*(level.value/100), y=pToY(price); ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(right,y); ctx.stroke();});
    }
    ctx.setLineDash([]); return true;
  }
  return false;
}

function isAnnNear(ann,mx,my,p,annTimeToX,pToY){
  if(!ann||ann.hidden||_hideAll) return false;
  const x1=annTimeToX(ann.x1); if(x1==null) return false;
  const y1=pToY(ann.y1);
  const HIT=18;
  if(isPointArrayAnn(ann)){
    const pts=getScreenPointsFromAnn(ann,annTimeToX,pToY);
    const tol=(ann.type.startsWith('hl_')?Math.max(18,(ann.lineWidth||18)/2):Math.max(HIT,(ann.lineWidth||2)+8));
    return distanceToPolyline(mx,my,pts,false)<=tol;
  }
  if(ann.type==='trendline'){
    const x2=annTimeToX(ann.x2); if(x2==null) return false;
    const y2=pToY(ann.y2);
    const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy)||1;
    const d=Math.abs((my-y1)*dx-(mx-x1)*dy)/len;
    const t=((mx-x1)*dx+(my-y1)*dy)/(len*len);
    return d<HIT&&t>=0&&t<=1;
  }
  if(ann.type==='ray'){
    const x2=annTimeToX(ann.x2); if(x2==null) return false;
    const y2=pToY(ann.y2);
    const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy)||1;
    const d=Math.abs((my-y1)*dx-(mx-x1)*dy)/len;
    const t=((mx-x1)*dx+(my-y1)*dy)/(len*len);
    return d<HIT&&t>=0;
  }
  if(ann.type==='hray') return mx>=x1-HIT&&Math.abs(my-y1)<HIT;
  if(ann.type==='xline') return Math.abs(my-y1)<HIT||Math.abs(mx-x1)<HIT;
  if(ann.type==='parallel'||ann.type==='disjoint'){
    const x2=annTimeToX(ann.x2), x3=annTimeToX(ann.x3); if(x2==null||x3==null) return false;
    const y2=pToY(ann.y2), y3=pToY(ann.y3), dx=x2-x1, dy=y2-y1;
    return pointToSegmentDistance(mx,my,x1,y1,x2,y2)<HIT || pointToSegmentDistance(mx,my,x3,y3,x3+dx,y3+dy)<HIT;
  }
  if(ann.type.startsWith('box_')||(ann.type.startsWith('hl_')&&!isPointArrayAnn(ann))||ann.type==='circle'||ann.type==='ellipse'||ann.type==='triangle'||ann.type==='gann_box'){
    const x2=annTimeToX(ann.x2); if(x2==null) return false;
    const y2=pToY(ann.y2);
    const bX=Math.min(x1,x2)-HIT,bY=Math.min(y1,y2)-HIT;
    const bW=Math.abs(x2-x1)+HIT*2,bH=Math.abs(y2-y1)+HIT*2;
    return mx>=bX&&mx<=bX+bW&&my>=bY&&my<=bY+bH;
  }
  if(ann.type.startsWith('text_')) return Math.abs(mx-x1)<60&&Math.abs(my-y1)<20;
  if(ann.type==='callout'){
    const x2=annTimeToX(ann.x2); if(x2==null) return false;
    const y2=pToY(ann.y2);
    return Math.hypot(mx-x2,my-y2)<30 || Math.hypot(mx-x1,my-y1)<10;
  }
  if(ann.type==='note'){
    const nw=ann.noteWidth||120;
    return mx>=x1&&mx<=x1+nw&&my>=y1&&my<=y1+60;
  }
  if(ann.type==='price_label') return Math.abs(mx-(p.W-p.PRICE_W))<40&&Math.abs(my-y1)<14;
  if(ann.type==='flag') return Math.hypot(mx-x1,my-(y1-20))<16;
  if(ann.type==='entry_arrow'||ann.type==='exit_arrow'||ann.type==='short_arrow'||ann.type==='cover_arrow'||ann.type==='stop_line'||ann.type==='trail_stop') return Math.hypot(mx-x1,my-y1)<22;
  if(ann.type==='hline') return Math.abs(my-y1)<HIT;
  if(ann.type==='vline') return Math.abs(mx-x1)<HIT;
  if(ann.type==='long_pos'||ann.type==='short_pos'){
    const ey=pToY(ann.y1), tpy=pToY(ann.y2), sty=pToY(ann.y3||0);
    return Math.abs(my-ey)<HIT||Math.abs(my-tpy)<HIT||Math.abs(my-sty)<HIT;
  }
  if(ann.type==='fib_ret'){
    ensureFibSettings(ann);
    const x2=annTimeToX(ann.x2); if(x2==null) return false;
    const y2=pToY(ann.y2), left=Math.min(x1,x2), right=Math.max(x1,x2);
    if(pointToSegmentDistance(mx,my,x1,y1,x2,y2)<HIT) return true;
    const fibHigh=Math.max(ann.y1,ann.y2), fibLow=Math.min(ann.y1,ann.y2), swing=fibHigh-fibLow;
    if(swing<=0||mx<left-HIT||mx>right+HIT) return false;
    for(const level of ann.fibLevels){
      if(level.enabled===false) continue;
      const ly=pToY(fibHigh-swing*(parseFloat(level.value||0)/100));
      if(Math.abs(my-ly)<HIT) return true;
    }
    return false;
  }
  return false;
}

function findAnnAt(mx,my,p){
  const chartW_=p.W-p.PRICE_W;
  const vs=Math.max(0,Math.min(p.viewStart,p.data.length-p.viewBars));
  const vlen=Math.min(p.viewBars,p.data.length-vs);
  const barW=chartW_/Math.max(vlen+(window.RIGHT_PAD||6),1);
  const volH=p.inds.vol?Math.round(p.H*(p.volFrac||VOL_FRAC_DEFAULT)):0;
  const priceH=p.H-p.TIME_H-volH;
  const{min,max}=getMinMax(p);
  function annTimeToX(t){
    const ts=toUnix(t);let lo=-1,hi=-1;
    for(let i=0;i<p.data.length;i++){const bt=toUnix(p.data[i].time);if(bt<=ts)lo=i;if(bt>=ts&&hi<0)hi=i;}
    if(lo<0&&hi<0)return null;if(lo<0)return(hi-vs+0.5)*barW;if(hi<0)return(lo-vs+0.5)*barW;
    if(lo===hi)return(lo-vs+0.5)*barW;
    const loT=toUnix(p.data[lo].time),hiT=toUnix(p.data[hi].time);
    const frac=(hiT===loT)?0:(ts-loT)/(hiT-loT);
    return((lo+frac*(hi-lo))-vs+0.5)*barW;
  }
  const pToY=price=>priceH-((price-min)/(max-min))*priceH;
  // Search in reverse (top-most first)
  for(let k=annotations.length-1;k>=0;k--){
    const ann=annotations[k];
    if(ann.panelIdx!=null&&ann.panelIdx!==p.idx) continue;
    if(isAnnNear(ann,mx,my,p,annTimeToX,pToY)) return ann;
  }
  return null;
}

// ── SELECTION TOOLBAR ACTIONS ──
var _annColorHSB={h:210,s:0.1,b:0.94}; // default to bright near-white
var _annColorAlpha=100;
var _annPickerActive=false;

function annCloseDropdowns(){
  ['color','weight','linetype','opacity','more'].forEach(function(k){
    var dd=document.getElementById('ann-dd-'+k);
    if(dd) dd.style.display='none';
  });
  _annPickerActive=false;
}
function annToggleDropdown(which){
  var dd=document.getElementById('ann-dd-'+which);
  var isOpen=dd&&dd.style.display!=='none';
  annCloseDropdowns();
  if(!isOpen&&dd){
    dd.style.display='block';
    if(which==='color') annInitColorPicker();
    if(which==='opacity') annInitOpacitySlider();
  }
}
function annInitColorPicker(){
  _annPickerActive=true;
  // Parse current annotation color into HSB
  var col=selectedAnn?(selectedAnn.color||'#7b61ff'):'#7b61ff';
  _annColorAlpha=selectedAnn&&selectedAnn.opacity!=null?Math.round(selectedAnn.opacity*100):100;
  var hex=col;
  if(col.startsWith('rgba')||col.startsWith('rgb')){
    var m=col.match(/[\d.]+/g);
    if(m&&m.length>=3) hex='#'+[m[0],m[1],m[2]].map(function(v){return ('0'+Math.round(parseFloat(v)).toString(16)).slice(-2);}).join('');
  }
  _annColorHSB=annHexToHSB(hex);
  annRenderColorPicker();
  var ai=document.getElementById('ann-alpha-input');
  if(ai) ai.value=_annColorAlpha;
  var hi=document.getElementById('ann-hex-input');
  if(hi) hi.value=hex.toUpperCase();
}
function annRenderColorPicker(){
  // Saturation/Brightness canvas
  var svC=document.getElementById('ann-sv-canvas');
  if(!svC) return;
  var svCtx=svC.getContext('2d');
  var W=svC.width, H=svC.height;
  var h=_annColorHSB.h;
  // Fill with hue gradient horizontally (white->pure hue)
  var hGrad=svCtx.createLinearGradient(0,0,W,0);
  hGrad.addColorStop(0,'#fff');
  hGrad.addColorStop(1,annHSBtoHex(h,1,1));
  svCtx.fillStyle=hGrad; svCtx.fillRect(0,0,W,H);
  // Black gradient vertically
  var bGrad=svCtx.createLinearGradient(0,0,0,H);
  bGrad.addColorStop(0,'rgba(0,0,0,0)');
  bGrad.addColorStop(1,'rgba(0,0,0,1)');
  svCtx.fillStyle=bGrad; svCtx.fillRect(0,0,W,H);
  // Draw selector circle
  var sx=_annColorHSB.s*W, sy=(1-_annColorHSB.b)*H;
  svCtx.beginPath(); svCtx.arc(sx,sy,7,0,Math.PI*2);
  svCtx.strokeStyle='#fff'; svCtx.lineWidth=2; svCtx.stroke();
  svCtx.strokeStyle='#000'; svCtx.lineWidth=1; svCtx.stroke();
  // Hue bar
  var hC=document.getElementById('ann-hue-canvas');
  if(hC){
    var hCtx=hC.getContext('2d');
    var hW=hC.width;
    for(var i=0;i<hW;i++){
      hCtx.fillStyle=annHSBtoHex(i/hW*360,1,1);
      hCtx.fillRect(i,0,1,hC.height);
    }
    // Hue indicator
    var hx=h/360*hW;
    hCtx.strokeStyle='#fff'; hCtx.lineWidth=2;
    hCtx.strokeRect(hx-2,0,4,hC.height);
  }
  // Alpha bar
  var aC=document.getElementById('ann-alpha-canvas');
  if(aC){
    var aCtx=aC.getContext('2d');
    var aW=aC.width, aH=aC.height;
    // Checkerboard bg
    for(var cx=0;cx<aW;cx+=8){ for(var cy=0;cy<aH;cy+=8){
      aCtx.fillStyle=((cx/8+cy/8)%2)?'#333':'#555'; aCtx.fillRect(cx,cy,8,8);
    }}
    var aGrad=aCtx.createLinearGradient(0,0,aW,0);
    var solidCol=annHSBtoHex(_annColorHSB.h,_annColorHSB.s,_annColorHSB.b);
    aGrad.addColorStop(0,'rgba(0,0,0,0)');
    aGrad.addColorStop(1,solidCol);
    aCtx.fillStyle=aGrad; aCtx.fillRect(0,0,aW,aH);
    // Alpha indicator
    var ax=_annColorAlpha/100*aW;
    aCtx.strokeStyle='#fff'; aCtx.lineWidth=2;
    aCtx.strokeRect(ax-2,0,4,aH);
  }
}
function annHSBtoHex(h,s,b){
  h=((h%360)+360)%360; s=Math.max(0,Math.min(1,s)); b=Math.max(0,Math.min(1,b));
  var c=b*s, x=c*(1-Math.abs((h/60)%2-1)), m=b-c;
  var r,g,bl;
  if(h<60){r=c;g=x;bl=0;}else if(h<120){r=x;g=c;bl=0;}else if(h<180){r=0;g=c;bl=x;}
  else if(h<240){r=0;g=x;bl=c;}else if(h<300){r=x;g=0;bl=c;}else{r=c;g=0;bl=x;}
  r=Math.round((r+m)*255);g=Math.round((g+m)*255);bl=Math.round((bl+m)*255);
  return '#'+('0'+r.toString(16)).slice(-2)+('0'+g.toString(16)).slice(-2)+('0'+bl.toString(16)).slice(-2);
}
function annHexToHSB(hex){
  hex=hex.replace('#','');
  if(hex.length===3) hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  var r=parseInt(hex.slice(0,2),16)/255, g=parseInt(hex.slice(2,4),16)/255, b=parseInt(hex.slice(4,6),16)/255;
  var max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  var h=0;
  if(d>0){
    if(max===r) h=60*((g-b)/d%6);
    else if(max===g) h=60*((b-r)/d+2);
    else h=60*((r-g)/d+4);
  }
  if(h<0) h+=360;
  return {h:h, s:max>0?d/max:0, b:max};
}
// Color picker mouse handlers
function annSetupColorPickerEvents(){
  var svC=document.getElementById('ann-sv-canvas');
  var hC=document.getElementById('ann-hue-canvas');
  var aC=document.getElementById('ann-alpha-canvas');
  if(!svC||!hC||!aC) return;
  var draggingSV=false, draggingH=false, draggingA=false;
  function handleSV(e){
    var r=svC.getBoundingClientRect();
    _annColorHSB.s=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
    _annColorHSB.b=Math.max(0,Math.min(1,1-(e.clientY-r.top)/r.height));
    annApplyColorFromPicker();
  }
  function handleH(e){
    var r=hC.getBoundingClientRect();
    _annColorHSB.h=Math.max(0,Math.min(360,(e.clientX-r.left)/r.width*360));
    annApplyColorFromPicker();
  }
  function handleA(e){
    var r=aC.getBoundingClientRect();
    _annColorAlpha=Math.max(0,Math.min(100,Math.round((e.clientX-r.left)/r.width*100)));
    annApplyColorFromPicker();
  }
  svC.addEventListener('mousedown',function(e){draggingSV=true;handleSV(e);e.preventDefault();});
  hC.addEventListener('mousedown',function(e){draggingH=true;handleH(e);e.preventDefault();});
  aC.addEventListener('mousedown',function(e){draggingA=true;handleA(e);e.preventDefault();});
  document.addEventListener('mousemove',function(e){
    if(draggingSV){handleSV(e);e.preventDefault();}
    if(draggingH){handleH(e);e.preventDefault();}
    if(draggingA){handleA(e);e.preventDefault();}
  });
  document.addEventListener('mouseup',function(){draggingSV=false;draggingH=false;draggingA=false;});
  // Hex input
  var hexIn=document.getElementById('ann-hex-input');
  if(hexIn) hexIn.addEventListener('change',function(){
    var v=hexIn.value.trim();
    if(!v.startsWith('#')) v='#'+v;
    if(/^#[0-9a-fA-F]{6}$/.test(v)){
      _annColorHSB=annHexToHSB(v);
      annApplyColorFromPicker();
    }
  });
  var alphaIn=document.getElementById('ann-alpha-input');
  if(alphaIn) alphaIn.addEventListener('change',function(){
    _annColorAlpha=Math.max(0,Math.min(100,parseInt(alphaIn.value)||100));
    annApplyColorFromPicker();
  });
}
function annApplyColorFromPicker(){
  var hex=annHSBtoHex(_annColorHSB.h,_annColorHSB.s,_annColorHSB.b);
  // Update defaults for future drawings
  drawDefaults.color=hex; drawDefaults.opacity=_annColorAlpha/100; saveDrawDefaults();
  if(!selectedAnn) return;
  selectedAnn.color=hex;
  selectedAnn.opacity=_annColorAlpha/100;
  // Update UI elements
  var line=document.getElementById('ann-color-line');
  if(line) line.setAttribute('stroke',hex);
  var bar=document.getElementById('ann-color-bar');
  if(bar) bar.setAttribute('fill',hex);
  var hi=document.getElementById('ann-hex-input');
  if(hi) hi.value=hex.toUpperCase();
  var ai=document.getElementById('ann-alpha-input');
  if(ai) ai.value=_annColorAlpha;
  annRenderColorPicker();
  renderAll();
}
function annPickSwatch(col){
  drawDefaults.color=col; saveDrawDefaults();
  _annColorHSB=annHexToHSB(col);
  annApplyColorFromPicker();
}
// Line weight
function annSetWeight(w){
  drawDefaults.lineWidth=w; saveDrawDefaults();
  if(!selectedAnn) return;
  selectedAnn.lineWidth=w;
  document.querySelectorAll('#ann-dd-weight .ann-opt-btn').forEach(function(b){
    b.classList.toggle('active',parseInt(b.dataset.w)===w);
  });
  annCloseDropdowns(); renderAll();
}
// Line style
function annSetLineStyle(style){
  var val=style==='solid'?false:style;
  drawDefaults.dashed=val; saveDrawDefaults();
  if(!selectedAnn) return;
  if(style==='solid') selectedAnn.dashed=false;
  else if(style==='dashed') selectedAnn.dashed='dashed';
  else selectedAnn.dashed='dotted';
  annCloseDropdowns(); renderAll();
}
// Lock
function annToggleLock(){
  if(!selectedAnn) return;
  selectedAnn.locked=!selectedAnn.locked;
  var icon=document.getElementById('ann-lock-icon');
  if(!icon) return;
  if(selectedAnn.locked){
    icon.innerHTML='<rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="#facc15" stroke-width="1.3"/><circle cx="8" cy="11" r="1" fill="#facc15"/>';
  } else {
    icon.innerHTML='<path d="M4 7V5a4 4 0 018 0v2" fill="none" stroke="#8aa0c0" stroke-width="1.3"/><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="#8aa0c0" stroke-width="1.3"/>';
  }
  renderAll();
}
// Visibility
function annToggleVisibility(){
  if(!selectedAnn) return;
  selectedAnn.hidden=!selectedAnn.hidden;
  var icon=document.getElementById('ann-vis-icon');
  if(!icon) return;
  if(selectedAnn.hidden){
    icon.innerHTML='<path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" fill="none" stroke="#4a6080" stroke-width="1.3"/><line x1="2" y1="14" x2="14" y2="2" stroke="#ff3d57" stroke-width="1.5"/>';
  } else {
    icon.innerHTML='<path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" fill="none" stroke="#8aa0c0" stroke-width="1.3"/><circle cx="8" cy="8" r="2.5" fill="none" stroke="#8aa0c0" stroke-width="1.3"/>';
  }
  renderAll();
}
// Settings popup
function annShowSettings(){
  if(!selectedAnn) return;
  annCloseDropdowns();
  var ann=selectedAnn;
  var S='width:100px;background:#10131a;border:1px solid #2a3050;border-radius:3px;color:#dde3f0;padding:3px 5px;font-size:11px;';
  var body='<div style="display:flex;flex-direction:column;gap:8px;padding:4px;">';
  // Price inputs
  body+='<label style="color:#8aa0c0;font-size:11px;display:flex;justify-content:space-between;">Price 1<input type="number" id="ann-set-y1" value="'+ann.y1.toFixed(4)+'" step="0.01" style="'+S+'"/></label>';
  if(ann.x2!=null&&ann.type!=='hline'&&ann.type!=='vline'){
    body+='<label style="color:#8aa0c0;font-size:11px;display:flex;justify-content:space-between;">Price 2<input type="number" id="ann-set-y2" value="'+ann.y2.toFixed(4)+'" step="0.01" style="'+S+'"/></label>';
  }
  // Text / label inputs
  if(ann.type.startsWith('text_')){
    body+='<label style="color:#8aa0c0;font-size:11px;display:flex;justify-content:space-between;">Text<input type="text" id="ann-set-text" value="'+(ann.text||'')+'" style="'+S+'"/></label>';
  }
  if(ann.label!=null){
    body+='<label style="color:#8aa0c0;font-size:11px;display:flex;justify-content:space-between;">Label<input type="text" id="ann-set-label" value="'+(ann.label||'')+'" style="'+S+'"/></label>';
  }
  // ── FIB RETRACEMENT LEVELS ──
  if(ann.type==='fib_ret'){
    ensureFibSettings(ann);
    body+='<div style="height:1px;background:#2a3050;margin:4px 0;"></div>';
    body+='<div style="color:#a78bfa;font-size:11px;font-weight:700;letter-spacing:.5px;margin-bottom:2px;">FIBONACCI LEVELS</div>';
    ann.fibLevels.forEach(function(level,i){
      var pct=parseFloat(level.value||0);
      var checked=level.enabled!==false?'checked':'';
      body+='<div style="display:flex;align-items:center;gap:6px;">';
      body+='<input type="checkbox" id="fib-en-'+i+'" '+checked+' style="accent-color:#a78bfa;cursor:pointer;"/>';
      body+='<input type="number" id="fib-val-'+i+'" value="'+pct.toFixed(1)+'" step="0.1" min="0" max="100" style="'+S+'width:64px;"/>';
      body+='<span style="color:#8aa0c0;font-size:10px;">%</span>';
      var price=Math.max(ann.y1,ann.y2)-Math.abs(ann.y2-ann.y1)*(pct/100);
      body+='<span style="color:#5a6a88;font-size:10px;margin-left:auto;">'+price.toFixed(2)+'</span>';
      body+='</div>';
    });
    body+='<div style="display:flex;gap:4px;margin-top:4px;">';
    body+='<button onclick="fibAddLevel()" style="background:#10131a;border:1px solid #2a3050;color:#a78bfa;border-radius:3px;padding:2px 8px;font-size:10px;cursor:pointer;">+ Add Level</button>';
    body+='<button onclick="fibResetLevels()" style="background:#10131a;border:1px solid #2a3050;color:#8aa0c0;border-radius:3px;padding:2px 8px;font-size:10px;cursor:pointer;">Reset Defaults</button>';
    body+='</div>';
  }
  // ── GANN BOX SETTINGS ──
  if(ann.type==='gann_box'){
    body+='<div style="height:1px;background:#2a3050;margin:4px 0;"></div>';
    body+='<div style="color:#f59e0b;font-size:11px;font-weight:700;letter-spacing:.5px;margin-bottom:2px;">GANN BOX</div>';
    body+='<label style="color:#8aa0c0;font-size:11px;display:flex;justify-content:space-between;">Grid Lines<input type="checkbox" id="gann-grid" '+(ann.showGrid!==false?'checked':'')+' style="accent-color:#f59e0b;cursor:pointer;"/></label>';
    body+='<label style="color:#8aa0c0;font-size:11px;display:flex;justify-content:space-between;">Labels<input type="checkbox" id="gann-labels" '+(ann.showLabels!==false?'checked':'')+' style="accent-color:#f59e0b;cursor:pointer;"/></label>';
    body+='<label style="color:#8aa0c0;font-size:11px;display:flex;justify-content:space-between;">Grid Color<input type="color" id="gann-color" value="'+(ann.gridColor||'#f59e0b')+'" style="width:40px;height:22px;border:1px solid #2a3050;border-radius:3px;cursor:pointer;"/></label>';
  }
  // ── POSITION TOOL SETTINGS ──
  if(ann.type==='long_pos'||ann.type==='short_pos'){
    ensurePositionSettings(ann);
    body+='<div style="height:1px;background:#2a3050;margin:4px 0;"></div>';
    body+='<div style="color:#D4AF37;font-size:11px;font-weight:700;letter-spacing:.5px;margin-bottom:2px;">POSITION</div>';
    if(ann.y3!=null) body+='<label style="color:#8aa0c0;font-size:11px;display:flex;justify-content:space-between;">Stop Price<input type="number" id="ann-set-y3" value="'+ann.y3.toFixed(4)+'" step="0.01" style="'+S+'"/></label>';
  }
  // Opacity
  body+='<label style="color:#8aa0c0;font-size:11px;display:flex;justify-content:space-between;">Opacity<input type="range" id="ann-set-opacity" min="0" max="1" step="0.05" value="'+(ann.opacity!=null?ann.opacity:1)+'" style="width:100px;accent-color:#7b61ff;"/></label>';
  body+='</div>';
  modalOpen('⚙ Annotation Settings',body,[
    {text:'Apply',cls:'mbtn primary',action:function(){
      var y1i=document.getElementById('ann-set-y1');if(y1i) ann.y1=parseFloat(y1i.value)||ann.y1;
      var y2i=document.getElementById('ann-set-y2');if(y2i) ann.y2=parseFloat(y2i.value)||ann.y2;
      var y3i=document.getElementById('ann-set-y3');if(y3i) ann.y3=parseFloat(y3i.value)||ann.y3;
      var txti=document.getElementById('ann-set-text');if(txti) ann.text=txti.value;
      var lbli=document.getElementById('ann-set-label');if(lbli) ann.label=lbli.value;
      var opi=document.getElementById('ann-set-opacity');if(opi) ann.opacity=parseFloat(opi.value);
      // Apply fib levels
      if(ann.type==='fib_ret'&&ann.fibLevels){
        ann.fibLevels.forEach(function(level,i){
          var en=document.getElementById('fib-en-'+i);
          var val=document.getElementById('fib-val-'+i);
          if(en) level.enabled=en.checked;
          if(val) level.value=parseFloat(val.value)||0;
        });
      }
      // Apply gann box
      if(ann.type==='gann_box'){
        var gg=document.getElementById('gann-grid'); if(gg) ann.showGrid=gg.checked;
        var gl=document.getElementById('gann-labels'); if(gl) ann.showLabels=gl.checked;
        var gc=document.getElementById('gann-color'); if(gc) ann.gridColor=gc.value;
      }
      modalClose(); renderAll();
    }},
    {text:'Cancel',cls:'mbtn',action:modalClose}
  ]);
}
// Fib level helpers
function fibAddLevel(){
  if(!selectedAnn||selectedAnn.type!=='fib_ret') return;
  ensureFibSettings(selectedAnn);
  selectedAnn.fibLevels.push({value:0,enabled:true});
  annShowSettings(); // refresh modal
}
function fibResetLevels(){
  if(!selectedAnn||selectedAnn.type!=='fib_ret') return;
  selectedAnn.fibLevels=cloneFibLevels();
  annShowSettings(); // refresh modal
}
// Z-order
function annBringToFront(){
  if(!selectedAnn) return;
  var idx=annotations.indexOf(selectedAnn);
  if(idx>=0&&idx<annotations.length-1){annotations.splice(idx,1);annotations.push(selectedAnn);}
  renderAll();
}
function annSendToBack(){
  if(!selectedAnn) return;
  var idx=annotations.indexOf(selectedAnn);
  if(idx>0){annotations.splice(idx,1);annotations.unshift(selectedAnn);}
  renderAll();
}
// Delete all of same type
function annDeleteAllOfType(){
  if(!selectedAnn) return;
  var t=selectedAnn.type;
  var count=annotations.filter(function(a){return a.type===t;}).length;
  annotations=annotations.filter(function(a){return a.type!==t;});
  selectedAnn=null; hideAnnToolbar(); updateSimPnl(); renderAll(); toast('🗑 Deleted '+count+' '+t+' annotations');
}

function annSetColor(col){
  if(!selectedAnn) return;
  selectedAnn.color=col;
  if(selectedAnn.type==='box_orange'||selectedAnn.type==='box_yellow'){
    selectedAnn.type=col==='#facc15'||col==='#ff9800'?'box_orange':'box_yellow';
  }
  annCloseDropdowns(); renderAll();
}
function annEditText(){
  if(!selectedAnn||!selectedAnn.type.startsWith('text_')) return;
  annShowSettings(); // reuse settings popup which has text field
}
function annDuplicate(){
  if(!selectedAnn) return;
  var copy=JSON.parse(JSON.stringify(selectedAnn));
  copy.id=nextId++; copy.y1+=0.5; copy.y2+=0.5;
  delete copy.locked;
  annotations.push(copy);
  selectedAnn=copy; renderAll(); toast('📋 Duplicated');
}
function annDelete(){
  if(!selectedAnn) return;
  var idx=annotations.indexOf(selectedAnn);
  if(idx>=0) annotations.splice(idx,1);
  selectedAnn=null; hideAnnToolbar(); updateSimPnl(); renderAll(); toast('🗑 Deleted');
}
function annInitOpacitySlider(){
  var sl=document.getElementById('ann-opacity-slider');
  var vl=document.getElementById('ann-opacity-val');
  if(!sl||!selectedAnn) return;
  var op=Math.round((selectedAnn.opacity!=null?selectedAnn.opacity:1)*100);
  sl.value=op;
  if(vl) vl.textContent=op+'%';
}
// Wire opacity slider
(function(){
  var sl=document.getElementById('ann-opacity-slider');
  var vl=document.getElementById('ann-opacity-val');
  if(!sl) return;
  sl.addEventListener('input',function(){
    var v=parseInt(sl.value)||100;
    if(vl) vl.textContent=v+'%';
    if(selectedAnn){
      selectedAnn.opacity=v/100;
      renderAll();
    }
    drawDefaults.opacity=v/100; saveDrawDefaults();
  });
})();

function showAnnToolbar(ann,mx,my,p){
  var tb=document.getElementById('ann-toolbar');
  if(!tb) return;
  annCloseDropdowns();
  // Sync opacity slider
  var opSl=document.getElementById('ann-opacity-slider');
  var opVl=document.getElementById('ann-opacity-val');
  if(opSl&&ann.opacity!=null){opSl.value=Math.round(ann.opacity*100);}
  else if(opSl){opSl.value=100;}
  if(opVl) opVl.textContent=(opSl?opSl.value:'100')+'%';
  // Show text color group for text annotations
  var tcg=document.getElementById('ann-tcolor-group');
  if(tcg) tcg.style.display=ann.type.startsWith('text_')?'':'none';
  // Show text option in More for text annotations
  var mt=document.getElementById('ann-more-text');
  if(mt) mt.style.display=ann.type.startsWith('text_')?'':'none';
  // Update color icon to current color
  var col=ann.color||C.trendline||'#7b61ff';
  var line=document.getElementById('ann-color-line'); if(line) line.setAttribute('stroke',col);
  var bar=document.getElementById('ann-color-bar'); if(bar) bar.setAttribute('fill',col);
  // Update lock icon
  var lockIcon=document.getElementById('ann-lock-icon');
  if(lockIcon){
    if(ann.locked) lockIcon.innerHTML='<rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="#facc15" stroke-width="1.3"/><circle cx="8" cy="11" r="1" fill="#facc15"/>';
    else lockIcon.innerHTML='<path d="M4 7V5a4 4 0 018 0v2" fill="none" stroke="#8aa0c0" stroke-width="1.3"/><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="#8aa0c0" stroke-width="1.3"/>';
  }
  // Update vis icon
  var visIcon=document.getElementById('ann-vis-icon');
  if(visIcon){
    if(ann.hidden) visIcon.innerHTML='<path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" fill="none" stroke="#4a6080" stroke-width="1.3"/><line x1="2" y1="14" x2="14" y2="2" stroke="#ff3d57" stroke-width="1.5"/>';
    else visIcon.innerHTML='<path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" fill="none" stroke="#8aa0c0" stroke-width="1.3"/><circle cx="8" cy="8" r="2.5" fill="none" stroke="#8aa0c0" stroke-width="1.3"/>';
  }
  // Update active weight button
  document.querySelectorAll('#ann-dd-weight .ann-opt-btn').forEach(function(b){
    b.classList.toggle('active',parseInt(b.dataset.w)===(ann.lineWidth||2));
  });
  // Position — use saved position if available, otherwise auto-position
  var savedPos=null;
  try{savedPos=JSON.parse(localStorage.getItem('traderra-ann-tb-pos')||'null');}catch(e){}
  if(!savedPos){
    var left=Math.max(8,Math.min(window.innerWidth-500,mx-160));
    var top=Math.max(42,my-50);
    tb.style.left=left+'px'; tb.style.top=top+'px';
  }
  tb.style.display='flex';
}
function hideAnnToolbar(){
  var tb=document.getElementById('ann-toolbar');
  if(tb) tb.style.display='none';
  annCloseDropdowns();
}

// ── DRAG SUPPORT ──
function startAnnDrag(ann,mx,my,p){
  if(!ann) return;
  draggingAnn=ann;
  draggingAnn._panel=p;
  draggingAnn._origX1=ann.x1; draggingAnn._origY1=ann.y1;
  draggingAnn._origX2=ann.x2; draggingAnn._origY2=ann.y2; draggingAnn._origY3=ann.y3;
  if(Array.isArray(ann.points)) draggingAnn._origPoints=ann.points.map(function(pt){return {x:pt.x,y:pt.y};});
  // Convert click position to time/price to compute initial delta
  var conv=pixelToTimePrice(mx,my,p);
  conv.price=snapPriceToMagnet(p,conv.time,conv.price);
  draggingAnn._dt = conv.time - ann.x1;
  draggingAnn._dp = conv.price - ann.y1;
}
// Shared pixel→time/price converter (same math as tlDrag uses)
function pixelToTimePrice(mx,my,p){
  var chartW_=p.W-p.PRICE_W;
  var vs=Math.max(0,Math.min(p.viewStart,Math.max(0,p.data.length-p.viewBars)));
  var ve=Math.min(vs+p.viewBars,p.data.length);
  var vlen=ve-vs;
  var barW=chartW_/Math.max(vlen+(window.RIGHT_PAD||6),1);
  var volH=p.inds.vol?Math.round(p.H*(p.volFrac||VOL_FRAC_DEFAULT)):0;
  var priceH=p.H-p.TIME_H-volH;
  var mm=getMinMax(p);
  // Add the same 15% padding that renderPanel uses
  var pad=(mm.max-mm.min)*0.15||mm.min*0.02;
  var minP=mm.min-pad, maxP=mm.max+pad;
  var midP=(minP+maxP)/2, halfRange=(maxP-minP)/2;
  var scaledHalf=halfRange*(p.priceScale||1);
  minP=midP-scaledHalf; maxP=midP+scaledHalf;
  var priceRange=maxP-minP;
  // Bar index → data index → time
  var bi=Math.max(0,Math.min(vlen-1,Math.floor(mx/barW)));
  var di=Math.max(0,Math.min(p.data.length-1,vs+bi));
  var time=toUnix(p.data[di].time);
  // Price (same formula as pToY inverted)
  var price=maxP - (my/priceH)*priceRange;
  return {time,price};
}

function moveAnnDrag(mx,my){
  if(!draggingAnn) return;
  var p=draggingAnn._panel;
  var conv=pixelToTimePrice(mx,my,p);
  conv.price=snapPriceToMagnet(p,conv.time,conv.price);
  // Remove the initial click-to-anchor offset
  var newTime=conv.time - draggingAnn._dt;
  var newPrice=conv.price - draggingAnn._dp;

  if(draggingAnn.type==='hline'){
    draggingAnn.y1=newPrice; draggingAnn.y2=newPrice;
  } else if(draggingAnn.type==='vline'){
    draggingAnn.x1=newTime; draggingAnn.x2=newTime;
  } else if(draggingAnn.type==='xline'){
    draggingAnn.x1=newTime; draggingAnn.x2=newTime; draggingAnn.y1=newPrice; draggingAnn.y2=newPrice;
  } else {
    var dt=newTime-draggingAnn._origX1;
    var dp=newPrice-draggingAnn._origY1;
    draggingAnn.x1=draggingAnn._origX1+dt;
    draggingAnn.y1=draggingAnn._origY1+dp;
    if(draggingAnn._origX2!=null) draggingAnn.x2=draggingAnn._origX2+dt;
    if(draggingAnn._origY2!=null) draggingAnn.y2=draggingAnn._origY2+dp;
    if(Array.isArray(draggingAnn._origPoints)) draggingAnn.points=draggingAnn._origPoints.map(function(pt){return {x:pt.x+dt,y:pt.y+dp};});
    if(draggingAnn.y3!=null&&draggingAnn._origY3!=null) draggingAnn.y3=draggingAnn._origY3+dp;
  }
  renderAll();
}
function endAnnDrag(){
  if(!draggingAnn) return;
  delete draggingAnn._panel;
  delete draggingAnn._dt; delete draggingAnn._dp;
  delete draggingAnn._origX1; delete draggingAnn._origY1;
  delete draggingAnn._origX2; delete draggingAnn._origY2; delete draggingAnn._origPoints; delete draggingAnn._origY3;
  draggingAnn=null;
}


// ══════════════════════════════════════════════════════════
function showOHLCVTip(p,bar,screenX,screenY){
  let tip=document.getElementById(`tip-${p.idx}`);
  if(!tip){
    tip=document.createElement('div');
    tip.id=`tip-${p.idx}`;
    tip.className='ohlcv-tip';
    document.getElementById(`cw-${p.idx}`).appendChild(tip);
  }
  const chg=bar.close-bar.open, pct=((chg/bar.open)*100).toFixed(2);
  const up=chg>=0;
  const e9=calcEMA(p.data,9); const e20=calcEMA(p.data,20); const e50=calcEMA(p.data,50);
  const idx=p.data.indexOf(bar);
  const e9v=e9[idx]!=null?fmtPrice(e9[idx]):'—';
  const e20v=e20[idx]!=null?fmtPrice(e20[idx]):'—';
  const e50v=e50[idx]!=null?fmtPrice(e50[idx]):'—';

  tip.innerHTML=`
    <div class="tip-header">${fmtTimeCross(bar.time,p.tf)}</div>
    <hr class="tip-divider">
    <div class="tip-row"><span class="tip-label">Open</span><span class="tip-val" style="color:#dde3f0">${fmtPrice(bar.open)}</span></div>
    <div class="tip-row"><span class="tip-label">High</span><span class="tip-val" style="color:#26a69a">${fmtPrice(bar.high)}</span></div>
    <div class="tip-row"><span class="tip-label">Low</span><span class="tip-val" style="color:#ef5350">${fmtPrice(bar.low)}</span></div>
    <div class="tip-row"><span class="tip-label">Close</span><span class="tip-val" style="color:${up?'#26a69a':'#ef5350'}">${fmtPrice(bar.close)}</span></div>
    <div class="tip-row"><span class="tip-label">Change</span><span class="tip-val" style="color:${up?'#26a69a':'#ef5350'}">${up?'+':''}${chg.toFixed(2)} (${pct}%)</span></div>
    <div class="tip-row"><span class="tip-label">Volume</span><span class="tip-val" style="color:#8080e8">${fmtVol(bar.volume)}</span></div>
    <div class="tip-row"><span class="tip-label">$Volume</span><span class="tip-val" style="color:#a78bfa">${fmtVol(bar.volume*bar.close)}</span></div>
    <hr class="tip-divider">
    <div class="tip-row"><span class="tip-label">EMA 9</span><span class="tip-val" style="color:#e8d000">${e9v}</span></div>
    <div class="tip-row"><span class="tip-label">EMA 20</span><span class="tip-val" style="color:#3a70e0">${e20v}</span></div>
    <div class="tip-row"><span class="tip-label">EMA 50</span><span class="tip-val" style="color:#00c8e8">${e50v}</span></div>
  `;
  tip.style.display='block';
  const wrap=document.getElementById(`cw-${p.idx}`);
  const wr=wrap.getBoundingClientRect();
  let tx=screenX-wr.left+14, ty=screenY-wr.top-20;
  if(tx+200>wr.width) tx=screenX-wr.left-210;
  if(ty<0) ty=4;
  tip.style.left=tx+'px'; tip.style.top=ty+'px';
}
function hideOHLCVTip(idx){
  const t=document.getElementById(`tip-${idx}`);
  if(t) t.style.display='none';
}

// ══════════════════════════════════════════════════════════
//  SCROLLBAR
// ══════════════════════════════════════════════════════════
function updateScrollbar(p){
  const thumb=document.getElementById(`sb-thumb-${p.idx}`);
  const track=document.getElementById(`sb-track-${p.idx}`);
  if(!thumb||!track||!p.data.length) return;
  const trackW=track.clientWidth;
  const total=p.data.length;
  const ratio=p.viewBars/total;
  const thumbW=Math.max(20,Math.round(trackW*ratio));
  const maxOff=trackW-thumbW;
  const off=Math.round((p.viewStart/Math.max(1,total-p.viewBars))*maxOff);
  thumb.style.width=thumbW+'px';
  thumb.style.left=Math.min(off,maxOff)+'px';
}

// ══════════════════════════════════════════════════════════
//  PANEL DOM
// ══════════════════════════════════════════════════════════
function buildPanels(){
  const grid=document.getElementById('grid');
  panels.forEach((p,i)=>{
    const div=document.createElement('div');
    div.className='panel'; div.id=`panel-${i}`;
    div.innerHTML=`
      <div class="ph" id="ph-${i}">
        <span class="ph-sym" id="sym-${i}">${symbol}</span>
        <div class="tf-wrap">${TF_LIST.map(t=>`<button class="tf-btn${t.tf===p.tf?' active':''}" data-tf="${t.tf}">${t.l}</button>`).join('')}</div>
        <span class="ph-ohlc" id="ohlc-${i}"></span>
        <div class="panel-btns">
          <button class="pnl-btn expand-btn" id="expand-${i}">⛶</button>
        </div>
      </div>
      <div class="ind-row" id="indrow-${i}">
        <span style="font-size:11px;color:#2a3050;letter-spacing:1px;margin-right:2px;">IND</span>
        <button class="preset-btn${activePreset==='Sam'?' active':''}" data-preset="Sam" onclick="loadPreset('Sam')" style="padding:2px 6px;border-radius:3px;font-size:8px;font-weight:700;cursor:pointer;">SAM</button>
        <button class="preset-btn${activePreset==='Mike'?' active':''}" data-preset="Mike" onclick="loadPreset('Mike')" style="padding:2px 6px;border-radius:3px;font-size:8px;font-weight:700;cursor:pointer;">MIKE</button>
        <span style="width:1px;height:10px;background:#2a3050;margin:0 2px;"></span>
        <div id="ind-hot-${i}" style="display:flex;gap:4px;align-items:center;"></div>
      </div>
      <div class="pdr" id="pdr-${i}">
        <label>FROM</label><input type="date" id="from-${i}" autocomplete="off"/>
        <label>TO</label><input type="date" id="to-${i}" autocomplete="off"/>
        <div class="pdr-sep"></div>
        <label>TARGET</label><input type="date" id="tgt-${i}" autocomplete="off"/>
        <label>BACK</label><input type="number" id="back-${i}" min="1" max="9999" placeholder="days" style="width:52px"/>
        <label>FWD</label><input type="number" id="fwd-${i}" min="0" max="9999" placeholder="days" style="width:52px"/>
        <button class="appl" id="apply-${i}">APPLY</button>
        <button class="appl" id="applyall-${i}" style="border-color:#D4AF37;color:#D4AF37;">APPLY ALL</button>
      </div>
      <div class="cwrap" id="cw-${i}">
        <canvas id="canvas-${i}"></canvas>
        <div class="overlay active" id="ov-${i}" style="background:rgba(12,14,20,.75)">
          <div class="spinner"></div><div class="ov-msg">LOADING…</div>
        </div>
      </div>
      <div class="scrollbar-wrap" id="sb-${i}">
        <div class="scrollbar-track" id="sb-track-${i}">
            <div class="scrollbar-thumb" id="sb-thumb-${i}"></div>
          </div>
        </div>
        <div style="position:absolute;bottom:22px;right:4px;display:flex;gap:2px;z-index:10;">
          <button id="sa-left-${i}" style="background:#1a1e2e;border:1px solid #3a4870;color:#8aa0c0;font-size:13px;padding:4px 10px;cursor:pointer;border-radius:4px;font-weight:700;line-height:1;" title="Scroll left 1 candle">◀</button>
          <button id="sa-right-${i}" style="background:#1a1e2e;border:1px solid #3a4870;color:#8aa0c0;font-size:13px;padding:4px 10px;cursor:pointer;border-radius:4px;font-weight:700;line-height:1;" title="Scroll right 1 candle">▶</button>
        </div>
      </div>`;
    grid.appendChild(div);

    // TF buttons
    div.querySelectorAll('.tf-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        div.querySelectorAll('.tf-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active'); p.tf=btn.dataset.tf; loadPanel(i);
      });
      // Double-click TF button: restore previous daily view if we drilled in
      btn.addEventListener('dblclick',()=>{
        if(p._prevTf){
          p.tf=p._prevTf; p.startDate=p._prevStart; p.endDate=p._prevEnd;
          document.getElementById('from-'+i).value=p.startDate||'';
          document.getElementById('to-'+i).value=p.endDate||'';
          div.querySelectorAll('.tf-btn').forEach(b=>b.classList.toggle('active',b.dataset.tf===p.tf));
          p._prevTf=null; p._prevStart=null; p._prevEnd=null;
          toast('↩ Restored previous view');
          loadPanel(i);
        }
      });
    });

    // Indicator toggles
    div.querySelectorAll('.ptog').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const ind=btn.dataset.ind;
        if(ind==='tl'){p.showTL=!p.showTL;btn.classList.toggle('on',p.showTL);btn.classList.toggle('off',!p.showTL);}
        else if(ind==='ann'){p.showAnn=!p.showAnn;btn.classList.toggle('on',p.showAnn);btn.classList.toggle('off',!p.showAnn);}
        else if(ind==='otherann'){p.showOtherAnn=!p.showOtherAnn;btn.classList.toggle('on',p.showOtherAnn);btn.classList.toggle('off',!p.showOtherAnn);}
        else if(ind==='exec'){p.showExec=!p.showExec;btn.classList.toggle('on',p.showExec);btn.classList.toggle('off',!p.showExec);}
        else if(ind==='btexec'){p.showBtExec=!p.showBtExec;btn.classList.toggle('on',p.showBtExec);btn.classList.toggle('off',!p.showBtExec);}
        else if(ind==='pdc'){p.showPDC=!p.showPDC;btn.classList.toggle('on',p.showPDC);btn.classList.toggle('off',!p.showPDC);}
        else{p.inds[ind]=!p.inds[ind];btn.classList.toggle('on',p.inds[ind]);btn.classList.toggle('off',!p.inds[ind]);}
        if(p.data.length){renderPanel(p);updateScrollbar(p);}
      });
    });

    // Sync initial button on/off classes from inds state
    div.querySelectorAll('.ptog[data-ind]').forEach(btn=>{
      const ind=btn.dataset.ind;
      if(['ema9','ema20','ema50','ema200','ema150','ema40_60','vwap','db_upper','db_low1','db_low2'].includes(ind)){
        btn.classList.toggle('on', !!p.inds[ind]);
        btn.classList.toggle('off', !p.inds[ind]);
      }
    });

    // Per-panel ADJ toggle
    var adjBtn=div.querySelector('.adj-panel-btn');
    if(adjBtn) adjBtn.addEventListener('click', function(){
      p.adjusted=!p.adjusted;
      this.classList.toggle('on',p.adjusted);
      this.classList.toggle('off',!p.adjusted);
      this.style.color=p.adjusted?'#f59e0b':'#4a5580';
      this.style.borderColor=p.adjusted?'#f59e0b':'#4a5580';
      this.style.textDecoration=p.adjusted?'':'line-through';
      loadPanel(i);
    });

    document.getElementById(`apply-${i}`).addEventListener('click',()=>applyDates(i));
    document.getElementById(`applyall-${i}`).addEventListener('click',()=>applyDatesAll(i));
    document.getElementById(`expand-${i}`).addEventListener('click',()=>toggleFullscreen(i));

    // Canvas events
    const wrap=document.getElementById(`cw-${i}`);
    const canvas=document.getElementById(`canvas-${i}`);
    p.canvas=canvas; p.ctx=canvas.getContext('2d');

    wrap.addEventListener('mousemove',evt=>{
      const r=wrap.getBoundingClientRect();
      p.cx=evt.clientX-r.left; p.cy=evt.clientY-r.top;
      // Freehand drawing (brush / highlight)
      if(freehandState&&freehandState.panelIdx===p.idx){
        const chartW2=p.W-p.PRICE_W;
        const vs2=Math.max(0,Math.min(p.viewStart,p.data.length-p.viewBars));
        const bw2=chartW2/Math.max(Math.min(p.viewBars,p.data.length-vs2)+6,1);
        const bi2=Math.max(0,Math.min(p.data.length-vs2-1,Math.round(p.cx/bw2)));
        const di2=Math.max(0,Math.min(p.data.length-1,vs2+bi2));
        const{min,max}=getMinMax(p);
        const priceH2=p.H-p.TIME_H-(p.inds.vol?Math.round(p.H*(p.volFrac||VOL_FRAC_DEFAULT)):0);
        var fTime=toUnix(p.data[di2].time), fPrice=max+(max-min)*0.15-((max-min)*1.3)*(p.cy/priceH2);
        fPrice=snapPriceToMagnet(p,fTime,fPrice);
        freehandState.points.push({x:fTime,y:fPrice});
        renderPanel(p); return;
      }
      // Update OHLCV tooltip to follow mouse when holding
      if(p._showingOHLCV && p.data.length){
        const chartW2=p.W-p.PRICE_W;
        const vs2=Math.max(0,Math.min(p.viewStart,Math.max(0,p.data.length-p.viewBars)));
        const vlen2=Math.min(p.viewBars,p.data.length-vs2);
        const barW2=chartW2/Math.max(vlen2+3,1);
        const bi=Math.round(p.cx/barW2);
        const di=Math.max(0,Math.min(p.data.length-1,vs2+bi));
        if(p.data[di]) showOHLCVTip(p,p.data[di],evt.clientX,evt.clientY);
      }
      // Sync crosshair time to other panels
      const chartW_=p.W-p.PRICE_W;
      const vs_=Math.max(0,Math.min(p.viewStart,p.data.length-p.viewBars));
      const bw_=chartW_/Math.max(Math.min(p.viewBars,p.data.length-vs_)+6,1);
      const bi_=Math.max(0,Math.min(p.data.length-vs_-1,Math.round(p.cx/bw_)));
      const bar_=p.data[vs_+bi_];
      const newT=bar_?bar_.time:-1;
      // Also capture the price at cursor y position
      const priceH_=p.H-p.TIME_H-(p.inds.vol?Math.round(p.H*(p.volFrac||VOL_FRAC_DEFAULT)):0);
      const{min:minP_,max:maxP_}=getMinMax(p);
      const priceRange_=maxP_-minP_;
      const cursorPrice=priceRange_>0&&p.cy>=0&&p.cy<=priceH_?minP_+priceRange_*(1-p.cy/priceH_):-1;
      if(newT!==globalCrossTime||cursorPrice!==globalCrossPrice){
        globalCrossTime=newT;
        globalCrossPrice=cursorPrice;
        panels.forEach(op=>{ if(op!==p&&op.data.length) renderPanel(op); });
      }
      renderPanel(p);
    });
    // Right-click to show OHLCV tooltip
    wrap.addEventListener('contextmenu',evt=>{
      evt.preventDefault();
      // Right-click deselects active tool
      if(activeTool){setActiveTool(null);toast('Tool deselected');return;}
      const r=wrap.getBoundingClientRect();
      const mx=evt.clientX-r.left;
      const chartW=p.W-p.PRICE_W;
      const vs=Math.max(0,Math.min(p.viewStart,p.data.length-p.viewBars));
      const bw=chartW/Math.max(Math.min(p.viewBars,p.data.length-vs)+6,1);
      const bi=Math.max(0,Math.min(p.data.length-vs-1,Math.round(mx/bw)));
      const bar=p.data[vs+bi];
      if(bar){showOHLCVTip(p,bar,evt.clientX,evt.clientY);p._showingOHLCV=true;}
    });

    wrap.addEventListener('mouseleave',()=>{
      p.cx=-1;p.cy=-1;
      globalCrossTime=-1; globalCrossPrice=-1;
      panels.forEach(op=>{ if(op!==p&&op.data.length) renderPanel(op); });
      renderPanel(p);hideOHLCVTip(i);
    });

    // Double-click chart
    wrap.addEventListener('dblclick',evt=>{
      evt.preventDefault(); evt.stopPropagation();
      if(!p.data||!p.data.length) return;

      // Finish path annotation on double-click
      if(activeTool==='path'&&toolAnchor&&Array.isArray(toolAnchor.points)&&toolAnchor.panelIdx===p.idx){
        finishPathAnnotation(); return;
      }

      // If this is a DAILY/WEEKLY panel, switch to 5m intraday for that candle's date
      if(p.tf==='D'||p.tf==='W'){
        const r=wrap.getBoundingClientRect();
        const mx=evt.clientX-r.left;
        const chartW=p.W-p.PRICE_W;
        const vs=Math.max(0,Math.min(p.viewStart,p.data.length-p.viewBars));
        const bw=chartW/Math.max(Math.min(p.viewBars,p.data.length-vs)+6,1);
        const bi=Math.max(0,Math.min(p.data.length-vs-1,Math.round(mx/bw)));
        const bar=p.data[vs+bi];
        if(bar&&bar.time){
          const dateStr=typeof bar.time==='string'?bar.time:fmtDate(new Date(bar.time*1000));
          // Store original TF/dates so user can go back
          p._prevTf=p.tf; p._prevStart=p.startDate; p._prevEnd=p.endDate;
          // Load from day before to day after
          const clickedD=new Date(dateStr+'T12:00:00Z');
          const prevD=new Date(clickedD); prevD.setUTCDate(prevD.getUTCDate()-1);
          const nextD=new Date(clickedD); nextD.setUTCDate(nextD.getUTCDate()+1);
          const fromStr=fmtDate(prevD);
          const toStr=fmtDate(nextD);
          p.tf='5'; p.startDate=fromStr; p.endDate=toStr;
          // Update the UI inputs
          const panelDiv=document.getElementById('panel-'+i);
          panelDiv.querySelectorAll('.tf-btn').forEach(b=>{b.classList.toggle('active',b.dataset.tf==='5');});
          document.getElementById('from-'+i).value=fromStr;
          document.getElementById('to-'+i).value=toStr;
          toast('📈 '+symbol+' 5m — '+fromStr+' → '+toStr+' (dbl-click TF to go back)');
          loadPanel(i);
          return;
        }
      }
      
      // Otherwise: fill stop price input
      const stopInput=document.getElementById('pct-stop-input');
      if(!stopInput) return;
      const r=wrap.getBoundingClientRect();
      const my=evt.clientY-r.top;
      const volH=p.inds.vol?Math.round(p.H*(p.volFrac||VOL_FRAC_DEFAULT)):0;
      const priceH=p.H-p.TIME_H-volH;
      if(my>priceH||my<0) return;
      const{min,max}=getMinMax(p);
      const pad=(max-min)*0.15||(min*0.02);
      const maxP=max+pad, minP=Math.max(0,min-pad);
      const price=maxP-(my/priceH)*(maxP-minP);
      if(price>0){
        stopInput.value=price.toFixed(2);
        stopInput.style.borderColor='#facc15';
        stopInput.style.background='#2a2000';
        setTimeout(()=>{stopInput.style.borderColor='';stopInput.style.background='';},600);
        // Show brief confirmation
        const dblToast=document.createElement('div');
        dblToast.textContent='STOP → $'+price.toFixed(2);
        dblToast.style.cssText='position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#facc15;color:#000;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:700;z-index:9999;';
        document.body.appendChild(dblToast);
        setTimeout(()=>dblToast.remove(),800);
      }
    });

    // ═══ TradingView-style input handling ═══
    // Normalizes trackpad (deltaMode 0), mouse wheel (deltaMode 1), and pinch (ctrlKey)
    // Uses rAF-batched rendering for butter-smooth zoom and pan
    p._inputZoom=0;    // accumulated zoom intent
    p._inputPan=0;     // accumulated pan intent (pixels)
    p._inputRaf=null;  // rAF handle
    p._lastInput=0;    // timestamp for momentum decay
    
    function processInput(){
      p._inputRaf=null;
      if(!p.data.length) return;
      
      // Apply zoom
      if(Math.abs(p._inputZoom) > 0.001){
        // Clamp so zoomFactor stays positive (prevents glitch when _inputZoom < -1)
        const clamped = Math.max(-0.8, Math.min(2.0, p._inputZoom));
        p._inputZoom *= 0; // consume
        const zoomFactor = 1 / (1 + clamped);
        const newBars = Math.max(10, Math.min(p.data.length, Math.round(p.viewBars * zoomFactor)));
        const atRightEdge = p.viewStart + p.viewBars >= p.data.length - 2;
        const chartW = Math.max(p.W - p.PRICE_W, 1);
        let newStart;
        if(atRightEdge){
          newStart = p.data.length - newBars;
        } else {
          const frac = p.cx / chartW;
          const center = p.viewStart + frac * p.viewBars;
          newStart = Math.round(center - frac * newBars);
        }
        p.viewBars = newBars;
        p.viewStart = newStart;
        clampView(p);
      }
      
      // Apply pan
      if(Math.abs(p._inputPan) > 0.5){
        const chartW = p.W - p.PRICE_W;
        const barsToPan = Math.round(p._inputPan * (p.viewBars / Math.max(chartW, 1)));
        p._inputPan *= 0;
        p.viewStart -= barsToPan;
        clampView(p);
      }
      
      renderPanel(p);
      updateScrollbar(p);
    }
    
    wrap.addEventListener('wheel', evt => {
      evt.preventDefault();
      if(!p.data.length) return;
      
      const tS = JSON.parse(localStorage.getItem('traderra-trackpad')||'{}');
      const zoomSens = tS.zoomSens || 0.003;
      const trackPanSens = tS.trackPanSens || 1.2;
      
      let dy = evt.deltaY;
      let dx = evt.deltaX;
      // Normalize deltaMode (1=line-based mouse wheel, 2=page)
      if(evt.deltaMode === 1){ dy *= 40; dx *= 40; }
      else if(evt.deltaMode === 2){ dy *= 800; dx *= 800; }
      
      if(evt.ctrlKey){
        // ── Mac trackpad pinch-to-zoom ──
        // ctrlKey + deltaY = pinch gesture
        // Mac sends negative deltaY for pinch-in (fingers together)
        // pinch-in (negative dy) → negative _inputZoom → zoom OUT (more bars)
        // pinch-out (positive dy) → positive _inputZoom → zoom IN (fewer bars)
        p._inputZoom += dy * zoomSens;
      } else if(Math.abs(dx) > Math.abs(dy) * 0.5){
        // ── Horizontal swipe / trackpad pan ──
        // Two-finger horizontal swipe: positive dx = swipe right = scroll to newer
        p._inputPan += dx * trackPanSens;
      } else {
        // ── Vertical scroll / mouse wheel zoom ──
        // Regular scroll wheel: normalized dy is typically ±40-120 per click
        // Use moderate sensitivity so each click zooms ~15-25%
        p._inputZoom += dy * zoomSens;
      }
      
      if(!p._inputRaf) p._inputRaf = requestAnimationFrame(processInput);
    }, {passive:false});

    // ── Price axis drag (scale Y) and volume separator drag ──
    p._priceAxisDrag=false; p._volSepDrag=false; p._dragStartY=0; p._dragStartVal=0;

    wrap.addEventListener('mousedown',evt=>{
      if(evt.button!==0) return;
      if(activeTool) return; // Don't start axis drag when a drawing tool is active
      const r=wrap.getBoundingClientRect();
      const mx=evt.clientX-r.left, my=evt.clientY-r.top;
      const chartW=p.W-p.PRICE_W;
      const volFrac=p.volFrac||VOL_FRAC_DEFAULT;
      const volH=p.inds.vol?Math.round(p.H*volFrac):0;
      const priceH=p.H-p.TIME_H-volH;

      // Check volume separator hit (within 6px of the priceH line)
      if(p.inds.vol && Math.abs(my-priceH)<6 && mx<chartW){
        p._volSepDrag=true;
        p._dragStartY=evt.clientY;
        p._dragStartVal=volFrac;
        evt.preventDefault(); evt.stopPropagation();
        wrap.style.cursor='ns-resize';
        return;
      }
      // Check price axis hit (right side, within PRICE_W)
      if(mx>=chartW && my<priceH){
        p._priceAxisDrag=true;
        p._dragStartY=evt.clientY;
        p._dragStartVal=p.priceScale||1;
        evt.preventDefault(); evt.stopPropagation();
        wrap.style.cursor='ns-resize';
        return;
      }
    });
    // Volume/price axis drag move handler
    window.addEventListener('mousemove',evt=>{
      if(p._volSepDrag){
        const dy=evt.clientY-p._dragStartY;
        // Separator at y=priceH = H-TIME_H-volH
        // Drag UP → dy negative → separator should move up → priceH decreases → volH increases → volFrac increases
        const totalH=p.H-p.TIME_H;
        p.volFrac=Math.max(0.05, Math.min(0.6, p._dragStartVal - dy/p.H));
        renderPanel(p); updateScrollbar(p);
        return;
      }
      if(p._priceAxisDrag){
        const dy=evt.clientY-p._dragStartY;
        // Drag up = zoom out on price (see more range), drag down = zoom in
        // priceScale > 1 = wider range = zoomed out
        p.priceScale=Math.max(0.2, Math.min(5.0, p._dragStartVal - dy*0.005));
        renderPanel(p); updateScrollbar(p);
        return;
      }
    });
    window.addEventListener('mouseup',evt=>{
      if(p._volSepDrag||p._priceAxisDrag){
        p._volSepDrag=false; p._priceAxisDrag=false;
        wrap.style.cursor='';
        renderPanel(p); updateScrollbar(p);
      }
    });
    // Cursor hint on hover over price axis or volume separator
    wrap.addEventListener('mousemove',evt=>{
      if(p._volSepDrag||p._priceAxisDrag||p.tlDrag||p.dragging) return;
      const r=wrap.getBoundingClientRect();
      const mx=evt.clientX-r.left, my=evt.clientY-r.top;
      const chartW=p.W-p.PRICE_W;
      const volFrac=p.volFrac||VOL_FRAC_DEFAULT;
      const volH=p.inds.vol?Math.round(p.H*volFrac):0;
      const priceH=p.H-p.TIME_H-volH;
      // Show ns-resize cursor on volume separator
      if(p.inds.vol && Math.abs(my-priceH)<6 && mx<chartW){wrap.style.cursor='ns-resize'; return;}
      // Show ns-resize cursor on price axis
      if(mx>=chartW && my<priceH && my>=0){wrap.style.cursor='ns-resize'; return;}
    });

    // Mouse down — trendline endpoint drag, chart drag, or tooltip hold
    wrap.addEventListener('mousedown',evt=>{
      if(evt.button!==0) return;
      if(activeTool) return; // Don't start chart pan when a drawing tool is active
      const r=wrap.getBoundingClientRect();
      const mx=evt.clientX-r.left, my=evt.clientY-r.top;
      const chartW=p.W-p.PRICE_W;
      const volH=p.inds.vol?Math.round(p.H*(p.volFrac||VOL_FRAC_DEFAULT)):0;
      const priceH=p.H-p.TIME_H-volH;
      // Always check for trendline endpoint hit FIRST — takes priority over everything
      if(mx<chartW && my<priceH){
        const hit=findTLEndpoint(mx,my,p,chartW,priceH);
        if(hit){p.tlDrag=hit; wrap.style.cursor='grabbing'; evt.preventDefault(); evt.stopPropagation(); return;}
      }
      p.mouseDown=true; p.mouseDownX=evt.clientX; p.mouseDownY=evt.clientY; p.mouseDownTime=Date.now();
      // Don't start dragging yet — wait for movement (allows hold-to-show-OHLCV)
      p._dragReady=true; p.dragStartX=evt.clientX; p.dragViewStart=p.viewStart;
      wrap.style.cursor='grab';
      // Hold timer: show OHLCV if no drag started within 350ms
      p._holdTimer=setTimeout(()=>{
        if(p.mouseDown && !p.dragging){
          const chartW2=p.W-p.PRICE_W;
          const vs2=Math.max(0,Math.min(p.viewStart,Math.max(0,p.data.length-p.viewBars)));
          const vlen2=Math.min(p.viewBars,p.data.length-vs2);
          const barW2=chartW2/Math.max(vlen2+3,1);
          const bi=Math.round(p.cx/barW2);
          const di=Math.max(0,Math.min(p.data.length-1,vs2+bi));
          if(p.data[di]) showOHLCVTip(p,p.data[di],p.mouseDownX,p.mouseDownY);
          p._showingOHLCV=true;
        }
      },350);
    });

    window.addEventListener('mousemove',evt=>{
      // Trendline/annotation endpoint drag
      if(p.tlDrag){
        if(p.tlDrag.ann&&p.tlDrag.ann.locked){p.tlDrag=null;return;}
        const r=wrap.getBoundingClientRect();
        const mx=evt.clientX-r.left, my=evt.clientY-r.top;
        const chartW=p.W-p.PRICE_W;
        const volH=p.inds.vol?Math.round(p.H*(p.volFrac||VOL_FRAC_DEFAULT)):0;
        const priceH=p.H-p.TIME_H-volH;
        const {min,max}=getMinMax(p);
        var price=max-Math.max(0,Math.min(my,priceH))/priceH*(max-min);
        const vs=Math.max(0,Math.min(p.viewStart,Math.max(0,p.data.length-p.viewBars)));
        const ve2=Math.min(vs+p.viewBars,p.data.length);
        const vlen=ve2-vs;
        const barW=chartW/Math.max(vlen+(window.RIGHT_PAD||6),1);
        const bi=Math.max(0,Math.min(vlen-1,Math.floor(mx/barW)));
        const di=Math.max(0,Math.min(p.data.length-1,vs+bi));
        var time=toUnix(p.data[di].time);
        price=snapPriceToMagnet(p,time,price);
        if(!applyAnnHandleMove(p.tlDrag,time,price)){
          // Fallback to simple endpoint logic
          if(p.tlDrag.endpoint==='1'){p.tlDrag.ann.x1=time; p.tlDrag.ann.y1=price;}
          else if(p.tlDrag.endpoint==='2'){p.tlDrag.ann.x2=time; p.tlDrag.ann.y2=price;}
        }
        renderPanel(p); return;
      }
      // Left-click drag to pan (starts after 3px movement)
      if(p._dragReady && !p.dragging){
        const dx=evt.clientX-p.dragStartX;
        if(Math.abs(dx)>3){
          p.dragging=true;
          p._dragReady=false;
          clearTimeout(p._holdTimer); // cancel OHLCV hold
          wrap.style.cursor='grabbing';
        }
      }
      if(!p.dragging) return;
      const dx=evt.clientX-p.dragStartX;
      const chartW=p.W-p.PRICE_W;
      p.viewStart=Math.round(p.dragViewStart-dx*(p.viewBars/Math.max(chartW,1)));
      clampView(p); renderPanel(p); updateScrollbar(p);
    });
    window.addEventListener('mouseup',()=>{
      if(p.tlDrag){p.tlDrag=null; wrap.style.cursor=''; renderAll(); return;}
      if(draggingAnn){endAnnDrag();wrap.style.cursor='';return;}
      if(freehandState&&freehandState.panelIdx===p.idx){finishFreehandAnnotation();return;}
      p._dragReady=false;
      if(p.dragging){p.dragging=false;wrap.style.cursor='';}
      else{wrap.style.cursor='';}
      p.mouseDown=false; p._showingOHLCV=false; clearTimeout(p._holdTimer); hideOHLCVTip(i);
    });

    // Cursor: show grab when hovering near a trendline endpoint, ns-resize for price axis / vol separator
    wrap.addEventListener('mousemove',evt=>{
      if(p.tlDrag||p._volSepDrag||p._priceAxisDrag) return;
      const r=wrap.getBoundingClientRect();
      const mx=evt.clientX-r.left, my=evt.clientY-r.top;
      const chartW=p.W-p.PRICE_W;
      const volH=p.inds.vol?Math.round(p.H*(p.volFrac||VOL_FRAC_DEFAULT)):0;
      const priceH=p.H-p.TIME_H-volH;
      // Volume separator
      if(p.inds.vol && Math.abs(my-priceH)<6 && mx<chartW){wrap.style.cursor='ns-resize'; return;}
      // Price axis
      if(mx>=chartW && my<priceH && my>=0){wrap.style.cursor='ns-resize'; return;}
      // Trendline endpoint
      if(mx<chartW&&my<priceH){
        const hit=findTLEndpoint(mx,my,p,chartW,priceH);
        if(hit){wrap.style.cursor='grab'; return;}
      }
      // Annotation hover — show grab cursor when over any annotation
      if(!activeTool && mx<chartW && my<priceH){
        const hit=findAnnAt(mx,my,p);
        if(hit){wrap.style.cursor='grab'; return;}
      }
      wrap.style.cursor=activeTool?'crosshair':'';
    });

    // Click for tool actions (del, edit, place annotations)
    wrap.addEventListener('click',evt=>{
      if(draggingAnn){endAnnDrag();wrap.style.cursor='';return;}
      if(!activeTool) return; // selection handled by mousedown now
      const r=wrap.getBoundingClientRect();
      const mx=evt.clientX-r.left, my=evt.clientY-r.top;
      const chartW=p.W-p.PRICE_W;
      const volH=p.inds.vol?Math.round(p.H*(p.volFrac||VOL_FRAC_DEFAULT)):0;
      const priceH=p.H-p.TIME_H-volH;
      if(mx>chartW||my>priceH+volH) return;
      if(!p.data.length) return;
      if(activeTool==='del'){handleDelete(mx,my,p);return;}
      if(activeTool==='edit'){handleEdit(mx,my,p,evt);return;}
      handleAnnotationClick(i,mx,my,chartW,priceH,p);
    });
    // Mousedown for drag: hover any annotation, click+drag to move it
    // This runs BEFORE the chart-pan mousedown (added first = runs first)
    wrap.addEventListener('mousedown',evt=>{
      if(activeTool||evt.button!==0) return;
      const r=wrap.getBoundingClientRect();
      const mx=evt.clientX-r.left, my=evt.clientY-r.top;
      const chartW2=p.W-p.PRICE_W;
      if(mx>chartW2) return;
      const volH2=p.inds.vol?Math.round(p.H*(p.volFrac||VOL_FRAC_DEFAULT)):0;
      const priceH2=p.H-p.TIME_H-volH2;
      if(my>priceH2) return;
      var hit=findAnnAt(mx,my,p);
      if(hit && !hit.locked && !_lockAll){
        // Select it + start dragging immediately
        selectedAnn=hit;
        startAnnDrag(hit,mx,my,p);
        showAnnToolbar(hit,evt.clientX,evt.clientY,p);
        renderAll();
        wrap.style.cursor='grabbing';
        // Block chart pan
        evt.preventDefault();
        evt.stopPropagation();
      } else if(hit && (hit.locked || _lockAll)){
        // Locked — select but don't drag
        selectedAnn=hit;
        showAnnToolbar(hit,evt.clientX,evt.clientY,p);
        renderAll();
      } else if(!hit && selectedAnn){
        // Clicked empty space — deselect
        selectedAnn=null;
        hideAnnToolbar();
        renderAll();
      }
    }, true); // capture phase = runs before the chart-pan handler

    // Global drag handlers for annotation move
    (function(){
      var dragPanelIdx=i;
      document.addEventListener('mousemove',function(evt){
        if(!draggingAnn||draggingAnn._panel.idx!==dragPanelIdx) return;
        var wrap2=document.getElementById('cw-'+dragPanelIdx);
        if(!wrap2) return;
        var r2=wrap2.getBoundingClientRect();
        moveAnnDrag(evt.clientX-r2.left,evt.clientY-r2.top);
      });
      document.addEventListener('mouseup',function(){
        if(draggingAnn&&draggingAnn._panel&&draggingAnn._panel.idx===dragPanelIdx){
          endAnnDrag();
        }
      });
    })();

    // Scrollbar drag
    const sbThumb=document.getElementById(`sb-thumb-${i}`);
    const sbTrack=document.getElementById(`sb-track-${i}`);
    sbThumb.addEventListener('mousedown',evt=>{
      evt.stopPropagation();
      p.sbDragging=true; p.sbDragStartX=evt.clientX; p.sbDragViewStart=p.viewStart;
      sbThumb.classList.add('dragging');
    });
    sbTrack.addEventListener('click',evt=>{
      if(p.sbDragging) return;
      const r=sbTrack.getBoundingClientRect();
      const frac=(evt.clientX-r.left)/r.width;
      p.viewStart=Math.round(frac*Math.max(0,p.data.length-p.viewBars));
      clampView(p); renderPanel(p); updateScrollbar(p);
    });
    window.addEventListener('mousemove',evt=>{
      if(!p.sbDragging) return;
      const track=document.getElementById(`sb-track-${i}`);
      const trackW=track.clientWidth;
      const thumbW=sbThumb.offsetWidth;
      const maxOff=trackW-thumbW;
      const dx=evt.clientX-p.sbDragStartX;
      const dView=Math.round((dx/maxOff)*Math.max(1,p.data.length-p.viewBars));
      p.viewStart=p.sbDragViewStart+dView;
      clampView(p); renderPanel(p); updateScrollbar(p);
    });
    window.addEventListener('mouseup',()=>{
      if(p.sbDragging){p.sbDragging=false;sbThumb.classList.remove('dragging');}
    });

    // Arrow buttons for candle-by-candle scrolling
    document.getElementById(`sa-left-${i}`).addEventListener('click',(e)=>{
      e.stopPropagation();
      if(!p.data||!p.data.length) return;
      p.viewStart=Math.max(0,(p.viewStart||0)-1);
      clampView(p); renderPanel(p); updateScrollbar(p);
    });
    document.getElementById(`sa-right-${i}`).addEventListener('click',(e)=>{
      e.stopPropagation();
      if(!p.data||!p.data.length) return;
      p.viewStart=Math.min(Math.max(0,p.data.length-(p.viewBars||50)),(p.viewStart||0)+1);
      clampView(p); renderPanel(p); updateScrollbar(p);
    });

    const ro=new ResizeObserver(()=>resizePanel(p));
    ro.observe(wrap);
  });
}

// ══════════════════════════════════════════════════════════
//  ANNOTATION HANDLING
// ══════════════════════════════════════════════════════════
function handleAnnotationClick(panelIdx,mx,my,chartW,priceH,p){
  const vs2=Math.max(0,Math.min(p.viewStart,Math.max(0,p.data.length-p.viewBars))); const vlen2=Math.min(p.viewBars,p.data.length-vs2); const barW=chartW/Math.max(vlen2+6,1);
  const vs=Math.max(0,Math.min(p.viewStart,p.data.length-p.viewBars));
  const bi=Math.floor(mx/barW);
  const di=Math.max(0,Math.min(p.data.length-1,vs+bi));
  const{min,max}=getMinMax(p);
  var price=min+(max-min)*(1-my/priceH);
  const time=toUnix(p.data[di].time);
  // Snap price to nearest OHLC when magnet is active
  price=snapPriceToMagnet(p,time,price);

  // ── FREEHAND TOOLS (brush / highlight) ──
  if(activeTool==='brush'||activeTool.startsWith('hl_')){
    // Start freehand on mousedown (handled by separate mousemove/mouseup)
    if(activeTool==='brush'){
      freehandState={type:'brush',panelIdx,color:drawDefaults.color||'#94a3b8',lineWidth:drawDefaults.lineWidth||3,opacity:drawDefaults.opacity!=null?drawDefaults.opacity:1,points:[{x:time,y:price}]};
    } else {
      const hlCol=C[activeTool]||'#22d3ee';
      const hlOp=(parseInt(document.getElementById('hl-opacity').value)||35)/100;
      freehandState={type:activeTool,panelIdx,color:hlCol,lineWidth:28,opacity:hlOp,points:[{x:time,y:price}]};
    }
    renderAll(); return;
  }

  // ── PATH TOOL (multi-click) ──
  if(activeTool==='path'){
    if(!toolAnchor||!Array.isArray(toolAnchor.points)){
      toolAnchor={panelIdx,time,price,rawX:mx,rawY:my,points:[{x:time,y:price}]};
      toolStep='second';
      updateHint('PATH: click to add points, double-click or Enter to finish');
    } else if(toolAnchor.panelIdx===panelIdx){
      toolAnchor.points.push({x:time,y:price});
      renderAll();
      updateHint('PATH: '+toolAnchor.points.length+' points — double-click or Enter to finish');
    }
    return;
  }

  // ── SINGLE-CLICK TOOLS ──
  if(activeTool==='hline'){var _a={id:nextId++,type:'hline',panelIdx,x1:time,y1:price,x2:time,y2:price};applyDrawDefaults(_a);annotations.push(_a);renderAll();toast('✓ Horizontal line placed');return;}
  if(activeTool==='vline'){var _b={id:nextId++,type:'vline',panelIdx,x1:time,y1:price,x2:time,y2:price};applyDrawDefaults(_b);annotations.push(_b);renderAll();toast('✓ Vertical line placed');return;}
  if(activeTool==='xline'){var _c={id:nextId++,type:'xline',panelIdx,x1:time,y1:price,x2:time,y2:price};applyDrawDefaults(_c);annotations.push(_c);renderAll();toast('✓ Cross line placed');return;}
  if(activeTool==='measure'){if(!toolStep||toolStep==='first'){toolAnchor={panelIdx,time,price,rawX:mx,rawY:my};toolStep='second';updateHint('Click END to measure');return;}
    toast('Δ '+Math.abs(time-toolAnchor.time).toFixed(0)+' bars, $'+Math.abs(price-toolAnchor.price).toFixed(2));toolStep='first';toolAnchor=null;return;}

  // ── TWO-CLICK TOOLS (trendline, ray, hray, fib, boxes, shapes, gann_box) ──
  const twoClickTools=['trendline','ray','hray','fib_ret','box_orange','box_yellow','circle','ellipse','triangle','gann_box'];
  if(twoClickTools.includes(activeTool)){
    if(!toolStep||toolStep==='first'){
      toolAnchor={panelIdx,time,price,rawX:mx,rawY:my};toolStep='second';
      var hints={trendline:'LINE: click END point',ray:'RAY: click DIRECTION point',hray:'H-RAY: click where to start',fib_ret:'FIB: click LOW point','box_orange':'BOX: click opposite corner','box_yellow':'BOX: click opposite corner',circle:'CIRCLE: click opposite side',ellipse:'ELLIPSE: click opposite corner',triangle:'TRIANGLE: click opposite corner',gann_box:'GANN BOX: click opposite corner'};
      updateHint(hints[activeTool]||'Click END point');
    } else {
      const annObj={id:nextId++,type:activeTool,panelIdx:toolAnchor.panelIdx,x1:toolAnchor.time,y1:toolAnchor.price,x2:time,y2:price};
      applyDrawDefaults(annObj);
      if(activeTool.startsWith('hl_')) annObj.opacity=(parseInt(document.getElementById('hl-opacity').value)||35)/100;
      if(activeTool==='fib_ret') ensureFibSettings(annObj);
      annotations.push(annObj);
      toolStep='first'; toolAnchor=null;
      updateHint('Click START point');
      renderAll(); toast(`✓ ${activeTool} placed`);
    }
    return;
  }

  // ── THREE-CLICK TOOLS (parallel, disjoint) ──
  if(activeTool==='parallel'||activeTool==='disjoint'){
    if(!toolStep||toolStep==='first'){
      toolAnchor={panelIdx,time,price,rawX:mx,rawY:my};toolStep='second';
      updateHint(activeTool.toUpperCase()+': click END of first line');
    } else if(toolStep==='second'){
      toolAnchor.x2=time; toolAnchor.y2=price; toolStep='third';
      updateHint(activeTool.toUpperCase()+': click start of second line');
    } else if(toolStep==='third'){
      var _ch={id:nextId++,type:activeTool,panelIdx:toolAnchor.panelIdx,x1:toolAnchor.time,y1:toolAnchor.price,x2:toolAnchor.x2,y2:toolAnchor.y2,x3:time,y3:price};
      applyDrawDefaults(_ch); annotations.push(_ch);
      toolStep='first'; toolAnchor=null;
      renderAll(); toast(`✓ ${activeTool} placed`);
    }
    return;
  }

  // ── TEXT / CALLOUT / NOTE ──
  if(activeTool==='callout'){
    if(toolStep!=='second'){toolAnchor={panelIdx,time,price,rawX:mx,rawY:my};toolStep='second';updateHint('CALLOUT: click where to place text box');
    } else {pendingText={panelIdx,time,price,color:'callout',targetTime:toolAnchor.time,targetPrice:toolAnchor.price};const wrap=document.getElementById(`cw-${panelIdx}`);const wr=wrap.getBoundingClientRect();showTextPopup(wr.left+mx,wr.top+my-60);toolStep='first';toolAnchor=null;}
    return;
  }
  if(activeTool.startsWith('text_')){pendingText={panelIdx,time,price,color:activeTool};const wrap=document.getElementById(`cw-${panelIdx}`);const wr=wrap.getBoundingClientRect();showTextPopup(wr.left+mx,wr.top+my-60);return;}
  if(activeTool==='note'){pendingText={panelIdx,time,price,color:'note'};const wrap=document.getElementById(`cw-${panelIdx}`);const wr=wrap.getBoundingClientRect();showTextPopup(wr.left+mx,wr.top+my-60);return;}
  if(activeTool==='price_label'){annotations.push({id:nextId++,type:'price_label',panelIdx,x1:time,y1:price,text:price.toFixed(2),color:drawDefaults.color||'#26a69a'});applyDrawDefaults(annotations[annotations.length-1]);renderAll();toast('Price label placed');return;}
  if(activeTool==='flag'){pendingText={panelIdx,time,price,color:'flag'};const wrap=document.getElementById(`cw-${panelIdx}`);const wr=wrap.getBoundingClientRect();showTextPopup(wr.left+mx,wr.top+my-60);return;}

  // ── POSITION TOOLS ──
  if(activeTool==='long_pos'){
    if(!toolStep||toolStep==='first'){toolAnchor={panelIdx,time,price};toolStep='second';updateHint('LONG POS: click TAKE PROFIT level');
    } else {var _entry=toolAnchor.price,_tp=price,_stop=_entry-(_tp-_entry);var _a2={id:nextId++,type:'long_pos',panelIdx:toolAnchor.panelIdx,x1:toolAnchor.time,y1:_entry,y2:_tp,y3:_stop};applyDrawDefaults(_a2);annotations.push(_a2);toolStep=null;toolAnchor=null;if(!_stayDraw)setActiveTool(null);else{toolStep='first';updateHint('LONG POS: click ENTRY price level');}renderAll();toast('✓ Long position — R:R '+(Math.abs(_tp-_entry)/Math.abs(_entry-_stop)).toFixed(2));}
    return;
  }
  if(activeTool==='short_pos'){
    if(!toolStep||toolStep==='first'){toolAnchor={panelIdx,time,price};toolStep='second';updateHint('SHORT POS: click TAKE PROFIT level');
    } else {var _entry2=toolAnchor.price,_tp2=price,_stop2=_entry2+(_entry2-_tp2);var _a3={id:nextId++,type:'short_pos',panelIdx:toolAnchor.panelIdx,x1:toolAnchor.time,y1:_entry2,y2:_tp2,y3:_stop2};applyDrawDefaults(_a3);annotations.push(_a3);toolStep=null;toolAnchor=null;if(!_stayDraw)setActiveTool(null);else{toolStep='first';updateHint('SHORT POS: click ENTRY price level');}renderAll();toast('✓ Short position — R:R '+(Math.abs(_entry2-_tp2)/Math.abs(_stop2-_entry2)).toFixed(2));}
    return;
  }

  // ── EXEC ARROWS / STOPS ──
  if(activeTool==='entry_arrow'||activeTool==='exit_arrow'||activeTool==='short_arrow'||activeTool==='cover_arrow'){pendingExec={type:activeTool,panelIdx,time,price};const wrap=document.getElementById(`cw-${panelIdx}`);const wr=wrap.getBoundingClientRect();showPctPopup(wr.left+mx,wr.top+my-80,activeTool);return;}
  if(activeTool==='stop_line'||activeTool==='trail_stop'){var _e={id:nextId++,type:activeTool,panelIdx,x1:time,y1:price,label:price.toFixed(2),pct:100};applyDrawDefaults(_e);annotations.push(_e);updateSimPnl();renderAll();toast(`✓ ${activeTool==='trail_stop'?'Trail Stop':'Stop'} placed @ ${price.toFixed(2)}`);return;}
}

function handleDelete(mx,my,p){
  const chartW_=p.W-p.PRICE_W;
  const vs=Math.max(0,Math.min(p.viewStart,p.data.length-p.viewBars));
  const vlen=Math.min(p.viewBars,p.data.length-vs);
  const barW=chartW_/Math.max(vlen+(window.RIGHT_PAD||6),1);
  const volH=p.inds.vol?Math.round(p.H*(p.volFrac||VOL_FRAC_DEFAULT)):0;
  const priceH=p.H-p.TIME_H-volH;
  const{min,max}=getMinMax(p);
  function annTimeToX(t){
    const ts=toUnix(t); let lo=-1,hi=-1;
    for(let i=0;i<p.data.length;i++){const bt=toUnix(p.data[i].time);if(bt<=ts)lo=i;if(bt>=ts&&hi<0)hi=i;}
    if(lo<0&&hi<0) return null;
    if(lo<0) return(hi-vs+0.5)*barW;
    if(hi<0) return(lo-vs+0.5)*barW;
    if(lo===hi) return(lo-vs+0.5)*barW;
    const loT=toUnix(p.data[lo].time),hiT=toUnix(p.data[hi].time);
    const frac=(hiT===loT)?0:(ts-loT)/(hiT-loT);
    return((lo+frac*(hi-lo))-vs+0.5)*barW;
  }
  const pToY=price=>priceH-((price-min)/(max-min))*priceH;
  for(let k=annotations.length-1;k>=0;k--){
    if(isAnnNear(annotations[k],mx,my,p,annTimeToX,pToY)){
      annotations.splice(k,1);
      updateSimPnl();
      renderAll(); toast('🗑 Annotation deleted'); return;
    }
  }
  toast('⚠ Click closer to an annotation to delete it');
}

function handleEdit(mx,my,p,evt){
  const chartW_=p.W-p.PRICE_W;
  const vs=Math.max(0,Math.min(p.viewStart,p.data.length-p.viewBars));
  const vlen=Math.min(p.viewBars,p.data.length-vs);
  const barW=chartW_/Math.max(vlen+(window.RIGHT_PAD||6),1);
  const volH=p.inds.vol?Math.round(p.H*(p.volFrac||VOL_FRAC_DEFAULT)):0;
  const priceH=p.H-p.TIME_H-volH;
  const{min,max}=getMinMax(p);
  function annTimeToX(t){
    const ts=toUnix(t); let lo=-1,hi=-1;
    for(let i=0;i<p.data.length;i++){const bt=toUnix(p.data[i].time);if(bt<=ts)lo=i;if(bt>=ts&&hi<0)hi=i;}
    if(lo<0&&hi<0) return null;
    if(lo<0) return(hi-vs+0.5)*barW;
    if(hi<0) return(lo-vs+0.5)*barW;
    if(lo===hi) return(lo-vs+0.5)*barW;
    const loT=toUnix(p.data[lo].time),hiT=toUnix(p.data[hi].time);
    const frac=(hiT===loT)?0:(ts-loT)/(hiT-loT);
    return((lo+frac*(hi-lo))-vs+0.5)*barW;
  }
  const pToY=price=>priceH-((price-min)/(max-min))*priceH;

  // Find nearest exec annotation
  let bestAnn=null, bestDist=Infinity;
  for(const ann of annotations){
    const isExec=ann.type==='entry_arrow'||ann.type==='exit_arrow'||ann.type==='short_arrow'||ann.type==='cover_arrow'||ann.type==='stop_line'||ann.type==='trail_stop';
    if(!isExec) continue;
    if(isAnnNear(ann,mx,my,p,annTimeToX,pToY)){
      const x1=annTimeToX(ann.x1); if(x1==null) continue;
      const y1=pToY(ann.y1);
      const dist=Math.hypot(mx-x1,my-y1);
      if(dist<bestDist){ bestDist=dist; bestAnn=ann; }
    }
  }

  if(!bestAnn){
    toast('⚠ Click closer to an annotation to edit it');
    return;
  }

  // For stop_line / trail_stop — edit price directly with branded modal
  if(bestAnn.type==='stop_line'||bestAnn.type==='trail_stop'){
    var stopLabel=bestAnn.type==='trail_stop'?'Trail Stop':'Stop';
    modalOpen('✏ EDIT '+stopLabel.toUpperCase(),'<p>Set new '+stopLabel+' price level.</p><input type="text" id="modal-input" value="'+bestAnn.y1.toFixed(4)+'" autofocus>',[
      {text:'Cancel',cls:'mbtn-cancel',action:modalClose},
      {text:'✓ Update',cls:'mbtn-primary',action:function(){
        var np=parseFloat(document.getElementById('modal-input').value);
        if(isNaN(np)){toast('Invalid price',true);modalClose();return;}
        bestAnn.y1=Math.round(np*100)/100;
        bestAnn.label=bestAnn.y1.toFixed(2);
        updateSimPnl(); renderAll();
        toast('✎ Stop updated → '+bestAnn.y1.toFixed(2));
        modalClose();
      }}
    ]);
    return;
  }

  // For entry/exit/short/cover — open pct popup pre-filled
  const wrap=document.getElementById(`cw-${p.idx}`);
  const wr=wrap.getBoundingClientRect();
  pendingExec={
    type:bestAnn.type,
    panelIdx:bestAnn.panelIdx,
    time:bestAnn.x1,
    price:bestAnn.y1,
    _editId:bestAnn.id,
  };
  showPctPopup(wr.left+mx, wr.top+my-80, bestAnn.type, bestAnn);
}

function showTextPopup(sx,sy){
  const pop=document.getElementById('text-popup');
  const inp=document.getElementById('text-input');
  const label=pop.querySelector('div');
  if(pendingText){
    if(pendingText.color==='callout') label.textContent='CALLOUT TEXT';
    else if(pendingText.color==='note') label.textContent='NOTE TEXT';
    else if(pendingText.color==='flag') label.textContent='FLAG LABEL';
    else label.textContent='ANNOTATION TEXT';
  }
  pop.style.left=Math.min(sx,window.innerWidth-260)+'px';
  pop.style.top=Math.max(10,sy)+'px';
  pop.classList.add('show');
  inp.value=''; setTimeout(()=>inp.focus(),50);
}

function showPctPopup(sx,sy,toolType,editAnn){
  const pop=document.getElementById('pct-popup');
  // Ensure popup doesn't overlay topbar (min 60px from top)
  sy=Math.max(60, sy);
  // Keep away from right edge if backtest sidebar is open
  const sbOpen=document.getElementById('bt-sidebar')?.classList.contains('open');
  const maxLeft=window.innerWidth-(sbOpen?560:280);
  sx=Math.min(sx, maxLeft);
  const title=document.getElementById('pct-popup-title');
  const hint=document.getElementById('pct-popup-hint');
  const stopRow=document.getElementById('pct-stop-label');
  const stopInp=document.getElementById('pct-stop-input');
  const pnlLabel=document.getElementById('pct-pnlrisk-label');
  const pnlInp=document.getElementById('pct-pnlrisk-input');
  const modeNorm=document.getElementById('pct-mode-normal');
  const modePnl=document.getElementById('pct-mode-pnl');
  const rebuyBtn=document.getElementById('pct-rebuy');
  const priceLabel=document.getElementById('pct-price-label');
  const priceInp=document.getElementById('pct-price-input');
  const okBtn=document.getElementById('pct-ok');
  const isEntry=toolType==='entry_arrow'||toolType==='short_arrow';
  const isShort=toolType==='short_arrow';
  const isCover=toolType==='cover_arrow';
  const isEditing=!!editAnn;
  const col=toolType==='entry_arrow'?'#ff9800':toolType==='short_arrow'?'#ff5252':toolType==='cover_arrow'?'#00e676':'#40c4ff';

  const toolLabel=toolType==='entry_arrow'?'LONG':toolType==='short_arrow'?'SHORT':toolType==='cover_arrow'?'COVER':'SELL';
  title.textContent=isEditing?'EDIT '+toolLabel:toolLabel;
  title.style.color=isEditing?'#fbbf24':col;
  pop.style.borderColor=isEditing?'#fbbf24':col;
  const btnCol=isEditing?'#fbbf24':col;
  pop.querySelectorAll('button:not(.cancel):not(#pct-rebuy):not(#pct-mode-normal):not(#pct-mode-pnl)').forEach(b=>{b.style.borderColor=btnCol;b.style.color=btnCol;});
  okBtn.textContent=isEditing?'UPDATE':'PLACE';

  // Show price input when editing
  priceLabel.style.display=isEditing?'':'none';
  priceInp.style.display=isEditing?'':'none';
  if(isEditing) priceInp.value=editAnn.y1.toFixed(4);

  const ev=isEntry?'':'none';
  stopRow.style.display=ev; stopInp.style.display=ev;
  modeNorm.style.display=ev; modePnl.style.display=ev;
  rebuyBtn.style.display=ev;
  pnlLabel.style.display='none'; pnlInp.style.display='none';
  // Update rebuy label and all dynamic button colors to match tool type
  rebuyBtn.textContent='\u21ba '+( toolType==='entry_arrow'?'RE-LONG':toolType==='short_arrow'?'RE-SHORT':toolType==='cover_arrow'?'RE-COVER':'RE-SELL');
  rebuyBtn.style.borderColor=col; rebuyBtn.style.color=col;
  modeNorm.style.background=col+'18'; modeNorm.style.color=col; modeNorm.style.borderColor=col;
  modePnl.style.background='none'; modePnl.style.color='#4a6080'; modePnl.style.borderColor='#2a3050';
  let pnlMode=false;

  if(isEntry){
    if(isEditing&&editAnn.stopPrice!=null){
      stopInp.value=editAnn.stopPrice.toFixed(4);
    } else {
      const lastStop=annotations.filter(a=>a.type==='stop_line'||a.type==='trail_stop').slice(-1)[0];
      stopInp.value=lastStop?lastStop.y1.toFixed(4):'';
    }
  }

  function getCurrentPosition(){
    const ep2=Math.round((pendingExec?.price||0)*100)/100;
    const editId=pendingExec?._editId||null;
    // When editing, also find the paired auto-stop to exclude
    const editAnnObj=editId?annotations.find(a=>a.id===editId):null;
    const editAutoStopId=editAnnObj?annotations.find(a=>a._autoStop&&a.x1===editAnnObj.x1&&a.type==='stop_line')?.id:null;
    const allExec=annotations
      .filter(a=>(a.type==='entry_arrow'||a.type==='exit_arrow'||a.type==='short_arrow'||a.type==='cover_arrow'||a.type==='stop_line'||a.type==='trail_stop')&&a.id!==editId&&a.id!==editAutoStopId)
      .sort((a,b)=>a.x1-b.x1);
    let legs=[],lockedPnl=0,lastExitSh=0,lastExitPx=0,isLongPos=null;
    for(const ea of allExec){
      if(ea.type==='entry_arrow'||ea.type==='short_arrow'){
        let sp=ea.stopPrice??null;
        if(sp==null){const ps=allExec.filter(s=>(s.type==='stop_line'||s.type==='trail_stop')&&s.x1<=ea.x1).slice(-1)[0];if(ps)sp=ps.y1;}
        const esPct=(ea.pct??100),esRisk=getRiskAmount()*(esPct/100);
        const eSh=legs.reduce((s,l)=>s+l.shares,0);
        const eAvg=eSh>0?legs.reduce((s,l)=>s+l.entryPrice*l.shares,0)/eSh:0;
        if(sp!=null){
          const d=sp-ea.y1;
          const sR2=(sp>ea.y1)?esRisk:-esRisk;
          const sh=d===0?0:Math.max(0,Math.round((sR2-eSh*(sp-eAvg))/d));
          if(isLongPos===null)isLongPos=ea.y1>sp;
          legs.push({entryPrice:ea.y1,shares:sh});
          lastExitSh=0; // reset: count exits only since this (latest) entry
        }
      } else if(ea.type==='exit_arrow'||ea.type==='cover_arrow'){
        const ep2b=(ea.pct??100),tot=legs.reduce((s,l)=>s+l.shares,0);
        const closedThisExit=Math.round(tot*(ep2b/100));
        lastExitSh+=closedThisExit; // accumulate all exits since last entry
        lastExitPx=ea.y1;
        for(let i=0;i<legs.length;i++){
          const take=Math.round(legs[i].shares*(ep2b/100));
          const pnl=isLongPos===false?(legs[i].entryPrice-ea.y1)*take:(ea.y1-legs[i].entryPrice)*take;
          lockedPnl+=pnl; legs[i]={...legs[i],shares:legs[i].shares-take};
        }
        legs=legs.filter(l=>l.shares>0);
      }
    }
    const exSh=legs.reduce((s,l)=>s+l.shares,0);
    const exAvg=exSh>0?legs.reduce((s,l)=>s+l.entryPrice*l.shares,0)/exSh:0;
    return{exSh,exAvg,lockedPnl,lastExitSh,lastExitPx,isLongPos,ep:ep2};
  }

  function updateHint(){
    const s2=parseFloat(stopInp.value);
    const pctVal=Math.max(0,parseFloat(document.getElementById('pct-input').value)||0);
    const pos=getCurrentPosition();
    const{exSh,exAvg,lockedPnl,ep:ep3}=pos;
    if(!isEntry){hint.textContent='% of remaining position to close';return;}
    if(!s2||!ep3){hint.textContent='enter stop to see share size';return;}
    let riskAlloc;
    if(pnlMode){
      const baseExtra=Math.max(0,parseFloat(pnlInp.value)||0);
      riskAlloc=lockedPnl+getRiskAmount()*(baseExtra/100);
      if(riskAlloc<=0){hint.textContent='PnL locked: $'+lockedPnl.toFixed(2)+' — sell first';return;}
    } else {
      riskAlloc=getRiskAmount()*(pctVal/100);
    }
    const denom=s2-ep3;
    const sRiskH=(s2>ep3)?riskAlloc:-riskAlloc;
    const sh=denom===0?0:Math.max(0,Math.round((sRiskH-exSh*(s2-exAvg))/denom));
    const totalAfter=exSh+sh;
    const newAvg=totalAfter>0?(exSh*exAvg+sh*ep3)/totalAfter:ep3;
    let msg=sh.toLocaleString()+'sh';
    if(exSh>0)msg+=' → avg '+newAvg.toFixed(2);
    msg+=' | $'+riskAlloc.toFixed(0)+' risk';
    if(pnlMode)msg+=' (locked $'+lockedPnl.toFixed(0)+')';
    // BP check
    const totalAfterH=exSh+sh;
    const newAvgH=totalAfterH>0?(exSh*exAvg+sh*ep3)/totalAfterH:ep3;
    const posValH=totalAfterH*newAvgH;
    const bpH=getBuyingPower();
    if(bpH && posValH>bpH){
      msg+=' ⚠ EXCEEDS BP ($'+posValH.toLocaleString(undefined,{maximumFractionDigits:0})+' > $'+bpH.toLocaleString(undefined,{maximumFractionDigits:0})+')';
      hint.style.color='#ef5350';
    } else {
      hint.style.color='';
    }
    hint.textContent=msg;
  }

  rebuyBtn.onclick=()=>{
    const pos=getCurrentPosition();
    const{exSh,exAvg,lastExitSh}=pos;
    const s2=parseFloat(stopInp.value);
    const ep4=Math.round((pendingExec?.price||0)*100)/100;
    if(!s2||!ep4||lastExitSh<=0){hint.textContent='no prior exit to rebuy';return;}
    // Solve: (-ra - exSh*(s2-exAvg))/(s2-ep4) = lastExitSh  →  ra = -lastExitSh*(s2-ep4) - exSh*(s2-exAvg)
    const isShortRB=(s2>ep4);
    const neededRisk=isShortRB?(lastExitSh*(s2-ep4)+exSh*(s2-exAvg)):(-lastExitSh*(s2-ep4)-exSh*(s2-exAvg));
    const pct=Math.round((neededRisk/getRiskAmount())*100);
    document.getElementById('pct-input').value=Math.max(0,pct);
    pnlMode=false;
    pnlLabel.style.display='none'; pnlInp.style.display='none';
    modeNorm.style.background=col+'18'; modeNorm.style.color=col; modeNorm.style.borderColor=col;
    modePnl.style.background='none'; modePnl.style.color='#4a6080'; modePnl.style.borderColor='#2a3050';
    updateHint();
  };

  modeNorm.onclick=()=>{
    pnlMode=false; pnlLabel.style.display='none'; pnlInp.style.display='none';
    modeNorm.style.background=col+'18'; modeNorm.style.color=col; modeNorm.style.borderColor=col;
    modePnl.style.background='none'; modePnl.style.color='#4a6080'; modePnl.style.borderColor='#2a3050';
    updateHint();
  };
  modePnl.onclick=()=>{
    pnlMode=true; pnlLabel.style.display=''; pnlInp.style.display='';
    modePnl.style.background='#a78bfa18'; modePnl.style.color='#a78bfa'; modePnl.style.borderColor='#a78bfa';
    modeNorm.style.background='none'; modeNorm.style.color='#4a6080'; modeNorm.style.borderColor='#2a3050';
    if(!pnlInp.value) pnlInp.value='0';
    updateHint();
  };

  stopInp.oninput=updateHint;
  priceInp.oninput=()=>{
    // Update pendingExec price when user edits
    if(pendingExec&&isEditing){
      const v=parseFloat(priceInp.value);
      if(!isNaN(v)) pendingExec.price=v;
    }
    updateHint();
  };
  document.getElementById('pct-input').oninput=updateHint;
  pnlInp.oninput=updateHint;

  pop.style.left=Math.min(sx,window.innerWidth-280)+'px';
  pop.style.top=Math.max(10,sy)+'px';
  pop.classList.add('show');
  if(isEditing){
    document.getElementById('pct-input').value=editAnn.pct??100;
    // Restore PNL mode if annotation was in PNL mode
    if(editAnn.pnlMode){
      pnlMode=true; pnlLabel.style.display=''; pnlInp.style.display='';
      pnlInp.value=editAnn.pnlBaseExtra||0;
      modePnl.style.background='#a78bfa18'; modePnl.style.color='#a78bfa'; modePnl.style.borderColor='#a78bfa';
      modeNorm.style.background='none'; modeNorm.style.color='#4a6080'; modeNorm.style.borderColor='#2a3050';
    }
    setTimeout(()=>{priceInp.focus();priceInp.select();},50);
  } else {
    document.getElementById('pct-input').value='100';
    setTimeout(()=>{document.getElementById('pct-input').focus();document.getElementById('pct-input').select();},50);
  }
  updateHint();
}
function commitPctExec(){
  if(!pendingExec) return;
  const _pctRaw=document.getElementById('pct-input').value;
const pct=Math.max(0,_pctRaw===''||_pctRaw==null?100:parseInt(_pctRaw));
  const{type,panelIdx,time}=pendingExec;
  const isEditing=!!pendingExec._editId;
  // For edits, use the price input; for new placements, use the clicked price
  let price;
  if(isEditing){
    const editedPrice=parseFloat(document.getElementById('pct-price-input').value);
    price=isNaN(editedPrice)?Math.round(pendingExec.price*100)/100:Math.round(editedPrice*100)/100;
  } else {
    price=Math.round(pendingExec.price*100)/100;
  }
  let stopPrice=null;
  let pnlMode=false, pnlBaseExtra=0;
  const isEntryType=type==='entry_arrow'||type==='short_arrow';
  if(isEntryType){
    const sv=parseFloat(document.getElementById('pct-stop-input').value);
    stopPrice=isNaN(sv)?null:Math.round(sv*100)/100;
    // Check if PNL mode was active (modePnl has active styling)
    const modePnlBtn=document.getElementById('pct-mode-pnl');
    if(modePnlBtn&&modePnlBtn.style.color==='rgb(167, 139, 250)'){
      pnlMode=true;
      pnlBaseExtra=Math.max(0,parseFloat(document.getElementById('pct-pnlrisk-input').value)||0);
    }
  }
  const lbl=`${price.toFixed(2)} (${pct}%)`;

  if(isEditing){
    // ── UPDATE existing annotation in-place ──
    const editId=pendingExec._editId;
    const ann=annotations.find(a=>a.id===editId);
    if(ann){
      ann.y1=price;
      ann.label=lbl;
      ann.pct=pct;
      if(isEntryType){
        ann.stopPrice=stopPrice;
        ann.pnlMode=pnlMode;
        ann.pnlBaseExtra=pnlBaseExtra;
        // Update paired auto-stop if exists
        const autoStop=annotations.find(a=>a._autoStop&&a.x1===ann.x1&&a.type==='stop_line');
        if(autoStop&&stopPrice!=null){
          autoStop.y1=stopPrice;
          autoStop.label=stopPrice.toFixed(2);
        } else if(!autoStop&&stopPrice!=null){
          // Create new auto-stop
          annotations.push({id:nextId++,type:'stop_line',panelIdx:ann.panelIdx,x1:ann.x1,y1:stopPrice,label:stopPrice.toFixed(2),pct:100,_autoStop:true});
        }
      }
    }
    updateSimPnl(); renderAll();
    const tLabel=type==='entry_arrow'?'Long':type==='short_arrow'?'Short':type==='cover_arrow'?'Cover':'Sell';
    toast(`✎ Updated ${tLabel} → ${price.toFixed(2)} ${pct}%`);
  } else {
    // ── NEW annotation ──
    annotations.push({id:nextId++,type,panelIdx,x1:time,y1:price,label:lbl,pct,stopPrice,pnlMode,pnlBaseExtra});
    if(isEntryType&&stopPrice!=null){
      annotations.push({id:nextId++,type:'stop_line',panelIdx,x1:time,y1:stopPrice,label:stopPrice.toFixed(2),pct:100,_autoStop:true});
    }
    updateSimPnl(); renderAll();
    const tLabel=type==='entry_arrow'?'Long':type==='short_arrow'?'Short':type==='cover_arrow'?'Cover':'Sell';
    toast(`✓ ${tLabel} @ ${price.toFixed(2)} ${pct}%`);
  }
  pendingExec=null;
}

document.getElementById('pct-ok').addEventListener('click',()=>{
  document.getElementById('pct-popup').classList.remove('show');
  commitPctExec();
});
document.getElementById('pct-cancel').addEventListener('click',(e)=>{
  e.stopPropagation(); // Don't propagate to fullscreen backdrop
  document.getElementById('pct-popup').classList.remove('show');
  pendingExec=null;
});
document.getElementById('pct-input').addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    // Tab to stop if visible and empty, else commit
    const stopInp=document.getElementById('pct-stop-input');
    if(stopInp.style.display!=='none'&&!stopInp.value){
      stopInp.focus(); stopInp.select();
    } else {
      document.getElementById('pct-ok').click();
    }
  }
  if(e.key==='Escape'){e.stopPropagation(); document.getElementById('pct-cancel').click();}
});
document.getElementById('pct-price-input').addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    document.getElementById('pct-input').focus(); document.getElementById('pct-input').select();
  }
  if(e.key==='Escape'){e.stopPropagation(); document.getElementById('pct-cancel').click();}
});
document.getElementById('pct-stop-input').addEventListener('keydown',e=>{
  if(e.key==='Enter') document.getElementById('pct-ok').click();
  if(e.key==='Escape'){e.stopPropagation(); document.getElementById('pct-cancel').click();}
});
document.getElementById('text-ok').addEventListener('click',()=>{
  const txt=document.getElementById('text-input').value.trim();
  if(txt&&pendingText){
    if(pendingText.color==='callout'){
      annotations.push({id:nextId++,type:'callout',panelIdx:pendingText.panelIdx,
        x1:pendingText.targetTime,y1:pendingText.targetPrice,
        x2:pendingText.time,y2:pendingText.price,text:txt,color:drawDefaults.color||'#f97316'});
    } else if(pendingText.color==='note'){
      annotations.push({id:nextId++,type:'note',panelIdx:pendingText.panelIdx,
        x1:pendingText.time,y1:pendingText.price,text:txt,noteColor:'#fbbf24'});
    } else if(pendingText.color==='flag'){
      annotations.push({id:nextId++,type:'flag',panelIdx:pendingText.panelIdx,
        x1:pendingText.time,y1:pendingText.price,text:txt,color:drawDefaults.color||'#ef5350'});
    } else {
      annotations.push({id:nextId++,type:pendingText.color,panelIdx:pendingText.panelIdx,x1:pendingText.time,y1:pendingText.price,text:txt});
    }
    applyDrawDefaults(annotations[annotations.length-1]);
    renderAll(); toast('Annotation placed');
  }
  document.getElementById('text-popup').classList.remove('show'); pendingText=null;
});
document.getElementById('text-cancel').addEventListener('click',()=>{
  document.getElementById('text-popup').classList.remove('show'); pendingText=null;
});
document.getElementById('text-input').addEventListener('keydown',e=>{
  if(e.key==='Enter') document.getElementById('text-ok').click();
  if(e.key==='Escape'){e.stopPropagation(); document.getElementById('text-cancel').click();}
});

// ══════════════════════════════════════════════════════════
//  PANEL UTILS
// ══════════════════════════════════════════════════════════
function getMinMax(p){
  const vs=Math.max(0,Math.min(p.viewStart,p.data.length-p.viewBars));
  const ve=Math.min(vs+p.viewBars,p.data.length);
  let min=Infinity,max=-Infinity;
  for(let i=vs;i<ve;i++){if(p.data[i].low<min)min=p.data[i].low;if(p.data[i].high>max)max=p.data[i].high;}
  const pad=(max-min)*0.15||min*0.02; // must match renderPanel padding exactly
  return{min:min-pad,max:max+pad};
}
function clampView(p){
  p.viewBars=Math.max(5,Math.min(p.viewBars,p.data.length));
  p.viewStart=Math.max(0,Math.min(p.viewStart,Math.max(0,p.data.length-p.viewBars)));
}
function resizePanel(p){
  const wrap=document.getElementById(`cw-${p.idx}`);
  if(!wrap) return;
  const w=wrap.clientWidth,h=wrap.clientHeight;
  if(w<=0||h<=0) return;
  p.W=w; p.H=h;
  const dpr=window.devicePixelRatio||1;
  p.canvas.style.width=w+'px'; p.canvas.style.height=h+'px';
  p.canvas.width=Math.round(w*dpr); p.canvas.height=Math.round(h*dpr);
  p.ctx.scale(dpr,dpr);
  renderPanel(p); updateScrollbar(p);
}
var _saveAnnsTimer=null;
function renderAll(){panels.forEach(p=>{if(p.data.length){renderPanel(p);updateScrollbar(p);}});updatePriceLineBtnColor();if(typeof saveTools==='function')saveTools();if(!_saveAnnsTimer){_saveAnnsTimer=setTimeout(function(){saveAnnotations();_saveAnnsTimer=null;},500);}}

// ══════════════════════════════════════════════════════════
//  TOOLBAR VISIBILITY TOGGLE
// ══════════════════════════════════════════════════════════
document.getElementById('toggle-bars-btn').addEventListener('click',()=>{
  barsVisible=!barsVisible;
  document.getElementById('toggle-bars-btn').textContent=barsVisible?'≡ HIDE BARS':'≡ SHOW BARS';
  panels.forEach((_,i)=>{
    ['indrow-','pdr-'].forEach(pfx=>{
      const el=document.getElementById(pfx+i);
      if(el) el.style.display=barsVisible?'':'none';
    });
  });
  setTimeout(()=>panels.forEach(p=>resizePanel(p)),50);
});

document.getElementById('price-line-btn').addEventListener('click',()=>{
  showPriceLine=!showPriceLine;
  const btn=document.getElementById('price-line-btn');
  btn.classList.toggle('off',!showPriceLine);
  btn.textContent=showPriceLine?'— LINE':'— LINE OFF';
  renderAll();
});
// Update price-line button color to match last candle direction
function updatePriceLineBtnColor(){
  var btn=document.getElementById('price-line-btn');
  if(!btn||!showPriceLine) return;
  var p=panels[0];
  if(p&&p.data&&p.data.length){
    var last=p.data[p.data.length-1];
    var col=last.close>=last.open?'#26a69a':'#ef5350';
    btn.style.borderColor=col; btn.style.color=col;
  }
}

document.getElementById('adj-btn').addEventListener('click',()=>{
  useAdjusted=!useAdjusted;
  // Sync all panels to global setting
  panels.forEach(p=>{ p.adjusted=useAdjusted; });
  // Update all per-panel ADJ buttons
  document.querySelectorAll('.adj-panel-btn').forEach(b=>{
    b.classList.toggle('on',useAdjusted);
    b.style.color=useAdjusted?'#f59e0b':'#4a5580';
    b.style.borderColor=useAdjusted?'#f59e0b':'#4a5580';
    b.style.textDecoration=useAdjusted?'':'line-through';
  });
  const btn=document.getElementById('adj-btn');
  btn.classList.toggle('unadj',!useAdjusted);
  btn.textContent=useAdjusted?'ADJ':'UNADJ';
  btn.style.borderColor=useAdjusted?'#f59e0b':'#4a5580';
  btn.style.color=useAdjusted?'#f59e0b':'#4a5580';
  loadAll();
  toast(useAdjusted?'Adjusted prices (split-adjusted)':'Unadjusted prices (raw)');
});

document.getElementById('clean-btn').addEventListener('click',()=>{
  cleanPrints=!cleanPrints;
  const btn=document.getElementById('clean-btn');
  btn.classList.toggle('on',cleanPrints);
  btn.style.textDecoration=cleanPrints?'none':'line-through';
  btn.style.borderColor=cleanPrints?'#e879f9':'#4a5580';
  btn.style.color=cleanPrints?'#e879f9':'#4a5580';
  loadAll();
  toast(cleanPrints?'Clean prints ON — filtering suspicious bars':'Clean prints OFF — raw data');
});

// ══════════════════════════════════════════════════════════
//  FULLSCREEN
// ══════════════════════════════════════════════════════════
function toggleFullscreen(i){
  const div=document.getElementById(`panel-${i}`);
  const btn=document.getElementById(`expand-${i}`);
  const bd=document.getElementById('fs-backdrop');
  if(fullscreenPanel===i){
    div.classList.remove('fullscreen-panel');
    div.style.right=''; // clear inline style
    div.style.top=''; div.style.left=''; div.style.bottom='';
    btn.textContent='⛶'; bd.classList.remove('show'); fullscreenPanel=null;
    // Resize ALL panels after exiting fullscreen
    setTimeout(()=>panels.forEach(p=>resizePanel(p)),80);
  } else {
    if(fullscreenPanel!==null){
      const prev=document.getElementById(`panel-${fullscreenPanel}`);
      prev.classList.remove('fullscreen-panel');
      prev.style.right=''; prev.style.top=''; prev.style.left=''; prev.style.bottom='';
      document.getElementById(`expand-${fullscreenPanel}`).textContent='⛶';
    }
    div.classList.add('fullscreen-panel');
    btn.textContent='✕'; bd.classList.add('show'); fullscreenPanel=i;
    adjustFullscreenRight();
  }
}

// ── Fullscreen panel auto-adjust for sidebar/scan panel ──
function adjustFullscreenRight(){
  if(fullscreenPanel===null) return;
  const fp=document.getElementById('panel-'+fullscreenPanel);
  if(!fp||!fp.classList.contains('fullscreen-panel')) return;
  const btOpen=document.getElementById('bt-sidebar')?.classList.contains('open');
  const scanOpen=document.getElementById('scan-panel')?.classList.contains('open');
  let right=0;
  if(scanOpen) right=Math.max(right,522); // scan panel = 520px + 2px border
  if(btOpen) right=Math.max(right,302);   // bt sidebar = 300px + 2px border
  fp.style.right=right+'px';
  setTimeout(()=>resizePanel(panels[fullscreenPanel]),60);
}

document.getElementById('fs-backdrop').addEventListener('click',()=>{if(fullscreenPanel!==null) toggleFullscreen(fullscreenPanel);});

// ══════════════════════════════════════════════════════════
//  OVERLAY
// ══════════════════════════════════════════════════════════
function showLoading(i,msg){
  const el=document.getElementById(`ov-${i}`);
  el.className='overlay active'; el.style.background='rgba(12,14,20,.55)';
  el.innerHTML=`<div class="spinner"></div><div class="ov-msg">${msg||'LOADING…'}</div>`;
}
function showError(i,msg){
  const el=document.getElementById(`ov-${i}`);
  el.className='overlay active'; el.style.background='rgba(12,14,20,.92)';
  el.innerHTML=`<div class="ov-err">⚠  ${msg}</div><button class="retry-btn" onclick="loadPanel(${i})">↺ RETRY</button>`;
}
function hideOverlay(i){document.getElementById(`ov-${i}`).className='overlay';}

// ══════════════════════════════════════════════════════════
//  FETCH
// ══════════════════════════════════════════════════════════
async function fetchBars(sym,tf,from,to,adjOverride){
  const{mul,ts}=tfToPolygon(tf);
  let fromAdj=from, toAdj=to;
  if(isIntraday(tf)){
    const fd=new Date(from+'T12:00:00Z'); fd.setUTCDate(fd.getUTCDate()-1); fromAdj=fmtDate(fd);
    const td=new Date(to+'T12:00:00Z'); td.setUTCDate(td.getUTCDate()+1); toAdj=fmtDate(td);
  }

  // Main fetch: full range ascending
  const adjFlag=(adjOverride!==undefined)?adjOverride:useAdjusted;
  let url=`${POLY}/v2/aggs/ticker/${encodeURIComponent(sym)}/range/${mul}/${ts}/${fromAdj}/${toAdj}?adjusted=${adjFlag}&sort=asc&limit=50000&apiKey=${API_KEY}`;
  let all=[],pages=0;
  while(url&&pages<25){
    pages++;
    let res;
    try{res=await fetch(url);}
    catch(e){throw new Error(`Network error: ${e.message}\n\nOpen this file directly in Chrome/Firefox.`);}
    if(!res.ok){const t=await res.text().catch(()=>'');throw new Error(`HTTP ${res.status}: ${t.slice(0,200)}`);}
    let j;try{j=await res.json();}catch(e){throw new Error(`JSON error: ${e.message}`);}
    if(j.status==='ERROR') throw new Error(`Polygon: ${j.error||j.message}`);
    if(j.results?.length){
      for(const b of j.results){
        all.push({
          time:(ts==='day'||ts==='week'||ts==='month')?fmtDate(new Date(b.t)):Math.floor(b.t/1000),
          open:+b.o,high:+b.h,low:+b.l,close:+b.c,volume:b.v||0,
        });
      }
    }
    url=j.next_url?j.next_url+'&apiKey='+API_KEY:null;
  }

  // For intraday: also fetch the most recent bars descending
  // BUT only when no explicit end date is set (i.e. not in BT mode or date-ranged mode)
  const todayStr=fmtDate(new Date());
  const fetchingToday=!to||(to>=todayStr);
  if(isIntraday(tf)&&fetchingToday){
    try{
      const now=new Date();
      const recentFrom=fmtDate(new Date(now.getTime()-3*86400000));
      const recentTo=fmtDate(new Date(now.getTime()+86400000));
      const r2=await fetch(`${POLY}/v2/aggs/ticker/${encodeURIComponent(sym)}/range/${mul}/${ts}/${recentFrom}/${recentTo}?adjusted=${adjFlag}&sort=desc&limit=1000&apiKey=${API_KEY}`);
      if(r2.ok){
        const j2=await r2.json();
        if(j2.results?.length){
          for(const b of j2.results){
            all.push({
              time:Math.floor(b.t/1000),
              open:+b.o,high:+b.h,low:+b.l,close:+b.c,volume:b.v||0,
            });
          }
        }
      }
    }catch(e){/* silent */}
  }

  const seen=new Set();
  let bars=all
    .filter(b=>{const k=String(b.time);if(seen.has(k))return false;seen.add(k);return true;})
    .sort((a,b)=>String(a.time)<String(b.time)?-1:1);
  if(isIntraday(tf)&&cleanPrints) bars=await filterBadPrints(sym,bars,parseInt(tf)||1);
  return bars;
}

// ══════════════════════════════════════════════════════════
//  LOAD
// ══════════════════════════════════════════════════════════
function applyDates(i){
  // Turn off live mode when applying custom dates
  if(liveMode) setLiveMode(false);
  const p=panels[i];
  const tgt=document.getElementById(`tgt-${i}`).value;
  const backV=document.getElementById(`back-${i}`).value;
  const fwdV=document.getElementById(`fwd-${i}`).value;
  const back=backV?parseInt(backV):null;
  const fwd=fwdV?parseInt(fwdV):null;
  if(tgt){
    const t=new Date(tgt+'T12:00:00Z');
    const s=new Date(t); s.setUTCDate(s.getUTCDate()-(back||60));
    const e=new Date(t); if(fwd!=null) e.setUTCDate(e.getUTCDate()+fwd);
    p.startDate=fmtDate(s); p.endDate=fmtDate(e);
    document.getElementById(`from-${i}`).value=p.startDate;
    document.getElementById(`to-${i}`).value=p.endDate;
  } else {
    p.startDate=document.getElementById(`from-${i}`).value||null;
    p.endDate=document.getElementById(`to-${i}`).value||null;
  }
  loadPanel(i);
}

function applyDatesAll(srcIdx){
  if(liveMode) setLiveMode(false);
  // Get the source panel's resolved dates
  const src=panels[srcIdx];
  const tgt=document.getElementById(`tgt-${srcIdx}`).value;
  const backV=document.getElementById(`back-${srcIdx}`).value;
  const fwdV=document.getElementById(`fwd-${srcIdx}`).value;
  const back=backV?parseInt(backV):null;
  const fwd=fwdV?parseInt(fwdV):null;

  let fromDate, toDate;
  if(tgt){
    const t=new Date(tgt+'T12:00:00Z');
    const s=new Date(t); s.setUTCDate(s.getUTCDate()-(back||60));
    const e=new Date(t); if(fwd!=null) e.setUTCDate(e.getUTCDate()+fwd);
    fromDate=fmtDate(s); toDate=fmtDate(e);
  } else {
    fromDate=document.getElementById(`from-${srcIdx}`).value||null;
    toDate=document.getElementById(`to-${srcIdx}`).value||null;
  }
  if(!fromDate||!toDate){toast('Set a date range first',true);return;}

  panels.forEach((p,i)=>{
    // For daily/weekly/monthly panels, use 1 year lookback from toDate instead
    let pFrom=fromDate, pTo=toDate;
    if(!isIntraday(p.tf)){
      const toD=new Date(toDate+'T12:00:00');
      const fromD=new Date(toD); fromD.setUTCDate(fromD.getUTCDate()-365);
      pFrom=fmtDate(fromD); pTo=toDate;
    }
    p.startDate=pFrom; p.endDate=pTo;
    document.getElementById(`from-${i}`).value=pFrom;
    document.getElementById(`to-${i}`).value=pTo;
    if(tgt) document.getElementById(`tgt-${i}`).value=tgt;
    loadPanel(i);
  });
  toast(`Applied date range to all ${panels.length} panels`);
}

async function loadPanel(i){
  const p=panels[i];
  // Check cache — but only use it if the date range matches
  var cached=barCacheGet(symbol,p.tf);
  const wantsRange = p.startDate && p.endDate;
  const cachedMatchesRange = cached && cached.length && wantsRange && !liveMode &&
    cached[cached.length-1]?.time >= p.endDate;
  if(cachedMatchesRange){
    p.data=cached;
    var vc=Math.min(defaultViewBars(p.tf),cached.length);
    p.viewBars=vc;
    // Position view so endDate is at the right edge
    let endIdx = cached.length - 1;
    const targetEnd = p.endDate;
    if (targetEnd) {
      for (let b = cached.length - 1; b >= 0; b--) {
        const bt = typeof cached[b].time === 'string' ? cached[b].time : '';
        if (bt <= targetEnd) { endIdx = b; break; }
      }
    }
    p.viewStart = Math.max(0, endIdx - vc + 1);
    document.getElementById('sym-'+i).textContent=symbol;
    hideOverlay(i);
    resizePanel(p);
    return;
  }
  showLoading(i,isIntraday(p.tf)?'FETCHING + FILTERING…':'FETCHING…');
  // 1. Determine the VISIBLE range (what the user sees on screen)
  let visFrom=p.startDate, visTo=p.endDate;
  if(liveMode){
    const lr=liveRange(p.tf);
    visFrom=lr.from; visTo=lr.to;
  }
  if(!visFrom||!visTo){
    const def=defaultRange(p.tf);
    visFrom=visFrom||def.from; visTo=visTo||def.to;
    document.getElementById(`from-${i}`).value=visFrom;
    document.getElementById(`to-${i}`).value=visTo;
  }
  // 2. Expand fetch range backwards by warmup days (indicators need history before visible candles)
  const wDays=warmupDaysForTF(p.tf);
  const fetchFromD=new Date(visFrom+'T12:00:00Z');
  fetchFromD.setUTCDate(fetchFromD.getUTCDate()-wDays);
  const fetchFrom=fmtDate(fetchFromD);
  // 3. Fetch the full range (warmup + visible)
  let bars;
  try{bars=await fetchBars(symbol,p.tf,fetchFrom,visTo,p.adjusted);}
  catch(err){showError(i,err.message);toast(err.message,true);return;}
  if(!bars?.length){showError(i,`No data for "${symbol}" (${p.tf})\n${fetchFrom} → ${visTo}`);return;}
  // 4. Filter intraday bars: remove ±1 day fetchBars padding but KEEP warmup bars
  //    Filter from fetchFrom (not visFrom) so warmup data stays in p.data
  if(isIntraday(p.tf) && fetchFrom && visTo){
    const fromD=new Date(fetchFrom+'T08:00:00Z'); // ~4AM ET
    const toD=new Date(visTo+'T08:00:00Z');
    toD.setDate(toD.getDate()+1);
    toD.setHours(toD.getHours()+16); // ~midnight ET next day
    const fromTs=Math.floor(fromD.getTime()/1000);
    const toTs=Math.floor(toD.getTime()/1000);
    const filtered=bars.filter(b=>{
      const t=typeof b.time==='number'?b.time:0;
      return t>=fromTs && t<=toTs;
    });
    if(filtered.length>0) bars=filtered;
  }
  // 5. Store ALL data (warmup + visible) — indicators run on the full array
  p.data=bars;
  barCachePut(symbol,p.tf,bars);
  // 6. Position viewStart so the visible portion starts at visFrom
  //    Find the first bar at or after visFrom, that's where viewing begins
  const viewCount=Math.min(defaultViewBars(p.tf),bars.length);
  let vsIdx=0; // default: show from end
  if(isIntraday(p.tf)){
    const visFromTs=Math.floor(new Date(visFrom+'T08:00:00Z').getTime()/1000);
    // Find first bar at or after visFrom
    for(let b=0;b<bars.length;b++){
      const bt=typeof bars[b].time==='number'?bars[b].time:0;
      if(bt>=visFromTs){vsIdx=b;break;}
    }
  } else {
    // For daily+, find the bar closest to visFrom
    const visFromStr=visFrom;
    for(let b=0;b<bars.length;b++){
      const bt=typeof bars[b].time==='string'?bars[b].time:'';
      if(bt>=visFromStr){vsIdx=b;break;}
    }
  }
  p.viewBars=Math.min(viewCount, bars.length-vsIdx);
  p.viewStart=Math.max(vsIdx, bars.length-p.viewBars);
  // 7. If warmup gave us more bars than visible, ensure viewStart skips warmup
  //    but also respect user zoom (if they zoomed out to see everything)
  if(p.viewStart < vsIdx) p.viewStart = vsIdx;
  document.getElementById(`sym-${i}`).textContent=symbol;
  hideOverlay(i);
  resizePanel(p);
}

async function loadAll(){
  const btn=document.getElementById('load-btn');
  btn.disabled=true; btn.textContent='…';
  // annotations are loaded by setSymbol() -> loadAnnotations()
  panels.forEach((_,i)=>document.getElementById(`sym-${i}`).textContent=symbol);
  await Promise.all(panels.map((_,i)=>loadPanel(i)));
  btn.disabled=false; btn.textContent='▶ LOAD';
  // Update ticker info from a daily panel
  const dp=panels.find(p=>p.data.length&&!isIntraday(p.tf))||panels.find(p=>p.data.length);
  if(dp?.data.length){
    const last=dp.data[dp.data.length-1],prev=dp.data[dp.data.length-2]||last;
    const chg=last.close-prev.close,pct=((chg/prev.close)*100).toFixed(2);
    document.getElementById('ti-sym').textContent=symbol;
    document.getElementById('ti-price').textContent=`$${last.close.toFixed(2)}`;
    document.getElementById('ti-chg').innerHTML=`<span style="color:${chg>=0?'#26a69a':'#ef5350'}">${chg>=0?'+':''}${chg.toFixed(2)} (${pct}%)</span>`;
  }
}

// ══════════════════════════════════════════════════════════
//  LIVE MODE
//  Two-tier approach:
//   • Every 1s  → fetch last trade price from Polygon /v2/last/trade
//                 update the current (latest) bar's close in-memory + re-render
//   • Every 3s  → fetch recent aggregate bars to catch newly closed bars
// ══════════════════════════════════════════════════════════
let liveTickTimer=null, liveBarTimer=null;

function setLiveMode(on){
  liveMode=on;
  const btn=document.getElementById('live-btn');
  const ind=document.getElementById('live-indicator');
  btn.classList.toggle('active',on);
  ind.classList.toggle('show',on);
  clearInterval(liveTickTimer); liveTickTimer=null;
  clearInterval(liveBarTimer);  liveBarTimer=null;
  if(on){
    loadAll();
    // 1-second tick: update last bar close with latest trade
    liveTickTimer=setInterval(liveTick, 1000);
    // 3-second bar refresh: pull new aggregate bars
    liveBarTimer=setInterval(liveRefresh, 3000);
    document.getElementById('live-label').textContent='LIVE 1s';
    toast('⬤ LIVE mode ON — 1s updates');
  } else {
    toast('LIVE mode OFF — timers stopped');
  }
}

async function liveTick(){
  try{
    // Try last trade first — most reliable for real-time price
    let price=0;
    const r=await fetch(`${POLY}/v2/last/trade/${encodeURIComponent(symbol)}?apiKey=${API_KEY}`);
    if(r.ok){
      const j=await r.json();
      price=j.results?.p||j.last?.price||0;
    }
    // Fallback: snapshot endpoint
    if(!price){
      const r2=await fetch(`${POLY}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}?apiKey=${API_KEY}`);
      if(r2.ok){
        const j2=await r2.json();
        const snap=j2.ticker;
        price=snap?.lastTrade?.p||snap?.day?.c||snap?.prevDay?.c||0;
      }
    }
    if(!price||price<=0) return;

    const nowSec=Math.floor(Date.now()/1000);

    for(const p of panels){
      if(!p.data.length) continue;
      const last=p.data[p.data.length-1];

      if(isIntraday(p.tf)&&typeof last.time==='number'){
        const tfMins=parseInt(p.tf)||1;
        const barEndSec=last.time+(tfMins*60);
        if(nowSec>=barEndSec){
          liveRefresh();
          return;
        }
      }

      p.data[p.data.length-1]={
        ...last,
        close:price,
        high:Math.max(last.high,price),
        low:Math.min(last.low,price),
      };
      // Auto-advance viewStart if user is at (or near) the end
      const maxStart=Math.max(0,p.data.length-p.viewBars);
      const atEnd=p.viewStart>=maxStart-2;
      if(atEnd) p.viewStart=maxStart;
      renderPanel(p);updateScrollbar(p);
    }

    const refP=panels.find(p=>p.data.length);
    if(refP&&refP.data.length>=2){
      const prev=refP.data[refP.data.length-2].close||price;
      const chg=price-prev, pct=((chg/prev)*100).toFixed(2);
      document.getElementById('ti-sym').textContent=symbol;
      document.getElementById('ti-price').textContent=`$${price.toFixed(2)}`;
      document.getElementById('ti-chg').innerHTML=
        `<span style="color:${chg>=0?'#26a69a':'#ef5350'}">${chg>=0?'+':''}${chg.toFixed(2)} (${pct}%)</span>`;
    }
    // Update price line button color to match current candle direction
    updatePriceLineBtnColor();
  }catch(e){/* silent */}
}

async function liveRefresh(){
  // Pull the most recent bars for each panel and merge into data
  // Use sort=desc&limit=20 to get newest bars first (avoids pagination lag)
  for(const p of panels){
    if(!p.data.length) continue;
    try{
      const now=new Date();
      // Push "to" one day ahead so today's late bars aren't cut off by date boundary
      const toDate=new Date(now); toDate.setDate(toDate.getDate()+1);
      const fromDate=new Date(now); fromDate.setDate(fromDate.getDate()-2);
      const from=fmtDate(fromDate);
      const to=fmtDate(toDate);
      const{mul,ts}=tfToPolygon(p.tf);
      // Fetch newest bars first (sort=desc) to minimise latency — only need last ~20
      const url=`${POLY}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${mul}/${ts}/${from}/${to}?adjusted=${useAdjusted}&sort=desc&limit=20&apiKey=${API_KEY}`;
      const res=await fetch(url);
      if(!res.ok) continue;
      const j=await res.json();
      if(!j.results?.length) continue;
      const fresh=j.results.map(b=>({
        time:(ts==='day'||ts==='week'||ts==='month')?fmtDate(new Date(b.t)):Math.floor(b.t/1000),
        open:+b.o,high:+b.h,low:+b.l,close:+b.c,volume:b.v||0,
      }));
      // Merge by time key — new bars overwrite stale ones
      const existMap=new Map(p.data.map(b=>[String(b.time),b]));
      for(const b of fresh) existMap.set(String(b.time),b);
      const merged=[...existMap.values()].sort((a,b)=>String(a.time)<String(b.time)?-1:1);
      const wasAtEnd=p.viewStart>=p.data.length-p.viewBars-2;
      p.data=merged;
      if(wasAtEnd){p.viewStart=Math.max(0,p.data.length-p.viewBars);clampView(p);}
      renderPanel(p); updateScrollbar(p);
    }catch(e){/* silent */}
  }
}

document.getElementById('live-btn').addEventListener('click',()=>setLiveMode(!liveMode));

// ══════════════════════════════════════════════════════════
function setActiveTool(tool){
  activeTool=tool; toolStep=tool?'first':null; toolAnchor=null; freehandState=null;
  if(tool){selectedAnn=null;hideAnnToolbar();}
  document.querySelectorAll('.tool-btn').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  var cursorBtn=document.querySelector('#left-toolbar .lt-btn[data-tool=""]');
  if(cursorBtn)cursorBtn.classList.toggle('active',!tool);
  document.querySelectorAll('.cwrap').forEach(w=>w.style.cursor=tool?'crosshair':'');
  if(tool){
    const labels={
      trendline:'LINE: click START → click END',
      ray:'RAY: click START → click DIRECTION',
      hray:'H-RAY: click to place horizontal ray',
      hline:'HORIZ LINE: click to place',
      vline:'VERT LINE: click to place',
      xline:'CROSS LINE: click to place',
      parallel:'PARALLEL: click START → END → offset line',
      disjoint:'DISJOINT: click START → END → second line',
      box_orange:'BOX: click corner 1 → corner 2',
      box_yellow:'BOX: click corner 1 → corner 2',
      circle:'CIRCLE: click to drag bounding box',
      ellipse:'ELLIPSE: click to drag bounding box',
      triangle:'TRIANGLE: click to drag bounding box',
      gann_box:'GANN BOX: click to drag bounding box',
      path:'PATH: click to add points, double-click to finish',
      brush:'BRUSH: click + drag to draw freehand',
      fib_ret:'FIB: click HIGH → click LOW',
      text_orange:'TEXT: click to place',
      text_yellow:'TEXT: click to place',
      callout:'CALLOUT: click target → click text position',
      note:'NOTE: click to place',
      price_label:'PRICE LABEL: click to place',
      flag:'FLAG: click to place',
      del:'DELETE: click on any annotation to remove it',
      edit:'EDIT: click on any entry/exit/stop to modify it',
      entry_arrow:'LONG: click chart to place long entry',
      exit_arrow:'SELL: click chart to place sell/exit',
      short_arrow:'SHORT: click chart to place short entry',
      cover_arrow:'COVER: click chart to place cover',
      stop_line:'STOP: click chart to place stop level',
      trail_stop:'TRAIL STOP: click chart to place trailing stop',
      hl_cyan:'HIGHLIGHT: click corner 1 → corner 2',
      hl_magenta:'HIGHLIGHT: click corner 1 → corner 2',
      hl_green:'HIGHLIGHT: click corner 1 → corner 2',
      hl_white:'HIGHLIGHT: click corner 1 → corner 2',
      measure:'MEASURE: click START → click END',
      long_pos:'LONG POS: click ENTRY → click TAKE PROFIT',
      short_pos:'SHORT POS: click ENTRY → click TAKE PROFIT',
    };
    updateHint(labels[tool]||'Click to place');
  } else {
    document.getElementById('draw-hint').classList.remove('show');
  }
}
function updateHint(msg){
  const h=document.getElementById('draw-hint');
  h.textContent=`📐 ${msg}  —  ESC to cancel`;
  h.classList.add('show');
}
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const t=btn.dataset.tool;
    setActiveTool(activeTool===t?null:t);
  });
});
document.getElementById('hl-opacity').addEventListener('input',function(){ document.getElementById('hl-opacity-val').textContent=this.value+'%'; });
document.getElementById('clr-btn').addEventListener('click',()=>{
  annotations=[]; toolStep=null; toolAnchor=null; nextId=1;
  selectedAnn=null; hideAnnToolbar();
  saveAnnotations(); // immediate save
  updateSimPnl(); renderAll(); toast('All annotations cleared');
});
document.getElementById('bt-sim-clear').addEventListener('click',()=>{
  annotations=annotations.filter(a=>a.type!=='entry_arrow'&&a.type!=='exit_arrow'&&a.type!=='short_arrow'&&a.type!=='cover_arrow'&&a.type!=='stop_line'&&a.type!=='trail_stop');
  updateSimPnl(); renderAll(); toast('Sim annotations cleared');
});

// ══════════════════════════════════════════════════════════
//  SAVE / LOAD REVIEW
// ══════════════════════════════════════════════════════════
function reviewStatusMsg(msg,color,duration){
  const el=document.getElementById('review-status');
  el.textContent=msg; el.style.display='block';
  el.style.color=color; el.style.background=color+'15'; el.style.border='1px solid '+color;
  if(duration) setTimeout(()=>{el.style.display='none';},duration);
}

function buildReviewData(){
  const now=new Date();
  return {
    _version:1,
    _saved:now.toISOString(),
    symbol,
    annotations: annotations.map(a=>({...a})),
    nextId,
    sim:{
      riskPct: parseFloat(document.getElementById('bt-sim-riskpct').value)||1,
      equity: parseFloat(document.getElementById('bt-sim-equity').value)||0,
      bpMult: parseFloat(document.getElementById('bt-sim-bpmult').value)||4,
      rDirect: parseFloat(document.getElementById('bt-sim-rdirect').value)||0,
    },
    panels: panels.map(p=>({
      tf: p.tf,
      startDate: p.startDate || document.getElementById(`from-${p.idx}`).value||null,
      endDate: p.endDate || document.getElementById(`to-${p.idx}`).value||null,
      viewStart: p.viewStart,
      viewBars: p.viewBars,
      inds: {...p.inds},
      showTL: p.showTL, showAnn: p.showAnn, showExec: p.showExec,
      showBtExec: p.showBtExec, showOtherAnn: p.showOtherAnn,
      showPDC: p.showPDC, adjusted: p.adjusted,
      btBack: p.btBack, btFwd: p.btFwd,
    })),
    btStrategyMode,
  };
}

function saveReview(){
  try{
    const data=buildReviewData();
    const json=JSON.stringify(data,null,2);
    const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    const d=new Date();
    const dateStr=d.toISOString().slice(0,10);
    const timeStr=d.toTimeString().slice(0,5).replace(':','');
    a.href=url; a.download=`review_${symbol}_${dateStr}_${timeStr}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    // Also save to localStorage as autosave
    try{ localStorage.setItem('prochart_autosave',json); }catch(e){}
    reviewStatusMsg('✓ Saved: '+a.download,'#26a69a',4000);
    toast('💾 Review saved: '+a.download);
  }catch(err){
    reviewStatusMsg('✗ Save failed: '+err.message,'#ef5350',5000);
  }
}

async function loadReview(data){
  try{
    if(!data.symbol||!data.annotations){throw new Error('Invalid review file');}
    reviewStatusMsg('Loading '+data.symbol+'…','#38bdf8');

    // 1. Restore symbol
    symbol=data.symbol;
    document.getElementById('symbol-input').value=symbol;

    // 2. Restore sim inputs
    if(data.sim){
      // Support both new riskPct and old risk (dollar) format
      if(data.sim.riskPct!=null) document.getElementById('bt-sim-riskpct').value=data.sim.riskPct;
      else if(data.sim.risk&&data.sim.equity) document.getElementById('bt-sim-riskpct').value=(data.sim.risk/data.sim.equity*100).toFixed(2);
      else if(data.sim.risk) document.getElementById('bt-sim-riskpct').value=1;
      if(data.sim.equity) document.getElementById('bt-sim-equity').value=data.sim.equity;
      else document.getElementById('bt-sim-equity').value='';
      document.getElementById('bt-sim-bpmult').value=data.sim.bpMult||4;
      if(data.sim.rDirect) document.getElementById('bt-sim-rdirect').value=data.sim.rDirect;
      else document.getElementById('bt-sim-rdirect').value='';
      getRiskAmount(); // update dollar display
    }

    // 3. Restore panel configs (TF, dates, indicators)
    if(data.panels){
      data.panels.forEach((sp,i)=>{
        if(i>=panels.length) return;
        const p=panels[i];
        if(sp.tf) p.tf=sp.tf;
        p.startDate=sp.startDate||null;
        p.endDate=sp.endDate||null;
        if(sp.inds) p.inds={...p.inds,...sp.inds};
        if(sp.showTL!=null) p.showTL=sp.showTL;
        if(sp.showAnn!=null) p.showAnn=sp.showAnn;
        if(sp.showExec!=null) p.showExec=sp.showExec;
        if(sp.showBtExec!=null) p.showBtExec=sp.showBtExec;
        if(sp.showOtherAnn!=null) p.showOtherAnn=sp.showOtherAnn;
        if(sp.showPDC!=null) p.showPDC=sp.showPDC;
        if(sp.adjusted!=null) p.adjusted=sp.adjusted;
        if(sp.btBack!=null) p.btBack=sp.btBack;
        if(sp.btFwd!=null) p.btFwd=sp.btFwd;
        // Update date inputs
        if(sp.startDate) document.getElementById(`from-${i}`).value=sp.startDate;
        if(sp.endDate) document.getElementById(`to-${i}`).value=sp.endDate;
      });
    }
    if(data.btStrategyMode) btStrategyMode=data.btStrategyMode;

    // 4. Show backtest panel (so sim is visible)
    if(!btActive){
      document.getElementById('bt-btn').click();
    }

    // 5. Load chart data (this clears annotations internally)
    if(liveMode) setLiveMode(false);
    const btn=document.getElementById('load-btn');
    btn.disabled=true; btn.textContent='…';
    panels.forEach((_,i)=>document.getElementById(`sym-${i}`).textContent=symbol);
    await Promise.all(panels.map((_,i)=>loadPanel(i)));
    btn.disabled=false; btn.textContent='▶ LOAD';
    // Update ticker info
    const dp=panels.find(p=>p.data.length&&!isIntraday(p.tf))||panels.find(p=>p.data.length);
    if(dp?.data.length){
      const last=dp.data[dp.data.length-1],prev=dp.data[dp.data.length-2]||last;
      const chg=last.close-prev.close,pct=((chg/prev.close)*100).toFixed(2);
      document.getElementById('ti-sym').textContent=symbol;
      document.getElementById('ti-price').textContent=`$${last.close.toFixed(2)}`;
      document.getElementById('ti-chg').innerHTML=`<span style="color:${chg>=0?'#26a69a':'#ef5350'}">${chg>=0?'+':''}${chg.toFixed(2)} (${pct}%)</span>`;
    }

    // 6. Restore annotations AFTER load (loadAll would have cleared them)
    annotations=data.annotations||[];
    nextId=data.nextId||annotations.length+1;

    // 7. Restore viewStart/viewBars per panel
    if(data.panels){
      data.panels.forEach((sp,i)=>{
        if(i>=panels.length) return;
        const p=panels[i];
        if(sp.viewStart!=null && sp.viewStart<p.data.length) p.viewStart=sp.viewStart;
        if(sp.viewBars!=null) p.viewBars=Math.min(sp.viewBars,p.data.length);
      });
    }

    // 8. Rebuild the panel config UI (TF buttons, toggle states)
    panels.forEach((p,i)=>{
      const wrap=document.getElementById(`cfg-${i}`);
      if(wrap){
        wrap.querySelectorAll('.tf-btn').forEach(b=>{
          b.classList.toggle('active',b.dataset.tf===p.tf);
        });
      }
    });

    updateSimPnl();
    renderAll();
    reviewStatusMsg('✓ Loaded: '+data.symbol+' ('+data.annotations.length+' annotations)','#26a69a',4000);
    toast('📂 Review loaded: '+data.symbol);
  }catch(err){
    reviewStatusMsg('✗ Load failed: '+err.message,'#ef5350',5000);
    toast('Load failed: '+err.message,true);
  }
}

document.getElementById('review-save-btn').addEventListener('click',saveReview);
document.getElementById('review-load-btn').addEventListener('click',()=>{
  document.getElementById('review-file-input').click();
});
document.getElementById('review-file-input').addEventListener('change',e=>{
  const f=e.target.files[0];
  if(!f) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const data=JSON.parse(ev.target.result);
      loadReview(data);
    }catch(err){
      reviewStatusMsg('✗ Invalid JSON file','#ef5350',4000);
      toast('Invalid review file',true);
    }
  };
  reader.readAsText(f);
  e.target.value=''; // reset so same file can be loaded again
});

// Autosave to localStorage on annotation changes
const _origPushAnn=Array.prototype.push;
function autoSaveReview(){
  try{
    if(annotations.length>0) localStorage.setItem('prochart_autosave',JSON.stringify(buildReviewData()));
  }catch(e){}
}
// Periodic autosave every 30s if annotations exist
setInterval(()=>{if(annotations.length>0)autoSaveReview();},30000);

// On startup: check for autosave
// On startup: check for autosave (deferred so all functions are defined)
setTimeout(function checkAutosave(){
  try{
    const saved=localStorage.getItem('prochart_autosave');
    if(!saved) return;
    const data=JSON.parse(saved);
    if(!data.annotations||data.annotations.length===0) return;
    // Show a restore prompt — need BT sidebar open
    if(!btActive) document.getElementById('bt-btn').click();
    document.getElementById('bt-sim').style.display='block';
    const statusEl=document.getElementById('review-status');
    const ts=data._saved?new Date(data._saved).toLocaleString():'unknown';
    statusEl.innerHTML='<span style="color:#f59e0b;">⚡ Autosave found: '+data.symbol+' ('+data.annotations.length+' ann, '+ts+')</span> '
      +'<button id="review-restore-btn" style="background:#f59e0b;color:#000;border:none;font-family:\'Inter\',system-ui,sans-serif;font-size:11px;font-weight:700;padding:2px 8px;border-radius:2px;cursor:pointer;margin-left:4px;">RESTORE</button> '
      +'<button id="review-dismiss-btn" style="background:none;color:#4a6080;border:1px solid #2a3050;font-family:\'Inter\',system-ui,sans-serif;font-size:11px;padding:2px 6px;border-radius:2px;cursor:pointer;">DISMISS</button>';
    statusEl.style.display='block';
    statusEl.style.color='#f59e0b'; statusEl.style.background='rgba(245,158,11,0.08)'; statusEl.style.border='1px solid #f59e0b33';
    // Need to wait for bt panel to be visible; attach handlers after DOM is ready
    setTimeout(()=>{
      document.getElementById('review-restore-btn')?.addEventListener('click',()=>{
        statusEl.style.display='none';
        loadReview(data);
      });
      document.getElementById('review-dismiss-btn')?.addEventListener('click',()=>{
        statusEl.style.display='none';
        localStorage.removeItem('prochart_autosave');
      });
    },100);
  }catch(e){}
},500);

document.getElementById('load-btn').addEventListener('click',()=>{
  const s=document.getElementById('symbol-input').value.trim().toUpperCase();
  if(!s) return; setSymbol(s);
  // Keep live mode ON for fresh symbol loads (it's already on by default)
  panels.forEach(p=>{p.startDate=null;p.endDate=null;});
  loadAll();
  // Ensure live mode is active after load
  if(!liveMode) setLiveMode(true);
});
document.getElementById('symbol-input').addEventListener('keydown',e=>{
  if(e.key==='Enter') document.getElementById('load-btn').click();
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    const pctPopup=document.getElementById('pct-popup');
    const textPopup=document.getElementById('text-popup');
    const pctOpen=pctPopup.classList.contains('show');
    const textOpen=textPopup.classList.contains('show');
    const toolActive=activeTool!=null;
    
    // Priority 1: close popups
    if(pctOpen){ pctPopup.classList.remove('show'); pendingExec=null; e.preventDefault(); return; }
    if(textOpen){ textPopup.classList.remove('show'); pendingExec=null; e.preventDefault(); return; }
    // Priority 2: deactivate tool
    if(toolActive){ setActiveTool(null); e.preventDefault(); return; }
    // Priority 3: exit fullscreen (only if nothing else to close)
    if(fullscreenPanel!==null) toggleFullscreen(fullscreenPanel);
  }
  // Enter key finishes path annotation
  if(e.key==='Enter'&&activeTool==='path'&&toolAnchor&&Array.isArray(toolAnchor.points)&&toolAnchor.points.length>=2){
    finishPathAnnotation(); e.preventDefault(); return;
  }
  // Ctrl+S / Cmd+S = save review
  if((e.ctrlKey||e.metaKey)&&e.key==='s'){
    e.preventDefault();
    if(annotations.length>0) saveReview();
    else toast('Nothing to save — place some annotations first');
  }
});

// ══════════════════════════════════════════════════════════
//  RISK PER R — ADJUSTABLE
// ══════════════════════════════════════════════════════════
function getRiskAmount(){
  // Direct R$ override takes priority over EQ×%
  const directR=parseFloat(document.getElementById('bt-sim-rdirect')?.value);
  if(directR>0){
    const rdEl=document.getElementById('btsim-rdollar');
    if(rdEl) rdEl.textContent='= $'+directR.toLocaleString(undefined,{maximumFractionDigits:0})+' (direct)';
    return Math.max(1,directR);
  }
  const pct=parseFloat(document.getElementById('bt-sim-riskpct')?.value)||1;
  const eq=getEquity();
  const dollarRisk=eq?(eq*pct/100):pct*1000; // fallback: treat pct as multiplier of $1000 if no equity set
  // Update the dollar display
  const rdEl=document.getElementById('btsim-rdollar');
  if(rdEl) rdEl.textContent=eq?'= $'+dollarRisk.toLocaleString(undefined,{maximumFractionDigits:0}):'(set EQ$)';
  return Math.max(1,dollarRisk);
}
function getEquity(){ const v=parseFloat(document.getElementById('bt-sim-equity')?.value); return (v>0)?v:null; }
function getBPMult(){ return Math.max(1, parseFloat(document.getElementById('bt-sim-bpmult')?.value)||4); }
function getBuyingPower(){ const eq=getEquity(); return eq?eq*getBPMult():null; }
document.getElementById('bt-sim-riskpct').addEventListener('input',()=>{ getRiskAmount(); updateSimPnl(); });
document.getElementById('bt-sim-equity').addEventListener('input',()=>{ getRiskAmount(); updateSimPnl(); });
document.getElementById('bt-sim-bpmult').addEventListener('input',()=>{ updateSimPnl(); });
document.getElementById('bt-sim-rdirect').addEventListener('input',()=>{ getRiskAmount(); updateSimPnl(); });

// ══════════════════════════════════════════════════════════
//  MANUAL SIM PNL CALCULATOR
// ══════════════════════════════════════════════════════════
function updateEqSummary(riskDeployed){
  const el=document.getElementById('btsim-eq-summary');
  const eq=getEquity();
  if(!eq){el.textContent='';return;}
  const bp=eq*getBPMult();
  el.textContent='BP $'+bp.toLocaleString(undefined,{maximumFractionDigits:0});
}
function updateSimPnl(){
  const RISK=getRiskAmount();
  const execAnns=annotations
    .filter(a=>a.type==='entry_arrow'||a.type==='exit_arrow'||a.type==='short_arrow'||a.type==='cover_arrow'||a.type==='stop_line'||a.type==='trail_stop')
    .sort((a,b)=>a.x1-b.x1);

  const panel=document.getElementById('bt-sim');
  const legsEl=document.getElementById('bt-sim-legs');
  const entryEl=document.getElementById('btsim-entry');
  const sharesEl=document.getElementById('btsim-shares');
  const stopEl=document.getElementById('btsim-stop');
  const riskEl=document.getElementById('btsim-risk');
  const exitEl=document.getElementById('btsim-exit');
  const pnlEl=document.getElementById('btsim-pnl');
  const rEl=document.getElementById('btsim-r');

  if(!execAnns.length){
    if(btActive) panel.style.display='block';
    else panel.style.display='none';
    legsEl.innerHTML=''; entryEl.textContent='—'; sharesEl.textContent='—';
    stopEl.textContent='—'; riskEl.textContent='—'; exitEl.textContent='—';
    const ae=document.getElementById('btsim-avgexit'); if(ae) ae.textContent='—';
    pnlEl.textContent='—'; pnlEl.style.color='#4a6080';
    rEl.textContent='—'; rEl.style.color='#4a6080';
    document.getElementById('btsim-rmath').textContent='—';
    document.getElementById('btsim-pct').textContent='—'; document.getElementById('btsim-pct').style.color='#4a6080';
    document.getElementById('btsim-status').textContent='—';
    document.getElementById('btsim-status').style.color='#4a6080';
    document.getElementById('btsim-posval').textContent='—';
    document.getElementById('btsim-bpused').textContent='—';
    document.getElementById('btsim-bp-warn').style.display='none';
    updateEqSummary(0);
    return;
  }
  panel.style.display='block';

  // Each entry annotation carries ann.stopPrice (entered in popup).
  // shares = round(RISK * pct/100 / |entryPrice - stopPrice|)
  // Exits close pct% of total open shares FIFO, accumulate realised PnL.

  let openLegs=[];          // {entryPrice, shares, stopPrice, pct}
  let closedPnl=0;
  let totalRiskDeployed=0;
  let entryLegsCount=0;
  let legDescs=[];
  let lastExitPrice=null, lastExitPct=null;
  let isLong=null;
  // Avg exit tracking
  let totalExitShares=0, totalExitCost=0;
  // BP tracking
  let peakPosValue=0, bpExceeded=false;
  const bp=getBuyingPower();
  // Peak position tracking (for closed-trade display)
  let peakShares=0, peakAvgEntry=0, lastStopUsed=null;
  let totalEntryShares=0; // total shares ever entered (across all legs)
  let preCloseAvg=0, preCloseShares=0; // snapshot right before full close

  // ── Helper: size shares — exact Excel formula =(D4-(D2*(D3-D1)))/(D3-D5) ──
  function sizeEntry(addPrice, stop, riskAlloc, existingShares, existingAvg){
    if(stop==null) return 0;
    const denom = stop - addPrice;
    if(denom===0) return 0;
    // Long: stop<addPrice → denom<0 → use -riskAlloc. Short: stop>addPrice → denom>0 → use +riskAlloc
    const signedRisk = (stop > addPrice) ? riskAlloc : -riskAlloc;
    const shares = (signedRisk - existingShares*(stop - existingAvg)) / denom;
    return Math.max(0, Math.round(shares));
  }

  // ── Helper: get bar data for a panel to check price between annotations ──
  function getBarsInRange(panelIdx, fromTs, toTs) {
    const p = panels[panelIdx];
    if (!p || !p.data || !p.data.length) return [];
    return p.data.filter(b => {
      const t = typeof b.time === 'number' ? b.time : toUnix(b.time);
      return t > fromTs && t < toTs;
    });
  }

  let prevAnnTime = 0;
  let autoStopCount = 0;

  for(const a of execAnns){
    const annTime = a.x1;

    // ── AUTO-STOP DETECTION ──
    // Before processing this annotation, check if price crossed any stop between prevAnn and now
    if(openLegs.length > 0 && prevAnnTime > 0 && annTime > prevAnnTime) {
      const currentStop2 = openLegs[openLegs.length - 1].stopPrice;
      if(currentStop2 != null) {
        // Find the panel with the most data (usually the intraday panel where annotations live)
        const annPanel = a.panelIdx != null ? a.panelIdx : 0;
        const barsInGap = getBarsInRange(annPanel, prevAnnTime, annTime);

        let stopHit = false;
        let stopHitPrice = currentStop2;

        for(const bar of barsInGap) {
          if(isLong === false) {
            // SHORT position: stop hit when HIGH >= stop price
            if(bar.high >= currentStop2) { stopHit = true; break; }
          } else if(isLong === true) {
            // LONG position: stop hit when LOW <= stop price
            if(bar.low <= currentStop2) { stopHit = true; break; }
          }
        }

        if(stopHit) {
          // Auto-close ALL open shares at the stop price
          const totalOpen = openLegs.reduce((s,l) => s + l.shares, 0);
          if(totalOpen > 0) {
            preCloseAvg = openLegs.reduce((s,l) => s + l.entryPrice * l.shares, 0) / totalOpen;
            preCloseShares = totalOpen;
            let stopPnl = 0;
            for(const leg of openLegs) {
              const legPnl = (isLong === false)
                ? (leg.entryPrice - stopHitPrice) * leg.shares
                : (stopHitPrice - leg.entryPrice) * leg.shares;
              stopPnl += legPnl;
            }
            closedPnl += stopPnl;
            totalExitShares += totalOpen;
            totalExitCost += stopHitPrice * totalOpen;
            const sr = (closedPnl >= 0 ? '+' : '') + closedPnl.toFixed(2);
            const stopR = (stopPnl / RISK).toFixed(2);
            legDescs.push('<span style="color:#ef5350;font-weight:700;">⚠ AUTO-STOP ' + totalOpen.toLocaleString() + 'sh @ ' + stopHitPrice.toFixed(2) + ' → $' + (stopPnl >= 0 ? '+' : '') + stopPnl.toFixed(2) + ' (' + (stopPnl >= 0 ? '+' : '') + stopR + 'R)</span>');
            openLegs = [];
            autoStopCount++;
            isLong = null; // reset direction for next entry
          }
        }
      }
    }

    prevAnnTime = annTime;
    
    if(a.type==='entry_arrow'||a.type==='short_arrow'){
      let sp=a.stopPrice??null;
      if(sp==null){
        const precedingStop=execAnns
          .filter(s=>(s.type==='stop_line'||s.type==='trail_stop')&&s.x1<=a.x1)
          .slice(-1)[0];
        if(precedingStop) sp=precedingStop.y1;
      }
      const existingShares=openLegs.reduce((s,l)=>s+l.shares,0);
      const existingAvg=existingShares>0
        ?openLegs.reduce((s,l)=>s+l.entryPrice*l.shares,0)/existingShares:0;
      let shares=0;
      if(sp!=null){
        // Determine risk allocation
        let riskAlloc;
        if(a.pnlMode){
          // PNL mode: use locked PnL + baseExtra% of RISK$
          riskAlloc=closedPnl+RISK*((a.pnlBaseExtra||0)/100);
          riskAlloc=Math.max(0,riskAlloc);
        } else {
          const pct=(a.pct??100);
          riskAlloc=RISK*(pct/100);
        }
        shares=sizeEntry(a.y1, sp, riskAlloc, existingShares, existingAvg);
        const totalAfter=existingShares+shares;
        const newAvg=totalAfter>0?(existingShares*existingAvg+shares*a.y1)/totalAfter:a.y1;
        if(isLong===null) isLong=a.y1>sp;
        totalRiskDeployed+=riskAlloc;
        entryLegsCount++;
        const modeTag=a.pnlMode?` PNL+${a.pnlBaseExtra||0}%`:` ${(a.pct??100)}%`;
        const eArrow=a.type==='short_arrow'?'▼ ':'▲ ';
        const entryTag=a.type==='short_arrow'?'SHORT':'LONG';
        legDescs.push(eArrow+shares.toLocaleString()+'sh @ '+a.y1.toFixed(2)
          +' ['+entryTag+modeTag+']'
          +(existingShares>0?' avg→'+newAvg.toFixed(2):'')
          +' $'+riskAlloc.toFixed(0)+' stop:'+sp.toFixed(2));
        // Track peak position
        if(totalAfter>peakShares){ peakShares=totalAfter; peakAvgEntry=newAvg; }
        totalEntryShares+=shares;
        lastStopUsed=sp;
        // BP check
        const posVal=totalAfter*newAvg;
        if(posVal>peakPosValue) peakPosValue=posVal;
        if(bp && posVal>bp){
          bpExceeded=true;
          legDescs.push('<span style="color:#ef5350;font-size:11px;">⚠ BP EXCEEDED: $'+posVal.toLocaleString(undefined,{maximumFractionDigits:0})+' > $'+bp.toLocaleString(undefined,{maximumFractionDigits:0})+' BP</span>');
        }
      } else {
        legDescs.push('▲ ?sh @ '+a.y1.toFixed(2)+' [no stop found]');
      }
      openLegs.push({entryPrice:a.y1,shares,stopPrice:sp,pct:(a.pct??100)});

    } else if(a.type==='exit_arrow'||a.type==='cover_arrow'){
      const pct=(a.pct??100);
      lastExitPrice=a.y1; lastExitPct=pct;
      const totalOpen=openLegs.reduce((s,l)=>s+l.shares,0);
      if(totalOpen>0){
        // Snapshot before this exit (in case it fully closes)
        const preAvg=openLegs.reduce((s,l)=>s+l.entryPrice*l.shares,0)/totalOpen;
        preCloseAvg=preAvg; preCloseShares=totalOpen;
        let closedSh=0;
        for(let i=0;i<openLegs.length;i++){
          const take=Math.round(openLegs[i].shares*(pct/100));
          const legPnl=(isLong===false)
            ?(openLegs[i].entryPrice-a.y1)*take
            :(a.y1-openLegs[i].entryPrice)*take;
          closedPnl+=legPnl;
          closedSh+=take;
          openLegs[i]={...openLegs[i],shares:openLegs[i].shares-take};
        }
        openLegs=openLegs.filter(l=>l.shares>0);
        // Track weighted avg exit
        totalExitShares+=closedSh;
        totalExitCost+=a.y1*closedSh;
        const s=(closedPnl>=0?'+':'')+closedPnl.toFixed(2);
        const exitArrow=a.type==='cover_arrow'?'▲ ':'▼ ';
        const exitTag=a.type==='cover_arrow'?'COVER':'SELL';
        legDescs.push(exitArrow+closedSh.toLocaleString()+'sh @ '+a.y1.toFixed(2)+' ['+exitTag+' '+pct+'%] → $'+s);
      }
    }
    // stop_line / trail_stop: update stop for open legs (used by auto-stop detection)
    if((a.type==='stop_line'||a.type==='trail_stop') && openLegs.length > 0) {
      for(let i=0;i<openLegs.length;i++){
        openLegs[i] = {...openLegs[i], stopPrice: a.y1};
      }
      lastStopUsed = a.y1;
    }
  }

  const openShares=openLegs.reduce((s,l)=>s+l.shares,0);
  const avgEntry=openShares>0
    ?openLegs.reduce((s,l)=>s+l.entryPrice*l.shares,0)/openShares:0;
  const avgExit=totalExitShares>0?totalExitCost/totalExitShares:null;
  const lastStopAnn=execAnns.filter(a=>(a.type==='stop_line'&&!a._autoStop)||a.type==='trail_stop').slice(-1)[0];
  const currentStop=lastStopAnn?.y1??null;

  const avgExitEl=document.getElementById('btsim-avgexit');
  const isClosed=openShares===0&&closedPnl!==0;
  const displayAvg=openShares>0?avgEntry:(isClosed?(preCloseAvg||peakAvgEntry):0);
  const displayShares=openShares>0?openShares:(isClosed?preCloseShares:0);
  entryEl.textContent=openShares>0?avgEntry.toFixed(3):(isClosed?displayAvg.toFixed(3):'—');
  if(isClosed) entryEl.style.color='#6a80a0'; else entryEl.style.color='#dde3f0';
  sharesEl.textContent=openShares>0?openShares.toLocaleString():(isClosed?'0 (pk '+peakShares.toLocaleString()+')':'0');
  if(isClosed) sharesEl.style.color='#6a80a0'; else sharesEl.style.color='#dde3f0';
  stopEl.textContent=currentStop!=null?currentStop.toFixed(3):(isClosed&&lastStopUsed!=null?lastStopUsed.toFixed(3):'—');
  if(isClosed&&openShares===0) stopEl.style.color='#8a7520'; else stopEl.style.color='#facc15';
  riskEl.textContent=totalRiskDeployed>0?'$'+totalRiskDeployed.toFixed(0)+' ('+entryLegsCount+'×)':'—';
  if(avgExitEl) avgExitEl.textContent=avgExit!=null?avgExit.toFixed(3):'—';
  exitEl.textContent=lastExitPrice!=null
    ?lastExitPrice.toFixed(3)+(lastExitPct&&lastExitPct<100?' ('+lastExitPct+'%)':''):'—';

  // R is always relative to 1 full risk unit (adjustable) — standard trading R
  const rmathEl=document.getElementById('btsim-rmath');
  const statusEl2=document.getElementById('btsim-status');
  if(closedPnl!==0||lastExitPrice!=null){
    pnlEl.textContent=(closedPnl>=0?'+':'')+closedPnl.toFixed(2);
    pnlEl.style.color=closedPnl>=0?'#26a69a':'#ef5350';
    const r=closedPnl/RISK; // R = PnL / risk unit (not scaled by legs)
    rEl.textContent=(r>=0?'+':'')+r.toFixed(2)+'R';
    rEl.style.color=r>=0?'#26a69a':'#ef5350';
    // R math breakdown
    rmathEl.textContent='$'+(closedPnl>=0?'+':'')+closedPnl.toFixed(0)+' / $'+RISK.toFixed(0)+' = '+(r>=0?'+':'')+r.toFixed(2)+'R';
    rmathEl.style.color=r>=0?'#26a69a80':'#ef535080';
    // SIM % — PnL as percentage of account equity
    const pctEl=document.getElementById('btsim-pct');
    const eqForPct=getEquity();
    if(pctEl){
      if(eqForPct&&eqForPct>0){
        const pct=(closedPnl/eqForPct)*100;
        pctEl.textContent=(pct>=0?'+':'')+pct.toFixed(2)+'%';
        pctEl.style.color=pct>=0?'#26a69a':'#ef5350';
      } else {
        pctEl.textContent='(set EQ$)'; pctEl.style.color='#4a6080';
      }
    }
  } else {
    pnlEl.textContent='(place exit)'; pnlEl.style.color='#4a6080';
    rEl.textContent='—'; rEl.style.color='#4a6080';
    rmathEl.textContent='—'; rmathEl.style.color='#4a6080';
    const pctEl2=document.getElementById('btsim-pct'); if(pctEl2){pctEl2.textContent='—'; pctEl2.style.color='#4a6080';}
  }
  // Status
  if(isClosed){
    statusEl2.textContent='CLOSED — last '+preCloseShares.toLocaleString()+'sh, pk '+peakShares.toLocaleString()+'sh'+(autoStopCount?' ('+autoStopCount+' auto-stop'+(autoStopCount>1?'s':'')+')':'');
    statusEl2.style.color=closedPnl>=0?'#26a69a':'#ef5350';
  } else if(openShares>0){
    statusEl2.textContent='OPEN '+openShares.toLocaleString()+'sh';
    statusEl2.style.color='#f59e0b';
  } else {
    statusEl2.textContent='—'; statusEl2.style.color='#4a6080';
  }

  // ── Position value & BP ──
  const posValEl=document.getElementById('btsim-posval');
  const bpUsedEl=document.getElementById('btsim-bpused');
  const bpWarnEl=document.getElementById('btsim-bp-warn');
  const currentPosVal=openShares>0?openShares*avgEntry:0;
  const peakVal=Math.max(peakPosValue,currentPosVal);
  posValEl.textContent=currentPosVal>0?'$'+currentPosVal.toLocaleString(undefined,{maximumFractionDigits:0})
    +(peakVal>currentPosVal?' (pk $'+peakVal.toLocaleString(undefined,{maximumFractionDigits:0})+')':''):'—';
  if(bp){
    const bpPct=(peakVal/bp*100);
    bpUsedEl.textContent=bpPct.toFixed(1)+'%';
    bpUsedEl.style.color=bpPct>100?'#ef5350':bpPct>80?'#f59e0b':'#26a69a';
    if(bpExceeded){
      bpWarnEl.style.display='block';
      bpWarnEl.textContent='⚠ POSITION EXCEEDED BUYING POWER — peak $'+peakVal.toLocaleString(undefined,{maximumFractionDigits:0})+' vs $'+bp.toLocaleString(undefined,{maximumFractionDigits:0})+' BP';
    } else { bpWarnEl.style.display='none'; }
  } else {
    bpUsedEl.textContent='—'; bpUsedEl.style.color='#4a6080';
    bpWarnEl.style.display='none';
  }
  updateEqSummary(totalRiskDeployed);

  legsEl.innerHTML=legDescs.map(d=>{
    // BP warning spans are already styled HTML
    if(d.startsWith('<span')) return d;
    // Entries have 'S:' stop marker; exits have '→'
    const isLongEntry=d.startsWith('▲')&&d.includes('[LONG');
    const isShortEntry=d.startsWith('▼')&&d.includes('[SHORT');
    const isSell=d.startsWith('▼')&&d.includes('→');
    const isCover=d.startsWith('▲')&&d.includes('→');
    const col=isLongEntry?'#ff9800':isShortEntry?'#ff5252':isSell?'#40c4ff':isCover?'#00e676':'#8aa0c0';
    return '<div style="color:'+col+';margin-bottom:3px;font-size:11px;font-weight:700;line-height:1.5;letter-spacing:0.2px;">'+d+'</div>';
  }).join('');
}

//  BACKTEST ENGINE
// ══════════════════════════════════════════════════════════

function parseTimestamp(s){
  // Parses "Timestamp('2024-01-08 09:57:00-0500', tz='US/Eastern')" or plain datetime
  // Converts local time to UTC Unix seconds
  if(!s) return null;
  const m=s.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  if(!m) return null;
  const dateStr=m[1], timeStr=m[2];
  const utcMs=new Date(dateStr+'T'+timeStr+'Z').getTime();
  // If the string has an explicit tz offset like -0500 or +0400, use it directly
  const tzMatch=s.match(/([+-])(\d{2}):?(\d{2})(?:\s|'|,|$)/);
  if(tzMatch){
    const sign=tzMatch[1]==='+'?1:-1;
    const offSec=sign*(parseInt(tzMatch[2])*3600+parseInt(tzMatch[3])*60);
    return Math.floor(utcMs/1000)-offSec; // localtime-as-UTC minus offset = actual UTC
  }
  // Fallback: DST-aware ET offset
  const [y,mo,d]=dateStr.split('-').map(Number);
  const isEDT=(()=>{
    if(mo>3&&mo<11) return true;
    if(mo<3||mo>11) return false;
    if(mo===3){const secondSun=8+(7-(new Date(y,2,1).getDay()||7))%7;return d>=secondSun;}
    if(mo===11){const firstSun=1+(7-(new Date(y,10,1).getDay()||7))%7;return d<firstSun;}
    return false;
  })();
  return Math.floor(utcMs/1000)+(isEDT?4*3600:5*3600);
}

function parseList(s){
  // "[val1, val2]" or "[Timestamp(...), ...]"
  if(!s||s==='[]'||s==='"[]"') return [];
  // Strip surrounding double-quotes added by CSV quoting: "[...]" -> [...]
  s=s.replace(/^"|"$/g,'').trim();
  if(!s||s==='[]') return [];
  // Normalise escaped single-quotes produced by Python repr inside CSV: \' -> '
  s=s.replace(/\\'/g,"'");
  // Strip numpy wrappers: np.float64(1.23) -> 1.23
  s=s.replace(/np\.\w+\(([^)]+)\)/g,'$1');
  // Extract Timestamps — match datetime string up to closing quote, ignore extra tz args
  const tsPat=/Timestamp\('(\d{4}-\d{2}-\d{2}[^']*)'/g;
  const tsMatches=[]; let tm;
  while((tm=tsPat.exec(s))!==null) tsMatches.push(tm[1]);
  if(tsMatches.length) return tsMatches;
  // Extract numbers/strings
  return s.replace(/^\[|\]$/g,'').split(',').map(x=>x.trim().replace(/^'|'$/g,''));
}

function parseBtCSV(text){
  const lines=text.trim().split('\n');
  const header=lines[0].split(',').map(s=>s.trim());
  const col=k=>header.indexOf(k);
  const trades=[];
  for(let i=1;i<lines.length;i++){
    // Smart CSV split respecting brackets
    const raw=lines[i];
    const cells=[]; let cur='',depth=0;
    for(const ch of raw){
      if(ch==='['||ch==='(') depth++;
      else if(ch===']'||ch===')') depth--;
      if(ch===','&&depth===0){cells.push(cur);cur='';}
      else cur+=ch;
    }
    cells.push(cur);
    const g=k=>cells[col(k)]?.trim()||'';
    const pnl=parseFloat(g('pnl'))||0;
    const entryTimes=parseList(g('entry_time_list'));
    const exitTimes=parseList(g('exit_time_list'));
    const entryPrices=parseList(g('entry_list'));
    const exitPrices=parseList(g('exit_list'));
    const entryShares=parseList(g('shares_entered_list'));
    const exitShares=parseList(g('shares_covered_list'));
    const entryReasons=parseList(g('entry_reason_list'));
    const exitReasons=parseList(g('exit_reason_list'));
    const stopPrices=parseList(g('stop_list'));

    const entries=entryTimes.map((t,j)=>({
      time: parseTimestamp(t) || parseTimestamp(g('entry_time')),
      price: parseFloat(entryPrices[j])||parseFloat(g('avg_entry'))||0,
      shares: parseInt(entryShares[j])||0,
      reason: entryReasons[j]||g('entry_name'),
      stop: parseFloat(stopPrices[j])||null,
    })).filter(e=>e.time&&e.price);

    const exits=exitTimes.map((t,j)=>({
      time: parseTimestamp(t) || parseTimestamp(g('exit_time')),
      price: parseFloat(exitPrices[j])||parseFloat(g('avg_exit'))||0,
      shares: parseInt(exitShares[j])||0,
      reason: exitReasons[j]||g('last_exit_reason'),
    })).filter(e=>e.time&&e.price);

    trades.push({
      date: g('date'),
      ticker: g('ticker').toUpperCase(),
      pnl, entries, exits,
      avg_entry: parseFloat(g('avg_entry'))||0,
      avg_exit: parseFloat(g('avg_exit'))||0,
      shares: parseInt(g('total_shares'))||0,
      entry_time: g('entry_time'),
      exit_time: g('exit_time'),
      exit_reason: g('last_exit_reason'),
      R_pnl: parseFloat(g('R_pnl'))||0,
    });
  }
  return trades.filter(t=>t.ticker&&t.date);
}


function mergeBtTrades(trades){
  const key=t=>t.ticker+'|'+t.date;
  const groups={};
  for(const t of trades){
    const k=key(t);
    if(!groups[k]) groups[k]=[];
    groups[k].push(t);
  }
  const merged=[];
  for(const k of Object.keys(groups)){
    const grp=groups[k];
    if(grp.length===1){merged.push(grp[0]);continue;}
    const allEntries=grp.flatMap(t=>t.entries).sort((a,b)=>a.time-b.time);
    const allExits=grp.flatMap(t=>t.exits).sort((a,b)=>a.time-b.time);
    const totalPnl=grp.reduce((s,t)=>s+t.pnl,0);
    const totalShares=grp.reduce((s,t)=>s+t.shares,0);
    const totalR=grp.reduce((s,t)=>s+t.R_pnl,0);
    const wEntry=allEntries.reduce((s,e)=>s+e.price*e.shares,0);
    const sEntry=allEntries.reduce((s,e)=>s+e.shares,0);
    const wExit=allExits.reduce((s,e)=>s+e.price*e.shares,0);
    const sExit=allExits.reduce((s,e)=>s+e.shares,0);
    const avgEntry=sEntry>0?wEntry/sEntry:grp[0].avg_entry;
    const avgExit=sExit>0?wExit/sExit:grp[grp.length-1].avg_exit;
    const entryTimes=grp.map(t=>t.entry_time).filter(Boolean).sort();
    const exitTimes=grp.map(t=>t.exit_time).filter(Boolean).sort();
    const reasons=[...new Set(grp.map(t=>t.exit_reason).filter(Boolean))].join('+');
    merged.push({
      date:grp[0].date, ticker:grp[0].ticker,
      pnl:totalPnl, entries:allEntries, exits:allExits,
      avg_entry:avgEntry, avg_exit:avgExit, shares:totalShares,
      entry_time:entryTimes[0]||'', exit_time:exitTimes[exitTimes.length-1]||'',
      exit_reason:reasons, R_pnl:totalR, _merged:grp.length,
    });
  }
  return merged;
}
function btStats(trades){
  const total=trades.reduce((s,t)=>s+t.pnl,0);
  const wins=trades.filter(t=>t.pnl>0);
  const losses=trades.filter(t=>t.pnl<0);
  const wr=trades.length?((wins.length/trades.length)*100).toFixed(0)+'%':'—';
  const avgW=wins.length?(wins.reduce((s,t)=>s+t.pnl,0)/wins.length).toFixed(2):'—';
  const avgL=losses.length?(losses.reduce((s,t)=>s+t.pnl,0)/losses.length).toFixed(2):'—';
  const best=trades.length?Math.max(...trades.map(t=>t.pnl)).toFixed(2):'—';
  const worst=trades.length?Math.min(...trades.map(t=>t.pnl)).toFixed(2):'—';
  return{total,wr,avgW,avgL,best,worst,n:trades.length};
}

function fmtPnl(v){
  const n=parseFloat(v);
  if(isNaN(n)) return v;
  return (n>=0?'+':'')+n.toFixed(2);
}

function renderBtList(){
  const search=document.getElementById('bt-search').value.toUpperCase().trim();
  const sort=document.getElementById('bt-sort').value;
  let trades=[...btTrades];
  if(search) trades=trades.filter(t=>t.ticker.includes(search));

  if(sort==='pnl_desc') trades.sort((a,b)=>b.pnl-a.pnl);
  else if(sort==='pnl_asc') trades.sort((a,b)=>a.pnl-b.pnl);
  else if(sort==='ticker') trades.sort((a,b)=>a.ticker.localeCompare(b.ticker));
  else if(sort==='date_desc') trades.sort((a,b)=>b.date.localeCompare(a.date));
  else trades.sort((a,b)=>a.date.localeCompare(b.date)); // date_asc default

  // Group by date
  const byDate={};
  for(const t of trades){
    if(!byDate[t.date]) byDate[t.date]=[];
    byDate[t.date].push(t);
  }
  const dates=Object.keys(byDate).sort((a,b)=>
    sort==='date_desc'?b.localeCompare(a):a.localeCompare(b));

  const list=document.getElementById('bt-list');
  list.innerHTML='';
  for(const date of dates){
    const dayTrades=byDate[date];
    const dayPnl=dayTrades.reduce((s,t)=>s+t.pnl,0);
    const dayDiv=document.createElement('div');
    dayDiv.className='bt-day';

    const hdr=document.createElement('div');
    hdr.className='bt-day-hdr';
    hdr.innerHTML=`<span class="bdd">${date}</span><span class="bdd-pnl" style="color:${dayPnl>=0?'#26a69a':'#ef5350'}">${fmtPnl(dayPnl)}</span>`;
    dayDiv.appendChild(hdr);

    const tradesDiv=document.createElement('div');
    for(const t of dayTrades){
      const row=document.createElement('div');
      row.className='bt-trade'+(btSelected===t?' active':'');
      const reasonCls=t.exit_reason==='stop'?'stop':t.exit_reason==='eod'?'eod':'other';
      const entryT=t.entry_time?t.entry_time.slice(11,16):'';
      const exitT=t.exit_time?t.exit_time.slice(11,16):'';
      row.innerHTML=`
        <div class="bt-trade-top">
          <span class="bt-sym">${t.ticker}</span>
          ${t._merged>1?`<span style="font-size:8px;color:#D4AF37;border:1px solid #D4AF3733;padding:0 3px;border-radius:2px;font-family:'Inter',system-ui,-apple-system,sans-serif;">${t._merged}×</span>`:''}
          <span class="bt-reason ${reasonCls}">${t.exit_reason||'—'}</span>
          <span class="bt-pnl ${t.pnl>=0?'pos':'neg'}">${fmtPnl(t.pnl)}</span>
          <span class="bt-del-btn" title="Remove trade">×</span>
        </div>
        <div class="bt-trade-sub" style="display:flex;gap:6px;align-items:center;">
          <span style="color:#26a69a;font-weight:700;">E:${t.avg_entry.toFixed(2)}</span>
          <span style="color:#3a5070;">→</span>
          <span style="color:#ef5350;font-weight:700;">X:${t.avg_exit.toFixed(2)}</span>
          <span style="color:#2a4060;margin-left:auto;">${t.shares.toLocaleString()}sh</span>
        </div>
        <div class="bt-trade-sub" style="color:#2a4060">
          ${entryT} → ${exitT}
          &nbsp;|&nbsp;<span style="color:${t.R_pnl>=0?'#26a69a':'#ef5350'};font-weight:700;opacity:0.5">${t.R_pnl>=0?'+':''}${t.R_pnl.toFixed(2)}R</span>
        </div>`;
      row.addEventListener('click',()=>selectBtTrade(t, row));
      row.querySelector('.bt-del-btn').addEventListener('click', e=>{
        e.stopPropagation();
        const idx=btTrades.indexOf(t);
        if(idx>-1) btTrades.splice(idx,1);
        if(btSelected===t){ btSelected=null; btMarkers=[]; renderAll(); }
        renderBtList();
      });
      tradesDiv.appendChild(row);
    }
    dayDiv.appendChild(tradesDiv);
    list.appendChild(dayDiv);
  }
}

function selectBtTrade(trade, rowEl){
  // Deselect previous
  document.querySelectorAll('.bt-trade.active').forEach(el=>el.classList.remove('active'));
  if(btSelected===trade){
    btSelected=null; btMarkers=[];
    renderAll(); return;
  }
  btSelected=trade;
  rowEl.classList.add('active');

  // Build markers — store both unix time (for intraday) and date string (for daily)
  btMarkers=[];
  for(const e of trade.entries){
    btMarkers.push({time:e.time, date:trade.date, price:e.price, type:'entry', label:e.price.toFixed(2)});
    if(e.stop) btMarkers.push({time:e.time, date:trade.date, price:e.stop, type:'stop', label:e.stop.toFixed(2)});
  }
  for(const e of trade.exits){
    btMarkers.push({time:e.time, date:trade.date, price:e.price, type:'exit', label:e.price.toFixed(2)});
  }

  // Load the ticker across all panels, centered on the trade date
  const sym=trade.ticker;
  document.getElementById('symbol-input').value=sym;
  setSymbol(sym);
  if(liveMode) setLiveMode(false);

  // Set each panel's date range — use custom btBack/btFwd if set, else defaults
  const tradeDate=new Date(trade.date+'T12:00:00Z');
  panels.forEach(p=>{
    const from=new Date(tradeDate), to=new Date(tradeDate);
    const backDays = p.btBack!=null ? p.btBack : (!isIntraday(p.tf) ? 365 : 14);
    const fwdDays  = p.btFwd!=null  ? p.btFwd  : 14;
    from.setDate(from.getDate()-backDays);
    to.setDate(to.getDate()+fwdDays);
    p.startDate=fmtDate(from); p.endDate=fmtDate(to);
  });

  loadAll();
  toast(`📊 ${sym} — ${trade.date} — ${fmtPnl(trade.pnl)}`);
}

// ══════════════════════════════════════════════════════════
//  SCAN ENGINE — INSIDE DAY LONG
// ══════════════════════════════════════════════════════════
// Pattern: D1 (big vol runner) → Inside/Rest Day (contained in D1 range) → Trade Day (HOD break above rest day high)
//
// Filter 1: $400M D1 $vol, SSR, gap≥0%, retrace≤80%, no warrants, no MDR, no bags, PM $vol≥$2M
// Filter 2: $1B D1 $vol, SSR, gap≥-20%, retrace≤80%, no warrants, no MDR, no bags (no PM vol req)
// Filter 3: Both (passes either)
//
// Automatable: D1 $vol, inside day pattern, retrace, gap, SSR (approx), MDR (with history), bags (with history)
// Manual verify: warrants, PM $vol, PM pump/trend break, D1 HOD timing ≥9:30

// Helper: determine UTC offset for US Eastern Time (EDT=-4, EST=-5)
function getETOffset(dateStr){
  const d=new Date(dateStr+'T12:00:00Z');
  const y=d.getUTCFullYear();
  let mar2nd=new Date(Date.UTC(y,2,1)); while(mar2nd.getUTCDay()!==0) mar2nd.setUTCDate(mar2nd.getUTCDate()+1); mar2nd.setUTCDate(mar2nd.getUTCDate()+7);
  let nov1st=new Date(Date.UTC(y,10,1)); while(nov1st.getUTCDay()!==0) nov1st.setUTCDate(nov1st.getUTCDate()+1);
  return (d>=mar2nd&&d<nov1st)?4:5;
}

function getTradingDates(n) {
  // Returns n most recent trading days INCLUDING today (most recent first)
  const dates = [];
  let d = new Date();
  // Include today if it's a weekday
  if (d.getDay() !== 0 && d.getDay() !== 6) dates.push(d.toISOString().slice(0, 10));
  while (dates.length < n) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

async function fetchGroupedDaily(date) {
  const url = `${POLY}/v2/aggs/grouped/locale/us/market/stocks/${date}?adjusted=true&apiKey=${API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Grouped bars ${date}: ${r.status}`);
  const j = await r.json();
  if (!j.results) return {};
  const map = {};
  for (const b of j.results) {
    if (!b.T || !b.o || !b.h || !b.l || !b.c || !b.v) continue;
    map[b.T] = { open: b.o, high: b.h, low: b.l, close: b.c, vol: b.v, vw: b.vw || b.c };
  }
  return map;
}

async function fetchTickerHistory(ticker, from, to) {
  const url = `${POLY}/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=200&apiKey=${API_KEY}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.results || []).map(b => ({
      date: new Date(b.t).toISOString().slice(0, 10),
      open: b.o, high: b.h, low: b.l, close: b.c, vol: b.v, vw: b.vw || b.c,
      dolVol: b.v * b.c,
    }));
  } catch { return []; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runScan() {
  const btn = document.getElementById('scan-run-btn');
  const statusEl = document.getElementById('scan-status');
  const wlEl = document.getElementById('scan-watchlist');
  const countEl = document.getElementById('scan-count');
  const filterMode = document.querySelector('input[name="scan-filter"]:checked')?.value || '3';

  btn.disabled = true; btn.textContent = '⏳ SCANNING…';
  statusEl.textContent = 'Phase 1: Fetching grouped daily bars…';
  wlEl.innerHTML = '';
  countEl.textContent = '';

  try {
    // ═══════ PHASE 1: Grouped daily scan ═══════
    const dates = getTradingDates(6);
    const dayMaps = await Promise.all(dates.map(fetchGroupedDaily));

    statusEl.textContent = `Phase 1: Analyzing ${Object.keys(dayMaps[0]).length}+ tickers…`;

    const candidates = [];

    // Check for inside day pattern: D1 can be 1 or 2 days before rest
    for (let offset = 0; offset < 3; offset++) {
      for (let gap = 1; gap <= 2; gap++) {
      if (offset + gap >= dates.length - 1) continue;
      const restMap = dayMaps[offset];
      const d1Map  = dayMaps[offset + gap];
      const preD1  = (offset + gap + 1 < dayMaps.length) ? dayMaps[offset + gap + 1] : null;
      const restDate = dates[offset];
      const d1Date = dates[offset + gap];
      if (!restMap || !d1Map) continue;

      for (const ticker of Object.keys(restMap)) {
        // Skip non-equities (warrants, units, options)
        if (ticker.length > 5 || ticker.includes('.') || ticker.includes('/') || ticker.includes('+')) continue;

        const rest = restMap[ticker];
        const d1 = d1Map[ticker];
        if (!rest || !d1) continue;

        // ── D1 DOLLAR VOLUME (shares × close) ──
        const d1DolVol = d1.vol * d1.close;
        const passF1Vol = d1DolVol >= 300e6; // lowered for micro-cap coverage
        const passF2Vol = d1DolVol >= 1e9;
        if (filterMode === '1' && !passF1Vol) continue;
        if (filterMode === '2' && !passF2Vol) continue;
        if (filterMode === '3' && !passF1Vol && !passF2Vol) continue;

        // ── D1 EXTENSION (D1 high vs prior day close) ──
        const preD1Bar = preD1?.[ticker];
        const d1ExtBase = preD1Bar ? preD1Bar.close : d1.open; // fallback to open if no prior day
        const d1ExtPct = d1ExtBase > 0 ? ((d1.high - d1ExtBase) / d1ExtBase) * 100 : 0;
        if (d1ExtPct < 70) continue; // D1 high must extend 70%+ from prior close
        const d1RangePct = ((d1.high - d1.low) / d1.low) * 100;
        const d1IntradayPct = ((d1.close - d1.open) / d1.open) * 100;

        // Price filter (skip sub-penny)
        if (d1ExtBase < 0.20) continue;

        // ── INSIDE DAY CHECK (rest day contained within D1 range) ──
        // Allow tolerance — real inside days sometimes have slight wick violations
        const d1Range = d1.high - d1.low;
        const lowTol  = d1Range * 0.25; // 25% of D1 range for low
        // Rest day high can be up to 2% above D1 high (micro-cap wick tolerance)
        const highTol = d1.high * 0.03;
        if (rest.high > d1.high + highTol || rest.low < d1.low - lowTol) continue;
        const isStrictInside = rest.low >= d1.low; // high is always strict now

        // ── RETRACEMENT ≤ 80% ──
        // Retracement = how much of the TOTAL MOVE (prior close → D1 high) was given back
        const totalMove = d1.high - d1ExtBase; // d1ExtBase = prior close
        const retracePct = totalMove > 0 ? ((d1.high - rest.low) / totalMove) * 100 : 0;
        if (retracePct > 85) continue;

        // ── REST DAY GAP (rest day open vs D1 close) — informational ──
        const restGapPct = ((rest.open - d1.close) / d1.close) * 100;

        // ── FILTER PASS CHECK ──
        // F1: trade day gap >= 0% (no gap down). Since trade day hasn't happened for live,
        // this will be checked in manual notes. For now pass F1 on volume only.
        const passF1 = passF1Vol;
        const passF2 = passF2Vol;
        if (filterMode === '1' && !passF1) continue;
        if (filterMode === '2' && !passF2) continue;
        if (filterMode === '3' && !passF1 && !passF2) continue;

        // ── SSR PREFILTER (daily bar) ──
        // SSR from rest day: rest low ≤ D1 close × 0.90
        // SSR from D1: D1 low ≤ prior close × 0.90 (carries into rest day)
        // SSR check — informational flag, NOT a hard filter
        const ssrFromRest = (rest.low <= d1.close * 0.95);
        const ssrFromD1 = preD1Bar ? (d1.low <= preD1Bar.close * 0.95) : false;
        const ssrPossible = ssrFromRest || ssrFromD1;
        // SSR info stored but does not filter out candidates

        // ── D1 CLOSE-TO-CLOSE ──
        const d1C2C = preD1Bar ? ((d1.close - preD1Bar.close) / preD1Bar.close * 100) : d1IntradayPct;

        // ── TRIGGER: rest day high ──
        const triggerPrice = rest.high;

        if (!isStrictInside) continue; // only show strict inside day, not NEAR
        if (candidates.find(c => c.ticker === ticker)) continue;

        candidates.push({
          ticker, d1Date, restDate, offset,
          // Trade date: the day after rest day
          tradeDate: offset > 0 ? dates[offset - 1] : null, // null = tomorrow (next trading day)
          d1DolVol, d1IntradayPct, d1C2C, d1RangePct, d1ExtPct,
          d1Open: d1.open, d1High: d1.high, d1Low: d1.low, d1Close: d1.close, d1Vol: d1.vol,
          restOpen: rest.open, restHigh: rest.high, restLow: rest.low, restClose: rest.close, restVol: rest.vol,
          isStrictInside, retracePct, restGapPct,
          ssrPossible, ssrFromRest, ssrFromD1,
          passF1, passF2,
          triggerPrice,
          idVolRatio: rest.vol / d1.vol,
        });
      }
      } // end gap loop
    }

    statusEl.textContent = `Phase 1: ${candidates.length} candidates. Phase 2: Deep checks…`;

    // ═══════ PHASE 2: Per-ticker deep checks (bags, MDR) ═══════
    const results = [];
    let checked = 0;
    for (const c of candidates) {
      checked++;
      if (checked % 5 === 0) {
        statusEl.textContent = `Phase 2: Checking ${checked}/${candidates.length}…`;
        await sleep(50);
      }

      // Fetch 70-day history for bags + MDR check
      const histFrom = new Date(c.d1Date + 'T12:00:00');
      histFrom.setDate(histFrom.getDate() - 75);
      const histTo = c.d1Date;
      let hist = [];
      try{ hist = await fetchTickerHistory(c.ticker, histFrom.toISOString().slice(0, 10), histTo); }catch(e){}
      await sleep(250);

      const d1Idx = hist.findIndex(b => b.date === c.d1Date);

      let hasBags = false;
      let bagDetails = '';
      if(hist.length>0){
        const lookback60 = hist.filter(b => {
          const diff = (new Date(c.d1Date) - new Date(b.date)) / 86400000;
          return diff > 0 && diff <= 60 && b.date !== c.d1Date;
        });
        for (const b of lookback60) {
          if (b.vol >= 100e6 && b.high > c.restOpen) { // 100M shares
            hasBags = true;
            bagDetails = `${b.date} $${(b.dolVol/1e6).toFixed(0)}M H=${b.high.toFixed(2)}`;
            break;
          }
        }
      }

      let hasMDR = false;
      let mdrDetails = '';
      if (d1Idx > 0) {
        const mdrWindow = hist.slice(Math.max(0, d1Idx - 11), d1Idx);
        for (const b of mdrWindow) {
          const movePct = ((b.high - b.low) / b.low) * 100;
          if (movePct >= 20 && b.vol >= 10e6) { // 10M+ shares traded
            hasMDR = true;
            mdrDetails = `${b.date} ${movePct.toFixed(0)}% ${(b.vol/1e6).toFixed(0)}M shares`;
            break;
          }
        }
      }

      let filterTag = [];
      const f1Pass = c.passF1 && !hasBags && !hasMDR;
      const f2Pass = c.passF2 && !hasBags && !hasMDR;

      if (f1Pass) filterTag.push('F1');
      if (f2Pass) filterTag.push('F2');

      if (filterMode === '1' && !f1Pass) continue;
      if (filterMode === '2' && !f2Pass) continue;
      if (filterMode === '3' && !f1Pass && !f2Pass) continue;

      results.push({
        ...c,
        hasBags, bagDetails,
        hasMDR, mdrDetails,
        filterTag,
        // Manual checks needed
        manualChecks: [
          '⚠ SSR: rest day must trade 10% below D1 close in RTH',
          '⚠ D1 HOD must be after 9:30 AM',
          c.passF1 && !c.passF2 ? '⚠ F1: trade day must NOT gap down' : null,
          c.passF1 && !c.passF2 ? '⚠ F1: needs PM $vol ≥ $2M' : null,
          '⚠ Trade day must NOT break D1 HOD in premarket',
          '⚠ ORB: must break rest day high between 9:35-10:30',
          '⚠ Check warrants',
        ].filter(Boolean),
      });
    }

    // Sort: freshest first, then by D1 dollar volume
    results.sort((a, b) => a.offset - b.offset || b.d1DolVol - a.d1DolVol);

    // Save results to ScanManager (builtin-idl scan)
    const activeScan = ScanManager.getActive();
    if (activeScan && activeScan.type === 'builtin') {
      activeScan.results = results;
      activeScan.resultCount = results.length;
      ScanManager.save();
      ScanManager.render();
    }

    countEl.textContent = results.length + ' found';
    if (!results.length) {
      statusEl.innerHTML = `<span style="color:#f59e0b;">0 setups passed filters.</span> ${candidates.length} candidates checked. Try F3 (Both) or wait for setups.`;
    } else {
      statusEl.innerHTML = `<span style="color:#4ade80;">${results.length} setups</span> from ${candidates.length} candidates. Click to load chart.`;
    }

    // ═══════ RENDER WATCHLIST ═══════
    wlEl.innerHTML = results.map((r, idx) => {
      const today = new Date().toISOString().slice(0,10);
      const freshTag = r.tradeDate === null
        ? '<span style="color:#4ade80;font-size:11px;font-weight:700;">● TRADE TOMORROW</span>'
        : r.tradeDate === today
        ? '<span style="color:#4ade80;font-size:11px;font-weight:700;">● TRADE TODAY</span>'
        : r.tradeDate > today
        ? '<span style="color:#4ade80;font-size:11px;font-weight:700;">● TRADE TOMORROW</span>'
        : '<span style="color:#4a6080;font-size:8px;">● traded '+r.tradeDate+'</span>';

      const fTag = r.filterTag.map(f =>
        f === 'F1' ? '<span style="background:#4ade8020;color:#4ade80;font-size:7px;padding:1px 4px;border-radius:2px;font-weight:700;">F1</span>'
                   : '<span style="background:#38bdf820;color:#38bdf8;font-size:7px;padding:1px 4px;border-radius:2px;font-weight:700;">F2</span>'
      ).join(' ');

      const strictTag = r.isStrictInside
        ? '<span style="color:#4ade80;font-size:7px;">✓ INSIDE</span>'
        : '<span style="color:#f59e0b;font-size:7px;">~ NEAR</span>';

      const ssrTag = r.ssrPossible
        ? '<span style="color:#4ade80;font-size:8px;font-weight:700;">SSR ✓</span>'
        : '<span style="color:#ef5350;font-size:8px;font-weight:700;">SSR ✗</span>';

      const d1VolStr = '$' + (r.d1DolVol / 1e6).toFixed(0) + 'M';
      const volRatioCol = r.idVolRatio < 0.5 ? '#26a69a' : r.idVolRatio < 1 ? '#f59e0b' : '#ef5350';

      const manualHtml = r.manualChecks.length
        ? '<div style="margin-top:3px;padding-top:3px;border-top:1px solid #1a2030;font-size:8px;color:#f59e0b;line-height:1.6;">' + r.manualChecks.join('<br>') + '</div>'
        : '';

      return `<div class="scan-item" data-ticker="${r.ticker}" data-trigger="${r.triggerPrice}" data-d1date="${r.d1Date}" data-restdate="${r.restDate}" style="padding:5px 6px;margin-bottom:3px;background:${idx%2===0?'#0d1220':'#101828'};border:1px solid #1e2840;border-radius:4px;cursor:pointer;transition:border-color .1s;" onmouseover="this.style.borderColor='#4ade80'" onmouseout="this.style.borderColor='#1e2840'">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
          <span style="color:#dde3f0;font-weight:800;font-size:14px;font-family:'Inter',system-ui,-apple-system,sans-serif;">${r.ticker}</span>
          <span style="display:flex;gap:4px;align-items:center;">${fTag} ${ssrTag} ${strictTag} ${freshTag}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px 8px;font-size:11px;">
          <span style="color:#6a80a0;">D1 $vol</span><span style="color:#8aa0c0;font-weight:700;">${d1VolStr}</span>
          <span style="color:#6a80a0;">D1 shares</span><span style="color:#8aa0c0;">${(r.d1Vol/1e6).toFixed(1)}M</span>
          <span style="color:#6a80a0;">D1 ext</span><span style="color:#26a69a;font-weight:700;">+${(r.d1ExtPct||0).toFixed(0)}% (HOD vs PCL)</span>
          <span style="color:#6a80a0;">D1 range</span><span style="color:#8aa0c0;">$${r.d1Low.toFixed(2)}–$${r.d1High.toFixed(2)} (${r.d1RangePct.toFixed(0)}%)</span>
          <span style="color:#6a80a0;">D1 close</span><span style="color:#8aa0c0;">$${r.d1Close.toFixed(2)}</span>
          <span style="color:#6a80a0;">Rest range</span><span style="color:#8aa0c0;">$${r.restLow.toFixed(2)}–$${r.restHigh.toFixed(2)}</span>
          <span style="color:#6a80a0;">Rest vol</span><span style="color:${volRatioCol};">${(r.idVolRatio*100).toFixed(0)}% of D1</span>
          <span style="color:#6a80a0;">Retrace</span><span style="color:${r.retracePct>60?'#f59e0b':'#26a69a'};">${r.retracePct.toFixed(0)}%</span>
          <span style="color:#6a80a0;">Gap</span><span style="color:${r.restGapPct<-5?'#ef5350':r.restGapPct<0?'#f59e0b':'#26a69a'};">${r.restGapPct>=0?'+':''}${r.restGapPct.toFixed(1)}%</span>
          <span style="color:#4ade80;font-weight:700;">▲ TRIGGER</span><span style="color:#4ade80;font-weight:800;">$${r.triggerPrice.toFixed(2)} (rest day high break)</span>
        </div>${manualHtml}
      </div>`;
    }).join('');

    // Click to load chart
    wlEl.querySelectorAll('.scan-item').forEach(el => {
      el.addEventListener('click', () => {
        const ticker = el.dataset.ticker;
        const d1date = el.dataset.d1date;
        symbol = ticker;
        document.getElementById('symbol-input').value = symbol;
        const d1 = new Date(d1date + 'T12:00:00');
        const toD = new Date(); toD.setDate(toD.getDate() + 1);
        panels.forEach((p, i) => {
          if (isIntraday(p.tf)) {
            const f = new Date(d1); f.setDate(f.getDate() - 1);
            p.startDate = fmtDate(f); p.endDate = fmtDate(toD);
          } else {
            const f = new Date(d1); f.setDate(f.getDate() - 90);
            p.startDate = fmtDate(f); p.endDate = fmtDate(toD);
          }
          document.getElementById(`from-${i}`).value = p.startDate;
          document.getElementById(`to-${i}`).value = p.endDate;
        });
        if (liveMode) setLiveMode(false);
        loadAll();
        toast(`📈 ${ticker} — trigger ▲ $${parseFloat(el.dataset.trigger).toFixed(2)}`);
        wlEl.querySelectorAll('.scan-item').forEach(e => e.style.borderColor = '#1e2840');
        el.style.borderColor = '#4ade80';
      });
    });

  } catch (err) {
    statusEl.textContent = '✗ Scan failed: ' + err.message;
    statusEl.style.color = '#ef5350';
    console.error('Scan error:', err);
  } finally {
    btn.disabled = false; btn.textContent = '▶ SCAN';
  }
}

// ══════════════════════════════════════════════════════════
//  SCAN MANAGER — Multi-scan persistence + upload
// ══════════════════════════════════════════════════════════

// API base: uses local Next.js server if available, otherwise explains
const SCAN_API = window.location.port === '3199' ? '' : (window.location.hostname === 'localhost' ? '' : null);
const SCAN_API_AVAILABLE = SCAN_API !== null;

function noBackendError(action) {
  return '<div style="padding:12px;background:#1a0a0a;border:1px solid #ef5350;border-radius:4px;">' +
    '<div style="color:#ef5350;font-weight:700;margin-bottom:6px;">⚠ No backend server running</div>' +
    '<div style="color:#8aa0c0;font-size:11px;">' + action + ' requires the Python scan server. Run locally:</div>' +
    '<code style="display:block;margin-top:6px;padding:6px;background:#0a0c12;border-radius:3px;color:#4ade80;font-size:11px;">cd ~/traderra && npx next dev --port 3199</code>' +
    '<div style="color:#8aa0c0;font-size:11px;margin-top:6px;">Then open <a href="http://localhost:3199/charts-terminal.html" style="color:#4ade80;">http://localhost:3199/charts-terminal.html</a></div>' +
    '</div>';
}
const ScanManager = {
  scans: [],          // array of { id, name, type, strategy, results, ... }
  activeId: null,     // currently selected scan ID
  activeRunId: null,  // currently selected run ID (null = all runs merged)
  _nextId: 1,
  _runsLoaded: {},    // scanId -> true if runs have been fetched from backend

  // ── Init: load from localStorage + backend ──
  async init() {
    // Load from localStorage first (fast)
    try {
      const saved = localStorage.getItem('traderra-scans');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.scans = parsed.scans || [];
        this.activeId = parsed.activeId || null;
        this.activeRunId = parsed.activeRunId || null;
        this._expandedScans = parsed._expandedScans || {};
        this._nextId = parsed._nextId || 1;
      }
    } catch(e) {}

    // Then try backend sync
    try {
      const res = await fetch((SCAN_API||'')+'/api/scans');
      if (res.ok) {
        const data = await res.json();
        // Merge: backend scans trump local, but keep local-only scans too
        const remoteIds = new Set(data.scans.map(s => s.id));
        for (const rs of data.scans) {
          // Backend list omits results — we'll load them on demand
          const existing = this.scans.find(s => s.id === rs.id);
          if (!existing) {
            this.scans.push({ ...rs, results: [], _loaded: false });
          } else {
            // Update cache metadata from backend
            existing.cachedCount = rs.cachedCount || existing.cachedCount;
            existing.cachedFrom = rs.cachedFrom || existing.cachedFrom;
            existing.cachedTo = rs.cachedTo || existing.cachedTo;
          }
        }
      }
    } catch(e) {}

    // Always have the built-in scan
    if (!this.scans.find(s => s.id === 'builtin-idl')) {
      this.scans.unshift({
        id: 'builtin-idl',
        name: 'Inside Day Long',
        type: 'builtin',
        strategy: 'inside_day_long',
        results: [],
        resultCount: 0,
        _loaded: true,
        createdAt: new Date().toISOString(),
      });
    }

    this.render();
  },

  // ── Persist to localStorage ──
  save() {
    try {
      localStorage.setItem('traderra-scans', JSON.stringify({
        scans: this.scans.map(s => ({ ...s, results: s.results || [], runs: s.runs || [] })),
        activeId: this.activeId,
        activeRunId: this.activeRunId,
        _expandedScans: this._expandedScans,
        _nextId: this._nextId,
      }));
    } catch(e) { console.warn('ScanManager save failed:', e); }
  },

  // ── Save to backend ──
  async saveToBackend(scan) {
    try {
      const res = await fetch((SCAN_API||'')+'/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: scan.id,
          name: scan.name,
          type: scan.type,
          strategy: scan.strategy || 'custom',
          code: scan.code || null,
          dateRange: scan.dateRange || null,
          filterMode: scan.filterMode || '3',
          results: scan.results || [],
          tags: scan.tags || [],
          notes: scan.notes || '',
        }),
      });
      if (res.ok) return await res.json();
    } catch(e) { console.warn('Backend save failed:', e); }
    return null;
  },

  // ── Delete from backend ──
  async deleteFromBackend(id) {
    try {
      await fetch((SCAN_API||'')+'/api/scans?id=' + encodeURIComponent(id), { method: 'DELETE' });
    } catch(e) {}
  },

  // ── Load full results from signal cache ──
  async loadResults(id) {
    const scan = this.scans.find(s => s.id === id);
    if (!scan || scan._loaded) return scan;
    try {
      // Try signal cache first (accumulated data)
      const cacheRes = await fetch((SCAN_API||'')+'/api/scans/' + encodeURIComponent(id) + '/signals');
      if (cacheRes.ok) {
        const data = await cacheRes.json();
        if (data.signals && data.signals.length > 0) {
          scan.results = data.signals;
          scan._loaded = true;
          scan.cachedCount = data.totalCached || data.signals.length;
          scan.cachedFrom = data.cachedFrom;
          scan.cachedTo = data.cachedTo;
          return scan;
        }
      }
      // Fallback: load from saved scan JSON blob
      const res = await fetch((SCAN_API||'')+'/api/scans/' + encodeURIComponent(id));
      if (res.ok) {
        const data = await res.json();
        scan.results = data.results || [];
        scan.code = data.code || scan.code;
        scan._loaded = true;
      }
    } catch(e) {}
    return scan;
  },

  // ── Generate unique ID ──
  genId() {
    return 'scan_' + Date.now().toString(36) + '_' + (this._nextId++).toString(36);
  },

  // ── Add a new scan ──
  async add({ name, type = 'imported', strategy = 'custom', code = null, results = [], dateRange = null, filterMode = '3', tags = [], notes = '' }) {
    const scan = {
      id: this.genId(),
      name: name || ('Scan ' + new Date().toLocaleDateString()),
      type, strategy, code, results, dateRange, filterMode, tags, notes,
      resultCount: results.length,
      _loaded: true,
      createdAt: new Date().toISOString(),
    };
    this.scans.push(scan);
    this.activeId = scan.id;
    this.save();
    this.render();
    // Fire-and-forget backend save
    this.saveToBackend(scan);
    return scan;
  },

  // ── Remove a scan ──
  async remove(id) {
    if (id === 'builtin-idl') return; // can't delete built-in
    this.scans = this.scans.filter(s => s.id !== id);
    if (this.activeId === id) this.activeId = this.scans.length ? this.scans[0].id : null;
    this.save();
    this.render();
    this.deleteFromBackend(id);
  },

  // ── Update scan results (e.g. after running) ──
  async updateResults(id, results) {
    const scan = this.scans.find(s => s.id === id);
    if (!scan) return;
    scan.results = results;
    scan.resultCount = results.length;
    scan._loaded = true;
    this.save();
    this.renderScanResults();
    // Update backend
    try {
      await fetch((SCAN_API||'')+'/api/scans?id=' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      });
    } catch(e) {}
  },

  // ── Rename a scan ──
  async rename(id, newName) {
    const scan = this.scans.find(s => s.id === id);
    if (!scan || !newName.trim()) return;
    scan.name = newName.trim();
    this.save();
    this.render();
    // Update active label
    if (id === this.activeId) {
      const activeLabel = document.getElementById('scan-active-label');
      const icon = scan.type === 'builtin' ? '\u{1F4E1}' : scan.type === 'code' ? '\u{1F4BB}' : scan.type === 'imported' ? '\u{1F4E4}' : '\u{1F4CA}';
      if (activeLabel) activeLabel.textContent = icon + ' ' + scan.name;
    }
    try {
      await fetch((SCAN_API||'')+'/api/scans?id=' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: scan.name }),
      });
    } catch(e) {}
  },

  // ── Cache signals to DB (UPSERT) ──
  async cacheSignals(id, signals, scannedDates) {
    try {
      const res = await fetch((SCAN_API||'')+'/api/scans/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId: id, signals, scannedDates }),
      });
      if (res.ok) {
        const data = await res.json();
        const scan = this.scans.find(s => s.id === id);
        if (scan) {
          scan.cachedCount = data.totalCached;
          // Reload from cache to get full accumulated set
          scan._loaded = false;
          await this.loadResults(id);
          this.render();
          this.renderScanResults();
        }
        return data;
      }
    } catch(e) { console.warn('Cache save failed:', e); }
    return null;
  },

  // ── Select a scan ──
  async select(id) {
    this.activeId = id;
    const scan = this.scans.find(s => s.id === id);
    if (!scan) return;

    // Load results from backend if needed
    if (!scan._loaded && scan.type !== 'builtin') {
      await this.loadResults(id);
    }

    // Show/hide run controls
    const runCtrl = document.getElementById('scan-run-controls');
    const activeLabel = document.getElementById('scan-active-label');
    if (scan) {
      runCtrl.style.display = '';
      const icon = scan.type === 'builtin' ? '📡' : scan.type === 'code' ? '💻' : scan.type === 'imported' ? '📤' : '📊';
      activeLabel.textContent = icon + ' ' + scan.name;
    } else {
      runCtrl.style.display = 'none';
    }

    this.save();
    this.render();
    this.renderScanResults();
  },

  // ── Get active scan ──
  getActive() {
    return this.scans.find(s => s.id === this.activeId) || null;
  },

  // ── Load runs for a scan from backend ──
  async loadRuns(scanId) {
    if (this._runsLoaded[scanId]) return;
    try {
      const res = await fetch((SCAN_API||'')+'/api/scans/runs?scanId=' + encodeURIComponent(scanId));
      if (res.ok) {
        const data = await res.json();
        const scan = this.scans.find(s => s.id === scanId);
        if (scan) {
          scan.runs = data.runs || [];
          this._runsLoaded[scanId] = true;
          this.render();
        }
      }
    } catch(e) { console.warn('loadRuns failed:', e); }
  },

  // ── Select a specific run (or null for all) ──
  async selectRun(runId) {
    this.activeRunId = runId;
    const scan = this.getActive();
    if (!scan) return;

    if (!runId) {
      // All runs merged — load full cache
      if (!scan._loaded && scan.type !== 'builtin') await this.loadResults(scan.id);
    } else {
      // Load signals for specific run
      try {
        const res = await fetch((SCAN_API||'')+'/api/scans/' + encodeURIComponent(scan.id) + '/signals?runId=' + encodeURIComponent(runId));
        if (res.ok) {
          const data = await res.json();
          scan.results = data.signals || [];
          scan._loaded = true;
        }
      } catch(e) { console.warn('selectRun load failed:', e); }
    }

    this.render();
    this.renderScanResults();
  },

  // ── Toggle run dropdown expanded/collapsed ──
  _expandedScans: {},
  toggleRuns(scanId) {
    this._expandedScans[scanId] = !this._expandedScans[scanId];
    if (this._expandedScans[scanId]) this.loadRuns(scanId);
    this.render();
  },

  // ── Render the scan list in the sidebar ──
  render() {
    const listEl = document.getElementById('scan-list');
    if (!listEl) return;

    const fmtShort = ds => { const p=ds.split('-'); return p[1]+'/'+p[2]; }; // MM/DD

    let html = '';
    for (const s of this.scans) {
      const isActive = s.id === this.activeId;
      const icon = s.type === 'builtin' ? '📡' : s.type === 'code' ? '💻' : s.type === 'imported' ? '📤' : '📊';
      const count = s.cachedCount || s.resultCount || (s.results ? s.results.length : 0);
      const cacheStr = s.cachedFrom && s.cachedTo ? (fmtShort(s.cachedFrom) + ' → ' + fmtShort(s.cachedTo)) : '';
      const delBtn = s.id !== 'builtin-idl' ? '<button class="scan-del" data-delid="' + s.id + '" title="Delete">×</button>' : '';
      const editBtn = s.id !== 'builtin-idl' ? '<button class="scan-edit" data-editid="' + s.id + '" title="Rename" style="background:none;border:none;color:#4a6080;font-size:11px;cursor:pointer;padding:0 1px;line-height:1;opacity:0.5;">✏️</button>' : '';

      // Runs dropdown toggle
      const runs = s.runs || [];
      const hasRuns = runs.length > 0 || (isActive && s.type !== 'builtin');
      const isExpanded = this._expandedScans[s.id];
      const expandBtn = hasRuns ? '<button class="scan-expand" data-expandid="' + s.id + '" title="Show runs" style="background:none;border:none;color:' + (isExpanded ? '#4ade80' : '#4a6080') + ';font-size:10px;cursor:pointer;padding:0 2px;line-height:1;">' + (isExpanded ? '▼' : '▶') + '</button>' : '';

      html += '<div class="scan-list-item' + (isActive ? ' active' : '') + '" data-scanid="' + s.id + '">' +
        expandBtn +
        '<span style="font-size:15px;">' + icon + '</span>' +
        '<span class="scan-name" data-nameid="' + s.id + '">' + escHtml(s.name) + '</span>' +
        '<span class="scan-meta">' + count + ' sig' + (cacheStr ? ' · ' + cacheStr : '') + '</span>' +
        '<button class="scan-share" data-shareid="' + s.id + '" title="Share" style="background:none;border:none;color:#4a6080;font-size:11px;cursor:pointer;padding:0 1px;line-height:1;opacity:0.5;" onmouseover="this.style.color=\'#3b82f6\'" onmouseout="this.style.color=\'#4a6080\'">🔗</button>' +
        editBtn + delBtn +
        '</div>';

      // Runs dropdown
      if (isExpanded && hasRuns) {
        const allActive = isActive && !this.activeRunId;
        html += '<div class="scan-run-item' + (allActive ? ' active' : '') + '" data-runid="" data-scanid="' + s.id + '" style="display:flex;align-items:center;gap:6px;padding:4px 10px 4px 28px;font-size:11px;cursor:pointer;color:' + (allActive ? '#4ade80' : '#8aa0c0') + ';border-left:2px solid ' + (isActive ? '#f59e0b' : 'transparent') + ';">' +
          '<span style="font-size:10px;">📦</span>' +
          '<span>All runs merged</span>' +
          '<span style="margin-left:auto;color:#4a6080;">' + count + '</span>' +
          '</div>';

        for (const run of runs) {
          const runActive = isActive && this.activeRunId === run.id;
          html += '<div class="scan-run-item' + (runActive ? ' active' : '') + '" data-runid="' + run.id + '" data-scanid="' + s.id + '" style="display:flex;align-items:center;gap:6px;padding:4px 10px 4px 28px;font-size:11px;cursor:pointer;color:' + (runActive ? '#4ade80' : '#8aa0c0') + ';border-left:2px solid ' + (isActive ? '#f59e0b' : 'transparent') + ';">' +
            '<span style="font-size:10px;">📄</span>' +
            '<span>' + escHtml(run.label) + '</span>' +
            '<span style="margin-left:auto;color:#4a6080;">' + run.signalCount + '</span>' +
            '</div>';
        }

        if (runs.length === 0 && this._runsLoaded[s.id]) {
          html += '<div style="padding:4px 10px 4px 28px;font-size:10px;color:#4a6080;border-left:2px solid ' + (isActive ? '#f59e0b' : 'transparent') + ';">No runs yet</div>';
        }
      }
    }
    listEl.innerHTML = html;

    // Bind click events on scan items
    listEl.querySelectorAll('.scan-list-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('scan-del') || e.target.classList.contains('scan-edit') || e.target.classList.contains('scan-expand') || e.target.classList.contains('scan-share')) return;
        ScanManager.select(el.dataset.scanid);
      });
    });

    // Bind expand buttons
    listEl.querySelectorAll('.scan-expand').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        ScanManager.toggleRuns(btn.dataset.expandid);
      });
    });

    // Bind share buttons
    listEl.querySelectorAll('.scan-share').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        shareScan(btn.dataset.shareid);
      });
    });

    // Bind run items
    listEl.querySelectorAll('.scan-run-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const runId = el.dataset.runid || null;
        const scanId = el.dataset.scanid;
        ScanManager.activeId = scanId;
        ScanManager.selectRun(runId);
      });
    });

    // Bind delete buttons
    listEl.querySelectorAll('.scan-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this scan?')) ScanManager.remove(btn.dataset.delid);
      });
    });

    // Bind edit/rename buttons
    listEl.querySelectorAll('.scan-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const scanId = btn.dataset.editid;
        const scan = ScanManager.scans.find(s => s.id === scanId);
        if (!scan) return;
        const newName = prompt('Rename scan:', scan.name);
        if (newName && newName.trim() && newName.trim() !== scan.name) {
          ScanManager.rename(scanId, newName.trim());
        }
      });
    });

    renderScanBtPanel();
  },

  // ── Render results for the active scan ──
  renderScanResults() {
    const scan = this.getActive();
    const wlEl = document.getElementById('scan-watchlist');
    const histEl = document.getElementById('scan-historical');
    const countEl = document.getElementById('scan-count');
    const statusEl = document.getElementById('scan-status');
    if (!scan || !wlEl) return;

    const results = scan.results || [];
    countEl.textContent = results.length + ' signals';
    statusEl.textContent = results.length ? (scan.name + ' — ' + results.length + ' results') : 'No results yet';

    if (results.length === 0) {
      wlEl.innerHTML = '';
      renderScanBtPanel();
      return;
    }

    // ── Spreadsheet-style table renderer ──
    // Collect all unique keys across all signals, in smart order
    const priorityKeys = ['ticker', 'date', 'c', 'o', 'h', 'l', 'v', 'pct_change', 'pct_chg', 'changePct',
      'gap_20', 'gap_30', 'gap_50', 'gap_100', 'gap_pct', 'gap_atr', 'gap_cont_30',
      'range', 'close_range', 'atr', 'rvol', 'dol_v',
      'ema9', 'ema20', 'ema50', 'ema200',
      'dist_h_9ema_atr', 'dist_h_20ema_atr', 'dist_h_50ema_atr', 'dist_h_200ema_atr',
      'dist_l_9ema_atr', 'dist_l_20ema_atr', 'dist_l_50ema_atr', 'dist_l_200ema_atr',
      'triggerPrice', 'd1DolVol', 'd1ExtPct', 'retracePct', 'idVolRatio',
      'ssrPossible', 'isStrictInside'];
    const skipKeys = new Set(['filterTag', 'v_ua', 'o_ua', 'c_ua', 'h_ua', 'l_ua']);
    // Build ordered column list
    const seenKeys = new Set();
    const columns = [];
    // Priority keys first (if present in any signal)
    for (const k of priorityKeys) {
      if (results.some(r => r[k] != null)) { columns.push(k); seenKeys.add(k); }
    }
    // Then remaining keys in order of first appearance
    for (const r of results) {
      for (const k of Object.keys(r)) {
        if (!seenKeys.has(k) && !skipKeys.has(k) && r[k] != null && typeof r[k] !== 'object') {
          columns.push(k); seenKeys.add(k);
        }
      }
    }

    // ── Evaluate custom formula columns ──
    const _customColsAll = JSON.parse(localStorage.getItem('traderra-scan-custom-cols') || '{}');
    const scanCustomCols = _customColsAll[scan.id] || [];
    for (const cc of scanCustomCols) {
      try {
        const fn = new Function('row', 'return (' + cc.formula + ')');
        for (const r of results) {
          try { r[cc.key] = fn(r); } catch(e) { r[cc.key] = null; }
        }
        if (!seenKeys.has(cc.key)) { columns.push(cc.key); seenKeys.add(cc.key); }
      } catch(e) { console.warn('Custom column parse error:', cc.name, e); }
    }

    // ── Filter columns by user prefs ──
    const _colPrefsKey = 'traderra-scan-cols';
    let _hiddenCols = new Set();
    try { const _p = JSON.parse(localStorage.getItem(_colPrefsKey)); if (_p && _p[scan.name]) _hiddenCols = new Set(_p[scan.name]); } catch {}
    // Custom columns are visible by default (not hidden unless explicitly hidden)
    const visibleCols = columns.filter(c => !_hiddenCols.has(c));
    // Always show ticker
    if (visibleCols.length === 0 && columns.length > 0) visibleCols.push(columns[0]);

    // Column label overrides
    const colLabels = {
      ticker: 'Ticker', date: 'D0', d1Date: 'D1', restDate: 'D0', c: 'Close', o: 'Open', h: 'High', l: 'Low', v: 'Vol',
      pct_change: 'Chg%', pct_chg: 'Chg%', changePct: 'Chg%',
      gap_20: 'Gap$20', gap_30: 'Gap$30', gap_50: 'Gap$50', gap_100: 'Gap$100',
      gap_pct: 'Gap%', gap_atr: 'GapATR', gap_cont_30: 'GapC30',
      range: 'Range$', close_range: 'CloseRng', atr: 'ATR', rvol: 'RVol', dol_v: '$Vol',
      triggerPrice: 'Trigger', d1DolVol: 'D1$Vol', d1ExtPct: 'D1Ext%', retracePct: 'Retrace%',
      idVolRatio: 'IDVolR', ssrPossible: 'SSR', isStrictInside: 'Inside',
    };

    // Custom column format map
    const customColFormats = {};
    for (const cc of scanCustomCols) customColFormats[cc.key] = cc;

    // Format a cell value with color
    function fmtCell(key, val) {
      if (val == null) return '';
      let text, color = '#8aa0c0';
      if (typeof val === 'number') {
        if (key === 'ticker') { text = val; }
        else if (key === 'ssrPossible' || key === 'isStrictInside') { text = val ? '✓' : '✗'; color = val ? '#4ade80' : '#ef5350'; }
        else if (key.startsWith('pct_') || key.endsWith('Pct') || key === 'changePct' || key === 'gap_pct' || key === 'close_range') {
          text = (val >= 0 ? '+' : '') + val.toFixed(1) + '%'; color = val >= 0 ? '#26a69a' : '#ef5350';
        }
        else if (key.startsWith('gap_') || key === 'range' || key === 'atr' || key === 'triggerPrice') { text = '$' + val.toFixed(2); }
        else if (key === 'v' || key === 'volume' || key === 'd1DolVol' || key === 'dol_v') {
          text = val > 1e9 ? (val/1e9).toFixed(1)+'B' : val > 1e6 ? (val/1e6).toFixed(0)+'M' : val > 1e3 ? (val/1e3).toFixed(0)+'K' : Math.round(val).toString();
          if (key === 'dol_v' || key === 'd1DolVol') text = '$' + text;
        }
        else if (key === 'rvol') { text = val.toFixed(1) + 'x'; color = val > 2 ? '#26a69a' : '#8aa0c0'; }
        else if (key.startsWith('ema')) { text = '$' + val.toFixed(2); color = '#4a6080'; }
        else if (key.includes('dist_')) { text = val.toFixed(2); color = val > 0 ? '#26a69a' : '#ef5350'; }
        else if (key.startsWith('highest_') || key.startsWith('lowest_')) { text = '$' + val.toFixed(2); color = '#4a6080'; }
        else { text = Number.isInteger(val) ? String(val) : val.toFixed(2); }
      } else if (typeof val === 'string') {
        text = val.length > 16 ? val.slice(0,16) : val;
        if (key === 'date' || key === 'd1Date' || key === 'restDate') { const p=val.slice(0,10).split('-'); text = p[1]+'/'+p[2]+'/'+p[0]; color = '#4a6080'; }
      } else { text = String(val); }
      return '<span style="color:' + color + ';">' + escHtml(String(text)) + '</span>';
    }

    // Build the table
    const tableId = 'scan-results-table';
    let html = '<div style="position:relative;overflow:auto;max-height:calc(100vh - 220px);border:1px solid #1e2840;border-radius:4px;">';
    html += '<table id="' + tableId + '" style="border-collapse:separate;border-spacing:0;width:max-content;min-width:100%;font-size:13px;font-family:\'Inter\',system-ui,sans-serif;">';

    // Header row (frozen)
    html += '<thead style="position:sticky;top:0;z-index:10;"><tr>';
    for (const col of visibleCols) {
      const label = colLabels[col] || col;
      const isTicker = col === 'ticker';
      const width = isTicker ? '70' : (col === 'date' || col === 'd1Date' || col === 'restDate') ? '80' : (col.startsWith('dist_') || col.startsWith('highest_') || col.startsWith('lowest_')) ? '80' : '65';
      html += '<th style="position:sticky;top:0;padding:5px 6px;background:#0f1524;border-bottom:2px solid #2a3050;color:' + (isTicker ? '#4ade80' : '#5a7090') + ';font-weight:700;font-size:11px;white-space:nowrap;text-align:' + (isTicker ? 'left' : 'right') + ';min-width:' + width + 'px;cursor:pointer;user-select:none;" data-col="' + escHtml(col) + '" title="' + escHtml(col) + '">' + escHtml(label) + '</th>';
    }
    html += '</tr></thead>';

    // Body rows
    html += '<tbody>';
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const ticker = r.ticker || '';
      const sigDate = String(r.date || r.d1Date || r.restDate || '').slice(0,10);
      html += '<tr class="scan-row" data-ticker="' + escHtml(ticker) + '" data-sigdate="' + escHtml(sigDate) + '" style="cursor:pointer;transition:background .08s;" onmouseover="this.style.background=\'#111a28\'" onmouseout="this.style.background=\'' + (i % 2 === 0 ? '#0a0e18' : '#0d1220') + '\'">';
      for (const col of visibleCols) {
        const val = r[col];
        const isTicker = col === 'ticker';
        const bg = i % 2 === 0 ? '#0a0e18' : '#0d1220';
        html += '<td style="padding:4px 6px;border-bottom:1px solid #111820;white-space:nowrap;text-align:' + (isTicker ? 'left' : 'right') + ';font-weight:' + (isTicker ? '800' : '400') + ';color:' + (isTicker ? '#dde3f0' : 'inherit') + ';">' + fmtCell(col, val) + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    wlEl.innerHTML = html;

    // Click row → load chart
    wlEl.querySelectorAll('.scan-row').forEach(el => {
      el.addEventListener('click', () => {
        const ticker = el.dataset.ticker;
        const sigDate = el.dataset.sigdate;
        if (!ticker) return;
        symbol = ticker;
        document.getElementById('symbol-input').value = symbol;
        if (sigDate) {
          const d = new Date(sigDate + 'T12:00:00');
          // End date = signal date + 1 (so the signal bar is visible at the right edge)
          const toD = new Date(d); toD.setDate(toD.getDate() + 1);
          panels.forEach((p, i) => {
            if (isIntraday(p.tf)) {
              const f = new Date(d); f.setDate(f.getDate() - 3);
              p.startDate = fmtDate(f); p.endDate = fmtDate(toD);
            } else {
              const f = new Date(d); f.setDate(f.getDate() - 90);
              p.startDate = fmtDate(f); p.endDate = fmtDate(toD);
            }
            document.getElementById('from-' + i).value = p.startDate;
            document.getElementById('to-' + i).value = p.endDate;
          });
        }
        if (liveMode) setLiveMode(false);
        loadAll();
        toast('📈 ' + ticker);
        // Highlight selected row
        wlEl.querySelectorAll('.scan-row').forEach(e => { e.style.background = ''; e.style.outline = 'none'; });
        el.style.outline = '1px solid #4ade80';
        el.style.background = '#0f1a14';
      });
    });

    renderScanBtPanel();
  },
};

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Scan → BT tab (saved scans backtest MVP) ──
const SCAN_BT_CFG_KEY = 'traderra-scan-bt-cfg';
const scanBtState = { running:false, trades:[], summary:null, lastLabel:'', error:'', errorScanId:null };
const scanBtBarCache = {};

function scanBtLoadCfg() {
  try {
    return Object.assign({ side:'long', entry:'next_open', stop:'signal', stopPct:5, targetR:2, holdDays:5, risk:1000 }, JSON.parse(localStorage.getItem(SCAN_BT_CFG_KEY) || '{}'));
  } catch {
    return { side:'long', entry:'next_open', stop:'signal', stopPct:5, targetR:2, holdDays:5, risk:1000 };
  }
}
function scanBtSaveCfg(cfg) {
  try { localStorage.setItem(SCAN_BT_CFG_KEY, JSON.stringify(cfg)); } catch {}
}
function scanBtCurrentCfg() {
  return {
    side: document.getElementById('scan-bt-side')?.value || 'long',
    entry: document.getElementById('scan-bt-entry')?.value || 'next_open',
    stop: document.getElementById('scan-bt-stop')?.value || 'signal',
    stopPct: Math.max(0.1, parseFloat(document.getElementById('scan-bt-stop-pct')?.value || '5') || 5),
    targetR: Math.max(0, parseFloat(document.getElementById('scan-bt-target-r')?.value || '2') || 0),
    holdDays: Math.max(1, parseInt(document.getElementById('scan-bt-hold-days')?.value || '5', 10) || 5),
    risk: Math.max(1, parseFloat(document.getElementById('scan-bt-risk')?.value || '1000') || 1000),
  };
}
function scanBtApplyCfg(cfg) {
  if (document.getElementById('scan-bt-side')) document.getElementById('scan-bt-side').value = cfg.side || 'long';
  if (document.getElementById('scan-bt-entry')) document.getElementById('scan-bt-entry').value = cfg.entry || 'next_open';
  if (document.getElementById('scan-bt-stop')) document.getElementById('scan-bt-stop').value = cfg.stop || 'signal';
  if (document.getElementById('scan-bt-stop-pct')) document.getElementById('scan-bt-stop-pct').value = cfg.stopPct ?? 5;
  if (document.getElementById('scan-bt-target-r')) document.getElementById('scan-bt-target-r').value = cfg.targetR ?? 2;
  if (document.getElementById('scan-bt-hold-days')) document.getElementById('scan-bt-hold-days').value = cfg.holdDays ?? 5;
  if (document.getElementById('scan-bt-risk')) document.getElementById('scan-bt-risk').value = cfg.risk ?? 1000;
  scanBtSyncStopPct();
}
function scanBtSyncStopPct() {
  const mode = document.getElementById('scan-bt-stop')?.value || 'signal';
  const el = document.getElementById('scan-bt-stop-pct');
  if (!el) return;
  el.disabled = mode !== 'pct';
  el.style.opacity = mode === 'pct' ? '1' : '0.45';
  el.style.borderColor = mode === 'pct' ? '#f59e0b' : '#2a3050';
  el.style.color = mode === 'pct' ? '#f59e0b' : '#6a80a0';
}
function scanBtMetric(label, value, color) {
  return '<div style="background:#0a0c12;border:1px solid #1e2840;border-radius:4px;padding:7px 8px;">' +
    '<div style="font-size:9px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:3px;">' + escHtml(label) + '</div>' +
    '<div style="font-size:13px;font-weight:800;color:' + (color || '#dde3f0') + ';">' + escHtml(String(value)) + '</div>' +
    '</div>';
}
function scanBtFormatMoney(n) {
  if (!Number.isFinite(n)) return '—';
  return (n >= 0 ? '+' : '-') + '$' + Math.abs(n).toFixed(2);
}
function scanBtFormatR(n) {
  if (!Number.isFinite(n)) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + 'R';
}
function scanBtDaysBetween(a, b) {
  return Math.max(0, Math.round((new Date(String(b).slice(0,10) + 'T12:00:00Z') - new Date(String(a).slice(0,10) + 'T12:00:00Z')) / 86400000));
}
function scanBtAddDays(dateStr, days) {
  const d = new Date(String(dateStr).slice(0,10) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
}
function scanBtInferScanType(scan) {
  const t = ((scan?.name || '') + ' ' + (scan?.strategy || '')).toLowerCase();
  return /(short|mdr|backside|fade|red)/.test(t) ? 'short' : 'long';
}
function scanBtPickText(row, keys) {
  for (const key of keys) {
    const val = row?.[key];
    if (val == null) continue;
    const text = String(val).trim();
    if (text) return text;
  }
  return '';
}
function scanBtPickNum(row, keys) {
  for (const key of keys) {
    const val = row?.[key];
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (Number.isFinite(num)) return num;
  }
  return null;
}
function scanBtTicker(row) {
  return scanBtPickText(row, ['ticker', 'symbol', 'Ticker', 'Symbol']).toUpperCase();
}
function scanBtSetupDate(row) {
  return scanBtPickText(row, ['restDate', 'date', 'signalDate', 'signal_date', 'd0Date', 'd1Date']).slice(0,10);
}
function scanBtAnchorDate(row) {
  return scanBtPickText(row, ['tradeDate', 'entryDate', 'entry_date']).slice(0,10);
}
function scanBtTriggerPrice(row, side, setupBar) {
  if (side === 'short') return scanBtPickNum(row, ['triggerPrice', 'entryPrice', 'entry_price', 'breakdownPrice', 'restLow', 'l', 'low', 'c', 'close']) ?? setupBar?.low ?? setupBar?.close ?? null;
  return scanBtPickNum(row, ['triggerPrice', 'entryPrice', 'entry_price', 'breakoutPrice', 'restHigh', 'h', 'high', 'c', 'close']) ?? setupBar?.high ?? setupBar?.close ?? null;
}
function scanBtResolveStop(row, side, entryPrice, cfg) {
  const pctStop = cfg.stopPct > 0 ? (side === 'short' ? entryPrice * (1 + cfg.stopPct / 100) : entryPrice * (1 - cfg.stopPct / 100)) : null;
  if (cfg.stop === 'pct') return pctStop;
  if (side === 'short') return scanBtPickNum(row, ['stop', 'stopPrice', 'stop_price', 'restHigh', 'h', 'high']) ?? pctStop;
  return scanBtPickNum(row, ['stop', 'stopPrice', 'stop_price', 'restLow', 'l', 'low']) ?? pctStop;
}
async function scanBtFetchDailySeries(ticker, from, to) {
  const key = [ticker, from, to].join('|');
  if (scanBtBarCache[key]) return scanBtBarCache[key];
  const url = `${POLY}/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${API_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Polygon ' + res.status);
    const data = await res.json();
    const bars = (data.results || []).map(b => ({
      date: new Date(b.t).toISOString().slice(0,10),
      open: b.o, high: b.h, low: b.l, close: b.c, vol: b.v,
    }));
    scanBtBarCache[key] = bars;
    return bars;
  } catch (e) {
    console.warn('BT series fetch failed:', ticker, from, to, e);
    scanBtBarCache[key] = [];
    return [];
  }
}
function scanBtRenderSummary() {
  const el = document.getElementById('scan-bt-summary');
  if (!el) return;
  const scan = ScanManager.getActive();
  const summary = scanBtState.summary && scan && scanBtState.summary.scanId === scan.id ? scanBtState.summary : null;
  if (!summary) {
    el.innerHTML = scanBtMetric('TRADES', '—') +
      scanBtMetric('WIN RATE', '—') +
      scanBtMetric('TOTAL PNL', '—') +
      scanBtMetric('TOTAL R', '—') +
      scanBtMetric('EXPECT', '—') +
      scanBtMetric('AVG HOLD', '—');
    return;
  }
  el.innerHTML = scanBtMetric('TRADES', summary.tradeCount + ' / ' + summary.signalCount, '#f59e0b') +
    scanBtMetric('WIN RATE', summary.winRate, summary.winPct >= 50 ? '#26a69a' : '#ef5350') +
    scanBtMetric('TOTAL PNL', scanBtFormatMoney(summary.totalPnl), summary.totalPnl >= 0 ? '#26a69a' : '#ef5350') +
    scanBtMetric('TOTAL R', scanBtFormatR(summary.totalR), summary.totalR >= 0 ? '#26a69a' : '#ef5350') +
    scanBtMetric('EXPECT', scanBtFormatR(summary.expectancy), summary.expectancy >= 0 ? '#26a69a' : '#ef5350') +
    scanBtMetric('AVG HOLD', summary.avgHold + 'd', '#38bdf8');
}
function renderScanBtPanel() {
  const activeEl = document.getElementById('scan-bt-active');
  const statusEl = document.getElementById('scan-bt-status');
  const runBtn = document.getElementById('scan-bt-run-btn');
  const reviewBtn = document.getElementById('scan-bt-review-btn');
  if (!activeEl || !statusEl || !runBtn || !reviewBtn) return;
  const scan = ScanManager.getActive();
  const cfg = scanBtCurrentCfg();
  if (!scan) {
    activeEl.innerHTML = 'No active scan selected.';
    statusEl.textContent = 'Pick a saved scan in SCAN first.';
    runBtn.disabled = true;
    runBtn.style.opacity = '0.45';
    reviewBtn.disabled = !scanBtState.trades.length;
    reviewBtn.style.opacity = scanBtState.trades.length ? '1' : '0.45';
    scanBtRenderSummary();
    return;
  }
  const count = (scan.results || []).length;
  activeEl.innerHTML = '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">' +
    '<div><div style="font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;">ACTIVE SCAN</div><div style="font-size:12px;color:#dde3f0;font-weight:800;">' + escHtml(scan.name) + '</div></div>' +
    '<div style="font-size:11px;color:' + (count ? '#4ade80' : '#6a80a0') + ';font-weight:800;white-space:nowrap;">' + count + ' sig</div>' +
    '</div>' +
    '<div style="margin-top:6px;font-size:10px;color:#4a6080;line-height:1.5;">' +
      'Mode: <span style="color:' + (cfg.side === 'short' ? '#ef5350' : '#26a69a') + ';font-weight:700;">' + escHtml(cfg.side.toUpperCase()) + '</span>' +
      ' · Entry: <span style="color:#dde3f0;">' + escHtml(cfg.entry.replace(/_/g, ' ')) + '</span>' +
      ' · Exit: <span style="color:#dde3f0;">' + escHtml((cfg.targetR > 0 ? cfg.targetR + 'R / ' : '') + cfg.holdDays + 'd max') + '</span>' +
    '</div>';
  if (scanBtState.running) {
    runBtn.disabled = true;
    runBtn.textContent = '⏳ RUNNING…';
    runBtn.style.opacity = '0.8';
  } else {
    runBtn.disabled = count === 0;
    runBtn.textContent = '▶ RUN BT';
    runBtn.style.opacity = count === 0 ? '0.45' : '1';
  }
  reviewBtn.disabled = !scanBtState.trades.length;
  reviewBtn.style.opacity = scanBtState.trades.length ? '1' : '0.45';
  if (!scanBtState.running && scanBtState.error && scanBtState.errorScanId === scan.id) {
    statusEl.innerHTML = scanBtState.error;
  } else if (!scanBtState.running && (!scanBtState.summary || scanBtState.summary.scanId !== scan.id)) {
    statusEl.textContent = count ? 'Ready. Runs daily-bar backtest from saved scan results.' : 'This scan has no loaded results yet.';
  }
  scanBtRenderSummary();
}
function scanBtSimulateTrade(signal, bars, cfg) {
  const side = cfg.side;
  const setupDate = scanBtSetupDate(signal);
  const setupIdx = bars.findIndex(b => b.date === setupDate);
  if (setupIdx < 0) return { skip:'Missing setup bar' };
  const setupBar = bars[setupIdx];
  const anchorDate = scanBtAnchorDate(signal);
  let entryIdx = -1;
  let entryPrice = null;
  let entryReason = cfg.entry;

  if (cfg.entry === 'signal_close') {
    entryIdx = setupIdx;
    entryPrice = scanBtPickNum(signal, ['c', 'close', 'entryPrice', 'entry_price']) ?? setupBar.close ?? null;
  } else if (cfg.entry === 'next_open') {
    entryIdx = anchorDate ? bars.findIndex(b => b.date === anchorDate) : (setupIdx + 1);
    if (entryIdx < 0) entryIdx = setupIdx + 1;
    const bar = bars[entryIdx];
    if (!bar) return { skip:'No next trade day' };
    entryPrice = bar.open;
  } else {
    entryIdx = anchorDate ? bars.findIndex(b => b.date === anchorDate) : (setupIdx + 1);
    if (entryIdx < 0) entryIdx = setupIdx + 1;
    const bar = bars[entryIdx];
    if (!bar) return { skip:'No trigger day' };
    const trigger = scanBtTriggerPrice(signal, side, setupBar);
    if (!Number.isFinite(trigger) || trigger <= 0) return { skip:'No trigger price' };
    if (side === 'short') {
      if (bar.low > trigger) return { skip:'No trigger fill' };
      entryPrice = bar.open < trigger ? bar.open : trigger;
    } else {
      if (bar.high < trigger) return { skip:'No trigger fill' };
      entryPrice = bar.open > trigger ? bar.open : trigger;
    }
    entryReason = 'trigger';
  }

  const entryBar = bars[entryIdx];
  if (!entryBar || !Number.isFinite(entryPrice) || entryPrice <= 0) return { skip:'Invalid entry' };

  const stopPrice = scanBtResolveStop(signal, side, entryPrice, cfg);
  if (!Number.isFinite(stopPrice) || stopPrice <= 0) return { skip:'Invalid stop' };

  const riskPerShare = side === 'short' ? (stopPrice - entryPrice) : (entryPrice - stopPrice);
  if (!Number.isFinite(riskPerShare) || riskPerShare <= 0) return { skip:'Bad R distance' };

  const shares = Math.floor(cfg.risk / riskPerShare);
  if (!Number.isFinite(shares) || shares < 1) return { skip:'Risk too small' };

  const targetPrice = cfg.targetR > 0 ? (side === 'short' ? (entryPrice - riskPerShare * cfg.targetR) : (entryPrice + riskPerShare * cfg.targetR)) : null;
  const checkStart = cfg.entry === 'signal_close' ? entryIdx + 1 : entryIdx;
  const finalIdx = Math.min(bars.length - 1, entryIdx + Math.max(1, cfg.holdDays) - 1);
  if (checkStart > bars.length - 1) return { skip:'No exit bars' };

  let exitIdx = Math.max(checkStart, entryIdx);
  let exitPrice = bars[Math.min(finalIdx, bars.length - 1)]?.close ?? entryBar.close;
  let exitReason = 'time';

  for (let i = Math.max(checkStart, entryIdx); i <= finalIdx; i++) {
    const bar = bars[i];
    if (!bar) break;
    const hitStop = side === 'short' ? bar.high >= stopPrice : bar.low <= stopPrice;
    const hitTarget = Number.isFinite(targetPrice) && (side === 'short' ? bar.low <= targetPrice : bar.high >= targetPrice);
    if (hitStop && hitTarget) {
      exitIdx = i;
      exitPrice = stopPrice;
      exitReason = 'stop';
      break;
    }
    if (hitStop) {
      exitIdx = i;
      exitPrice = stopPrice;
      exitReason = 'stop';
      break;
    }
    if (hitTarget) {
      exitIdx = i;
      exitPrice = targetPrice;
      exitReason = 'target';
      break;
    }
    exitIdx = i;
    exitPrice = bar.close;
  }

  const pnl = side === 'short' ? (entryPrice - exitPrice) * shares : (exitPrice - entryPrice) * shares;
  const riskDollars = riskPerShare * shares;
  const entryIso = entryBar.date + 'T09:30:00Z';
  const exitBar = bars[exitIdx] || entryBar;
  const exitIso = exitBar.date + 'T15:55:00Z';

  return {
    date: entryBar.date,
    ticker: scanBtTicker(signal),
    pnl,
    entries: [{ time: Date.parse(entryIso), price: entryPrice, shares, reason: entryReason, stop: stopPrice }],
    exits: [{ time: Date.parse(exitIso), price: exitPrice, shares, reason: exitReason }],
    avg_entry: entryPrice,
    avg_exit: exitPrice,
    shares,
    entry_time: entryIso,
    exit_time: exitIso,
    exit_reason: exitReason,
    R_pnl: riskDollars > 0 ? pnl / riskDollars : 0,
    _setupDate: setupDate,
    _holdDays: scanBtDaysBetween(entryBar.date, exitBar.date),
  };
}
async function runScanBtBacktest() {
  const statusEl = document.getElementById('scan-bt-status');
  const scan = ScanManager.getActive();
  if (!scan || !statusEl) return;
  if (!scan._loaded && scan.type !== 'builtin') await ScanManager.loadResults(scan.id);
  const results = Array.isArray(scan.results) ? scan.results : [];
  if (!results.length) {
    statusEl.textContent = 'No saved results on this scan yet.';
    renderScanBtPanel();
    return;
  }

  const cfg = scanBtCurrentCfg();
  scanBtSaveCfg(cfg);
  scanBtState.running = true;
  scanBtState.summary = null;
  scanBtState.error = '';
  scanBtState.errorScanId = null;
  renderScanBtPanel();

  try {
    const signals = results.map(row => ({ row, ticker: scanBtTicker(row), setupDate: scanBtSetupDate(row), anchorDate: scanBtAnchorDate(row) }))
      .filter(x => x.ticker && x.setupDate);
    if (!signals.length) throw new Error('No rows with ticker + signal date');

    const ranges = {};
    for (const sig of signals) {
      const start = scanBtAddDays(sig.setupDate, -10);
      const endBase = sig.anchorDate || sig.setupDate;
      const end = scanBtAddDays(endBase, cfg.holdDays + 10);
      if (!ranges[sig.ticker]) ranges[sig.ticker] = { from:start, to:end };
      if (start < ranges[sig.ticker].from) ranges[sig.ticker].from = start;
      if (end > ranges[sig.ticker].to) ranges[sig.ticker].to = end;
    }

    const seriesByTicker = {};
    const tickers = Object.keys(ranges);
    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      statusEl.textContent = `Fetching daily bars ${i + 1}/${tickers.length} — ${ticker}`;
      const r = ranges[ticker];
      seriesByTicker[ticker] = await scanBtFetchDailySeries(ticker, r.from, r.to);
      if ((i + 1) % 8 === 0) await sleep(75);
    }

    const trades = [];
    const skipped = {};
    for (let i = 0; i < signals.length; i++) {
      const sig = signals[i];
      if ((i + 1) % 20 === 0 || i === signals.length - 1) statusEl.textContent = `Simulating ${i + 1}/${signals.length} signals…`;
      const bars = seriesByTicker[sig.ticker] || [];
      const trade = scanBtSimulateTrade(sig.row, bars, cfg);
      if (trade.skip) skipped[trade.skip] = (skipped[trade.skip] || 0) + 1;
      else trades.push(trade);
      if ((i + 1) % 30 === 0) await sleep(0);
    }

    const stats = btStats(trades);
    const totalR = trades.reduce((sum, t) => sum + (t.R_pnl || 0), 0);
    const avgHold = trades.length ? (trades.reduce((sum, t) => sum + (t._holdDays || 0), 0) / trades.length) : 0;
    const skippedCount = Object.values(skipped).reduce((sum, n) => sum + n, 0);
    scanBtState.trades = trades;
    scanBtState.lastLabel = scan.name + ' · ' + cfg.side.toUpperCase() + ' · ' + cfg.entry.replace(/_/g, ' ');
    scanBtState.summary = {
      scanId: scan.id,
      signalCount: signals.length,
      tradeCount: trades.length,
      skippedCount,
      totalPnl: stats.total,
      totalR,
      expectancy: trades.length ? totalR / trades.length : 0,
      avgHold: avgHold.toFixed(1),
      winRate: stats.wr,
      winPct: trades.length ? (trades.filter(t => t.pnl > 0).length / trades.length) * 100 : 0,
      skipped,
    };

    scanBtState.error = '';
    scanBtState.errorScanId = null;
    renderScanBtPanel();
    const skipBits = Object.entries(skipped).sort((a,b) => b[1] - a[1]).slice(0,3).map(([k,v]) => `${v} ${k}`).join(' · ');
    statusEl.innerHTML = '<span style="color:#f59e0b;font-weight:800;">' + trades.length + '</span> trades from <span style="color:#dde3f0;font-weight:700;">' + signals.length + '</span> signals' +
      ' · <span style="color:' + (stats.total >= 0 ? '#26a69a' : '#ef5350') + ';font-weight:800;">' + escHtml(scanBtFormatMoney(stats.total)) + '</span>' +
      ' · <span style="color:' + (totalR >= 0 ? '#26a69a' : '#ef5350') + ';font-weight:800;">' + escHtml(scanBtFormatR(totalR)) + '</span>' +
      (skipBits ? ' · <span style="color:#4a6080;">' + escHtml(skipBits) + '</span>' : '');

    if (trades.length) {
      loadBtTradesIntoReview(trades, scanBtState.lastLabel, 'simulated from saved scan results');
      openBtSidebar();
      toast(`BT ready — ${trades.length} trades`);
    } else {
      toast('BT finished — no trades met the rules', true);
    }
  } catch (e) {
    console.error('Scan BT failed:', e);
    scanBtState.error = '<span style="color:#ef5350;">✗ ' + escHtml(e.message || String(e)) + '</span>';
    scanBtState.errorScanId = scan.id;
    statusEl.innerHTML = scanBtState.error;
    scanBtState.trades = [];
    scanBtState.summary = null;
  } finally {
    scanBtState.running = false;
    renderScanBtPanel();
  }
}
function initScanBtControls() {
  scanBtApplyCfg(scanBtLoadCfg());
  ['scan-bt-side','scan-bt-entry','scan-bt-stop','scan-bt-stop-pct','scan-bt-target-r','scan-bt-hold-days','scan-bt-risk'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const ev = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      scanBtSyncStopPct();
      scanBtSaveCfg(scanBtCurrentCfg());
      renderScanBtPanel();
    });
  });
  const runBtn = document.getElementById('scan-bt-run-btn');
  if (runBtn) runBtn.addEventListener('click', runScanBtBacktest);
  const reviewBtn = document.getElementById('scan-bt-review-btn');
  if (reviewBtn) reviewBtn.addEventListener('click', () => {
    if (scanBtState.trades.length) loadBtTradesIntoReview(scanBtState.trades, scanBtState.lastLabel || 'Simulated trades', 'scan BT');
    openBtSidebar();
  });
  renderScanBtPanel();
}
initScanBtControls();

// ═══════════════════════════════════════════════════════════════
// STRATEGY LAB — Research notebook for strategy development
// ═══════════════════════════════════════════════════════════════
const LabAPI = (SCAN_API || '');
const LAB_USE_LOCAL = !SCAN_API_AVAILABLE;  // fallback to localStorage when no backend
const LAB_STORAGE_KEY = 'traderra-lab-projects';
const LAB_ENTRIES_KEY = 'traderra-lab-entries';

// ── Authenticated fetch helper ──
async function authFetch(url, opts = {}) {
  if (!opts.headers) opts.headers = {};
  Object.assign(opts.headers, { 'Content-Type': 'application/json', ...authHeaders() });
  return fetch(url, opts);
}

// ── Strategy Lab localStorage helpers (fallback when no backend) ──
function labLocalLoad(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function labLocalSave(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) { console.warn('Lab localStorage full:', e); }
}
function labLocalProjects() { return labLocalLoad(LAB_STORAGE_KEY) || []; }
function labLocalEntries() { return labLocalLoad(LAB_ENTRIES_KEY) || []; }

// ═══════════════════════════════════════════════════════════════
// AUTH — Auto device-login for charts terminal
// ═══════════════════════════════════════════════════════════════
const AUTH_KEY = 'traderra-auth-token';
const AUTH_USER_KEY = 'traderra-auth-user';
let _authToken = null;
let _authUser = null;

// Clean up old device user tokens
localStorage.removeItem(AUTH_KEY);
localStorage.removeItem(AUTH_USER_KEY);

async function authInit() {
  // Try cookie-based session (from GitHub/Google/Email sign-in on the main app)
  try {
    const res = await fetch((SCAN_API||'') + '/api/get-current-user-id', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.userId) {
        _authUser = { id: data.userId, email: data.email, name: data.name, image: data.image };
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(_authUser));
        console.log('[authInit] Signed in as:', data.name || data.email);
        return;
      }
    }
  } catch {}

  // No real session — chart works without auth, just no cloud saves
  console.log('[authInit] No session found — running unauthenticated');
}

function authHeaders() {
  return _authToken ? { 'Authorization': 'Bearer ' + _authToken } : {};
}

// ═══════════════════════════════════════════════════════════════
// TAB STATE PERSISTENCE — remember active tab + scroll + selections
// ═══════════════════════════════════════════════════════════════
const TAB_STATE_KEY = 'traderra-tab-state';
function saveTabState() {
  const state = {
    activeTab: document.querySelector('.sb-tab.active')?.dataset?.tab || null,
    scanActiveId: ScanManager.activeId,
    scanActiveRunId: ScanManager.activeRunId,
    labProjectId: StrategyLab.activeProjectId,
    labPhaseId: StrategyLab.activePhaseId,
    savedAt: Date.now(),
  };
  localStorage.setItem(TAB_STATE_KEY, JSON.stringify(state));
}
function loadTabState() {
  try { return JSON.parse(localStorage.getItem(TAB_STATE_KEY)) || {}; } catch { return {}; }
}

const StrategyLab = {
  projects: [],
  activeProjectId: null,
  activePhaseId: null,
  _loaded: false,

  async init() {
    await this.loadProjects();
    this.render();
    this.bindGlobal();
  },

  async loadProjects() {
    if (LAB_USE_LOCAL) {
      this.projects = labLocalProjects();
      this._loaded = true;
      return;
    }
    try {
      const res = await authFetch(LabAPI + '/api/lab/projects');
      if (res.ok) {
        const data = await res.json();
        this.projects = data.projects || [];
        this._loaded = true;
      }
    } catch(e) { console.warn('Lab loadProjects failed:', e); }
  },

  async createProject(name, type) {
    const id = 'lab_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6);
    const defaultPhases = [
      { id: id + '_scan', phase: 'scan', label: 'Scan', order: 0, _count: { entries: 0 } },
      { id: id + '_setup', phase: 'setup', label: 'Setup', order: 1, _count: { entries: 0 } },
      { id: id + '_entry', phase: 'entry', label: 'Entry', order: 2, _count: { entries: 0 } },
      { id: id + '_exit', phase: 'exit', label: 'Exit', order: 3, _count: { entries: 0 } },
      { id: id + '_bt', phase: 'backtest', label: 'Backtest', order: 4, _count: { entries: 0 } },
    ];
    const project = {
      id, name, description: '', type: type || 'setup', status: 'idea',
      tags: '[]', linkedScanId: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      phases: defaultPhases, _count: { entries: 0, phases: 5 },
    };

    if (LAB_USE_LOCAL) {
      this.projects.unshift(project);
      labLocalSave(LAB_STORAGE_KEY, this.projects);
      this.activeProjectId = project.id;
      this.activePhaseId = defaultPhases[0].id;
      this.render();
      return project;
    }

    try {
      const res = await authFetch(LabAPI + '/api/lab/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: type || 'setup' }),
      });
      if (res.ok) {
        const data = await res.json();
        this.projects.unshift(data.project);
        this.activeProjectId = data.project.id;
        this.activePhaseId = data.project.phases[0]?.id || null;
        this.render();
        return data.project;
      }
    } catch(e) { console.warn('Lab createProject failed:', e); }
    return null;
  },

  async deleteProject(id) {
    if (LAB_USE_LOCAL) {
      // Also delete entries for this project
      const entries = labLocalEntries().filter(e => e.projectId !== id);
      labLocalSave(LAB_ENTRIES_KEY, entries);
    } else {
      try { await authFetch(LabAPI + '/api/lab/projects?id=' + encodeURIComponent(id), { method: 'DELETE' }); } catch(e) {}
    }
    this.projects = this.projects.filter(p => p.id !== id);
    if (this.activeProjectId === id) { this.activeProjectId = null; this.activePhaseId = null; }
    if (LAB_USE_LOCAL) labLocalSave(LAB_STORAGE_KEY, this.projects);
    this.render();
  },

  async updateProject(id, data) {
    const p = this.projects.find(p => p.id === id);
    if (p) Object.assign(p, data);
    if (LAB_USE_LOCAL) labLocalSave(LAB_STORAGE_KEY, this.projects);
    if (!LAB_USE_LOCAL) {
      try {
        await authFetch(LabAPI + '/api/lab/projects?id=' + encodeURIComponent(id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch(e) { console.warn('Lab updateProject failed:', e); }
    }
    this.render();
  },

  getActive() {
    return this.projects.find(p => p.id === this.activeProjectId) || null;
  },

  // ── Entries ──

  async loadEntries(projectId, phaseId) {
    if (LAB_USE_LOCAL) {
      let entries = labLocalEntries().filter(e => e.projectId === projectId);
      if (phaseId) entries = entries.filter(e => e.phaseId === phaseId);
      return entries;
    }
    try {
      let url = LabAPI + '/api/lab/projects/entries?projectId=' + encodeURIComponent(projectId);
      if (phaseId) url += '&phaseId=' + encodeURIComponent(phaseId);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return data.entries || [];
      }
    } catch(e) { console.warn('Lab loadEntries failed:', e); }
    return [];
  },

  async addEntry(entry) {
    if (LAB_USE_LOCAL) {
      const newEntry = {
        id: 'le_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6),
        ...entry,
        meta: entry.meta || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const entries = labLocalEntries();
      entries.unshift(newEntry);
      labLocalSave(LAB_ENTRIES_KEY, entries);
      // Update project entry count
      const p = this.projects.find(p => p.id === entry.projectId);
      if (p) { p._count = p._count || {}; p._count.entries = (p._count.entries || 0) + 1; labLocalSave(LAB_STORAGE_KEY, this.projects); }
      return newEntry;
    }
    try {
      const res = await authFetch(LabAPI + '/api/lab/projects/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (res.ok) {
        const data = await res.json();
        return data.entry;
      }
    } catch(e) { console.warn('Lab addEntry failed:', e); }
    return null;
  },

  async deleteEntry(id) {
    if (LAB_USE_LOCAL) {
      let entries = labLocalEntries().filter(e => e.id !== id && e.parentId !== id);
      labLocalSave(LAB_ENTRIES_KEY, entries);
    } else {
      try { await authFetch(LabAPI + '/api/lab/projects/entries?id=' + encodeURIComponent(id), { method: 'DELETE' }); } catch(e) {}
    }
  },

  async updateEntry(id, data) {
    if (LAB_USE_LOCAL) {
      const entries = labLocalEntries();
      const idx = entries.findIndex(e => e.id === id);
      if (idx >= 0) { Object.assign(entries[idx], data); labLocalSave(LAB_ENTRIES_KEY, entries); }
    } else {
      try {
        await authFetch(LabAPI + '/api/lab/projects/entries?id=' + encodeURIComponent(id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch(e) { console.warn('Lab updateEntry failed:', e); }
    }
  },

  // ── Capture screenshot from chart canvas ──

  captureScreenshot() {
    try {
      // Use the actual chart canvas from panels[0]
      const p = typeof panels !== 'undefined' ? panels[0] : null;
      if (!p || !p.canvas) { console.warn('No chart panel found'); return null; }
      return p.canvas.toDataURL('image/png', 0.85);
    } catch(e) { console.warn('Screenshot capture failed:', e); return null; }
  },

  // ── Render ──

  render() {
    const listEl = document.getElementById('lab-projects-list');
    const detailEl = document.getElementById('lab-project-detail');
    if (!listEl || !detailEl) return;

    if (this.activeProjectId) {
      listEl.style.display = 'none';
      detailEl.style.display = '';
      this.renderDetail();
    } else {
      listEl.style.display = '';
      detailEl.style.display = 'none';
      this.renderProjectList();
    }
  },

  renderProjectList() {
    const listEl = document.getElementById('lab-projects-list');
    if (!listEl) return;

    if (this.projects.length === 0) {
      listEl.innerHTML = '<div style="padding:10px 14px;font-size:11px;color:#4a6080;">No strategy projects yet. Click + NEW to start.</div>';
      return;
    }

    const statusColors = {
      idea: '#4a6080', developing: '#fbbf24', testing: '#38bdf8', validated: '#4ade80', retired: '#6b7280'
    };
    const typeLabels = { scan: 'Scan', setup: 'Setup', strategy: 'Strategy' };

    listEl.innerHTML = this.projects.map(p => {
      const entryCount = p._count?.entries || 0;
      const phaseCount = p._count?.phases || 5;
      const sc = statusColors[p.status] || '#4a6080';
      const tl = typeLabels[p.type] || p.type;
      return '<div class="lab-project-item" data-pid="' + p.id + '" style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;border-bottom:1px solid #111820;transition:background .1s;" onmouseover="this.style.background=\'#111820\'" onmouseout="this.style.background=\'transparent\'">' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:12px;font-weight:700;color:#dde3f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(p.name) + '</div>' +
          '<div style="font-size:10px;color:#4a6080;">' + tl + ' · ' + entryCount + ' entries</div>' +
        '</div>' +
        '<span style="font-size:9px;padding:2px 6px;border-radius:2px;background:' + sc + '22;color:' + sc + ';font-weight:700;text-transform:uppercase;">' + p.status + '</span>' +
        '<button class="lab-del-project" data-delid="' + p.id + '" style="background:none;border:none;color:#4a6080;font-size:12px;cursor:pointer;opacity:0.5;" title="Delete">✕</button>' +
      '</div>';
    }).join('');

    // Bind clicks
    listEl.querySelectorAll('.lab-project-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('lab-del-project')) return;
        StrategyLab.activeProjectId = el.dataset.pid;
        const p = StrategyLab.getActive();
        StrategyLab.activePhaseId = p?.phases?.[0]?.id || null;
        StrategyLab.render();
      });
    });
    listEl.querySelectorAll('.lab-del-project').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this project and all entries?')) StrategyLab.deleteProject(btn.dataset.delid);
      });
    });
  },

  async renderDetail() {
    const project = this.getActive();
    if (!project) return;

    // Header
    const titleEl = document.getElementById('lab-project-title');
    const statusEl = document.getElementById('lab-project-status');
    const statusColors = { idea: '#4a6080', developing: '#fbbf24', testing: '#38bdf8', validated: '#4ade80', retired: '#6b7280' };
    if (titleEl) titleEl.textContent = project.name;
    if (statusEl) {
      const sc = statusColors[project.status] || '#4a6080';
      const typeLabels = { setup: 'Setup', scan: 'Scan', strategy: 'Strategy' };
      statusEl.textContent = (typeLabels[project.type] || project.type) + ' · ' + project.status;
      statusEl.style.background = sc + '22';
      statusEl.style.color = sc;
    }

    // Phase tabs
    const phaseTabs = document.getElementById('lab-phase-tabs');
    if (phaseTabs && project.phases) {
      const phaseIcons = { scan: '📡', setup: '🎯', entry: '🚀', exit: '🏁', backtest: '📊' };
      phaseTabs.innerHTML = project.phases.map(ph => {
        const active = ph.id === this.activePhaseId;
        const icon = phaseIcons[ph.phase] || '📁';
        return '<div class="lab-phase-tab" data-phaseid="' + ph.id + '" style="padding:6px 10px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;border-bottom:2px solid ' + (active ? '#c084fc' : 'transparent') + ';color:' + (active ? '#c084fc' : '#4a6080') + ';">' + icon + ' ' + escHtml(ph.label || ph.phase.toUpperCase()) + ' <span style="color:#4a6080;">(' + (ph._count?.entries || 0) + ')</span></div>';
      }).join('');

      phaseTabs.querySelectorAll('.lab-phase-tab').forEach(el => {
        el.addEventListener('click', () => {
          StrategyLab.activePhaseId = el.dataset.phaseid;
          StrategyLab.renderDetail();
        });
      });
    }

    // Linked scan signals browser
    const entriesEl = document.getElementById('lab-entries');
    if (!entriesEl) return;
    entriesEl.innerHTML = '';

    if (project.linkedScanId) {
      const linkedScan = ScanManager.scans.find(s => s.id === project.linkedScanId);
      if (linkedScan && linkedScan.results && linkedScan.results.length > 0) {
        let scanHtml = '<div style="padding:6px 8px;background:#0a0c12;border:1px solid #c084fc33;border-radius:4px;margin-bottom:8px;">';
        scanHtml += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">';
        scanHtml += '<span style="font-size:10px;color:#c084fc;font-weight:800;">📡 LINKED SCAN: ' + escHtml(linkedScan.name) + '</span>';
        scanHtml += '<span style="flex:1"></span>';
        scanHtml += '<span style="font-size:9px;color:#4a6080;">' + linkedScan.results.length + ' signals · click to load chart</span>';
        scanHtml += '</div>';
        scanHtml += '<div style="display:flex;flex-wrap:wrap;gap:3px;max-height:80px;overflow-y:auto;">';
        for (const r of linkedScan.results.slice(0, 50)) {
          const ticker = r.ticker || r.symbol || '?';
          const date = String(r.date || r.restDate || '').slice(0,10);
          scanHtml += '<div class="lab-scan-sig" data-ticker="' + escHtml(ticker) + '" data-date="' + escHtml(date) + '" style="padding:2px 6px;background:#141926;border:1px solid #1e2840;border-radius:3px;font-size:10px;color:#dde3f0;font-weight:700;cursor:pointer;transition:background .1s;" onmouseover="this.style.background=\'#1e2840\'" onmouseout="this.style.background=\'#141926\'">' + escHtml(ticker) + '</div>';
        }
        if (linkedScan.results.length > 50) scanHtml += '<span style="font-size:9px;color:#4a6080;padding:2px;">+' + (linkedScan.results.length - 50) + ' more</span>';
        scanHtml += '</div></div>';
        entriesEl.innerHTML += scanHtml;

        // Bind signal clicks — load ticker on chart
        entriesEl.querySelectorAll('.lab-scan-sig').forEach(el => {
          el.addEventListener('click', () => {
            const ticker = el.dataset.ticker;
            const date = el.dataset.date;
            if (ticker) {
              const symInput = document.getElementById('symbol-input');
              if (symInput) { symInput.value = ticker.toUpperCase(); symInput.dispatchEvent(new Event('change')); }
            }
          });
        });
      } else if (linkedScan && (!linkedScan.results || linkedScan.results.length === 0)) {
        entriesEl.innerHTML += '<div style="padding:6px 8px;background:#0a0c12;border:1px solid #c084fc33;border-radius:4px;margin-bottom:8px;"><span style="font-size:10px;color:#c084fc;font-weight:800;">📡 LINKED: ' + escHtml(linkedScan.name) + '</span> <span style="font-size:10px;color:#4a6080;">— click SCAN tab to load results first</span></div>';
      }
    }

    // Show loading indicator (but preserve inline editor if open)
    const hasInlineEditor = !!document.getElementById('lab-inline-editor');
    if (!hasInlineEditor) {
      entriesEl.innerHTML = '<div style="text-align:center;padding:10px;color:#4a6080;font-size:11px;">Loading entries...</div>';
    }

    let entries = [];
    try {
      entries = await this.loadEntries(project.id, this.activePhaseId);
    } catch(e) { console.warn('loadEntries error:', e); }

    if (entries.length === 0) {
      const inlineEditor = document.getElementById('lab-inline-editor');
      entriesEl.innerHTML = (inlineEditor ? inlineEditor.outerHTML : '') + '<div style="text-align:center;padding:20px;color:#4a6080;font-size:11px;">No entries yet. Use + Note or 💡 Idea to get started.</div>';
      return;
    }

    entriesEl.innerHTML = entries.map(e => {
      const typeLabels2 = { screenshot: 'Screenshot', note: 'Note', idea: 'Idea', comment: 'Comment', scan_result: 'Scan Result', backtest_result: 'Backtest' };
      const typeLabel = typeLabels2[e.type] || e.type;
      const timeAgo = this._timeAgo(new Date(e.createdAt));
      let body = '';

      if (e.imageData) {
        body += '<div style="margin:4px 0;border-radius:4px;overflow:hidden;border:1px solid #1e2840;"><img src="' + e.imageData + '" style="width:100%;display:block;max-height:180px;object-fit:contain;background:#0a0c12;cursor:pointer;" data-lab-img="' + e.id + '" class="lab-img-preview" /></div>';
      }

      if (e.body) {
        const preview = e.body.length > 200 ? e.body.slice(0, 200) + '…' : e.body;
        body += '<div style="font-size:11px;color:#8aa0c0;line-height:1.5;padding:4px 0;white-space:pre-wrap;">' + escHtml(preview) + '</div>';
      }

      if (e.meta) {
        const meta = typeof e.meta === 'string' ? JSON.parse(e.meta) : e.meta;
        if (meta?.ticker) body += '<div style="font-size:10px;color:#4a6080;">📊 ' + escHtml(meta.ticker) + (meta.date ? ' · ' + meta.date : '') + '</div>';
      }

      return '<div style="padding:8px 10px;background:#0d1220;border:1px solid #1e2840;border-radius:4px;" data-eid="' + e.id + '">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">' +
          '<span style="font-size:10px;font-weight:700;color:#c084fc;text-transform:uppercase;letter-spacing:.5px;">' + typeLabel + '</span>' +
          '<span class="lab-entry-title" data-eid="' + e.id + '" style="font-size:11px;font-weight:700;color:#dde3f0;flex:1;cursor:text;" title="Click to rename">' + escHtml(e.title || e.type) + '</span>' +
          '<span style="font-size:9px;color:#4a6080;">' + timeAgo + '</span>' +
          '<button class="lab-del-entry" data-delid="' + e.id + '" style="background:none;border:none;color:#4a6080;font-size:10px;cursor:pointer;opacity:0.4;" title="Delete">✕</button>' +
        '</div>' +
        body +
      '</div>';
    }).join('');

    // Bind delete
    entriesEl.querySelectorAll('.lab-del-entry').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this entry?')) {
          StrategyLab.deleteEntry(btn.dataset.delid).then(() => StrategyLab.renderDetail());
        }
      });
    });

    // Bind rename on entry titles (click to edit inline)
    entriesEl.querySelectorAll('.lab-entry-title').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const eid = el.dataset.eid;
        const current = el.textContent;
        el.contentEditable = true;
        el.focus();
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const finish = () => {
          el.contentEditable = false;
          const newTitle = el.textContent.trim();
          if (newTitle && newTitle !== current) {
            StrategyLab.updateEntry(eid, { title: newTitle });
          } else {
            el.textContent = current;
          }
        };
        el.addEventListener('blur', finish, { once: true });
        el.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
          if (ev.key === 'Escape') { el.textContent = current; el.blur(); }
        });
      });
    });
  },

  _timeAgo(date) {
    const s = Math.floor((Date.now() - date.getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    if (s < 604800) return Math.floor(s/86400) + 'd ago';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  // ── Global bindings ──

  bindGlobal() {
    const addBtn = document.getElementById('lab-add-project');
    if (addBtn) addBtn.addEventListener('click', () => this._showCreateModal());

    const backBtn = document.getElementById('lab-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => {
      this.activeProjectId = null;
      this.activePhaseId = null;
      this.loadProjects().then(() => this.render());
    });

    const captureBtn = document.getElementById('lab-capture-btn');
    if (captureBtn) captureBtn.addEventListener('click', () => {
      const project = this.getActive();
      if (!project) return;
      const imageData = this.captureScreenshot();
      if (!imageData) return;
      const meta = {};
      try { const t = document.getElementById('symbol-input')?.value; if (t) meta.ticker = t.toUpperCase(); } catch(e) {}
      this._showEntryModal(project, 'screenshot', meta, imageData);
    });

    const noteBtn = document.getElementById('lab-add-note-btn');
    if (noteBtn) noteBtn.addEventListener('click', () => {
      const project = this.getActive();
      if (project) this._showInlineEditor(project, 'note');
    });

    const linkScanBtn = document.getElementById('lab-link-scan-btn');
    if (linkScanBtn) linkScanBtn.addEventListener('click', () => {
      const project = this.getActive();
      if (project) this._showLinkScanModal(project);
    });

    const ideaBtn = document.getElementById('lab-add-idea-btn');
    if (ideaBtn) ideaBtn.addEventListener('click', () => {
      const project = this.getActive();
      if (project) this._showInlineEditor(project, 'idea');
    });

    const titleEl = document.getElementById('lab-project-title');
    if (titleEl) titleEl.addEventListener('dblclick', () => {
      const project = this.getActive();
      if (!project) return;
      const newName = prompt('Rename project:', project.name);
      if (newName && newName.trim() && newName.trim() !== project.name) {
        this.updateProject(project.id, { name: newName.trim() });
      }
    });
  },

  _modalStyle() { return 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2001;background:rgba(0,0,0,.6);backdrop-filter:blur(2px);'; },
  _boxStyle() { return 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2002;background:#141926;border:1px solid #2a3050;border-radius:8px;padding:16px 18px;min-width:320px;max-width:440px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.6);'; },
  _inputStyle() { return 'width:100%;background:#0a0c12;border:1px solid #2a3050;color:#dde3f0;font-size:12px;padding:8px 10px;border-radius:4px;outline:none;font-family:Inter,system-ui,sans-serif;'; },
  _labelStyle() { return 'font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:4px;'; },
  _btnPrimary() { return 'background:#c084fc;color:#000;border:none;font-size:11px;font-weight:800;padding:7px 14px;border-radius:4px;cursor:pointer;'; },
  _btnGhost() { return 'background:none;border:1px solid #2a3050;color:#8aa0c0;font-size:11px;font-weight:700;padding:7px 14px;border-radius:4px;cursor:pointer;'; },
  _closeModal() { document.getElementById('lab-modal-overlay')?.remove(); document.getElementById('lab-modal-box')?.remove(); },

  _showInlineEditor(project, type) {
    const entriesEl = document.getElementById('lab-entries');
    if (!entriesEl) return;

    // Remove any existing inline editor
    const existing = document.getElementById('lab-inline-editor');
    if (existing) existing.remove();

    const isIdea = type === 'idea';
    const typeLbl = isIdea ? 'IDEA' : 'NOTE';
    const ph = isIdea ? 'Quick idea...' : 'Write your note...';
    const accent = isIdea ? '#fbbf24' : '#8aa0c0';

    const editorHtml =
      '<div id="lab-inline-editor" style="padding:10px;background:#0a0c12;border:1px solid ' + accent + '33;border-radius:4px;">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">' +
          '<span style="font-size:10px;font-weight:700;color:#c084fc;text-transform:uppercase;letter-spacing:.5px;">' + typeLbl + '</span>' +
          '<input id="lab-inline-title" placeholder="Title" value="' + (isIdea ? 'Idea' : 'Note') + '" style="flex:1;background:transparent;border:none;color:#dde3f0;font-size:12px;font-weight:700;outline:none;padding:0;" />' +
          '<button id="lab-inline-cancel" style="background:none;border:none;color:#4a6080;font-size:12px;cursor:pointer;padding:2px 4px;">✕</button>' +
        '</div>' +
        '<textarea id="lab-inline-body" rows="3" placeholder="' + ph + '" style="width:100%;background:transparent;border:none;color:' + accent + ';font-size:11px;line-height:1.5;outline:none;resize:vertical;min-height:60px;font-family:Inter,system-ui,sans-serif;"></textarea>' +
        '<div id="lab-inline-screenshot-area" style="display:none;margin-top:6px;border-radius:4px;overflow:hidden;border:1px solid #1e2840;position:relative;">' +
          '<img id="lab-inline-screenshot-img" src="" style="width:100%;display:block;max-height:120px;object-fit:contain;background:#0a0c12;" />' +
          '<button id="lab-inline-screenshot-remove" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.7);border:none;color:#f87171;font-size:12px;cursor:pointer;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;">X</button>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">' +
          '<button id="lab-inline-screenshot-btn" style="background:none;border:1px solid #2a3050;color:#8aa0c0;font-size:10px;font-weight:700;padding:3px 8px;border-radius:3px;cursor:pointer;">Attach Screenshot</button>' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span style="font-size:9px;color:#4a6080;">Ctrl+Enter to save</span>' +
            '<button id="lab-inline-save" style="background:' + accent + ';color:#000;border:none;font-size:10px;font-weight:800;padding:4px 10px;border-radius:3px;cursor:pointer;">Save</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Insert at top of entries
    entriesEl.insertAdjacentHTML('afterbegin', editorHtml);

    const remove = () => document.getElementById('lab-inline-editor')?.remove();
    const save = async () => {
      const title = document.getElementById('lab-inline-title').value.trim();
      const body = document.getElementById('lab-inline-body').value.trim();
      const screenshotData = document.getElementById('lab-inline-screenshot-img')?.src || null;
      const hasScreenshot = screenshotData && !screenshotData.includes('about:blank');
      if (!body && !hasScreenshot) { remove(); return; }
      remove();
      try {
        await this.addEntry({
          projectId: project.id,
          phaseId: this.activePhaseId,
          type,
          title: title || (isIdea ? 'Idea' : 'Note'),
          body: body || null,
          imageData: hasScreenshot ? screenshotData : null,
        });
      } catch(e) { console.warn('Save failed:', e); }
      this.renderDetail();
    };

    document.getElementById('lab-inline-cancel').onclick = remove;
    document.getElementById('lab-inline-save').onclick = save;
    // Screenshot attach button
    const ssBtn = document.getElementById('lab-inline-screenshot-btn');
    if (ssBtn) ssBtn.addEventListener('click', () => {
      const imageData = this.captureScreenshot();
      if (!imageData) return;
      const area = document.getElementById('lab-inline-screenshot-area');
      const img = document.getElementById('lab-inline-screenshot-img');
      if (area && img) { img.src = imageData; area.style.display = ''; }
    });
    const ssRemove = document.getElementById('lab-inline-screenshot-remove');
    if (ssRemove) ssRemove.addEventListener('click', () => {
      const area = document.getElementById('lab-inline-screenshot-area');
      const img = document.getElementById('lab-inline-screenshot-img');
      if (area && img) { img.src = ''; area.style.display = 'none'; }
    });

    // Ctrl+Enter to save, Escape to cancel
    document.getElementById('lab-inline-body').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
      if (e.key === 'Escape') remove();
    });

    // Auto-focus body, auto-resize textarea
    const ta = document.getElementById('lab-inline-body');
    if (ta) {
      ta.focus();
      ta.addEventListener('input', () => {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
      });
    }
  },

  _showCreateModal() {
    this._closeModal();
    const scans = ScanManager.scans.filter(s => s.id !== 'builtin-idl' && s.type !== 'builtin');
    const scanOpts = scans.length > 0
      ? scans.map(s => '<option value="' + s.id + '">' + escHtml(s.name) + ' (' + (s.cachedCount||s.resultCount||0) + ' sig)</option>').join('')
      : '<option value="">No saved scans yet</option>';

    const html =
      '<div id="lab-modal-overlay" style="' + this._modalStyle() + '"></div>' +
      '<div id="lab-modal-box" style="' + this._boxStyle() + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
          '<span style="color:#c084fc;font-weight:800;font-size:14px;">🔬 New Strategy Project</span>' +
          '<button id="lab-modal-close" style="background:none;border:none;color:#5a7090;font-size:18px;cursor:pointer;">×</button>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
          '<div><div style="' + this._labelStyle() + '">PROJECT NAME</div>' +
            '<input id="lab-modal-name" placeholder="e.g. VWAP Fade Setup" style="' + this._inputStyle() + '" /></div>' +
          '<div><div style="' + this._labelStyle() + '">TYPE</div>' +
            '<select id="lab-modal-type" style="' + this._inputStyle() + '"><option value="setup">Setup</option><option value="scan">Scan</option><option value="strategy">Strategy</option></select></div>' +
          '<div><div style="' + this._labelStyle() + '">LINK TO SCAN (optional)</div>' +
            '<select id="lab-modal-scan" style="' + this._inputStyle() + '"><option value="">— None —</option>' + scanOpts + '</select></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">' +
          '<button id="lab-modal-cancel" style="' + this._btnGhost() + '">Cancel</button>' +
          '<button id="lab-modal-create" style="' + this._btnPrimary() + '">Create Project</button>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
    const close = () => this._closeModal();
    document.getElementById('lab-modal-overlay').onclick = close;
    document.getElementById('lab-modal-close').onclick = close;
    document.getElementById('lab-modal-cancel').onclick = close;
    document.getElementById('lab-modal-create').onclick = () => {
      const name = document.getElementById('lab-modal-name').value.trim();
      if (!name) return;
      const type = document.getElementById('lab-modal-type').value;
      const scanId = document.getElementById('lab-modal-scan').value || null;
      close();
      this.createProject(name, type).then(p => {
        if (p && scanId) this.updateProject(p.id, { linkedScanId: scanId });
        this.render();
      });
    };
    document.getElementById('lab-modal-name').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('lab-modal-create').click(); });
    setTimeout(() => document.getElementById('lab-modal-name')?.focus(), 100);
  },

  _showEntryModal(project, type, meta, imageData) {
    this._closeModal();
    const cfg = {
      screenshot: { title:'Add Screenshot', ph:'Chart capture', bodyPh:'Notes about this setup...', bodyReq:false },
      note: { title:'Add Note', ph:'Note', bodyPh:'Write your observations, rules, criteria...', bodyReq:true },
      idea: { title:'Add Idea', ph:'Idea', bodyPh:'What if...', bodyReq:true },
    }[type] || { title:'Add Entry', ph:'Entry', bodyPh:'', bodyReq:true };

    const html =
      '<div id="lab-modal-overlay" style="' + this._modalStyle() + '"></div>' +
      '<div id="lab-modal-box" style="' + this._boxStyle() + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
          '<span style="color:#c084fc;font-weight:800;font-size:14px;">' + cfg.title + '</span>' +
          '<button id="lab-modal-close" style="background:none;border:none;color:#5a7090;font-size:18px;cursor:pointer;">×</button>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
          '<div><div style="' + this._labelStyle() + '">TITLE</div><input id="lab-modal-title" value="' + escHtml(cfg.ph) + '" style="' + this._inputStyle() + '" /></div>' +
          '<div><div style="' + this._labelStyle() + '">BODY</div><textarea id="lab-modal-body" rows="4" placeholder="' + cfg.bodyPh + '" style="' + this._inputStyle() + 'min-height:80px;resize:vertical;font-family:Inter,system-ui,sans-serif;"></textarea></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">' +
          '<button id="lab-modal-cancel" style="' + this._btnGhost() + '">Cancel</button>' +
          '<button id="lab-modal-save" style="' + this._btnPrimary() + '">Save</button>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
    const close = () => this._closeModal();
    document.getElementById('lab-modal-overlay').onclick = close;
    document.getElementById('lab-modal-close').onclick = close;
    document.getElementById('lab-modal-cancel').onclick = close;
    document.getElementById('lab-modal-save').onclick = () => {
      const title = document.getElementById('lab-modal-title').value.trim();
      const body = document.getElementById('lab-modal-body')?.value?.trim() || '';
      if (cfg.bodyReq && !body) return;
      close();
      this.addEntry({ projectId: project.id, phaseId: this.activePhaseId, type, title: title || cfg.ph, body: body || null, imageData: imageData || null, meta: meta || null }).then(() => this.renderDetail());
    };
    setTimeout(() => document.getElementById(cfg.bodyReq ? 'lab-modal-body' : 'lab-modal-title')?.focus(), 100);
  },

  _showLinkScanModal(project) {
    this._closeModal();
    const scans = ScanManager.scans.filter(s => s.id !== 'builtin-idl' && s.type !== 'builtin');
    if (!scans.length) {
      const html = '<div id="lab-modal-overlay" style="' + this._modalStyle() + '"></div><div id="lab-modal-box" style="' + this._boxStyle() + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><span style="color:#c084fc;font-weight:800;font-size:14px;">🔗 Link Scan</span><button id="lab-modal-close" style="background:none;border:none;color:#5a7090;font-size:18px;cursor:pointer;">×</button></div>' +
        '<div style="font-size:12px;color:#8aa0c0;padding:10px 0;">No saved scans yet. Run a scan first, then link it here.</div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:10px;"><button id="lab-modal-cancel" style="' + this._btnGhost() + '">OK</button></div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      const close = () => this._closeModal();
      document.getElementById('lab-modal-overlay').onclick = close;
      document.getElementById('lab-modal-close').onclick = close;
      document.getElementById('lab-modal-cancel').onclick = close;
      return;
    }

    const items = scans.map(s => {
      const count = s.cachedCount || s.resultCount || 0;
      const active = s.id === project.linkedScanId;
      return '<div class="lab-scan-pick" data-sid="' + s.id + '" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:' + (active ? '#c084fc15' : '#0a0c12') + ';border:1px solid ' + (active ? '#c084fc55' : '#1e2840') + ';border-radius:4px;cursor:pointer;margin-bottom:4px;">' +
        '<span style="font-size:10px;font-weight:700;color:#8aa0c0;text-transform:uppercase;">' + (s.type==='code'?'Code':'Import') + '</span>' +
        '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:700;color:#dde3f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(s.name) + '</div>' +
        '<div style="font-size:10px;color:#4a6080;">' + count + ' signals</div></div>' +
        (active ? '<span style="font-size:10px;color:#c084fc;font-weight:700;">LINKED</span>' : '') +
      '</div>';
    }).join('');

    const html = '<div id="lab-modal-overlay" style="' + this._modalStyle() + '"></div><div id="lab-modal-box" style="' + this._boxStyle() + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><span style="color:#c084fc;font-weight:800;font-size:14px;">🔗 Link Scan</span><button id="lab-modal-close" style="background:none;border:none;color:#5a7090;font-size:18px;cursor:pointer;">×</button></div>' +
      '<div style="font-size:11px;color:#4a6080;margin-bottom:8px;">Click a scan to link it to this project.</div>' +
      '<div style="max-height:250px;overflow-y:auto;">' + items + '</div>' +
      (project.linkedScanId ? '<button id="lab-modal-unlink" style="' + this._btnGhost() + 'margin-top:8px;width:100%;color:#f87171;border-color:#f8717133;">Unlink current scan</button>' : '') +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;"><button id="lab-modal-cancel" style="' + this._btnGhost() + '">Close</button></div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    const close = () => this._closeModal();
    document.getElementById('lab-modal-overlay').onclick = close;
    document.getElementById('lab-modal-close').onclick = close;
    document.getElementById('lab-modal-cancel').onclick = close;
    document.querySelectorAll('.lab-scan-pick').forEach(el => {
      el.addEventListener('click', () => { const sid = el.dataset.sid; close(); this.updateProject(project.id, { linkedScanId: sid }).then(() => this.renderDetail()); });
    });
    const unlinkBtn = document.getElementById('lab-modal-unlink');
    if (unlinkBtn) unlinkBtn.addEventListener('click', () => { close(); this.updateProject(project.id, { linkedScanId: null }).then(() => this.renderDetail()); });
  },
};

// Init on page load
// Init auth first, then lab
authInit().then(() => StrategyLab.init());

// ── Restore tab state ──
setTimeout(() => {
  const ts = loadTabState();
  if (ts.activeTab) {
    sbTab(ts.activeTab);
  }
  if (ts.scanActiveId) {
    ScanManager.select(ts.scanActiveId);
  }
  if (ts.labProjectId && StrategyLab.projects.find(p => p.id === ts.labProjectId)) {
    StrategyLab.activeProjectId = ts.labProjectId;
    StrategyLab.activePhaseId = ts.labPhaseId || null;
    if (ts.activeTab === 'lab') StrategyLab.render();
  }
}, 500);

// Auto-save tab state on key interactions
document.getElementById('scan-list')?.addEventListener('click', () => setTimeout(saveTabState, 100));
window.addEventListener('beforeunload', saveTabState);

// Image preview click handler for Strategy Lab screenshots
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('lab-img-preview')) {
    const eid = e.target.dataset.labImg;
    if (!eid) return;
    const project = StrategyLab.getActive();
    if (!project) return;
    StrategyLab.loadEntries(project.id, StrategyLab.activePhaseId).then(entries => {
      const entry = entries.find(x => x.id === eid);
      if (entry && entry.imageData) {
        const w = window.open('', '_blank');
        if (w) w.document.write('<html><head><title>Screenshot</title><style>body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;}</style></head><body><img src="' + entry.imageData + '" style="max-width:100%;max-height:100vh;"></body></html>');
      }
    });
  }
});

// ── Scan panel toggle ──
let scanMode='live'; // 'live' or 'historical'
document.getElementById('scan-btn').addEventListener('click',()=>{
  sbOpen('scan');
  ScanManager.init(); // ensure loaded
});
var _scnClose=document.getElementById('scan-close');if(_scnClose)_scnClose.addEventListener('click',()=>{sbClose();});

// ── + button opens add modal ──
document.getElementById('scan-add-btn').addEventListener('click', () => {
  scanAddOpen();
});

// ── Scan Add Modal ──
let _scanAddMode = 'upload'; // 'upload' | 'builtin' | 'code'
let _scanFileData = null;     // parsed file data

function scanAddOpen() {
  document.getElementById('scan-add-modal').classList.add('open');
  document.getElementById('scan-add-name').value = '';
  document.getElementById('scan-file-info').style.display = 'none';
  _scanFileData = null;
  scanAddTab('upload');
}

function scanAddClose() {
  document.getElementById('scan-add-modal').classList.remove('open');
}

function scanAddTab(tab) {
  _scanAddMode = tab;
  document.querySelectorAll('.scan-add-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.addtab === tab);
    t.style.background = t.dataset.addtab === tab ? '#1a2030' : 'none';
    t.style.color = t.dataset.addtab === tab ? '#4ade80' : '#4a6080';
  });
  document.getElementById('scan-add-upload').style.display = tab === 'upload' ? '' : 'none';
  document.getElementById('scan-add-builtin').style.display = tab === 'builtin' ? '' : 'none';
  document.getElementById('scan-add-code').style.display = tab === 'code' ? '' : 'none';
}

document.querySelectorAll('.scan-add-tab').forEach(t => {
  t.addEventListener('click', () => scanAddTab(t.dataset.addtab));
});

// ── File upload handling ──
const dropZone = document.getElementById('scan-drop-zone');
const fileInput = document.getElementById('scan-file-input');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleScanFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files.length) handleScanFile(fileInput.files[0]); });

function handleScanFile(file) {
  const info = document.getElementById('scan-file-info');
  const ext = file.name.split('.').pop().toLowerCase();

  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    try {
      if (ext === 'json') {
        const data = JSON.parse(text);
        const results = Array.isArray(data) ? data : (data.signals || data.results || []);
        _scanFileData = { type: 'imported', results, raw: text };
        info.innerHTML = '<span style="color:#4ade80;">✓</span> ' + file.name + ' — ' + results.length + ' signals';
        info.style.display = '';
        if (!document.getElementById('scan-add-name').value) {
          document.getElementById('scan-add-name').value = file.name.replace(/\.[^.]+$/, '');
        }
      } else if (ext === 'csv') {
        const results = parseCSVToSignals(text);
        _scanFileData = { type: 'imported', results, raw: text };
        info.innerHTML = '<span style="color:#4ade80;">✓</span> ' + file.name + ' — ' + results.length + ' rows parsed';
        info.style.display = '';
        if (!document.getElementById('scan-add-name').value) {
          document.getElementById('scan-add-name').value = file.name.replace(/\.[^.]+$/, '');
        }
      } else if (ext === 'js' || ext === 'py') {
        _scanFileData = { type: 'code', code: text, results: [] };
        info.innerHTML = '<span style="color:#4ade80;">✓</span> ' + file.name + ' — ' + (text.length / 1024).toFixed(1) + 'KB code';
        info.style.display = '';
        if (!document.getElementById('scan-add-name').value) {
          document.getElementById('scan-add-name').value = file.name.replace(/\.[^.]+$/, '');
        }
      } else {
        info.innerHTML = '<span style="color:#ef5350;">✗</span> Unsupported file type: .' + ext;
        info.style.display = '';
        _scanFileData = null;
      }
    } catch(e) {
      info.innerHTML = '<span style="color:#ef5350;">✗</span> Parse error: ' + e.message;
      info.style.display = '';
      _scanFileData = null;
    }
  };
  reader.readAsText(file);
}

function parseCSVToSignals(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    if (vals.length < 2) continue;
    const row = {};
    headers.forEach((h, j) => {
      const v = vals[j] || '';
      const num = parseFloat(v);
      row[h] = isNaN(num) ? v : num;
    });
    // Normalize field names
    if (row.ticker || row.symbol) {
      row.ticker = row.ticker || row.symbol;
      results.push(row);
    }
  }
  return results;
}

// ── Save button in modal ──
async function scanAddSave() {
  const name = document.getElementById('scan-add-name').value.trim();
  if (!name) {
    document.getElementById('scan-add-name').style.borderColor = '#ef5350';
    return;
  }
  document.getElementById('scan-add-name').style.borderColor = '#2a3050';

  if (_scanAddMode === 'upload' && _scanFileData) {
    const scan = await ScanManager.add({
      name,
      type: _scanFileData.type,
      results: _scanFileData.results || [],
      code: _scanFileData.code || null,
      tags: ['uploaded'],
    });
    scanAddClose();
  } else if (_scanAddMode === 'builtin') {
    // Create a saved copy of a built-in scan
    const strategy = document.getElementById('scan-add-strategy').value;
    const fromVal = document.getElementById('scan-add-from').value;
    const toVal = document.getElementById('scan-add-to').value;
    const scan = await ScanManager.add({
      name,
      type: 'builtin',
      strategy,
      dateRange: fromVal && toVal ? { from: fromVal, to: toVal } : null,
      results: [],
      tags: [strategy],
    });
    scanAddClose();
    // Auto-select and run if date range given
    if (fromVal && toVal) {
      ScanManager.select(scan.id);
      document.getElementById('scan-from').value = fromVal;
      document.getElementById('scan-to').value = toVal;
      // Trigger the built-in historical scan
      scanMode = 'historical';
      document.querySelectorAll('.scan-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.scantab === 'historical');
        t.style.background = t.dataset.scantab === 'historical' ? '#1a2030' : 'none';
        t.style.color = t.dataset.scantab === 'historical' ? '#4ade80' : '#4a6080';
        t.style.borderColor = t.dataset.scantab === 'historical' ? '#4ade80' : '#2a3050';
      });
      document.getElementById('scan-date-range').style.display = '';
      document.getElementById('scan-run-btn').textContent = '▶ SCAN RANGE';
      runHistoricalScan();
    }
  } else if (_scanAddMode === 'code') {
    const code = document.getElementById('scan-add-codearea').value;
    if (!code.trim()) return;
    const scan = await ScanManager.add({
      name,
      type: 'code',
      code,
      results: [],
      tags: ['code'],
    });
    scanAddClose();
    ScanManager.select(scan.id);
    // Try to run the code
    runCodeScan(scan);
  }
}

// ── Validate & Fix scan code via AI ──
let _validatedCode = null; // stores AI-fixed code

async function scanAddValidate() {
  const name = document.getElementById('scan-add-name').value.trim() || 'Unnamed scan';
  let code = '';

  if (!SCAN_API_AVAILABLE) {
    document.getElementById('scan-validate-result').style.display = '';
    document.getElementById('scan-validate-result').innerHTML = noBackendError('Validating scan code');
    return;
  }

  // Get code from the active tab
  if (_scanAddMode === 'upload' && _scanFileData) {
    code = _scanFileData.code || '';
    if (!code && _scanFileData.raw) code = _scanFileData.raw;
  } else if (_scanAddMode === 'code') {
    code = document.getElementById('scan-add-codearea').value;
  }

  if (!code.trim()) {
    document.getElementById('scan-validate-result').style.display = '';
    document.getElementById('scan-validate-result').innerHTML = '<span style="color:#f59e0b;">⚠ No code to validate. Upload a file or paste code.</span>';
    return;
  }

  const btn = document.getElementById('scan-validate-btn');
  const resultEl = document.getElementById('scan-validate-result');
  btn.disabled = true;
  btn.textContent = '⏳ Analyzing…';
  resultEl.style.display = '';
  resultEl.innerHTML = '<span style="color:#6a80a0;">🤖 Renata is analyzing your scan code…</span>';

  try {
    const from = document.getElementById('scan-from')?.value || '';
    const to = document.getElementById('scan-to')?.value || '';
    const filterMode = document.querySelector('input[name="scan-filter"]:checked')?.value || '3';

    const res = await fetch((SCAN_API || '') + '/api/scans/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name, from, to, filterMode }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      resultEl.innerHTML = '<span style="color:#ef5350;">✗ ' + escHtml(data.error || 'Validation failed') + '</span>';
      return;
    }

    if (!data.code) {
      resultEl.innerHTML = '<span style="color:#f59e0b;">⚠ Could not generate fixed code.</span><br><pre style="font-size:11px;color:#8aa0c0;white-space:pre-wrap;">' + escHtml(data.raw || data.analysis || '') + '</pre>';
      return;
    }

    _validatedCode = data.code;

    resultEl.innerHTML =
      '<div class="val-analysis"><b>📊 Analysis:</b> ' + escHtml(data.analysis || '') + '</div>' +
      '<div class="val-fixes"><b>🔧 Fixes:</b>\n' + escHtml(data.fixes || 'No changes needed') + '</div>' +
      '<div style="display:flex;gap:6px;">' +
        '<button class="val-accept" onclick="scanAcceptFix()">✓ Use Fixed Code</button>' +
        '<button class="val-reject" onclick="scanRejectFix()">✗ Keep Original</button>' +
      '</div>';
  } catch(e) {
    resultEl.innerHTML = '<span style="color:#ef5350;">✗ Network error: ' + escHtml(e.message) + '</span>';
  } finally {
    btn.disabled = false;
    btn.textContent = '🤖 Validate & Fix';
  }
}

function scanAcceptFix() {
  if (!_validatedCode) return;
  // Put fixed code into the active input
  if (_scanAddMode === 'code') {
    document.getElementById('scan-add-codearea').value = _validatedCode;
  } else if (_scanAddMode === 'upload' && _scanFileData) {
    _scanFileData.code = _validatedCode;
    _scanFileData.type = 'code'; // upgrade to code type so it runs as Python
    const info = document.getElementById('scan-file-info');
    info.innerHTML += '<br><span style="color:#4ade80;">✓ Code fixed by Renata</span>';
  }
  document.getElementById('scan-validate-result').style.display = 'none';
  _validatedCode = null;
  toast('✓ Fixed code applied');
}

function scanRejectFix() {
  _validatedCode = null;
  document.getElementById('scan-validate-result').style.display = 'none';
}

// ── Fix the currently active scan in-place ──
async function fixActiveScan() {
  const scan = ScanManager.getActive();
  if (!scan || !scan.code) {
    toast('No code to fix in this scan');
    return;
  }

  const statusEl = document.getElementById('scan-status');
  statusEl.innerHTML = '<span style="color:#a855f7;">🤖 Validating scan code…</span>';

  try {
    const from = document.getElementById('scan-from')?.value || '';
    const to = document.getElementById('scan-to')?.value || '';
    const filterMode = document.querySelector('input[name="scan-filter"]:checked')?.value || '3';

    const res = await fetch((SCAN_API || '') + '/api/scans/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: scan.code, name: scan.name, from, to, filterMode }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      statusEl.innerHTML = '<span style="color:#ef5350;">✗ Validation failed: ' + escHtml(data.error || 'Unknown error') + '</span>';
      return;
    }

    if (data.code && data.changed) {
      // Apply the fix
      scan.code = data.code;
      scan.type = 'code';
      ScanManager.save();
      statusEl.innerHTML =
        '<div style="background:#0d1220;border:1px solid #1e2840;border-radius:4px;padding:8px;">' +
        '<div style="color:#dde3f0;font-size:11px;margin-bottom:6px;"><b>📊 Analysis:</b> ' + escHtml(data.analysis || '') + '</div>' +
        '<div style="color:#f59e0b;font-size:11px;white-space:pre-wrap;margin-bottom:8px;"><b>🔧 Fixes applied:</b>\n' + escHtml(data.fixes || '') + '</div>' +
        '<span style="color:#4ade80;font-size:11px;font-weight:700;">✓ Code fixed — hit ▶ SCAN to run</span>' +
        '</div>';
      toast('✓ Scan code fixed');
    } else {
      statusEl.innerHTML = '<span style="color:#f59e0b;">⚠ No fixes needed or no changes made. Original error might be in the scan logic itself.</span>';
    }
  } catch(e) {
    statusEl.innerHTML = '<span style="color:#ef5350;">✗ ' + escHtml(e.message) + '</span>';
  }
}

// ── Run user-uploaded code scan ──
// Detects Python vs JS. Python → backend API. JS → browser sandbox.

function detectPython(code) {
  const indicators = [
    /^from\s+\w+/m, /^import\s+\w+/m,
    /def\s+\w+\s*\(/, /if\s+__name__\s*==/,
    /self\.\w+/, /^\s*class\s+\w+/m,
    /multiprocessing/, /pandas|numpy|vectorbt|pandas_ta/,
    /\belif\b/, /\bNone\b/, /\bTrue\b/, /\bFalse\b/,
  ];
  let hits = 0;
  for (const re of indicators) { if (re.test(code)) hits++; }
  return hits >= 1;
}

function stripModuleSyntax(code) {
  return code
    .replace(/^\s*import\s.+?;?\s*$/gm, '')
    .replace(/^\s*import\s*\(.+?\)\s*;?\s*$/gm, '')
    .replace(/^\s*export\s+(default\s+)?/gm, '')
    .replace(/^\s*const\s+\w+\s*=\s*require\(.+?\)\s*;?\s*$/gm, '');
}

async function runCodeScan(scan) {
  const statusEl = document.getElementById('scan-status');
  if (!scan.code) { statusEl.textContent = 'No code to run.'; return; }

  if (detectPython(scan.code)) {
    // Python — run live (last 6 trading days)
    const dates = getTradingDates(6);
    const from = dates[dates.length - 1]; // oldest
    const to = dates[0]; // newest (today)
    return runPythonScanViaAPI(scan, from, to, statusEl);
  }

  // JS — browser sandbox
  statusEl.textContent = 'Running custom scan…';
  try {
    const cleanCode = stripModuleSyntax(scan.code);
    const fn = new Function('dayMaps', 'dates', 'filterMode', 'fetchGroupedDaily', 'fetchTickerHistory', 'sleep',
      cleanCode + '\nreturn typeof scan === "function" ? scan(dayMaps, dates, filterMode) : [];');
    const dates = getTradingDates(6);
    const dayMaps = await Promise.all(dates.map(fetchGroupedDaily));
    const filterMode = document.querySelector('input[name="scan-filter"]:checked')?.value || '3';
    const results = await fn(dayMaps, dates, filterMode, fetchGroupedDaily, fetchTickerHistory, sleep);
    await ScanManager.updateResults(scan.id, Array.isArray(results) ? results : []);
    statusEl.textContent = '✓ ' + results.length + ' results';
  } catch(e) {
    statusEl.innerHTML = '<span style="color:#ef5350;">✗ Code error: ' + escHtml(e.message) + '</span>';
    console.error('Code scan error:', e);
  }
}

async function runHistoricalCodeScan(scan) {
  const statusEl = document.getElementById('scan-status');
  if (!scan.code) { statusEl.textContent = 'No code to run.'; return; }

  const fromStr = document.getElementById('scan-from').value;
  const toStr = document.getElementById('scan-to').value;
  if (!fromStr || !toStr) {
    statusEl.innerHTML = '<span style="color:#f59e0b;">Set FROM and TO dates first.</span>';
    return;
  }

  if (detectPython(scan.code)) {
    return runPythonScanViaAPI(scan, fromStr, toStr, statusEl);
  }

  // JS — browser sandbox with historical data fetch
  const btn = document.getElementById('scan-run-btn');
  btn.disabled = true; btn.textContent = '⏳ SCANNING…';
  statusEl.textContent = 'Fetching data for date range…';
  try {
    const cleanCode = stripModuleSyntax(scan.code);
    const fn = new Function('dayMaps', 'dates', 'filterMode', 'fetchGroupedDaily', 'fetchTickerHistory', 'sleep',
      cleanCode + '\nreturn typeof scan === "function" ? scan(dayMaps, dates, filterMode) : [];');
    const bufferFrom = new Date(fromStr + 'T12:00:00');
    bufferFrom.setDate(bufferFrom.getDate() - 5);
    const allDates = getTradingDatesBetween(bufferFrom.toISOString().slice(0, 10), toStr);
    statusEl.textContent = `Fetching ${allDates.length} trading days…`;
    const dayMaps = [];
    for (let i = 0; i < allDates.length; i += 5) {
      const batch = allDates.slice(i, i + 5);
      const maps = await Promise.all(batch.map(fetchGroupedDaily));
      dayMaps.push(...maps);
      statusEl.textContent = `Fetched ${dayMaps.length}/${allDates.length} days…`;
      if (i + 5 < allDates.length) await sleep(1100);
    }
    const filterMode = document.querySelector('input[name="scan-filter"]:checked')?.value || '3';
    const results = await fn(dayMaps, allDates, filterMode, fetchGroupedDaily, fetchTickerHistory, sleep);
    await ScanManager.updateResults(scan.id, Array.isArray(results) ? results : []);
    statusEl.textContent = '✓ ' + results.length + ' results from ' + fromStr + ' → ' + toStr;
  } catch(e) {
    statusEl.innerHTML = '<span style="color:#ef5350;">✗ Code error: ' + escHtml(e.message) + '</span>';
    console.error('Historical code scan error:', e);
  } finally {
    btn.disabled = false; btn.textContent = '▶ SCAN';
  }
}

// ── Python scan via backend API ──
async function runPythonScanViaAPI(scan, from, to, statusEl) {
  if (!SCAN_API_AVAILABLE) {
    statusEl.innerHTML = noBackendError('Running Python scans');
    document.getElementById('scan-run-btn').disabled = false;
    document.getElementById('scan-run-btn').textContent = '▶ SCAN';
    return;
  }
  const btn = document.getElementById('scan-run-btn');
  btn.disabled = true; btn.textContent = '⏳ SCANNING…';

  try {
    // ── Step 1: Check what's already cached ──
    let runFrom = from, runTo = to;
    let cachedCount = 0;
    statusEl.textContent = '🔍 Checking cache…';

    try {
      const gapRes = await fetch(SCAN_API + '/api/scans/gaps?scanId=' + encodeURIComponent(scan.id) + '&from=' + from + '&to=' + to);
      if (gapRes.ok) {
        const gaps = await gapRes.json();
        cachedCount = gaps.cachedDays;
        const uncached = gaps.uncachedDays;

        if (gaps.fullyCached) {
          // Everything already cached — just load from cache
          statusEl.innerHTML = '<span style="color:#f59e0b;">⚡ Already cached:</span> ' + gaps.cachedDays + ' days · loading from cache';
          scan._loaded = false;
          await ScanManager.loadResults(scan.id);
          ScanManager.renderScanResults();
          ScanManager.render();
          btn.disabled = false; btn.textContent = '▶ SCAN';
          return;
        }

        if (uncached.length > 0) {
          // Only run for uncached range
          const firstGap = gaps.ranges[0];
          const lastGap = gaps.ranges[gaps.ranges.length - 1];
          runFrom = firstGap.from;
          runTo = lastGap.to;
          const uncachedTradingDays = uncached.length;
          statusEl.innerHTML = '<span style="color:#f59e0b;">⚡ ' + cachedCount + ' days cached</span> · running ' + uncachedTradingDays + ' new days (' + runFrom + ' → ' + runTo + ')';
        }
      }
    } catch(e) {
      // Gap check failed — run full range
      console.warn('Gap check failed, running full range:', e);
    }

    // ── Step 2: Run the scan (only for uncached range) ──
    statusEl.textContent = '🐍 Running Python scan…';
    const filterMode = document.querySelector('input[name="scan-filter"]:checked')?.value || '3';
    const res = await fetch(SCAN_API + '/api/scans/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: scan.code,
        from: runFrom,
        to: runTo,
        filterMode,
        name: scan.name,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      const errMsg = data.error || 'Unknown server error';
      const clean = errMsg.split('\n').slice(-20).join('\n');
      statusEl.innerHTML = '<span style="color:#ef5350;">✗ Python error:</span><br><pre style="font-size:11px;color:#ef5350;margin:4px 0;white-space:pre-wrap;max-height:300px;overflow-y:auto;background:#0a0c12;padding:8px;border-radius:4px;border:1px solid #2a1010;">' + escHtml(clean) + '</pre>' +
        '<button onclick="fixActiveScan()" style="margin-top:6px;background:#a855f7;color:#fff;border:none;font-size:11px;font-weight:700;padding:4px 12px;border-radius:3px;cursor:pointer;">🤖 Validate & Fix This Scan</button>';
      console.error('Python scan error:', data.stderr || errMsg);
      return;
    }

    // ── Step 3: Cache results and show stats ──
    const results = Array.isArray(data.signals) ? data.signals : [];
    const scannedDates = data.scannedDates || [];
    await ScanManager.updateResults(scan.id, results);
    if (SCAN_API_AVAILABLE) {
      statusEl.innerHTML = '<span style="color:#4ade80;">✓ ' + results.length + ' results</span> — caching…';
      const cacheData = await ScanManager.cacheSignals(scan.id, results, scannedDates);
      const totalCached = cacheData ? cacheData.totalCached : results.length;
      const newSigs = cacheData ? cacheData.upserted : results.length;
      const cacheLabel = cachedCount > 0 ? ' (+' + cachedCount + ' from cache)' : '';
      const runInfo = cacheData && cacheData.run ? ' · <span style="color:#38bdf8;">Run: ' + escHtml(cacheData.run.label) + '</span>' : '';
      statusEl.innerHTML = '<span style="color:#4ade80;">✓ Saved ' + newSigs + ' new</span> · <span style="color:#f59e0b;">' + totalCached + ' total cached</span> · ' + from + ' → ' + to + cacheLabel + runInfo;
    } else if (cachedCount > 0 || scannedDates.length > 0) {
      // No new signals but still record scanned dates + reload cache
      if (scannedDates.length > 0) await ScanManager.cacheSignals(scan.id, [], scannedDates);
      scan._loaded = false;
      await ScanManager.loadResults(scan.id);
      ScanManager.renderScanResults();
      statusEl.innerHTML = '<span style="color:#4ade80;">✓ 0 new signals</span> · <span style="color:#f59e0b;">' + cachedCount + ' cached days</span> · ' + from + ' → ' + to;
    } else {
      statusEl.innerHTML = '<span style="color:#4ade80;">✓ Python:</span> 0 results from ' + from + ' → ' + to;
    }
  } catch(e) {
    statusEl.innerHTML = '<span style="color:#ef5350;">✗ Network error: ' + escHtml(e.message) + '</span>';
    console.error('Python scan network error:', e);
  } finally {
    btn.disabled = false; btn.textContent = '▶ SCAN';
  }
}

// ── Tab switching ──
document.querySelectorAll('.scan-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.scan-tab').forEach(t=>{
      t.classList.remove('active');
      t.style.background = 'none';
      t.style.color = '#4a6080';
      t.style.borderColor = '#2a3050';
    });
    tab.classList.add('active');
    tab.style.background = '#1a2030';
    tab.style.color = '#4ade80';
    tab.style.borderColor = '#4ade80';
    scanMode=tab.dataset.scantab;
    const isHist=scanMode==='historical';
    document.getElementById('scan-watchlist').style.display=isHist?'none':'';
    document.getElementById('scan-historical').style.display=isHist?'':'none';
    document.getElementById('scan-date-range').style.display=isHist?'':'none';
    document.getElementById('scan-run-btn').textContent=isHist?'▶ SCAN RANGE':'▶ SCAN';
    document.getElementById('scan-status').textContent='';
    document.getElementById('scan-count').textContent='';
    if(isHist && !document.getElementById('scan-from').value){
      const to=new Date(), from=new Date();
      from.setDate(from.getDate()-90);
      document.getElementById('scan-from').value=from.toISOString().slice(0,10);
      document.getElementById('scan-to').value=to.toISOString().slice(0,10);
    }
  });
});

// ── Date preset buttons ──
document.querySelectorAll('.scan-preset').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const days=parseInt(btn.dataset.days);
    const to=new Date(), from=new Date();
    from.setDate(from.getDate()-days);
    document.getElementById('scan-from').value=from.toISOString().slice(0,10);
    document.getElementById('scan-to').value=to.toISOString().slice(0,10);
    document.querySelectorAll('.scan-preset').forEach(b=>{b.style.borderColor='#2a3050';b.style.color='#4a6080';});
    btn.style.borderColor='#a855f7'; btn.style.color='#a855f7';
  });
});

// ── Run button dispatches based on active scan type ──
document.getElementById('scan-run-btn').addEventListener('click',()=>{
  const active = ScanManager.getActive();
  if (!active) return;
  if (active.type === 'code') {
    if (scanMode === 'historical') runHistoricalCodeScan(active);
    else runCodeScan(active);
  } else {
    // builtin or imported — use the built-in engine
    if (scanMode === 'historical') runHistoricalScan();
    else runScan();
  }
});

// ══════════════════════════════════════════════════════════
//  HISTORICAL SCAN (custom date range)
// ══════════════════════════════════════════════════════════
function getTradingDatesBetween(fromStr, toStr) {
  // Generate all weekday dates from fromStr to toStr (inclusive), most recent first
  const dates = [];
  const from = new Date(fromStr + 'T12:00:00');
  const to = new Date(toStr + 'T12:00:00');
  let d = new Date(to);
  while (d >= from) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      dates.push(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() - 1);
  }
  return dates; // most recent first
}


async function runHistoricalScan(){
  const btn=document.getElementById('scan-run-btn');
  const statusEl=document.getElementById('scan-status');
  const histEl=document.getElementById('scan-historical');
  const countEl=document.getElementById('scan-count');
  const filterMode=document.querySelector('input[name="scan-filter"]:checked')?.value||'3';

  // Get dates from inputs
  const fromStr=document.getElementById('scan-from').value;
  const toStr=document.getElementById('scan-to').value;
  if(!fromStr||!toStr){
    statusEl.textContent='Set FROM and TO dates first.';
    statusEl.style.color='#f59e0b';
    return;
  }

  btn.disabled=true; btn.textContent='⏳ SCANNING…';
  histEl.innerHTML=''; countEl.textContent='';

  // Add 3 buffer days before FROM to catch patterns at the start of range
  const bufferFrom=new Date(fromStr+'T12:00:00');
  bufferFrom.setDate(bufferFrom.getDate()-5); // 5 calendar days = ~3 trading days
  const bufFromStr=bufferFrom.toISOString().slice(0,10);
  const allDates=getTradingDatesBetween(bufFromStr, toStr);
  const totalDays=allDates.length;
  if(totalDays>500){
    statusEl.innerHTML=`<span style="color:#f59e0b;">⚠ ${totalDays} trading days — this will take ~${Math.ceil(totalDays/5*1.2/60)} minutes. Consider a shorter range.</span>`;
  }
  if(totalDays<3){
    statusEl.textContent='Need at least 3 trading days in range.';
    statusEl.style.color='#f59e0b';
    btn.disabled=false; btn.textContent='▶ SCAN RANGE';
    return;
  }
  statusEl.textContent=`Fetching ${totalDays} trading days (${fromStr} → ${toStr})…`;

  try{
    // Fetch in batches of 5 to stay within rate limits
    const dayMaps=[];
    for(let i=0;i<allDates.length;i+=5){
      const batch=allDates.slice(i,i+5);
      const maps=await Promise.all(batch.map(fetchGroupedDaily));
      dayMaps.push(...maps);
      statusEl.textContent=`Fetched ${dayMaps.length}/${totalDays} days… ~${Math.ceil((totalDays-dayMaps.length)/5)}s remaining`;
      if(i+5<allDates.length) await sleep(1100); // rate limit: 5 calls/sec
    }

    statusEl.textContent=`Phase 1: Scanning ${totalDays} days for inside day patterns…`;

    const candidates=[];

    // Scan patterns: D1 can be 1 or 2 trading days before rest day
    // gap=1: standard consecutive (D1 yesterday, rest today)
    // gap=2: one skip day between D1 and rest
    for(let i=0;i<allDates.length-2;i++){
      for(let gap=1;gap<=2;gap++){
      if(i+gap>=allDates.length-1) continue;
      const restMap=dayMaps[i];
      const d1Map=dayMaps[i+gap];
      const preD1Map=(i+gap+1<allDates.length)?dayMaps[i+gap+1]:null;
      const restDate=allDates[i];
      const d1Date=allDates[i+gap];
      if(!restMap||!d1Map) continue;

      for(const ticker of Object.keys(restMap)){
        if(ticker.length>5||ticker.includes('.')||ticker.includes('/')||ticker.includes('+')) continue;
        const rest=restMap[ticker];
        const d1=d1Map[ticker];
        if(!rest||!d1) continue;
        const _dbg=ticker==='BIAF'; // debug flag for specific ticker

        const d1DolVol=d1.vol*d1.close;
        const passF1Vol=d1DolVol>=300e6;
        const passF2Vol=d1DolVol>=1e9;
        if(filterMode==='1'&&!passF1Vol) continue;
        if(filterMode==='2'&&!passF2Vol) continue;
        if(filterMode==='3'&&!passF1Vol&&!passF2Vol){if(_dbg)console.log('BIAF killed: vol',d1DolVol,restDate,d1Date);continue;}

        const preD1Bar=preD1Map?.[ticker];
        const d1ExtBase=preD1Bar?preD1Bar.close:d1.open;
        const d1ExtPct=d1ExtBase>0?((d1.high-d1ExtBase)/d1ExtBase)*100:0;
        if(d1ExtPct<70){if(_dbg)console.log('BIAF killed: ext',d1ExtPct.toFixed(1)+'%',restDate);continue;}
        const d1RangePct=((d1.high-d1.low)/d1.low)*100;
        const d1IntradayPct=((d1.close-d1.open)/d1.open)*100;
        if(d1ExtBase<0.20) continue;

        const d1Range=d1.high-d1.low;
        const lowTol=d1Range*0.25;
        // Rest day high can be up to 2% above D1 high (micro-cap wick tolerance)
        const highTol=d1.high*0.03;
        if(rest.high>d1.high+highTol||rest.low<d1.low-lowTol){if(_dbg)console.log('BIAF killed: inside day','restH='+rest.high,'d1H='+d1.high+'+'+highTol.toFixed(2),'restL='+rest.low,'d1L='+d1.low+'-'+lowTol.toFixed(2),restDate);continue;}
        const isStrictInside=rest.low>=d1.low; // high is always strict now

        // Retracement = (D1 high - rest low) / (D1 high - prior close)
        const totalMove=d1.high-d1ExtBase;
        const retracePct=totalMove>0?((d1.high-rest.low)/totalMove)*100:0;
        if(retracePct>85){if(_dbg)console.log('BIAF killed: retrace',retracePct.toFixed(1)+'%',restDate);continue;}

        const restGapPct=((rest.open-d1.close)/d1.close)*100;
        // Gap filter removed per user
        // Calculate trade day gap for display only
        const tdMapGap=i>0?dayMaps[i-1]:null;
        const tdBarGap=tdMapGap?.[ticker];
        const tdGapPct=tdBarGap?((tdBarGap.open-rest.close)/rest.close*100):null;
        // F1 requires trade day gap >= 0% (no gap down)
        const passF1Gap=tdGapPct!=null?(tdGapPct>=-3):true; // allow tiny gap down tolerance
        const passF1=passF1Vol&&passF1Gap;
        const passF2=passF2Vol; // F2 has no gap requirement
        if(filterMode==='1'&&!passF1) continue;
        if(filterMode==='2'&&!passF2) continue;
        if(filterMode==='3'&&!passF1&&!passF2) continue;

        // SSR prefilter: rest day low ≤ D1 close × 0.90 OR D1 low ≤ prior close × 0.90
        const ssrFromRest=(rest.low<=d1.close*0.95);
        const ssrFromD1=preD1Bar?(d1.low<=preD1Bar.close*0.95):false;
        const ssrPossible=ssrFromRest||ssrFromD1;
        if(_dbg)console.log('BIAF SSR:','ssrPossible='+ssrPossible,'restL='+rest.low,'thresh='+d1.close*0.95,'d1L='+d1.low);
        const d1C2C=preD1Bar?((d1.close-preD1Bar.close)/preD1Bar.close*100):d1IntradayPct;

        // Check if trade day data exists (day after rest day)
        const tdMap=i>0?dayMaps[i-1]:null;
        const tdBar=tdMap?.[ticker];
        const tdHodAboveRestHigh=tdBar?(tdBar.high>rest.high):null;
        const tdResult=tdBar?((tdBar.close-tdBar.open)/tdBar.open*100):null;

        // ── TRADE DAY OPEN MUST BE BELOW D1 HOD ──
        // Trade day open vs D1 high — rough daily-bar precheck
        // Precise PM check done in Phase 2 with 5-min bars
        if(tdBar && tdBar.open >= d1.high){if(_dbg)console.log('BIAF killed: tdOpen',tdBar.open,'>=',d1.high,restDate);continue;}
        if(_dbg)console.log('BIAF PASSED Phase 1!',restDate,d1Date,'vol=$'+Math.round(d1DolVol/1e6)+'M ext='+d1ExtPct.toFixed(0)+'% ret='+retracePct.toFixed(0)+'%');

        candidates.push({
          ticker, d1Date, restDate,
          tradeDate:i>0?allDates[i-1]:null,
          d1DolVol, d1IntradayPct, d1C2C, d1RangePct, d1ExtPct,
          d1Close:d1.close, d1High:d1.high, d1Low:d1.low,
          restHigh:rest.high, restLow:rest.low, restClose:rest.close, restOpen:rest.open,
          isStrictInside, retracePct, restGapPct, tdGapPct,
          ssrPossible,
          passF1, passF2,
          triggerPrice:rest.high,
          idVolRatio:rest.vol/d1.vol,
          tdHodAboveRestHigh, tdResult, tdOpen:tdBar?tdBar.open:null,
        });
      }

      if(i%10===0) {
        statusEl.textContent=`Phase 1: Scanned ${i+1}/${totalDays-2} days… ${candidates.length} candidates`;
        await sleep(10);
      }
      } // end gap loop
    }

    // Dedupe: keep most recent occurrence per ticker-d1Date pair
    const seen=new Set();
    const deduped=candidates.filter(c=>{
      // Dedupe by ticker + trade date (what the user actually sees)
      const td=c.tradeDate||c.restDate;
      const key=c.ticker+'_'+td;
      if(seen.has(key)) return false;
      seen.add(key); return true;
    });

    statusEl.textContent=`Phase 2: Deep-checking ${deduped.length} candidates (bags + MDR)…`;

    // Phase 2: bags + MDR only (1 API call per candidate)
    // Intraday checks (SSR RTH, D1 HOD timing, ORB) skipped for speed — verify manually
    const results=[];
    let checked=0;
    const killReasons={bags:0,mdr:0,histFail:0,f1f2:0};
    for(const c of deduped){
      checked++;
      const _dbg2=(c.ticker==='BIAF');
      if(_dbg2) console.log('BIAF Phase2 entry:',c.restDate,c.d1Date,'passF1='+c.passF1);
      if(checked%5===0){
        statusEl.textContent=`Phase 2: ${checked}/${deduped.length} — ${results.length} pass | bags:${killReasons.bags} mdr:${killReasons.mdr} flt:${killReasons.f1f2}`;
        await sleep(10);
      }
      const histFrom=new Date(c.d1Date+'T12:00:00');
      histFrom.setDate(histFrom.getDate()-75);
      let hist=[];
      try{
        hist=await fetchTickerHistory(c.ticker,histFrom.toISOString().slice(0,10),c.d1Date);
      }catch(e){ killReasons.histFail++; }
      await sleep(250);

      const d1Idx=hist.findIndex(b=>b.date===c.d1Date);
      let hasBags=false,bagDetails='';
      if(hist.length>0){
        const lb60=hist.filter(b=>{
          const diff=(new Date(c.d1Date)-new Date(b.date))/86400000;
          return diff>0&&diff<=60&&b.date!==c.d1Date;
        });
        for(const b of lb60){
          const bagRef=c.tdOpen||c.restOpen;
          if(b.vol>=100e6&&b.high>bagRef){hasBags=true;bagDetails=b.date;break;} // 100M shares
        }
      }
      let hasMDR=false,mdrDetails='';
      if(d1Idx>0){
        const mdrW=hist.slice(Math.max(0,d1Idx-11),d1Idx);
        for(const b of mdrW){
          const mv=((b.high-b.low)/b.low)*100;
          if(mv>=20&&b.vol>=10e6){hasMDR=true;mdrDetails=b.date;break;} // 10M+ shares traded
        }
      }

      const f1Pass=c.passF1&&!hasBags&&!hasMDR;
      const f2Pass=c.passF2&&!hasBags&&!hasMDR;
      if(_dbg2) console.log('BIAF Phase2:','bags='+hasBags+(hasBags?'('+bagDetails+')':''),'mdr='+hasMDR+(hasMDR?'('+mdrDetails+')':''),'f1='+f1Pass,'f2='+f2Pass);
      if(hasBags){ killReasons.bags++; }
      if(hasMDR){ killReasons.mdr++; }
      if(filterMode==='1'&&!f1Pass){ killReasons.f1f2++; continue; }
      if(filterMode==='2'&&!f2Pass){ killReasons.f1f2++; continue; }
      if(filterMode==='3'&&!f1Pass&&!f2Pass){ killReasons.f1f2++; continue; }

      const filterTag=[];
      if(f1Pass) filterTag.push('F1');
      if(f2Pass) filterTag.push('F2');

      results.push({...c,hasBags,bagDetails,hasMDR,mdrDetails,filterTag});
    }

    // Sort by date (most recent first)
    results.sort((a,b)=>(b.tradeDate||b.restDate).localeCompare(a.tradeDate||a.restDate));

    // Save results to ScanManager
    const activeScan = ScanManager.getActive();
    if (activeScan) {
      activeScan.results = results;
      activeScan.resultCount = results.length;
      ScanManager.save();
      ScanManager.render();
    }

    countEl.textContent=results.length+' found';
    const kr=killReasons;
    statusEl.innerHTML=`<span style="color:#4ade80;">${results.length} setups</span> from ${deduped.length} candidates (${fromStr} → ${toStr}).<br>`
      +`<span style="color:#6a80a0;font-size:11px;">Filtered: bags:${kr.bags} mdr:${kr.mdr} d1hod:${kr.d1hod} ssr:${kr.ssr} orb:${kr.tdOrb} f1f2:${kr.f1f2}</span>`;

    // Render as compact table
    histEl.innerHTML=`<div style="font-size:11px;color:#8aa0c0;padding:8px 4px;border-bottom:2px solid #2a3050;display:grid;grid-template-columns:78px 52px 48px 42px 30px 30px 36px 38px 28px;gap:2px;font-weight:700;letter-spacing:0.3px;">
      <span>TRADE DATE</span><span>TICKER</span><span>D1$VOL</span><span>D1EXT</span><span>RET</span><span>SSR</span><span>GAP</span><span>TDRES</span><span>FLT</span>
    </div>`+results.map((r,idx)=>{
      const fTag=r.filterTag.join('/');
      const fCol=fTag.includes('F1')&&fTag.includes('F2')?'#f59e0b':fTag.includes('F2')?'#38bdf8':'#4ade80';
      const tdCol=r.tdResult!=null?(r.tdResult>=0?'#26a69a':'#ef5350'):'#4a6080';
      const tdTxt=r.tdResult!=null?(r.tdResult>=0?'+':'')+r.tdResult.toFixed(1)+'%':'—';
// TD GAP column removed, replaced with SSR
      const bgCol=idx%2===0?'#0d1220':'#101828';
      return `<div class="scan-item" data-ticker="${r.ticker}" data-trigger="${r.triggerPrice}" data-d1date="${r.d1Date}" data-restdate="${r.restDate}" style="display:grid;grid-template-columns:78px 52px 48px 42px 30px 30px 36px 38px 28px;gap:2px;padding:6px 3px;font-size:11px;background:${bgCol};border:1px solid #1e2840;border-radius:3px;margin-bottom:2px;cursor:pointer;align-items:center;" onmouseover="this.style.borderColor='#4ade80'" onmouseout="this.style.borderColor='#1e2840'">
        <span style="color:#8aa0c0;font-weight:600;">${r.tradeDate||r.restDate}</span>
        <span style="color:#dde3f0;font-weight:800;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;">${r.ticker}</span>
        <span style="color:#8aa0c0;font-weight:600;">$${(r.d1DolVol/1e6).toFixed(0)}M</span>
        <span style="color:#26a69a;font-weight:700;">+${(r.d1ExtPct||0).toFixed(0)}%</span>
        <span style="color:${r.retracePct>60?'#f59e0b':'#8aa0c0'};font-weight:600;">${r.retracePct.toFixed(0)}%</span>
        <span style="color:${r.ssrPossible?'#4ade80':'#ef5350'};font-weight:700;font-size:11px;">${r.ssrPossible?'YES':'NO'}</span>
        <span style="color:${r.restGapPct<-5?'#ef5350':r.restGapPct<0?'#f59e0b':'#26a69a'};font-weight:600;">${r.restGapPct>=0?'+':''}${r.restGapPct.toFixed(1)}%</span>
        <span style="color:${tdCol};font-weight:700;">${tdTxt}</span>
        <span style="color:${fCol};font-weight:700;">${fTag}</span>
      </div>`;
    }).join('');

    // Click to load chart
    histEl.querySelectorAll('.scan-item').forEach(el=>{
      el.addEventListener('click',()=>{
        const ticker=el.dataset.ticker;
        const d1date=el.dataset.d1date;
        symbol=ticker;
        document.getElementById('symbol-input').value=symbol;
        const d1=new Date(d1date+'T12:00:00');
        const toD=new Date(d1date+'T12:00:00'); toD.setDate(toD.getDate()+5);
        panels.forEach((p,i)=>{
          if(isIntraday(p.tf)){
            const f=new Date(d1); f.setDate(f.getDate()-1);
            p.startDate=fmtDate(f); p.endDate=fmtDate(toD);
          }else{
            const f=new Date(d1); f.setDate(f.getDate()-90);
            p.startDate=fmtDate(f); p.endDate=fmtDate(toD);
          }
          document.getElementById(`from-${i}`).value=p.startDate;
          document.getElementById(`to-${i}`).value=p.endDate;
        });
        if(liveMode) setLiveMode(false);
        loadAll();
        toast(`📈 ${ticker} — ${el.dataset.restdate} — trigger ▲ $${parseFloat(el.dataset.trigger).toFixed(2)}`);
        histEl.querySelectorAll('.scan-item').forEach(e=>e.style.borderColor='#1e2840');
        el.style.borderColor='#4ade80';
      });
    });

  }catch(err){
    statusEl.textContent='✗ Historical scan failed: '+err.message;
    statusEl.style.color='#ef5350';
    console.error('Historical scan error:',err);
  }finally{
    btn.disabled=false; btn.textContent='▶ SCAN RANGE';
  }
}

function openBtSidebar(){
  btActive=true;
  document.getElementById('bt-sidebar').classList.add('open');
  adjustFullscreenRight();
  document.getElementById('bt-btn').classList.add('active');
  buildBtRangeUI();
  updateSimPnl();
  setTimeout(()=>panels.forEach(p=>resizePanel(p)),50);
}

function buildBtRangeUI(){
  const cfg=document.getElementById('bt-range-cfg');
  const container=document.getElementById('bt-panel-ranges');
  cfg.style.display='block';
  container.innerHTML='';
  panels.forEach((p,i)=>{
    const defaultBack=!isIntraday(p.tf)?365:14;
    const defaultFwd=14;
    const row=document.createElement('div');
    row.className='bt-range-row';
    row.innerHTML=`
      <span class="bt-range-tf">P${i+1} <span style="color:#4a6080">${p.tf==='D'?'D':p.tf==='W'?'W':p.tf==='M'?'Mo':p.tf+'m'}</span></span>
      <span class="bt-range-label">BACK</span>
      <input class="bt-range-input" id="bt-back-${i}" type="number" min="1" max="1000" placeholder="${defaultBack}" value="${p.btBack??''}"/>
      <span class="bt-range-label" style="width:24px">FWD</span>
      <input class="bt-range-input" id="bt-fwd-${i}" type="number" min="0" max="500" placeholder="${defaultFwd}" value="${p.btFwd??''}"/>`;
    // Wire inputs — update p.btBack/btFwd immediately on change, don't reload
    row.querySelector(`#bt-back-${i}`).addEventListener('change',e=>{
      const v=parseInt(e.target.value);
      p.btBack=isNaN(v)||v<=0?null:v;
    });
    row.querySelector(`#bt-fwd-${i}`).addEventListener('change',e=>{
      const v=parseInt(e.target.value);
      p.btFwd=isNaN(v)||v<0?null:v;
    });
    container.appendChild(row);
  });
}

function closeBtSidebar(){
  btActive=false;
  btSelected=null; btMarkers=[];
  document.getElementById('bt-sidebar').classList.remove('open');
  adjustFullscreenRight();
  document.getElementById('bt-btn').classList.remove('active');
  document.getElementById('bt-sim').style.display='none';
  document.querySelectorAll('.bt-trade.active').forEach(el=>el.classList.remove('active'));
  renderAll();
  setTimeout(()=>panels.forEach(p=>resizePanel(p)),50);
}

function loadBtTradesIntoReview(trades, label, sublabel){
  btTrades = mergeBtTrades(trades || []);
  btSelected = null;
  btMarkers = [];
  if(!btTrades.length){toast('No trades found',true);return;}
  const s = btStats(btTrades);
  document.getElementById('bts-trades').textContent = s.n;
  const pnlEl = document.getElementById('bts-pnl');
  pnlEl.textContent = fmtPnl(s.total);
  pnlEl.className = 'bt-stat-v ' + (s.total >= 0 ? 'pos' : 'neg');
  document.getElementById('bts-wr').textContent = s.wr;
  document.getElementById('bts-aw').textContent = s.avgW !== '—' ? '+' + s.avgW : s.avgW;
  document.getElementById('bts-al').textContent = s.avgL;
  document.getElementById('bts-best').textContent = s.best === '—' ? '—' : '+' + s.best;
  document.getElementById('bts-worst').textContent = s.worst;
  document.getElementById('bt-stats').classList.add('show');
  document.getElementById('bt-strategy').style.display = '';
  document.getElementById('bt-filter').classList.add('show');
  document.getElementById('bt-drop-label').innerHTML = `<span style="color:#26a69a">✓ ${escHtml(label || 'Trades loaded')}</span><br><span style="color:#3a5070">${escHtml(sublabel || (s.n + ' trades loaded — click to replace'))}</span>`;
  renderBtList();
}

function loadBtFile(file){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const trades = parseBtCSV(e.target.result);
      if(!trades.length){toast('No trades found in CSV',true);return;}
      loadBtTradesIntoReview(trades, file.name, btStats(mergeBtTrades(trades)).n + ' trades loaded — click to replace');
      toast(`✓ Loaded ${btTrades.length} trades from ${file.name}`);
    }catch(err){
      toast('Error parsing CSV: '+err.message, true);
    }
  };
  reader.readAsText(file);
}

// BT event wiring
document.getElementById('bt-btn').addEventListener('click',()=>{
  sbOpen('bt');
});
var _btClose=document.getElementById('bt-close');if(_btClose)_btClose.addEventListener('click',closeBtSidebar);
document.getElementById('bt-file-input').addEventListener('change',e=>{
  loadBtFile(e.target.files[0]);
  e.target.value='';
});
const btDrop=document.getElementById('bt-drop');
btDrop.addEventListener('dragover',e=>{e.preventDefault();btDrop.classList.add('drag-over');});
btDrop.addEventListener('dragleave',()=>btDrop.classList.remove('drag-over'));
btDrop.addEventListener('drop',e=>{
  e.preventDefault(); btDrop.classList.remove('drag-over');
  loadBtFile(e.dataTransfer.files[0]);
});
document.getElementById('bt-search').addEventListener('input',renderBtList);
document.getElementById('bt-sort').addEventListener('change',renderBtList);
document.getElementById('bt-hldt-btn').addEventListener('click',()=>{
  btHighlightDates=!btHighlightDates;
  const btn=document.getElementById('bt-hldt-btn');
  btn.style.background=btHighlightDates?'#f59e0b18':'transparent';
  btn.style.color=btHighlightDates?'#f59e0b':'#3a4560';
  btn.style.borderColor=btHighlightDates?'#f59e0b':'#2a3050';
  renderAll();
});

// ══════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════
let toastT;
function toast(msg,isErr){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.toggle('err',!!isErr); el.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show','err'),3500);
}

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  LAYOUT SWITCHER (1 / 2 / 4 panels)
// ══════════════════════════════════════════════════════════
let panelLayout=1;
function setLayout(n){
  panelLayout=n;
  const g=document.getElementById('grid');
  if(!g)return;
  if(n===1){
    g.style.cssText='flex:1;display:flex;flex-direction:column;background:#050709;min-height:0;min-width:0;padding:3px;';
    panels.forEach((p,i)=>{
      const el=document.getElementById('panel-'+i);if(!el)return;
      if(i===0){el.style.cssText='flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0;position:relative;';}
      else{el.style.cssText='display:none;';}
    });
  }else if(n===2){
    g.style.cssText='flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr;gap:3px;background:#050709;padding:3px;min-height:0;min-width:0;';
    panels.forEach((p,i)=>{
      const el=document.getElementById('panel-'+i);if(!el)return;
      if(i<2){el.style.cssText='display:flex;flex-direction:column;overflow:hidden;min-height:0;position:relative;';}
      else{el.style.cssText='display:none;';}
    });
  }else{
    g.style.cssText='flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:3px;background:#050709;padding:3px;min-height:0;min-width:0;';
    panels.forEach((p,i)=>{
      const el=document.getElementById('panel-'+i);if(!el)return;
      el.style.cssText='display:flex;flex-direction:column;overflow:hidden;min-height:0;position:relative;';
    });
  }
  // Update layout buttons
  ['ly1','ly2','ly4'].forEach(id=>{const b=document.getElementById(id);if(b){b.classList.toggle('active',id==='ly'+n);}});
  // Resize visible panels
  setTimeout(()=>{panels.forEach((p,i)=>{const el=document.getElementById('panel-'+i);if(el&&el.style.display!=='none')resizePanel(p);});renderAll();},80);
}
document.getElementById('ly1').addEventListener('click',()=>setLayout(1));
document.getElementById('ly2').addEventListener('click',()=>setLayout(2));
document.getElementById('ly4').addEventListener('click',()=>setLayout(4));

// ══════════════════════════════════════════════════════════
//  SETTINGS (Look & Feel)
// ══════════════════════════════════════════════════════════
const SK='traderra-cfg';
let F={p:12,t:11,o:14,ui:15};
let RIGHT_PAD=6;
const _$=id=>document.getElementById(id); // safe getter
function h2r(h){h=h.replace('#','');return{r:parseInt(h.substr(0,2),16),g:parseInt(h.substr(2,2),16),b:parseInt(h.substr(4,2),16)};}
function rga(h,a){const c=h2r(h);return'rgba('+c.r+','+c.g+','+c.b+','+a/100+')';}
function rh(s){const m=s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?'#'+[m[1],m[2],m[3]].map(x=>parseInt(x).toString(16).padStart(2,'0')).join(''):s;}
function ro(s){const m=s.match(/[\d.]+\)$/);return m?Math.round(parseFloat(m[0])*100):50;}
const PR={
  default:{bg:'#0c0e14',ax:'#0d0f18',gr:'#141926',up:'#26a69a',dn:'#ef5350',pre:'#787878',po:8,aft:'#3c3c3c',ao:10,cr:'#8ca0c8',co:50,bd:'#1e2535',p:10,t:9,o:12},
  gold:{bg:'#0a0a08',ax:'#0d0c0a',gr:'#1a1810',up:'#D4AF37',dn:'#ef5350',pre:'#787878',po:8,aft:'#3c3c3c',ao:10,cr:'#D4AF37',co:40,bd:'#2a2510',p:10,t:9,o:12},
  light:{bg:'#f4f3f0',ax:'#f0efec',gr:'#dddcd8',up:'#26a69a',dn:'#ef5350',pre:'#ff9800',po:6,aft:'#2196f3',ao:5,cr:'#333333',co:60,bd:'#ccc8c0',al:'#777770',am:'#999990',ah:'#555550',clbg:'#eae9e5',clbd:'#d0cec8',p:10,t:9,o:12},
  nord:{bg:'#2e3440',ax:'#3b4252',gr:'#434c5e',up:'#a3be8c',dn:'#bf616a',pre:'#d08770',po:10,aft:'#81a1c1',ao:8,cr:'#d8dee9',co:40,bd:'#4c566a',p:10,t:9,o:12}
};
function ap(s){
  if(s.bg)C.bg=s.bg;if(s.ax)C.axisbg=s.ax;if(s.gr)C.grid=s.gr;
  if(s.up){C.up=s.up;C.vol_up='rgba('+h2r(s.up).r+','+h2r(s.up).g+','+h2r(s.up).b+',.5)';}
  if(s.dn){C.dn=s.dn;C.vol_dn='rgba('+h2r(s.dn).r+','+h2r(s.dn).g+','+h2r(s.dn).b+',.5)';}
  if(s.pre)C.pre=rga(s.pre,s.po||7);if(s.aft)C.after=rga(s.aft,s.ao||9);
  if(s.cr)C.cross=rga(s.cr,s.co||50);
  if(s.al)C.axisLabel=s.al; if(s.am)C.axisMuted=s.am; if(s.ah)C.axisHighlight=s.ah;
  if(s.clbg)C.crossLabelBg=s.clbg; if(s.clbd)C.crossLabelBd=s.clbd;
  if(s.bd){document.querySelectorAll('.panel').forEach(e=>{e.style.borderColor=s.bd;});document.querySelectorAll('.ph,.ind-row,.pdr').forEach(e=>{e.style.borderColor=s.bd;});}
  if(s.p)F.p=s.p;if(s.t)F.t=s.t;if(s.o)F.o=s.o;if(s.ui){F.ui=s.ui;document.documentElement.style.fontSize=s.ui+'px';document.body.style.fontSize=s.ui+'px';}
  // Apply OHLCV tip font size
  document.querySelectorAll('.ohlcv-tip').forEach(t=>t.style.fontSize=F.o+'px');
  document.querySelectorAll('.panel').forEach(e=>e.style.background=C.bg);
  renderAll();
}
function syn(){
  _$('sc-up').value=C.up;_$('sc-dn').value=C.dn;_$('sc-vu').value=rh(C.vol_up);_$('sc-vd').value=rh(C.vol_dn);
  _$('sc-bg').value=C.bg;_$('sc-ax').value=C.axisbg;_$('sc-gr').value=C.grid;_$('sc-bd').value='#1e2535';
  _$('sc-pre').value=rh(C.pre);var po=ro(C.pre);_$('sc-preo').value=po;_$('sc-preo-v').textContent=po+'%';
  _$('sc-aft').value=rh(C.after);var ao=ro(C.after);_$('sc-afto').value=ao;_$('sc-afto-v').textContent=ao+'%';
  _$('sc-cr').value=rh(C.cross);var co=ro(C.cross);_$('sc-cro').value=co;_$('sc-cro-v').textContent=co+'%';
  _$('sf-p').value=F.p;_$('sf-p-v').textContent=F.p;_$('sf-t').value=F.t;_$('sf-t-v').textContent=F.t;_$('sf-o').value=F.o;_$('sf-o-v').textContent=F.o;_$('sf-ui').value=F.ui;_$('sf-ui-v').textContent=F.ui;
}
function liveS(){
  ap({bg:_$('sc-bg').value,ax:_$('sc-ax').value,gr:_$('sc-gr').value,up:_$('sc-up').value,dn:_$('sc-dn').value,
    pre:_$('sc-pre').value,po:+_$('sc-preo').value,aft:_$('sc-aft').value,ao:+_$('sc-afto').value,
    cr:_$('sc-cr').value,co:+_$('sc-cro').value,bd:_$('sc-bd').value,p:+_$('sf-p').value,t:+_$('sf-t').value,o:+_$('sf-o').value,ui:+_$('sf-ui').value});
}
function initS(){try{
  const b=_$('settings-btn'),p=_$('tab-look'),c=null;
  if(!b)return;
  const ma=document.getElementById('main-area');
  b.onclick=()=>{sbOpen('look');};
  ['sc-up','sc-dn','sc-vu','sc-vd','sc-bg','sc-ax','sc-gr','sc-bd','sc-pre','sc-aft','sc-cr'].forEach(id=>{const e=document.getElementById(id);if(e)e.oninput=liveS;});
  ['sc-preo','sc-afto','sc-cro'].forEach(id=>{const e=document.getElementById(id);const v=document.getElementById(id+'-v');if(e)e.oninput=()=>{v.textContent=e.value+'%';liveS();};});
  ['sf-p','sf-t','sf-o','sf-ui'].forEach(id=>{const e=document.getElementById(id);const v=document.getElementById(id+'-v');if(e)e.oninput=()=>{v.textContent=e.value;liveS();};});
  // Auto-save after 2s of no changes (both local + cloud)
  let _saveTimer=null;
  const autoSave=()=>{clearTimeout(_saveTimer);_saveTimer=setTimeout(async()=>{
    const cfg={bg:_$('sc-bg').value,ax:_$('sc-ax').value,gr:_$('sc-gr').value,up:_$('sc-up').value,dn:_$('sc-dn').value,
      pre:_$('sc-pre').value,po:+_$('sc-preo').value,aft:_$('sc-aft').value,ao:+_$('sc-afto').value,
      cr:_$('sc-cr').value,co:+_$('sc-cro').value,bd:_$('sc-bd').value,p:+_$('sf-p').value,t:+_$('sf-t').value,o:+_$('sf-o').value,ui:+_$('sf-ui').value};
    localStorage.setItem(SK,JSON.stringify(cfg));
    PR.default=Object.assign({},cfg);
    // Silent cloud save
    try{await fetch('/api/chart-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg)});}catch(e){}
  },2000);};
  // Hook auto-save into liveS
  const _origLiveS=liveS;
  liveS=function(){_origLiveS();autoSave();};
  {const _sv=_$('s-save');if(_sv)_sv.onclick=async()=>{
    const cfg={bg:_$('sc-bg').value,ax:_$('sc-ax').value,gr:_$('sc-gr').value,up:_$('sc-up').value,dn:_$('sc-dn').value,
      pre:_$('sc-pre').value,po:+_$('sc-preo').value,aft:_$('sc-aft').value,ao:+_$('sc-afto').value,
      cr:_$('sc-cr').value,co:+_$('sc-cro').value,bd:_$('sc-bd').value,p:+_$('sf-p').value,t:+_$('sf-t').value,o:+_$('sf-o').value};
    localStorage.setItem(SK,JSON.stringify(cfg));
    PR.default=Object.assign({},cfg);
    saveThemeColors(); // save to current theme profile
    let cloudOk=false;
    try{const r=await fetch('/api/chart-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg)});
      const j=await r.json();cloudOk=j.ok;}catch(e){}
    const btn=_$('s-save');
    btn.textContent=cloudOk?'✓ Saved to profile!':'✓ Saved locally';
    btn.style.background=cloudOk?'#22c55e':'#f59e0b';
    setTimeout(()=>{btn.textContent='💾 Save as Default';btn.style.background='#D4AF37';},1500);
    toast(cloudOk?'Saved to your profile':'Saved to browser');
  };}
  {const _sr=_$('s-reset');if(_sr)_sr.onclick=()=>{localStorage.removeItem(SK);ap(PR.default);syn();toast('Reset');};}
  document.querySelectorAll('.spb').forEach(b=>b.onclick=()=>{const pr=PR[b.dataset.pr];if(pr){ap(pr);syn();toast(b.textContent);}});
  // Clean prints toggle
  const scb=_$('sc-clean');
  if(scb)scb.onclick=()=>{
    cleanPrints=!cleanPrints;
    scb.textContent=cleanPrints?'ON':'OFF';
    scb.style.borderColor=cleanPrints?'#e879f9':'#4a5580';
    scb.style.color=cleanPrints?'#e879f9':'#4a5580';
    scb.style.background=cleanPrints?'#e879f918':'transparent';
    const btn=document.getElementById('clean-btn');
    if(btn){btn.classList.toggle('on',cleanPrints);btn.style.textDecoration=cleanPrints?'none':'line-through';btn.style.borderColor=cleanPrints?'#e879f9':'#4a5580';btn.style.color=cleanPrints?'#e879f9':'#4a5580';}
    toast(cleanPrints?'Clean prints ON':'Clean prints OFF');
    loadAll();
  };
  // Input settings panel toggle
  {
    const _ib=_$('input-settings-btn'),_ip=_$('input-settings-panel'),_ic=_$('input-settings-close');
    if(_ib)_ib.onclick=function(){sbOpen('settings');};
    if(_ic)_ic.onclick=function(){sbClose();};
    const _iz=_$('is-zoom'),_izv=_$('is-zoom-v');
    const _it=_$('is-tpan'),_itv=_$('is-tpan-v');
    const _im=_$('is-mpan'),_imv=_$('is-mpan-v');
    const _rp=_$('is-rpad'),_rpv=_$('is-rpad-v');
    const _si=function(){localStorage.setItem('traderra-trackpad',JSON.stringify({zoomSens:+_iz.value,trackPanSens:+_it.value,mousePanSens:+_im.value,rightPad:+_rp.value}));};
    if(_iz)_iz.oninput=function(){_izv.textContent=_iz.value;_si();};
    if(_it)_it.oninput=function(){_itv.textContent=_it.value;_si();};
    if(_im)_im.oninput=function(){_imv.textContent=_im.value;_si();};
    if(_rp)_rp.oninput=function(){_rpv.textContent=_rp.value;window.RIGHT_PAD=+_rp.value;_si();renderAll();};
    const _ir=_$('is-reset');
    if(_ir)_ir.onclick=function(){_iz.value=0.15;_izv.textContent='0.15';_it.value=0.5;_itv.textContent='0.50';_im.value=1.0;_imv.textContent='1.0';_rp.value=6;_rpv.textContent='6';window.RIGHT_PAD=6;_si();};
    // SETTINGS tab save button
    const _isSave=_$('is-save');
    if(_isSave)_isSave.onclick=function(){_si();saveTools();_isSave.textContent='✓ SAVED';_isSave.style.background='#22c55e';_isSave.style.borderColor='#22c55e';setTimeout(()=>{_isSave.textContent='💾 SAVE';_isSave.style.background='#D4AF37';_isSave.style.borderColor='#D4AF37';},1500);};
    // Settings tab display sliders
    const _sp2=_$('sf-p2'),_sp2v=_$('sf-p2-v');
    const _st2=_$('sf-t2'),_st2v=_$('sf-t2-v');
    const _scr2=_$('sc-cr2'),_scro2=_$('sc-cro2'),_scro2v=_$('sc-cro2-v');
    if(_sp2)_sp2.oninput=function(){F.p=+_sp2.value;_sp2v.textContent=_sp2.value;renderAll();};
    if(_st2)_st2.oninput=function(){F.t=+_st2.value;_st2v.textContent=_st2.value;renderAll();};
    if(_scr2)_scr2.oninput=function(){liveS();};
    if(_scro2)_scro2.oninput=function(){if(_scro2v)_scro2v.textContent=_scro2.value+'%';liveS();};
    try{const sv=JSON.parse(localStorage.getItem('traderra-trackpad')||'{}');if(sv.zoomSens){_iz.value=sv.zoomSens;_izv.textContent=sv.zoomSens;}if(sv.trackPanSens){_it.value=sv.trackPanSens;_itv.textContent=sv.trackPanSens;}if(sv.mousePanSens){_im.value=sv.mousePanSens;_imv.textContent=sv.mousePanSens;}if(sv.rightPad!=null){_rp.value=sv.rightPad;_rpv.textContent=sv.rightPad;window.RIGHT_PAD=sv.rightPad;}}catch(e){}
  }
  // Vault panel toggle
  {
    const _vb=_$('vault-btn'),_vp=_$('vault-panel'),_vc=_$('vault-close');
    if(_vb)_vb.onclick=function(){sbOpen('vault');};
    if(_vc)_vc.onclick=function(){sbClose();};
  }
  // Load settings: try cloud first, fall back to localStorage
  (async()=>{
    let cfg=null,source='none';
    try{
      const r=await fetch('/api/chart-settings');
      const j=await r.json();
      if(j.settings){cfg=j.settings;source='cloud';}
    }catch(e){}
    if(!cfg){
      try{const r=localStorage.getItem(SK);if(r)cfg=JSON.parse(r);source='local';}catch(e){}
    }
    if(cfg){ap(cfg);syn();PR.default=Object.assign({},cfg);}
    // Show save source in the button subtitle
    const hint=document.getElementById('save-hint');
    if(hint)hint.textContent=source==='cloud'?'☁ Synced to profile':'💻 Local only';
  })();
}catch(e){console.error('initS ERROR:',e);}
}


// ── Light/Dark Theme Toggle ──
const THEME_KEY='traderra-theme';
const THEME_COLORS_KEY='traderra-theme-colors';
function isLightMode(){return document.body.classList.contains('light');}

const THEME_COLOR_KEYS=['bg','axisbg','grid','up','dn','axisLabel','axisMuted','axisHighlight','crossLabelBg','crossLabelBd',
  'ema9','ema20','ema50','ema150','ema200','vwap','ema40_60_fill','ema40_60_line',
  'db_upper_fill','db_upper_line','db_low1_fill','db_low1_line','db_low2_fill','db_low2_line',
  'pre','after','cross','trendline','box_orange','box_yellow','hl_cyan','hl_magenta','hl_green','hl_white',
  'vol_up','vol_dn',
  'band_9_20_bull_fill','band_9_20_bull_line','band_9_20_bear_fill','band_9_20_bear_line',
  'band_72_89_bull_fill','band_72_89_bull_line','band_72_89_bear_fill','band_72_89_bear_line',
  'dev_s_9_20_up_fill','dev_s_9_20_up_line','dev_s_9_20_dn_fill','dev_s_9_20_dn_line',
  'dev_l_9_20_up_fill','dev_l_9_20_up_line','dev_l_9_20_dn_fill','dev_l_9_20_dn_line',
  'db_72_89_up_fill','db_72_89_up_line','db_72_89_dn_fill','db_72_89_dn_line',
  'bb_fill','bb_upper','bb_lower','sma_color','vol_sma_color',
  'zone_fill','zone_line','pz_sup_fill','pz_sup_line','pz_sup_label','pz_res_fill','pz_res_line','pz_res_label','bd'];

function getThemeColors(){
  try{var s=localStorage.getItem(THEME_COLORS_KEY);if(s)return JSON.parse(s);}catch(e){}
  return {};
}
function saveThemeColors(){
  var all=getThemeColors();
  var mode=isLightMode()?'light':'dark';
  var snap={};
  THEME_COLOR_KEYS.forEach(function(k){if(C[k]!==undefined)snap[k]=C[k];});
  all[mode]=snap;
  localStorage.setItem(THEME_COLORS_KEY,JSON.stringify(all));
}

function loadThemeColors(mode){
  var all=getThemeColors();
  var snap=all[mode];
  if(!snap){
    // First time: use preset defaults
    if(mode==='light')snap=PR.light;
    else snap=PR.default;
  }
  THEME_COLOR_KEYS.forEach(function(k){
    if(snap[k]!==undefined)C[k]=snap[k];
  });
  // Rebuild vol colors from up/dn
  if(snap.up)C.vol_up='rgba('+h2r(C.up).r+','+h2r(C.up).g+','+h2r(C.up).b+',.5)';
  if(snap.dn)C.vol_dn='rgba('+h2r(C.dn).r+','+h2r(C.dn).g+','+h2r(C.dn).b+',.5)';
  // Apply to DOM
  document.querySelectorAll('.panel').forEach(function(e){e.style.background=C.bg;});
  document.querySelectorAll('.panel,.ph,.ind-row,.pdr').forEach(function(e){e.style.removeProperty('border-color');e.style.removeProperty('border');});
  syn();renderAll();
}

function applyThemeMode(light){
  saveThemeColors();
  var btn=document.getElementById('theme-toggle-btn');
  var lbl=document.getElementById('theme-editing-label');
  if(light){
    document.body.classList.add('light');
    if(btn)btn.textContent='☀️';
    if(lbl)lbl.textContent='EDITING: LIGHT';
    loadThemeColors('light');
  } else {
    document.body.classList.remove('light');
    if(btn)btn.textContent='🌙';
    if(lbl)lbl.textContent='EDITING: DARK';
    loadThemeColors('dark');
  }
}
(function(){
  const btn=document.getElementById('theme-toggle-btn');
  if(!btn) return;
  btn.onclick=()=>{
    const goLight=!isLightMode();
    applyThemeMode(goLight);
    localStorage.setItem(THEME_KEY,goLight?'light':'dark');
    if(typeof CloudStore!=='undefined') CloudStore.save('settings');
  };
  // Restore saved theme
  const saved=localStorage.getItem(THEME_KEY);
  if(saved==='light') applyThemeMode(true);
})();

// ── Generic Modal ──
function modalOpen(title,bodyHtml,buttons){
  document.getElementById('modal-title').textContent=title;
  document.getElementById('modal-body').innerHTML=bodyHtml;
  var acts=document.getElementById('modal-actions');
  acts.innerHTML='';
  var primaryBtn=null;
  (buttons||[]).forEach(function(b){
    var btn=document.createElement('button');btn.className='mbtn '+b.cls;btn.textContent=b.text;btn.onclick=b.action;acts.appendChild(btn);
    if(b.cls.indexOf('primary')>=0||b.cls.indexOf('danger')>=0)primaryBtn=btn;
  });
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-box').classList.add('open');
  // Enter key on input triggers primary button
  setTimeout(function(){
    var inp=document.getElementById('modal-input');
    if(inp&&primaryBtn)inp.onkeydown=function(e){if(e.key==='Enter')primaryBtn.click();};
  },60);
}
function modalClose(){
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('modal-box').classList.remove('open');
}

// ── Watchlist (multi-list) ──
var WL_STORAGE_KEY='traderra-watchlists';
var WL_DEFAULT_DATA={lists:[{name:'Default',syms:['AAPL','MSFT','GOOGL','AMZN','NVDA','TSLA','META','SPY','QQQ','AMD','NFLX','DIS']},{name:'Tech',syms:['AAPL','MSFT','GOOGL','AMZN','NVDA','META','NFLX','CRM','ORCL','ADBE']},{name:'Swing',syms:['TSLA','AMD','BABA','PLTR','COIN','SOFI','RIVN','MARA','LCID','NIO']}],active:0};
function wlGetData(){try{var s=localStorage.getItem(WL_STORAGE_KEY);if(s){var d=JSON.parse(s);if(d&&d.lists&&d.lists.length)return d;}}catch(e){}return JSON.parse(JSON.stringify(WL_DEFAULT_DATA));}
function wlSaveData(d){localStorage.setItem(WL_STORAGE_KEY,JSON.stringify(d));wlRender();}
function wlActive(){var d=wlGetData();return d.lists[d.active]||d.lists[0];}
function wlGet(){return wlActive().syms;}
function wlSave(syms){var d=wlGetData();d.lists[d.active].syms=syms;wlSaveData(d);}
function wlAdd(){
  var inp=document.getElementById('wl-add-input');if(!inp)return;
  var s=inp.value.trim().toUpperCase();if(!s)return;
  var wl=wlGet();if(!wl.includes(s)){wl.push(s);wlSave(wl);}
  inp.value='';
}
function wlRemove(sym){var wl=wlGet().filter(function(s){return s!==sym;});wlSave(wl);}
function wlToggleCollapse(){document.getElementById('wl-section').classList.toggle('collapsed');}
function wlSwitchList(idx){var d=wlGetData();d.active=parseInt(idx);wlSaveData(d);}
function wlCreateList(){
  modalOpen('NEW WATCHLIST','<input type="text" id="modal-input" placeholder="e.g. Momentum Plays" autofocus />',[
    {text:'CANCEL',cls:'mbtn-cancel',action:function(){modalClose();}},
    {text:'CREATE',cls:'mbtn-primary',action:function(){
      var inp=document.getElementById('modal-input');if(!inp||!inp.value.trim())return;
      var d=wlGetData();d.lists.push({name:inp.value.trim(),syms:[]});d.active=d.lists.length-1;wlSaveData(d);modalClose();
    }}
  ]);
  setTimeout(function(){var inp=document.getElementById('modal-input');if(inp)inp.focus();},50);
}
function wlDeleteListConfirm(){
  var d=wlGetData();if(d.lists.length<=1){
    modalOpen('CANNOT DELETE','<p>You need at least one watchlist.</p>',[{text:'OK',cls:'mbtn-cancel',action:function(){modalClose();}}]);return;
  }
  modalOpen('DELETE WATCHLIST','<p>Delete "'+wlActive().name+'" and its '+wlActive().syms.length+' symbols?</p>',[
    {text:'CANCEL',cls:'mbtn-cancel',action:function(){modalClose();}},
    {text:'DELETE',cls:'mbtn-danger',action:function(){
      var d=wlGetData();d.lists.splice(d.active,1);d.active=Math.min(d.active,d.lists.length-1);wlSaveData(d);modalClose();
    }}
  ]);
}
function wlRenameListPrompt(){
  var d=wlGetData();
  modalOpen('RENAME WATCHLIST','<input type="text" id="modal-input" value="'+d.lists[d.active].name+'" autofocus />',[
    {text:'CANCEL',cls:'mbtn-cancel',action:function(){modalClose();}},
    {text:'RENAME',cls:'mbtn-primary',action:function(){
      var inp=document.getElementById('modal-input');if(!inp||!inp.value.trim())return;
      var d=wlGetData();d.lists[d.active].name=inp.value.trim();wlSaveData(d);modalClose();
    }}
  ]);
  setTimeout(function(){var inp=document.getElementById('modal-input');if(inp){inp.focus();inp.select();}},50);
}
// ── Watchlist columns ──
var WL_COL_KEY='traderra-wl-cols';
var WL_ALL_COLS=[
  {key:'sym',label:'Symbol',always:true},
  {key:'last',label:'Last'},
  {key:'chg',label:'Chg'},
  {key:'chgPct',label:'Chg%'},
  {key:'vol',label:'Vol'},
  {key:'open',label:'Open'},
  {key:'high',label:'High'},
  {key:'low',label:'Low'},
  {key:'prevClose',label:'Prev Cl'},
  {key:'vwap',label:'VWAP'}
];
var WL_DEFAULT_COLS=['sym','last','chg','chgPct','vol'];
function wlGetCols(){try{var s=localStorage.getItem(WL_COL_KEY);if(s){var p=JSON.parse(s);if(Array.isArray(p)&&p.length)return p;}}catch(e){}return WL_DEFAULT_COLS.slice();}
function wlSaveCols(c){localStorage.setItem(WL_COL_KEY,JSON.stringify(c));wlRender();}
function wlColSettings(){
  var visible=wlGetCols();
  var html='<div style="display:flex;flex-direction:column;gap:6px;">';
  WL_ALL_COLS.forEach(function(col){
    if(col.always)return;
    var on=visible.indexOf(col.key)>=0;
    html+='<label style="display:flex;align-items:center;gap:8px;font-size:11px;color:#8aa0c0;cursor:pointer;">';
    html+='<input type="checkbox" '+(on?'checked':'')+' data-col="'+col.key+'" onchange="wlToggleCol(this)" style="accent-color:#D4AF37;"/>';
    html+=col.label;
    html+='</label>';
  });
  html+='</div>';
  modalOpen('WATCHLIST COLUMNS',html,[{text:'DONE',cls:'mbtn-primary',action:function(){modalClose();}}]);
}
function wlToggleCol(cb){
  var key=cb.dataset.col;
  var cols=wlGetCols();
  if(cb.checked){if(cols.indexOf(key)<0)cols.push(key);}
  else{cols=cols.filter(function(c){return c!==key;});}
  wlSaveCols(cols);
}

// ── BAR CACHE ──
var _barCache={}; // key: sym-tf -> {data, ts}
var BAR_CACHE_TTL=120000; // 2 min
function barCacheKey(sym,tf){return sym+'-'+tf;}
function barCacheGet(sym,tf){
  var k=barCacheKey(sym,tf), entry=_barCache[k];
  if(entry && (Date.now()-entry.ts)<BAR_CACHE_TTL) return entry.data;
  delete _barCache[k];
  return null;
}
function barCachePut(sym,tf,data){_barCache[barCacheKey(sym,tf)]={data:data,ts:Date.now()};}
function barCacheInvalidate(sym){Object.keys(_barCache).forEach(function(k){if(k.startsWith(sym+'-'))delete _barCache[k];});}

function wlRender(){
  var d=wlGetData();var list=d.lists[d.active];
  var picker=document.getElementById('wl-picker');
  if(picker){picker.innerHTML=d.lists.map(function(l,i){return '<option value="'+i+'"'+(i===d.active?' selected':'')+'>'+l.name+'</option>';}).join('');}
  var cols=wlGetCols();
  // Column header
  var hdr=document.getElementById('wl-col-header');
  if(hdr){hdr.innerHTML=cols.map(function(k){var c=WL_ALL_COLS.find(function(x){return x.key===k;});return '<span class="wl-ch">'+(c?c.label:'')+'</span>';}).join('');}
  // Rows
  var el=document.getElementById('wl-list');if(!el)return;
  var syms=list.syms;
  el.innerHTML=syms.map(function(sym){
    var cls=sym===symbol?' active':'';
    var cells=cols.map(function(k){
      if(k==='sym')return '<span class="wl-sym">'+sym+'</span>';
      return '<span class="wl-col" id="wl-'+k+'-'+sym+'">–</span>';
    }).join('');
    return '<div class="wl-row'+cls+'" onclick="wlSelect(\''+sym+'\')">'+cells+'<span class="wl-del" onclick="event.stopPropagation();wlRemove(\''+sym+'\')">✕</span></div>';
  }).join('');
  var cnt=document.getElementById('wl-count');if(cnt)cnt.textContent=syms.length+' symbols';
  // Batch fetch all quotes in ONE request using snapshot endpoint
  wlBatchQuotes(syms);
}
function wlQuote(sym){
  var url='https://api.polygon.io/v2/aggs/ticker/'+sym+'/prev?apiKey='+API_KEY;
  fetch(url).then(function(r){return r.json();}).then(function(d){
    if(!d.results||!d.results.length)return;
    var b=d.results[0];
    var prev=b.o; // use open as prev close proxy if no prevClose
    var cols=wlGetCols();
    cols.forEach(function(k){
      if(k==='sym')return;
      var el=document.getElementById('wl-'+k+'-'+sym);if(!el)return;
      var val='–';
      if(k==='last')val=b.c.toFixed(2);
      else if(k==='chg'){val=(b.c-prev).toFixed(2);el.className='wl-col '+(b.c>=prev?'up':'dn');}
      else if(k==='chgPct'){var pct=((b.c-prev)/prev*100).toFixed(2);val=(pct>=0?'+':'')+pct+'%';el.className='wl-col '+(pct>=0?'up':'dn');}
      else if(k==='vol')val=b.v>=1e6?(b.v/1e6).toFixed(1)+'M':b.v>=1e3?(b.v/1e3).toFixed(0)+'K':b.v.toString();
      else if(k==='open')val=b.o.toFixed(2);
      else if(k==='high')val=b.h.toFixed(2);
      else if(k==='low')val=b.l.toFixed(2);
      else if(k==='prevClose')val=prev.toFixed(2);
      else if(k==='vwap'&&b.vw)val=b.vw.toFixed(2);
      if(val!=='–')el.textContent=val;
    });
  }).catch(function(){});
}
// Batch all watchlist quotes in one snapshot request
function wlBatchQuotes(syms){
  if(!syms||!syms.length) return;
  var tickers=syms.map(function(s){return encodeURIComponent(s);}).join(',');
  var url=POLY+'/v2/snapshot/locale/us/markets/stocks/tickers?tickers='+tickers+'&apiKey='+API_KEY;
  fetch(url).then(function(r){return r.json();}).then(function(d){
    if(!d.tickers) return;
    var cols=wlGetCols();
    d.tickers.forEach(function(t){
      var sym=t.ticker;
      var b=t.prevDay||{};
      var last=t.day||{};
      var q=t.min||{}; // minute bar for real-time
      var closePrice=q.c||last.c||b.c||0;
      var prevClose=b.c||b.o||0;
      if(!closePrice||!prevClose) return;
      cols.forEach(function(k){
        if(k==='sym')return;
        var el=document.getElementById('wl-'+k+'-'+sym);if(!el)return;
        var val='–';
        if(k==='last')val=closePrice.toFixed(2);
        else if(k==='chg'){val=(closePrice-prevClose).toFixed(2);el.className='wl-col '+(closePrice>=prevClose?'up':'dn');}
        else if(k==='chgPct'){var pct=((closePrice-prevClose)/prevClose*100).toFixed(2);val=(pct>=0?'+':'')+pct+'%';el.className='wl-col '+(pct>=0?'up':'dn');}
        else if(k==='vol')val=last.v>=1e6?(last.v/1e6).toFixed(1)+'M':last.v>=1e3?(last.v/1e3).toFixed(0)+'K':(last.v||0).toString();
        else if(k==='open')val=(last.o||b.o||0).toFixed(2);
        else if(k==='high')val=(last.h||b.h||0).toFixed(2);
        else if(k==='low')val=(last.l||b.l||0).toFixed(2);
        else if(k==='prevClose')val=prevClose.toFixed(2);
        else if(k==='vwap'&&last.vw)val=last.vw.toFixed(2);
        if(val!=='–')el.textContent=val;
      });
    });
  }).catch(function(){});
}

function wlSelect(sym){
  setSymbol(sym);
  var inp=document.getElementById('symbol-input');if(inp)inp.value=sym;
  var ti=document.getElementById('ti-sym');if(ti)ti.textContent=sym;
  panels.forEach(function(p,i){var el=document.getElementById('sym-'+i);if(el)el.textContent=sym;});
  wlRender();
  loadAll();
  // Keep live mode ON for watchlist selections
  if(!liveMode) setLiveMode(true);
}

// ── Keep sidebar top synced with actual topbar height ──
function syncSidebarTop(){
  var tb=document.getElementById('topbar'),sb=document.getElementById('sidebar');
  if(tb&&sb) sb.style.top=tb.offsetHeight+'px';
}
if(window.ResizeObserver){var _tbEl=document.getElementById('topbar');if(_tbEl)new ResizeObserver(syncSidebarTop).observe(_tbEl);}
window.addEventListener('resize',syncSidebarTop);
setTimeout(syncSidebarTop,0);

// All indicators computed in JS — no API calls needed for chart rendering

// ── Unified Sidebar ──
function sbOpen(tab){
  selectedAnn=null;hideAnnToolbar();
  var sb=document.getElementById('sidebar');if(!sb)return;
  sb.classList.add('open');
  if(tab)sbTab(tab);
  var ma=document.getElementById('main-area');if(ma)ma.style.marginRight='350px';
  wlRender();
  setTimeout(function(){panels.forEach(function(pp,i){var el=document.getElementById('panel-'+i);if(el&&el.style.display!=='none')resizePanel(pp);});renderAll();},150);
}
function sbClose(){
  var sb=document.getElementById('sidebar');if(!sb)return;
  sb.classList.remove('open');
  var ma=document.getElementById('main-area');if(ma)ma.style.marginRight='0';
  setTimeout(function(){panels.forEach(function(pp,i){var el=document.getElementById('panel-'+i);if(el&&el.style.display!=='none')resizePanel(pp);});renderAll();},150);
}
function sbTab(tab){
  document.querySelectorAll('.sb-tab[data-tab]').forEach(function(t){t.classList.toggle('active',t.dataset.tab===tab);});
  document.querySelectorAll('#sidebar-content>div').forEach(function(d){d.classList.toggle('tab-active',d.id==='tab-'+tab);});
  if(tab==='vault')vaultRender();
  if(tab==='settings')settingsSync();
  if(tab==='tools')openSingleIndSettings(null,0);
  if(tab==='bt')renderScanBtPanel();
  if(tab==='lab')StrategyLab.render();
  saveTabState();
}

// ── Vault: render only active indicators (no tools, no templates, no annotations) ──
var VAULT_EXCLUDE = {tl:1,ann:1,otherann:1,exec:1,btexec:1};
function vaultRender(){
  var el=document.getElementById('vault-list');if(!el)return;
  var p=panels[0];
  if(!p||!p.inds){el.innerHTML='<div style="padding:20px;text-align:center;color:#3a4a60;font-size:11px;">No indicators active</div>';return;}
  // Build lookup of active tools by legacyKey for linking
  var toolByKey = {};
  if(p.tools) p.tools.forEach(function(t){
    if(t.on && t.legacyKeys) t.legacyKeys.forEach(function(lk){ toolByKey[lk]=t; });
    else if(t.on) toolByKey[t.indKey]=t;
  });
  var groups={};
  for(var key in p.inds){
    if(!p.inds[key]) continue; // only ON indicators
    if(VAULT_EXCLUDE[key]) continue; // skip non-indicators
    var reg=IND_REGISTRY[key];
    if(!reg) continue; // skip unknown
    var g=reg.group||'Other';
    if(!groups[g])groups[g]=[];
    groups[g].push({key:key,label:reg.label,colors:reg.colors,colorLabels:reg.colorLabels,hasParams:!!(reg.params&&reg.params.length),hasColors:!!(reg.colors&&reg.colors.length)});
  }
  var html='';
  var hasAny=false;
  for(var gn in groups){
    hasAny=true;
    html+='<div class="vg"><div class="vg-title">'+gn.toUpperCase()+'</div>';
    groups[gn].forEach(function(ind){
      var mainColor=ind.colors?getIndColor(ind.key,0):'#2a3050';
      if(!mainColor||mainColor==='#444') mainColor='#a78bfa';
      var dotColor=mainColor;
      html+='<div class="vi on" onclick="vaultToggle(\''+ind.key+'\')">';
      html+='<span class="vi-dot" style="background:'+dotColor+';color:'+dotColor+'"></span>';
      html+='<span class="vi-name">'+ind.label+'</span>';
      if(ind.colors&&ind.colors.length){
        html+='<span class="vi-colors">';
        ind.colors.forEach(function(ck,ci){
          var cv=getIndColor(ind.key,ci)||C[ck]||'#444';
          html+='<span class="vi-cdot" style="background:'+cv+';"></span>';
        });
        html+='</span>';
      }
      // Gear icon: open tool settings if tool exists, else legacy settings
      var tool = toolByKey[ind.key];
      if(tool){
        html+='<button class="vi-gear" onclick="event.stopPropagation();openToolSettings(\''+tool.id+'\',0)" title="Settings">';
      } else if(ind.hasParams||ind.hasColors){
        html+='<button class="vi-gear" onclick="event.stopPropagation();openSingleIndSettings(\''+ind.key+'\');sbOpen(\'tools\')" title="Settings">';
      }
      if(tool || ind.hasParams || ind.hasColors){
        html+='<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1l.5 2a3.5 3.5 0 011.5.9l1.9-.7.5 1.3-1.7.9a3.5 3.5 0 010 1.2l1.7.9-.5 1.3-1.9-.7a3.5 3.5 0 01-1.5.9L6 11l-.5-2a3.5 3.5 0 01-1.5-.9l-1.9.7-.5-1.3 1.7-.9a3.5 3.5 0 010-1.2l-1.7-.9.5-1.3 1.9.7a3.5 3.5 0 011.5-.9z" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
        html+='</button>';
      }
      html+='</div>';
    });
    html+='</div>';
  }
  if(!hasAny) html='<div style="padding:20px;text-align:center;color:#3a4a60;font-size:11px;font-style:italic;">No indicators active.<br>Use TOOLS tab to add indicators.</div>';
  el.innerHTML=html;
}
function vaultToggle(indKey){
  var p=panels[0];if(!p)return;
  if(!p.inds)p.inds={};
  // Find matching tool and toggle it off
  var tool = null;
  if(p.tools) p.tools.forEach(function(t){
    if(t.legacyKeys && t.legacyKeys.indexOf(indKey)!==-1 && t.on){ tool=t; }
    else if(t.indKey===indKey && t.on){ tool=t; }
  });
  if(tool){
    tool.on=!tool.on;
    p.inds=deriveInds(p.tools);
    renderAll();
    buildIndicatorRow(0);
  } else {
    p.inds[indKey]=!p.inds[indKey];
    loadPanel(p);renderPanel(p);updateScrollbar(p);
  }
  renderHotButtons();
  vaultRender();
}
// ── Settings sync ──
function setFontScale(size){
  var scales={small:{p:8,t:7,o:10,ui:12},medium:{p:10,t:9,o:12,ui:13},large:{p:12,t:11,o:14,ui:15}};
  var s=scales[size];if(!s)return;
  F.p=s.p;F.t=s.t;F.o=s.o;F.ui=s.ui;
  // Scale all UI elements via CSS custom property + font-size on root
  document.documentElement.style.setProperty('--ui-scale', s.ui/13);
  document.documentElement.style.fontSize=s.ui+'px';
  document.body.style.fontSize=s.ui+'px';
  // Apply UI scale to topbar and sidebar
  var tb=document.getElementById('topbar');if(tb)tb.style.fontSize=s.ui+'px';
  var sb=document.getElementById('sidebar');if(sb)sb.style.fontSize=s.ui+'px';
  document.querySelectorAll('.tbtn,.ph,.tf-btn,.is-label,.is-toggle,.sr label,.sst,.sab,.spb').forEach(function(el){el.style.fontSize=Math.round(s.ui*0.85)+'px';});
  try{
  document.getElementById('sf-p').value=s.p;document.getElementById('sf-p-v').textContent=s.p;
  document.getElementById('sf-t').value=s.t;document.getElementById('sf-t-v').textContent=s.t;
  document.getElementById('sf-o').value=s.o;document.getElementById('sf-o-v').textContent=s.o;
  document.getElementById('sf-ui').value=s.ui;document.getElementById('sf-ui-v').textContent=s.ui;
  }catch(e){}
  // Highlight active button
  document.querySelectorAll('#fs-small,#fs-medium,#fs-large').forEach(function(b){b.style.borderColor='#1e2535';b.style.color='#5a6a88';});
  var btn=document.getElementById('fs-'+size);
  if(btn){btn.style.borderColor='#D4AF37';btn.style.color='#D4AF37';}
  // Save
  try{var cfg=JSON.parse(localStorage.getItem('traderra-chart-settings')||'{}');cfg.p=s.p;cfg.t=s.t;cfg.o=s.o;cfg.ui=s.ui;localStorage.setItem('traderra-chart-settings',JSON.stringify(cfg));}catch(e){}
  renderAll();
  toast('Font scale: '+size);
}

function settingsSync(){
  var z=document.getElementById('is-zoom'),zv=document.getElementById('is-zoom-v');
  var t=document.getElementById('is-tpan'),tv=document.getElementById('is-tpan-v');
  var m=document.getElementById('is-mpan'),mv=document.getElementById('is-mpan-v');
  if(z&&zv)zv.textContent=parseFloat(z.value).toFixed(2);
  if(t&&tv)tv.textContent=parseFloat(t.value).toFixed(2);
  if(m&&mv)mv.textContent=parseFloat(m.value).toFixed(1);
}

buildPanels();
requestAnimationFrame(()=>requestAnimationFrame(()=>{
  // Watchlist toggle - removed (now in sidebar)
  // Sync symbol input with restored symbol
  var _si=document.getElementById('symbol-input');if(_si)_si.value=symbol;
  var _ti=document.getElementById('ti-sym');if(_ti)_ti.textContent=symbol;
  wlRender();
  panels.forEach(p=>resizePanel(p));
  if(activePreset==='Mike'&&panels[0]&&panels[0].tf==='5'){
    panels[0].tf='15';
    var el0=document.getElementById('panel-0');
    if(el0) el0.querySelectorAll('.tf-btn').forEach(function(b){b.classList.toggle('active',b.dataset.tf==='15');});
  }
  setLayout(activePreset==='Sam'?4:1);
  initS();
  loadAll();
  // Init cloud sync after everything loaded
  setTimeout(function(){ if(typeof CloudStore!=='undefined') CloudStore.init(); }, 2000);
}));

// ── Sidebar drag divider ──
(function(){
  const divider = document.getElementById('bt-divider');
  const topPane = document.getElementById('bt-top-pane');
  if(!divider||!topPane) return;

  // Default top pane height — set on first open or when sim becomes visible
  let isDragging=false, startY=0, startH=0;

  function initHeight(){
    if(!topPane.style.height){
      // Default: 45% of sidebar inner height
      const sb=document.getElementById('bt-sidebar');
      const hdr=document.getElementById('bt-header');
      const avail=(sb.offsetHeight||600)-(hdr.offsetHeight||32)-6;
      topPane.style.height=Math.round(avail*0.45)+'px';
    }
  }

  divider.addEventListener('mousedown',e=>{
    isDragging=true;
    startY=e.clientY;
    startH=topPane.offsetHeight;
    divider.classList.add('dragging');
    document.body.style.cursor='ns-resize';
    document.body.style.userSelect='none';
    e.preventDefault();
  });

  document.addEventListener('mousemove',e=>{
    if(!isDragging) return;
    const sb=document.getElementById('bt-sidebar');
    const hdr=document.getElementById('bt-header');
    const avail=sb.offsetHeight-(hdr.offsetHeight||32)-6;
    const delta=e.clientY-startY;
    const newH=Math.max(40, Math.min(avail-40, startH+delta));
    topPane.style.height=newH+'px';
  });

  document.addEventListener('mouseup',()=>{
    if(!isDragging) return;
    isDragging=false;
    divider.classList.remove('dragging');
    document.body.style.cursor='';
    document.body.style.userSelect='';
  });

  // Init height when sidebar opens or sim becomes visible
  const btBtn=document.getElementById('bt-btn');
  if(btBtn) btBtn.addEventListener('click',()=>setTimeout(initHeight,50));

  // Also init when updateSimPnl shows the panel
  const simPanel=document.getElementById('bt-sim');
  if(simPanel){
    const obs=new MutationObserver(()=>{ if(simPanel.style.display!=='none') initHeight(); });
    obs.observe(simPanel,{attributes:true,attributeFilter:['style']});
  }
})();

// ── BT Strategy Mode Toggle ──
document.getElementById('bt-strat-long').addEventListener('click',()=>{
  btStrategyMode='long';
  document.getElementById('bt-strat-long').style.borderColor='#00e676';
  document.getElementById('bt-strat-long').style.background='#00e67618';
  document.getElementById('bt-strat-long').style.color='#00e676';
  document.getElementById('bt-strat-short').style.borderColor='#2a3050';
  document.getElementById('bt-strat-short').style.background='none';
  document.getElementById('bt-strat-short').style.color='#4a5580';
  renderAll();
});
document.getElementById('bt-strat-short').addEventListener('click',()=>{
  btStrategyMode='short';
  document.getElementById('bt-strat-short').style.borderColor='#ff5252';
  document.getElementById('bt-strat-short').style.background='#ff525218';
  document.getElementById('bt-strat-short').style.color='#ff5252';
  document.getElementById('bt-strat-long').style.borderColor='#2a3050';
  document.getElementById('bt-strat-long').style.background='none';
  document.getElementById('bt-strat-long').style.color='#4a5580';
  renderAll();
});

// ── Draggable popup ──
(function(){
  const popup=document.getElementById('pct-popup');
  const handle=document.getElementById('pct-popup-title');
  let dx=0,dy=0,dragging=false;
  handle.addEventListener('mousedown',e=>{
    dragging=true; dx=e.clientX-popup.offsetLeft; dy=e.clientY-popup.offsetTop;
    e.preventDefault();
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging) return;
    popup.style.left=(e.clientX-dx)+'px'; popup.style.top=(e.clientY-dy)+'px';
  });
  document.addEventListener('mouseup',()=>{dragging=false;});
})();

// ── Dropdown menus ──
document.querySelectorAll('.dropdown-trigger').forEach(btn=>{
  btn.addEventListener('click',e=>{
    e.stopPropagation();
    const menu=btn.nextElementSibling;
    const wasOpen=menu.classList.contains('open');
    document.querySelectorAll('.dropdown-content').forEach(m=>m.classList.remove('open'));
    document.querySelectorAll('.dropdown-trigger').forEach(b=>b.classList.remove('active'));
    if(!wasOpen){menu.classList.add('open');btn.classList.add('active');}
  });
});
document.addEventListener('click',()=>{
  document.querySelectorAll('.dropdown-content').forEach(m=>m.classList.remove('open'));
  document.querySelectorAll('.dropdown-trigger').forEach(b=>b.classList.remove('active'));
});
document.querySelectorAll('.dropdown-content').forEach(menu=>{
  menu.addEventListener('click',e=>e.stopPropagation());
  // Close dropdown when a tool is selected
  menu.querySelectorAll('.tool-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      // Don't close for highlight/opacity controls
      if(!btn.dataset.tool?.startsWith('hl_')){
        menu.classList.remove('open');
        menu.previousElementSibling?.classList.remove('active');
      }
    });
  });
});




// ══════════════════════════════════════════════════════════
//  INDICATOR SETTINGS POPUP
// ══════════════════════════════════════════════════════════
let indSettingsPanel = -1;

function openIndSettings(panelIdx){
  openSingleIndSettings(null, panelIdx);
}

// Open settings for a single indicator (TV-style per-indicator popup)
function openSingleIndSettings(indKey, panelIdx){
  panelIdx = panelIdx || 0;
  const p = panels[panelIdx];
  if(!p) return;
  const body = document.getElementById('tools-body');
  if(!body) return;
  const label = document.getElementById('tools-ind-label');

  // If no specific indicator, show indicator picker
  if(!indKey){
    if(label) label.textContent='SELECT INDICATOR';
    body.innerHTML = buildToolPickerHTML(panelIdx);
    wireToolDrag(body);
    // Don't call sbOpen here — we're already in sbTab
    return;
  }
  const reg = IND_REGISTRY[indKey];
  if(!reg) return;
  const isOn = !!p.inds[indKey];
  if(label) label.textContent = reg.label;
  let html = '';

  // Back button
  html += '<div style="padding:6px 12px;border-bottom:1px solid #1e2535;">';
  html += '<button onclick="openSingleIndSettings(null,'+panelIdx+')" style="background:none;border:1px solid #2a3050;color:#6a7a98;font-size:11px;font-weight:700;cursor:pointer;padding:3px 10px;border-radius:3px;font-family:monospace;">← Back to list</button>';
  html += '</div>';

  // Toggle row
  html += '<div class="is-item" style="padding:8px 16px;border-bottom:1px solid #1e2535;">';
  html += '<button class="is-toggle '+(isOn?'on':'')+'" data-ind="'+indKey+'" data-panel="'+panelIdx+'" onclick="toggleIndFromPopup(this);openSingleIndSettings(\''+indKey+'\','+panelIdx+')"></button>';
  html += '<span class="is-label" style="min-width:auto;">'+reg.label+'</span>';
  html += '<span style="margin-left:auto;font-size:11px;color:'+(isOn?'#22c55e':'#5a6a88')+';font-weight:700;">'+(isOn?'ON':'OFF')+'</span>';
  html += '</div>';

  // Tabs: Inputs | Style
  var hasParams = reg.params && reg.params.length;
  var hasColors = reg.colors && reg.colors.length;

  if(hasParams || hasColors){
    html += '<div class="ind-set-tabs" style="display:flex;border-bottom:1px solid #1e2535;">';
    if(hasParams) html += '<div class="ind-set-tab active" data-tab="inputs" onmousedown="indSetTab(\''+indKey+'\','+panelIdx+',\'inputs\')" style="flex:1;text-align:center;padding:6px;font-size:11px;font-weight:700;cursor:pointer;color:#D4AF37;border-bottom:2px solid #D4AF37;">Inputs</div>';
    if(hasColors) html += '<div class="ind-set-tab'+(hasParams?'':' active')+'" data-tab="style" onmousedown="indSetTab(\''+indKey+'\','+panelIdx+',\'style\')" style="flex:1;text-align:center;padding:6px;font-size:11px;font-weight:700;cursor:pointer;color:'+(hasParams?'#5a6a88':'#D4AF37')+';border-bottom:'+(hasParams?'none':'2px solid #D4AF37')+';">Style</div>';
    html += '</div>';
  }

  // Inputs tab content
  if(hasParams){
    html += '<div class="ind-set-content" id="isc-inputs" style="padding:12px 16px;">';
    html += '<table style="width:100%;border-collapse:collapse;">';
    for(const prm of reg.params){
      const saved = getIndCustom(indKey, 'params', prm.key);
      const val = saved !== undefined ? saved : prm.def;
      html += '<tr style="border-bottom:1px solid #111620;">';
      html += '<td style="padding:6px 4px;font-size:11px;color:#8aa0c0;font-weight:700;white-space:nowrap;">'+prm.label+'</td>';
      if(prm.type==='toggle'){
        html += '<td style="padding:6px 4px;text-align:right;"><label style="display:flex;align-items:center;justify-content:flex-end;gap:6px;cursor:pointer;"><input type="checkbox" '+(val?'checked':'')+' data-ind="'+indKey+'" data-pkey="'+prm.key+'" onchange="setIndParam(this)" style="width:16px;height:16px;accent-color:#D4AF37;cursor:pointer;"><span style="font-size:11px;color:'+(val?'#22c55e':'#6b7280')+';font-family:monospace;">'+(val?'ON':'OFF')+'</span></label></td>';
      } else {
        html += '<td style="padding:6px 4px;text-align:right;"><input type="number" value="'+val+'" min="'+(prm.min||0)+'" max="'+(prm.max||9999)+'" step="'+(prm.step||1)+'" data-ind="'+indKey+'" data-pkey="'+prm.key+'" onchange="setIndParam(this)" style="width:64px;background:#0a0c12;border:1px solid #1e2535;color:#dde3f0;font-family:monospace;font-size:11px;padding:4px 6px;border-radius:4px;text-align:right;outline:none;"></td>';
      }
      html += '</tr>';
    }
    html += '</table></div>';
  }

  // Style tab content
  if(hasColors){
    html += '<div class="ind-set-content" id="isc-style" style="padding:12px 16px;'+(hasParams?'display:none;':'')+'">';
    html += '<table style="width:100%;border-collapse:collapse;">';
    reg.colors.forEach((colorKey, ci)=>{
      const clbl = reg.colorLabels?.[ci] || colorKey;
      const origColor = getIndCustom(indKey, 'colors', colorKey) || C[colorKey] || '';
      const val = colorToHex(origColor);
      // Extract alpha from rgba, default 1.0
      var alpha = 100;
      var am = origColor.match(/rgba?\(.*?,\s*([\d.]+)\)/);
      if(am) alpha = Math.round(parseFloat(am[1])*100);
      html += '<tr style="border-bottom:1px solid #111620;">';
      html += '<td style="padding:6px 4px;font-size:11px;color:#8aa0c0;font-weight:700;">'+clbl+'</td>';
      html += '<td style="padding:6px 4px;text-align:right;"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">';
      html += '<input type="color" value="'+val+'" data-ind="'+indKey+'" data-ckey="'+colorKey+'" data-orig="'+origColor+'" onchange="setIndColor(this)" style="width:28px;height:22px;border:1px solid #2a3050;border-radius:4px;cursor:pointer;padding:1px;">';
      html += '<input type="range" min="0" max="100" value="'+alpha+'" data-ind="'+indKey+'" data-ckey="'+colorKey+'" oninput="setIndOpacity(this)" style="width:48px;height:14px;accent-color:#D4AF37;cursor:pointer;">';
      html += '<span style="font-size:11px;color:#5a6a88;font-family:monospace;min-width:28px;text-align:right;">'+alpha+'%</span>';
      html += '</div></td>';
      html += '</tr>';
    });
    html += '</table></div>';
  }

  html += '<div style="padding:8px 16px;border-top:1px solid #1e2535;display:flex;gap:6px;">';
  html += '<button onclick="resetIndSettings(\''+indKey+'\','+panelIdx+')" style="flex:1;padding:5px;border:1px solid #ef5350;color:#ef5350;background:transparent;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;font-family:monospace;">↺ RESET</button>';
  html += '<button onclick="openSingleIndSettings(null,'+panelIdx+')" style="flex:1;padding:5px;border:1px solid #D4AF37;color:#D4AF37;background:transparent;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;font-family:monospace;">✓ DONE</button>';
  html += '</div>';

  body.innerHTML = html;
}

// ── TOOL INSTANCE SETTINGS ──
// Opens settings for a specific tool instance by ID
function openToolSettings(toolId, panelIdx){
  panelIdx = panelIdx || 0;
  const p = panels[panelIdx];
  if(!p) return;
  const tool = p.tools?.find(t => t.id === toolId);
  if(!tool) return;
  const cat = IND_CATALOG[tool.indKey];
  if(!cat) return;
  const body = document.getElementById('tools-body');
  if(!body) return;
  const label = document.getElementById('tools-ind-label');
  if(label) label.textContent = tool.name || cat.label;
  
  const prms = toolParams(tool);
  const clrs = toolColors(tool);
  let html = '';

  // Back button
  html += '<div style="padding:6px 12px;border-bottom:1px solid #1e2535;">';
  html += '<button onclick="openSingleIndSettings(null,'+panelIdx+')" style="background:none;border:1px solid #2a3050;color:#6a7a98;font-size:11px;font-weight:700;cursor:pointer;padding:3px 10px;border-radius:3px;font-family:monospace;">← Back to list</button>';
  html += '</div>';

  // Toggle + name row (editable name)
  html += '<div class="is-item" style="padding:8px 16px;border-bottom:1px solid #1e2535;">';
  html += '<button class="is-toggle '+(tool.on?'on':'')+'" data-toolid="'+tool.id+'" data-panel="'+panelIdx+'" onclick="toggleToolById(this,\''+tool.id+'\','+panelIdx+');openToolSettings(\''+tool.id+'\','+panelIdx+')"></button>';
  html += '<input id="tool-name-input" type="text" value="'+(tool.name||cat.label).replace(/"/g,'&quot;')+'" maxlength="30" data-toolid="'+tool.id+'" onchange="setToolName(this)" style="flex:1;min-width:0;background:none;border:1px solid transparent;color:#dde3f0;font-size:14px;font-weight:700;font-family:Inter,system-ui,sans-serif;padding:2px 4px;border-radius:3px;outline:none;cursor:text;" onfocus="this.style.borderColor=\'#D4AF37\';this.select()" onblur="this.style.borderColor=\'transparent\'" title="Click to rename">';
  html += '<span style="margin-left:auto;font-size:11px;color:'+(tool.on?'#22c55e':'#5a6a88')+';font-weight:700;">'+(tool.on?'ON':'OFF')+'</span>';
  html += '</div>';

  // Tabs: Inputs | Style
  var hasParams = cat.params && cat.params.length;
  var hasColors = cat.colors && cat.colors.length;

  if(hasParams || hasColors){
    html += '<div class="ind-set-tabs" style="display:flex;border-bottom:1px solid #1e2535;">';
    if(hasParams) html += '<div class="ind-set-tab active" data-tab="inputs" onmousedown="indSetTab(\''+tool.id+'\','+panelIdx+',\'inputs\')" style="flex:1;text-align:center;padding:6px;font-size:11px;font-weight:700;cursor:pointer;color:#D4AF37;border-bottom:2px solid #D4AF37;">Inputs</div>';
    if(hasColors) html += '<div class="ind-set-tab'+(hasParams?'':' active')+'" data-tab="style" onmousedown="indSetTab(\''+tool.id+'\','+panelIdx+',\'style\')" style="flex:1;text-align:center;padding:6px;font-size:11px;font-weight:700;cursor:pointer;color:'+(hasParams?'#5a6a88':'#D4AF37')+';border-bottom:'+(hasParams?'none':'2px solid #D4AF37')+';">Style</div>';
    html += '</div>';
  }

  // Inputs tab
  if(hasParams){
    html += '<div class="ind-set-content" id="isc-inputs" style="padding:12px 16px;">';
    html += '<table style="width:100%;border-collapse:collapse;">';
    for(const prm of cat.params){
      const val = prms[prm.key] != null ? prms[prm.key] : prm.def;
      html += '<tr style="border-bottom:1px solid #111620;">';
      html += '<td style="padding:6px 4px;font-size:11px;color:#8aa0c0;font-weight:700;white-space:nowrap;">'+prm.label+'</td>';
      if(prm.type==='toggle'){
        html += '<td style="padding:6px 4px;text-align:right;"><label style="display:flex;align-items:center;justify-content:flex-end;gap:6px;cursor:pointer;"><input type="checkbox" '+(val?'checked':'')+' data-toolid="'+tool.id+'" data-pkey="'+prm.key+'" onchange="setToolParam(this)" style="width:16px;height:16px;accent-color:#D4AF37;cursor:pointer;"><span style="font-size:11px;color:'+(val?'#22c55e':'#6b7280')+';font-family:monospace;">'+(val?'ON':'OFF')+'</span></label></td>';
      } else {
        html += '<td style="padding:6px 4px;text-align:right;"><input type="number" value="'+val+'" min="'+(prm.min||0)+'" max="'+(prm.max||9999)+'" step="'+(prm.step||1)+'" data-toolid="'+tool.id+'" data-pkey="'+prm.key+'" onchange="setToolParam(this)" style="width:64px;background:#0a0c12;border:1px solid #1e2535;color:#dde3f0;font-family:monospace;font-size:11px;padding:4px 6px;border-radius:4px;text-align:right;outline:none;"></td>';
      }
      html += '</tr>';
    }
    html += '</table></div>';
  }

  // Style tab
  if(hasColors){
    html += '<div class="ind-set-content" id="isc-style" style="padding:12px 16px;'+(hasParams?'display:none;':'')+'">';
    html += '<table style="width:100%;border-collapse:collapse;">';
    cat.colors.forEach((clrDef, ci) => {
      const clbl = clrDef.label || clrDef.key;
      const origColor = clrs[clrDef.key] || clrDef.def || '';
      const val = colorToHex(origColor);
      var alpha = 100;
      var am = origColor.match(/rgba?\(.*?,\s*([\d.]+)\)/);
      if(am) alpha = Math.round(parseFloat(am[1])*100);
      html += '<tr style="border-bottom:1px solid #111620;">';
      html += '<td style="padding:6px 4px;font-size:11px;color:#8aa0c0;font-weight:700;">'+clbl+'</td>';
      html += '<td style="padding:6px 4px;text-align:right;"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">';
      html += '<input type="color" value="'+val+'" data-toolid="'+tool.id+'" data-ckey="'+clrDef.key+'" data-orig="'+origColor+'" onchange="setToolColor(this)" style="width:28px;height:22px;border:1px solid #2a3050;border-radius:4px;cursor:pointer;padding:1px;">';
      html += '<input type="range" min="0" max="100" value="'+alpha+'" data-toolid="'+tool.id+'" data-ckey="'+clrDef.key+'" oninput="setToolOpacity(this)" style="width:48px;height:14px;accent-color:#D4AF37;cursor:pointer;">';
      html += '<span style="font-size:11px;color:#5a6a88;font-family:monospace;min-width:28px;text-align:right;">'+alpha+'%</span>';
      html += '</div></td>';
      html += '</tr>';
    });
    html += '</table></div>';
  }

  // Hot button toggle
  const isHot = tool.hot;
  const hotLabel = tool.hotLabel || tool.name || (IND_CATALOG[tool.indKey]?.label) || tool.indKey || 'TOOL';
  const hotColor = tool.hotColor || '#D4AF37';
  html += '<div style="padding:8px 16px;border-top:1px solid #1e2535;">';
  html += '<div style="display:flex;align-items:center;gap:8px;">';
  html += '<span style="font-size:11px;color:#8aa0c0;font-weight:700;">SHOW IN TOOLBAR</span>';
  html += '<label style="margin-left:auto;display:flex;align-items:center;gap:6px;cursor:pointer;">';
  html += '<input type="checkbox" '+(isHot?'checked':'')+' data-toolid="'+tool.id+'" onchange="setToolHot(this)" style="width:16px;height:16px;accent-color:#D4AF37;cursor:pointer;">';
  html += '<span style="font-size:11px;color:'+(isHot?'#D4AF37':'#6b7280')+';font-weight:700;font-family:monospace;">'+(isHot?'ON':'OFF')+'</span>';
  html += '</label></div>';
  // label + color inputs (only visible when hot=on)
  html += '<div id="hot-detail-'+tool.id+'" style="display:'+(isHot?'flex':'none')+';gap:8px;align-items:center;margin-top:6px;">';
  html += '<span style="font-size:11px;color:#6b7280;flex-shrink:0;">Label</span>';
  html += '<input type="text" value="'+hotLabel.replace(/"/g,'&quot;')+'" maxlength="12" data-toolid="'+tool.id+'" onchange="setToolHotLabel(this)" style="flex:1;padding:3px 6px;background:#0a0c12;border:1px solid #1e2535;color:#dde3f0;font-size:11px;font-family:monospace;border-radius:3px;">';
  html += '<span style="font-size:11px;color:#6b7280;flex-shrink:0;margin-left:4px;">Color</span>';
  html += '<input type="color" value="'+hotColor+'" data-toolid="'+tool.id+'" onchange="setToolHotColor(this)" style="width:24px;height:20px;border:1px solid #1e2535;background:#0a0c12;cursor:pointer;border-radius:2px;padding:0;">';
  html += '</div></div>';

  // Bottom buttons
  html += '<div style="padding:8px 16px;border-top:1px solid #1e2535;display:flex;gap:6px;">';
  html += '<button onclick="confirmToolSave(\''+tool.id+'\',"+panelIdx+")" id="tool-save-btn" style="flex:2;padding:6px;border:1px solid #D4AF37;color:#000;background:#D4AF37;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;font-family:monospace;">💾 SAVE</button>';
  html += '<button onclick="duplicateTool(\''+tool.id+'\',"+panelIdx+")" style="flex:1;padding:5px;border:1px solid #5a9ae6;color:#5a9ae6;background:transparent;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;font-family:monospace;">⧉ DUPE</button>';
  html += '<button onclick="resetToolSettings(\''+tool.id+'\',"+panelIdx+")" style="flex:1;padding:5px;border:1px solid #ef5350;color:#ef5350;background:transparent;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;font-family:monospace;">↺ RESET</button>';
  html += '<button onclick="deleteToolConfirm(\''+tool.id+'\',"+panelIdx+")" style="flex:1;padding:5px;border:1px solid #ef5350;color:#ef5350;background:transparent;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;font-family:monospace;">✕ DEL</button>';
  html += '</div>';
  html += '<div id="tool-save-status" style="padding:4px 16px 8px;text-align:center;font-size:11px;color:#5a6a88;font-family:monospace;">Changes auto-saved</div>';

  body.innerHTML = html;
}

// Set a param on a tool instance
function setToolParam(input){
  const toolId = input.dataset.toolid;
  const p = panels[0]; if(!p) return;
  const tool = p.tools?.find(t=>t.id===toolId); if(!tool) return;
  if(!tool.params) tool.params = {};
  var val;
  if(input.type==='checkbox'){
    val = input.checked?1:0;
    var lbl=input.nextElementSibling;
    if(lbl){lbl.textContent=val?'ON':'OFF';lbl.style.color=val?'#22c55e':'#6b7280';}
  } else {
    val = parseFloat(input.value);
  }
  tool.params[input.dataset.pkey] = val;
  renderAll();
}

// Set a color on a tool instance
function setToolColor(input){
  const toolId = input.dataset.toolid;
  const p = panels[0]; if(!p) return;
  const tool = p.tools?.find(t=>t.id===toolId); if(!tool) return;
  if(!tool.colors) tool.colors = {};
  const orig = input.dataset.orig || '';
  const finalColor = hexToColor(input.value, orig);
  tool.colors[input.dataset.ckey] = finalColor;
  input.dataset.orig = finalColor;
  renderAll();
}

// Set opacity on a tool instance color
function setToolOpacity(input){
  const toolId = input.dataset.toolid;
  const p = panels[0]; if(!p) return;
  const tool = p.tools?.find(t=>t.id===toolId); if(!tool) return;
  if(!tool.colors) tool.colors = {};
  const ckey = input.dataset.ckey;
  var baseColor = tool.colors[ckey] || '#ffffff';
  var alpha = parseInt(input.value)/100;
  var hex = colorToHex(baseColor);
  var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  var newColor = 'rgba('+r+','+g+','+b+','+alpha+')';
  tool.colors[ckey] = newColor;
  var lbl = input.nextElementSibling;
  if(lbl) lbl.textContent = input.value+'%';
  var cp = input.previousElementSibling;
  if(cp) cp.dataset.orig = newColor;
  renderAll();
}

// Reset tool to catalog defaults
function resetToolSettings(toolId, panelIdx){
  const p = panels[panelIdx||0]; if(!p) return;
  const tool = p.tools?.find(t=>t.id===toolId); if(!tool) return;
  const cat = IND_CATALOG[tool.indKey]; if(!cat) return;
  tool.params = {};
  cat.params.forEach(p => tool.params[p.key] = p.def);
  tool.colors = {};
  cat.colors.forEach(c => tool.colors[c.key] = c.def);
  openToolSettings(toolId, panelIdx);
  renderAll();
  toast((tool.name||cat.label)+' reset to defaults');
}

// Duplicate a tool
function duplicateTool(toolId, panelIdx){
  const p = panels[panelIdx||0]; if(!p) return;
  const tool = p.tools?.find(t=>t.id===toolId); if(!tool) return;
  const dup = {...tool, id:newToolId(), name:(tool.name||'')+' copy', params:{...tool.params}, colors:{...tool.colors}};
  p.tools.push(dup);
  p.inds = deriveInds(p.tools);
  openToolSettings(dup.id, panelIdx);
  renderAll();
  toast('Tool duplicated');
}

// Delete a tool
function confirmToolSave(toolId, panelIdx){
  saveTools();
  const status = document.getElementById('tool-save-status');
  if(status){status.textContent='✓ Saved!';status.style.color='#22c55e';setTimeout(()=>{if(status){status.textContent='Changes auto-saved';status.style.color='#5a6a88';}},2000);}
  const btn = document.getElementById('tool-save-btn');
  if(btn){btn.textContent='✓ SAVED';setTimeout(()=>{if(btn)btn.textContent='💾 SAVE';},1500);}
}

function deleteToolConfirm(toolId, panelIdx){
  removeTool(panelIdx||0, toolId);
  openSingleIndSettings(null, panelIdx||0);
  renderAll();
  buildIndicatorRow(panelIdx||0);
  toast('Tool removed');
}

function setToolHot(input){
  const toolId = input.dataset.toolid;
  const p = panels[0]; if(!p) return;
  const tool = p.tools?.find(t=>t.id===toolId); if(!tool) return;
  tool.hot = input.checked;
  // set defaults when toggling on
  if(tool.hot){
    if(!tool.hotLabel){
      const cat = IND_CATALOG[tool.indKey];
      tool.hotLabel = tool.name || cat?.label || tool.indKey || 'TOOL';
    }
    if(!tool.hotColor) tool.hotColor = '#D4AF37';
  }
  var lbl = input.nextElementSibling;
  if(lbl){lbl.textContent=tool.hot?'ON':'OFF';lbl.style.color=tool.hot?'#D4AF37':'#6b7280';}
  // toggle label/color inputs visibility
  var detailRow = document.getElementById('hot-detail-'+tool.id);
  if(detailRow) detailRow.style.display = tool.hot ? 'flex' : 'none';
  renderHotButtons();
}

function setToolHotLabel(input){
  const toolId = input.dataset.toolid;
  const p = panels[0]; if(!p) return;
  const tool = p.tools?.find(t=>t.id===toolId); if(!tool) return;
  tool.hotLabel = input.value || tool.name || 'TOOL';
  renderHotButtons();
}

function setToolHotColor(input){
  const toolId = input.dataset.toolid;
  const p = panels[0]; if(!p) return;
  const tool = p.tools?.find(t=>t.id===toolId); if(!tool) return;
  tool.hotColor = input.value;
  renderHotButtons();
}

function setToolName(input){
  const toolId = input.dataset.toolid;
  const p = panels[0]; if(!p) return;
  const tool = p.tools?.find(t=>t.id===toolId); if(!tool) return;
  var newName = input.value.trim();
  if(!newName) { input.value = tool.name; return; }
  tool.name = newName;
  // Update the settings header label too
  var label = document.getElementById('tools-ind-label');
  if(label) label.textContent = newName;
  buildIndicatorRow(0);
  renderHotButtons();
}

// ── HOT BUTTONS — toolbar quick-toggles for tools marked as hot ──
// System indKeys that should NEVER appear as hot buttons
var HOT_EXCLUDE = {tl:1,ann:1,otherann:1,exec:1,btexec:1,adjusted:1,adj:1};
function renderHotButtons(){
  // Clear all containers
  const topContainer = document.getElementById('hot-btns-container');
  if(topContainer) topContainer.innerHTML = '';
  panels.forEach(function(p,pi){
    var indHot = document.getElementById('ind-hot-'+pi);
    if(indHot) indHot.innerHTML = '';
  });
  // Build buttons for each panel
  panels.forEach(function(p,pi){
    if(!p.tools) return;
    p.tools.forEach(function(tool){
      if(!tool.hot) return;
      if(HOT_EXCLUDE[tool.indKey]) return;
      const cat = IND_CATALOG[tool.indKey];
      const name = tool.hotLabel || tool.name || cat?.label || tool.indKey;
      const color = tool.hotColor || '#D4AF37';
      const isOn = tool.on;
      function makeBtn(){
        var b = document.createElement('button');
        b.className = 'ptog'+(isOn?' on':'');
        b.style.cssText = 'border-color:'+(isOn?color:'#3a4a68')+';color:'+(isOn?color:'#3a4a68')+';background:#0a0c12;opacity:'+(isOn?1:0.5)+';';
        b.dataset.toolid = tool.id;
        b.dataset.panel = pi;
        b.textContent = name.toUpperCase().slice(0,10);
        b.onmousedown = function(e){
          e.stopPropagation();
          tool.on=!tool.on;
          p.inds=deriveInds(p.tools);
          renderAll();
          buildIndicatorRow(pi);
          renderHotButtons();
          vaultRender();
        };
        b.oncontextmenu = function(e){
          e.preventDefault();
          openToolSettings(tool.id,pi);
        };
        return b;
      }
      // Only add to per-panel ind-row (inside chart area), not top bar
      var indHot = document.getElementById('ind-hot-'+pi);
      if(indHot) indHot.appendChild(makeBtn());
    });
  });
}

// Tab switching inside indicator settings
function indSetTab(indKey, panelIdx, tab){
  document.querySelectorAll('.ind-set-tab').forEach(t=>{
    var isThis = t.dataset.tab===tab;
    t.style.color = isThis ? '#D4AF37' : '#5a6a88';
    t.style.borderBottom = isThis ? '2px solid #D4AF37' : 'none';
    if(isThis) t.classList.add('active'); else t.classList.remove('active');
  });
  var inputsEl = document.getElementById('isc-inputs');
  var styleEl = document.getElementById('isc-style');
  if(inputsEl) inputsEl.style.display = tab==='inputs'?'block':'none';
  if(styleEl) styleEl.style.display = tab==='style'?'block':'none';
}

// Reset indicator to defaults
function resetIndSettings(indKey, panelIdx){
  const reg = IND_REGISTRY[indKey];
  if(!reg) return;
  // Clear custom colors
  if(reg.colors) reg.colors.forEach(ck => saveIndCustom(indKey, 'colors', ck, null));
  // Clear custom params
  if(reg.params) reg.params.forEach(p => saveIndCustom(indKey, 'params', p.key, null));
  // Reload
  openSingleIndSettings(indKey, panelIdx);
  renderAll();
  toast(reg.label+' reset to defaults');
}

// Build all-indicators settings HTML (legacy mode)
function buildAllIndSettingsHTML(panelIdx){
  const p = panels[panelIdx];
  if(!p) return '';
  const groups = {};
  for(const [key, reg] of Object.entries(IND_REGISTRY)){
    const g = reg.group || 'Other';
    if(!groups[g]) groups[g]=[];
    groups[g].push({key, ...reg});
  }
  let html = '';
  for(const [groupName, inds] of Object.entries(groups)){
    html += '<div class="is-group"><div class="is-group-title">'+groupName.toUpperCase()+'</div>';
    for(const ind of inds){
      const isOn = !!p.inds[ind.key];
      html += '<div class="is-item">';
      html += '<button class="is-toggle '+(isOn?'on':'')+'" data-ind="'+ind.key+'" data-panel="'+panelIdx+'" onclick="toggleIndFromPopup(this)"></button>';
      html += '<span class="is-label">'+ind.label+'</span>';
      if(ind.colors){
        html += '<div class="is-colors">';
        ind.colors.forEach((colorKey, ci)=>{
          const label = ind.colorLabels?.[ci] || '';
          const val = getIndCustom(ind.key, 'colors', colorKey) || C[colorKey] || '#ffffff';
          html += '<div style="display:flex;flex-direction:column;align-items:center;gap:1px;"><input type="color" value="'+val+'" data-ind="'+ind.key+'" data-ckey="'+colorKey+'" onchange="setIndColor(this)"><span style="font-size:7px;color:#5a6a88;">'+label+'</span></div>';
        });
        html += '</div>';
      }
      if(ind.params){
        html += '<div class="is-params">';
        for(const prm of ind.params){
          const saved = getIndCustom(ind.key, 'params', prm.key);
          const val = saved !== undefined ? saved : prm.def;
          html += '<div class="is-param"><label>'+prm.label+'</label><input type="number" value="'+val+'" min="'+(prm.min||0)+'" max="'+(prm.max||9999)+'" step="'+(prm.step||1)+'" data-ind="'+ind.key+'" data-pkey="'+prm.key+'" onchange="setIndParam(this)"></div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
  }
  return html;
}

// ── Drag-and-drop reordering for active tool rows ──
function wireToolDrag(container){
  var rows = container.querySelectorAll('.tool-row[draggable]');
  var dragRow = null;
  rows.forEach(function(row){
    // Open settings on click (but not on drag handle or toggle btn)
    row.addEventListener('mousedown', function(e){
      if(e.target.closest('.drag-handle') || e.target.closest('.is-toggle')) return;
      var toolId = row.dataset.toolid;
      var panelIdx = parseInt(row.dataset.panel);
      openToolSettings(toolId, panelIdx);
    });
    row.addEventListener('dragstart', function(e){
      dragRow = row;
      row.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', row.dataset.toolid);
    });
    row.addEventListener('dragend', function(){
      row.style.opacity = '';
      dragRow = null;
      rows.forEach(function(r){ r.style.borderTop=''; r.style.borderBottom=''; });
    });
    row.addEventListener('dragover', function(e){
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if(!dragRow || dragRow === row) return;
      // Clear all indicators
      rows.forEach(function(r){ r.style.borderTop=''; r.style.borderBottom=''; });
      var rect = row.getBoundingClientRect();
      var midY = rect.top + rect.height / 2;
      if(e.clientY < midY) row.style.borderTop = '2px solid #D4AF37';
      else row.style.borderBottom = '2px solid #D4AF37';
    });
    row.addEventListener('dragleave', function(){
      row.style.borderTop = '';
      row.style.borderBottom = '';
    });
    row.addEventListener('drop', function(e){
      e.preventDefault();
      if(!dragRow || dragRow === row) return;
      var p = panels[parseInt(row.dataset.panel)];
      if(!p || !p.tools) return;
      var fromId = dragRow.dataset.toolid;
      var toId = row.dataset.toolid;
      var fromIdx = p.tools.findIndex(function(t){ return t.id===fromId; });
      var toIdx = p.tools.findIndex(function(t){ return t.id===toId; });
      if(fromIdx===-1 || toIdx===-1) return;
      // Determine insert position based on drop location
      var rect = row.getBoundingClientRect();
      var midY = rect.top + rect.height / 2;
      var insertIdx = (e.clientY < midY) ? toIdx : toIdx + 1;
      // Remove from old position, insert at new
      var moved = p.tools.splice(fromIdx, 1)[0];
      if(fromIdx < insertIdx) insertIdx--;
      p.tools.splice(insertIdx, 0, moved);
      p.inds = deriveInds(p.tools);
      renderAll();
      buildIndicatorRow(parseInt(row.dataset.panel));
      renderHotButtons();
    });
  });
}

function closeIndSettings(){
  openSingleIndSettings(null,0);
  renderAll();
}

function buildToolPickerHTML(panelIdx){
  const p=panels[panelIdx];
  if(!p) return '';
  var html='';
  
  // Show active tool instances
  var activeTools = (p.tools||[]).filter(t=>t.on);
  var inactiveTools = (p.tools||[]).filter(t=>!t.on);
  
  if(activeTools.length){
    html+='<div style="padding:6px 12px 3px;font-size:11px;font-weight:700;color:#22c55e;letter-spacing:1px;">● ACTIVE</div>';
    activeTools.forEach(function(tool, idx){
      const cat = IND_CATALOG[tool.indKey];
      const name = tool.name || cat?.label || tool.indKey;
      const isHot = tool.hot;
      html+='<div class="tool-row" draggable="true" data-toolid="'+tool.id+'" data-panel="'+panelIdx+'" style="display:flex;align-items:center;padding:5px 8px 5px 12px;cursor:pointer;border-radius:3px;margin:0 6px 1px;background:#151925;transition:opacity .15s,transform .15s;">';
      html+='<span class="drag-handle" style="cursor:grab;color:#2a3050;font-size:11px;margin-right:4px;user-select:none;" title="Drag to reorder">⠿</span>';
      html+='<button class="is-toggle on" data-toolid="'+tool.id+'" data-panel="'+panelIdx+'" onclick="event.stopPropagation();toggleToolById(this,\''+tool.id+'\','+panelIdx+')" style="margin-right:6px;"></button>';
      html+='<span style="flex:1;font-size:11px;font-weight:700;color:#dde3f0;font-family:Inter,system-ui,sans-serif;">'+name+'</span>';
      html+='<span style="font-size:11px;color:#D4AF37;margin-left:4px;">⚙</span>';
      html+='</div>';
    });
  }
  
  // Show inactive tools
  if(inactiveTools.length){
    html+='<div style="padding:8px 12px 3px;font-size:11px;font-weight:700;color:#5a6a88;letter-spacing:1px;'+(activeTools.length?'border-top:1px solid #1e2535;margin-top:4px;':'')+'">○ INACTIVE</div>';
    inactiveTools.forEach(function(tool){
      const cat = IND_CATALOG[tool.indKey];
      const name = tool.name || cat?.label || tool.indKey;
      const isHot = tool.hot;
      html+='<div style="display:flex;align-items:center;padding:5px 12px;cursor:pointer;border-radius:3px;margin:0 6px 1px;opacity:.6;" onmousedown="openToolSettings(\''+tool.id+'\','+panelIdx+')" onmouseover="this.style.background=\'#151925\'" onmouseout="this.style.background=\'\'">';
      html+='<button class="is-toggle" data-toolid="'+tool.id+'" data-panel="'+panelIdx+'" onclick="event.stopPropagation();toggleToolById(this,\''+tool.id+'\','+panelIdx+')" style="margin-right:6px;"></button>';
      html+='<span style="flex:1;font-size:11px;font-weight:700;color:#5a6a88;font-family:Inter,system-ui,sans-serif;">'+name+'</span>';
      html+='</div>';
    });
  }
  
  if(!p.tools || !p.tools.length){
    html+='<div style="padding:20px 12px;font-size:11px;color:#3a4a60;text-align:center;font-style:italic;">No tools yet. Tap + to add one.</div>';
  }
  
  return html;
}

function toggleToolById(btn, toolId, panelIdx){
  const p=panels[panelIdx];
  if(!p) return;
  const t=p.tools.find(t=>t.id===toolId);
  if(!t) return;
  t.on=!t.on;
  // When turning on, set hot defaults if missing
  if(t.on && !t.hot && !HOT_EXCLUDE[t.indKey]){
    const cat=IND_CATALOG[t.indKey]||IND_REGISTRY[t.indKey];
    t.hot=true;
    if(!t.hotLabel) t.hotLabel=t.name||(cat?.label)||t.indKey||'TOOL';
    if(!t.hotColor) t.hotColor='#D4AF37';
  }
  p.inds=deriveInds(p.tools);
  btn.classList.toggle('on',t.on);
  renderAll();
  // Rebuild list so it moves between active/inactive sections
  buildIndicatorRow(panelIdx);
  renderHotButtons();
  vaultRender();
}

function addAndOpenTool(indKey, panelIdx){
  closeAddToolPopup();
  const tool=addTool(panelIdx,indKey);
  if(!tool) return;
  renderAll();
  buildIndicatorRow(panelIdx);
  openToolSettings(tool.id,panelIdx);
}

function openAddToolPopup(){
  var popup=document.getElementById('add-tool-popup');
  if(!popup)return;
  if(popup.style.display==='flex'){popup.style.display='none';return;}
  var html='<div style="background:#0d0f18;border:1px solid #2a3050;border-radius:8px;width:320px;max-height:420px;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.7);">';
  html+='<div style="padding:12px 16px 8px;display:flex;align-items:center;border-bottom:1px solid #1e2535;">';
  html+='<span style="flex:1;font-size:12px;font-weight:700;color:#D4AF37;letter-spacing:1px;">ADD NEW TOOL</span>';
  html+='<button onclick="closeAddToolPopup()" style="background:none;border:1px solid #2a3050;color:#5a6a88;font-size:12px;cursor:pointer;padding:2px 8px;border-radius:4px;">✕</button>';
  html+='</div>';
  var groups={};
  for(var k in IND_CATALOG){
    var cat=IND_CATALOG[k];
    if(!cat.params && !cat.colors) continue;
    var g=cat.group||'Other';
    if(!groups[g]) groups[g]=[];
    groups[g].push({key:k,cat:cat});
  }
  for(var gName in groups){
    html+='<div style="padding:6px 16px 2px;font-size:8px;font-weight:700;color:#3a4a60;letter-spacing:1px;">'+gName.toUpperCase()+'</div>';
    groups[gName].forEach(function(item){
      html+='<div style="display:flex;align-items:center;padding:8px 16px;cursor:pointer;border-radius:4px;margin:0 8px 1px;" onmousedown="addAndOpenTool(\''+item.key+'\',0)" onmouseover="this.style.background=\'#151925\'" onmouseout="this.style.background=\'\'">';
      html+='<span style="flex:1;font-size:11px;font-weight:700;color:#dde3f0;font-family:Inter,system-ui,sans-serif;">'+item.cat.label+'</span>';
      html+='<span style="font-size:12px;color:#22c55e;font-weight:700;">+</span>';
      html+='</div>';
    });
  }
  html+='</div>';
  popup.innerHTML=html;
  popup.style.display='flex';
}

function closeAddToolPopup(){
  var popup=document.getElementById('add-tool-popup');
  if(popup) popup.style.display='none';
}

// Close popup on backdrop click
document.addEventListener('mousedown',function(e){
  var popup=document.getElementById('add-tool-popup');
  if(!popup||popup.style.display==='none') return;
  if(e.target===popup) closeAddToolPopup();
});

var _isc=document.getElementById('ind-settings-close');if(_isc)_isc.onclick=closeIndSettings;

function toggleIndFromPopup(btn){
  const indKey = btn.dataset.ind;
  const panelIdx = parseInt(btn.dataset.panel);
  const p = panels[panelIdx];
  if(!p) return;
  p.inds[indKey] = !p.inds[indKey];
  btn.classList.toggle('on', p.inds[indKey]);
  const ptog = document.querySelector('.ptog[data-ind="'+indKey+'"][data-panel="'+panelIdx+'"]');
  if(ptog){ ptog.classList.toggle('on', p.inds[indKey]); ptog.classList.toggle('off', !p.inds[indKey]); }
  renderPanel(p); updateScrollbar(p);
  renderIndButtons(); renderHotButtons();
}

function setIndColor(input){
  const indKey = input.dataset.ind;
  const colorKey = input.dataset.ckey;
  const orig = input.dataset.orig || C[colorKey] || '';
  const finalColor = hexToColor(input.value, orig);
  saveIndCustom(indKey, 'colors', colorKey, finalColor);
  C[colorKey] = finalColor;
  // Update data-orig to new color so opacity slider preserves it
  input.dataset.orig = finalColor;
  renderAll();
}
function setIndOpacity(input){
  const indKey = input.dataset.ind;
  const colorKey = input.dataset.ckey;
  var baseColor = getIndCustom(indKey, 'colors', colorKey) || C[colorKey] || '#ffffff';
  var alpha = parseInt(input.value)/100;
  // Convert to rgba with new alpha
  var hex = colorToHex(baseColor);
  var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  var newColor = 'rgba('+r+','+g+','+b+','+alpha+')';
  saveIndCustom(indKey, 'colors', colorKey, newColor);
  C[colorKey] = newColor;
  // Update label
  var lbl = input.nextElementSibling;
  if(lbl) lbl.textContent = input.value+'%';
  // Update data-orig on sibling color picker
  var cp = input.previousElementSibling;
  if(cp) cp.dataset.orig = newColor;
  renderAll();
}

function setIndParam(input){
  const indKey = input.dataset.ind;
  const pkey = input.dataset.pkey;
  var val;
  if(input.type==='checkbox'){
    val=input.checked?1:0;
    var lbl=input.nextElementSibling;
    if(lbl){lbl.textContent=val?'ON':'OFF';lbl.style.color=val?'#22c55e':'#6b7280';}
  } else {
    val=parseFloat(input.value);
    if(isNaN(val)) return;
  }
  saveIndCustom(indKey, 'params', pkey, val);
  // Re-render with updated params
  renderAll();
}

// ── Build indicator row: sync ptog buttons to panel.inds ──
function buildIndicatorRow(panelIdx){
  if(panelIdx==null){panels.forEach(function(_,i){buildIndicatorRow(i);});return;}
  var p=panels[panelIdx];if(!p) return;
  var row=document.getElementById('indrow-'+panelIdx);if(!row) return;
  row.querySelectorAll('.ptog[data-ind]').forEach(function(btn){
    var ind=btn.dataset.ind;
    var isOn=!!p.inds[ind];
    btn.classList.toggle('on',isOn);
    btn.classList.toggle('off',!isOn);
  });
  updatePresetButtons();
  // Refresh sidebar tool list if it's showing
  var label=document.getElementById('tools-ind-label');
  if(label && label.textContent==='SELECT INDICATOR'){
    var body=document.getElementById('tools-body');
    if(body){ body.innerHTML=buildToolPickerHTML(panelIdx); wireToolDrag(body); }
  }
}

// Wire gear buttons
annSetupColorPickerEvents();

// ── LEFT TOOLBAR FLYOUT SYSTEM ──
var _stayDraw=false, _lockAll=false, _hideAll=false, _magnetSnap=false;
var _activeCat=null;

function ltToggle(cat){
  var fo=document.getElementById('fo-'+cat);
  var wasOpen=fo&&fo.classList.contains('open');
  ltCloseAll();
  if(!wasOpen&&fo){
    fo.classList.add('open');
    _activeCat=cat;
    // Position flyout next to the category button
    var btn=document.querySelector('.lt-cat[data-cat="'+cat+'"]');
    if(btn){
      var r=btn.getBoundingClientRect();
      fo.style.top=r.top+'px';
      fo.style.left='38px';
    }
    document.querySelector('.lt-cat[data-cat="'+cat+'"]').classList.add('active');
  }
}
function ltCloseAll(){
  document.querySelectorAll('.lt-flyout').forEach(f=>f.classList.remove('open'));
  document.querySelectorAll('.lt-cat').forEach(c=>c.classList.remove('active'));
  _activeCat=null;
}
function ltPick(el){
  var tool=el.dataset.tool;
  if(!tool) return;
  // Save cat BEFORE ltCloseAll clears it
  var savedCat=_activeCat;
  ltCloseAll();
  setActiveTool(tool);
  // Update category icon to show last-used tool
  if(savedCat){
    var svg=el.querySelector('svg');
    var catBtn=document.querySelector('.lt-cat[data-cat="'+savedCat+'"]');
    if(svg&&catBtn){
      var arrow=document.createElement('span');arrow.className='cat-arrow';arrow.textContent='▸';
      catBtn.innerHTML='';
      catBtn.appendChild(svg.cloneNode(true));
      catBtn.appendChild(arrow);
    }
  }
}
// Close flyouts on click outside
document.addEventListener('mousedown',function(e){
  if(!e.target.closest('.lt-cat')&&!e.target.closest('.lt-flyout')) ltCloseAll();
});
// Override setActiveTool to handle stay-draw and tool highlighting
var _origSetActiveTool=setActiveTool;
setActiveTool=function(tool){
  _origSetActiveTool(tool);
  // Highlight active tool in flyouts
  document.querySelectorAll('.lt-fo-item').forEach(el=>el.classList.toggle('active',el.dataset.tool===tool));
};
// Also highlight existing flat buttons (edit, del)
document.querySelectorAll('#left-toolbar .lt-btn.tool-btn[data-tool]').forEach(btn=>{
  btn.addEventListener('click',function(){
    const t=btn.dataset.tool;
    setActiveTool(activeTool===t?null:t);
  });
});

// ── CHART STYLE & UTILITIES (from toolbar2) ──
var _chartStyle='candles';
function setChartStyle(style){
  _chartStyle=style;
  try{localStorage.setItem('traderra-chart-style',style);}catch(e){}
  renderAll();
}
try{var _cs=localStorage.getItem('traderra-chart-style');if(_cs)setChartStyle(_cs);}catch(e){}

function chartScreenshot(){
  var p=panels[0];
  if(!p||!p.canvas){toast('No chart to capture');return;}
  var link=document.createElement('a');
  link.download=(p.sym||'chart')+'_'+new Date().toISOString().slice(0,19).replace(/:/g,'-')+'.png';
  link.href=p.canvas.toDataURL('image/png');
  link.click();
  toast('Chart saved as PNG');
}

var _drawHistory=[];var _drawRedoStack=[];
function drawingPushHistory(){_drawHistory.push(JSON.stringify(annotations));if(_drawHistory.length>50)_drawHistory.shift();_drawRedoStack=[];}
function drawingUndo(){if(!_drawHistory.length){toast('Nothing to undo');return;}_drawRedoStack.push(JSON.stringify(annotations));annotations=JSON.parse(_drawHistory.pop());selectedAnn=null;hideAnnToolbar();renderAll();toast('Undo');}
function drawingRedo(){if(!_drawRedoStack.length){toast('Nothing to redo');return;}_drawHistory.push(JSON.stringify(annotations));annotations=JSON.parse(_drawRedoStack.pop());selectedAnn=null;hideAnnToolbar();renderAll();toast('Redo');}
document.addEventListener('keydown',function(e){if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){e.preventDefault();drawingUndo();}if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){e.preventDefault();drawingRedo();}});
var _origSaveAnns=saveAnnotations;
saveAnnotations=function(){if(!_drawHistory.length||JSON.stringify(annotations)!==_drawHistory[_drawHistory.length-1]){drawingPushHistory();}_origSaveAnns();};

// ── RIGHT-CLICK CONTEXT MENU ──
function ctxClose(){document.getElementById('ctx-menu').classList.remove('open');}
document.addEventListener('mousedown',function(e){if(!e.target.closest('#ctx-menu'))ctxClose();});
document.addEventListener('keydown',function(e){if(e.key==='Escape')ctxClose();});
document.addEventListener('contextmenu',function(e){
  var cwrap=e.target.closest('.cwrap');
  if(!cwrap)return;
  e.preventDefault();
  var menu=document.getElementById('ctx-menu');
  menu.style.left=Math.min(e.clientX,window.innerWidth-220)+'px';
  menu.style.top=Math.min(e.clientY,window.innerHeight-400)+'px';
  menu.classList.add('open');
});

// ── INDICATOR QUICK-BUTTONS ──
var IND_BTN_KEY='traderra-ind-buttons';
var indButtons=JSON.parse(localStorage.getItem(IND_BTN_KEY)||'[]');

function renderIndButtons(){
  var c=document.getElementById('ind-btns-container');if(!c)return;
  c.innerHTML='';
  indButtons.forEach(function(ib,idx){
    var b=document.createElement('button');
    b.className='ind-qbtn';
    var isActive=panels[0]&&panels[0].inds[ib.indKey];
    b.style.borderColor=ib.color||'#5a6a88';
    b.style.color=ib.color||'#5a6a88';
    if(isActive)b.classList.add('active');
    b.title=(IND_REGISTRY[ib.indKey]?IND_REGISTRY[ib.indKey].label:ib.indKey)+(ib.name!==ib.indKey?' ('+ib.indKey+')':'');
    var nameSpan=document.createElement('span');
    nameSpan.textContent=ib.name||ib.indKey;
    b.appendChild(nameSpan);
    var rm=document.createElement('span');
    rm.className='iq-remove';
    rm.textContent='✕';
    rm.onmousedown=function(e){e.stopPropagation();removeIndBtn(idx);};
    b.appendChild(rm);
    b.onmousedown=function(e){
      if(e.target.classList.contains('iq-remove'))return;
      if(e.button===0) toggleIndBtn(ib);
      else if(e.button===2){e.preventDefault();editIndBtn(idx);}
    };
    b.oncontextmenu=function(e){e.preventDefault();editIndBtn(idx);};
    c.appendChild(b);
  });
}

function toggleIndBtn(ib){
  if(!panels[0])return;
  var p=panels[0];
  var wasOn=!!p.inds[ib.indKey];
  p.inds[ib.indKey]=!wasOn;
  // Apply saved params if toggling on
  if(!wasOn && ib.params){
    for(var pk in ib.params){
      saveIndCustom(ib.indKey,'params',pk,ib.params[pk]);
    }
  }
  buildIndicatorRow(0);
  renderIndButtons(); renderHotButtons();
  renderAll();
  toast(ib.name+': '+(wasOn?'OFF':'ON'));
}

function removeIndBtn(idx){
  indButtons.splice(idx,1);
  localStorage.setItem(IND_BTN_KEY,JSON.stringify(indButtons));
  renderIndButtons(); renderHotButtons();
  toast('Button removed');
}

function openIndBtnPopup(editIdx,editIb){
  var popup=document.getElementById('ind-btn-popup');
  if(!popup)return;
  popup.classList.add('open');
  var editMode=editIdx!=null;
  popup.style.left=Math.min(window.innerWidth/2-160,window.innerWidth-340)+'px';
  popup.style.top='50px';
  // Populate indicator dropdown
  var sel=popup.querySelector('#ibp-ind');
  sel.innerHTML='';
  for(var k in IND_REGISTRY){
    var reg=IND_REGISTRY[k];
    if(!reg.colors&&k!=='vol'&&k!=='pdc')continue; // skip annotation-only
    var opt=document.createElement('option');
    opt.value=k;opt.textContent=reg.label+' ('+reg.group+')';
    sel.appendChild(opt);
  }
  var nameInput=popup.querySelector('#ibp-name');
  var colorInput=popup.querySelector('#ibp-color');
  var paramsDiv=popup.querySelector('#ibp-params');
  var saveBtn=popup.querySelector('#ibp-save');

  if(editMode&&editIb){
    sel.value=editIb.indKey;
    nameInput.value=editIb.name||'';
    colorInput.value=editIb.color||'#5a6a88';
  } else {
    nameInput.value='';
    colorInput.value='#D4AF37';
  }

  function buildParams(){
    paramsDiv.innerHTML='';
    var k=sel.value;
    var reg=IND_REGISTRY[k];
    if(!reg||!reg.params)return;
    reg.params.forEach(function(prm){
      var lbl=document.createElement('label');
      lbl.textContent=prm.label;
      paramsDiv.appendChild(lbl);
      var inp=document.createElement('input');
      inp.type=prm.type==='toggle'?'checkbox':'number';
      inp.id='ibp-p-'+prm.key;
      if(prm.type!=='toggle'){
        inp.step=prm.step||'1';
        inp.min=prm.min||'0';
        inp.max=prm.max||'999';
      }
      var savedVal=editMode&&editIb&&editIb.params&&editIb.params[prm.key]!=null?editIb.params[prm.key]:(function(){var v=getIndCustom(k,'params',prm.key);return v!=null?v:prm.def;})();
      if(prm.type==='toggle'){inp.checked=!!savedVal;}
      else{inp.value=savedVal;}
      paramsDiv.appendChild(inp);
    });
  }
  sel.onchange=buildParams;
  buildParams();

  saveBtn.onclick=function(){
    var ib=editIb||{};
    ib.indKey=sel.value;
    ib.name=nameInput.value||IND_REGISTRY[sel.value].label;
    ib.color=colorInput.value;
    ib.params={};
    var reg=IND_REGISTRY[ib.indKey];
    if(reg&&reg.params){
      reg.params.forEach(function(prm){
        var el=document.getElementById('ibp-p-'+prm.key);
        ib.params[prm.key]=prm.type==='toggle'?(el.checked?1:0):(parseFloat(el.value)||prm.def);
      });
    }
    if(!editMode){
      indButtons.push(ib);
    } else {
      indButtons[editIdx]=ib;
    }
    localStorage.setItem(IND_BTN_KEY,JSON.stringify(indButtons));
    popup.classList.remove('open');
    renderIndButtons(); renderHotButtons();
    toast(editMode?'Button updated':'Button added');
  };
}

function editIndBtn(idx){
  openIndBtnPopup(idx,indButtons[idx]);
}

// Close popup on outside click or Escape
function closeIndBtnPopup(){var p=document.getElementById('ind-btn-popup');if(p)p.classList.remove('open');}
document.addEventListener('mousedown',function(e){
  var p=document.getElementById('ind-btn-popup');
  if(!p||!p.classList.contains('open'))return;
  if(!p.contains(e.target)&&!e.target.closest('#add-ind-btn'))closeIndBtnPopup();
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeIndBtnPopup();});

// Init on load
renderIndButtons(); renderHotButtons();

// ── CHART TEMPLATES ──
var TPL_KEY='traderra-templates';
var templates=JSON.parse(localStorage.getItem(TPL_KEY)||'[]');
var activeTemplateIdx=-1; // tracks last-applied template

function renderTemplateList(){
  var list=document.getElementById('tpl-list');
  if(!list)return;
  list.innerHTML='';
  if(!templates.length){
    list.innerHTML='<div style="padding:4px 10px;font-size:11px;color:#4a6080;font-style:italic;">No saved templates</div>';
    return;
  }
  templates.forEach(function(tpl,idx){
    var d=document.createElement('div');
    d.className='tpl-item';
    d.innerHTML='<span>📂 '+tpl.name+'</span><span style="margin-left:auto;display:flex;gap:4px;align-items:center;"><span class="tpl-share" onmousedown="event.stopPropagation();shareTemplate('+idx+')" title="Share" style="color:#4a6080;font-size:11px;cursor:pointer;opacity:0;transition:opacity .15s;">🔗</span><span class="tpl-del" onmousedown="event.stopPropagation();deleteTemplate('+idx+')">✕</span></span>';
    d.onmousedown=function(){applyTemplate(idx);};
    list.appendChild(d);
  });
  // Show/hide update button
  var ub=document.getElementById('tpl-update-btn');
  if(ub) ub.style.display=(activeTemplateIdx>=0&&templates[activeTemplateIdx])?'':'none';
}

function saveNewTemplate(){
  modalOpen('💾 SAVE TEMPLATE','<p>Name this chart template. It will save all active indicators, their parameters, and chart style.</p><input type="text" id="modal-input" placeholder="e.g. Mike Daily, Scalp, Swing..." autofocus>',[
    {text:'Cancel',cls:'mbtn-cancel',action:modalClose},
    {text:'💾 Save Template',cls:'mbtn-primary',action:function(){
      var name=document.getElementById('modal-input').value.trim();
      if(!name)return;
      var p=panels[0];if(!p)return;
      var isLight=document.body.classList.contains('light');
      var tpl={
        id:'tpl_'+Date.now(),
        name:name,
        chartStyle:_chartStyle,
        theme:isLight?'light':'dark',
        inds:Object.assign({},p.inds),
        tools:JSON.parse(JSON.stringify(p.tools||[])),
        colors:{},
        params:{},
        ts:Date.now()
      };
      for(var ik in p.inds){
        if(!p.inds[ik])continue;
        var reg=IND_REGISTRY[ik];
        if(!reg)continue;
        if(reg.params){
          tpl.params[ik]={};
          reg.params.forEach(function(prm){
            tpl.params[ik][prm.key]=(function(){var v=getIndCustom(ik,'params',prm.key);return v!=null?v:prm.def;})();
          });
        }
      }
      templates.push(tpl);
      localStorage.setItem(TPL_KEY,JSON.stringify(templates));
      renderTemplateList();
      modalClose();
      toast('Template "'+name+'" saved');
    }}
  ]);
}

function updateCurrentTemplate(){
  if(activeTemplateIdx<0||!templates[activeTemplateIdx]){toast('No active template to update');return;}
  var p=panels[0];if(!p)return;
  var tpl=templates[activeTemplateIdx];
  var isLight=document.body.classList.contains('light');
  tpl.chartStyle=_chartStyle;
  tpl.theme=isLight?'light':'dark';
  tpl.inds=Object.assign({},p.inds);
  tpl.tools=JSON.parse(JSON.stringify(p.tools||[]));
  tpl.ts=Date.now();
  localStorage.setItem(TPL_KEY,JSON.stringify(templates));
  renderTemplateList();
  toast('Template "'+tpl.name+'" updated');
  document.getElementById('tpl-dropdown').classList.remove('open');
}

function applyTemplate(idx){
  var tpl=templates[idx];if(!tpl)return;
  activeTemplateIdx=idx;
  var p=panels[0];if(!p)return;
  // Restore tools if template has them
  if(tpl.tools && tpl.tools.length){
    p.tools = JSON.parse(JSON.stringify(tpl.tools));
    p.inds = deriveInds(p.tools);
  } else {
    // Legacy template — use old inds format and migrate
    p.inds=Object.assign({},tpl.inds);
    p.tools = [];
    migrateIndsToTools(p);
  }
  // Apply saved params (legacy support)
  if(tpl.params){
    for(var ik in tpl.params){
      if(!tpl.params[ik])continue;
      for(var pk in tpl.params[ik]){
        saveIndCustom(ik,'params',pk,tpl.params[ik][pk]);
      }
    }
  }
  if(tpl.chartStyle) setChartStyle(tpl.chartStyle);
  // Restore theme
  if(tpl.theme==='light'&&!document.body.classList.contains('light')){document.body.classList.add('light');var tb=document.getElementById('theme-toggle-btn');if(tb)tb.textContent='☀';}
  else if(tpl.theme==='dark'&&document.body.classList.contains('light')){document.body.classList.remove('light');var tb=document.getElementById('theme-toggle-btn');if(tb)tb.textContent='🌙';}
  buildIndicatorRow(0);
  renderIndButtons(); renderHotButtons();
  renderAll();
  toast('Template "'+tpl.name+'" applied');
  // Close dropdown
  document.getElementById('tpl-dropdown').classList.remove('open');
}

function deleteTemplate(idx){
  var name=templates[idx]?templates[idx].name:'template';
  templates.splice(idx,1);
  if(activeTemplateIdx===idx) activeTemplateIdx=-1;
  else if(activeTemplateIdx>idx) activeTemplateIdx--;
  localStorage.setItem(TPL_KEY,JSON.stringify(templates));
  renderTemplateList();
  toast('Template "'+name+'" deleted');
}

// ── COMMUNITY SHARING ──
function shareTemplate(idx){
  var tpl=templates[idx];if(!tpl)return;
  toast('Creating share link...');
  fetch('/api/shared',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'template',sourceId:tpl.id||tpl.name,name:tpl.name})})
    .then(function(r){return r.json()})
    .then(function(d){
      if(d.error){toast('Share failed: '+d.error);return;}
      var url='https://traderra-lime.vercel.app/shared/'+d.slug;
      navigator.clipboard.writeText(url).then(function(){toast('Link copied! '+url);}).catch(function(){toast('Share link: '+url);});
    })
    .catch(function(e){toast('Share failed: '+e.message);});
}

function shareScan(scanId){
  var scan=ScanManager.scans.find(function(s){return s.id===scanId});
  if(!scan){toast('Scan not found');return;}
  toast('Creating share link...');
  fetch('/api/shared',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'scan',sourceId:scan.id,name:scan.name})})
    .then(function(r){return r.json()})
    .then(function(d){
      if(d.error){toast('Share failed: '+d.error);return;}
      var url='https://traderra-lime.vercel.app/shared/'+d.slug;
      navigator.clipboard.writeText(url).then(function(){toast('Link copied! '+url);}).catch(function(){toast('Share link: '+url);});
    })
    .catch(function(e){toast('Share failed: '+e.message);});
}

function importSharedItem(slug){
  fetch('/api/shared/'+slug).then(function(r){return r.json()}).then(function(d){
    if(d.error){toast('Import failed: '+d.error);return;}
    if(d.type==='template'){
      var p=panels[0];if(!p){toast('No chart panel');return;}
      if(d.data&&d.data.tools){p.tools=JSON.parse(JSON.stringify(d.data.tools));p.inds=deriveInds(p.tools);}
      buildIndicatorRow(0);renderIndButtons();renderHotButtons();renderAll();
      toast('Imported template: '+d.name);
    } else if(d.type==='scan'){
      // Save as a new scan in user's account
      var scanData={name:'Imported: '+d.name,type:d.data.type||'imported',strategy:d.data.strategy||'custom',code:d.data.code||null,dateRange:d.data.dateRange?JSON.stringify(d.data.dateRange):null,filterMode:d.data.filterMode||'3',tags:d.data.tags?JSON.stringify(d.data.tags):'[]',results:'[]'};
      fetch('/api/scans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(scanData)}).then(function(r){return r.json()}).then(function(res){
        if(res.scan){ScanManager.load();toast('Imported scan: '+d.name);}
        else toast('Import scan failed');
      }).catch(function(){toast('Import scan failed');});
    } else {
      toast('Unknown shared type: '+d.type);
    }
    // Clean URL
    if(history.replaceState) history.replaceState(null,'',location.pathname);
  }).catch(function(e){toast('Import failed: '+e.message);});
}

// Auto-import on page load if ?importShared=slug
(function(){
  var m=location.search.match(/[?&]importShared=([a-zA-Z0-9_-]+)/);
  if(m) setTimeout(function(){importSharedItem(m[1])},1500);
})();

renderTemplateList();

// ── TOOLBAR DRAG ──
(function(){
  var handle=document.getElementById('ann-toolbar-handle');
  var tb=document.getElementById('ann-toolbar');
  if(!handle||!tb) return;
  var dragging=false, ox=0, oy=0;
  // Restore saved position
  try{
    var sp=JSON.parse(localStorage.getItem('traderra-ann-tb-pos')||'null');
    if(sp){tb.style.left=sp.left+'px';tb.style.top=sp.top+'px';}
  }catch(e){}
  handle.addEventListener('mousedown',function(e){
    dragging=true;
    ox=e.clientX-tb.offsetLeft;
    oy=e.clientY-tb.offsetTop;
    handle.style.cursor='grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove',function(e){
    if(!dragging) return;
    tb.style.left=Math.max(0,Math.min(window.innerWidth-100,e.clientX-ox))+'px';
    tb.style.top=Math.max(36,Math.min(window.innerHeight-50,e.clientY-oy))+'px';
  });
  document.addEventListener('mouseup',function(){
    if(!dragging) return;
    dragging=false;
    handle.style.cursor='grab';
    // Save position
    try{localStorage.setItem('traderra-ann-tb-pos',JSON.stringify({left:tb.offsetLeft,top:tb.offsetTop}));}catch(e){}
  });
})();

// ── GLOBAL KEYBOARD SHORTCUTS FOR SELECTION ──
document.addEventListener('keydown',function(e){
  // Don't intercept if typing in an input
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT') return;
  if(e.key==='Delete'||e.key==='Backspace'){
    if(selectedAnn){annDelete();e.preventDefault();}
  }
  if(e.key==='Escape'){
    if(selectedAnn){selectedAnn=null;hideAnnToolbar();renderAll();}
