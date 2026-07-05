/* ============================================================
   MLEA POS v6.0 — 17-storage-idb.js
   IndexedDB adapter, storage quota, error boundary
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */


// ════════════════════════════════════════════
let _idb = null;
const IDB_NAME = 'mlea_pos_v6';
const IDB_VER = 3;

async function initIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
    };
    req.onsuccess = e => { _idb = e.target.result; resolve(true); };
    req.onerror = e => { console.warn('IDB init failed:', e); resolve(false); };
  });
}

const IDB = {
  async getAll(store) {
    if (!_idb) return LocalDB.getAll(store);
    return new Promise(resolve => {
      const tx = _idb.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve(LocalDB.getAll(store));
    });
  },
  async set(store, items) {
    if (!_idb) { LocalDB.set(store, items); return; }
    return new Promise(resolve => {
      const tx = _idb.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      os.clear();
      items.forEach(item => os.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => { LocalDB.set(store, items); resolve(); };
    });
  },
  async add(store, item) {
    const items = await this.getAll(store);
    item.id = items.reduce((max, i) => Math.max(max, i.id || 0), 0) + 1;
    item.createdAt = new Date().toISOString();
    items.push(item);
    await this.set(store, items);
    // Keep localStorage in sync as fallback
    LocalDB.set(store, items);
    return item.id;
  },
  async update(store, item) {
    const items = await this.getAll(store);
    const idx = items.findIndex(i => i.id === item.id);
    if (idx !== -1) { item.updatedAt = new Date().toISOString(); items[idx] = item; await this.set(store, items); LocalDB.set(store, items); }
  },
  async delete(store, id) {
    const items = (await this.getAll(store)).filter(i => i.id !== id);
    await this.set(store, items); LocalDB.set(store, items);
  },
  getById(store, id) { return this.getAll(store).then(items => items.find(i => i.id === id) || null); },
  getByBranch(store, bid) { return this.getAll(store).then(items => items.filter(i => i.branchId === bid)); },
  // Migrate all localStorage data into IDB
  async migrateFromLocal() {
    let count = 0;
    for (const store of STORES) {
      const items = LocalDB.getAll(store);
      if (items.length) { await this.set(store, items); count += items.length; }
    }
    return count;
  }
};

// ════════════════════════════════════════════
// PHASE 3B: STORAGE QUOTA MONITOR
// ════════════════════════════════════════════
async function checkStorageQuota() {
  let used = 0, quota = 0, pct = 0;
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      used = est.usage || 0; quota = est.quota || 1;
      pct = Math.round((used / quota) * 100);
    } else {
      // Fallback: measure localStorage
      const raw = JSON.stringify(localStorage).length;
      used = raw; quota = 5 * 1024 * 1024; // 5MB limit
      pct = Math.round((raw / quota) * 100);
    }
  } catch (e) { return null; }

  if (pct >= 90) {
    toast(`🚨 Storage critically full (${pct}%)! Export a backup immediately.`, 'rose', 10000);
  } else if (pct >= 70) {
    toast(`⚠️ Storage ${pct}% full. Consider downloading a backup.`, 'gold', 6000);
  }
  return { used, quota, pct };
}

function renderStorageQuota(containerId) {
  checkStorageQuota().then(info => {
    const el = document.getElementById(containerId);
    if (!el || !info) return;
    const { used, quota, pct } = info;
    const cls = pct >= 90 ? 'qcrit' : pct >= 70 ? 'qwarn' : 'qok';
    const usedMB = (used / 1024 / 1024).toFixed(2);
    const quotaMB = (quota / 1024 / 1024).toFixed(0);
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:.75em;margin-bottom:4px">
        <span style="color:var(--text2)">Storage Used</span>
        <span style="color:${pct >= 90 ? 'var(--rose)' : pct >= 70 ? '#fbb923' : 'var(--emerald)'}"><strong>${pct}%</strong> (${usedMB} MB of ${quotaMB} MB)</span>
      </div>
      <div class="quota-wrap"><div class="quota-bar ${cls}" style="width:${Math.min(pct,100)}%"></div></div>
      ${pct >= 70 ? `<p style="font-size:.72em;color:${pct>=90?'var(--rose)':'#fbb923'};margin-top:4px">${pct>=90?'🚨 Critical — export backup NOW':'⚠️ Getting full — download a backup soon'}</p>` : ''}`;
  });
}

// ════════════════════════════════════════════
// PHASE 3C: ERROR BOUNDARY
// ════════════════════════════════════════════
let _crashCartBackup = null;

window.addEventListener('error', e => {
  console.error('Global error:', e.error);
  // Save cart before anything else
  if (cart && cart.length) {
    try { localStorage.setItem('mlea_crash_cart', JSON.stringify(cart)); _crashCartBackup = cart; } catch {}
  }
  showErrorScreen(e.message || 'An unexpected error occurred', e.filename, e.lineno);
});

window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled promise rejection:', e.reason);
  if (e.reason?.message?.includes('Firebase') || e.reason?.message?.includes('network')) {
    toast('Network error — working offline', 'gold');
    return; // Don't crash for Firebase/network errors
  }
  if (cart && cart.length) {
    try { localStorage.setItem('mlea_crash_cart', JSON.stringify(cart)); } catch {}
  }
});

function showErrorScreen(msg, file, line) {
  // Don't show for minor errors
  if (msg && (msg.includes('ResizeObserver') || msg.includes('Script error'))) return;
  const existing = document.getElementById('errScreen');
  if (existing) return;
  const div = document.createElement('div');
  div.id = 'errScreen'; div.className = 'err-screen';
  const hasCart = _crashCartBackup && _crashCartBackup.length > 0;
  div.innerHTML = `
    <div style="font-size:3em">⚠️</div>
    <h2>Something went wrong</h2>
    <p>${msg || 'An unexpected error occurred. Your data is safe.'}</p>
    ${hasCart ? `<div class="card" style="background:rgba(45,212,160,.08);border-color:rgba(45,212,160,.3);text-align:left;padding:12px 16px;max-width:300px">
      <p style="font-size:.78em;color:var(--emerald);font-weight:600;margin-bottom:6px">🛒 Your cart was saved</p>
      <p style="font-size:.75em;color:var(--text2)">${_crashCartBackup.length} items preserved. They will be restored when you reload.</p>
    </div>` : ''}
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
      <button class="btn bs" onclick="location.reload()">🔄 Reload App</button>
      <button class="btn bw" onclick="downloadBackup();document.getElementById('errScreen').remove()">💾 Download Backup First</button>
      <button class="btn bd" onclick="document.getElementById('errScreen').remove()">Dismiss</button>
    </div>
    ${file ? `<p style="font-size:.65em;color:var(--text3);margin-top:8px">Error in ${file}:${line}</p>` : ''}`;
  document.body.appendChild(div);
}

// Restore crash cart on startup
function restoreCrashCart() {
  try {
    const saved = localStorage.getItem('mlea_crash_cart');
    if (saved) {
      const items = JSON.parse(saved);
      if (items && items.length) {
        cart = items;
        localStorage.removeItem('mlea_crash_cart');
        setTimeout(() => toast(`🛒 Restored ${items.length} cart items from before the crash`, 'gold', 5000), 2000);
      }
    }
  } catch {}
}
