/* ============================================================
   MLEA POS v6.0 — 15-pwa-auth-or.js
   PWA install, Firebase Auth, Cloud Function OR, receipt hash+QR
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */

// ════════════════════════════════════════════
// PHASE 1A: SERVICE WORKER + PWA INSTALL
// ════════════════════════════════════════════
let _deferredInstall = null;

function initPWA() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  }

  // Capture install prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredInstall = e;
    // Show banner after 10s if not already installed
    setTimeout(showPWABanner, 10000);
  });

  // Hide banner once installed
  window.addEventListener('appinstalled', () => {
    const b = document.getElementById('pwaBanner');
    if (b) b.remove();
    _deferredInstall = null;
    toast('MLEA POS installed on your device ✓', 'emerald');
  });
}

function showPWABanner() {
  if (!_deferredInstall || document.getElementById('pwaBanner')) return;
  const b = document.createElement('div');
  b.id = 'pwaBanner';
  b.className = 'pwa-banner';
  b.innerHTML = `<span style="font-size:1.8em">🏪</span>
    <p><strong style="color:var(--gold);font-family:var(--ff)">Install MLEA POS</strong><br>Add to home screen for faster access and offline use</p>
    <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
      <button class="btn bp bxs" onclick="installPWA()">Install</button>
      <button class="btn bd bxs" onclick="document.getElementById('pwaBanner').remove()">Later</button>
    </div>`;
  document.body.appendChild(b);
}

async function installPWA() {
  if (!_deferredInstall) return;
  _deferredInstall.prompt();
  const { outcome } = await _deferredInstall.userChoice;
  if (outcome === 'accepted') { _deferredInstall = null; document.getElementById('pwaBanner')?.remove(); }
}

// ════════════════════════════════════════════
// PHASE 1B: FIREBASE AUTHENTICATION
// ════════════════════════════════════════════
let _fbAuth = null;  // firebase auth module ref
let _authUser = null; // currently authenticated Firebase user

async function initFBAuth(app) {
  try {
    const authMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    _fbAuth = { ...authMod, auth: authMod.getAuth(app) };
    _fbAuth.onAuthStateChanged(_fbAuth.auth, user => {
      _authUser = user;
      updateAuthBadge();
    });
    return true;
  } catch (e) {
    console.warn('Firebase Auth init failed:', e);
    return false;
  }
}

async function fbSignIn(email, password) {
  if (!_fbAuth) return { ok: false, error: 'Firebase Auth not initialised' };
  try {
    const cred = await _fbAuth.signInWithEmailAndPassword(_fbAuth.auth, email, password);
    _authUser = cred.user;
    return { ok: true };
  } catch (e) {
    const msg = e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found'
      ? 'Incorrect email or password'
      : e.code === 'auth/too-many-requests'
      ? 'Too many attempts — try again later'
      : e.message;
    return { ok: false, error: msg };
  }
}

async function fbSignOut() {
  if (_fbAuth) await _fbAuth.signOut(_fbAuth.auth);
  _authUser = null;
}

function updateAuthBadge() {
  const b = document.getElementById('sbSub');
  if (!b) return;
  const mode = storageMode === 'firebase' ? '☁️ Firebase' : '💾 Local';
  const auth = _authUser ? '🔒 Authenticated' : '';
  b.textContent = `v6.0 · ${mode}${auth ? ' · ' + auth : ''}`;
}

// Show Firebase auth gate when Firebase is active but user not authenticated
function showAuthGate() {
  if (document.getElementById('authGate')) return;
  const div = document.createElement('div');
  div.id = 'authGate';
  div.className = 'auth-overlay';
  div.innerHTML = `<div class="auth-box">
    <div style="font-size:2.5em;margin-bottom:12px">🔐</div>
    <h3>Device Authentication</h3>
    <p>This terminal requires Firebase authentication.<br>Sign in once per device.</p>
    <label class="inp-label" style="text-align:left;display:block">Email</label>
    <input type="email" id="authEmail" placeholder="admin@yourstore.com" style="margin-bottom:8px">
    <label class="inp-label" style="text-align:left;display:block">Password</label>
    <input type="password" id="authPass" placeholder="••••••••" style="margin-bottom:4px"
      onkeypress="if(event.key==='Enter')doFBSignIn()">
    <div id="authErr" style="color:var(--rose);font-size:.78em;min-height:18px;margin-bottom:12px;font-weight:600"></div>
    <button class="btn bp" style="width:100%" id="authBtn" onclick="doFBSignIn()">Sign In to Firebase</button>
    <p style="margin-top:14px;font-size:.72em;color:var(--text3)">Or <button onclick="skipFBAuth()" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:1em;text-decoration:underline">continue in local mode</button></p>
  </div>`;
  document.body.appendChild(div);
  setTimeout(() => document.getElementById('authEmail')?.focus(), 100);
}

