/* ============================================================
   MLEA POS v6.0 — 14-dev-console.js
   Hidden developer repair console
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */

// ════════════════════════════════════════════
// DEVELOPER BACKDOOR
// Activation: type  d e v c o n s o l e  anywhere
// Then enter developer password when prompted.
// Never linked from any UI. Fully hidden.
// All access logged to activityLogs (immutable).
// ════════════════════════════════════════════

// Secret key sequence: "devconsole" (no modifier keys needed)
const _DEV_SEQ = 'devconsole';
let _devBuf = '';
let _devLastKey = 0;

function _devSeqDetect(key) {
  // Guard: some key events (mobile keyboards, IME, autofill) fire with
  // key === undefined. Bail out safely instead of throwing on .length.
  if (typeof key !== 'string') return;
  const now = Date.now();
  // Reset buffer if >2s gap between keystrokes
  if (now - _devLastKey > 2000) _devBuf = '';
  _devLastKey = now;
  // Only track lowercase letters
  if (key.length === 1 && /[a-z]/.test(key)) {
    _devBuf = (_devBuf + key).slice(-_DEV_SEQ.length);
    if (_devBuf === _DEV_SEQ) {
      _devBuf = '';
      _showDevAuth();
    }
  }
}

// ── Mobile activation: tap the header title 7× within 3s ──
// Phones have no physical keyboard, so the "devconsole" typing
// trigger can't fire. This hidden tap-gesture is the mobile
// equivalent. It still requires the developer password after,
// so it grants no access on its own.
const _DEV_TAP_COUNT = 7;
const _DEV_TAP_WINDOW = 3000; // ms
let _devTaps = 0;
let _devTapTimer = null;
function _devRegisterTap() {
  _devTaps++;
  clearTimeout(_devTapTimer);
  _devTapTimer = setTimeout(() => { _devTaps = 0; }, _DEV_TAP_WINDOW);
  // Subtle feedback once they're past the halfway mark (lets a dev know
  // the gesture is registering, without revealing it to normal users)
  if (_devTaps >= 4 && _devTaps < _DEV_TAP_COUNT && typeof toast === 'function') {
    toast(`${_DEV_TAP_COUNT - _devTaps} more…`, 'gold', 800);
  }
  if (_devTaps >= _DEV_TAP_COUNT) {
    _devTaps = 0;
    clearTimeout(_devTapTimer);
    _showDevAuth();
  }
}
// Wire the gesture onto tap targets once the DOM is ready.
// Targets: header title (in-app), login logo, and license logo —
// so the console is reachable before login too (e.g. to reset a
// locked-out PIN from the lock screen).
(function _devWireTap() {
  function attachOne(el) {
    if (el && !el._devTapWired) {
      el._devTapWired = true;
      el.addEventListener('click', _devRegisterTap);
    }
  }
  function attach() {
    attachOne(document.getElementById('hdrTitle'));
    attachOne(document.querySelector('.log-icon'));
    attachOne(document.querySelector('.lic-logo'));
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
  // Screens render/re-render at different times, so retry a few times.
  setTimeout(attach, 1500);
  setTimeout(attach, 4000);
})();

// Developer password hash (SHA-256 of "MLEAdev#2024!")
// To change: run hashPIN('yourpassword','devstatic') and replace hash below
const _DEV_PWD_HASH = 'devstatic:' + ''; // placeholder — computed on first load
let _devPwdReady = false;

// Pre-compute the dev password hash on load so comparison is instant
(async function() {
  try {
    const hex = await _sha256hex('devstatic' + 'MLEAdev#2024!');
    window._DEV_HASH = 'devstatic:' + hex;
    _devPwdReady = true;
  } catch(e) {
    // Fallback if crypto unavailable
    window._DEV_HASH = null;
    _devPwdReady = false;
  }
})();

function _showDevAuth() {
  // Remove any existing dev UI first
  document.getElementById('_devOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_devOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.97);z-index:9998;display:flex;justify-content:center;align-items:center;padding:20px;font-family:var(--fm)';
  overlay.innerHTML = `
    <div style="background:#0a0f1a;border:1px solid rgba(212,168,83,.4);border-radius:16px;padding:32px 28px;width:100%;max-width:380px;box-shadow:0 0 60px rgba(212,168,83,.15)">
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:2em;margin-bottom:8px">⚙️</div>
        <div style="font-family:var(--ff);font-size:1.1em;font-weight:700;color:var(--gold)">Developer Console</div>
        <div style="font-size:.72em;color:rgba(255,255,255,.3);margin-top:4px">Restricted access — all sessions logged</div>
      </div>
      <input type="password" id="_devPwd" placeholder="Developer password"
        style="width:100%;padding:12px 16px;background:rgba(255,255,255,.05);border:1px solid rgba(212,168,83,.3);border-radius:10px;color:#fff;font-family:var(--fm);font-size:.95em;outline:none;margin-bottom:8px"
        onkeypress="if(event.key==='Enter')_devAuth()">
      <div id="_devAuthErr" style="color:var(--rose);font-size:.75em;min-height:18px;margin-bottom:12px;font-weight:600;text-align:center"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button onclick="document.getElementById('_devOverlay').remove()"
          style="padding:10px;background:rgba(240,101,119,.1);border:1px solid rgba(240,101,119,.3);border-radius:8px;color:var(--rose);cursor:pointer;font-family:var(--ff);font-size:.82em">Cancel</button>
        <button onclick="_devAuth()"
          style="padding:10px;background:linear-gradient(135deg,var(--gold),#e8b850);border:none;border-radius:8px;color:#1a0f00;cursor:pointer;font-family:var(--ff);font-size:.82em;font-weight:700">Authenticate</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('_devPwd')?.focus(), 100);
}

async function _devAuth() {
  const pwd = document.getElementById('_devPwd')?.value || '';
  const errEl = document.getElementById('_devAuthErr');
  if (!pwd) { if(errEl) errEl.textContent = 'Password required'; return; }

  // Hash the entered password and compare
  let match = false;
  if (_devPwdReady && window._DEV_HASH) {
    const hex = await _sha256hex('devstatic' + pwd);
    match = ('devstatic:' + hex) === window._DEV_HASH;
  } else {
    // Fallback if crypto failed to init
    match = pwd === 'MLEAdev#2024!';
  }

  if (!match) {
    if(errEl) errEl.textContent = 'Incorrect password';
    // Log failed attempt
    const entry = {
      userId: currentUser?.id || 0,
      userName: currentUser?.name || 'Unknown',
      userRole: currentUser?.role || 'unknown',
      branchId: currentUser?.branchId || null,
      action: 'DEV ACCESS DENIED',
      details: `Failed developer console auth attempt at ${new Date().toLocaleString('en-PH')}`,
      timestamp: new Date().toISOString()
    };
    LocalDB.add('activityLogs', entry);
    return;
  }

  // Authenticated — log it
  const entry = {
    userId: currentUser?.id || 0,
    userName: currentUser?.name || 'System',
    userRole: currentUser?.role || 'developer',
    branchId: null,
    action: '⚠️ DEV CONSOLE ACCESS',
    details: `Developer console opened at ${new Date().toLocaleString('en-PH')}`,
    timestamp: new Date().toISOString()
  };
  LocalDB.add('activityLogs', entry);
  if (storageMode === 'firebase') FirebaseDB.add('activityLogs', entry);

  document.getElementById('_devOverlay').remove();
  _showDevConsole();
}

function _showDevConsole() {
  document.getElementById('_devConsole')?.remove();

  const panel = document.createElement('div');
  panel.id = '_devConsole';
  panel.style.cssText = 'position:fixed;inset:0;background:#080b14;z-index:9997;overflow-y:auto;padding:0 0 40px;font-family:var(--fm)';

  // Run integrity check immediately
  const integ = _devRunIntegrityCheck();

  panel.innerHTML = `
    <div style="background:#0a0f1a;border-bottom:1px solid rgba(212,168,83,.3);padding:16px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10">
      <div>
        <div style="font-family:var(--ff);font-size:1em;font-weight:700;color:var(--gold)">⚙️ MLEA Developer Console</div>
        <div style="font-size:.68em;color:rgba(255,255,255,.3);margin-top:2px">v6.0 · Session logged · ${new Date().toLocaleString('en-PH')}</div>
      </div>
      <button onclick="document.getElementById('_devConsole').remove()"
        style="background:rgba(240,101,119,.15);border:1px solid rgba(240,101,119,.3);color:var(--rose);padding:7px 14px;border-radius:8px;cursor:pointer;font-family:var(--ff);font-size:.78em;font-weight:700">✕ Close</button>
    </div>

    <div style="padding:20px;max-width:680px;margin:0 auto">

      <!-- Integrity Check -->
      <div style="background:#0d1626;border:1px solid rgba(212,168,83,.2);border-radius:12px;padding:18px;margin-bottom:16px">
        <div style="font-family:var(--ff);color:var(--gold);font-size:.88em;font-weight:700;margin-bottom:12px">🔍 Data Integrity Check</div>
        <div id="_devIntegResult" style="font-size:.78em;line-height:2">${integ.html}</div>
        <button onclick="_devRefreshInteg()" style="margin-top:10px;padding:7px 14px;background:rgba(212,168,83,.1);border:1px solid rgba(212,168,83,.3);border-radius:8px;color:var(--gold);cursor:pointer;font-family:var(--ff);font-size:.75em">↻ Re-run Check</button>
      </div>

      <!-- OR Counter Repair -->
      <div style="background:#0d1626;border:1px solid rgba(45,212,160,.2);border-radius:12px;padding:18px;margin-bottom:16px">
        <div style="font-family:var(--ff);color:var(--emerald);font-size:.88em;font-weight:700;margin-bottom:8px">🔢 OR Counter Repair</div>
        <div style="font-size:.78em;color:rgba(255,255,255,.4);margin-bottom:12px;line-height:1.6">
          Use after hardware crash corrupts the OR sequence. Sets counter to the highest OR number found in sales data + 1.
        </div>
        <div id="_devORStatus" style="font-size:.8em;margin-bottom:10px"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="_devRepairOR()" style="padding:8px 14px;background:rgba(45,212,160,.1);border:1px solid rgba(45,212,160,.3);border-radius:8px;color:var(--emerald);cursor:pointer;font-family:var(--ff);font-size:.78em">Auto-Repair OR Counter</button>
          <button onclick="_devSetOR()" style="padding:8px 14px;background:rgba(212,168,83,.1);border:1px solid rgba(212,168,83,.3);border-radius:8px;color:var(--gold);cursor:pointer;font-family:var(--ff);font-size:.78em">Set Counter Manually</button>
        </div>
      </div>

      <!-- GAT Recalculation -->
      <div style="background:#0d1626;border:1px solid rgba(111,163,239,.2);border-radius:12px;padding:18px;margin-bottom:16px">
        <div style="font-family:var(--ff);color:var(--blue);font-size:.88em;font-weight:700;margin-bottom:8px">💰 GAT Recalculation</div>
        <div style="font-size:.78em;color:rgba(255,255,255,.4);margin-bottom:12px;line-height:1.6">
          Recalculates the Grand Accumulated Total from actual sales records. Use if GAT became out-of-sync after a crash.
        </div>
        <div id="_devGATStatus" style="font-size:.8em;margin-bottom:10px"></div>
        <div style="display:flex;gap:8px">
          <button onclick="_devPreviewGAT()" style="padding:8px 14px;background:rgba(111,163,239,.1);border:1px solid rgba(111,163,239,.3);border-radius:8px;color:var(--blue);cursor:pointer;font-family:var(--ff);font-size:.78em">Preview Recalculation</button>
          <button onclick="_devApplyGAT()" style="padding:8px 14px;background:rgba(45,212,160,.1);border:1px solid rgba(45,212,160,.3);border-radius:8px;color:var(--emerald);cursor:pointer;font-family:var(--ff);font-size:.78em">Apply & Save</button>
        </div>
      </div>

      <!-- Storage Resync -->
      <div style="background:#0d1626;border:1px solid rgba(167,139,250,.2);border-radius:12px;padding:18px;margin-bottom:16px">
        <div style="font-family:var(--ff);color:var(--purple);font-size:.88em;font-weight:700;margin-bottom:8px">🔄 Storage Resync</div>
        <div style="font-size:.78em;color:rgba(255,255,255,.4);margin-bottom:12px;line-height:1.6">
          Re-copies all data between localStorage ↔ IndexedDB. Use when stores get out of sync after a crash.
        </div>
        <div id="_devSyncStatus" style="font-size:.8em;margin-bottom:10px"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="_devResync('ls_to_idb')" style="padding:8px 14px;background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.3);border-radius:8px;color:var(--purple);cursor:pointer;font-family:var(--ff);font-size:.78em">localStorage → IDB</button>
          <button onclick="_devResync('idb_to_ls')" style="padding:8px 14px;background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.3);border-radius:8px;color:var(--purple);cursor:pointer;font-family:var(--ff);font-size:.78em">IDB → localStorage</button>
        </div>
      </div>

      <!-- Orphan Cleanup -->
      <div style="background:#0d1626;border:1px solid rgba(240,101,119,.2);border-radius:12px;padding:18px;margin-bottom:16px">
        <div style="font-family:var(--ff);color:var(--rose);font-size:.88em;font-weight:700;margin-bottom:8px">🧹 Orphan Record Cleanup</div>
        <div style="font-size:.78em;color:rgba(255,255,255,.4);margin-bottom:12px;line-height:1.6">
          Finds and optionally removes orphaned records: sales without a valid cashier, POs with missing suppliers, products with invalid branch references.
        </div>
        <div id="_devOrphanResult" style="font-size:.78em;margin-bottom:10px"></div>
        <div style="display:flex;gap:8px">
          <button onclick="_devFindOrphans()" style="padding:8px 14px;background:rgba(251,189,35,.1);border:1px solid rgba(251,189,35,.3);border-radius:8px;color:#fbb923;cursor:pointer;font-family:var(--ff);font-size:.78em">Scan for Orphans</button>
          <button id="_devCleanBtn" onclick="_devCleanOrphans()" style="display:none;padding:8px 14px;background:rgba(240,101,119,.1);border:1px solid rgba(240,101,119,.3);border-radius:8px;color:var(--rose);cursor:pointer;font-family:var(--ff);font-size:.78em">Remove Orphans</button>
        </div>
      </div>

      <!-- PIN Reset -->
      <div style="background:#0d1626;border:1px solid rgba(212,168,83,.2);border-radius:12px;padding:18px;margin-bottom:16px">
        <div style="font-family:var(--ff);color:var(--gold);font-size:.88em;font-weight:700;margin-bottom:8px">🔐 Emergency PIN Reset</div>
        <div style="font-size:.78em;color:rgba(255,255,255,.4);margin-bottom:12px;line-height:1.6">
          Reset any user's PIN without knowing the current one. Use when a user is locked out.
        </div>
        <select id="_devUserSel" style="width:100%;padding:9px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(212,168,83,.25);border-radius:8px;color:#fff;margin-bottom:8px;font-family:var(--fm);font-size:.82em">
          ${LocalDB.getAll('users').map(u=>`<option value="${u.id}">${u.name} (${u.role})</option>`).join('')}
        </select>
        <div style="display:flex;gap:8px">
          <input type="password" id="_devNewPIN" placeholder="New 4-digit PIN" maxlength="4"
            style="flex:1;padding:9px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(212,168,83,.25);border-radius:8px;color:#fff;font-family:var(--fm);font-size:1em;text-align:center;letter-spacing:6px;outline:none"
            oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)">
          <button onclick="_devResetPIN()" style="padding:9px 16px;background:rgba(212,168,83,.15);border:1px solid rgba(212,168,83,.3);border-radius:8px;color:var(--gold);cursor:pointer;font-family:var(--ff);font-size:.82em;font-weight:700">Reset PIN</button>
        </div>
        <div id="_devPINResult" style="font-size:.75em;margin-top:8px;min-height:16px"></div>
      </div>

      <!-- Raw Data Editor -->
      <div style="background:#0d1626;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:18px;margin-bottom:16px">
        <div style="font-family:var(--ff);color:rgba(255,255,255,.6);font-size:.88em;font-weight:700;margin-bottom:8px">📋 Raw Store Inspector</div>
        <div style="font-size:.78em;color:rgba(255,255,255,.4);margin-bottom:12px">View and export raw JSON for any store.</div>
        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
          ${STORES.map(s=>`<button onclick="_devInspect('${s}')" style="padding:5px 10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:rgba(255,255,255,.5);cursor:pointer;font-family:var(--fm);font-size:.7em">${s}</button>`).join('')}
        </div>
        <div id="_devInspectOut" style="background:#060a12;border-radius:8px;padding:12px;font-size:.72em;color:rgba(255,255,255,.5);max-height:200px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;display:none"></div>
      </div>

      <!-- Session Info -->
      <div style="background:#0d1626;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px;font-size:.72em;color:rgba(255,255,255,.3);line-height:2">
        <div style="font-family:var(--ff);color:rgba(255,255,255,.4);font-size:.82em;font-weight:700;margin-bottom:8px">ℹ️ System Info</div>
        Storage mode: <strong style="color:var(--gold)">${storageMode}</strong> &nbsp;|&nbsp;
        IDB ready: <strong style="color:${_idb?'var(--emerald)':'var(--rose)'}">${_idb?'Yes':'No'}</strong> &nbsp;|&nbsp;
        Online: <strong style="color:${isOnline?'var(--emerald)':'var(--rose)'}">${isOnline?'Yes':'No'}</strong> &nbsp;|&nbsp;
        Offline queue: <strong style="color:var(--gold)">${offQ.length}</strong><br>
        Total sales: <strong style="color:var(--gold)">${LocalDB.getAll('sales').length}</strong> &nbsp;|&nbsp;
        Total products: <strong style="color:var(--gold)">${LocalDB.getAll('products').length}</strong> &nbsp;|&nbsp;
        Total users: <strong style="color:var(--gold)">${LocalDB.getAll('users').length}</strong><br>
        Current user: <strong style="color:var(--gold)">${currentUser?.name||'None'} (${currentUser?.role||'—'})</strong> &nbsp;|&nbsp;
        GAT: <strong style="color:var(--gold)">${fc(getGAT())}</strong>
      </div>

    </div>`;

  document.body.appendChild(panel);
  _devPreviewGAT();
  _devShowORStatus();
}

// ── Integrity Check ───────────────────────────────────────────
function _devRunIntegrityCheck() {
  const results = [];
  const sales = LocalDB.getAll('sales');
  const products = LocalDB.getAll('products');
  const users = LocalDB.getAll('users');

  // Duplicate OR numbers
  const orNums = sales.filter(s=>s.orNumber).map(s=>s.orNumber);
  const dupORs = orNums.filter((o,i)=>orNums.indexOf(o)!==i);
  results.push(dupORs.length===0
    ? '✅ No duplicate OR numbers'
    : `🔴 ${dupORs.length} duplicate OR number(s): ${[...new Set(dupORs)].slice(0,5).join(', ')}`);

  // OR counter vs actual max
  const maxORNum = sales.reduce((max,s)=>{
    const n=parseInt((s.orNumber||'').replace(/\D/g,''))||0;
    return Math.max(max,n);
  },0);
  const storedCounter = parseInt(getSetting('bir_counter','0'))||0;
  results.push(storedCounter >= maxORNum
    ? `✅ OR counter (${storedCounter}) ≥ max in sales (${maxORNum})`
    : `🔴 OR counter (${storedCounter}) < max in sales (${maxORNum}) — gap of ${maxORNum-storedCounter}`);

  // GAT vs sum of sales
  const calcGAT = sales.filter(s=>!s.voided).reduce((a,s)=>a+s.total,0);
  const storedGAT = getGAT();
  const diff = Math.abs(calcGAT - storedGAT);
  results.push(diff < 0.01
    ? `✅ GAT matches (${fc(storedGAT)})`
    : `🟡 GAT mismatch: stored ${fc(storedGAT)} vs calculated ${fc(calcGAT)} (diff: ${fc(diff)})`);

  // Voided sales still in GAT
  const voidedTotal = sales.filter(s=>s.voided).reduce((a,s)=>a+s.total,0);
  results.push(voidedTotal===0
    ? '✅ No voided sales impact on GAT'
    : `ℹ️ ${sales.filter(s=>s.voided).length} voided sale(s) totalling ${fc(voidedTotal)} — excluded from GAT`);

  // Products with negative stock
  const negStock = products.filter(p=>p.stock<0);
  results.push(negStock.length===0
    ? '✅ No negative stock values'
    : `🔴 ${negStock.length} product(s) with negative stock: ${negStock.map(p=>p.name).slice(0,3).join(', ')}`);

  // Users with unhashed PINs
  const plaintextUsers = users.filter(u=>u.pin&&!u.pin.includes(':'));
  results.push(plaintextUsers.length===0
    ? '✅ All PINs are hashed'
    : `🟡 ${plaintextUsers.length} user(s) still have plaintext PINs: ${plaintextUsers.map(u=>u.name).join(', ')}`);

  // Duplicate user IDs
  const uids = users.map(u=>u.id);
  const dupUIDs = uids.filter((id,i)=>uids.indexOf(id)!==i);
  results.push(dupUIDs.length===0
    ? '✅ No duplicate user IDs'
    : `🔴 Duplicate user IDs found: ${[...new Set(dupUIDs)].join(', ')}`);

  // localStorage vs IDB sync
  const lsCount = STORES.reduce((a,s)=>a+LocalDB.getAll(s).length,0);
  results.push(`ℹ️ localStorage total records: ${lsCount}`);

  const html = results.map(r=>`<div style="padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04)">${r}</div>`).join('');
  return { results, html };
}

function _devRefreshInteg() {
  const r = _devRunIntegrityCheck();
  const el = document.getElementById('_devIntegResult');
  if(el) el.innerHTML = r.html;
}

// ── OR Counter Repair ─────────────────────────────────────────
function _devShowORStatus() {
  const sales = LocalDB.getAll('sales');
  const maxOR = sales.reduce((max,s)=>{
    const n = parseInt((s.orNumber||'').replace(/\D/g,''))||0;
    return Math.max(max,n);
  },0);
  const stored = parseInt(getSetting('bir_counter','0'))||0;
  const el = document.getElementById('_devORStatus');
  if(el) el.innerHTML = `Current counter: <strong style="color:var(--gold)">${stored}</strong> &nbsp;|&nbsp; Max in sales: <strong style="color:var(--emerald)">${maxOR}</strong> &nbsp;|&nbsp; Status: <strong style="color:${stored>=maxOR?'var(--emerald)':'var(--rose)'}">${stored>=maxOR?'OK':'NEEDS REPAIR'}</strong>`;
}
function _devRepairOR() {
  const sales = LocalDB.getAll('sales');
  const maxOR = sales.reduce((max,s)=>{
    const n = parseInt((s.orNumber||'').replace(/\D/g,''))||0;
    return Math.max(max,n);
  },0);
  const newCounter = maxOR; // next OR will be maxOR+1
  saveSetting('bir_counter', String(newCounter));
  logAct('DEV: OR Counter Repaired', `Set to ${newCounter} (max in sales: ${maxOR})`);
  _devShowORStatus();
  const el = document.getElementById('_devORStatus');
  if(el) el.innerHTML += `<br><span style="color:var(--emerald)">✓ Repaired — counter set to ${newCounter}</span>`;
}
async function _devSetOR() {
  const val = await prompt2('Set OR counter to (next OR will be this + 1):', String(parseInt(getSetting('bir_counter','0'))||0), '', 'number');
  const n = parseInt(val);
  if(isNaN(n)||n<0){toast('Invalid value','rose');return;}
  saveSetting('bir_counter', String(n));
  logAct('DEV: OR Counter Set', `Manually set to ${n}`);
  _devShowORStatus();
}

// ── GAT Recalculation ─────────────────────────────────────────
function _devPreviewGAT() {
  const sales = LocalDB.getAll('sales').filter(s=>!s.voided);
  const calc = sales.reduce((a,s)=>a+s.total,0);
  const stored = getGAT();
  const el = document.getElementById('_devGATStatus');
  if(el) el.innerHTML = `Stored GAT: <strong style="color:var(--gold)">${fc(stored)}</strong> &nbsp;|&nbsp; Calculated from ${sales.length} sales: <strong style="color:var(--emerald)">${fc(calc)}</strong> &nbsp;|&nbsp; Diff: <strong style="color:${Math.abs(calc-stored)<0.01?'var(--emerald)':'var(--rose)'}">${fc(Math.abs(calc-stored))}</strong>`;
}
function _devApplyGAT() {
  const sales = LocalDB.getAll('sales').filter(s=>!s.voided);
  const calc = sales.reduce((a,s)=>a+s.total,0).toFixed(2);
  saveSetting('bir_gat', calc);
  logAct('DEV: GAT Recalculated', `Set to ${calc} from ${sales.length} non-voided sales`);
  _devPreviewGAT();
  const el = document.getElementById('_devGATStatus');
  if(el) el.innerHTML += `<br><span style="color:var(--emerald)">✓ GAT updated to ${fc(parseFloat(calc))}</span>`;
}

// ── Storage Resync ────────────────────────────────────────────
async function _devResync(direction) {
  const el = document.getElementById('_devSyncStatus');
  if(el) el.innerHTML = '<span style="color:var(--gold)">Syncing…</span>';
  let count = 0;
  try {
    if (direction === 'ls_to_idb') {
      if(!_idb){if(el)el.innerHTML='<span style="color:var(--rose)">IDB not available</span>';return;}
      count = await IDB.migrateFromLocal();
      logAct('DEV: Storage Resync', `localStorage → IDB: ${count} records`);
    } else {
      // IDB → localStorage
      for(const store of STORES){
        const items = await IDB.getAll(store);
        if(items.length){LocalDB.set(store,items);count+=items.length;}
      }
      logAct('DEV: Storage Resync', `IDB → localStorage: ${count} records`);
    }
    if(el) el.innerHTML = `<span style="color:var(--emerald)">✓ Synced ${count} records</span>`;
  } catch(e) {
    if(el) el.innerHTML = `<span style="color:var(--rose)">Error: ${e.message}</span>`;
  }
}

// ── Orphan Cleanup ────────────────────────────────────────────
let _devOrphansFound = [];
function _devFindOrphans() {
  const sales = LocalDB.getAll('sales');
  const users = LocalDB.getAll('users');
  const products = LocalDB.getAll('products');
  const branches = LocalDB.getAll('branches');
  const pos = LocalDB.getAll('purchaseOrders');
  const suppliers = LocalDB.getAll('suppliers');
  const orphans = [];

  // Sales with non-existent cashier
  sales.forEach(s=>{
    if(s.cashierId&&!users.find(u=>u.id===s.cashierId))
      orphans.push({type:'sale',id:s.id,issue:`Cashier ID ${s.cashierId} not found`});
  });
  // Sales items with non-existent product
  sales.forEach(s=>(s.items||[]).forEach(it=>{
    if(it.productId&&!products.find(p=>p.id===it.productId))
      orphans.push({type:'sale_item',id:s.id,issue:`Product ID ${it.productId} (${it.name}) not in products`});
  }));
  // Products with invalid branch
  products.forEach(p=>{
    if(p.branchId&&!branches.find(b=>b.id===p.branchId))
      orphans.push({type:'product',id:p.id,issue:`Branch ID ${p.branchId} not found`});
  });
  // POs with missing supplier
  pos.forEach(po=>{
    if(po.supplierId&&!suppliers.find(s=>s.id===po.supplierId))
      orphans.push({type:'po',id:po.id,issue:`Supplier ID ${po.supplierId} not found`});
  });
  // Users with invalid branch
  users.forEach(u=>{
    if(u.branchId&&!branches.find(b=>b.id===u.branchId))
      orphans.push({type:'user',id:u.id,issue:`Branch ID ${u.branchId} not found`});
  });

  _devOrphansFound = orphans;
  const el = document.getElementById('_devOrphanResult');
  const btn = document.getElementById('_devCleanBtn');
  if(!orphans.length){
    if(el) el.innerHTML = '<span style="color:var(--emerald)">✅ No orphan records found</span>';
    if(btn) btn.style.display='none';
  } else {
    if(el) el.innerHTML = `<span style="color:var(--rose)">⚠ ${orphans.length} orphan(s) found:</span><br>`+orphans.slice(0,8).map(o=>`<div style="padding:2px 0;color:rgba(255,255,255,.4)">[${o.type} #${o.id}] ${o.issue}</div>`).join('')+(orphans.length>8?`<div style="color:rgba(255,255,255,.3)">…and ${orphans.length-8} more</div>`:'');
    if(btn) btn.style.display='block';
  }
  logAct('DEV: Orphan Scan', `Found ${orphans.length} orphan record(s)`);
}
async function _devCleanOrphans() {
  if(!_devOrphansFound.length){toast('No orphans to clean','gold');return;}
  const ok = await confirm2(`Remove ${_devOrphansFound.length} orphan record(s)? This modifies live data.`,'🧹',true);
  if(!ok)return;
  // For safety, we only null-out bad references rather than deleting records
  _devOrphansFound.forEach(o=>{
    if(o.type==='product'){const p=LocalDB.getById('products',o.id);if(p){p.branchId=null;LocalDB.update('products',p);}}
    if(o.type==='user'){const u=LocalDB.getById('users',o.id);if(u){u.branchId=null;LocalDB.update('users',u);}}
    if(o.type==='po'){const po=LocalDB.getById('purchaseOrders',o.id);if(po){po.supplierId=null;LocalDB.update('purchaseOrders',po);}}
  });
  logAct('DEV: Orphan Cleanup', `Nulled references in ${_devOrphansFound.length} record(s)`);
  _devOrphansFound=[];
  const el=document.getElementById('_devOrphanResult');
  if(el)el.innerHTML='<span style="color:var(--emerald)">✓ Orphan references cleared</span>';
  document.getElementById('_devCleanBtn').style.display='none';
}

// ── Emergency PIN Reset ───────────────────────────────────────
async function _devResetPIN() {
  const userId = parseInt(document.getElementById('_devUserSel')?.value);
  const newPIN = document.getElementById('_devNewPIN')?.value||'';
  const resEl = document.getElementById('_devPINResult');
  if(!userId){if(resEl)resEl.innerHTML='<span style="color:var(--rose)">Select a user</span>';return;}
  if(!newPIN||newPIN.length!==4||!/^\d{4}$/.test(newPIN)){if(resEl)resEl.innerHTML='<span style="color:var(--rose)">PIN must be exactly 4 digits</span>';return;}
  const u = LocalDB.getById('users', userId);
  if(!u){if(resEl)resEl.innerHTML='<span style="color:var(--rose)">User not found</span>';return;}
  const {stored} = await hashPIN(newPIN);
  u.pin = stored;
  LocalDB.update('users', u);
  if(storageMode==='firebase'){const fu=FirebaseDB.getById('users',userId);if(fu){fu.pin=stored;FirebaseDB.update('users',fu);}}
  logAct('DEV: Emergency PIN Reset', `PIN reset for user "${u.name}" (ID: ${userId})`);
  if(resEl)resEl.innerHTML=`<span style="color:var(--emerald)">✓ PIN reset for ${u.name}. New PIN: ${newPIN}</span>`;
  if(document.getElementById('_devNewPIN'))document.getElementById('_devNewPIN').value='';
}

// ── Raw Store Inspector ───────────────────────────────────────
function _devInspect(store) {
  const data = LocalDB.getAll(store);
  const out = document.getElementById('_devInspectOut');
  if(!out)return;
  // Redact PIN hashes for security
  const safe = data.map(r=>{
    const c={...r};
    if(c.pin)c.pin='[REDACTED]';
    return c;
  });
  out.style.display='block';
  out.textContent = JSON.stringify(safe, null, 2);
  logAct('DEV: Store Inspected', `Viewed "${store}" (${data.length} records)`);
}


async function bootFirebase(){
  let savedConfig='',savedMode='local';
  try{
    const dbSettings=LocalDB.getAll('settings');
    const cfgE=dbSettings.find(s=>s.key==='firebase_config');
    const modeE=dbSettings.find(s=>s.key==='storageMode');
    if(cfgE)savedConfig=cfgE.value;
    if(modeE)savedMode=modeE.value;
  }catch{}
  // Guard: only attempt if config is non-empty valid JSON and mode is firebase
  if(savedMode==='firebase'&&savedConfig&&savedConfig.trim().startsWith('{')){
    try{
      const cfg=JSON.parse(savedConfig);
      if(!cfg.apiKey||!cfg.projectId)throw new Error('Missing apiKey or projectId');
      const ok=await FirebaseDB.init(cfg);
      if(ok){storageMode='firebase';}
      else{storageMode='local';setSyncStatus('offline','Firebase unavailable — using local');}
    }catch(e){
      storageMode='local';
      console.warn('Firebase boot error:',e.message);
      setSyncStatus('local','Firebase config error — using local');
    }
  }
  updateSyncBar();
}