async function doFBSignIn() {
  const email = document.getElementById('authEmail')?.value.trim();
  const pass = document.getElementById('authPass')?.value;
  const errEl = document.getElementById('authErr');
  const btn = document.getElementById('authBtn');
  if (!email || !pass) { if (errEl) errEl.textContent = 'Enter email and password'; return; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Signing in…'; }
  const result = await fbSignIn(email, pass);
  if (result.ok) {
    document.getElementById('authGate')?.remove();
    toast('Firebase authenticated ✓', 'emerald');
  } else {
    if (errEl) errEl.textContent = result.error;
    if (btn) { btn.disabled = false; btn.textContent = 'Sign In to Firebase'; }
  }
}

function skipFBAuth() {
  // Fall back to local mode
  storageMode = 'local';
  saveSetting('storageMode', 'local');
  document.getElementById('authGate')?.remove();
  updateSyncBar();
  toast('Running in local mode', 'gold');
}

// ════════════════════════════════════════════
// PHASE 1C: CLOUD FUNCTION OR NUMBER
// ════════════════════════════════════════════
let _fbFunctions = null;

async function initFBFunctions(app) {
  try {
    const fnMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js');
    _fbFunctions = { ...fnMod, functions: fnMod.getFunctions(app, 'asia-east1') };
    return true;
  } catch (e) {
    console.warn('Firebase Functions init failed:', e);
    return false;
  }
}

// Returns OR number from Cloud Function if available, falls back to local counter
// ════════════════════════════════════════════
// RECEIPT INTEGRITY — SHA-256 HASH + QR CODE
// Each sale gets a hash of its key fields.
// Printed as a QR code on receipts.
// Anyone can verify the receipt is unaltered.
// ════════════════════════════════════════════

async function generateReceiptHash(sale) {
  // Canonical string of key fields — order matters
  const payload = [
    sale.orNumber || sale.id,
    sale.date,
    sale.total.toFixed(2),
    sale.cashierName || '',
    sale.branchName || '',
    sale.vatType || '',
    (sale.items || []).map(i => `${i.name}:${i.quantity}:${i.price.toFixed(2)}`).join('|'),
    sale.vatableSales ? sale.vatableSales.toFixed(2) : '0.00',
    sale.tax ? sale.tax.toFixed(2) : '0.00',
  ].join('||');
  try {
    return await _sha256hex(payload);
  } catch(e) { return ''; }
}

// Store hash on sale record after creation
async function attachReceiptHash(saleId) {
  const sale = LocalDB.getById('sales', saleId);
  if (!sale) return '';
  const hash = await generateReceiptHash(sale);
  if (!hash) return '';
  sale.receiptHash = hash;
  sale.receiptHashTs = new Date().toISOString();
  LocalDB.update('sales', sale);
  if (storageMode === 'firebase') {
    const fs = FirebaseDB.getById('sales', saleId);
    if (fs) { fs.receiptHash = hash; fs.receiptHashTs = sale.receiptHashTs; FirebaseDB.update('sales', fs); }
  }
  return hash;
}

// Verify a receipt hash (for display/audit)
async function verifyReceiptHash(sale) {
  if (!sale.receiptHash) return 'unverified';
  const computed = await generateReceiptHash(sale);
  return computed === sale.receiptHash ? 'valid' : 'tampered';
}

// Load QRCode.js on demand (lightweight, offline-capable via SW cache)
async function loadQRLib() {
  if (window.QRCode) return true;
  return new Promise(resolve => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

// Generate QR data URL from text
async function generateQRDataURL(text) {
  const loaded = await loadQRLib();
  if (!loaded) return '';
  try {
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:-9999px';
    document.body.appendChild(container);
    new QRCode(container, {
      text, width: 128, height: 128,
      colorDark: '#000000', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
    await new Promise(r => setTimeout(r, 100)); // let QR render
    const canvas = container.querySelector('canvas');
    const img = container.querySelector('img');
    let dataURL = '';
    if (canvas) dataURL = canvas.toDataURL('image/png');
    else if (img) dataURL = img.src;
    container.remove();
    return dataURL;
  } catch(e) { return ''; }
}

// Build verification QR content — compact URL-style payload
function buildVerifyQRContent(sale) {
  const bir = getBIR();
  return [
    'MLEA-OR-VERIFY',
    sale.orNumber || sale.id,
    sale.date,
    sale.total.toFixed(2),
    bir.tin,
    (sale.receiptHash || '').slice(0, 16), // first 16 hex chars for compact QR
  ].join(':');
}

// Returns OR number from Cloud Function if available, falls back to local counter
async function getORNumber() {
  if (_fbFunctions && storageMode === 'firebase' && isOnline) {
    try {
      const bir = getBIR();
      const fn = _fbFunctions.httpsCallable(_fbFunctions.functions, 'getNextORNumber');
      const result = await fn({ prefix: bir.prefix, seriesTo: bir.serTo });
      const { orNumber, remaining, nearingEnd } = result.data;
      if (nearingEnd) toast(`⚠️ OR series almost exhausted! ${remaining} receipts remaining`, 'rose', 7000);
      // Keep local counter in sync
      saveSetting('bir_counter', String(result.data.counter));
      return orNumber;
    } catch (e) {
      console.warn('Cloud Function OR failed, falling back to local:', e);
    }
  }
  // Local fallback (offline or no functions)
  return getNextOR();
}

